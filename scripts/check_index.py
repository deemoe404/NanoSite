#!/usr/bin/env python3
"""
Simple pre-publish checker for wwwroot/index.json.

Checks that every entry's location exists under wwwroot/ and is a file.
Exits with non-zero status if any problems are found.
Usage: python3 scripts/check_index.py
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "wwwroot" / "index.json"

def main() -> int:
    problems = 0
    if not INDEX.exists():
        print(f"ERROR: Missing index file: {INDEX}")
        return 2
    try:
        data = json.loads(INDEX.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: Failed to parse {INDEX}: {e}")
        return 3

    seen_locations = set()
    for title, meta in data.items():
        loc = str(meta.get("location", ""))
        if not loc:
            print(f"ERROR: '{title}' has empty or missing 'location'")
            problems += 1
            continue
        if any(bad in loc for bad in ("..", "\\")) or loc.startswith("/"):
            print(f"ERROR: '{title}' location contains invalid path components: {loc}")
            problems += 1
        path = ROOT / "wwwroot" / loc
        if not path.exists() or not path.is_file():
            print(f"ERROR: '{title}' location does not exist: {path}")
            problems += 1
        if loc in seen_locations:
            print(f"WARN: Duplicate location referenced: {loc}")
        seen_locations.add(loc)

    if problems:
        print(f"\nCompleted with {problems} problem(s).")
        return 1
    print("All index entries look good.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

