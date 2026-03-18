#!/usr/bin/env python3
"""
Generate a stable editor round-trip cases JSON from STEP166 previews.

This is intended for local development and gating stability:
- Output defaults to local/editor_roundtrip_smoke_cases.json (gitignored).
- Paths are repo-relative so the file stays portable across machines/clones.

Usage:
  python3 tools/generate_editor_roundtrip_cases.py --limit 8
  python3 tools/generate_editor_roundtrip_cases.py --run-id 20260212_103925 --limit 8
  python3 tools/generate_editor_roundtrip_cases.py --out local/editor_roundtrip_smoke_cases.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


CADGF_ENTITY_TYPES = {
    "POLYLINE": 0,
    "POINT": 1,
    "LINE": 2,
    "ARC": 3,
    "CIRCLE": 4,
    "ELLIPSE": 5,
    "SPLINE": 6,
    "TEXT": 7,
}

# Keep thresholds aligned with tools/web_viewer/scripts/editor_roundtrip_smoke.js.
TEXT_HEAVY_MIN = 60
TEXT_HEAVY_RATIO = 0.15
ARC_HEAVY_MIN = 40
ARC_HEAVY_RATIO = 0.10
POLYLINE_HEAVY_MIN = 40
POLYLINE_HEAVY_RATIO = 0.12
IMPORT_STRESS_MIN = 2000


def list_runs(base: Path) -> list[Path]:
    if not base.exists():
        return []
    runs = [p for p in base.iterdir() if p.is_dir()]
    runs.sort(key=lambda p: p.name, reverse=True)
    return runs


def discover_documents(previews_dir: Path, limit: int) -> list[Path]:
    if not previews_dir.exists():
        return []
    out: list[Path] = []
    for path in sorted(previews_dir.rglob("document.json")):
        out.append(path)
        if len(out) >= limit:
            break
    return out


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def is_cadgf_document(path: Path) -> bool:
    try:
        payload = load_json(path)
    except Exception:
        return False
    if not isinstance(payload, dict):
        return False
    return "cadgf_version" in payload and "schema_version" in payload and "entities" in payload and "layers" in payload


def to_posix_rel(path: Path, repo_root: Path) -> str:
    return path.relative_to(repo_root).as_posix()


def run_id_from_doc_path(path: Path) -> str:
    parts = path.parts
    for i, token in enumerate(parts):
        if token == "cad_regression" and i + 1 < len(parts):
            return parts[i + 1]
    return ""


def classify_case(cadgf_payload: dict[str, Any]) -> tuple[list[str], str]:
    entities = cadgf_payload.get("entities")
    if not isinstance(entities, list):
        return [], "P1"

    total = max(1, len(entities))
    counts: dict[int, int] = {}
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        raw_type = entity.get("type")
        if isinstance(raw_type, bool):
            continue
        try:
            t = int(raw_type)
        except Exception:
            continue
        counts[t] = counts.get(t, 0) + 1

    tags: list[str] = []
    text_count = counts.get(CADGF_ENTITY_TYPES["TEXT"], 0)
    arc_count = counts.get(CADGF_ENTITY_TYPES["ARC"], 0)
    polyline_count = counts.get(CADGF_ENTITY_TYPES["POLYLINE"], 0)

    if text_count >= TEXT_HEAVY_MIN or (text_count / total) >= TEXT_HEAVY_RATIO:
        tags.append("text-heavy")
    if arc_count >= ARC_HEAVY_MIN or (arc_count / total) >= ARC_HEAVY_RATIO:
        tags.append("arc-heavy")
    if polyline_count >= POLYLINE_HEAVY_MIN or (polyline_count / total) >= POLYLINE_HEAVY_RATIO:
        tags.append("polyline-heavy")
    if len(entities) >= IMPORT_STRESS_MIN:
        tags.append("import-stress")

    priority = "P1"
    if "import-stress" in tags:
        priority = "P0"
    return tags, priority


def parse_priorities(raw: str) -> set[str]:
    if not isinstance(raw, str):
        return {"P0", "P1", "P2"}
    parts = [part.strip() for part in raw.split(",")]
    allowed = {"P0", "P1", "P2"}
    selected = {part for part in parts if part in allowed}
    return selected or allowed


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate editor round-trip cases JSON from STEP166 previews.")
    parser.add_argument("--run-id", default="", help="Specific STEP166 run_id under build/cad_regression/<run_id>.")
    parser.add_argument("--limit", type=int, default=8, help="Max cases to include (default: 8).")
    parser.add_argument("--priorities", default="P0,P1,P2", help="Comma-separated priority filter (default: P0,P1,P2).")
    parser.add_argument("--out", default="local/editor_roundtrip_smoke_cases.json", help="Output JSON path.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    cad_base = repo_root / "build" / "cad_regression"

    run_dirs: list[Path]
    if args.run_id:
        run_dirs = [cad_base / str(args.run_id)]
    else:
        run_dirs = list_runs(cad_base)

    limit = max(1, int(args.limit))
    selected_priorities = parse_priorities(args.priorities)
    selected: list[Path] = []
    selected_meta: dict[Path, tuple[list[str], str]] = {}
    selected_runs: list[str] = []
    selected_run = ""

    for run_dir in run_dirs:
        previews = run_dir / "previews"
        docs = discover_documents(previews, limit=limit * 3)  # allow filtering
        if not docs:
            continue
        run_added = 0
        for p in docs:
            if not is_cadgf_document(p):
                continue
            tags: list[str] = []
            priority = "P1"
            try:
                cadgf_payload = load_json(p)
                if isinstance(cadgf_payload, dict):
                    tags, priority = classify_case(cadgf_payload)
            except Exception:
                tags = []
                priority = "P1"
            if priority not in selected_priorities:
                continue
            selected.append(p)
            selected_meta[p] = (tags, priority)
            run_added += 1
            if len(selected) >= limit:
                break
        if run_added > 0:
            selected_runs.append(run_dir.name)
            if not selected_run:
                selected_run = run_dir.name
        if len(selected) >= limit:
            break

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = repo_root / out_path
    out_path = out_path.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload: list[dict[str, Any]] = []
    used_names: set[str] = set()
    for doc_path in selected:
        base_name = doc_path.parent.name
        name = base_name
        if name in used_names:
            run_id = run_id_from_doc_path(doc_path)
            suffix = run_id if run_id else "dup"
            name = f"{base_name}@{suffix}"
            seq = 2
            while name in used_names:
                name = f"{base_name}@{suffix}_{seq}"
                seq += 1
        used_names.add(name)
        tags: list[str] = []
        priority = "P1"
        if doc_path in selected_meta:
            tags, priority = selected_meta[doc_path]
        else:
            try:
                cadgf_payload = load_json(doc_path)
                if isinstance(cadgf_payload, dict):
                    tags, priority = classify_case(cadgf_payload)
            except Exception:
                tags = []
                priority = "P1"
        payload.append(
            {
                "name": name,
                "path": to_posix_rel(doc_path, repo_root),
                "tags": tags,
                "priority": priority,
            }
        )

    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"selected_run_id={selected_run}")
    print(f"selected_run_ids={','.join(selected_runs)}")
    print(f"priorities={','.join(sorted(selected_priorities))}")
    print(f"cases={len(payload)}")
    print(f"out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
