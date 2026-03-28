#!/usr/bin/env python3
"""
Prune large build run directories to avoid "No space left on device".

Targets (default):
- build/cad_regression/<run_id>
- build/editor_roundtrip/<run_id>

Dry-run by default; use --apply to delete.
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path


@dataclass
class PruneResult:
    root: Path
    kept: int
    total: int
    deleted: int


def list_dirs(root: Path) -> list[Path]:
    if not root.exists():
        return []
    out = [p for p in root.iterdir() if p.is_dir()]
    out.sort(key=lambda p: p.name)
    return out


def prune(root: Path, keep: int, apply: bool) -> PruneResult:
    keep = max(0, int(keep))
    dirs = list_dirs(root)
    if keep <= 0:
        victims = dirs
    elif len(dirs) <= keep:
        victims = []
    else:
        victims = dirs[:-keep]

    if apply:
        for d in victims:
            shutil.rmtree(d)

    return PruneResult(root=root, kept=min(keep, len(dirs)), total=len(dirs), deleted=len(victims))


def main() -> int:
    parser = argparse.ArgumentParser(description="Prune build run directories (dry-run by default).")
    parser.add_argument("--root", default="build")
    parser.add_argument("--cad-keep", type=int, default=20, help="How many cad_regression runs to keep.")
    parser.add_argument("--roundtrip-keep", type=int, default=20, help="How many editor_roundtrip runs to keep.")
    parser.add_argument("--apply", action="store_true", help="Actually delete. Without this flag: dry-run.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    build_root = Path(args.root)
    if not build_root.is_absolute():
        build_root = repo_root / build_root
    build_root = build_root.resolve()

    results = [
        prune(build_root / "cad_regression", args.cad_keep, args.apply),
        prune(build_root / "editor_roundtrip", args.roundtrip_keep, args.apply),
    ]

    for r in results:
        print(f"root={r.root} total={r.total} keep={r.kept} deleted={r.deleted} apply={args.apply}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

