#!/usr/bin/env python3
"""
Generate a lightweight, human-readable dashboard for STEP176 from local history artifacts.

Inputs (auto-discovered by default):
- build/editor_gate_history/gate_*.json
- build/editor_weekly_validation_history/weekly_*.json

Output:
- docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md (default)

This dashboard is intentionally repo-local (no network) and should be treated as a
"status board" for engineers, not as a source-of-truth database.
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timezone
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
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
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
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
        pairs = []
        for key, raw_value in as_dict(item.get("text_kind_counts")).items():
            try:
                value = int(raw_value)
            except Exception:
                continue
            if value > 0:
                pairs.append((str(key), value))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        text_kinds = ", ".join(f"{key}:{value}" for key, value in pairs) if pairs else "-"
        parts.append(f"{lane}:{case_name}({text_kinds})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
        pairs = []
        for key, raw_value in as_dict(item.get("derived_proxy_kind_counts")).items():
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
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
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
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
        pairs = []
        for key, raw_value in as_dict(item.get("assembly_group_source_counts")).items():
            try:
                numeric = int(raw_value)
            except Exception:
                continue
            if numeric > 0:
                pairs.append((str(key), numeric))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        group_sources = ", ".join(f"{key}:{value}" for key, value in pairs) if pairs else "-"
        parts.append(f"{lane}:{case_name}({group_sources})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
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
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
        rendered = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("exploded_origin_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_counts(value: Any) -> str:
    counts = decode_b64_json_dict(value)
    pairs = []
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
        pairs = []
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


def as_str(value: Any) -> str:
    return str(value) if value is not None else ""


def as_float(value: Any) -> float | None:
    try:
        return float(value)
    except Exception:
        return None

def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def fmt_path(path: str) -> str:
    return f"`{path}`" if path else "`(missing)`"


def fmt_cov_sel(payload: dict[str, Any]) -> str:
    extra: list[str] = []
    cov = as_float(payload.get("coverage_days"))
    if cov is not None:
        extra.append(f"coverage_days={cov:.2f}")
    sel = payload.get("selected_samples_in_window")
    if isinstance(sel, int):
        extra.append(f"selected={sel}")
    mode = as_str(payload.get("selection_mode") or "")
    if mode:
        extra.append(f"selection_mode={mode}")
    return ", ".join(extra)


def resolve_weekly_gate_runtime(weekly_payload: dict[str, Any]) -> dict[str, Any]:
    runtime = as_dict(weekly_payload.get("gate_runtime"))
    if runtime:
        return {
            "profile": as_str(runtime.get("profile") or "<none>"),
            "step166_gate": bool(runtime.get("step166_gate", False)),
            "ui_flow_gate": bool(runtime.get("ui_flow_gate", False)),
            "convert_disabled": bool(runtime.get("convert_disabled", False)),
            "perf_trend": bool(runtime.get("perf_trend", False)),
            "real_scene_trend": bool(runtime.get("real_scene_trend", False)),
            "source": as_str(runtime.get("source") or "weekly.inputs"),
        }
    inputs = as_dict(weekly_payload.get("inputs"))
    gate = as_dict(weekly_payload.get("gate"))
    gate_inputs = as_dict(gate.get("inputs"))
    profile = as_str(inputs.get("gate_editor_profile") or gate_inputs.get("editor_gate_profile") or "")
    if not (profile or inputs or gate_inputs):
        return {}
    return {
        "profile": profile or "<none>",
        "step166_gate": bool(inputs.get("gate_run_step166_gate", gate_inputs.get("run_step166_gate", False))),
        "ui_flow_gate": bool(inputs.get("gate_run_editor_ui_flow_smoke_gate", gate_inputs.get("run_editor_ui_flow_smoke_gate", False))),
        "convert_disabled": bool(inputs.get("gate_editor_smoke_no_convert", gate_inputs.get("editor_smoke_no_convert", False))),
        "perf_trend": bool(inputs.get("gate_run_perf_trend", gate_inputs.get("run_perf_trend", False))),
        "real_scene_trend": bool(inputs.get("gate_run_real_scene_trend", gate_inputs.get("run_real_scene_trend", False))),
        "source": "weekly.inputs",
    }


def fmt_gate_runtime_compact(runtime_payload: dict[str, Any]) -> str:
    if not runtime_payload:
        return "n/a"
    return "p={profile} s166={step166} ui={ui_flow} conv={convert}".format(
        profile=as_str(runtime_payload.get("profile") or "<none>"),
        step166=1 if bool(runtime_payload.get("step166_gate", False)) else 0,
        ui_flow=1 if bool(runtime_payload.get("ui_flow_gate", False)) else 0,
        convert=1 if bool(runtime_payload.get("convert_disabled", False)) else 0,
    )


def collect_ui_flow_run_ids(ui_flow: dict[str, Any]) -> list[str]:
    direct = [as_str(x).strip() for x in as_list(ui_flow.get("run_ids")) if as_str(x).strip()]
    if direct:
        return direct
    out: list[str] = []
    for row in as_list(ui_flow.get("runs")):
        one = as_dict(row)
        run_id = as_str(one.get("run_id")).strip()
        if run_id:
            out.append(run_id)
    return out

def format_ui_flow_interaction_coverage(ui_flow: dict[str, Any], prefix: str = "ui_flow") -> str:
    coverage = as_dict(ui_flow.get("interaction_checks_coverage"))
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
    return "- {prefix}_interaction_checks: `{parts}` complete=`{complete}`".format(
        prefix=prefix,
        parts=" ".join(parts),
        complete=bool(ui_flow.get("interaction_checks_complete", False)),
    )

def fmt_ui_flow_setup_exits(ui_flow: dict[str, Any], prefix: str = "ui_flow") -> str:
    open_rc = as_int(ui_flow.get("open_exit_code"), 0)
    resize_rc = as_int(ui_flow.get("resize_exit_code"), 0)
    run_code_rc = as_int(ui_flow.get("run_code_exit_code"), 0)
    stage = as_str(ui_flow.get("first_failure_stage") or ui_flow.get("failure_stage")).strip()
    if not (open_rc or resize_rc or run_code_rc or stage):
        return ""
    return "- {prefix}_setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_code}` `stage={stage}`".format(
        prefix=prefix,
        open_rc=open_rc,
        resize_rc=resize_rc,
        run_code=run_code_rc,
        stage=(stage or "-"),
    )

def fmt_stage_counts(raw: dict[str, Any]) -> str:
    if not isinstance(raw, dict):
        return ""
    parts: list[str] = []
    for key in sorted(raw.keys()):
        count = as_int(raw.get(key), 0)
        if count > 0:
            parts.append(f"{key}={count}")
    return " ".join(parts)


def validate_ui_stage_trend_contract(payload: dict[str, Any]) -> tuple[bool, list[str]]:
    data = as_dict(payload)
    issues: list[str] = []
    days = as_int(data.get("days"), 0)
    status = as_str(data.get("status") or "").strip()
    mode = as_str(data.get("recommended_gate_mode") or "").strip()
    if days <= 0:
        issues.append("days<=0")
    if not status:
        issues.append("status_missing")
    if mode not in {"observe", "gate"}:
        issues.append("recommended_mode_invalid")
    if not as_str(data.get("summary_json") or "").strip():
        issues.append("summary_json_missing")
    if not as_str(data.get("summary_md") or "").strip():
        issues.append("summary_md_missing")
    if not isinstance(data.get("failure_stage_counts"), dict):
        issues.append("failure_stage_counts_invalid")
    if not isinstance(data.get("first_failure_stage_counts"), dict):
        issues.append("first_failure_stage_counts_invalid")
    if not isinstance(data.get("setup_exit_nonzero_runs"), dict):
        issues.append("setup_exit_nonzero_runs_invalid")
    return (len(issues) == 0, issues)


def list_history(dir_path: Path, pattern: str, limit: int) -> list[Path]:
    if not dir_path.exists():
        return []
    items = sorted(dir_path.glob(pattern))
    if limit <= 0:
        return items
    return items[-limit:]


def resolve_cli_path(raw: str, root: Path) -> Path:
    path = Path(str(raw or "").strip())
    if path.is_absolute():
        return path.resolve()
    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists() or cwd_candidate.parent.exists():
        return cwd_candidate
    return (root / path).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Write STEP176 dashboard from local history artifacts.")
    parser.add_argument("--gate-history-dir", default="build/editor_gate_history")
    parser.add_argument("--weekly-history-dir", default="build/editor_weekly_validation_history")
    parser.add_argument("--out", default="docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md")
    parser.add_argument("--max-gates", type=int, default=20)
    parser.add_argument("--max-weekly", type=int, default=20)
    args = parser.parse_args()

    root = WORKSPACE_ROOT
    gate_dir = resolve_cli_path(str(args.gate_history_dir), root)
    weekly_dir = resolve_cli_path(str(args.weekly_history_dir), root)
    out_path = resolve_cli_path(str(args.out), root)

    gate_files = list_history(gate_dir, "gate_*.json", int(args.max_gates))
    weekly_files = list_history(weekly_dir, "weekly_*.json", int(args.max_weekly))

    latest_gate = load_json(gate_files[-1]) if gate_files else {}
    latest_weekly = load_json(weekly_files[-1]) if weekly_files else {}

    now = datetime.now(timezone.utc).isoformat()
    lines: list[str] = []
    lines.append("# STEP176 Level A Dashboard")
    lines.append("")
    lines.append(f"- generated_at: `{now}`")
    lines.append(f"- gate_history_dir: {fmt_path(str(gate_dir))}")
    lines.append(f"- weekly_history_dir: {fmt_path(str(weekly_dir))}")
    lines.append("")

    lines.append("## Latest Gate")
    lines.append("")
    if latest_gate:
        gate_decision = as_dict(latest_gate.get("gate_decision"))
        gate_inputs = as_dict(latest_gate.get("inputs"))
        editor = as_dict(latest_gate.get("editor_smoke"))
        editor_inject = as_dict(latest_gate.get("editor_smoke_failure_injection"))
        ui_flow = as_dict(latest_gate.get("ui_flow_smoke"))
        ui_inject = as_dict(latest_gate.get("ui_flow_failure_injection"))
        qt_persistence = as_dict(latest_gate.get("qt_project_persistence"))
        step166 = as_dict(latest_gate.get("step166"))
        perf_trend = as_dict(latest_gate.get("perf_trend"))
        scene_trend = as_dict(latest_gate.get("real_scene_trend"))

        reasons = as_list(gate_decision.get("fail_reasons"))
        reasons_text = ", ".join([as_str(x) for x in reasons]) if reasons else ""
        editor_totals = as_dict(editor.get("totals"))
        editor_fail = int(editor_totals.get("fail") or 0)
        editor_pass = int(editor_totals.get("pass") or 0)
        editor_skip = int(editor_totals.get("skipped") or 0)
        editor_status = "FAIL" if editor_fail > 0 else "PASS"

        lines.append(f"- generated_at: `{as_str(latest_gate.get('generated_at'))}`")
        lines.append(f"- gate_decision: would_fail=`{gate_decision.get('would_fail', False)}` exit_code=`{gate_decision.get('exit_code', '')}`{f' reasons=`{reasons_text}`' if reasons_text else ''}")
        if gate_inputs:
            lines.append(
                "- gate_inputs: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}`".format(
                    profile=as_str(gate_inputs.get("editor_gate_profile") or "<none>"),
                    step166=bool(gate_inputs.get("run_step166_gate", False)),
                    ui_flow=bool(gate_inputs.get("run_editor_ui_flow_smoke_gate", False)),
                    convert=bool(gate_inputs.get("editor_smoke_no_convert", False)),
                    perf=bool(gate_inputs.get("run_perf_trend", False)),
                    real_scene=bool(gate_inputs.get("run_real_scene_trend", False)),
                )
            )
        lines.append(
            "- editor_smoke_run_id: `{run_id}` status=`{status}` pass=`{ok}` fail=`{fail}` skipped=`{skip}`".format(
                run_id=as_str(editor.get("run_id")),
                status=editor_status,
                ok=editor_pass,
                fail=editor_fail,
                skip=editor_skip,
            )
        )
        lines.append(
            "- editor_smoke_cases: `source={source}` `cases={count}` `limit={limit}`".format(
                source=as_str(editor.get("case_source") or "discovery"),
                count=as_int(editor.get("cases_count"), 0),
                limit=as_int(editor.get("limit"), 0),
            )
        )
        generated_count = as_int(editor.get("generated_count"), 0)
        generated_declared = as_int(editor.get("generated_count_declared"), generated_count)
        generated_actual = as_int(editor.get("generated_count_actual"), generated_count)
        generated_mismatch = bool(editor.get("generated_count_mismatch", generated_declared != generated_actual))
        generated_mismatch_policy = as_str(editor.get("generated_count_mismatch_policy") or "warn")
        generated_mismatch_gate_fail = bool(editor.get("generated_count_mismatch_gate_fail", False))
        if (
            generated_count > 0
            or generated_declared > 0
            or generated_actual > 0
            or generated_mismatch
            or as_str(editor.get("generated_run_id"))
            or as_list(editor.get("generated_run_ids"))
        ):
            generated_run_ids = [as_str(x) for x in as_list(editor.get("generated_run_ids")) if as_str(x)]
            lines.append(
                "- editor_smoke_generated: `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `run_id={run_id}` `run_ids={run_ids}`".format(
                    count=generated_count,
                    declared=generated_declared,
                    actual=generated_actual,
                    mismatch=generated_mismatch,
                    min_cases=as_int(editor.get("generated_min_cases"), 0),
                    run_id=as_str(editor.get("generated_run_id")) or "-",
                    run_ids=",".join(generated_run_ids) if generated_run_ids else "-",
                )
            )
            lines.append(
                "- editor_smoke_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                    policy=generated_mismatch_policy,
                    gate_fail=generated_mismatch_gate_fail,
                )
            )
        editor_selection = as_dict(editor.get("case_selection"))
        if editor_selection:
            lines.append(
                "- editor_smoke_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
                    selected=as_int(editor_selection.get("selected_count"), 0),
                    matched=as_int(editor_selection.get("matched_count"), 0),
                    candidate=as_int(editor_selection.get("filtered_count"), 0),
                    total=as_int(editor_selection.get("total_input"), 0),
                    fallback=bool(editor_selection.get("used_fallback", False)),
                )
            )
        editor_buckets = as_dict(editor.get("failure_buckets"))
        if editor_buckets:
            bucket_parts = []
            for key in ("INPUT_INVALID", "IMPORT_FAIL", "RENDER_DRIFT", "VIEWPORT_LAYOUT_MISSING", "TEXT_METRIC_DRIFT"):
                count = int(editor_buckets.get(key) or 0)
                if count > 0:
                    bucket_parts.append(f"{key}={count}")
            if bucket_parts:
                lines.append(f"- editor_smoke_failure_buckets: `{' '.join(bucket_parts)}`")
        editor_codes = as_dict(editor.get("failure_code_counts"))
        if editor_codes:
            parts = [f"{k}={editor_codes[k]}" for k in sorted(editor_codes.keys())]
            lines.append(f"- editor_smoke_failure_codes: `{' '.join(parts)}`")
        if editor_inject.get("enabled"):
            detail = as_str(editor_inject.get("failure_detail"))
            if len(detail) > 180:
                detail = detail[:180] + "..."
            lines.append(
                "- editor_smoke_injection: status=`{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                    status=as_str(editor_inject.get("status")),
                    run_id=as_str(editor_inject.get("run_id")),
                    code=as_str(editor_inject.get("failure_code")),
                    detail=detail,
                )
            )
        if ui_flow.get("enabled"):
            ui_port = as_dict(ui_flow.get("port_allocation"))
            ui_run_ids = collect_ui_flow_run_ids(ui_flow)
            lines.append(
                "- ui_flow_smoke: mode=`{mode}` ok=`{ok}` gate_runs=`{runs}/{target}` fail=`{fail}`".format(
                    mode=as_str(ui_flow.get("mode")),
                    ok=ui_flow.get("ok", False),
                    runs=ui_flow.get("gate_run_count", 0),
                    target=ui_flow.get("gate_runs_target", 0),
                    fail=ui_flow.get("gate_fail_count", 0),
                )
            )
            if ui_run_ids:
                lines.append(f"- ui_flow_run_ids: `{' '.join(ui_run_ids)}`")
            lines.append(
                "- ui_flow_gate_required: required=`{required}` explicit=`{explicit}`".format(
                    required=ui_flow.get("gate_required", False),
                    explicit=ui_flow.get("gate_required_explicit", False),
                )
            )
            if ui_port:
                lines.append(
                    "- ui_flow_port_allocation: available=`{available}` status=`{status}` reason=`{reason}`".format(
                        available=as_str(ui_port.get("available")),
                        status=as_str(ui_port.get("status")),
                        reason=as_str(ui_port.get("reason")),
                    )
                )
            code_counts = as_dict(ui_flow.get("failure_code_counts"))
            if code_counts:
                parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
                lines.append(f"- ui_flow_failure_codes: `{' '.join(parts)}`")
            stage_counts = fmt_stage_counts(as_dict(ui_flow.get("failure_stage_counts")))
            if stage_counts:
                lines.append(f"- ui_flow_failure_stages: `{stage_counts}`")
            setup_line = fmt_ui_flow_setup_exits(ui_flow, "ui_flow")
            if setup_line:
                lines.append(setup_line)
            interaction_line = format_ui_flow_interaction_coverage(ui_flow, "ui_flow")
            if interaction_line:
                lines.append(interaction_line)
        elif ui_flow.get("gate_required") or as_dict(ui_flow.get("port_allocation")):
            ui_port = as_dict(ui_flow.get("port_allocation"))
            lines.append(
                "- ui_flow_smoke: mode=`{mode}` enabled=`{enabled}` ok=`{ok}`".format(
                    mode=as_str(ui_flow.get("mode") or "skipped"),
                    enabled=ui_flow.get("enabled", False),
                    ok=ui_flow.get("ok", False),
                )
            )
            lines.append(
                "- ui_flow_gate_required: required=`{required}` explicit=`{explicit}`".format(
                    required=ui_flow.get("gate_required", False),
                    explicit=ui_flow.get("gate_required_explicit", False),
                )
            )
            if ui_port:
                lines.append(
                    "- ui_flow_port_allocation: available=`{available}` status=`{status}` reason=`{reason}`".format(
                        available=as_str(ui_port.get("available")),
                        status=as_str(ui_port.get("status")),
                        reason=as_str(ui_port.get("reason")),
                    )
                )
            stage_counts = fmt_stage_counts(as_dict(ui_flow.get("failure_stage_counts")))
            if stage_counts:
                lines.append(f"- ui_flow_failure_stages: `{stage_counts}`")
            setup_line = fmt_ui_flow_setup_exits(ui_flow, "ui_flow")
            if setup_line:
                lines.append(setup_line)
            interaction_line = format_ui_flow_interaction_coverage(ui_flow, "ui_flow")
            if interaction_line:
                lines.append(interaction_line)
        if ui_inject.get("enabled"):
            detail = as_str(ui_inject.get("failure_detail"))
            if len(detail) > 180:
                detail = detail[:180] + "..."
            lines.append(
                "- ui_flow_injection: status=`{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                    status=as_str(ui_inject.get("status")),
                    run_id=as_str(ui_inject.get("run_id")),
                    code=as_str(ui_inject.get("failure_code")),
                    detail=detail,
                )
            )
        if qt_persistence:
            lines.append(
                "- qt_project_persistence: status=`{status}` mode=`{mode}` gate_required=`{required}` reason=`{reason}` run_id=`{run_id}`".format(
                    status=as_str(qt_persistence.get("status")),
                    mode=as_str(qt_persistence.get("mode") or "skipped"),
                    required=qt_persistence.get("gate_required", False),
                    reason=as_str(qt_persistence.get("reason")),
                    run_id=as_str(qt_persistence.get("run_id")),
                )
            )
            lines.append(
                "- qt_project_persistence_build: dir=`{build_dir}` BUILD_EDITOR_QT=`{flag}` target_available=`{target}` script_rc=`{script}` build_rc=`{build}` test_rc=`{test}`".format(
                    build_dir=as_str(qt_persistence.get("build_dir")),
                    flag=as_str(qt_persistence.get("build_editor_qt")),
                    target=qt_persistence.get("target_available", False),
                    script=qt_persistence.get("exit_code", 0),
                    build=qt_persistence.get("build_exit_code", 0),
                    test=qt_persistence.get("test_exit_code", 0),
                )
            )
        lines.append(f"- step166_run_id: `{as_str(step166.get('run_id'))}` (gate_would_fail=`{as_dict(step166.get('gate_decision')).get('would_fail', False)}`)")
        if perf_trend:
            lines.append(
                f"- perf_trend: `{as_str(perf_trend.get('status'))}` (mode=`{as_str(perf_trend.get('mode'))}` enabled=`{perf_trend.get('enabled', False)}`) ({fmt_cov_sel(perf_trend)})"
            )
        if scene_trend:
            lines.append(
                f"- real_scene_trend: `{as_str(scene_trend.get('status'))}` (mode=`{as_str(scene_trend.get('mode'))}` enabled=`{scene_trend.get('enabled', False)}`) ({fmt_cov_sel(scene_trend)})"
            )
        lines.append("")
        lines.append("### Artifacts")
        lines.append(f"- gate_summary_json: {fmt_path(str(gate_files[-1]))}")
        if as_str(editor.get("summary_json")):
            lines.append(f"- editor_smoke_summary_json: {fmt_path(as_str(editor.get('summary_json')))}")
        if as_str(editor_inject.get("summary_json")):
            lines.append(f"- editor_smoke_injection_summary_json: {fmt_path(as_str(editor_inject.get('summary_json')))}")
        if as_str(ui_flow.get("summary_json")):
            lines.append(f"- ui_flow_summary_json: {fmt_path(as_str(ui_flow.get('summary_json')))}")
        if as_str(ui_inject.get("summary_json")):
            lines.append(f"- ui_flow_injection_summary_json: {fmt_path(as_str(ui_inject.get('summary_json')))}")
        if as_str(qt_persistence.get("summary_json")):
            lines.append(f"- qt_project_persistence_summary_json: {fmt_path(as_str(qt_persistence.get('summary_json')))}")
        if as_str(step166.get("summary_json")):
            lines.append(f"- step166_summary_json: {fmt_path(as_str(step166.get('summary_json')))}")
        if as_str(perf_trend.get("summary_json")):
            lines.append(f"- perf_trend_json: {fmt_path(as_str(perf_trend.get('summary_json')))}")
        if as_str(scene_trend.get("summary_json")):
            lines.append(f"- real_scene_trend_json: {fmt_path(as_str(scene_trend.get('summary_json')))}")
        lines.append("")
    else:
        lines.append("- (no gate history found yet)")
        lines.append("")

    lines.append("## Gate History (Recent)")
    lines.append("")
    if gate_files:
        lines.append("| generated_at | runtime | editor_smoke | editor_smoke_inject | ui_flow | ui_flow_inject | qt_persistence | step166 | gate_would_fail | perf_trend | real_scene_trend | would_fail | reasons |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
        for file_path in reversed(gate_files):
            gate = load_json(file_path)
            gate_inputs = as_dict(gate.get("inputs"))
            editor = as_dict(gate.get("editor_smoke"))
            editor_inject = as_dict(gate.get("editor_smoke_failure_injection"))
            ui_flow = as_dict(gate.get("ui_flow_smoke"))
            ui_inject = as_dict(gate.get("ui_flow_failure_injection"))
            qt_persistence = as_dict(gate.get("qt_project_persistence"))
            step166 = as_dict(gate.get("step166"))
            perf_trend = as_dict(gate.get("perf_trend"))
            scene_trend = as_dict(gate.get("real_scene_trend"))
            decision = as_dict(gate.get("gate_decision"))
            reasons = as_list(decision.get("fail_reasons"))
            reasons_text = ", ".join([as_str(x) for x in reasons]) if reasons else ""
            editor_totals = as_dict(editor.get("totals"))
            editor_fail = int(editor_totals.get("fail") or 0)
            editor_status = "fail" if editor_fail > 0 else "ok"
            editor_col = f"{as_str(editor.get('run_id') or '')}:{editor_status}({editor_fail})"
            editor_code = as_str(editor.get("first_failure_code") or "")
            if editor_code:
                editor_col += f":{editor_code}"
            editor_source = as_str(editor.get("case_source") or "")
            if editor_source:
                editor_col += f":src={editor_source}"
            generated_count = as_int(editor.get("generated_count"), 0)
            generated_declared = as_int(editor.get("generated_count_declared"), generated_count)
            generated_actual = as_int(editor.get("generated_count_actual"), generated_count)
            generated_mismatch = bool(editor.get("generated_count_mismatch", generated_declared != generated_actual))
            generated_policy = as_str(editor.get("generated_count_mismatch_policy") or "warn")
            generated_gate_fail = bool(editor.get("generated_count_mismatch_gate_fail", False))
            if generated_count > 0:
                editor_col += f":gen={generated_count}"
            if generated_mismatch:
                editor_col += f":gdec={generated_declared}:gact={generated_actual}"
            if generated_mismatch:
                editor_col += f":gpol={generated_policy}"
            if generated_gate_fail:
                editor_col += ":gfail=1"
            ui_mode = as_str(ui_flow.get("mode"))
            if ui_flow.get("enabled"):
                ui_ok = "ok" if ui_flow.get("ok") is True else "fail"
                ui_runs = int(ui_flow.get("gate_run_count") or 0)
                ui_target = int(ui_flow.get("gate_runs_target") or 0)
                ui_code = as_str(ui_flow.get("first_failure_code") or "")
                ui_stage = as_str(ui_flow.get("first_failure_stage") or "")
                ui_col = f"{ui_mode}:{ui_ok}({ui_runs}/{ui_target})"
                if ui_code:
                    ui_col += f":{ui_code}"
                if ui_stage:
                    ui_col += f":st={ui_stage}"
            else:
                ui_col = "skipped"
                if ui_flow.get("gate_required"):
                    req = "exp" if ui_flow.get("gate_required_explicit") else "imp"
                    ui_col += f":req={req}"
                ui_port = as_dict(ui_flow.get("port_allocation"))
                port_status = as_str(ui_port.get("status") or "")
                if port_status:
                    ui_col += f":{port_status}"
            ui_inject_col = "skipped"
            if ui_inject.get("enabled"):
                ui_inject_status = as_str(ui_inject.get("status"))
                ui_inject_code = as_str(ui_inject.get("failure_code"))
                ui_inject_col = f"{ui_inject_status}:{ui_inject_code}" if ui_inject_code else ui_inject_status
            editor_inject_col = "skipped"
            if editor_inject.get("enabled"):
                editor_inject_status = as_str(editor_inject.get("status"))
                editor_inject_code = as_str(editor_inject.get("failure_code"))
                editor_inject_col = f"{editor_inject_status}:{editor_inject_code}" if editor_inject_code else editor_inject_status
            qt_col = "skipped"
            if qt_persistence:
                qt_col = f"{as_str(qt_persistence.get('mode') or 'skipped')}:{as_str(qt_persistence.get('status') or '')}"
                reason = as_str(qt_persistence.get("reason") or "")
                if reason:
                    qt_col += f":{reason}"
            runtime_col = "n/a"
            if gate_inputs:
                runtime_col = "p={profile} s166={step166} ui={ui_flow} conv={convert}".format(
                    profile=as_str(gate_inputs.get("editor_gate_profile") or "<none>"),
                    step166=1 if bool(gate_inputs.get("run_step166_gate", False)) else 0,
                    ui_flow=1 if bool(gate_inputs.get("run_editor_ui_flow_smoke_gate", False)) else 0,
                    convert=1 if bool(gate_inputs.get("editor_smoke_no_convert", False)) else 0,
                )
            lines.append(
                "| {ts} | `{runtime}` | `{er}` | `{editor_inject}` | `{ui}` | `{inject}` | `{qt}` | `{cr}` | `{cad_fail}` | `{perf}` | `{scene}` | `{would_fail}` | {reasons} |".format(
                    ts=as_str(gate.get("generated_at") or ""),
                    runtime=runtime_col,
                    er=editor_col,
                    editor_inject=editor_inject_col,
                    ui=ui_col,
                    inject=ui_inject_col,
                    qt=qt_col,
                    cr=as_str(step166.get("run_id") or ""),
                    cad_fail=as_dict(step166.get("gate_decision")).get("would_fail", False),
                    perf=f"{as_str(perf_trend.get('mode'))}:{as_str(perf_trend.get('status'))}",
                    scene=f"{as_str(scene_trend.get('mode'))}:{as_str(scene_trend.get('status'))}",
                    would_fail=decision.get("would_fail", False),
                    reasons=f"`{reasons_text}`" if reasons_text else "",
                )
            )
        lines.append("")
    else:
        lines.append("- (no gate history found yet)")
        lines.append("")

    lines.append("## Weekly History (Recent)")
    lines.append("")
    if weekly_files:
        lines.append("| generated_at | editor_smoke | case_sel | ui_flow | ui_flow_inject | step166 | perf_run | gate | gate_runtime | qt_policy | trend(ui_stage) | perf_trend | real_scene_trend | parallel_cycle | real_scene_perf |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
        for file_path in reversed(weekly_files):
            weekly = load_json(file_path)
            inputs = as_dict(weekly.get("inputs"))
            editor = as_dict(weekly.get("editor_smoke"))
            ui_flow = as_dict(weekly.get("ui_flow_smoke"))
            ui_inject = as_dict(weekly.get("ui_flow_failure_injection"))
            step166 = as_dict(weekly.get("step166"))
            perf = as_dict(weekly.get("performance"))
            real_scene = as_dict(weekly.get("real_scene_perf"))
            gate = as_dict(weekly.get("gate"))
            parallel_cycle = as_dict(weekly.get("parallel_cycle"))
            gate_inputs = as_dict(gate.get("inputs"))
            gate_runtime_payload = resolve_weekly_gate_runtime(weekly)
            gate_step166 = as_dict(gate.get("step166"))
            qt_policy = as_dict(weekly.get("qt_project_persistence_policy"))
            trend = as_dict(weekly.get("trend"))
            ui_flow_stage_trend = as_dict(weekly.get("ui_flow_stage_trend"))
            perf_trend = as_dict(weekly.get("perf_trend"))
            scene_trend = as_dict(weekly.get("real_scene_trend"))
            case_selection_trend = as_dict(weekly.get("case_selection_trend"))
            editor_totals = as_dict(editor.get("totals"))
            editor_fail = int(editor_totals.get("fail") or 0)
            editor_status = as_str(editor.get("status") or ("FAIL" if editor_fail > 0 else "PASS"))
            editor_col = f"{as_str(editor.get('run_id') or '')}:{editor_status}({editor_fail})"
            editor_code = as_str(editor.get("first_failure_code") or "")
            if editor_code:
                editor_col += f":{editor_code}"
            editor_selection = as_dict(editor.get("case_selection"))
            editor_selection_col = "{source}:{selected}/{matched}/{total}{fallback}".format(
                source=as_str(inputs.get("editor_smoke_case_source") or "discovery"),
                selected=int(editor_selection.get("selected_count") or 0),
                matched=int(editor_selection.get("matched_count") or 0),
                total=int(editor_selection.get("total_input") or 0),
                fallback=":fb" if bool(editor_selection.get("used_fallback", False)) else "",
            )
            mismatch_runs_total = as_int(case_selection_trend.get("generated_count_mismatch_runs_total"), 0)
            if mismatch_runs_total > 0:
                editor_selection_col += f":mm={mismatch_runs_total}"
            ui_mode = as_str(ui_flow.get("mode"))
            if ui_flow.get("enabled"):
                ui_status = as_str(ui_flow.get("status"))
                ui_runs = int(ui_flow.get("gate_run_count") or 0)
                ui_target = int(ui_flow.get("gate_runs_target") or 0)
                ui_code = as_str(ui_flow.get("first_failure_code") or "")
                ui_stage = as_str(ui_flow.get("first_failure_stage") or "")
                ui_col = f"{ui_mode}:{ui_status}({ui_runs}/{ui_target})"
                if ui_code:
                    ui_col += f":{ui_code}"
                if ui_stage:
                    ui_col += f":st={ui_stage}"
            else:
                ui_col = "skipped"
                if ui_flow.get("gate_required"):
                    req = "exp" if ui_flow.get("gate_required_explicit") else "imp"
                    ui_col += f":req={req}"
                ui_port = as_dict(ui_flow.get("port_allocation"))
                port_status = as_str(ui_port.get("status") or "")
                if port_status:
                    ui_col += f":{port_status}"
            ui_inject_col = "skipped"
            if ui_inject.get("enabled"):
                ui_inject_status = as_str(ui_inject.get("status"))
                ui_inject_code = as_str(ui_inject.get("failure_code"))
                ui_inject_col = f"{ui_inject_status}:{ui_inject_code}" if ui_inject_code else ui_inject_status
            qt_policy_col = "n/a"
            if qt_policy:
                qt_policy_col = f"{as_str(qt_policy.get('status') or '')}:r{1 if qt_policy.get('recommended_require_on', False) else 0}->e{1 if qt_policy.get('effective_require_on', False) else 0}"
            step166_col = as_str(step166.get("run_id") or "")
            gate_step166_run = as_str(gate_step166.get("run_id") or "")
            if gate_step166_run:
                gate_step166_fail = as_dict(gate_step166.get("gate_decision")).get("would_fail", False)
                step166_col = f"obs={step166_col}|gate={gate_step166_run}:{gate_step166_fail}"
            gate_runtime_col = fmt_gate_runtime_compact(gate_runtime_payload)
            parallel_col = "skipped"
            if parallel_cycle.get("enabled"):
                parallel_gate = as_dict(parallel_cycle.get("gate_decision"))
                lane_b_ui = as_dict(as_dict(as_dict(parallel_cycle.get("lanes")).get("lane_b")).get("ui_flow"))
                decision = as_str(parallel_gate.get("decision") or parallel_cycle.get("gate_decision_raw") or "")
                weekly_policy = as_str(inputs.get("weekly_parallel_decision_policy") or "observe")
                lane_b_mode = as_str(lane_b_ui.get("mode") or "")
                lane_b_status = as_str(lane_b_ui.get("status") or "")
                lane_b_timeout = as_int(lane_b_ui.get("timeout_ms"), 0)
                lane_b_attr = bool(lane_b_ui.get("failure_attribution_complete", True))
                lane_b_interaction = bool(lane_b_ui.get("interaction_checks_complete", False))
                lane_b_stage = as_str(lane_b_ui.get("failure_stage") or "")
                parallel_col = (
                    f"{as_str(parallel_cycle.get('status') or '')}:{decision}"
                    f":p={weekly_policy}"
                    f":w{1 if bool(parallel_gate.get('watch_escalated', False)) else 0}"
                    f":lb={lane_b_mode}/{lane_b_status}"
                    f":t={lane_b_timeout}"
                    f":a{1 if lane_b_attr else 0}"
                    f":i{1 if lane_b_interaction else 0}"
                )
                if lane_b_stage:
                    parallel_col += f":s={lane_b_stage}"
            trend_col = as_str(trend.get("status") or "")
            if ui_flow_stage_trend:
                ui_stage_ok, _ui_stage_issues = validate_ui_stage_trend_contract(ui_flow_stage_trend)
                trend_col += " | ui:{status}/{mode}".format(
                    status=as_str(ui_flow_stage_trend.get("status") or ""),
                    mode=as_str(ui_flow_stage_trend.get("recommended_gate_mode") or "observe"),
                )
                if not ui_stage_ok:
                    trend_col += ":contract!"
            lines.append(
                "| {ts} | `{er}` | `{sel}` | `{ui}` | `{inject}` | `{cr}` | `{pr}` | `{gate}` | `{gate_runtime}` | `{qt}` | `{trend}` | `{perf_trend}` | `{scene_trend}` | `{parallel}` | `{scene}` |".format(
                    ts=as_str(weekly.get("generated_at") or ""),
                    er=editor_col,
                    sel=editor_selection_col,
                    ui=ui_col,
                    inject=ui_inject_col,
                    cr=step166_col,
                    pr=as_str(perf.get("run_id") or ""),
                    gate=as_str(gate.get("status") or ""),
                    gate_runtime=gate_runtime_col,
                    qt=qt_policy_col,
                    trend=trend_col,
                    perf_trend=f"{as_str(perf_trend.get('status'))}({as_str(perf_trend.get('auto_gate_mode') or '')})",
                    scene_trend=f"{as_str(scene_trend.get('status'))}({as_str(scene_trend.get('auto_gate_mode') or '')})",
                    parallel=parallel_col,
                    scene=as_str(real_scene.get("status") or ""),
                )
            )
        lines.append("")
        lines.append("### Latest Weekly Artifact")
        lines.append(f"- weekly_summary_json: {fmt_path(as_str(latest_weekly.get('history_json') or weekly_files[-1]))}")
        latest_runtime = resolve_weekly_gate_runtime(latest_weekly)
        if latest_runtime:
            lines.append(
                "- weekly_gate_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={scene}` `source={source}`".format(
                    profile=as_str(latest_runtime.get("profile") or "<none>"),
                    step166=bool(latest_runtime.get("step166_gate", False)),
                    ui_flow=bool(latest_runtime.get("ui_flow_gate", False)),
                    convert=bool(latest_runtime.get("convert_disabled", False)),
                    perf=bool(latest_runtime.get("perf_trend", False)),
                    scene=bool(latest_runtime.get("real_scene_trend", False)),
                    source=as_str(latest_runtime.get("source") or "weekly.inputs"),
                )
            )
        latest_ui_stage_trend = as_dict(latest_weekly.get("ui_flow_stage_trend"))
        if latest_ui_stage_trend:
            latest_ui_stage_ok, latest_ui_stage_issues = validate_ui_stage_trend_contract(latest_ui_stage_trend)
            lines.append(
                "- weekly_ui_flow_stage_trend: `status={status}` `recommended_gate_mode={mode}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
                    status=as_str(latest_ui_stage_trend.get("status") or ""),
                    mode=as_str(latest_ui_stage_trend.get("recommended_gate_mode") or "observe"),
                    enabled=as_int(latest_ui_stage_trend.get("enabled_samples_in_window"), 0),
                    fail_ratio=(as_float(latest_ui_stage_trend.get("fail_ratio")) or 0.0),
                    attr_ratio=(as_float(latest_ui_stage_trend.get("attribution_ratio")) or 0.0),
                )
            )
            lines.append(
                "- weekly_ui_flow_stage_trend_contract: `ok={ok}` `issues={issues}`".format(
                    ok=latest_ui_stage_ok,
                    issues=(" ".join(latest_ui_stage_issues) if latest_ui_stage_issues else "-"),
                )
            )
            latest_ui_stage_counts = as_dict(latest_ui_stage_trend.get("failure_stage_counts"))
            if latest_ui_stage_counts:
                parts = [
                    f"{k}={as_int(latest_ui_stage_counts.get(k), 0)}"
                    for k in sorted(latest_ui_stage_counts.keys())
                    if as_int(latest_ui_stage_counts.get(k), 0) > 0
                ]
                if parts:
                    lines.append(f"- weekly_ui_flow_stage_counts: `{' '.join(parts)}`")
        latest_gate_preview_provenance = as_dict(latest_weekly.get("gate_preview_provenance_smoke"))
        if latest_gate_preview_provenance.get("enabled"):
            lines.append(
                "- weekly_gate_preview_provenance_smoke: `mode={mode}` `ok={ok}` `cases={cases}` `pass={passed}` `fail={failed}` `entry={entry}` `focus_checks={focus_checks}` `run_id={run_id}`".format(
                    mode=as_str(latest_gate_preview_provenance.get("mode") or ""),
                    ok=bool(latest_gate_preview_provenance.get("ok", False)),
                    cases=as_int(latest_gate_preview_provenance.get("case_count"), 0),
                    passed=as_int(latest_gate_preview_provenance.get("pass_count"), 0),
                    failed=as_int(latest_gate_preview_provenance.get("fail_count"), 0),
                    entry="{}/{}".format(
                        as_int(
                            latest_gate_preview_provenance.get("deterministic_entry_case_count")
                            if latest_gate_preview_provenance.get("deterministic_entry_case_count") is not None
                            else latest_gate_preview_provenance.get("initial_entry_case_count"),
                            0,
                        ),
                        as_int(latest_gate_preview_provenance.get("case_count"), 0),
                    ),
                    focus_checks=as_int(latest_gate_preview_provenance.get("focus_check_case_count"), 0),
                    run_id=as_str(latest_gate_preview_provenance.get("run_id") or ""),
                )
            )
        latest_gate_dwg_open = as_dict(latest_weekly.get("gate_dwg_open_smoke"))
        if latest_gate_dwg_open.get("enabled"):
            lines.append(
                "- weekly_gate_dwg_open_smoke: `mode={mode}` `ok={ok}` `dwg_convert={dwg_convert}` `router={router}` `convert={convert}` `viewer={viewer}` `validators_ok={validators}` `run_id={run_id}`".format(
                    mode=as_str(latest_gate_dwg_open.get("mode") or ""),
                    ok=bool(latest_gate_dwg_open.get("ok", False)),
                    dwg_convert=bool(latest_gate_dwg_open.get("dwg_convert_ok", False)),
                    router=bool(latest_gate_dwg_open.get("router_ok", False)),
                    convert=bool(latest_gate_dwg_open.get("convert_ok", False)),
                    viewer=bool(latest_gate_dwg_open.get("viewer_ok", False)),
                    validators=as_int(latest_gate_dwg_open.get("validator_ok_count"), 0),
                    run_id=as_str(latest_gate_dwg_open.get("run_id") or ""),
                )
            )
        latest_gate_dwg_open_matrix = as_dict(latest_weekly.get("gate_dwg_open_matrix_smoke"))
        if latest_gate_dwg_open_matrix.get("enabled"):
            lines.append(
                "- weekly_gate_dwg_open_matrix_smoke: `mode={mode}` `ok={ok}` `cases={cases}` `pass={passed}` `fail={failed}` `dwg_convert_ok={dwg_convert_ok}` `router_ok={router_ok}` `convert_ok={convert_ok}` `viewer_ok={viewer_ok}` `validators_ok={validators}` `run_id={run_id}`".format(
                    mode=as_str(latest_gate_dwg_open_matrix.get("mode") or ""),
                    ok=bool(latest_gate_dwg_open_matrix.get("ok", False)),
                    cases=as_int(latest_gate_dwg_open_matrix.get("case_count"), 0),
                    passed=as_int(latest_gate_dwg_open_matrix.get("pass_count"), 0),
                    failed=as_int(latest_gate_dwg_open_matrix.get("fail_count"), 0),
                    dwg_convert_ok=as_int(latest_gate_dwg_open_matrix.get("dwg_convert_ok_count"), 0),
                    router_ok=as_int(latest_gate_dwg_open_matrix.get("router_ok_count"), 0),
                    convert_ok=as_int(latest_gate_dwg_open_matrix.get("convert_ok_count"), 0),
                    viewer_ok=as_int(latest_gate_dwg_open_matrix.get("viewer_ok_count"), 0),
                    validators=as_int(latest_gate_dwg_open_matrix.get("validator_ok_count"), 0),
                    run_id=as_str(latest_gate_dwg_open_matrix.get("run_id") or ""),
                )
            )
        latest_gate_dwg_open_desktop = as_dict(latest_weekly.get("gate_dwg_open_desktop_smoke"))
        if latest_gate_dwg_open_desktop.get("enabled"):
            lines.append(
                "- weekly_gate_dwg_open_desktop_smoke: `mode={mode}` `ok={ok}` `desktop={desktop}` `manifest={manifest}` `preview_artifacts={preview_artifacts}` `validators_ok={validators}` `run_id={run_id}`".format(
                    mode=as_str(latest_gate_dwg_open_desktop.get("mode") or ""),
                    ok=bool(latest_gate_dwg_open_desktop.get("ok", False)),
                    desktop=bool(latest_gate_dwg_open_desktop.get("desktop_ok", False)),
                    manifest=bool(latest_gate_dwg_open_desktop.get("manifest_ok", False)),
                    preview_artifacts=bool(latest_gate_dwg_open_desktop.get("preview_artifacts_ok", False)),
                    validators=as_int(latest_gate_dwg_open_desktop.get("validator_ok_count"), 0),
                    run_id=as_str(latest_gate_dwg_open_desktop.get("run_id") or ""),
                )
            )
        latest_gate_constraints_basic = as_dict(latest_weekly.get("gate_constraints_basic_ctest"))
        if latest_gate_constraints_basic.get("enabled"):
            lines.append(
                "- weekly_gate_constraints_basic_ctest: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing={missing}` `test={test}`".format(
                    status=as_str(latest_gate_constraints_basic.get("status") or ""),
                    cases=as_int(latest_gate_constraints_basic.get("case_count"), 0),
                    passed=as_int(latest_gate_constraints_basic.get("pass_count"), 0),
                    failed=as_int(latest_gate_constraints_basic.get("fail_count"), 0),
                    missing=as_int(latest_gate_constraints_basic.get("missing_count"), 0),
                    test=as_str(latest_gate_constraints_basic.get("test_name") or ""),
                )
            )
        latest_gate_solver_action = as_dict(latest_weekly.get("gate_solver_action_panel_smoke"))
        if latest_gate_solver_action.get("enabled"):
            lines.append(
                "- weekly_gate_solver_action_panel_smoke: `mode={mode}` `ok={ok}` `panels={panels}` `flow_checks={flow_checks}` `requests={requests}` `invoke={invoke_count}` `focus={focus_count}` `flow={flow_count}` `replay={replay_count}` `import_checks={import_checks}` `clear_checks={clear_checks}` `jump_requests={jump_request_count}` `dom_events={dom_event_count}` `dom_requests={dom_request_count}` `dom_actions={dom_action_count}` `dom_focus={dom_focus_count}` `dom_flow={dom_flow_count}` `dom_replay={dom_replay_count}` `events={event_count}` `event_invoke={event_invoke_count}` `event_focus={event_focus_count}` `event_flow={event_flow_count}` `event_replay={event_replay_count}` `jump_events={jump_event_count}` `next={next_count}` `jump={jump_count}` `prev={prev_count}` `restart={restart_count}` `replay_checks={replay_checks}` `event_focus_checks={event_focus_checks}` `banner_checks={banner_checks}` `banner_event_focus={banner_event_focus_checks}` `banner_focus_clicks={banner_focus_clicks}` `console={console_checks}` `console_flow={console_flow_checks}` `console_event_focus={console_event_focus_checks}` `console_replay={console_replay_checks}` `console_event_click={console_event_click_checks}` `console_focus_click={console_focus_click_checks}` `console_selection={console_selection_checks}` `status_checks={status_checks}` `status_clicks={status_click_checks}` `keyboard={keyboard_checks}` `panel_cycle={panel_cycle_checks}` `panel_keyboard={panel_keyboard_checks}` `panel_keyboard_invoke={panel_keyboard_invoke_checks}` `panel_keyboard_flow={panel_keyboard_flow_checks}` `keyboard_banner={keyboard_banner_checks}` `keyboard_jump={keyboard_jump_checks}` `keyboard_event_focus={keyboard_event_focus_checks}` `visited_panels={visited}` `run_id={run_id}`".format(
                    mode=as_str(latest_gate_solver_action.get("mode") or ""),
                    ok=bool(latest_gate_solver_action.get("ok", False)),
                    panels=as_int(latest_gate_solver_action.get("panel_count"), 0),
                    flow_checks=as_int(latest_gate_solver_action.get("flow_check_count"), 0),
                    requests=as_int(latest_gate_solver_action.get("request_count"), 0),
                    invoke_count=as_int(latest_gate_solver_action.get("invoke_request_count"), 0),
                    focus_count=as_int(latest_gate_solver_action.get("focus_request_count"), 0),
                    flow_count=as_int(latest_gate_solver_action.get("flow_request_count"), 0),
                    replay_count=as_int(latest_gate_solver_action.get("replay_request_count"), 0),
                    import_checks=as_int(latest_gate_solver_action.get("import_check_count"), 0),
                    clear_checks=as_int(latest_gate_solver_action.get("clear_check_count"), 0),
                    jump_request_count=as_int(latest_gate_solver_action.get("jump_request_count"), 0),
                    dom_event_count=as_int(latest_gate_solver_action.get("dom_event_count"), 0),
                    dom_request_count=as_int(latest_gate_solver_action.get("dom_request_event_count"), 0),
                    dom_action_count=as_int(latest_gate_solver_action.get("dom_action_event_count"), 0),
                    dom_focus_count=as_int(latest_gate_solver_action.get("dom_focus_event_count"), 0),
                    dom_flow_count=as_int(latest_gate_solver_action.get("dom_flow_event_count"), 0),
                    dom_replay_count=as_int(latest_gate_solver_action.get("dom_replay_event_count"), 0),
                    event_count=as_int(latest_gate_solver_action.get("event_count"), 0),
                    event_invoke_count=as_int(latest_gate_solver_action.get("invoke_event_count"), 0),
                    event_focus_count=as_int(latest_gate_solver_action.get("focus_event_count"), 0),
                    event_flow_count=as_int(latest_gate_solver_action.get("flow_event_count"), 0),
                    event_replay_count=as_int(latest_gate_solver_action.get("replay_event_count"), 0),
                    jump_event_count=as_int(latest_gate_solver_action.get("jump_event_count"), 0),
                    next_count=as_int(latest_gate_solver_action.get("next_check_count"), 0),
                    jump_count=as_int(latest_gate_solver_action.get("jump_check_count"), 0),
                    prev_count=as_int(latest_gate_solver_action.get("rewind_check_count"), 0),
                    restart_count=as_int(latest_gate_solver_action.get("restart_check_count"), 0),
                    replay_checks=as_int(latest_gate_solver_action.get("replay_check_count"), 0),
                    event_focus_checks=as_int(latest_gate_solver_action.get("event_focus_check_count"), 0),
                    banner_checks=as_int(latest_gate_solver_action.get("banner_check_count"), 0),
                    banner_event_focus_checks=as_int(latest_gate_solver_action.get("banner_event_focus_check_count"), 0),
                    banner_focus_clicks=as_int(latest_gate_solver_action.get("banner_focus_click_check_count"), 0),
                    console_checks=as_int(latest_gate_solver_action.get("console_check_count"), 0),
                    console_flow_checks=as_int(latest_gate_solver_action.get("console_flow_check_count"), 0),
                    console_event_focus_checks=as_int(latest_gate_solver_action.get("console_event_focus_check_count"), 0),
                    console_replay_checks=as_int(latest_gate_solver_action.get("console_replay_check_count"), 0),
                    console_event_click_checks=as_int(latest_gate_solver_action.get("console_event_click_check_count"), 0),
                    console_focus_click_checks=as_int(latest_gate_solver_action.get("console_focus_click_check_count"), 0),
                    console_selection_checks=as_int(latest_gate_solver_action.get("console_selection_check_count"), 0),
                    status_checks=as_int(latest_gate_solver_action.get("status_check_count"), 0),
                    status_click_checks=as_int(latest_gate_solver_action.get("status_click_check_count"), 0),
                    keyboard_checks=as_int(latest_gate_solver_action.get("keyboard_check_count"), 0),
                    panel_cycle_checks=as_int(latest_gate_solver_action.get("panel_cycle_check_count"), 0),
                    panel_keyboard_checks=as_int(latest_gate_solver_action.get("panel_keyboard_check_count"), 0),
                    panel_keyboard_invoke_checks=as_int(latest_gate_solver_action.get("panel_keyboard_invoke_check_count"), 0),
                    panel_keyboard_flow_checks=as_int(latest_gate_solver_action.get("panel_keyboard_flow_check_count"), 0),
                    keyboard_banner_checks=as_int(latest_gate_solver_action.get("keyboard_banner_check_count"), 0),
                    keyboard_jump_checks=as_int(latest_gate_solver_action.get("keyboard_jump_check_count"), 0),
                    keyboard_event_focus_checks=as_int(latest_gate_solver_action.get("keyboard_event_focus_check_count"), 0),
                    visited=as_int(latest_gate_solver_action.get("visited_panel_count"), 0),
                    run_id=as_str(latest_gate_solver_action.get("run_id") or ""),
                )
            )
        latest_step186_preview_artifact_prep = as_dict(latest_weekly.get("step186_preview_artifact_prep"))
        if latest_step186_preview_artifact_prep.get("enabled"):
            lines.append(
                "- weekly_step186_preview_artifact_prep: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `run_id={run_id}`".format(
                    status=as_str(latest_step186_preview_artifact_prep.get("status") or ""),
                    cases=as_int(latest_step186_preview_artifact_prep.get("case_count"), 0),
                    passed=as_int(latest_step186_preview_artifact_prep.get("pass_count"), 0),
                    failed=as_int(latest_step186_preview_artifact_prep.get("fail_count"), 0),
                    run_id=as_str(latest_step186_preview_artifact_prep.get("run_id") or ""),
                )
            )
        latest_gate_preview_artifact = as_dict(latest_weekly.get("gate_preview_artifact_smoke"))
        if latest_gate_preview_artifact.get("enabled"):
            lines.append(
                "- weekly_gate_preview_artifact_smoke: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `run_id={run_id}`".format(
                    status=as_str(latest_gate_preview_artifact.get("status") or ""),
                    cases=as_int(latest_gate_preview_artifact.get("case_count"), 0),
                    passed=as_int(latest_gate_preview_artifact.get("pass_count"), 0),
                    failed=as_int(latest_gate_preview_artifact.get("fail_count"), 0),
                    run_id=as_str(latest_gate_preview_artifact.get("run_id") or ""),
                )
            )
        latest_gate_assembly_roundtrip = as_dict(latest_weekly.get("gate_assembly_roundtrip_ctest"))
        if latest_gate_assembly_roundtrip.get("enabled"):
            lines.append(
                "- weekly_gate_assembly_roundtrip_ctest: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing={missing}` `model={model}` `paperspace={paperspace}` `mixed={mixed}` `dense={dense}` `summaries={summaries}` `tracked={tracked}` `groups={groups}` `group_sources={group_sources}` `group_source_cases={group_source_cases}` `group_source_case_details={group_source_case_details}` `group_layouts={group_layouts}` `group_layout_cases={group_layout_cases}` `group_layout_case_details={group_layout_case_details}` `proxies={proxies}` `proxy_kinds={proxy_kinds}` `proxy_kind_cases={proxy_kind_cases}` `proxy_kind_case_details={proxy_kind_case_details}` `proxy_layouts={proxy_layouts}` `proxy_layout_cases={proxy_layout_cases}` `proxy_layout_case_details={proxy_layout_case_details}` `text_kinds={text_kinds}` `text_kind_layouts={text_kind_layouts}` `text_kind_cases={text_kind_cases}` `text_kind_case_details={text_kind_case_details}` `exploded={exploded}` `exploded_layouts={exploded_layouts}` `exploded_layout_cases={exploded_layout_cases}` `exploded_layout_case_details={exploded_layout_case_details}` `viewports={viewports}` `viewport_layouts={viewport_layouts}` `viewport_cases={viewport_cases}` `viewport_detail_cases={viewport_detail_cases}` `viewport_proxy_kinds={viewport_proxy_kinds}` `viewport_proxy_layouts={viewport_proxy_layouts}` `viewport_proxy_cases={viewport_proxy_cases}` `viewport_proxy_case_details={viewport_proxy_case_details}` `checked={checked}` `drift={metadata_drift}/{group_drift}`".format(
                    status=as_str(latest_gate_assembly_roundtrip.get("status") or ""),
                    cases=as_int(latest_gate_assembly_roundtrip.get("case_count"), 0),
                    passed=as_int(latest_gate_assembly_roundtrip.get("pass_count"), 0),
                    failed=as_int(latest_gate_assembly_roundtrip.get("fail_count"), 0),
                    missing=as_int(latest_gate_assembly_roundtrip.get("missing_count"), 0),
                    model=as_str(latest_gate_assembly_roundtrip.get("model_status") or "-"),
                    paperspace=as_str(latest_gate_assembly_roundtrip.get("paperspace_status") or "-"),
                    mixed=as_str(latest_gate_assembly_roundtrip.get("mixed_status") or "-"),
                    dense=as_str(latest_gate_assembly_roundtrip.get("dense_status") or "-"),
                    summaries=as_int(latest_gate_assembly_roundtrip.get("summary_json_count"), 0),
                    tracked=as_int(latest_gate_assembly_roundtrip.get("import_assembly_tracked_count"), 0),
                    groups=as_int(latest_gate_assembly_roundtrip.get("import_assembly_group_count"), 0),
                    group_sources=fmt_proxy_kind_counts(latest_gate_assembly_roundtrip.get("import_assembly_group_source_counts_b64")),
                    group_source_cases=as_int(latest_gate_assembly_roundtrip.get("import_assembly_group_source_case_count"), 0),
                    group_source_case_details=fmt_group_source_case_details(latest_gate_assembly_roundtrip.get("import_assembly_group_source_case_details_b64")),
                    group_layouts=fmt_proxy_layout_kind_counts(latest_gate_assembly_roundtrip.get("import_assembly_group_layout_source_counts_b64")),
                    group_layout_cases=as_int(latest_gate_assembly_roundtrip.get("import_assembly_group_layout_source_case_count"), 0),
                    group_layout_case_details=fmt_group_layout_case_details(latest_gate_assembly_roundtrip.get("import_assembly_group_layout_source_case_details_b64")),
                    proxies=as_int(latest_gate_assembly_roundtrip.get("import_derived_proxy_count"), 0),
                    proxy_kinds=fmt_proxy_kind_counts(latest_gate_assembly_roundtrip.get("import_proxy_kind_counts_b64")),
                    proxy_kind_cases=as_int(latest_gate_assembly_roundtrip.get("import_proxy_kind_case_count"), 0),
                    proxy_kind_case_details=fmt_proxy_kind_case_details(latest_gate_assembly_roundtrip.get("import_proxy_kind_case_details_b64")),
                    proxy_layouts=fmt_proxy_layout_kind_counts(latest_gate_assembly_roundtrip.get("import_proxy_layout_kind_counts_b64")),
                    proxy_layout_cases=as_int(latest_gate_assembly_roundtrip.get("import_proxy_layout_case_count"), 0),
                    proxy_layout_case_details=fmt_proxy_layout_case_details(latest_gate_assembly_roundtrip.get("import_proxy_layout_case_details_b64")),
                    text_kinds=fmt_proxy_kind_counts(latest_gate_assembly_roundtrip.get("import_text_kind_counts_b64")),
                    text_kind_layouts=fmt_proxy_layout_kind_counts(latest_gate_assembly_roundtrip.get("import_text_kind_layout_counts_b64")),
                    text_kind_cases=as_int(latest_gate_assembly_roundtrip.get("import_text_kind_case_count"), 0),
                    text_kind_case_details=fmt_text_kind_case_details(latest_gate_assembly_roundtrip.get("import_text_kind_case_details_b64")),
                    exploded=as_int(latest_gate_assembly_roundtrip.get("import_exploded_origin_count"), 0),
                    exploded_layouts=fmt_proxy_layout_kind_counts(latest_gate_assembly_roundtrip.get("import_exploded_layout_source_counts_b64")),
                    exploded_layout_cases=as_int(latest_gate_assembly_roundtrip.get("import_exploded_layout_source_case_count"), 0),
                    exploded_layout_case_details=fmt_exploded_layout_case_details(latest_gate_assembly_roundtrip.get("import_exploded_layout_source_case_details_b64")),
                    viewports=as_int(latest_gate_assembly_roundtrip.get("import_viewport_count"), 0),
                    viewport_layouts=as_int(latest_gate_assembly_roundtrip.get("import_viewport_layout_count"), 0),
                    viewport_cases=as_int(latest_gate_assembly_roundtrip.get("import_viewport_case_count"), 0),
                    viewport_detail_cases=fmt_viewport_case_details(latest_gate_assembly_roundtrip.get("import_viewport_case_details_b64")),
                    viewport_proxy_kinds=fmt_proxy_kind_counts(latest_gate_assembly_roundtrip.get("import_viewport_proxy_kind_counts_b64")),
                    viewport_proxy_layouts=fmt_proxy_layout_kind_counts(latest_gate_assembly_roundtrip.get("import_viewport_proxy_layout_kind_counts_b64")),
                    viewport_proxy_cases=as_int(latest_gate_assembly_roundtrip.get("import_viewport_proxy_case_count"), 0),
                    viewport_proxy_case_details=fmt_viewport_proxy_case_details(latest_gate_assembly_roundtrip.get("import_viewport_proxy_case_details_b64")),
                    checked=as_int(latest_gate_assembly_roundtrip.get("export_assembly_checked_count"), 0),
                    metadata_drift=as_int(latest_gate_assembly_roundtrip.get("export_metadata_drift_count"), 0),
                    group_drift=as_int(latest_gate_assembly_roundtrip.get("export_group_drift_count"), 0),
                )
            )
        latest_gate_preview_artifact_injection = as_dict(latest_weekly.get("gate_preview_artifact_validator_failure_injection"))
        if latest_gate_preview_artifact_injection.get("enabled"):
            lines.append(
                "- weekly_gate_preview_artifact_validator_failure_injection: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `run_id={run_id}`".format(
                    status=as_str(latest_gate_preview_artifact_injection.get("status") or ""),
                    cases=as_int(latest_gate_preview_artifact_injection.get("case_count"), 0),
                    passed=as_int(latest_gate_preview_artifact_injection.get("pass_count"), 0),
                    failed=as_int(latest_gate_preview_artifact_injection.get("fail_count"), 0),
                    run_id=as_str(latest_gate_preview_artifact_injection.get("run_id") or ""),
                )
            )
        latest_weekly_legacy_preview_prep = as_dict(latest_weekly.get("weekly_legacy_preview_artifact_prep"))
        if latest_weekly_legacy_preview_prep.get("enabled"):
            lines.append(
                "- weekly_legacy_preview_artifact_prep: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing_input={missing_input}` `missing_manifest={missing_manifest}` `run_id={run_id}`".format(
                    status=as_str(latest_weekly_legacy_preview_prep.get("status") or ""),
                    cases=as_int(latest_weekly_legacy_preview_prep.get("case_count"), 0),
                    passed=as_int(latest_weekly_legacy_preview_prep.get("pass_count"), 0),
                    failed=as_int(latest_weekly_legacy_preview_prep.get("fail_count"), 0),
                    missing_input=as_int(latest_weekly_legacy_preview_prep.get("missing_input_count"), 0),
                    missing_manifest=as_int(latest_weekly_legacy_preview_prep.get("missing_manifest_count"), 0),
                    run_id=as_str(latest_weekly_legacy_preview_prep.get("run_id") or ""),
                )
            )
        latest_weekly_legacy_preview = as_dict(latest_weekly.get("weekly_legacy_preview_artifact_smoke"))
        if latest_weekly_legacy_preview.get("enabled"):
            lines.append(
                "- weekly_legacy_preview_artifact_smoke: `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing_targets={missing}` `run_id={run_id}`".format(
                    status=as_str(latest_weekly_legacy_preview.get("status") or ""),
                    cases=as_int(latest_weekly_legacy_preview.get("case_count"), 0),
                    passed=as_int(latest_weekly_legacy_preview.get("pass_count"), 0),
                    failed=as_int(latest_weekly_legacy_preview.get("fail_count"), 0),
                    missing=as_int(latest_weekly_legacy_preview.get("missing_target_count"), 0),
                    run_id=as_str(latest_weekly_legacy_preview.get("run_id") or ""),
                )
            )
        latest_parallel = as_dict(latest_weekly.get("parallel_cycle"))
        if latest_parallel.get("enabled"):
            latest_parallel_gate = as_dict(latest_parallel.get("gate_decision"))
            latest_lane_b_ui = as_dict(as_dict(as_dict(latest_parallel.get("lanes")).get("lane_b")).get("ui_flow"))
            latest_inputs = as_dict(latest_weekly.get("inputs"))
            latest_reasons = [as_str(x) for x in as_list(latest_parallel_gate.get("fail_reasons")) if as_str(x).strip()]
            latest_warnings = [as_str(x) for x in as_list(latest_parallel_gate.get("warning_codes")) if as_str(x).strip()]
            lines.append(
                "- weekly_parallel_cycle: `status={status}` `decision={decision}` `raw={raw}` `watch_policy={watch}` `weekly_policy={weekly}` `watch_escalated={watch_escalated}` `run_id={run_id}` `lane_b_ui_mode={mode}` `lane_b_ui_status={ui_status}` `lane_b_ui_timeout_ms={timeout}` `lane_b_attr={attr}` `lane_b_interaction={interaction}` `lane_b_ui_stage={stage}` `lane_b_ui_setup={setup}`".format(
                    status=as_str(latest_parallel.get("status") or ""),
                    decision=as_str(latest_parallel_gate.get("decision") or latest_parallel.get("gate_decision_raw") or ""),
                    raw=as_str(latest_parallel_gate.get("raw_decision") or ""),
                    watch=as_str(latest_parallel.get("watch_policy") or ""),
                    weekly=as_str(latest_inputs.get("weekly_parallel_decision_policy") or "observe"),
                    watch_escalated=bool(latest_parallel_gate.get("watch_escalated", False)),
                    run_id=as_str(latest_parallel.get("run_id") or ""),
                    mode=as_str(latest_lane_b_ui.get("mode") or ""),
                    ui_status=as_str(latest_lane_b_ui.get("status") or ""),
                    timeout=as_int(latest_lane_b_ui.get("timeout_ms"), 0),
                    attr=bool(latest_lane_b_ui.get("failure_attribution_complete", True)),
                    interaction=bool(latest_lane_b_ui.get("interaction_checks_complete", False)),
                    stage=as_str(latest_lane_b_ui.get("failure_stage") or "-"),
                    setup="{open}/{resize}/{run}".format(
                        open=as_int(latest_lane_b_ui.get("open_exit_code"), 0),
                        resize=as_int(latest_lane_b_ui.get("resize_exit_code"), 0),
                        run=as_int(latest_lane_b_ui.get("run_code_exit_code"), 0),
                    ),
                )
            )
            lines.append(
                "- weekly_parallel_cycle_gate: `fail_reasons={reasons}` `warning_codes={warnings}`".format(
                    reasons=(" ".join(latest_reasons) if latest_reasons else "-"),
                    warnings=(" ".join(latest_warnings) if latest_warnings else "-"),
                )
            )
            if as_str(latest_parallel.get("summary_json")):
                lines.append(f"- weekly_parallel_cycle_summary_json: {fmt_path(as_str(latest_parallel.get('summary_json')))}")
        lines.append("")
    else:
        lines.append("- (no weekly history found yet)")
        lines.append("")

    lines.append("## Auto-Gate Readiness Notes")
    lines.append("")
    lines.append("- perf_trend auto-gate requires: `coverage_days >= PERF_TREND_DAYS` and `selected >= PERF_TREND_MIN_SELECTED` and `selection_mode=batch_only`")
    lines.append("- real_scene_trend auto-gate requires: `coverage_days >= REAL_SCENE_TREND_DAYS` and `selected >= REAL_SCENE_TREND_MIN_SELECTED` and `selection_mode=batch_only`")
    lines.append("- qt_persistence require_on auto-policy: enough recent samples + zero fail + consecutive target-available pass runs >= threshold")
    lines.append("- weekly_parallel_decision_policy=gate: weekly exits non-zero when `parallel_cycle` decision is fail")
    lines.append("- use `bash tools/editor_weekly_median_validation.sh` weekly to produce repeat=3 batch median samples")
    lines.append("")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote_dashboard={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
