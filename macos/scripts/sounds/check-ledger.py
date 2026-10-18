#!/usr/bin/env python3
"""Fail unless every shipped sound has a ledger row with a matching hash and a CC0 license.

    python3 scripts/sounds/check-ledger.py

Offline on purpose: CC licenses can't be revoked, so the license recorded when the sound
was downloaded is the one that counts.
"""

import hashlib
import json
import sys
from pathlib import Path

SOUNDS = Path(__file__).resolve().parents[2] / "App/Graphium/Sounds"
ALLOWED = {"CC0-1.0"}


def main():
    ledger = {row["file"]: row for row in json.loads((SOUNDS / "ledger.json").read_text())}
    shipped = {p.name for p in SOUNDS.glob("*.m4a")}
    problems = [f"{name}: no ledger row" for name in sorted(shipped - ledger.keys())]
    problems += [f"{name}: ledger row but no file" for name in sorted(ledger.keys() - shipped)]
    for name in sorted(shipped & ledger.keys()):
        row = ledger[name]
        if row["license"] not in ALLOWED:
            problems.append(f"{name}: license {row['license']} is not allowed")
        if hashlib.sha256((SOUNDS / name).read_bytes()).hexdigest() != row["sha256"]:
            problems.append(f"{name}: file changed since the ledger was written")
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print(f"{len(shipped)} sounds, all CC0 and matching the ledger")


if __name__ == "__main__":
    main()
