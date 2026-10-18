#!/usr/bin/env python3
"""Turn the soundscape originals into the files Graphium ships, plus a rights ledger.

    python3 scripts/sounds/process.py ORIGINALS_DIR OUT_DIR

Reads macos/docs/planning/soundscapes/v1-sounds.tsv (one row per chosen sound, licenses
checked on each Freesound page). Originals are named `<freesound id>__<author>__<name>.<ext>`,
as Freesound downloads them, and are never committed.

Beds become seamless loops (the tail crossfaded onto the head) at -23 LUFS integrated.
One-shots are trimmed, faded and levelled by their loudest 400 ms (momentary max) to
-18 LUFS. A limiter keeps peaks 1.5 dB below full scale. These are starting levels: the plan sets the
final ones from a recording of the Discord stream. Output is AAC in .m4a, which
AVAudioFile reads natively.

Needs ffmpeg and numpy.
"""

import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 48_000
BED_LUFS = -23.0
ONE_SHOT_MOMENTARY_LUFS = -18.0
PEAK_CEILING_DB = -1.5
BED_MAX_SECONDS = 120.0
LOOP_CROSSFADE_SECONDS = 3.0

# Universal Category System CatIDs, so files sort and search by kind.
UCS = {
    ("cave", "bed"): "AMBCave", ("cave", "drips"): "WATRDrip", ("cave", "growls"): "CREAMisc",
    ("tavern", "bed"): "AMBRest", ("tavern", "bed-alt"): "CROWDWalla",
    ("tavern", "table"): "FOODGlas", ("tavern", "room"): "MOVEMisc",
    ("forest", "bed"): "AMBForst", ("forest", "owls"): "BIRDOwl", ("forest", "wild"): "ANMLWolf",
    ("storm", "bed"): "WEATStorm", ("storm", "thunder"): "WEATThun", ("storm", "gusts"): "WINDGust",
    ("dungeon", "bed"): "AMBDungn", ("dungeon", "metal"): "DOORMisc", ("dungeon", "vermin"): "ANMLRodnt",
    ("battle", "bed"): "AMBBtl", ("battle", "swords"): "WEAPSwrd", ("battle", "cries"): "VOXBtl",
}


def run(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, **kw)


def decode(path):
    """Float32 samples at RATE, shape (frames, channels), at most stereo."""
    probe = run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                 "stream=channels", "-of", "csv=p=0", str(path)], text=True)
    channels = min(2, int(probe.stdout.strip().split(",")[0]))
    raw = run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(channels), "-ar", str(RATE),
               "-f", "f32le", "-"]).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


def loudness(samples):
    """(integrated LUFS, momentary max LUFS) from ffmpeg's EBU R128 meter.

    The momentary window is 400 ms, so shorter clips are measured padded with silence."""
    short = int(0.5 * RATE) - len(samples)
    if short > 0:
        samples = np.concatenate([samples, np.zeros((short, samples.shape[1]), dtype=samples.dtype)])
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-v", "verbose", "-f", "f32le", "-ar", str(RATE), "-ac", str(samples.shape[1]),
         "-i", "-", "-af", "ebur128=framelog=verbose", "-f", "null", "-"],
        input=samples.astype(np.float32).tobytes(), capture_output=True, check=True)
    log = proc.stderr.decode(errors="replace")
    momentary = [float(m) for m in re.findall(r"\bM:\s*(-?[\d.]+)", log)]
    integrated = re.findall(r"I:\s*(-?[\d.]+) LUFS", log)
    return float(integrated[-1]) if integrated else float("-inf"), max(momentary, default=float("-inf"))


def peak_db(samples):
    peak = float(np.max(np.abs(samples)))
    return 20 * np.log10(peak) if peak > 0 else float("-inf")


def fade(samples, seconds_in, seconds_out):
    n_in, n_out = int(seconds_in * RATE), int(seconds_out * RATE)
    if n_in:
        samples[:n_in] *= np.linspace(0, 1, n_in)[:, None]
    if n_out:
        samples[-n_out:] *= np.linspace(1, 0, n_out)[:, None]
    return samples


def trim_silence(samples, below_peak_db=-45.0):
    level = np.max(np.abs(samples), axis=1)
    threshold = level.max() * 10 ** (below_peak_db / 20)
    loud = np.nonzero(level > threshold)[0]
    start = max(0, loud[0] - int(0.01 * RATE))
    end = min(len(samples), loud[-1] + int(0.05 * RATE))
    return samples[start:end]


def make_loop(samples):
    """Crossfade the tail onto the head with equal-power curves, so the end runs into the start."""
    samples = samples[: int(BED_MAX_SECONDS * RATE)]
    x = min(int(LOOP_CROSSFADE_SECONDS * RATE), len(samples) // 8)
    t = np.linspace(0, np.pi / 2, x)[:, None]
    head = samples[:x] * np.sin(t) + samples[-x:] * np.cos(t)
    return np.concatenate([head, samples[x:-x]])


LIMITER = "alimiter=limit={limit:.4f}:attack=5:release=80:level=false"


def filter_samples(samples, chain):
    raw = run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", str(samples.shape[1]), "-i", "-",
               "-af", chain, "-f", "f32le", "-"], input=samples.astype(np.float32).tobytes()).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, samples.shape[1]).copy()


def limiter_delay():
    """Samples the limiter delays its output by (ffmpeg 4.x can't compensate it itself)."""
    impulse = np.zeros((RATE // 10, 1), dtype=np.float32)
    impulse[100] = 0.1
    out = filter_samples(impulse, LIMITER.format(limit=1.0))
    return int(np.argmax(np.abs(out[:, 0]))) - 100


def level(samples, measured, target, delay):
    """Gain to the target, with a look-ahead limiter holding peaks under the ceiling."""
    gain_db = target - measured
    chain = f"volume={gain_db:.2f}dB," + LIMITER.format(limit=10 ** (PEAK_CEILING_DB / 20))
    padded = np.concatenate([samples, np.zeros((delay, samples.shape[1]), dtype=np.float32)])
    return filter_samples(padded, chain)[delay:], gain_db


def encode(samples, out, bitrate):
    run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", str(samples.shape[1]),
         "-i", "-", "-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", str(out)],
        input=samples.astype(np.float32).tobytes())


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(title):
    stem = re.sub(r"\.(wav|mp3|aiff?|flac|ogg)$", "", title, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")[:40]


def main():
    originals, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    table = Path(__file__).resolve().parents[3] / "macos/docs/planning/soundscapes/v1-sounds.tsv"
    rows = list(csv.DictReader(table.open(), delimiter="\t"))
    only = set(sys.argv[3:])
    delay = limiter_delay()
    ledger, report = [], []
    for row in rows:
        if only and row["id"] not in only:
            continue
        source = next(originals.glob(f"{row['id']}__*"))
        is_bed = row["role"].startswith("bed")
        samples = decode(source)
        if is_bed:
            samples = make_loop(samples)
            measured, _ = loudness(samples)
            samples, gain = level(samples, measured, BED_LUFS, delay)
            how = f"looped with a {LOOP_CROSSFADE_SECONDS:g} s equal-power crossfade, levelled to {BED_LUFS:g} LUFS"
        else:
            samples = fade(trim_silence(samples), 0.003, 0.03)
            _, measured = loudness(samples)
            samples, gain = level(samples, measured, ONE_SHOT_MOMENTARY_LUFS, delay)
            how = f"trimmed, faded, levelled to {ONE_SHOT_MOMENTARY_LUFS:g} LUFS momentary max"
        name = f"{UCS[(row['scene'], row['role'])]}_{slug(row['title'])}_FS{row['id']}.m4a"
        encode(samples, out_dir / name, "128k" if is_bed else "96k")
        integrated, momentary = loudness(decode(out_dir / name))
        report.append({
            "file": name, "scene": row["scene"], "role": row["role"],
            "seconds": round(len(samples) / RATE, 2), "gain_db": round(gain, 1),
            "integrated_lufs": round(integrated, 1), "momentary_max_lufs": round(momentary, 1),
            "peak_dbfs": round(peak_db(samples), 1), "bytes": (out_dir / name).stat().st_size,
        })
        ledger.append({
            "file": name, "scene": row["scene"], "role": row["role"],
            "source": "Freesound", "id": int(row["id"]), "title": row["title"], "author": row["author"],
            "url": row["page_url"], "license": "CC0-1.0",
            "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "license_checked": row["checked"], "original_sha256": sha256(source),
            "processing": how, "sha256": sha256(out_dir / name),
        })
        print(name, flush=True)
    suffix = "-partial" if only else ""
    (out_dir / f"ledger{suffix}.json").write_text(json.dumps(ledger, indent=2) + "\n")
    (out_dir / f"loudness-report{suffix}.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
