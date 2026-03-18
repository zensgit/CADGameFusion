#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path


ALLOWED_SPACES = {"paper", "model"}
ALLOWED_FILTERS = {"all", "text", "dimension"}


def utc_now() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return slug or "case"


def resolve_path(raw: str, repo_root: Path) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path
    return (repo_root / path).resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sanity-check DXF+PDF regression cases.")
    parser.add_argument("--cases", default="docs/STEP166_CAD_REGRESSION_CASES.json")
    parser.add_argument("--run-dir", required=True, help="Output directory for sanity artifacts.")
    parser.add_argument("--plugin", default="build/plugins/libcadgf_dxf_importer_plugin.dylib")
    parser.add_argument("--convert-cli", default="", help="Optional convert_cli override.")
    parser.add_argument("--python", default=sys.executable)
    return parser.parse_args()


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def parse_int(value, default=0) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except ValueError:
            return default
    return default


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_markdown(path: Path, payload: dict) -> None:
    lines = []
    lines.append("# STEP166 CAD Input Sanity Check")
    lines.append("")
    lines.append(f"- run_id: `{payload['run_id']}`")
    lines.append(f"- generated_at: `{payload['generated_at']}`")
    lines.append(f"- cases_total: `{payload['cases_total']}`")
    lines.append(f"- cases_valid: `{payload['cases_valid']}`")
    lines.append(f"- cases_invalid: `{payload['cases_invalid']}`")
    lines.append(f"- cases_warned: `{payload.get('cases_warned', 0)}`")
    lines.append("")
    lines.append("| case | status | entity_count | viewport_count | reason_codes | warning_codes |")
    lines.append("| --- | --- | ---: | ---: | --- | --- |")
    for item in payload["results"]:
        reasons = ", ".join(item["reason_codes"]) if item["reason_codes"] else "-"
        warnings = ", ".join(item.get("warning_codes") or []) if item.get("warning_codes") else "-"
        lines.append(
            f"| {item['name']} | {item['status']} | {item['meta']['entity_count']} | "
            f"{item['meta']['viewport_count']} | {reasons} | {warnings} |"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def validate_case_shape(case: dict, reason_codes: list) -> None:
    required = ["name", "dxf", "pdf", "layout", "space", "filters", "expected"]
    for key in required:
        if key not in case:
            reason_codes.append(f"CASE_MISSING_{key.upper()}")
    if "space" in case and str(case["space"]).strip() not in ALLOWED_SPACES:
        reason_codes.append("SPACE_INVALID")
    filters = case.get("filters")
    if not isinstance(filters, list) or not filters:
        reason_codes.append("FILTERS_INVALID")
    elif any(str(v).strip() not in ALLOWED_FILTERS for v in filters):
        reason_codes.append("FILTERS_INVALID")
    expected = case.get("expected")
    if not isinstance(expected, dict):
        reason_codes.append("EXPECTED_INVALID")
    else:
        for key in ("has_viewport", "has_entities"):
            if key not in expected or not isinstance(expected.get(key), bool):
                reason_codes.append(f"EXPECTED_{key.upper()}_INVALID")


def run_plm_preview(repo_root: Path, python_bin: str, plugin: Path, input_dxf: Path, out_dir: Path, convert_cli: str):
    cmd = [
        python_bin,
        str(repo_root / "tools" / "plm_preview.py"),
        "--plugin",
        str(plugin),
        "--input",
        str(input_dxf),
        "--out",
        str(out_dir),
        "--emit",
        "json",
    ]
    if convert_cli:
        cmd += ["--convert-cli", convert_cli]
    result = subprocess.run(cmd, text=True, capture_output=True)
    return result


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    run_dir = resolve_path(args.run_dir, repo_root)
    run_dir.mkdir(parents=True, exist_ok=True)

    cases_path = resolve_path(args.cases, repo_root)
    plugin_path = resolve_path(args.plugin, repo_root)

    if not cases_path.exists():
        print(f"Cases file not found: {cases_path}", file=sys.stderr)
        return 1

    try:
        cases = load_json(cases_path)
    except Exception as exc:
        print(f"Failed to load cases: {exc}", file=sys.stderr)
        return 1

    if not isinstance(cases, list) or not cases:
        print("Cases file must be a non-empty JSON array.", file=sys.stderr)
        return 1

    run_id = run_dir.name
    results = []

    for idx, case in enumerate(cases):
        name = str(case.get("name", f"case_{idx}"))
        reason_codes = []
        warning_codes = []
        checks = {
            "dxf_exists": False,
            "pdf_exists": False,
            "layout_non_empty": bool(str(case.get("layout", "")).strip()),
            "filters_valid": False,
        }
        meta = {
            "entity_count": 0,
            "viewport_count": 0,
            "preview_rc": None,
            "preview_stdout": "",
            "preview_stderr": "",
        }

        if not isinstance(case, dict):
            reason_codes.append("CASE_NOT_OBJECT")
            results.append(
                {
                    "case_index": idx,
                    "name": name,
                    "status": "FAIL",
                    "checks": checks,
                    "meta": meta,
                    "reason_codes": reason_codes,
                }
            )
            continue

        validate_case_shape(case, reason_codes)

        dxf_path = resolve_path(str(case.get("dxf", "")), repo_root)
        pdf_path = resolve_path(str(case.get("pdf", "")), repo_root)
        checks["dxf_exists"] = dxf_path.exists()
        checks["pdf_exists"] = pdf_path.exists()
        filters = case.get("filters", [])
        checks["filters_valid"] = isinstance(filters, list) and len(filters) > 0 and all(
            str(v).strip() in ALLOWED_FILTERS for v in filters
        )

        if not checks["dxf_exists"]:
            reason_codes.append("DXF_NOT_FOUND")
        if not checks["pdf_exists"]:
            reason_codes.append("PDF_NOT_FOUND")
        if not checks["layout_non_empty"]:
            reason_codes.append("LAYOUT_EMPTY")
        if not checks["filters_valid"]:
            reason_codes.append("FILTERS_INVALID")
        if not plugin_path.exists():
            reason_codes.append("PLUGIN_NOT_FOUND")

        if reason_codes:
            results.append(
                {
                    "case_index": idx,
                    "name": name,
                    "status": "FAIL",
                    "checks": checks,
                    "meta": meta,
                    "reason_codes": sorted(set(reason_codes)),
                }
            )
            continue

        sanity_preview_dir = run_dir / "sanity_preview" / slugify(name)
        preview = run_plm_preview(
            repo_root=repo_root,
            python_bin=args.python,
            plugin=plugin_path,
            input_dxf=dxf_path,
            out_dir=sanity_preview_dir,
            convert_cli=args.convert_cli.strip(),
        )
        meta["preview_rc"] = preview.returncode
        meta["preview_stdout"] = (preview.stdout or "").strip()[-2000:]
        meta["preview_stderr"] = (preview.stderr or "").strip()[-2000:]

        if preview.returncode != 0:
            reason_codes.append("IMPORT_FAIL")
            results.append(
                {
                    "case_index": idx,
                    "name": name,
                    "status": "FAIL",
                    "checks": checks,
                    "meta": meta,
                    "reason_codes": sorted(set(reason_codes)),
                }
            )
            continue

        document_path = sanity_preview_dir / "document.json"
        if not document_path.exists():
            reason_codes.append("DOCUMENT_JSON_MISSING")
            results.append(
                {
                    "case_index": idx,
                    "name": name,
                    "status": "FAIL",
                    "checks": checks,
                    "meta": meta,
                    "reason_codes": sorted(set(reason_codes)),
                }
            )
            continue

        try:
            document = load_json(document_path)
            entities = document.get("entities") or []
            metadata = (document.get("metadata") or {}).get("meta") or {}
            entity_count = len(entities) if isinstance(entities, list) else 0
            viewport_count_all = parse_int(metadata.get("dxf.viewport.count"), 0)
            import_meta = {
                "hatch_pattern_clamped": parse_int(metadata.get("dxf.hatch_pattern_clamped"), 0),
                "hatch_pattern_emitted_lines": parse_int(metadata.get("dxf.hatch_pattern_emitted_lines"), 0),
                "hatch_pattern_edge_budget_exhausted_hatches": parse_int(
                    metadata.get("dxf.hatch_pattern_edge_budget_exhausted_hatches"), 0
                ),
                "hatch_pattern_boundary_points_clamped_hatches": parse_int(
                    metadata.get("dxf.hatch_pattern_boundary_points_clamped_hatches"), 0
                ),
                "text_align_partial": parse_int(metadata.get("dxf.text.align_partial"), 0),
                "text_nonfinite_values": parse_int(metadata.get("dxf.text.nonfinite_values"), 0),
                "text_skipped_missing_xy": parse_int(metadata.get("dxf.text.skipped_missing_xy"), 0),
            }
            meta["import_meta"] = import_meta

            if import_meta["hatch_pattern_clamped"] > 0:
                warning_codes.append("WARN_HATCH_PATTERN_CLAMPED")
            if import_meta["hatch_pattern_edge_budget_exhausted_hatches"] > 0:
                warning_codes.append("WARN_HATCH_EDGE_BUDGET_EXHAUSTED")
            if import_meta["hatch_pattern_boundary_points_clamped_hatches"] > 0:
                warning_codes.append("WARN_HATCH_BOUNDARY_POINTS_CLAMPED")
            if import_meta["text_align_partial"] > 0:
                warning_codes.append("WARN_TEXT_ALIGN_PARTIAL")
            if import_meta["text_nonfinite_values"] > 0:
                warning_codes.append("WARN_TEXT_NONFINITE_NUMBERS")
            if import_meta["text_skipped_missing_xy"] > 0:
                warning_codes.append("WARN_TEXT_SKIPPED_MISSING_XY")

            # `expected.has_viewport` is case-scoped:
            # - when `space=paper` and `layout` is provided, it refers to viewports in that layout
            # - when `space=paper` without layout, it refers to total paper viewports
            # - when `space=model`, viewports are not relevant (treat as 0)
            layout_name = str(case.get("layout", "")).strip()
            space_name = str(case.get("space", "paper")).strip()
            viewport_layouts = set()
            viewport_count_layout = 0
            for i in range(max(0, viewport_count_all)):
                vp_layout = str(metadata.get(f"dxf.viewport.{i}.layout", "")).strip()
                if vp_layout:
                    viewport_layouts.add(vp_layout)
                if space_name == "paper" and layout_name and vp_layout == layout_name:
                    viewport_count_layout += 1

            if space_name != "paper":
                viewport_count = 0
            elif layout_name:
                viewport_count = viewport_count_layout
            else:
                viewport_count = viewport_count_all

            meta["viewport_count_all"] = viewport_count_all
            meta["viewport_layouts"] = sorted(viewport_layouts)
        except Exception as exc:
            reason_codes.append("DOCUMENT_PARSE_ERROR")
            meta["preview_stderr"] = (meta["preview_stderr"] + f"\n{exc}").strip()[-2000:]
            entity_count = 0
            viewport_count = 0

        meta["entity_count"] = entity_count
        meta["viewport_count"] = viewport_count

        expected = case.get("expected", {})
        has_entities_expected = bool(expected.get("has_entities"))
        has_viewport_expected = bool(expected.get("has_viewport"))

        if has_entities_expected and entity_count <= 0:
            reason_codes.append("EXPECTED_ENTITIES_MISSING")
        if (not has_entities_expected) and entity_count > 0:
            reason_codes.append("EXPECTED_NO_ENTITIES_MISMATCH")

        if has_viewport_expected and viewport_count <= 0:
            reason_codes.append("EXPECTED_VIEWPORT_MISSING")
        if (not has_viewport_expected) and viewport_count > 0:
            reason_codes.append("EXPECTED_NO_VIEWPORT_MISMATCH")

        status = "PASS" if not reason_codes else "FAIL"
        results.append(
            {
                "case_index": idx,
                "name": name,
                "status": status,
                "checks": checks,
                "meta": meta,
                "reason_codes": sorted(set(reason_codes)),
                "warning_codes": sorted(set(warning_codes)),
            }
        )

    payload = {
        "run_id": run_id,
        "generated_at": utc_now(),
        "cases_total": len(results),
        "cases_valid": sum(1 for item in results if item["status"] == "PASS"),
        "cases_invalid": sum(1 for item in results if item["status"] == "FAIL"),
        "cases_warned": sum(1 for item in results if item.get("warning_codes")),
        "results": results,
    }

    sanity_json_path = run_dir / "sanity.json"
    sanity_md_path = run_dir / "sanity.md"
    write_json(sanity_json_path, payload)
    write_markdown(sanity_md_path, payload)
    print(f"Wrote {sanity_json_path}")
    print(f"Wrote {sanity_md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
