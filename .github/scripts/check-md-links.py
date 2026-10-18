#!/usr/bin/env python3
"""Fail when a relative Markdown link in the repo points at nothing.

Checks every tracked .md file outside archive/: each relative link target must
exist, and a #fragment on a Markdown target must match one of its headings
(GitHub's slug rules). Agent entry files are held to more: every `backticked`
repo path in them must exist too, because agents open those paths verbatim.

    python3 -I .github/scripts/check-md-links.py           # from the repo root
    python3 -I .github/scripts/check-md-links.py --all     # include archive/
"""

import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENTRY_FILES = {
    "AGENTS.md",
    "CLAUDE.md",
    "macos/AGENTS.md",
    "macos/CLAUDE.md",
    "macos/design/harness/INDEX.md",
    "macos/design/harness/review-loop.md",
    "archive/web/README.md",
}
LINK = re.compile(r"!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
HTML_SRC = re.compile(r"""(?:src|href|srcset)=["']([^"']+)["']""")
CODE_SPAN = re.compile(r"`([^`\s]+)`")
FENCE = re.compile(r"^\s*(```|~~~)")
HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$")
PATHISH = re.compile(r"^[\w.-]+(/[\w.@-]+)+/?$")


def tracked_md(include_archive: bool) -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.split()
    return [p for p in out if include_archive or not p.startswith("archive/")]


def strip_fences(text: str) -> list[tuple[int, str]]:
    lines, inside = [], False
    for n, line in enumerate(text.splitlines(), 1):
        if FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            lines.append((n, line))
    return lines


def slug(heading: str) -> str:
    heading = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading)  # keep link text
    heading = re.sub(r"<[^>]+>", "", heading).strip().lower()
    heading = re.sub(r"[^\w\- ]", "", heading)
    return heading.replace(" ", "-")


@lru_cache(maxsize=None)
def anchors(path: Path) -> frozenset[str]:
    seen: dict[str, int] = {}
    out = set()
    for _, line in strip_fences(path.read_text(encoding="utf-8")):
        m = HEADING.match(line)
        if not m:
            for a in re.findall(r"""<a\s+(?:name|id)=["']([^"']+)["']""", line):
                out.add(a)
            for a in re.findall(r"""\bid=["']([^"']+)["']""", line):
                out.add(a)
            continue
        s = slug(m.group(1))
        n = seen.get(s, 0)
        seen[s] = n + 1
        out.add(s if n == 0 else f"{s}-{n}")
    return frozenset(out)


def check_target(src: Path, target: str) -> str | None:
    if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith("//"):
        return None  # http:, mailto:, etc.
    path_part, _, frag = target.partition("#")
    path_part = path_part.split("?", 1)[0]
    if not path_part:
        dest = src
    elif path_part.startswith("/"):
        dest = ROOT / path_part.lstrip("/")
    else:
        dest = (src.parent / path_part).resolve()
    if not dest.exists():
        return "missing file"
    if frag and dest.is_file() and dest.suffix == ".md" and not frag.startswith("L"):
        if frag.lower() not in anchors(dest):
            return f"no heading #{frag}"
    return None


def check_code_path(src: Path, span: str) -> bool:
    span = span.rstrip(".,:;")
    if not PATHISH.match(span) or "*" in span or "<" in span:
        return True
    candidates = [ROOT / span, src.parent / span, ROOT / "macos" / span]
    return any(c.exists() for c in candidates)


def main() -> int:
    include_archive = "--all" in sys.argv
    problems = []
    for rel in tracked_md(include_archive):
        src = ROOT / rel
        for n, line in strip_fences(src.read_text(encoding="utf-8")):
            for target in LINK.findall(line) + HTML_SRC.findall(line):
                for t in target.split(","):
                    t = t.strip().split(" ")[0]
                    why = t and check_target(src, t)
                    if why:
                        problems.append(f"{rel}:{n}: {t} ({why})")
            if rel in ENTRY_FILES:
                for span in CODE_SPAN.findall(re.sub(r"\[[^\]]*\]\([^)]*\)", "", line)):
                    if not check_code_path(src, span):
                        problems.append(f"{rel}:{n}: `{span}` (path in an agent entry file does not exist)")
    for p in problems:
        print(p)
    print(f"{len(problems)} broken link(s)" if problems else "All Markdown links resolve.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
