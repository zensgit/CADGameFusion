#!/usr/bin/env python3
import argparse
import concurrent.futures
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path


ALLOWED_MODES = {"observe", "gate"}


def utc_now() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def make_run_id() -> str:
    return dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return slug or "case"


def resolve_path(raw: str, repo_root: Path) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path
    return (repo_root / path).resolve()


def parse_bool(value, default: bool) -> str:
    if value is None:
        return "1" if default else "0"
    if isinstance(value, bool):
        return "1" if value else "0"
    raw = str(value).strip().lower()
    return "0" if raw in {"0", "false", "off", "no"} else "1"


def parse_int(value, default=0) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except ValueError:
            return default
    return default


def has_tag(case: dict, tag: str) -> bool:
    tags = case.get("tags") if isinstance(case, dict) else None
    if not isinstance(tags, list) or not tags:
        return False
    needle = str(tag).strip().lower()
    return any(str(item).strip().lower() == needle for item in tags)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def compare_key(name: str, layout: str, flt: str, space: str) -> str:
    return f"{name}::{layout}::{flt}::{space}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Unified CAD regression pipeline runner.")
    parser.add_argument("--cases", default="docs/STEP166_CAD_REGRESSION_CASES.json")
    parser.add_argument("--outdir", default="build/cad_regression")
    parser.add_argument("--baseline", default="", help="Optional baseline summary.json path.")
    parser.add_argument("--mode", choices=["observe", "gate"], default="observe")
    parser.add_argument("--max-workers", type=int, default=2)
    parser.add_argument("--layout", default="", help="Optional layout override.")
    parser.add_argument("--report", default="docs/STEP166_CAD_REGRESSION_VERIFICATION.md")
    parser.add_argument("--port-base", type=int, default=19100)
    parser.add_argument("--plugin", default="build/plugins/libcadgf_dxf_importer_plugin.dylib")
    parser.add_argument("--convert-cli", default="", help="Optional convert_cli override.")
    parser.add_argument("--python", default=sys.executable)
    parser.add_argument(
        "--confirm-text-drift",
        choices=["on", "off"],
        default="on",
        help="Re-run degraded text/dimension comparisons once before counting TEXT_METRIC_DRIFT.",
    )
    return parser.parse_args()


def run_compare_task(task: dict) -> dict:
    cmd = [
        task["python_bin"],
        str(task["compare_script"]),
        "--pdf",
        task["pdf"],
        "--manifest",
        task["manifest"],
        "--outdir",
        task["outdir"],
        "--filter",
        task["filter"],
        "--space",
        task["space"],
        "--paper-viewport",
        task["paper_viewport"],
        "--text-overlay",
        task["text_overlay"],
        "--line-overlay",
        task["line_overlay"],
        "--ui",
        task["ui"],
        "--port",
        str(task["port"]),
        "--bind",
        "127.0.0.1",
        "--metrics-json",
        task["metrics_json"],
        "--report",
        task["raw_compare_report"],
    ]
    if task["layout"]:
        cmd += ["--layout", task["layout"]]
    if task["text_style"]:
        cmd += ["--text-style", task["text_style"]]
    if task["line_weight_scale"] is not None:
        cmd += ["--line-weight-scale", str(task["line_weight_scale"])]
    if task["min_component_size"] is not None:
        cmd += ["--min-component-size", str(task["min_component_size"])]
    if task["max_component_size"] is not None:
        cmd += ["--max-component-size", str(task["max_component_size"])]

    run = subprocess.run(cmd, text=True, capture_output=True)
    if run.returncode != 0:
        return {
            "ok": False,
            "task": task,
            "returncode": run.returncode,
            "stdout": (run.stdout or "").strip()[-4000:],
            "stderr": (run.stderr or "").strip()[-4000:],
            "metrics": None,
        }

    metrics_path = Path(task["metrics_json"])
    if not metrics_path.exists():
        return {
            "ok": False,
            "task": task,
            "returncode": 9,
            "stdout": (run.stdout or "").strip()[-4000:],
            "stderr": "metrics json missing",
            "metrics": None,
        }

    try:
        metrics = load_json(metrics_path)
    except Exception as exc:
        return {
            "ok": False,
            "task": task,
            "returncode": 10,
            "stdout": "",
            "stderr": f"failed to parse metrics json: {exc}",
            "metrics": None,
        }

    return {
        "ok": True,
        "task": task,
        "returncode": 0,
        "stdout": (run.stdout or "").strip()[-4000:],
        "stderr": (run.stderr or "").strip()[-4000:],
        "metrics": metrics,
    }


def write_verification_report(path: Path, summary: dict, failures: list, run_dir: Path, cmdline: str) -> None:
    lines = []
    if not path.exists():
        lines.append("# STEP166 CAD Regression Verification")
        lines.append("")

    lines.append("")
    lines.append(f"## Run `{summary['run_id']}`")
    lines.append("")
    lines.append("### 本次运行信息")
    lines.append(f"- started_at: `{summary['started_at']}`")
    lines.append(f"- finished_at: `{summary['finished_at']}`")
    lines.append(f"- mode: `{summary['mode']}`")
    lines.append(f"- command: `{cmdline}`")
    lines.append(f"- run_dir: `{run_dir}`")
    lines.append("")
    lines.append("### 案例覆盖表")
    lines.append("| case | layout | filter | space | status |")
    lines.append("| --- | --- | --- | --- | --- |")
    for item in summary["metrics_by_case"]:
        lines.append(
            f"| {item['name']} | {item['layout'] or '-'} | {item['filter']} | "
            f"{item['space']} | {item['status']} |"
        )
    lines.append("")
    lines.append("### 指标汇总表")
    lines.append("| case | layout | filter | jaccard | jaccard_aligned | shift_dx | shift_dy |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for item in summary["metrics_by_case"]:
        metrics = item.get("metrics") or {}
        jaccard = metrics.get("jaccard")
        jaccard_aligned = metrics.get("jaccard_aligned")
        shift_dx = metrics.get("shift_dx")
        shift_dy = metrics.get("shift_dy")
        lines.append(
            f"| {item['name']} | {item['layout'] or '-'} | {item['filter']} | "
            f"{'' if jaccard is None else f'{jaccard:.4f}'} | "
            f"{'' if jaccard_aligned is None else f'{jaccard_aligned:.4f}'} | "
            f"{'' if shift_dx is None else int(shift_dx)} | "
            f"{'' if shift_dy is None else int(shift_dy)} |"
        )
    lines.append("")
    lines.append("### 失败归因统计")
    lines.append("| bucket | count |")
    lines.append("| --- | ---: |")
    for bucket, count in summary["failure_buckets"].items():
        lines.append(f"| {bucket} | {count} |")
    lines.append("")
    lines.append("### 输入体检预警（sanity warnings，非门禁）")
    sanity = summary.get("sanity") or {}
    if sanity:
        lines.append(f"- sanity_json: `{run_dir / 'sanity.json'}`")
        lines.append(f"- sanity_md: `{run_dir / 'sanity.md'}`")
        lines.append(f"- cases_warned: `{sanity.get('cases_warned', 0)}`")
        code_counts = sanity.get("warning_code_counts") or {}
        if isinstance(code_counts, dict) and code_counts:
            def _rank(item):
                key, val = item
                try:
                    cnt = int(val)
                except Exception:
                    cnt = 0
                return (-cnt, str(key))

            top = sorted(code_counts.items(), key=_rank)[:10]
            lines.append("- top_warning_codes:")
            for key, val in top:
                lines.append(f"  - `{key}`: `{val}`")
    else:
        lines.append("- sanity: `(missing)`")
    lines.append("")
    lines.append("### DXF 导入归因（HATCH 限流）")
    import_meta = summary.get("import_meta_summary") or {}
    lines.append(f"- hatch_pattern_clamped_cases: `{import_meta.get('hatch_pattern_clamped_cases', 0)}`")
    lines.append(f"- hatch_pattern_clamped_hatches_total: `{import_meta.get('hatch_pattern_clamped_hatches_total', 0)}`")
    lines.append(f"- hatch_pattern_emitted_lines_total: `{import_meta.get('hatch_pattern_emitted_lines_total', 0)}`")
    lines.append(f"- hatch_pattern_stride_max_max: `{import_meta.get('hatch_pattern_stride_max_max', 0)}`")
    lines.append(f"- hatch_pattern_ksteps_limit_max: `{import_meta.get('hatch_pattern_ksteps_limit_max', 0)}`")
    lines.append(f"- hatch_pattern_edge_budget_exhausted_cases: `{import_meta.get('hatch_pattern_edge_budget_exhausted_cases', 0)}`")
    lines.append(
        f"- hatch_pattern_edge_budget_exhausted_hatches_total: `{import_meta.get('hatch_pattern_edge_budget_exhausted_hatches_total', 0)}`"
    )
    lines.append(f"- hatch_pattern_edge_checks_total: `{import_meta.get('hatch_pattern_edge_checks_total', 0)}`")
    lines.append(
        f"- hatch_pattern_boundary_points_clamped_cases: `{import_meta.get('hatch_pattern_boundary_points_clamped_cases', 0)}`"
    )
    lines.append(
        f"- hatch_pattern_boundary_points_clamped_hatches_total: `{import_meta.get('hatch_pattern_boundary_points_clamped_hatches_total', 0)}`"
    )
    lines.append(
        f"- hatch_pattern_boundary_points_max_max: `{import_meta.get('hatch_pattern_boundary_points_max_max', 0)}`"
    )
    lines.append("")
    lines.append("### DXF 导入归因（TEXT 对齐/非有限数）")
    lines.append(f"- text_align_partial_cases: `{import_meta.get('text_align_partial_cases', 0)}`")
    lines.append(f"- text_align_partial_total: `{import_meta.get('text_align_partial_total', 0)}`")
    lines.append(f"- text_align_used_total: `{import_meta.get('text_align_used_total', 0)}`")
    lines.append(f"- text_nonfinite_values_total: `{import_meta.get('text_nonfinite_values_total', 0)}`")
    lines.append(f"- text_skipped_missing_xy_total: `{import_meta.get('text_skipped_missing_xy_total', 0)}`")
    lines.append(f"- text_entities_seen_total: `{import_meta.get('text_entities_seen_total', 0)}`")
    lines.append(f"- text_entities_emitted_total: `{import_meta.get('text_entities_emitted_total', 0)}`")
    lines.append("")
    lines.append("### 与 baseline 对比")
    baseline = summary.get("baseline_compare") or {}
    lines.append(f"- baseline_file: `{baseline.get('baseline_file', '')}`")
    lines.append(f"- baseline_run_id: `{baseline.get('baseline_run_id', '')}`")
    lines.append(f"- compared_cases: `{baseline.get('compared_cases', 0)}`")
    lines.append(f"- degraded_cases: `{baseline.get('degraded_cases', 0)}`")
    lines.append(f"- improved_cases: `{baseline.get('improved_cases', 0)}`")
    lines.append("")
    drift_confirmation = summary.get("drift_confirmation") or {}
    lines.append("### 文本漂移二次确认")
    lines.append(f"- enabled: `{drift_confirmation.get('enabled', False)}`")
    lines.append(f"- rechecked: `{drift_confirmation.get('rechecked', 0)}`")
    lines.append(f"- confirmed: `{drift_confirmation.get('confirmed', 0)}`")
    lines.append(f"- recovered: `{drift_confirmation.get('recovered', 0)}`")
    lines.append(f"- compare_fail: `{drift_confirmation.get('compare_fail', 0)}`")
    lines.append("")
    lines.append("### 结论与下一步")
    gate = summary.get("gate_decision") or {}
    lines.append(f"- would_fail_gate: `{gate.get('would_fail', False)}`")
    if gate.get("fail_reasons"):
        lines.append(f"- fail_reasons: `{'; '.join(gate['fail_reasons'])}`")
    else:
        lines.append("- fail_reasons: `none`")
    lines.append(f"- failures_json: `{run_dir / 'failures.json'}`")
    lines.append(f"- summary_json: `{run_dir / 'summary.json'}`")
    lines.append(f"- trend_input_json: `{run_dir / 'trend_input.json'}`")
    if failures:
        lines.append("")
        lines.append("### 失败详情")
        lines.append("| bucket | case | layout | filter | detail |")
        lines.append("| --- | --- | --- | --- | --- |")
        for item in failures:
            detail = item.get("detail", "")
            if item.get("expected") is True:
                detail = f"[expected] {detail}"
            lines.append(
                f"| {item.get('bucket', '')} | {item.get('name', '')} | "
                f"{item.get('layout', '') or '-'} | {item.get('filter', '') or '-'} | "
                f"{detail} |"
            )

    with path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main() -> int:
    args = parse_args()
    if args.mode not in ALLOWED_MODES:
        print(f"Invalid mode: {args.mode}", file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parents[1]
    cases_path = resolve_path(args.cases, repo_root)
    outdir_root = resolve_path(args.outdir, repo_root)
    report_path = resolve_path(args.report, repo_root)
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
        print("Cases must be a non-empty JSON array.", file=sys.stderr)
        return 1

    run_id = make_run_id()
    run_dir = outdir_root / run_id
    previews_dir = run_dir / "previews"
    assets_dir = run_dir / "assets"
    metrics_dir = run_dir / "metrics"
    previews_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)

    started_at = utc_now()
    sanity_script = repo_root / "scripts" / "cad_input_sanity_check.py"
    sanity_cmd = [
        args.python,
        str(sanity_script),
        "--cases",
        str(cases_path),
        "--run-dir",
        str(run_dir),
        "--plugin",
        str(plugin_path),
        "--python",
        args.python,
    ]
    if args.convert_cli.strip():
        sanity_cmd += ["--convert-cli", args.convert_cli.strip()]

    sanity_run = subprocess.run(sanity_cmd, text=True, capture_output=True)
    sanity_json_path = run_dir / "sanity.json"
    if sanity_run.returncode != 0 or not sanity_json_path.exists():
        print("Sanity check failed to produce sanity.json", file=sys.stderr)
        print((sanity_run.stdout or "").strip(), file=sys.stderr)
        print((sanity_run.stderr or "").strip(), file=sys.stderr)
        return 1

    sanity = load_json(sanity_json_path)
    sanity_results = sanity.get("results", [])
    sanity_warning_code_counts: dict[str, int] = {}
    sanity_warned_cases = 0
    for item in sanity_results:
        codes = item.get("warning_codes") or []
        if not isinstance(codes, list) or not codes:
            continue
        sanity_warned_cases += 1
        for code in codes:
            key = str(code)
            if not key:
                continue
            sanity_warning_code_counts[key] = sanity_warning_code_counts.get(key, 0) + 1
    sanity_summary = {
        "cases_total": sanity.get("cases_total", 0),
        "cases_valid": sanity.get("cases_valid", 0),
        "cases_invalid": sanity.get("cases_invalid", 0),
        "cases_warned": sanity.get("cases_warned", sanity_warned_cases),
        "warning_code_counts": sanity_warning_code_counts,
    }
    compare_script = repo_root / "scripts" / "compare_autocad_pdf.py"
    plm_preview_script = repo_root / "tools" / "plm_preview.py"

    baseline_map = {}
    baseline_compare = {
        "baseline_file": "",
        "baseline_run_id": "",
        "compared_cases": 0,
        "degraded_cases": 0,
        "improved_cases": 0,
    }
    if args.baseline.strip():
        baseline_path = resolve_path(args.baseline.strip(), repo_root)
        baseline_compare["baseline_file"] = str(baseline_path)
        if baseline_path.exists():
            try:
                baseline_data = load_json(baseline_path)
                baseline_compare["baseline_run_id"] = str(baseline_data.get("run_id") or "")
                for item in baseline_data.get("metrics_by_case", []):
                    metrics = item.get("metrics") or {}
                    aligned = metrics.get("jaccard_aligned")
                    if aligned is None:
                        continue
                    key = compare_key(
                        item.get("name", ""),
                        item.get("layout", ""),
                        item.get("filter", ""),
                        item.get("space", ""),
                    )
                    baseline_map[key] = float(aligned)
            except Exception:
                pass

    failure_buckets = {
        "INPUT_INVALID": 0,
        "IMPORT_FAIL": 0,
        "VIEWPORT_LAYOUT_MISSING": 0,
        "RENDER_DRIFT": 0,
        "TEXT_METRIC_DRIFT": 0,
    }
    failures = []
    metrics_by_case = []
    compare_tasks = []
    totals = {"pass": 0, "fail": 0, "skipped": 0}
    drift_confirmation = {
        "enabled": args.confirm_text_drift == "on",
        "rechecked": 0,
        "confirmed": 0,
        "recovered": 0,
        "compare_fail": 0,
    }
    import_meta_summary = {
        "hatch_pattern_clamped_cases": 0,
        "hatch_pattern_clamped_hatches_total": 0,
        "hatch_pattern_emitted_lines_total": 0,
        "hatch_pattern_stride_max_max": 0,
        "hatch_pattern_ksteps_limit_max": 0,
        "hatch_pattern_edge_checks_total": 0,
        "hatch_pattern_edge_budget_exhausted_cases": 0,
        "hatch_pattern_edge_budget_exhausted_hatches_total": 0,
        "hatch_pattern_boundary_points_clamped_cases": 0,
        "hatch_pattern_boundary_points_clamped_hatches_total": 0,
        "hatch_pattern_boundary_points_max_max": 0,
        "text_align_partial_cases": 0,
        "text_align_partial_total": 0,
        "text_align_used_total": 0,
        "text_nonfinite_values_total": 0,
        "text_skipped_missing_xy_total": 0,
        "text_entities_seen_total": 0,
        "text_entities_emitted_total": 0,
    }

    for sanity_item in sanity_results:
        case_index = sanity_item.get("case_index")
        name = sanity_item.get("name", "unknown")
        if not isinstance(case_index, int) or case_index < 0 or case_index >= len(cases):
            failure_buckets["INPUT_INVALID"] += 1
            totals["fail"] += 1
            failures.append(
                {
                    "bucket": "INPUT_INVALID",
                    "name": name,
                    "layout": "",
                    "filter": "",
                    "detail": "invalid case index from sanity result",
                }
            )
            continue

        case = cases[case_index]
        final_layout = str(args.layout).strip() or str(case.get("layout", "")).strip()
        space = str(case.get("space", "paper")).strip()
        is_negative = has_tag(case, "negative")

        if sanity_item.get("status") != "PASS":
            reason = ",".join(sanity_item.get("reason_codes") or [])
            if is_negative:
                totals["skipped"] += 1
            else:
                failure_buckets["INPUT_INVALID"] += 1
                totals["fail"] += 1
            failures.append(
                {
                    "bucket": "INPUT_INVALID",
                    "name": name,
                    "layout": final_layout,
                    "filter": "",
                    "detail": reason,
                    "expected": is_negative,
                }
            )
            metrics_by_case.append(
                {
                    "name": name,
                    "layout": final_layout,
                    "filter": "-",
                    "space": space,
                    "status": "SKIPPED" if is_negative else "FAIL",
                    "metrics": {},
                    "delta_vs_baseline": {},
                }
            )
            continue

        preview_out = previews_dir / slugify(f"{name}_{final_layout or 'layout'}")
        preview_cmd = [
            args.python,
            str(plm_preview_script),
            "--plugin",
            str(plugin_path),
            "--input",
            str(case["dxf"]),
            "--out",
            str(preview_out),
            "--emit",
            "json,gltf,meta",
        ]
        if args.convert_cli.strip():
            preview_cmd += ["--convert-cli", args.convert_cli.strip()]
        preview_run = subprocess.run(preview_cmd, text=True, capture_output=True)
        if preview_run.returncode != 0:
            failure_buckets["IMPORT_FAIL"] += 1
            totals["fail"] += 1
            failures.append(
                {
                    "bucket": "IMPORT_FAIL",
                    "name": name,
                    "layout": final_layout,
                    "filter": "",
                    "detail": (preview_run.stderr or preview_run.stdout or "").strip()[-300:],
                }
            )
            metrics_by_case.append(
                {
                    "name": name,
                    "layout": final_layout,
                    "filter": "-",
                    "space": space,
                    "status": "FAIL",
                    "metrics": {},
                    "delta_vs_baseline": {},
                }
            )
            continue

        document_path = preview_out / "document.json"
        manifest_path = preview_out / "manifest.json"
        if not document_path.exists() or not manifest_path.exists():
            failure_buckets["IMPORT_FAIL"] += 1
            totals["fail"] += 1
            failures.append(
                {
                    "bucket": "IMPORT_FAIL",
                    "name": name,
                    "layout": final_layout,
                    "filter": "",
                    "detail": "manifest/document missing after preview",
                }
            )
            metrics_by_case.append(
                {
                    "name": name,
                    "layout": final_layout,
                    "filter": "-",
                    "space": space,
                    "status": "FAIL",
                    "metrics": {},
                    "delta_vs_baseline": {},
                }
            )
            continue

        document = load_json(document_path)
        metadata = ((document.get("metadata") or {}).get("meta") or {})
        viewport_count = parse_int(metadata.get("dxf.viewport.count"), 0)

        hatch_import_meta = {
            "hatch_pattern_emitted_lines": parse_int(metadata.get("dxf.hatch_pattern_emitted_lines"), 0),
            "hatch_pattern_clamped": parse_int(metadata.get("dxf.hatch_pattern_clamped"), 0),
            "hatch_pattern_clamped_hatches": parse_int(metadata.get("dxf.hatch_pattern_clamped_hatches"), 0),
            "hatch_pattern_stride_max": parse_int(metadata.get("dxf.hatch_pattern_stride_max"), 0),
            "hatch_pattern_ksteps_limit": parse_int(metadata.get("dxf.hatch_pattern_ksteps_limit"), 0),
            "hatch_pattern_edge_checks": parse_int(metadata.get("dxf.hatch_pattern_edge_checks"), 0),
            "hatch_pattern_edge_budget_exhausted_hatches": parse_int(
                metadata.get("dxf.hatch_pattern_edge_budget_exhausted_hatches"), 0
            ),
            "hatch_pattern_boundary_points_clamped_hatches": parse_int(
                metadata.get("dxf.hatch_pattern_boundary_points_clamped_hatches"), 0
            ),
            "hatch_pattern_boundary_points_max": parse_int(metadata.get("dxf.hatch_pattern_boundary_points_max"), 0),
            "hatch_pattern_edge_checks_limit_per_hatch": parse_int(
                metadata.get("dxf.hatch_pattern_edge_checks_limit_per_hatch"), 0
            ),
            "hatch_pattern_edge_checks_limit_per_doc": parse_int(
                metadata.get("dxf.hatch_pattern_edge_checks_limit_per_doc"), 0
            ),
            "hatch_pattern_boundary_points_limit": parse_int(
                metadata.get("dxf.hatch_pattern_boundary_points_limit"), 0
            ),
        }
        text_import_meta = {
            "text_entities_seen": parse_int(metadata.get("dxf.text.entities_seen"), 0),
            "text_entities_emitted": parse_int(metadata.get("dxf.text.entities_emitted"), 0),
            "text_skipped_missing_xy": parse_int(metadata.get("dxf.text.skipped_missing_xy"), 0),
            "text_align_complete": parse_int(metadata.get("dxf.text.align_complete"), 0),
            "text_align_partial": parse_int(metadata.get("dxf.text.align_partial"), 0),
            "text_align_partial_x_only": parse_int(metadata.get("dxf.text.align_partial_x_only"), 0),
            "text_align_partial_y_only": parse_int(metadata.get("dxf.text.align_partial_y_only"), 0),
            "text_align_used": parse_int(metadata.get("dxf.text.align_used"), 0),
            "text_nonfinite_values": parse_int(metadata.get("dxf.text.nonfinite_values"), 0),
        }

        import_meta_summary["hatch_pattern_emitted_lines_total"] += int(hatch_import_meta["hatch_pattern_emitted_lines"])
        import_meta_summary["hatch_pattern_edge_checks_total"] += int(hatch_import_meta["hatch_pattern_edge_checks"])
        import_meta_summary["hatch_pattern_stride_max_max"] = max(
            import_meta_summary["hatch_pattern_stride_max_max"],
            int(hatch_import_meta["hatch_pattern_stride_max"] or 0),
        )
        import_meta_summary["hatch_pattern_ksteps_limit_max"] = max(
            import_meta_summary["hatch_pattern_ksteps_limit_max"],
            int(hatch_import_meta["hatch_pattern_ksteps_limit"] or 0),
        )
        import_meta_summary["hatch_pattern_boundary_points_max_max"] = max(
            import_meta_summary["hatch_pattern_boundary_points_max_max"],
            int(hatch_import_meta["hatch_pattern_boundary_points_max"] or 0),
        )

        if int(hatch_import_meta["hatch_pattern_clamped"] or 0) == 1:
            import_meta_summary["hatch_pattern_clamped_cases"] += 1
            import_meta_summary["hatch_pattern_clamped_hatches_total"] += int(
                hatch_import_meta["hatch_pattern_clamped_hatches"] or 0
            )
        if int(hatch_import_meta["hatch_pattern_edge_budget_exhausted_hatches"] or 0) > 0:
            import_meta_summary["hatch_pattern_edge_budget_exhausted_cases"] += 1
            import_meta_summary["hatch_pattern_edge_budget_exhausted_hatches_total"] += int(
                hatch_import_meta["hatch_pattern_edge_budget_exhausted_hatches"] or 0
            )
        if int(hatch_import_meta["hatch_pattern_boundary_points_clamped_hatches"] or 0) > 0:
            import_meta_summary["hatch_pattern_boundary_points_clamped_cases"] += 1
            import_meta_summary["hatch_pattern_boundary_points_clamped_hatches_total"] += int(
                hatch_import_meta["hatch_pattern_boundary_points_clamped_hatches"] or 0
            )

        import_meta_summary["text_entities_seen_total"] += int(text_import_meta["text_entities_seen"])
        import_meta_summary["text_entities_emitted_total"] += int(text_import_meta["text_entities_emitted"])
        import_meta_summary["text_align_partial_total"] += int(text_import_meta["text_align_partial"])
        import_meta_summary["text_align_used_total"] += int(text_import_meta["text_align_used"])
        import_meta_summary["text_nonfinite_values_total"] += int(text_import_meta["text_nonfinite_values"])
        import_meta_summary["text_skipped_missing_xy_total"] += int(text_import_meta["text_skipped_missing_xy"])
        if int(text_import_meta["text_align_partial"] or 0) > 0:
            import_meta_summary["text_align_partial_cases"] += 1

        layout_set = set()
        for i in range(max(0, viewport_count)):
            key = f"dxf.viewport.{i}.layout"
            value = str(metadata.get(key, "")).strip()
            if value:
                layout_set.add(value)

        expected = case.get("expected") or {}
        expects_viewport = bool(expected.get("has_viewport", False))
        viewport_missing = False
        if expects_viewport and viewport_count <= 0:
            viewport_missing = True
        if expects_viewport and space == "paper" and final_layout and final_layout not in layout_set:
            viewport_missing = True

        if viewport_missing:
            failure_buckets["VIEWPORT_LAYOUT_MISSING"] += 1
            totals["fail"] += 1
            failures.append(
                {
                    "bucket": "VIEWPORT_LAYOUT_MISSING",
                    "name": name,
                    "layout": final_layout,
                    "filter": "",
                    "detail": f"viewport_count={viewport_count}, known_layouts={sorted(layout_set)}",
                }
            )
            metrics_by_case.append(
                {
                    "name": name,
                    "layout": final_layout,
                    "filter": "-",
                    "space": space,
                    "status": "FAIL",
                    "metrics": {},
                    "delta_vs_baseline": {},
                }
            )
            continue

        compare_cfg = case.get("compare") or {}
        filters = case.get("filters") or []
        for flt in filters:
            task_slug = slugify(f"{name}_{final_layout}_{flt}")
            out_assets = assets_dir / task_slug
            out_assets.mkdir(parents=True, exist_ok=True)
            metrics_path = metrics_dir / f"{task_slug}.json"
            import_meta = dict(hatch_import_meta)
            import_meta.update(text_import_meta)

            task = {
                "python_bin": args.python,
                "compare_script": compare_script,
                "name": name,
                "layout": final_layout,
                "filter": str(flt),
                "space": space,
                "pdf": str(case["pdf"]),
                "manifest": str(manifest_path),
                "outdir": str(out_assets),
                "raw_compare_report": str(run_dir / "compare_raw.md"),
                "metrics_json": str(metrics_path),
                "port": args.port_base + len(compare_tasks),
                "paper_viewport": parse_bool(compare_cfg.get("paper_viewport"), default=True),
                "text_overlay": parse_bool(compare_cfg.get("text_overlay"), default=True),
                "line_overlay": parse_bool(compare_cfg.get("line_overlay"), default=False),
                "ui": parse_bool(compare_cfg.get("ui"), default=True),
                "text_style": str(compare_cfg.get("text_style", "clean")).strip(),
                "line_weight_scale": compare_cfg.get("line_weight_scale"),
                "min_component_size": compare_cfg.get("min_component_size"),
                "max_component_size": compare_cfg.get("max_component_size"),
                "task_slug": task_slug,
                "import_meta": import_meta,
            }
            compare_tasks.append(task)

    max_workers = max(1, int(args.max_workers))
    pending_text_confirmation = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(run_compare_task, task) for task in compare_tasks]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            task = result["task"]
            import_meta = task.get("import_meta") or {}
            item = {
                "name": task["name"],
                "layout": task["layout"],
                "filter": task["filter"],
                "space": task["space"],
                "status": "PASS" if result["ok"] else "FAIL",
                "metrics": {},
                "delta_vs_baseline": {},
                "import_meta": import_meta,
            }
            if not result["ok"]:
                totals["fail"] += 1
                failure_buckets["RENDER_DRIFT"] += 1
                import_note = ""
                if import_meta:
                    import_note = (
                        f" hatch_clamped={import_meta.get('hatch_pattern_clamped', 0)}"
                        f" hatch_emitted={import_meta.get('hatch_pattern_emitted_lines', 0)}"
                        f" hatch_edge_budget_hatches={import_meta.get('hatch_pattern_edge_budget_exhausted_hatches', 0)}"
                        f" text_align_partial={import_meta.get('text_align_partial', 0)}"
                        f" text_nonfinite={import_meta.get('text_nonfinite_values', 0)}"
                    )
                failures.append(
                    {
                        "bucket": "RENDER_DRIFT",
                        "name": task["name"],
                        "layout": task["layout"],
                        "filter": task["filter"],
                        "detail": (
                            f"compare failed rc={result['returncode']} err={result['stderr']}{import_note}"
                        ),
                    }
                )
                metrics_by_case.append(item)
                continue

            totals["pass"] += 1
            metrics = result["metrics"] or {}
            item["metrics"] = {
                "jaccard": metrics.get("jaccard"),
                "jaccard_aligned": metrics.get("jaccard_aligned"),
                "shift_dx": metrics.get("shift_dx"),
                "shift_dy": metrics.get("shift_dy"),
                "pdf_edges": metrics.get("pdf_edges"),
                "viewer_edges": metrics.get("viewer_edges"),
            }
            key = compare_key(task["name"], task["layout"], task["filter"], task["space"])
            if key in baseline_map:
                baseline_val = baseline_map[key]
                current_val = float(metrics.get("jaccard_aligned", 0.0) or 0.0)
                delta = current_val - baseline_val
                baseline_compare["compared_cases"] += 1
                item["delta_vs_baseline"] = {
                    "baseline": baseline_val,
                    "current": current_val,
                    "delta": delta,
                }
                if baseline_val > 0 and current_val < baseline_val * 0.8:
                    if task["filter"] == "all" or args.confirm_text_drift == "off":
                        baseline_compare["degraded_cases"] += 1
                        bucket = "RENDER_DRIFT" if task["filter"] == "all" else "TEXT_METRIC_DRIFT"
                        failure_buckets[bucket] += 1
                        failures.append(
                            {
                                "bucket": bucket,
                                "name": task["name"],
                                "layout": task["layout"],
                                "filter": task["filter"],
                                "detail": (
                                    f"aligned_jaccard dropped >20% "
                                    f"(baseline={baseline_val:.4f}, current={current_val:.4f})"
                                    f" hatch_clamped={import_meta.get('hatch_pattern_clamped', 0)}"
                                    f" hatch_emitted={import_meta.get('hatch_pattern_emitted_lines', 0)}"
                                    f" hatch_edge_budget_hatches={import_meta.get('hatch_pattern_edge_budget_exhausted_hatches', 0)}"
                                    f" text_align_partial={import_meta.get('text_align_partial', 0)}"
                                    f" text_nonfinite={import_meta.get('text_nonfinite_values', 0)}"
                                ),
                            }
                        )
                        item["status"] = "FAIL"
                        totals["pass"] -= 1
                        totals["fail"] += 1
                    else:
                        item["delta_vs_baseline"]["pending_confirmation"] = True
                        pending_text_confirmation.append(
                            {
                                "task": task,
                                "item": item,
                                "baseline": baseline_val,
                                "first_current": current_val,
                            }
                        )
                elif current_val > baseline_val:
                    baseline_compare["improved_cases"] += 1
            metrics_by_case.append(item)

    if pending_text_confirmation:
        confirm_port_base = args.port_base + len(compare_tasks) + 100
        for idx, pending in enumerate(pending_text_confirmation):
            drift_confirmation["rechecked"] += 1
            task = pending["task"]
            baseline_val = float(pending["baseline"])
            confirm_task = dict(task)
            confirm_task["outdir"] = str(Path(task["outdir"]) / "_confirm_text_drift")
            confirm_task["metrics_json"] = str(metrics_dir / f"{task['task_slug']}_confirm_text_drift.json")
            confirm_task["raw_compare_report"] = str(run_dir / "compare_raw_confirm.md")
            confirm_task["port"] = confirm_port_base + idx
            confirm_result = run_compare_task(confirm_task)

            item = pending["item"]
            first_current = float(pending["first_current"])

            if not confirm_result["ok"]:
                drift_confirmation["compare_fail"] += 1
                drift_confirmation["confirmed"] += 1
                baseline_compare["degraded_cases"] += 1
                failure_buckets["TEXT_METRIC_DRIFT"] += 1
                failures.append(
                    {
                        "bucket": "TEXT_METRIC_DRIFT",
                        "name": task["name"],
                        "layout": task["layout"],
                        "filter": task["filter"],
                        "detail": (
                            f"text drift confirm compare failed rc={confirm_result['returncode']} "
                            f"first={first_current:.4f}, baseline={baseline_val:.4f}"
                        ),
                    }
                )
                item["status"] = "FAIL"
                item["delta_vs_baseline"]["confirmation"] = "compare_failed"
                totals["pass"] -= 1
                totals["fail"] += 1
                continue

            confirm_metrics = confirm_result.get("metrics") or {}
            confirm_current = float(confirm_metrics.get("jaccard_aligned", 0.0) or 0.0)
            item["delta_vs_baseline"]["confirm_current"] = confirm_current
            item["delta_vs_baseline"]["confirm_delta"] = confirm_current - baseline_val
            if baseline_val > 0 and confirm_current < baseline_val * 0.8:
                drift_confirmation["confirmed"] += 1
                baseline_compare["degraded_cases"] += 1
                failure_buckets["TEXT_METRIC_DRIFT"] += 1
                failures.append(
                    {
                        "bucket": "TEXT_METRIC_DRIFT",
                        "name": task["name"],
                        "layout": task["layout"],
                        "filter": task["filter"],
                        "detail": (
                            "aligned_jaccard dropped >20% on confirm "
                            f"(baseline={baseline_val:.4f}, first={first_current:.4f}, confirm={confirm_current:.4f})"
                        ),
                    }
                )
                item["status"] = "FAIL"
                item["delta_vs_baseline"]["confirmation"] = "confirmed_fail"
                totals["pass"] -= 1
                totals["fail"] += 1
            else:
                drift_confirmation["recovered"] += 1
                item["delta_vs_baseline"]["confirmation"] = "recovered"
                item["delta_vs_baseline"]["pending_confirmation"] = False
                if confirm_current > baseline_val:
                    baseline_compare["improved_cases"] += 1

    gate_reasons = []
    if failure_buckets["INPUT_INVALID"] > 0:
        gate_reasons.append("INPUT_INVALID > 0 (non-negative)")
    if failure_buckets["IMPORT_FAIL"] > 0:
        gate_reasons.append("IMPORT_FAIL > 0")
    if failure_buckets["VIEWPORT_LAYOUT_MISSING"] > 0:
        gate_reasons.append("VIEWPORT_LAYOUT_MISSING > 0")
    if failure_buckets["RENDER_DRIFT"] > 0:
        gate_reasons.append("RENDER_DRIFT > 0")
    if failure_buckets["TEXT_METRIC_DRIFT"] > 0:
        gate_reasons.append("TEXT_METRIC_DRIFT > 0")
    if baseline_compare["degraded_cases"] > 0:
        gate_reasons.append("jaccard_aligned degraded by more than 20% vs baseline")
    gate_decision = {"would_fail": len(gate_reasons) > 0, "fail_reasons": gate_reasons}

    finished_at = utc_now()
    summary = {
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": finished_at,
        "mode": args.mode,
        "totals": totals,
        "metrics_by_case": metrics_by_case,
        "failure_buckets": failure_buckets,
        "sanity": sanity_summary,
        "import_meta_summary": import_meta_summary,
        "baseline_compare": baseline_compare,
        "drift_confirmation": drift_confirmation,
        "gate_decision": gate_decision,
    }

    trend_input = {
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": finished_at,
        "records": [
            {
                "key": compare_key(item["name"], item["layout"], item["filter"], item["space"]),
                "name": item["name"],
                "layout": item["layout"],
                "filter": item["filter"],
                "space": item["space"],
                "status": item["status"],
                "jaccard": (item.get("metrics") or {}).get("jaccard"),
                "jaccard_aligned": (item.get("metrics") or {}).get("jaccard_aligned"),
                "shift_dx": (item.get("metrics") or {}).get("shift_dx"),
                "shift_dy": (item.get("metrics") or {}).get("shift_dy"),
                "hatch_pattern_clamped": int(((item.get("import_meta") or {}).get("hatch_pattern_clamped") or 0) == 1),
                "hatch_pattern_emitted_lines": (item.get("import_meta") or {}).get("hatch_pattern_emitted_lines"),
                "hatch_edge_budget_exhausted": int(
                    ((item.get("import_meta") or {}).get("hatch_pattern_edge_budget_exhausted_hatches") or 0) > 0
                ),
                "text_align_partial": (item.get("import_meta") or {}).get("text_align_partial"),
                "text_nonfinite_values": (item.get("import_meta") or {}).get("text_nonfinite_values"),
            }
            for item in metrics_by_case
        ],
    }

    write_json(run_dir / "summary.json", summary)
    write_json(run_dir / "failures.json", {"run_id": run_id, "failures": failures})
    write_json(run_dir / "trend_input.json", trend_input)

    cmdline = " ".join(sys.argv)
    write_verification_report(
        path=report_path,
        summary=summary,
        failures=failures,
        run_dir=run_dir,
        cmdline=cmdline,
    )

    print(f"run_id={run_id}")
    print(f"run_dir={run_dir}")
    print(f"summary={run_dir / 'summary.json'}")
    print(f"failures={run_dir / 'failures.json'}")
    print(f"trend_input={run_dir / 'trend_input.json'}")
    print(f"report={report_path}")
    print(f"gate_would_fail={gate_decision['would_fail']}")

    if args.mode == "gate" and gate_decision["would_fail"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
