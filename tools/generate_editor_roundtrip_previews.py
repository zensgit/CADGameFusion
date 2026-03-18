#!/usr/bin/env python3
"""
Generate editor round-trip smoke cases from raw DXF inputs (no PDF required).

Why:
- STEP166 cases require DXF+layout PDF. In practice we often have many DXFs but few matching PDFs.
- For Level A editor "round-trip" validation, we primarily need CADGF `document.json` fixtures.
- This script runs `tools/plm_preview.py --emit json` on a curated DXF set to produce `document.json`,
  then writes a cases JSON compatible with `tools/web_viewer/scripts/editor_roundtrip_smoke.js`.

Outputs:
- previews: build/editor_roundtrip_previews/<run_id>/<case_slug>/** (contains document.json, manifest.json, mesh, ...)
- cases: local/editor_roundtrip_smoke_cases.json (gitignored by repo)
"""

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path


VERSION_SUFFIX_RE = re.compile(r"^(?P<base>.*?)(?:v(?P<ver>\d+))?$", re.IGNORECASE)


def utc_now_compact() -> str:
    return dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def slugify(value: str) -> str:
    value = str(value or "").strip()
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return slug or "case"


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def pick_latest_versions(dxfs: list[Path]) -> list[Path]:
    """
    Reduce duplicates by grouping by a base name without trailing vN suffix
    and choosing the highest N when present.
    """
    best: dict[str, tuple[int, Path]] = {}
    for dxf in dxfs:
        stem = dxf.stem
        m = VERSION_SUFFIX_RE.match(stem)
        if not m:
            key = stem
            ver = 0
        else:
            key = (m.group("base") or stem).strip()
            ver = int(m.group("ver") or 0)
        prev = best.get(key)
        if prev is None or ver > prev[0]:
            best[key] = (ver, dxf)
    # stable ordering for determinism
    return [best[k][1] for k in sorted(best.keys())]


def run_plm_preview(
    repo_root: Path,
    python_bin: str,
    plugin_path: Path,
    input_dxf: Path,
    out_dir: Path,
    convert_cli: str,
    timeout_s: int,
) -> subprocess.CompletedProcess:
    cmd = [
        python_bin,
        str(repo_root / "tools" / "plm_preview.py"),
        "--plugin",
        str(plugin_path),
        "--input",
        str(input_dxf),
        "--out",
        str(out_dir),
        "--emit",
        "json",
    ]
    if convert_cli:
        cmd += ["--convert-cli", convert_cli]
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout_s)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate editor_roundtrip_smoke cases from DXFs (no PDF required).")
    p.add_argument("--dxf-dir", default="/Users/huazhou/Downloads/训练图纸/训练图纸_dxf", help="Root directory to scan for DXF files.")
    p.add_argument("--limit", type=int, default=20, help="Max unique cases to generate (after version de-dup).")
    p.add_argument("--out-previews", default="", help="Output previews dir. Default: build/editor_roundtrip_previews/<run_id>")
    p.add_argument("--out-cases", default="local/editor_roundtrip_smoke_cases.json", help="Cases JSON output path.")
    p.add_argument("--plugin", default="build/plugins/libcadgf_dxf_importer_plugin.dylib", help="DXF importer plugin path.")
    p.add_argument("--convert-cli", default="", help="Optional convert_cli override.")
    p.add_argument("--python", default=sys.executable, help="Python interpreter to run plm_preview.py.")
    p.add_argument("--timeout-s", type=int, default=120, help="Timeout seconds per plm_preview invocation.")
    p.add_argument("--include-pattern", default="", help="Optional regex filter on DXF filename (stem).")
    p.add_argument("--exclude-pattern", default="", help="Optional regex exclude filter on DXF filename (stem).")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]

    dxf_dir = Path(args.dxf_dir).expanduser()
    if not dxf_dir.exists():
        print(f"dxf_dir_not_found={dxf_dir}", file=sys.stderr)
        return 2

    plugin_path = (repo_root / args.plugin).resolve() if not Path(args.plugin).is_absolute() else Path(args.plugin)
    if not plugin_path.exists():
        print(f"plugin_not_found={plugin_path}", file=sys.stderr)
        return 2

    include_re = re.compile(args.include_pattern) if args.include_pattern else None
    exclude_re = re.compile(args.exclude_pattern) if args.exclude_pattern else None

    dxfs = sorted(dxf_dir.rglob("*.dxf"))
    if include_re:
        dxfs = [p for p in dxfs if include_re.search(p.stem)]
    if exclude_re:
        dxfs = [p for p in dxfs if not exclude_re.search(p.stem)]

    unique = pick_latest_versions(dxfs)
    selected = unique[: max(0, int(args.limit))]

    run_id = utc_now_compact()
    out_previews_raw = str(args.out_previews or "").strip()
    out_previews = Path(out_previews_raw).expanduser() if out_previews_raw else Path()
    if not out_previews_raw:
        out_previews = repo_root / "build" / "editor_roundtrip_previews" / run_id
    if not out_previews.is_absolute():
        out_previews = (repo_root / out_previews).resolve()
    out_previews.mkdir(parents=True, exist_ok=True)

    out_cases = Path(args.out_cases).expanduser()
    if not out_cases.is_absolute():
        out_cases = (repo_root / out_cases).resolve()
    out_cases.parent.mkdir(parents=True, exist_ok=True)

    results = []
    cases = []

    for dxf in selected:
        name = dxf.stem
        slug = slugify(name)
        out_dir = out_previews / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        try:
            proc = run_plm_preview(
                repo_root=repo_root,
                python_bin=args.python,
                plugin_path=plugin_path,
                input_dxf=dxf,
                out_dir=out_dir,
                convert_cli=str(args.convert_cli or "").strip(),
                timeout_s=int(args.timeout_s),
            )
            rc = proc.returncode
            stdout_tail = (proc.stdout or "").strip()[-2000:]
            stderr_tail = (proc.stderr or "").strip()[-2000:]
        except subprocess.TimeoutExpired as exc:
            rc = 124
            stdout_tail = (exc.stdout or "").strip()[-2000:] if exc.stdout else ""
            stderr_tail = (exc.stderr or "").strip()[-2000:] if exc.stderr else ""
        except Exception as exc:
            rc = 1
            stdout_tail = ""
            stderr_tail = str(exc)

        doc = out_dir / "document.json"
        ok = rc == 0 and doc.exists()
        results.append(
            {
                "name": name,
                "dxf": str(dxf),
                "out_dir": str(out_dir),
                "ok": ok,
                "rc": rc,
                "document_json": str(doc) if doc.exists() else "",
                "stderr_tail": stderr_tail,
                "stdout_tail": stdout_tail,
            }
        )
        if ok:
            try:
                rel = str(doc.resolve().relative_to(repo_root))
            except Exception:
                rel = str(doc.resolve())
            cases.append({"name": slug, "path": rel})

    write_json(out_previews / "preview_results.json", {"run_id": run_id, "generated_at": dt.datetime.utcnow().isoformat() + "Z", "results": results})
    write_json(out_cases, cases)

    ok_count = sum(1 for r in results if r["ok"])
    print(f"run_id={run_id}")
    print(f"dxf_dir={dxf_dir}")
    print(f"selected={len(selected)} ok={ok_count}")
    print(f"previews_dir={out_previews}")
    print(f"cases_json={out_cases}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
