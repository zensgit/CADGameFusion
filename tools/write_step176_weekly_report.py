#!/usr/bin/env python3
"""
Append one weekly validation snapshot to STEP176 verification report.

Usage:
  python3 tools/write_step176_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
"""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from typing import Any

WORKSPACE_ROOT = Path(__file__).resolve().parents[1].resolve()


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def decode_b64_json_list(value: Any) -> list[dict[str, Any]]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def decode_b64_json_dict(value: Any) -> dict[str, Any]:
    text = str(value or "").strip()
    if not text:
        return {}
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def encode_b64_json_dict(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    try:
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return base64.b64encode(raw.encode("utf-8")).decode("ascii")
    except Exception:
        return ""


def fmt_viewport_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(f"{lane}:{case_name}({as_int(item.get('viewport_count'), 0)}/{as_int(item.get('viewport_layout_count'), 0)})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_text_kind_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        pairs: list[tuple[str, int]] = []
        for key, raw_value in as_dict(item.get("text_kind_counts")).items():
            try:
                value = int(raw_value)
            except Exception:
                continue
            if value > 0:
                pairs.append((str(key), value))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        rendered = ", ".join(f"{key}:{value}" for key, value in pairs) if pairs else "-"
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        pairs: list[tuple[str, int]] = []
        for key, raw_value in as_dict(item.get("derived_proxy_kind_counts")).items():
            try:
                value = int(raw_value)
            except Exception:
                continue
            if value > 0:
                pairs.append((str(key), value))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        rendered = ", ".join(f"{key}:{value}" for key, value in pairs) if pairs else "-"
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        proxy_layouts = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({proxy_layouts})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_viewport_proxy_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_source_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        pairs: list[tuple[str, int]] = []
        for key, raw_value in as_dict(item.get("assembly_group_source_counts")).items():
            try:
                numeric = int(raw_value)
            except Exception:
                continue
            if numeric > 0:
                pairs.append((str(key), numeric))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        rendered = ", ".join(f"{key}:{value}" for key, value in pairs) if pairs else "-"
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("assembly_group_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_exploded_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("exploded_origin_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_counts(value: Any) -> str:
    counts = decode_b64_json_dict(value)
    pairs: list[tuple[str, int]] = []
    for key, raw_value in counts.items():
        try:
            value = int(raw_value)
        except Exception:
            continue
        if value > 0:
            pairs.append((str(key), value))
    pairs.sort(key=lambda item: (-item[1], item[0]))
    if not pairs:
        return "-"
    return ", ".join(f"{key}:{value}" for key, value in pairs)


def fmt_proxy_layout_kind_counts(value: Any) -> str:
    layouts = decode_b64_json_dict(value)
    if not layouts:
        return "-"
    parts: list[str] = []
    for layout, raw_inner in sorted(layouts.items(), key=lambda item: str(item[0])):
        pairs: list[tuple[str, int]] = []
        for key, raw_value in as_dict(raw_inner).items():
            try:
                numeric = int(raw_value)
            except Exception:
                continue
            if numeric > 0:
                pairs.append((str(key), numeric))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        if not pairs:
            continue
        parts.append(f"{layout}[{', '.join(f'{key}:{value}' for key, value in pairs)}]")
    return "; ".join(parts) if parts else "-"


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def as_float(value: Any) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def fmt_path(path: str) -> str:
    return f"`{path}`" if path else "`(missing)`"

def first_nonempty(values: list[Any]) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""

def resolve_summary_path(weekly_path: Path, raw: str) -> Path | None:
    s = str(raw or "").strip()
    if not s:
        return None
    p = Path(s)
    if p.is_absolute():
        return p
    # Most summary_json fields are workspace-absolute; keep relative fallback anchored to workspace root.
    return (WORKSPACE_ROOT / p).resolve()


def resolve_cli_path(raw: str) -> Path:
    path = Path(str(raw or "").strip())
    if path.is_absolute():
        return path.resolve()
    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists() or cwd_candidate.parent.exists():
        return cwd_candidate
    return (WORKSPACE_ROOT / path).resolve()

def resolve_trend_policy(weekly_path: Path, trend: dict[str, Any]) -> dict[str, Any]:
    policy = as_dict(trend.get("policy"))
    if policy:
        return policy
    summary_raw = str(trend.get("summary_json") or "")
    summary_path = resolve_summary_path(weekly_path, summary_raw)
    if summary_path and summary_path.exists():
        payload = load_json(summary_path)
        return as_dict(payload.get("policy"))
    return {}


def pick_p95_from_perf_summary(path: Path) -> dict[str, float]:
    payload = load_json(path)
    metrics = as_dict(payload.get("metrics"))
    agg = as_dict(as_dict(payload.get("aggregate")).get("metrics"))
    if agg:
        # Batch format: pick_p95_ms_median, box_p95_ms_median, drag_p95_ms_median
        return {
            "pick_p95_ms": float(agg.get("pick_p95_ms_median") or 0.0),
            "box_p95_ms": float(agg.get("box_p95_ms_median") or 0.0),
            "drag_p95_ms": float(agg.get("drag_p95_ms_median") or 0.0),
        }
    pick = as_dict(metrics.get("pick"))
    box = as_dict(metrics.get("box_query"))
    drag = as_dict(metrics.get("drag_commit"))
    return {
        "pick_p95_ms": float(pick.get("p95_ms") or 0.0),
        "box_p95_ms": float(box.get("p95_ms") or 0.0),
        "drag_p95_ms": float(drag.get("p95_ms") or 0.0),
    }

def format_step166_baseline_compare(step166_payload: dict[str, Any]) -> str:
    baseline = as_dict(step166_payload.get("baseline_compare"))
    if not baseline:
        return ""
    compared = as_int(baseline.get("compared_cases"), 0)
    degraded = as_int(baseline.get("degraded_cases"), 0)
    improved = as_int(baseline.get("improved_cases"), 0)
    baseline_file = str(baseline.get("baseline_file") or "")
    baseline_run_id = str(baseline.get("baseline_run_id") or "")
    if compared == 0 and degraded == 0 and improved == 0 and not baseline_file:
        return ""
    suffix = ""
    if baseline_run_id:
        suffix += f" baseline_run_id=`{baseline_run_id}`"
    if baseline_file:
        suffix += f" baseline={fmt_path(baseline_file)}"
    return f"- step166_baseline_compare: `compared={compared}` `degraded={degraded}` `improved={improved}`{suffix}"

def collect_ui_flow_run_ids(ui_payload: dict[str, Any]) -> list[str]:
    direct = [str(x).strip() for x in as_list(ui_payload.get("run_ids")) if str(x).strip()]
    if direct:
        return direct
    out: list[str] = []
    for item in as_list(ui_payload.get("runs")):
        if not isinstance(item, dict):
            continue
        run_id = str(item.get("run_id") or "").strip()
        if run_id:
            out.append(run_id)
    return out

def format_ui_flow_interaction_coverage(ui_payload: dict[str, Any]) -> str:
    coverage = as_dict(ui_payload.get("interaction_checks_coverage"))
    if not coverage:
        return ""
    label_map = {
        "fillet_pair_preselection_ok": "fillet_pair",
        "chamfer_pair_preselection_ok": "chamfer_pair",
        "fillet_runtime_preselection_ok": "fillet_runtime",
        "chamfer_runtime_preselection_ok": "chamfer_runtime",
        "fillet_reset_guard_ok": "fillet_reset",
        "chamfer_reset_guard_ok": "chamfer_reset",
        "fillet_polyline_preselection_ok": "fillet_poly",
        "chamfer_polyline_preselection_ok": "chamfer_poly",
        "complete": "complete",
    }
    ordered = list(label_map.keys())
    extras = sorted([k for k in coverage.keys() if k not in label_map])
    parts: list[str] = []
    for key in ordered + extras:
        row = as_dict(coverage.get(key))
        if not row:
            continue
        total = as_int(row.get("total_runs"), 0)
        passed = as_int(row.get("pass_runs"), 0)
        if total <= 0:
            continue
        all_pass = bool(row.get("all_pass", passed >= total))
        marker = "" if all_pass else "!"
        parts.append(f"{label_map.get(key, key)}={passed}/{total}{marker}")
    if not parts:
        return ""
    return "- ui_flow_interaction_checks: `{parts}` complete=`{complete}`".format(
        parts=" ".join(parts),
        complete=bool(ui_payload.get("interaction_checks_complete", False))
    )

def classify_ui_flow_failure_stage(summary_payload: dict[str, Any]) -> str:
    stage = str(summary_payload.get("flow_failure_stage") or "").strip().lower()
    if stage in ("open", "resize", "run_code", "flow"):
        return stage
    code = str(summary_payload.get("flow_failure_code") or "").strip().upper()
    if code.startswith("UI_FLOW_OPEN_"):
        return "open"
    if code.startswith("UI_FLOW_RESIZE_"):
        return "resize"
    run_code_exit = as_int(summary_payload.get("run_code_exit_code"), 0)
    if run_code_exit != 0 or code == "UI_FLOW_TIMEOUT":
        return "run_code"
    if code:
        return "flow"
    return ""

def summarize_ui_flow_setup(weekly_path: Path, ui_payload: dict[str, Any]) -> dict[str, Any]:
    stage_counts: dict[str, int] = {}
    raw_stage_counts = ui_payload.get("failure_stage_counts")
    if isinstance(raw_stage_counts, dict):
        for key, value in raw_stage_counts.items():
            name = str(key or "").strip().lower()
            if not name:
                continue
            count = as_int(value, 0)
            if count > 0:
                stage_counts[name] = count
    first_stage = str(ui_payload.get("first_failure_stage") or "").strip().lower()
    open_exit = as_int(ui_payload.get("open_exit_code"), 0)
    resize_exit = as_int(ui_payload.get("resize_exit_code"), 0)
    run_code_exit = as_int(ui_payload.get("run_code_exit_code"), 0)
    run_summaries = [str(x or "").strip() for x in as_list(ui_payload.get("run_summaries")) if str(x or "").strip()]
    for raw in run_summaries:
        run_path = resolve_summary_path(weekly_path, raw)
        if not run_path or not run_path.exists():
            continue
        run_payload = load_json(run_path)
        stage = classify_ui_flow_failure_stage(run_payload)
        if stage:
            stage_counts[stage] = int(stage_counts.get(stage, 0)) + 1
            if not first_stage:
                first_stage = stage
        if open_exit == 0:
            open_exit = as_int(run_payload.get("open_exit_code"), 0)
        if resize_exit == 0:
            resize_exit = as_int(run_payload.get("resize_exit_code"), 0)
        if run_code_exit == 0:
            run_code_exit = as_int(run_payload.get("run_code_exit_code"), 0)
    return {
        "stage_counts": stage_counts,
        "first_stage": first_stage,
        "open_exit_code": open_exit,
        "resize_exit_code": resize_exit,
        "run_code_exit_code": run_code_exit,
    }


def append_editor_smoke_selection_lines(lines: list[str], prefix: str, payload: dict[str, Any]) -> None:
    filters = as_dict(payload.get("filters"))
    priority_set = [str(x) for x in as_list(filters.get("priority_set")) if str(x).strip()]
    tag_any = [str(x) for x in as_list(filters.get("tag_any")) if str(x).strip()]
    if priority_set or tag_any:
        lines.append(
            f"- {prefix}_filters: `priority_set={','.join(priority_set) or '-'}` `tag_any={','.join(tag_any) or '-'}`"
        )

    selection = as_dict(payload.get("case_selection"))
    if selection:
        lines.append(
            "- {prefix}_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` "
            "`total={total}` `fallback={fallback}`".format(
                prefix=prefix,
                selected=as_int(selection.get("selected_count"), 0),
                matched=as_int(selection.get("matched_count"), 0),
                candidate=as_int(selection.get("filtered_count"), 0),
                total=as_int(selection.get("total_input"), 0),
                fallback=str(bool(selection.get("used_fallback", False))).lower(),
            )
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Append weekly validation snapshot to STEP176 verification report.")
    parser.add_argument("--weekly-summary", default="build/editor_weekly_validation_summary.json")
    parser.add_argument("--report", default="docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md")
    args = parser.parse_args()

    weekly_path = resolve_cli_path(args.weekly_summary)
    report_path = resolve_cli_path(args.report)

    weekly = load_json(weekly_path)
    inputs = as_dict(weekly.get("inputs"))
    gate_runtime = as_dict(weekly.get("gate_runtime"))
    editor_smoke = as_dict(weekly.get("editor_smoke"))
    ui_flow = as_dict(weekly.get("ui_flow_smoke"))
    ui_flow_failure_injection = as_dict(weekly.get("ui_flow_failure_injection"))
    step166 = as_dict(weekly.get("step166"))
    step166_baseline_refresh = as_dict(weekly.get("step166_baseline_refresh"))
    perf = as_dict(weekly.get("performance"))
    real_scene = as_dict(weekly.get("real_scene_perf"))
    gate = as_dict(weekly.get("gate"))
    gate_preview_provenance = as_dict(weekly.get("gate_preview_provenance_smoke"))
    gate_solver_action_panel_smoke = as_dict(weekly.get("gate_solver_action_panel_smoke"))
    step186_preview_artifact_prep = as_dict(weekly.get("step186_preview_artifact_prep"))
    gate_preview_provenance_injection = as_dict(weekly.get("gate_preview_provenance_failure_injection"))
    gate_preview_artifact = as_dict(weekly.get("gate_preview_artifact_smoke"))
    gate_assembly_roundtrip_ctest = as_dict(weekly.get("gate_assembly_roundtrip_ctest"))
    gate_preview_artifact_injection = as_dict(weekly.get("gate_preview_artifact_validator_failure_injection"))
    weekly_legacy_preview_artifact_prep = as_dict(weekly.get("weekly_legacy_preview_artifact_prep"))
    weekly_legacy_preview_artifact = as_dict(weekly.get("weekly_legacy_preview_artifact_smoke"))
    trend = as_dict(weekly.get("trend"))
    ui_flow_stage_trend = as_dict(weekly.get("ui_flow_stage_trend"))
    perf_trend = as_dict(weekly.get("perf_trend"))
    real_scene_trend = as_dict(weekly.get("real_scene_trend"))
    case_selection_trend = as_dict(weekly.get("case_selection_trend"))
    parallel_cycle = as_dict(weekly.get("parallel_cycle"))
    qt_policy = as_dict(weekly.get("qt_project_persistence_policy"))

    generated_at = str(weekly.get("generated_at") or "")

    # Load STEP166 summary.json for additional attribution (baseline compare + import meta + sanity warnings).
    step166_sum_raw = str(step166.get("summary_json") or "")
    step166_sum_path = resolve_summary_path(weekly_path, step166_sum_raw)
    step166_payload = load_json(step166_sum_path) if step166_sum_path and step166_sum_path.exists() else {}
    step166_sanity = as_dict(step166_payload.get("sanity"))
    step166_import_meta = as_dict(step166_payload.get("import_meta_summary"))

    lines: list[str] = []
    if not report_path.exists():
        lines.append("# STEP176 Level A 持续开发与验证报告")
        lines.append("")

    lines.append("")
    lines.append(f"## Weekly Snapshot ({generated_at})")
    lines.append(f"- weekly_summary_json: {fmt_path(str(weekly_path))}")
    if weekly.get("history_json"):
        lines.append(f"- history_json: {fmt_path(str(weekly.get('history_json') or ''))}")
    lines.append("")
    lines.append("### Inputs")
    lines.append(
        "- editor_smoke: `mode={mode}` `limit={limit}`".format(
            mode=str(inputs.get("editor_smoke_mode") or ""),
            limit=as_int(inputs.get("editor_smoke_limit"), 0),
        )
    )
    editor_cases_path = str(inputs.get("editor_smoke_cases") or "")
    lines.append(
        "- editor_smoke_cases: {path} `source={source}` `count={count}` `min={min_cases}`".format(
            path=fmt_path(editor_cases_path) if editor_cases_path else "`<discovery>`",
            source=str(inputs.get("editor_smoke_case_source") or "discovery"),
            count=as_int(inputs.get("editor_smoke_cases_count"), 0),
            min_cases=as_int(inputs.get("editor_smoke_min_cases"), 0),
        )
    )
    if bool(inputs.get("editor_smoke_generate_cases")):
        generated_run_ids = [str(x) for x in as_list(inputs.get("editor_smoke_generated_run_ids")) if str(x).strip()]
        generated_count = as_int(inputs.get("editor_smoke_generated_count"), 0)
        generated_declared = as_int(inputs.get("editor_smoke_generated_count_declared"), generated_count)
        generated_actual = as_int(inputs.get("editor_smoke_generated_count_actual"), generated_count)
        generated_mismatch = bool(inputs.get("editor_smoke_generated_count_mismatch", generated_declared != generated_actual))
        lines.append(
            "- editor_smoke_generated_cases: {path} `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `priorities={priorities}`".format(
                path=fmt_path(str(inputs.get("editor_smoke_generated_cases_path") or "")),
                count=generated_count,
                declared=generated_declared,
                actual=generated_actual,
                mismatch=generated_mismatch,
                min_cases=as_int(inputs.get("editor_smoke_generated_min_cases"), 0),
                priorities=str(inputs.get("editor_smoke_generated_priorities") or ""),
            )
        )
        lines.append(
            "- editor_smoke_generated_mismatch_policy: `policy={policy}`".format(
                policy=str(inputs.get("editor_smoke_generated_mismatch_policy") or "warn"),
            )
        )
        lines.append(
            "- editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                run_id=str(inputs.get("editor_smoke_generated_run_id") or ""),
                run_ids=",".join(generated_run_ids) if generated_run_ids else "-",
            )
        )
    if inputs.get("run_editor_ui_flow_smoke"):
        lines.append(
            "- ui_flow_smoke: `mode={mode}` `port={port}` `viewport={viewport}`".format(
                mode=str(inputs.get("editor_ui_flow_mode") or ""),
                port=as_int(inputs.get("editor_ui_flow_port"), 0),
                viewport=str(inputs.get("editor_ui_flow_viewport") or ""),
            )
        )
    if inputs.get("run_ui_flow_failure_injection"):
        lines.append(
            "- ui_flow_failure_injection: `timeout_ms={timeout}` `strict={strict}`".format(
                timeout=as_int(inputs.get("ui_flow_failure_injection_timeout_ms"), 0),
                strict=bool(inputs.get("ui_flow_failure_injection_strict")),
            )
        )
    lines.append(
        "- perf: `entities={entities}` `repeat={repeat}`".format(
            entities=as_int(inputs.get("perf_entities"), 0),
            repeat=as_int(inputs.get("perf_repeat"), 1),
        )
    )
    lines.append(
        "- step166: `mode={mode}` `max_workers={workers}`".format(
            mode=str(inputs.get("cad_mode") or ""),
            workers=as_int(inputs.get("cad_max_workers"), 0),
        )
    )
    lines.append(f"- run_gate: `{bool(inputs.get('run_gate'))}`")
    if bool(inputs.get("run_editor_parallel_cycle")):
        lines.append(
            "- parallel_cycle: `watch_policy={policy}` `weekly_policy={weekly}` `lane_a={lane_a}` `lane_b={lane_b}` `lane_c={lane_c}` `lane_b_ui_flow={ui}` `lane_b_ui_mode={mode}` `lane_b_ui_timeout_ms={timeout}` `strict={strict}`".format(
                policy=str(inputs.get("parallel_cycle_watch_policy") or "observe"),
                weekly=str(inputs.get("weekly_parallel_decision_policy") or "observe"),
                lane_a=bool(inputs.get("parallel_cycle_run_lane_a", False)),
                lane_b=bool(inputs.get("parallel_cycle_run_lane_b", False)),
                lane_c=bool(inputs.get("parallel_cycle_run_lane_c", False)),
                ui=bool(inputs.get("parallel_cycle_lane_b_run_ui_flow", False)),
                mode=str(inputs.get("parallel_cycle_lane_b_ui_flow_mode") or ""),
                timeout=as_int(inputs.get("parallel_cycle_lane_b_ui_flow_timeout_ms"), 0),
                strict=bool(inputs.get("parallel_cycle_strict", False)),
            )
        )
    if bool(inputs.get("run_gate")):
        gate_cases_path = str(inputs.get("gate_editor_smoke_cases") or "")
        lines.append(
            "- gate_editor_smoke_cases: {path} `source={source}`".format(
                path=fmt_path(gate_cases_path) if gate_cases_path else "`<discovery>`",
                source=str(inputs.get("gate_editor_smoke_case_source") or "discovery"),
            )
        )
        generated_gate_run_ids = [str(x) for x in as_list(inputs.get("gate_editor_smoke_generated_run_ids")) if str(x).strip()]
        gate_count = as_int(inputs.get("gate_editor_smoke_generated_count"), 0)
        gate_declared = as_int(inputs.get("gate_editor_smoke_generated_count_declared"), gate_count)
        gate_actual = as_int(inputs.get("gate_editor_smoke_generated_count_actual"), gate_count)
        gate_mismatch = bool(inputs.get("gate_editor_smoke_generated_count_mismatch", gate_declared != gate_actual))
        if gate_count > 0 or gate_declared > 0 or gate_actual > 0 or gate_mismatch:
            lines.append(
                "- gate_editor_smoke_generated_cases: {path} `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `priorities={priorities}`".format(
                    path=fmt_path(str(inputs.get("gate_editor_smoke_generated_cases_path") or "")),
                    count=gate_count,
                    declared=gate_declared,
                    actual=gate_actual,
                    mismatch=gate_mismatch,
                    priorities=str(inputs.get("gate_editor_smoke_generated_priorities") or ""),
                )
            )
            lines.append(
                "- gate_editor_smoke_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                    policy=str(inputs.get("gate_editor_smoke_generated_mismatch_policy") or "warn"),
                    gate_fail=bool(inputs.get("gate_editor_smoke_generated_mismatch_gate_fail", False)),
                )
            )
            lines.append(
                "- gate_editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                    run_id=str(inputs.get("gate_editor_smoke_generated_run_id") or ""),
                    run_ids=",".join(generated_gate_run_ids) if generated_gate_run_ids else "-",
                )
            )
    if weekly_legacy_preview_artifact_prep.get("enabled"):
        lines.append(
            "- weekly_legacy_preview_artifact_prep_cases: {path} `status={status}`".format(
                path=fmt_path(str(weekly_legacy_preview_artifact_prep.get("cases_path") or "")),
                status=str(weekly_legacy_preview_artifact_prep.get("status") or ""),
            )
        )
    if weekly_legacy_preview_artifact.get("enabled"):
        lines.append(
            "- weekly_legacy_preview_artifact_smoke_cases: {path} `status={status}`".format(
                path=fmt_path(str(weekly_legacy_preview_artifact.get("cases_path") or "")),
                status=str(weekly_legacy_preview_artifact.get("status") or ""),
            )
        )
    lines.append("")
    lines.append("### Runs")
    editor_totals = as_dict(editor_smoke.get("totals"))
    lines.append(
        "- editor_smoke_run_id: `{run_id}` status=`{status}` pass=`{ok}` fail=`{fail}` skipped=`{skip}`".format(
            run_id=editor_smoke.get("run_id", ""),
            status=editor_smoke.get("status", ""),
            ok=as_int(editor_totals.get("pass"), 0),
            fail=as_int(editor_totals.get("fail"), 0),
            skip=as_int(editor_totals.get("skipped"), 0),
        )
    )
    append_editor_smoke_selection_lines(lines, "editor_smoke", editor_smoke)
    editor_buckets = as_dict(editor_smoke.get("failure_buckets"))
    editor_bucket_parts: list[str] = []
    for key in ("INPUT_INVALID", "IMPORT_FAIL", "RENDER_DRIFT", "VIEWPORT_LAYOUT_MISSING", "TEXT_METRIC_DRIFT"):
        count = as_int(editor_buckets.get(key), 0)
        if count > 0:
            editor_bucket_parts.append(f"{key}={count}")
    if editor_bucket_parts:
        lines.append(f"- editor_smoke_failure_buckets: `{' '.join(editor_bucket_parts)}`")
    editor_code_counts = as_dict(editor_smoke.get("failure_code_counts"))
    if editor_code_counts:
        parts = [f"{k}={editor_code_counts[k]}" for k in sorted(editor_code_counts.keys())]
        lines.append(f"- editor_smoke_failure_codes: `{' '.join(parts)}`")
    editor_unsupported = as_dict(editor_smoke.get("unsupported_passthrough"))
    if editor_unsupported:
        lines.append(
            "- editor_smoke_unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                cases=as_int(editor_unsupported.get("cases_with_checks"), 0),
                checked=as_int(editor_unsupported.get("checked_entities"), 0),
                missing=as_int(editor_unsupported.get("missing_entities"), 0),
                drifted=as_int(editor_unsupported.get("drifted_entities"), 0),
                failed=as_int(editor_unsupported.get("failed_cases"), 0),
            )
        )
    failed_cases = [row for row in as_list(editor_smoke.get("failed_cases")) if isinstance(row, dict)]
    if failed_cases:
        preview = []
        for row in failed_cases[:3]:
            name = str(row.get("name") or "(unknown)")
            bucket = str(row.get("bucket") or "")
            codes = [str(c) for c in as_list(row.get("failure_codes")) if str(c or "").strip()]
            item = name
            if bucket:
                item += f":{bucket}"
            if codes:
                item += ":" + "+".join(codes)
            preview.append(item)
        if preview:
            lines.append(f"- editor_smoke_recent_failures: `{' | '.join(preview)}`")
    if ui_flow.get("enabled"):
        ui_setup = summarize_ui_flow_setup(weekly_path, ui_flow)
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append(f"- ui_flow_smoke: `{ui_flow.get('status','')}` run_id=`{ui_flow.get('run_id','')}`")
        ui_run_ids = collect_ui_flow_run_ids(ui_flow)
        if ui_run_ids:
            lines.append(f"  - run_ids: `{' '.join(ui_run_ids)}`")
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui_flow.get("gate_required", False)),
                explicit=bool(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "  - port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        lines.append(
            "- ui_flow_gate_runs: `target={target}` `run_count={run_count}` `pass={ok}` `fail={fail}`".format(
                target=as_int(ui_flow.get("gate_runs_target"), 0),
                run_count=as_int(ui_flow.get("gate_run_count"), 0),
                ok=as_int(ui_flow.get("gate_pass_count"), 0),
                fail=as_int(ui_flow.get("gate_fail_count"), 0),
            )
        )
        lines.append(
            "  - failure_attribution: `complete={complete}` `code_total={total}`".format(
                complete=bool(ui_flow.get("failure_attribution_complete", True)),
                total=as_int(ui_flow.get("failure_code_total"), 0),
            )
        )
        lines.append(
            "  - setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `first_failure_stage={stage}`".format(
                open_rc=as_int(ui_setup.get("open_exit_code"), 0),
                resize_rc=as_int(ui_setup.get("resize_exit_code"), 0),
                run_rc=as_int(ui_setup.get("run_code_exit_code"), 0),
                stage=str(ui_setup.get("first_stage") or "-"),
            )
        )
        if str(ui_flow.get("first_failure_code") or "").strip():
            lines.append(f"  - first_failure_code: `{str(ui_flow.get('first_failure_code') or '')}`")
        ui_stage_counts = as_dict(ui_setup.get("stage_counts"))
        if ui_stage_counts:
            parts = [f"{k}={ui_stage_counts[k]}" for k in sorted(ui_stage_counts.keys())]
            lines.append(f"  - failure_stage_counts: `{' '.join(parts)}`")
        code_counts = ui_flow.get("failure_code_counts")
        if isinstance(code_counts, dict) and code_counts:
            parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
            lines.append(f"  - gate_failure_codes: `{' '.join(parts)}`")
        # Pull short triage info from UI-flow summary.json (helps debug flaky UI wiring).
        ui_sum_raw = str(ui_flow.get("summary_json") or "")
        ui_sum_path = resolve_summary_path(weekly_path, ui_sum_raw)
        ui_payload = load_json(ui_sum_path) if ui_sum_path and ui_sum_path.exists() else {}
        step = str(ui_payload.get("flow_step") or "")
        sel = str(ui_payload.get("flow_selection") or "")
        msg = str(ui_payload.get("flow_status") or "")
        if step or sel or msg:
            lines.append(f"  - triage: step=`{step}` selection=`{sel}` status=`{msg}`")
        interaction_line = format_ui_flow_interaction_coverage(ui_flow)
        if interaction_line:
            lines.append(f"  {interaction_line}" if interaction_line.startswith("- ") else interaction_line)
        runs = ui_flow.get("runs")
        if isinstance(runs, list):
            failed_runs = [r for r in runs if isinstance(r, dict) and not bool(r.get("ok"))]
            if failed_runs:
                fr = failed_runs[0]
                code = str(fr.get("failure_code") or "")
                detail = first_nonempty([fr.get("failure_detail"), fr.get("flow_status")])
                if not detail:
                    detail = first_nonempty(fr.get("error_tail") if isinstance(fr.get("error_tail"), list) else [])
                if not code:
                    code = "UI_FLOW_UNKNOWN_FAIL"
                if len(detail) > 220:
                    detail = detail[:220] + "..."
                lines.append(
                    "  - first_failed_run: run_id=`{run_id}` code=`{code}` step=`{step}` selection=`{selection}` detail=`{detail}`".format(
                        run_id=str(fr.get("run_id") or ""),
                        code=code,
                        step=str(fr.get("flow_step") or ""),
                        selection=str(fr.get("flow_selection") or ""),
                        detail=detail,
                    )
                )
    elif ui_flow.get("gate_required") or as_dict(ui_flow.get("port_allocation")):
        ui_setup = summarize_ui_flow_setup(weekly_path, ui_flow)
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append(
            "- ui_flow_smoke: `{status}` run_id=`{run_id}` enabled=`{enabled}` mode=`{mode}`".format(
                status=str(ui_flow.get("status") or ""),
                run_id=str(ui_flow.get("run_id") or ""),
                enabled=bool(ui_flow.get("enabled", False)),
                mode=str(ui_flow.get("mode") or "skipped"),
            )
        )
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui_flow.get("gate_required", False)),
                explicit=bool(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "  - port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        if str(ui_flow.get("first_failure_code") or "").strip():
            lines.append(f"  - first_failure_code: `{str(ui_flow.get('first_failure_code') or '')}`")
        lines.append(
            "  - setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `first_failure_stage={stage}`".format(
                open_rc=as_int(ui_setup.get("open_exit_code"), 0),
                resize_rc=as_int(ui_setup.get("resize_exit_code"), 0),
                run_rc=as_int(ui_setup.get("run_code_exit_code"), 0),
                stage=str(ui_setup.get("first_stage") or "-"),
            )
        )
        ui_stage_counts = as_dict(ui_setup.get("stage_counts"))
        if ui_stage_counts:
            parts = [f"{k}={ui_stage_counts[k]}" for k in sorted(ui_stage_counts.keys())]
            lines.append(f"  - failure_stage_counts: `{' '.join(parts)}`")
    if ui_flow_failure_injection.get("enabled"):
        inj_detail = str(ui_flow_failure_injection.get("failure_detail") or "")
        if len(inj_detail) > 220:
            inj_detail = inj_detail[:220] + "..."
        lines.append(
            "- ui_flow_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                status=str(ui_flow_failure_injection.get("status") or ""),
                run_id=str(ui_flow_failure_injection.get("run_id") or ""),
                code=str(ui_flow_failure_injection.get("failure_code") or ""),
                detail=inj_detail,
            )
        )
    lines.append(f"- step166_run_id: `{step166.get('run_id','')}` (gate_would_fail=`{step166.get('gate_would_fail', False)}`)")
    baseline_line = format_step166_baseline_compare(step166_payload)
    if baseline_line:
        lines.append(baseline_line)
    if step166_baseline_refresh.get("enabled"):
        reason = str(step166_baseline_refresh.get("reason") or "").replace("\n", " ").strip()
        reason_suffix = f" reason=`{reason[:160]}`" if reason else ""
        lines.append(
            "- step166_baseline_refresh: `eligible={eligible}` `applied={applied}` `candidate={candidate}`{reason}".format(
                eligible=str(step166_baseline_refresh.get("eligible", False)),
                applied=str(step166_baseline_refresh.get("applied", False)),
                candidate=str(step166_baseline_refresh.get("candidate_run_id", "")),
                reason=reason_suffix,
            )
        )
        window = step166_baseline_refresh.get("window_report")
        if isinstance(window, list) and window:
            present_count = 0
            stable_count = 0
            latest_day = ""
            first_missing = ""
            for item in window:
                if not isinstance(item, dict):
                    continue
                day = str(item.get("day") or "")
                if day and (not latest_day or day > latest_day):
                    latest_day = day
                present = bool(item.get("present"))
                if present:
                    present_count += 1
                    if bool(item.get("stable")):
                        stable_count += 1
                elif not first_missing and day:
                    first_missing = day
            detail = (
                f"  - refresh_window: `days={len(window)}` `present={present_count}` `stable={stable_count}` "
                f"`latest={latest_day}`"
            )
            if first_missing:
                detail += f" `first_missing={first_missing}`"
            lines.append(detail)
    lines.append(f"- perf_run_id: `{perf.get('run_id','')}`")
    lines.append(f"- real_scene_perf: `enabled={real_scene.get('enabled', False)}` status=`{real_scene.get('status','')}`")
    lines.append(f"- gate: `{gate.get('status','')}`")
    gate_ui = as_dict(gate.get("ui_flow_smoke"))
    if gate_ui:
        gate_ui_setup = summarize_ui_flow_setup(weekly_path, gate_ui)
        gate_ui_status = str(gate_ui.get("status") or gate_ui.get("mode") or "skipped")
        lines.append(
            "- gate_ui_flow_smoke: `mode={mode}` `status={status}` `run_count={count}` `pass={ok}` `fail={fail}`".format(
                mode=str(gate_ui.get("mode") or ""),
                status=gate_ui_status,
                count=as_int(gate_ui.get("gate_run_count"), 0),
                ok=as_int(gate_ui.get("gate_pass_count"), 0),
                fail=as_int(gate_ui.get("gate_fail_count"), 0),
            )
        )
        gate_ui_ids = collect_ui_flow_run_ids(gate_ui)
        if gate_ui_ids:
            lines.append(f"- gate_ui_flow_run_ids: `{' '.join(gate_ui_ids)}`")
        lines.append(
            "- gate_ui_flow_setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `first_failure_stage={stage}`".format(
                open_rc=as_int(gate_ui_setup.get("open_exit_code"), 0),
                resize_rc=as_int(gate_ui_setup.get("resize_exit_code"), 0),
                run_rc=as_int(gate_ui_setup.get("run_code_exit_code"), 0),
                stage=str(gate_ui_setup.get("first_stage") or "-"),
            )
        )
        gate_ui_stage_counts = as_dict(gate_ui_setup.get("stage_counts"))
        if gate_ui_stage_counts:
            parts = [f"{k}={gate_ui_stage_counts[k]}" for k in sorted(gate_ui_stage_counts.keys())]
            lines.append(f"- gate_ui_flow_failure_stage_counts: `{' '.join(parts)}`")
        gate_interaction_line = format_ui_flow_interaction_coverage(gate_ui)
        if gate_interaction_line:
            line = gate_interaction_line.replace("- ui_flow_interaction_checks:", "- gate_ui_flow_interaction_checks:")
            lines.append(line)
    gate_step166 = as_dict(gate.get("step166"))
    if gate_step166:
        gate_step166_decision = as_dict(gate_step166.get("gate_decision"))
        lines.append(
            "- gate_step166_run_id: `{run_id}` (enabled=`{enabled}` gate_would_fail=`{would_fail}`)".format(
                run_id=str(gate_step166.get("run_id") or ""),
                enabled=bool(gate_step166.get("enabled", False)),
                would_fail=bool(gate_step166_decision.get("would_fail", False)),
            )
        )
        gate_step166_baseline = as_dict(gate_step166.get("baseline_compare"))
        if gate_step166_baseline:
            lines.append(
                "- gate_step166_baseline_compare: `compared={compared}` `degraded={degraded}` `improved={improved}`".format(
                    compared=as_int(gate_step166_baseline.get("compared_cases"), 0),
                    degraded=as_int(gate_step166_baseline.get("degraded_cases"), 0),
                    improved=as_int(gate_step166_baseline.get("improved_cases"), 0),
                )
            )
    if qt_policy:
        lines.append(
            "- qt_persistence_policy: `status={status}` `recommended_require_on={recommended}` `effective_require_on={effective}` `source={source}` samples=`{window}/{total}`".format(
                status=str(qt_policy.get("status") or ""),
                recommended=bool(qt_policy.get("recommended_require_on", False)),
                effective=bool(qt_policy.get("effective_require_on", False)),
                source=str(qt_policy.get("effective_source") or ""),
                window=as_int(qt_policy.get("samples_in_window"), 0),
                total=as_int(qt_policy.get("samples_total"), 0),
            )
        )
        recommendation = str(qt_policy.get("recommendation") or "")
        if recommendation:
            if len(recommendation) > 220:
                recommendation = recommendation[:220] + "..."
            lines.append(f"  - recommendation: `{recommendation}`")
        policy_obj = as_dict(qt_policy.get("policy"))
        thresholds = as_dict(policy_obj.get("thresholds"))
        if thresholds:
            lines.append(
                "  - thresholds: `min_samples={samples}` `min_consecutive_target_passes={passes}`".format(
                    samples=as_int(thresholds.get("min_samples"), 0),
                    passes=as_int(thresholds.get("min_consecutive_target_passes"), 0),
                )
            )
        metrics = as_dict(qt_policy.get("metrics"))
        if metrics:
            lines.append(
                "  - target_available: `runs={runs}` `pass={ok}` `fail={fail}` `consecutive_pass={consecutive}`".format(
                    runs=as_int(metrics.get("target_available_runs"), 0),
                    ok=as_int(metrics.get("target_available_pass_runs"), 0),
                    fail=as_int(metrics.get("target_available_fail_runs"), 0),
                    consecutive=as_int(metrics.get("consecutive_target_available_pass_runs"), 0),
                )
            )
    gate_editor = as_dict(gate.get("editor_smoke"))
    if gate_editor:
        gate_totals = as_dict(gate_editor.get("totals"))
        runtime_profile = str(gate_runtime.get("profile") or inputs.get("gate_editor_profile") or "<none>")
        runtime_step166 = bool(gate_runtime.get("step166_gate", inputs.get("gate_run_step166_gate", False)))
        runtime_ui_flow = bool(gate_runtime.get("ui_flow_gate", inputs.get("gate_run_editor_ui_flow_smoke_gate", False)))
        runtime_convert = bool(gate_runtime.get("convert_disabled", inputs.get("gate_editor_smoke_no_convert", False)))
        runtime_perf = bool(gate_runtime.get("perf_trend", inputs.get("gate_run_perf_trend", False)))
        runtime_scene = bool(gate_runtime.get("real_scene_trend", inputs.get("gate_run_real_scene_trend", False)))
        runtime_source = str(gate_runtime.get("source") or "weekly.inputs")
        lines.append(
            "- gate_editor_smoke: run_id=`{run_id}` status=`{status}` pass=`{ok}` fail=`{fail}` skipped=`{skip}`".format(
                run_id=gate_editor.get("run_id", ""),
                status=gate_editor.get("status", ""),
                ok=as_int(gate_totals.get("pass"), 0),
                fail=as_int(gate_totals.get("fail"), 0),
                skip=as_int(gate_totals.get("skipped"), 0),
            )
        )
        lines.append(
            "- gate_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}` `source={source}`".format(
                profile=runtime_profile,
                step166=runtime_step166,
                ui_flow=runtime_ui_flow,
                convert=runtime_convert,
                perf=runtime_perf,
                real_scene=runtime_scene,
                source=runtime_source,
            )
        )
        if str(gate_editor.get("case_source") or "").strip():
            lines.append(f"- gate_editor_smoke_case_source: `{str(gate_editor.get('case_source') or '')}`")
        append_editor_smoke_selection_lines(lines, "gate_editor_smoke", gate_editor)
        gate_codes = as_dict(gate_editor.get("failure_code_counts"))
        if gate_codes:
            parts = [f"{k}={gate_codes[k]}" for k in sorted(gate_codes.keys())]
            lines.append(f"- gate_editor_smoke_failure_codes: `{' '.join(parts)}`")
        gate_unsupported = as_dict(gate_editor.get("unsupported_passthrough"))
        if gate_unsupported:
            lines.append(
                "- gate_editor_smoke_unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                    cases=as_int(gate_unsupported.get("cases_with_checks"), 0),
                    checked=as_int(gate_unsupported.get("checked_entities"), 0),
                    missing=as_int(gate_unsupported.get("missing_entities"), 0),
                    drifted=as_int(gate_unsupported.get("drifted_entities"), 0),
                    failed=as_int(gate_unsupported.get("failed_cases"), 0),
                )
            )
    gate_editor_injection = as_dict(gate.get("editor_smoke_failure_injection"))
    if gate_editor_injection.get("enabled"):
        detail = str(gate_editor_injection.get("failure_detail") or "")
        if len(detail) > 220:
            detail = detail[:220] + "..."
        lines.append(
            "- gate_editor_smoke_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                status=str(gate_editor_injection.get("status") or ""),
                run_id=str(gate_editor_injection.get("run_id") or ""),
                code=str(gate_editor_injection.get("failure_code") or ""),
                detail=detail,
            )
        )
    if gate_preview_provenance.get("enabled"):
        lines.append(
            "- gate_preview_provenance_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `entry={entry}` `focus_checks={focus_checks}` `first_failed_case={first_failed}`".format(
                mode=str(gate_preview_provenance.get("mode") or ""),
                ok=bool(gate_preview_provenance.get("ok", False)),
                run_id=str(gate_preview_provenance.get("run_id") or ""),
                cases=as_int(gate_preview_provenance.get("case_count"), 0),
                ok_count=as_int(gate_preview_provenance.get("pass_count"), 0),
                fail_count=as_int(gate_preview_provenance.get("fail_count"), 0),
                entry="{det}/{cases}".format(
                    det=as_int(
                        gate_preview_provenance.get("deterministic_entry_case_count")
                        if gate_preview_provenance.get("deterministic_entry_case_count") is not None
                        else gate_preview_provenance.get("initial_entry_case_count"),
                        0,
                    ),
                    cases=as_int(gate_preview_provenance.get("case_count"), 0),
                ),
                focus_checks=as_int(gate_preview_provenance.get("focus_check_case_count"), 0),
                first_failed=str(gate_preview_provenance.get("first_failed_case") or "-"),
            )
        )
    gate_dwg_open = as_dict(weekly.get("gate_dwg_open_smoke"))
    if gate_dwg_open.get("enabled"):
        lines.append(
            "- gate_dwg_open_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `dwg_convert={dwg_convert}` `router={router}` `convert={convert}` `viewer={viewer}` `validators_ok={validators}`".format(
                mode=str(gate_dwg_open.get("mode") or ""),
                ok=bool(gate_dwg_open.get("ok", False)),
                run_id=str(gate_dwg_open.get("run_id") or ""),
                dwg_convert=bool(gate_dwg_open.get("dwg_convert_ok", False)),
                router=bool(gate_dwg_open.get("router_ok", False)),
                convert=bool(gate_dwg_open.get("convert_ok", False)),
                viewer=bool(gate_dwg_open.get("viewer_ok", False)),
                validators=as_int(gate_dwg_open.get("validator_ok_count"), 0),
            )
        )
    gate_dwg_open_matrix = as_dict(weekly.get("gate_dwg_open_matrix_smoke"))
    if gate_dwg_open_matrix.get("enabled"):
        lines.append(
            "- gate_dwg_open_matrix_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `dwg_convert_ok={dwg_convert_ok}` `router_ok={router_ok}` `convert_ok={convert_ok}` `viewer_ok={viewer_ok}` `validators_ok={validators}` `first_failed_case={first_failed}`".format(
                mode=str(gate_dwg_open_matrix.get("mode") or ""),
                ok=bool(gate_dwg_open_matrix.get("ok", False)),
                run_id=str(gate_dwg_open_matrix.get("run_id") or ""),
                cases=as_int(gate_dwg_open_matrix.get("case_count"), 0),
                ok_count=as_int(gate_dwg_open_matrix.get("pass_count"), 0),
                fail_count=as_int(gate_dwg_open_matrix.get("fail_count"), 0),
                dwg_convert_ok=as_int(gate_dwg_open_matrix.get("dwg_convert_ok_count"), 0),
                router_ok=as_int(gate_dwg_open_matrix.get("router_ok_count"), 0),
                convert_ok=as_int(gate_dwg_open_matrix.get("convert_ok_count"), 0),
                viewer_ok=as_int(gate_dwg_open_matrix.get("viewer_ok_count"), 0),
                validators=as_int(gate_dwg_open_matrix.get("validator_ok_count"), 0),
                first_failed=str(gate_dwg_open_matrix.get("first_failed_case") or "-"),
            )
        )
    gate_dwg_open_desktop = as_dict(weekly.get("gate_dwg_open_desktop_smoke"))
    if gate_dwg_open_desktop.get("enabled"):
        lines.append(
            "- gate_dwg_open_desktop_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `desktop={desktop}` `manifest={manifest}` `preview_artifacts={preview_artifacts}` `validators_ok={validators}`".format(
                mode=str(gate_dwg_open_desktop.get("mode") or ""),
                ok=bool(gate_dwg_open_desktop.get("ok", False)),
                run_id=str(gate_dwg_open_desktop.get("run_id") or ""),
                desktop=bool(gate_dwg_open_desktop.get("desktop_ok", False)),
                manifest=bool(gate_dwg_open_desktop.get("manifest_ok", False)),
                preview_artifacts=bool(gate_dwg_open_desktop.get("preview_artifacts_ok", False)),
                validators=as_int(gate_dwg_open_desktop.get("validator_ok_count"), 0),
            )
        )
    gate_constraints_basic_ctest = as_dict(weekly.get("gate_constraints_basic_ctest"))
    if gate_constraints_basic_ctest.get("enabled"):
        lines.append(
            "- gate_constraints_basic_ctest: `status={status}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing={missing}` `first_failed_case={first_failed}` `test={test}`".format(
                status=str(gate_constraints_basic_ctest.get("status") or ""),
                cases=as_int(gate_constraints_basic_ctest.get("case_count"), 0),
                ok_count=as_int(gate_constraints_basic_ctest.get("pass_count"), 0),
                fail_count=as_int(gate_constraints_basic_ctest.get("fail_count"), 0),
                missing=as_int(gate_constraints_basic_ctest.get("missing_count"), 0),
                first_failed=str(gate_constraints_basic_ctest.get("first_failed_case") or "-"),
                test=str(gate_constraints_basic_ctest.get("test_name") or "-"),
            )
        )
    if gate_solver_action_panel_smoke.get("enabled"):
        lines.append(
            "- gate_solver_action_panel_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `panels={panels}` `flow_checks={flow_checks}` `requests={requests}` `invoke={invoke_count}` `focus={focus_count}` `flow={flow_count}` `replay={replay_count}` `import_checks={import_checks}` `clear_checks={clear_checks}` `jump_requests={jump_request_count}` `dom_events={dom_event_count}` `dom_requests={dom_request_count}` `dom_actions={dom_action_count}` `dom_focus={dom_focus_count}` `dom_flow={dom_flow_count}` `dom_replay={dom_replay_count}` `events={event_count}` `event_invoke={event_invoke_count}` `event_focus={event_focus_count}` `event_flow={event_flow_count}` `event_replay={event_replay_count}` `jump_events={jump_event_count}` `next={next_count}` `jump={jump_count}` `prev={prev_count}` `restart={restart_count}` `replay_checks={replay_checks}` `event_focus_checks={event_focus_checks}` `banner_checks={banner_checks}` `banner_event_focus={banner_event_focus_checks}` `banner_focus_clicks={banner_focus_clicks}` `console={console_checks}` `console_flow={console_flow_checks}` `console_event_focus={console_event_focus_checks}` `console_replay={console_replay_checks}` `console_event_click={console_event_click_checks}` `console_focus_click={console_focus_click_checks}` `console_selection={console_selection_checks}` `status_checks={status_checks}` `status_clicks={status_click_checks}` `keyboard={keyboard_checks}` `panel_cycle={panel_cycle_checks}` `panel_keyboard={panel_keyboard_checks}` `panel_keyboard_invoke={panel_keyboard_invoke_checks}` `panel_keyboard_flow={panel_keyboard_flow_checks}` `keyboard_banner={keyboard_banner_checks}` `keyboard_jump={keyboard_jump_checks}` `keyboard_event_focus={keyboard_event_focus_checks}` `visited_panels={visited}`".format(
                mode=str(gate_solver_action_panel_smoke.get("mode") or ""),
                ok=bool(gate_solver_action_panel_smoke.get("ok", False)),
                run_id=str(gate_solver_action_panel_smoke.get("run_id") or ""),
                panels=as_int(gate_solver_action_panel_smoke.get("panel_count"), 0),
                flow_checks=as_int(gate_solver_action_panel_smoke.get("flow_check_count"), 0),
                requests=as_int(gate_solver_action_panel_smoke.get("request_count"), 0),
                invoke_count=as_int(gate_solver_action_panel_smoke.get("invoke_request_count"), 0),
                focus_count=as_int(gate_solver_action_panel_smoke.get("focus_request_count"), 0),
                flow_count=as_int(gate_solver_action_panel_smoke.get("flow_request_count"), 0),
                replay_count=as_int(gate_solver_action_panel_smoke.get("replay_request_count"), 0),
                import_checks=as_int(gate_solver_action_panel_smoke.get("import_check_count"), 0),
                clear_checks=as_int(gate_solver_action_panel_smoke.get("clear_check_count"), 0),
                jump_request_count=as_int(gate_solver_action_panel_smoke.get("jump_request_count"), 0),
                dom_event_count=as_int(gate_solver_action_panel_smoke.get("dom_event_count"), 0),
                dom_request_count=as_int(gate_solver_action_panel_smoke.get("dom_request_event_count"), 0),
                dom_action_count=as_int(gate_solver_action_panel_smoke.get("dom_action_event_count"), 0),
                dom_focus_count=as_int(gate_solver_action_panel_smoke.get("dom_focus_event_count"), 0),
                dom_flow_count=as_int(gate_solver_action_panel_smoke.get("dom_flow_event_count"), 0),
                dom_replay_count=as_int(gate_solver_action_panel_smoke.get("dom_replay_event_count"), 0),
                event_count=as_int(gate_solver_action_panel_smoke.get("event_count"), 0),
                event_invoke_count=as_int(gate_solver_action_panel_smoke.get("invoke_event_count"), 0),
                event_focus_count=as_int(gate_solver_action_panel_smoke.get("focus_event_count"), 0),
                event_flow_count=as_int(gate_solver_action_panel_smoke.get("flow_event_count"), 0),
                event_replay_count=as_int(gate_solver_action_panel_smoke.get("replay_event_count"), 0),
                jump_event_count=as_int(gate_solver_action_panel_smoke.get("jump_event_count"), 0),
                next_count=as_int(gate_solver_action_panel_smoke.get("next_check_count"), 0),
                jump_count=as_int(gate_solver_action_panel_smoke.get("jump_check_count"), 0),
                prev_count=as_int(gate_solver_action_panel_smoke.get("rewind_check_count"), 0),
                restart_count=as_int(gate_solver_action_panel_smoke.get("restart_check_count"), 0),
                replay_checks=as_int(gate_solver_action_panel_smoke.get("replay_check_count"), 0),
                event_focus_checks=as_int(gate_solver_action_panel_smoke.get("event_focus_check_count"), 0),
                banner_checks=as_int(gate_solver_action_panel_smoke.get("banner_check_count"), 0),
                banner_event_focus_checks=as_int(gate_solver_action_panel_smoke.get("banner_event_focus_check_count"), 0),
                banner_focus_clicks=as_int(gate_solver_action_panel_smoke.get("banner_focus_click_check_count"), 0),
                console_checks=as_int(gate_solver_action_panel_smoke.get("console_check_count"), 0),
                console_flow_checks=as_int(gate_solver_action_panel_smoke.get("console_flow_check_count"), 0),
                console_event_focus_checks=as_int(gate_solver_action_panel_smoke.get("console_event_focus_check_count"), 0),
                console_replay_checks=as_int(gate_solver_action_panel_smoke.get("console_replay_check_count"), 0),
                console_event_click_checks=as_int(gate_solver_action_panel_smoke.get("console_event_click_check_count"), 0),
                console_focus_click_checks=as_int(gate_solver_action_panel_smoke.get("console_focus_click_check_count"), 0),
                console_selection_checks=as_int(gate_solver_action_panel_smoke.get("console_selection_check_count"), 0),
                status_checks=as_int(gate_solver_action_panel_smoke.get("status_check_count"), 0),
                status_click_checks=as_int(gate_solver_action_panel_smoke.get("status_click_check_count"), 0),
                keyboard_checks=as_int(gate_solver_action_panel_smoke.get("keyboard_check_count"), 0),
                panel_cycle_checks=as_int(gate_solver_action_panel_smoke.get("panel_cycle_check_count"), 0),
                panel_keyboard_checks=as_int(gate_solver_action_panel_smoke.get("panel_keyboard_check_count"), 0),
                panel_keyboard_invoke_checks=as_int(gate_solver_action_panel_smoke.get("panel_keyboard_invoke_check_count"), 0),
                panel_keyboard_flow_checks=as_int(gate_solver_action_panel_smoke.get("panel_keyboard_flow_check_count"), 0),
                keyboard_banner_checks=as_int(gate_solver_action_panel_smoke.get("keyboard_banner_check_count"), 0),
                keyboard_jump_checks=as_int(gate_solver_action_panel_smoke.get("keyboard_jump_check_count"), 0),
                keyboard_event_focus_checks=as_int(gate_solver_action_panel_smoke.get("keyboard_event_focus_check_count"), 0),
                visited=as_int(gate_solver_action_panel_smoke.get("visited_panel_count"), 0),
            )
        )
    if step186_preview_artifact_prep.get("enabled"):
        lines.append(
            "- step186_preview_artifact_prep: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
                status=str(step186_preview_artifact_prep.get("status") or ""),
                run_id=str(step186_preview_artifact_prep.get("run_id") or ""),
                cases=as_int(step186_preview_artifact_prep.get("case_count"), 0),
                ok_count=as_int(step186_preview_artifact_prep.get("pass_count"), 0),
                fail_count=as_int(step186_preview_artifact_prep.get("fail_count"), 0),
                first_failed=str(step186_preview_artifact_prep.get("first_failed_case") or "-"),
            )
        )
    if gate_preview_provenance_injection.get("enabled"):
        lines.append(
            "- gate_preview_provenance_failure_injection: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
                status=str(gate_preview_provenance_injection.get("status") or ""),
                run_id=str(gate_preview_provenance_injection.get("run_id") or ""),
                cases=as_int(gate_preview_provenance_injection.get("case_count"), 0),
                ok_count=as_int(gate_preview_provenance_injection.get("pass_count"), 0),
                fail_count=as_int(gate_preview_provenance_injection.get("fail_count"), 0),
                first_failed=str(gate_preview_provenance_injection.get("first_failed_case") or "-"),
            )
        )
    if gate_preview_artifact.get("enabled"):
        lines.append(
            "- gate_preview_artifact_smoke: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
                status=str(gate_preview_artifact.get("status") or ""),
                run_id=str(gate_preview_artifact.get("run_id") or ""),
                cases=as_int(gate_preview_artifact.get("case_count"), 0),
                ok_count=as_int(gate_preview_artifact.get("pass_count"), 0),
                fail_count=as_int(gate_preview_artifact.get("fail_count"), 0),
                first_failed=str(gate_preview_artifact.get("first_failed_case") or "-"),
            )
        )
    if gate_assembly_roundtrip_ctest.get("enabled"):
        lines.append(
        "- gate_assembly_roundtrip_ctest: `status={status}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing={missing}` `model={model}` `paperspace={paperspace}` `mixed={mixed}` `dense={dense}` `summaries={summaries}` `tracked={tracked}` `groups={groups}` `group_sources={group_sources}` `group_source_cases={group_source_cases}` `group_source_case_details={group_source_case_details}` `group_layouts={group_layouts}` `group_layout_cases={group_layout_cases}` `group_layout_case_details={group_layout_case_details}` `proxies={proxies}` `proxy_kinds={proxy_kinds}` `proxy_kind_cases={proxy_kind_cases}` `proxy_kind_case_details={proxy_kind_case_details}` `proxy_layouts={proxy_layouts}` `proxy_layout_cases={proxy_layout_cases}` `proxy_layout_case_details={proxy_layout_case_details}` `text_kinds={text_kinds}` `text_kind_layouts={text_kind_layouts}` `text_kind_cases={text_kind_cases}` `text_kind_case_details={text_kind_case_details}` `exploded={exploded}` `exploded_layouts={exploded_layouts}` `exploded_layout_cases={exploded_layout_cases}` `exploded_layout_case_details={exploded_layout_case_details}` `viewports={viewports}` `viewport_layouts={viewport_layouts}` `viewport_cases={viewport_cases}` `viewport_detail_cases={viewport_detail_cases}` `viewport_proxy_kinds={viewport_proxy_kinds}` `viewport_proxy_layouts={viewport_proxy_layouts}` `viewport_proxy_cases={viewport_proxy_cases}` `viewport_proxy_case_details={viewport_proxy_case_details}` `checked={checked}` `drift={metadata_drift}/{group_drift}` `first_failed_case={first_failed}`".format(
                status=str(gate_assembly_roundtrip_ctest.get("status") or ""),
                cases=as_int(gate_assembly_roundtrip_ctest.get("case_count"), 0),
                ok_count=as_int(gate_assembly_roundtrip_ctest.get("pass_count"), 0),
                fail_count=as_int(gate_assembly_roundtrip_ctest.get("fail_count"), 0),
                missing=as_int(gate_assembly_roundtrip_ctest.get("missing_count"), 0),
                model=str(gate_assembly_roundtrip_ctest.get("model_status") or "-"),
                paperspace=str(gate_assembly_roundtrip_ctest.get("paperspace_status") or "-"),
                mixed=str(gate_assembly_roundtrip_ctest.get("mixed_status") or "-"),
                dense=str(gate_assembly_roundtrip_ctest.get("dense_status") or "-"),
                summaries=as_int(gate_assembly_roundtrip_ctest.get("summary_json_count"), 0),
                tracked=as_int(gate_assembly_roundtrip_ctest.get("import_assembly_tracked_count"), 0),
                groups=as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_count"), 0),
                group_sources=fmt_proxy_kind_counts(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_counts_b64")),
            group_source_cases=as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_case_count"), 0),
            group_source_case_details=fmt_group_source_case_details(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_case_details_b64")),
            group_layouts=fmt_proxy_layout_kind_counts(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_counts_b64")),
            group_layout_cases=as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_case_count"), 0),
            group_layout_case_details=fmt_group_layout_case_details(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_case_details_b64")),
            proxies=as_int(gate_assembly_roundtrip_ctest.get("import_derived_proxy_count"), 0),
                proxy_kinds=fmt_proxy_kind_counts(gate_assembly_roundtrip_ctest.get("import_proxy_kind_counts_b64")),
                proxy_kind_cases=as_int(gate_assembly_roundtrip_ctest.get("import_proxy_kind_case_count"), 0),
                proxy_kind_case_details=fmt_proxy_kind_case_details(gate_assembly_roundtrip_ctest.get("import_proxy_kind_case_details_b64")),
                proxy_layouts=fmt_proxy_layout_kind_counts(gate_assembly_roundtrip_ctest.get("import_proxy_layout_kind_counts_b64")),
                proxy_layout_cases=as_int(gate_assembly_roundtrip_ctest.get("import_proxy_layout_case_count"), 0),
                proxy_layout_case_details=fmt_proxy_layout_case_details(gate_assembly_roundtrip_ctest.get("import_proxy_layout_case_details_b64")),
                text_kinds=fmt_proxy_kind_counts(gate_assembly_roundtrip_ctest.get("import_text_kind_counts_b64")),
                text_kind_layouts=fmt_proxy_layout_kind_counts(gate_assembly_roundtrip_ctest.get("import_text_kind_layout_counts_b64")),
                text_kind_cases=as_int(gate_assembly_roundtrip_ctest.get("import_text_kind_case_count"), 0),
                text_kind_case_details=fmt_text_kind_case_details(gate_assembly_roundtrip_ctest.get("import_text_kind_case_details_b64")),
                exploded=as_int(gate_assembly_roundtrip_ctest.get("import_exploded_origin_count"), 0),
                exploded_layouts=fmt_proxy_layout_kind_counts(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_counts_b64")),
                exploded_layout_cases=as_int(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_case_count"), 0),
                exploded_layout_case_details=fmt_exploded_layout_case_details(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_case_details_b64")),
                viewports=as_int(gate_assembly_roundtrip_ctest.get("import_viewport_count"), 0),
                viewport_layouts=as_int(gate_assembly_roundtrip_ctest.get("import_viewport_layout_count"), 0),
                viewport_cases=as_int(gate_assembly_roundtrip_ctest.get("import_viewport_case_count"), 0),
                viewport_detail_cases=fmt_viewport_case_details(gate_assembly_roundtrip_ctest.get("import_viewport_case_details_b64")),
                viewport_proxy_kinds=fmt_proxy_kind_counts(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_kind_counts_b64")),
                viewport_proxy_layouts=fmt_proxy_layout_kind_counts(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_layout_kind_counts_b64")),
                viewport_proxy_cases=as_int(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_case_count"), 0),
                viewport_proxy_case_details=fmt_viewport_proxy_case_details(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_case_details_b64")),
                checked=as_int(gate_assembly_roundtrip_ctest.get("export_assembly_checked_count"), 0),
                metadata_drift=as_int(gate_assembly_roundtrip_ctest.get("export_metadata_drift_count"), 0),
                group_drift=as_int(gate_assembly_roundtrip_ctest.get("export_group_drift_count"), 0),
                first_failed=str(gate_assembly_roundtrip_ctest.get("first_failed_case") or "-"),
            )
        )
    if gate_preview_artifact_injection.get("enabled"):
        lines.append(
            "- gate_preview_artifact_validator_failure_injection: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
                status=str(gate_preview_artifact_injection.get("status") or ""),
                run_id=str(gate_preview_artifact_injection.get("run_id") or ""),
                cases=as_int(gate_preview_artifact_injection.get("case_count"), 0),
                ok_count=as_int(gate_preview_artifact_injection.get("pass_count"), 0),
                fail_count=as_int(gate_preview_artifact_injection.get("fail_count"), 0),
                first_failed=str(gate_preview_artifact_injection.get("first_failed_case") or "-"),
            )
        )
    if weekly_legacy_preview_artifact_prep.get("enabled"):
        lines.append(
            "- weekly_legacy_preview_artifact_prep: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing_input={missing_input}` `missing_manifest={missing_manifest}` `first_failed_case={first_failed}`".format(
                status=str(weekly_legacy_preview_artifact_prep.get("status") or ""),
                run_id=str(weekly_legacy_preview_artifact_prep.get("run_id") or ""),
                cases=as_int(weekly_legacy_preview_artifact_prep.get("case_count"), 0),
                ok_count=as_int(weekly_legacy_preview_artifact_prep.get("pass_count"), 0),
                fail_count=as_int(weekly_legacy_preview_artifact_prep.get("fail_count"), 0),
                missing_input=as_int(weekly_legacy_preview_artifact_prep.get("missing_input_count"), 0),
                missing_manifest=as_int(weekly_legacy_preview_artifact_prep.get("missing_manifest_count"), 0),
                first_failed=str(weekly_legacy_preview_artifact_prep.get("first_failed_case") or "-"),
            )
        )
    if weekly_legacy_preview_artifact.get("enabled"):
        lines.append(
            "- weekly_legacy_preview_artifact_smoke: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing_targets={missing}` `first_failed_case={first_failed}`".format(
                status=str(weekly_legacy_preview_artifact.get("status") or ""),
                run_id=str(weekly_legacy_preview_artifact.get("run_id") or ""),
                cases=as_int(weekly_legacy_preview_artifact.get("case_count"), 0),
                ok_count=as_int(weekly_legacy_preview_artifact.get("pass_count"), 0),
                fail_count=as_int(weekly_legacy_preview_artifact.get("fail_count"), 0),
                missing=as_int(weekly_legacy_preview_artifact.get("missing_target_count"), 0),
                first_failed=str(weekly_legacy_preview_artifact.get("first_failed_case") or "-"),
            )
        )
    gate_qt = as_dict(gate.get("qt_project_persistence"))
    if gate_qt:
        lines.append(
            "- gate_qt_project_persistence: `status={status}` `mode={mode}` `gate_required={required}` `require_on={require_on}` run_id=`{run_id}` reason=`{reason}`".format(
                status=str(gate_qt.get("status") or ""),
                mode=str(gate_qt.get("mode") or "skipped"),
                required=bool(gate_qt.get("gate_required", False)),
                require_on=bool(gate_qt.get("require_on", False)),
                run_id=str(gate_qt.get("run_id") or ""),
                reason=str(gate_qt.get("reason") or ""),
            )
        )
        lines.append(
            "- gate_qt_project_persistence_build: `dir={build_dir}` `BUILD_EDITOR_QT={flag}` `target_available={target}` `script_rc={script}` `build_rc={build}` `test_rc={test}`".format(
                build_dir=str(gate_qt.get("build_dir") or ""),
                flag=str(gate_qt.get("build_editor_qt") or ""),
                target=bool(gate_qt.get("target_available", False)),
                script=as_int(gate_qt.get("exit_code"), 0),
                build=as_int(gate_qt.get("build_exit_code"), 0),
                test=as_int(gate_qt.get("test_exit_code"), 0),
            )
        )
    lines.append(f"- trend: `{trend.get('status','')}`")
    if ui_flow_stage_trend:
        lines.append(
            "- ui_flow_stage_trend: `{status}` `recommended_gate_mode={mode}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
                status=str(ui_flow_stage_trend.get("status") or ""),
                mode=str(ui_flow_stage_trend.get("recommended_gate_mode") or "observe"),
                enabled=as_int(ui_flow_stage_trend.get("enabled_samples_in_window"), 0),
                fail_ratio=as_float(ui_flow_stage_trend.get("fail_ratio")) or 0.0,
                attr_ratio=as_float(ui_flow_stage_trend.get("attribution_ratio")) or 0.0,
            )
        )
        stage_counts = as_dict(ui_flow_stage_trend.get("failure_stage_counts"))
        if stage_counts:
            parts = [f"{k}={as_int(stage_counts.get(k), 0)}" for k in sorted(stage_counts.keys()) if as_int(stage_counts.get(k), 0) > 0]
            if parts:
                lines.append(f"- ui_flow_stage_trend_counts: `{' '.join(parts)}`")
        first_stage_counts = as_dict(ui_flow_stage_trend.get("first_failure_stage_counts"))
        if first_stage_counts:
            parts = [f"{k}={as_int(first_stage_counts.get(k), 0)}" for k in sorted(first_stage_counts.keys()) if as_int(first_stage_counts.get(k), 0) > 0]
            if parts:
                lines.append(f"- ui_flow_stage_trend_first_stage_counts: `{' '.join(parts)}`")
    perf_extra = []
    if perf_trend.get("auto_gate_mode"):
        perf_extra.append(f"auto_gate_mode=`{perf_trend.get('auto_gate_mode','')}`")
    cov = as_float(perf_trend.get("coverage_days"))
    if cov is not None:
        perf_extra.append(f"coverage_days=`{cov:.2f}`")
    sel = perf_trend.get("selected_samples_in_window")
    if isinstance(sel, int):
        perf_extra.append(f"selected=`{sel}`")
    if perf_trend.get("selection_mode"):
        perf_extra.append(f"selection_mode=`{perf_trend.get('selection_mode','')}`")
    perf_suffix = f" ({', '.join(perf_extra)})" if perf_extra else ""
    lines.append(f"- perf_trend: `{perf_trend.get('status','')}`{perf_suffix}")
    perf_policy = resolve_trend_policy(weekly_path, perf_trend)
    perf_ratio = as_dict(perf_policy.get("ratio_thresholds"))
    perf_abs = as_dict(perf_policy.get("absolute_triggers_ms"))
    if perf_ratio:
        lines.append(
            "- perf_trend_thresholds: "
            "`ratio pick={pick}` `box={box}` `drag={drag}`".format(
                pick=perf_ratio.get("pick_p95", ""),
                box=perf_ratio.get("box_p95", ""),
                drag=perf_ratio.get("drag_p95", ""),
            )
        )
    if perf_abs:
        lines.append(f"- perf_trend_hotspot: `box_p95_ms={perf_abs.get('box_p95_hotspot', '')}`")
    if real_scene_trend:
        extra = []
        if real_scene_trend.get("auto_gate_mode"):
            extra.append(f"auto_gate_mode=`{real_scene_trend.get('auto_gate_mode','')}`")
        cov = as_float(real_scene_trend.get("coverage_days"))
        if cov is not None:
            extra.append(f"coverage_days=`{cov:.2f}`")
        sel = real_scene_trend.get("selected_samples_in_window")
        if isinstance(sel, int):
            extra.append(f"selected=`{sel}`")
        if real_scene_trend.get("selection_mode"):
            extra.append(f"selection_mode=`{real_scene_trend.get('selection_mode','')}`")
        suffix = f" ({', '.join(extra)})" if extra else ""
        lines.append(f"- real_scene_trend: `{real_scene_trend.get('status','')}`{suffix}")
        scene_policy = resolve_trend_policy(weekly_path, real_scene_trend)
        scene_ratio = as_dict(scene_policy.get("ratio_thresholds"))
        scene_abs = as_dict(scene_policy.get("absolute_triggers_ms"))
        if scene_ratio:
            lines.append(
                "- real_scene_trend_thresholds: "
                "`ratio pick={pick}` `box={box}` `drag={drag}`".format(
                    pick=scene_ratio.get("pick_p95", ""),
                    box=scene_ratio.get("box_p95", ""),
                    drag=scene_ratio.get("drag_p95", ""),
                )
            )
        if scene_abs:
            lines.append(f"- real_scene_trend_hotspot: `box_p95_ms={scene_abs.get('box_p95_hotspot', '')}`")
    if case_selection_trend:
        lines.append(
            "- case_selection_trend: `{status}` windows=`{windows}` samples_total=`{samples}` mismatch_runs=`{mismatch_runs}` mismatch_rate_max=`{mismatch_rate:.3f}`".format(
                status=str(case_selection_trend.get("status") or ""),
                windows=str(case_selection_trend.get("windows") or ""),
                samples=as_int(case_selection_trend.get("samples_total"), 0),
                mismatch_runs=as_int(case_selection_trend.get("generated_count_mismatch_runs_total"), 0),
                mismatch_rate=as_float(case_selection_trend.get("generated_count_mismatch_rate_max")) or 0.0,
            )
        )
        warning_codes = case_selection_trend.get("warning_codes")
        if isinstance(warning_codes, list) and warning_codes:
            lines.append(f"- case_selection_trend_warning_codes: `{','.join(str(x) for x in warning_codes if str(x).strip())}`")
        window_rows = case_selection_trend.get("window_summaries")
        if isinstance(window_rows, list) and window_rows:
            parts = []
            for row in window_rows:
                if not isinstance(row, dict):
                    continue
                days = as_int(row.get("days"), 0)
                matched_ratio = as_float(row.get("matched_ratio"))
                fallback_rate = as_float(row.get("fallback_rate"))
                mismatch_rate = as_float(row.get("generated_count_mismatch_rate"))
                risky_source_rate = as_float(row.get("risky_source_rate"))
                samples = as_int(row.get("samples_with_selection"), 0)
                source_counts = as_dict(row.get("source_counts"))
                if matched_ratio is None:
                    matched_ratio = 0.0
                if fallback_rate is None:
                    fallback_rate = 0.0
                if mismatch_rate is None:
                    mismatch_rate = 0.0
                if risky_source_rate is None:
                    risky_source_rate = 0.0
                source_text = "-"
                if source_counts:
                    source_text = "/".join(
                        f"{key}:{as_int(source_counts.get(key), 0)}" for key in sorted(source_counts.keys())
                    )
                parts.append(
                    f"{days}d:m={matched_ratio:.3f},fb={fallback_rate:.3f},mm={mismatch_rate:.3f},rs={risky_source_rate:.3f},n={samples},src={source_text}"
                )
            if parts:
                lines.append(f"- case_selection_trend_windows: `{' | '.join(parts)}`")
    if parallel_cycle.get("enabled"):
        pc_gate = as_dict(parallel_cycle.get("gate_decision"))
        pc_lane_b = as_dict(as_dict(parallel_cycle.get("lanes")).get("lane_b"))
        pc_lane_b_ui = as_dict(pc_lane_b.get("ui_flow"))
        pc_reasons = [str(x) for x in as_list(pc_gate.get("fail_reasons")) if str(x).strip()]
        pc_warnings = [str(x) for x in as_list(pc_gate.get("warning_codes")) if str(x).strip()]
        pc_codes = as_dict(pc_gate.get("failure_code_counts"))
        lines.append(
            "- parallel_cycle: `status={status}` `run_id={run_id}` `decision={decision}` `raw={raw}` `should_merge={merge}` `watch_escalated={watch_escalated}` `watch_policy={watch}` `duration_sec={duration}`".format(
                status=str(parallel_cycle.get("status") or ""),
                run_id=str(parallel_cycle.get("run_id") or ""),
                decision=str(pc_gate.get("decision") or parallel_cycle.get("gate_decision_raw") or ""),
                raw=str(pc_gate.get("raw_decision") or ""),
                merge=bool(pc_gate.get("should_merge", False)),
                watch_escalated=bool(pc_gate.get("watch_escalated", False)),
                watch=str(parallel_cycle.get("watch_policy") or ""),
                duration=as_int(parallel_cycle.get("duration_sec"), 0),
            )
        )
        lines.append(
            "- parallel_cycle_gate: `weekly_policy={weekly}` `fail_reasons={reasons}` `warning_codes={warnings}`".format(
                weekly=str(inputs.get("weekly_parallel_decision_policy") or "observe"),
                reasons=(" ".join(pc_reasons) if pc_reasons else "-"),
                warnings=(" ".join(pc_warnings) if pc_warnings else "-"),
            )
        )
        if pc_codes:
            lines.append("- parallel_cycle_failure_codes: `" + " ".join([f"{k}={pc_codes[k]}" for k in sorted(pc_codes.keys())]) + "`")
        if pc_lane_b:
            lines.append(
                "- parallel_lane_b: `status={status}` `rc={rc}` `duration_sec={duration}` `node_test_duration_sec={node}`".format(
                    status=str(pc_lane_b.get("status") or ""),
                    rc=as_int(pc_lane_b.get("rc"), 0),
                    duration=as_int(pc_lane_b.get("duration_sec"), 0),
                    node=as_int(pc_lane_b.get("node_test_duration_sec"), 0),
                )
            )
        if pc_lane_b_ui:
            pc_stage_counts = as_dict(pc_lane_b_ui.get("failure_stage_counts"))
            lines.append(
                "- parallel_lane_b_ui_flow: `enabled={enabled}` `mode={mode}` `status={status}` `timeout_ms={timeout}` `attribution_complete={attr}` `interaction_complete={interaction}`".format(
                    enabled=bool(pc_lane_b_ui.get("enabled", False)),
                    mode=str(pc_lane_b_ui.get("mode") or ""),
                    status=str(pc_lane_b_ui.get("status") or ""),
                    timeout=as_int(pc_lane_b_ui.get("timeout_ms"), 0),
                    attr=bool(pc_lane_b_ui.get("failure_attribution_complete", True)),
                    interaction=bool(pc_lane_b_ui.get("interaction_checks_complete", False)),
                )
            )
            lines.append(
                "  - lane_b_ui_flow_setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `failure_stage={stage}`".format(
                    open_rc=as_int(pc_lane_b_ui.get("open_exit_code"), 0),
                    resize_rc=as_int(pc_lane_b_ui.get("resize_exit_code"), 0),
                    run_rc=as_int(pc_lane_b_ui.get("run_code_exit_code"), 0),
                    stage=str(pc_lane_b_ui.get("failure_stage") or "-"),
                )
            )
            if str(pc_lane_b_ui.get("failure_code") or "").strip():
                lines.append(f"  - lane_b_ui_flow_failure_code: `{str(pc_lane_b_ui.get('failure_code') or '')}`")
            if pc_stage_counts:
                parts = [f"{k}={pc_stage_counts[k]}" for k in sorted(pc_stage_counts.keys())]
                lines.append(f"  - lane_b_ui_flow_failure_stage_counts: `{' '.join(parts)}`")
            coverage = as_dict(pc_lane_b_ui.get("interaction_checks_coverage"))
            if coverage:
                parts = [f"{k}={str(bool(v)).lower()}" for k, v in sorted(coverage.items())]
                lines.append(f"  - lane_b_ui_flow_interaction_coverage: `{' '.join(parts)}`")
    lines.append("")
    lines.append("### Artifacts")
    lines.append(f"- editor_smoke_summary: {fmt_path(str(editor_smoke.get('summary_json','')))}")
    if ui_flow.get("enabled"):
        lines.append(f"- ui_flow_smoke_summary: {fmt_path(str(ui_flow.get('summary_json','')))}")
    if ui_flow_failure_injection.get("enabled"):
        lines.append(f"- ui_flow_failure_injection_summary: {fmt_path(str(ui_flow_failure_injection.get('summary_json','')))}")
    lines.append(f"- step166_summary: {fmt_path(str(step166.get('summary_json','')))}")
    lines.append(f"- perf_summary: {fmt_path(str(perf.get('summary_json','')))}")
    if str(real_scene.get("summary_json") or ""):
        lines.append(f"- real_scene_perf_summary: {fmt_path(str(real_scene.get('summary_json','')))}")
    if str(gate.get("summary_json") or ""):
        lines.append(f"- gate_summary: {fmt_path(str(gate.get('summary_json','')))}")
    if gate_editor_injection.get("enabled"):
        lines.append(f"- gate_editor_smoke_failure_injection_summary: {fmt_path(str(gate_editor_injection.get('summary_json','')))}")
    if str(gate_qt.get("summary_json") or ""):
        lines.append(f"- gate_qt_project_persistence_summary: {fmt_path(str(gate_qt.get('summary_json','')))}")
    if str(trend.get("summary_json") or ""):
        lines.append(f"- trend_json: {fmt_path(str(trend.get('summary_json','')))}")
    if str(ui_flow_stage_trend.get("summary_json") or ""):
        lines.append(f"- ui_flow_stage_trend_json: {fmt_path(str(ui_flow_stage_trend.get('summary_json','')))}")
    if str(perf_trend.get("summary_json") or ""):
        lines.append(f"- perf_trend_json: {fmt_path(str(perf_trend.get('summary_json','')))}")
    if str(real_scene_trend.get("summary_json") or ""):
        lines.append(f"- real_scene_trend_json: {fmt_path(str(real_scene_trend.get('summary_json','')))}")
    if str(case_selection_trend.get("summary_json") or ""):
        lines.append(f"- case_selection_trend_json: {fmt_path(str(case_selection_trend.get('summary_json','')))}")
    if str(qt_policy.get("summary_json") or ""):
        lines.append(f"- qt_persistence_policy_json: {fmt_path(str(qt_policy.get('summary_json','')))}")
    if str(parallel_cycle.get("summary_json") or ""):
        lines.append(f"- parallel_cycle_summary_json: {fmt_path(str(parallel_cycle.get('summary_json','')))}")
    if str(parallel_cycle.get("summary_md") or ""):
        lines.append(f"- parallel_cycle_summary_md: {fmt_path(str(parallel_cycle.get('summary_md','')))}")
    lines.append("")

    if step166_import_meta:
        lines.append("### STEP166 Import Meta (DXF)")
        lines.append(f"- hatch_pattern_clamped_cases: `{as_int(step166_import_meta.get('hatch_pattern_clamped_cases'), 0)}`")
        lines.append(
            f"- hatch_pattern_clamped_hatches_total: `{as_int(step166_import_meta.get('hatch_pattern_clamped_hatches_total'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_emitted_lines_total: `{as_int(step166_import_meta.get('hatch_pattern_emitted_lines_total'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_stride_max_max: `{as_int(step166_import_meta.get('hatch_pattern_stride_max_max'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_ksteps_limit_max: `{as_int(step166_import_meta.get('hatch_pattern_ksteps_limit_max'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_edge_budget_exhausted_cases: `{as_int(step166_import_meta.get('hatch_pattern_edge_budget_exhausted_cases'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_edge_budget_exhausted_hatches_total: `{as_int(step166_import_meta.get('hatch_pattern_edge_budget_exhausted_hatches_total'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_edge_checks_total: `{as_int(step166_import_meta.get('hatch_pattern_edge_checks_total'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_boundary_points_clamped_cases: `{as_int(step166_import_meta.get('hatch_pattern_boundary_points_clamped_cases'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_boundary_points_clamped_hatches_total: `{as_int(step166_import_meta.get('hatch_pattern_boundary_points_clamped_hatches_total'), 0)}`"
        )
        lines.append(
            f"- hatch_pattern_boundary_points_max_max: `{as_int(step166_import_meta.get('hatch_pattern_boundary_points_max_max'), 0)}`"
        )
        lines.append(f"- text_align_partial_cases: `{as_int(step166_import_meta.get('text_align_partial_cases'), 0)}`")
        lines.append(f"- text_align_partial_total: `{as_int(step166_import_meta.get('text_align_partial_total'), 0)}`")
        lines.append(f"- text_align_used_total: `{as_int(step166_import_meta.get('text_align_used_total'), 0)}`")
        lines.append(f"- text_nonfinite_values_total: `{as_int(step166_import_meta.get('text_nonfinite_values_total'), 0)}`")
        lines.append(f"- text_skipped_missing_xy_total: `{as_int(step166_import_meta.get('text_skipped_missing_xy_total'), 0)}`")
        lines.append("")

    if step166_sanity:
        lines.append("### STEP166 Sanity Warnings (Non-blocking)")
        lines.append(f"- cases_warned: `{as_int(step166_sanity.get('cases_warned'), 0)}`")
        code_counts = as_dict(step166_sanity.get("warning_code_counts"))
        if code_counts:
            items = []
            for key, val in code_counts.items():
                items.append((str(key), as_int(val, 0)))
            items.sort(key=lambda kv: (-kv[1], kv[0]))
            top = items[:5]
            lines.append("- top_warning_codes: " + ", ".join([f"`{k}`=`{v}`" for k, v in top]))
        lines.append("")

    perf_summary_path = str(perf.get("summary_json") or "")
    if perf_summary_path:
        perf_path = Path(perf_summary_path)
        if not perf_path.is_absolute():
            perf_path = weekly_path.parent.parent / perf_path
        perf_path = perf_path.resolve()
        p95 = pick_p95_from_perf_summary(perf_path)
        lines.append("### Perf p95 (best-effort)")
        lines.append(
            "- pick: `{:.6f}ms`, box_query: `{:.6f}ms`, drag_commit: `{:.6f}ms`".format(
                p95.get("pick_p95_ms", 0.0),
                p95.get("box_p95_ms", 0.0),
                p95.get("drag_p95_ms", 0.0),
            )
        )
        lines.append("")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
        fh.write("\n")

    print(f"appended_report={report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
