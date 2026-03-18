#!/usr/bin/env python3
"""
Append one weekly validation snapshot to STEP170 verification report.

Usage:
  python3 tools/write_step170_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[1].resolve()


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}

def as_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default

def as_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default

def as_list(value) -> list:
    return value if isinstance(value, list) else []

def fmt_path(path: str) -> str:
    return f"`{path}`" if path else "`(missing)`"

def first_nonempty(values: list) -> str:
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
    return (WORKSPACE_ROOT / p).resolve()


def resolve_cli_path(raw: str) -> Path:
    path = Path(str(raw or "").strip())
    if path.is_absolute():
        return path.resolve()
    return (WORKSPACE_ROOT / path).resolve()

def format_step166_baseline_compare(step166_payload: dict) -> str:
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
    return f"  - baseline_compare: `compared={compared}` `degraded={degraded}` `improved={improved}`{suffix}"

def format_ui_flow_triage(summary_json: str) -> str:
    if not summary_json:
        return ""
    try:
        payload = json.load(open(summary_json, "r", encoding="utf-8"))
    except Exception:
        return ""
    step = str(payload.get("flow_step") or "")
    selection = str(payload.get("flow_selection") or "")
    status = str(payload.get("flow_status") or "")
    if not (step or selection or status):
        return ""
    return f"  - triage: step=`{step}` selection=`{selection}` status=`{status}`"

def format_ui_flow_interaction_coverage(ui_payload: dict) -> str:
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
        label = label_map.get(key, key)
        marker = "" if all_pass else "!"
        parts.append(f"{label}={passed}/{total}{marker}")
    if not parts:
        return ""
    complete = bool(ui_payload.get("interaction_checks_complete", False))
    return f"  - interaction_checks: `{' '.join(parts)}` complete=`{complete}`"

def collect_ui_flow_run_ids(ui_payload: dict) -> list[str]:
    direct = [str(x).strip() for x in as_list(ui_payload.get("run_ids")) if str(x).strip()]
    if direct:
        return direct
    out = []
    for item in as_list(ui_payload.get("runs")):
        if not isinstance(item, dict):
            continue
        run_id = str(item.get("run_id") or "").strip()
        if run_id:
            out.append(run_id)
    return out

def classify_ui_flow_failure_stage(summary_payload: dict) -> str:
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

def summarize_ui_flow_setup(weekly_path: Path, ui_payload: dict) -> dict:
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
        try:
            run_payload = load_json(run_path)
        except Exception:
            continue
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Append weekly validation summary to STEP170 verification report.")
    parser.add_argument("--weekly-summary", default="build/editor_weekly_validation_summary.json")
    parser.add_argument("--step170-report", default="docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md")
    args = parser.parse_args()

    weekly_path = resolve_cli_path(args.weekly_summary)
    report_path = resolve_cli_path(args.step170_report)

    if not weekly_path.exists():
        raise FileNotFoundError(f"weekly summary not found: {weekly_path}")

    payload = load_json(weekly_path)
    generated_at = str(payload.get("generated_at") or "unknown")
    inputs = as_dict(payload.get("inputs"))
    gate_runtime = as_dict(payload.get("gate_runtime"))

    editor = as_dict(payload.get("editor_smoke"))
    step166 = as_dict(payload.get("step166"))
    perf = as_dict(payload.get("performance"))
    ui = as_dict(payload.get("ui_flow_smoke"))
    ui_failure_injection = as_dict(payload.get("ui_flow_failure_injection"))
    gate = as_dict(payload.get("gate"))
    parallel_cycle = as_dict(payload.get("parallel_cycle"))
    ui_flow_stage_trend = as_dict(payload.get("ui_flow_stage_trend"))

    step166_sum_raw = str(step166.get("summary_json") or "")
    step166_sum_path = resolve_summary_path(weekly_path, step166_sum_raw)
    step166_payload = load_json(step166_sum_path) if step166_sum_path and step166_sum_path.exists() else {}

    lines: list[str] = []
    if not report_path.exists():
        lines.append("# STEP170 AutoCAD-like UI + 2D Operations Verification")
        lines.append("")

    lines.append("")
    lines.append(f"## Incremental Verification ({generated_at} weekly validation)")
    lines.append("```bash")
    lines.append("bash tools/editor_weekly_validation.sh")
    lines.append("```")
    lines.append(f"- weekly_summary_json: `{weekly_path}`")
    if bool(inputs.get("run_editor_parallel_cycle")):
        lines.append(
            "- parallel_cycle_inputs: `watch_policy={policy}` `weekly_policy={weekly}` `lane_a={lane_a}` `lane_b={lane_b}` `lane_c={lane_c}` `lane_b_ui_flow={ui}` `lane_b_ui_mode={mode}` `lane_b_ui_timeout_ms={timeout}` `strict={strict}`".format(
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
    if editor.get("run_id"):
        totals = as_dict(editor.get("totals"))
        lines.append(
            "- editor_roundtrip (observe): run_id=`{run_id}` status=`{status}` pass=`{ok}` fail=`{fail}` skipped=`{skip}`".format(
                run_id=editor.get("run_id", ""),
                status=editor.get("status", ""),
                ok=as_int(totals.get("pass"), 0),
                fail=as_int(totals.get("fail"), 0),
                skip=as_int(totals.get("skipped"), 0),
            )
        )
        lines.append(
            "  - case_source: `{source}` cases=`{path}` count=`{count}` min=`{min_cases}`".format(
                source=str(inputs.get("editor_smoke_case_source") or "discovery"),
                path=str(inputs.get("editor_smoke_cases") or "<discovery>"),
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
                "  - generated_cases: path=`{path}` count=`{count}` declared=`{declared}` actual=`{actual}` mismatch=`{mismatch}` min=`{min_cases}` priorities=`{priorities}`".format(
                    path=str(inputs.get("editor_smoke_generated_cases_path") or ""),
                    count=generated_count,
                    declared=generated_declared,
                    actual=generated_actual,
                    mismatch=generated_mismatch,
                    min_cases=as_int(inputs.get("editor_smoke_generated_min_cases"), 0),
                    priorities=str(inputs.get("editor_smoke_generated_priorities") or ""),
                )
            )
            lines.append(
                "  - generated_mismatch_policy: `policy={policy}`".format(
                    policy=str(inputs.get("editor_smoke_generated_mismatch_policy") or "warn"),
                )
            )
            lines.append(
                "  - generated_runs: run_id=`{run_id}` run_ids=`{run_ids}`".format(
                    run_id=str(inputs.get("editor_smoke_generated_run_id") or ""),
                    run_ids=",".join(generated_run_ids) if generated_run_ids else "-",
                )
            )
        bucket_counts = as_dict(editor.get("failure_buckets"))
        bucket_parts = []
        for key in ("INPUT_INVALID", "IMPORT_FAIL", "RENDER_DRIFT", "VIEWPORT_LAYOUT_MISSING", "TEXT_METRIC_DRIFT"):
            count = as_int(bucket_counts.get(key), 0)
            if count > 0:
                bucket_parts.append(f"{key}={count}")
        if bucket_parts:
            lines.append(f"  - failure_buckets: `{' '.join(bucket_parts)}`")
        code_counts = as_dict(editor.get("failure_code_counts"))
        if code_counts:
            code_parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
            lines.append(f"  - failure_codes: `{' '.join(code_parts)}`")
        unsupported = as_dict(editor.get("unsupported_passthrough"))
        if unsupported:
            lines.append(
                "  - unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                    cases=as_int(unsupported.get("cases_with_checks"), 0),
                    checked=as_int(unsupported.get("checked_entities"), 0),
                    missing=as_int(unsupported.get("missing_entities"), 0),
                    drifted=as_int(unsupported.get("drifted_entities"), 0),
                    failed=as_int(unsupported.get("failed_cases"), 0),
                )
            )
        failed_cases = [r for r in as_list(editor.get("failed_cases")) if isinstance(r, dict)]
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
                lines.append(f"  - recent_failures: `{' | '.join(preview)}`")
    if ui.get("enabled"):
        ui_setup = summarize_ui_flow_setup(weekly_path, ui)
        ui_port = as_dict(ui.get("port_allocation"))
        lines.append(f"- ui_flow_smoke: `{ui.get('status','')}` run_id=`{ui.get('run_id','')}`")
        ui_run_ids = collect_ui_flow_run_ids(ui)
        if ui_run_ids:
            lines.append(f"  - run_ids: `{' '.join(ui_run_ids)}`")
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui.get("gate_required", False)),
                explicit=bool(ui.get("gate_required_explicit", False)),
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
                target=as_int(ui.get("gate_runs_target"), 0),
                run_count=as_int(ui.get("gate_run_count"), 0),
                ok=as_int(ui.get("gate_pass_count"), 0),
                fail=as_int(ui.get("gate_fail_count"), 0),
            )
        )
        lines.append(
            "  - failure_attribution: `complete={complete}` `code_total={total}`".format(
                complete=bool(ui.get("failure_attribution_complete", True)),
                total=as_int(ui.get("failure_code_total"), 0),
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
        if str(ui.get("first_failure_code") or "").strip():
            lines.append(f"  - first_failure_code: `{str(ui.get('first_failure_code') or '')}`")
        ui_stage_counts = as_dict(ui_setup.get("stage_counts"))
        if ui_stage_counts:
            parts = [f"{k}={ui_stage_counts[k]}" for k in sorted(ui_stage_counts.keys())]
            lines.append(f"  - failure_stage_counts: `{' '.join(parts)}`")
        code_counts = ui.get("failure_code_counts")
        if isinstance(code_counts, dict) and code_counts:
            parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
            lines.append(f"  - gate_failure_codes: `{' '.join(parts)}`")
        if ui.get("summary_json"):
            lines.append(f"  - summary_json: `{ui.get('summary_json','')}`")
            triage = format_ui_flow_triage(str(ui.get("summary_json") or ""))
            if triage:
                lines.append(triage)
        interaction_line = format_ui_flow_interaction_coverage(ui)
        if interaction_line:
            lines.append(interaction_line)
        failed_runs = [r for r in as_list(ui.get("runs")) if isinstance(r, dict) and not bool(r.get("ok"))]
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
    elif ui.get("gate_required") or as_dict(ui.get("port_allocation")):
        ui_setup = summarize_ui_flow_setup(weekly_path, ui)
        ui_port = as_dict(ui.get("port_allocation"))
        lines.append(
            "- ui_flow_smoke: `{status}` run_id=`{run_id}` enabled=`{enabled}` mode=`{mode}`".format(
                status=str(ui.get("status") or ""),
                run_id=str(ui.get("run_id") or ""),
                enabled=bool(ui.get("enabled", False)),
                mode=str(ui.get("mode") or "skipped"),
            )
        )
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui.get("gate_required", False)),
                explicit=bool(ui.get("gate_required_explicit", False)),
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
        if str(ui.get("first_failure_code") or "").strip():
            lines.append(f"  - first_failure_code: `{str(ui.get('first_failure_code') or '')}`")
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
    if ui_failure_injection.get("enabled"):
        inj_detail = str(ui_failure_injection.get("failure_detail") or "")
        if len(inj_detail) > 220:
            inj_detail = inj_detail[:220] + "..."
        lines.append(
            "- ui_flow_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                status=str(ui_failure_injection.get("status") or ""),
                run_id=str(ui_failure_injection.get("run_id") or ""),
                code=str(ui_failure_injection.get("failure_code") or ""),
                detail=inj_detail,
            )
        )
    if step166.get("run_id"):
        lines.append(f"- step166: run_id=`{step166.get('run_id','')}` (gate_would_fail=`{step166.get('gate_would_fail', False)}`)")
        if step166.get("summary_json"):
            lines.append(f"  - summary_json: `{step166.get('summary_json','')}`")
        baseline_line = format_step166_baseline_compare(step166_payload)
        if baseline_line:
            lines.append(baseline_line)
    if perf.get("run_id"):
        lines.append(f"- perf: run_id=`{perf.get('run_id','')}`")
    if ui_flow_stage_trend:
        stage_counts = as_dict(ui_flow_stage_trend.get("failure_stage_counts"))
        first_stage_counts = as_dict(ui_flow_stage_trend.get("first_failure_stage_counts"))
        lines.append(
            "- ui_flow_stage_trend: `status={status}` `recommended_gate_mode={mode}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
                status=str(ui_flow_stage_trend.get("status") or ""),
                mode=str(ui_flow_stage_trend.get("recommended_gate_mode") or "observe"),
                enabled=as_int(ui_flow_stage_trend.get("enabled_samples_in_window"), 0),
                fail_ratio=as_float(ui_flow_stage_trend.get("fail_ratio"), 0.0),
                attr_ratio=as_float(ui_flow_stage_trend.get("attribution_ratio"), 0.0),
            )
        )
        if stage_counts:
            parts = [f"{k}={as_int(stage_counts.get(k), 0)}" for k in sorted(stage_counts.keys()) if as_int(stage_counts.get(k), 0) > 0]
            if parts:
                lines.append(f"  - ui_flow_stage_counts: `{' '.join(parts)}`")
        if first_stage_counts:
            parts = [f"{k}={as_int(first_stage_counts.get(k), 0)}" for k in sorted(first_stage_counts.keys()) if as_int(first_stage_counts.get(k), 0) > 0]
            if parts:
                lines.append(f"  - ui_flow_first_stage_counts: `{' '.join(parts)}`")
        if str(ui_flow_stage_trend.get("summary_json") or ""):
            lines.append(f"  - ui_flow_stage_trend_json: `{str(ui_flow_stage_trend.get('summary_json') or '')}`")
    if gate.get("summary_json"):
        lines.append(f"- gate_summary_json: `{gate.get('summary_json','')}`")
    gate_ui = as_dict(gate.get("ui_flow_smoke"))
    if gate_ui:
        gate_ui_setup = summarize_ui_flow_setup(weekly_path, gate_ui)
        gate_ui_status = str(gate_ui.get("status") or gate_ui.get("mode") or "skipped")
        lines.append(
            "- gate_ui_flow_smoke: `mode={mode}` `status={status}` `run_count={count}` `pass={ok}` `fail={fail}`".format(
                mode=str(gate_ui.get("mode", "")),
                status=gate_ui_status,
                count=as_int(gate_ui.get("gate_run_count"), 0),
                ok=as_int(gate_ui.get("gate_pass_count"), 0),
                fail=as_int(gate_ui.get("gate_fail_count"), 0),
            )
        )
        gate_ui_run_ids = collect_ui_flow_run_ids(gate_ui)
        if gate_ui_run_ids:
            lines.append(f"  - gate_ui_flow_run_ids: `{' '.join(gate_ui_run_ids)}`")
        lines.append(
            "  - gate_ui_flow_setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `first_failure_stage={stage}`".format(
                open_rc=as_int(gate_ui_setup.get("open_exit_code"), 0),
                resize_rc=as_int(gate_ui_setup.get("resize_exit_code"), 0),
                run_rc=as_int(gate_ui_setup.get("run_code_exit_code"), 0),
                stage=str(gate_ui_setup.get("first_stage") or "-"),
            )
        )
        gate_ui_stage_counts = as_dict(gate_ui_setup.get("stage_counts"))
        if gate_ui_stage_counts:
            parts = [f"{k}={gate_ui_stage_counts[k]}" for k in sorted(gate_ui_stage_counts.keys())]
            lines.append(f"  - gate_ui_flow_failure_stage_counts: `{' '.join(parts)}`")
        gate_ui_port = as_dict(gate_ui.get("port_allocation"))
        if gate_ui_port:
            lines.append(
                "  - gate_ui_flow_port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(gate_ui_port.get("available", "")),
                    status=str(gate_ui_port.get("status", "")),
                    reason=str(gate_ui_port.get("reason", "")),
                )
            )
        gate_interaction_line = format_ui_flow_interaction_coverage(gate_ui)
        if gate_interaction_line:
            lines.append(gate_interaction_line.replace("  - ", "  - gate_"))
    gate_step166 = as_dict(gate.get("step166"))
    if gate_step166:
        gate_step166_decision = as_dict(gate_step166.get("gate_decision"))
        lines.append(
            "- gate_step166: run_id=`{run_id}` enabled=`{enabled}` would_fail=`{would_fail}`".format(
                run_id=gate_step166.get("run_id", ""),
                enabled=bool(gate_step166.get("enabled", False)),
                would_fail=bool(gate_step166_decision.get("would_fail", False)),
            )
        )
        if gate_step166.get("summary_json"):
            lines.append(f"  - gate_step166_summary_json: `{gate_step166.get('summary_json','')}`")
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
            "  - gate_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}` `source={source}`".format(
                profile=runtime_profile,
                step166=runtime_step166,
                ui_flow=runtime_ui_flow,
                convert=runtime_convert,
                perf=runtime_perf,
                real_scene=runtime_scene,
                source=runtime_source,
            )
        )
        lines.append(
            "  - gate_case_source: `{source}` cases=`{path}`".format(
                source=str(inputs.get("gate_editor_smoke_case_source") or "discovery"),
                path=str(inputs.get("gate_editor_smoke_cases") or "<discovery>"),
            )
        )
        generated_gate_run_ids = [str(x) for x in as_list(inputs.get("gate_editor_smoke_generated_run_ids")) if str(x).strip()]
        gate_count = as_int(inputs.get("gate_editor_smoke_generated_count"), 0)
        gate_declared = as_int(inputs.get("gate_editor_smoke_generated_count_declared"), gate_count)
        gate_actual = as_int(inputs.get("gate_editor_smoke_generated_count_actual"), gate_count)
        gate_mismatch = bool(inputs.get("gate_editor_smoke_generated_count_mismatch", gate_declared != gate_actual))
        if gate_count > 0 or gate_declared > 0 or gate_actual > 0 or gate_mismatch:
            lines.append(
                "  - gate_generated_cases: path=`{path}` count=`{count}` declared=`{declared}` actual=`{actual}` mismatch=`{mismatch}` priorities=`{priorities}`".format(
                    path=str(inputs.get("gate_editor_smoke_generated_cases_path") or ""),
                    count=gate_count,
                    declared=gate_declared,
                    actual=gate_actual,
                    mismatch=gate_mismatch,
                    priorities=str(inputs.get("gate_editor_smoke_generated_priorities") or ""),
                )
            )
            lines.append(
                "  - gate_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                    policy=str(inputs.get("gate_editor_smoke_generated_mismatch_policy") or "warn"),
                    gate_fail=bool(inputs.get("gate_editor_smoke_generated_mismatch_gate_fail", False)),
                )
            )
            lines.append(
                "  - gate_generated_runs: run_id=`{run_id}` run_ids=`{run_ids}`".format(
                    run_id=str(inputs.get("gate_editor_smoke_generated_run_id") or ""),
                    run_ids=",".join(generated_gate_run_ids) if generated_gate_run_ids else "-",
                )
            )
        gate_codes = as_dict(gate_editor.get("failure_code_counts"))
        if gate_codes:
            gate_code_parts = [f"{k}={gate_codes[k]}" for k in sorted(gate_codes.keys())]
            lines.append(f"  - gate_failure_codes: `{' '.join(gate_code_parts)}`")
        gate_unsupported = as_dict(gate_editor.get("unsupported_passthrough"))
        if gate_unsupported:
            lines.append(
                "  - gate_unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
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
        if len(detail) > 180:
            detail = detail[:180] + "..."
        lines.append(
            "- gate_editor_smoke_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` detail=`{detail}`".format(
                status=gate_editor_injection.get("status", ""),
                run_id=gate_editor_injection.get("run_id", ""),
                code=gate_editor_injection.get("failure_code", ""),
                detail=detail,
            )
        )
    if parallel_cycle.get("enabled"):
        pc_gate = as_dict(parallel_cycle.get("gate_decision"))
        pc_lane_b = as_dict(as_dict(parallel_cycle.get("lanes")).get("lane_b"))
        pc_lane_b_ui = as_dict(pc_lane_b.get("ui_flow"))
        pc_reasons = [str(x) for x in as_list(pc_gate.get("fail_reasons")) if str(x).strip()]
        pc_warnings = [str(x) for x in as_list(pc_gate.get("warning_codes")) if str(x).strip()]
        lines.append(
            "- parallel_cycle: `status={status}` `run_id={run_id}` `decision={decision}` `raw={raw}` `watch_policy={watch}` `weekly_policy={weekly}` `watch_escalated={watch_escalated}` `duration_sec={duration}`".format(
                status=str(parallel_cycle.get("status") or ""),
                run_id=str(parallel_cycle.get("run_id") or ""),
                decision=str(pc_gate.get("decision") or parallel_cycle.get("gate_decision_raw") or ""),
                raw=str(pc_gate.get("raw_decision") or ""),
                watch=str(parallel_cycle.get("watch_policy") or ""),
                weekly=str(inputs.get("weekly_parallel_decision_policy") or "observe"),
                watch_escalated=bool(pc_gate.get("watch_escalated", False)),
                duration=as_int(parallel_cycle.get("duration_sec"), 0),
            )
        )
        lines.append(
            "  - parallel_cycle_gate: `fail_reasons={reasons}` `warning_codes={warnings}`".format(
                reasons=(" ".join(pc_reasons) if pc_reasons else "-"),
                warnings=(" ".join(pc_warnings) if pc_warnings else "-"),
            )
        )
        if pc_lane_b:
            lines.append(
                "  - lane_b: `status={status}` `rc={rc}` `duration_sec={duration}` `node_test_duration_sec={node}`".format(
                    status=str(pc_lane_b.get("status") or ""),
                    rc=as_int(pc_lane_b.get("rc"), 0),
                    duration=as_int(pc_lane_b.get("duration_sec"), 0),
                    node=as_int(pc_lane_b.get("node_test_duration_sec"), 0),
                )
            )
        if pc_lane_b_ui:
            pc_stage_counts = as_dict(pc_lane_b_ui.get("failure_stage_counts"))
            lines.append(
                "  - lane_b_ui_flow: `enabled={enabled}` `mode={mode}` `status={status}` `timeout_ms={timeout}` `attribution_complete={attr}` `interaction_complete={interaction}`".format(
                    enabled=bool(pc_lane_b_ui.get("enabled", False)),
                    mode=str(pc_lane_b_ui.get("mode") or ""),
                    status=str(pc_lane_b_ui.get("status") or ""),
                    timeout=as_int(pc_lane_b_ui.get("timeout_ms"), 0),
                    attr=bool(pc_lane_b_ui.get("failure_attribution_complete", True)),
                    interaction=bool(pc_lane_b_ui.get("interaction_checks_complete", False)),
                )
            )
            lines.append(
                "    - lane_b_ui_setup_exits: `open={open_rc}` `resize={resize_rc}` `run_code={run_rc}` `failure_stage={stage}`".format(
                    open_rc=as_int(pc_lane_b_ui.get("open_exit_code"), 0),
                    resize_rc=as_int(pc_lane_b_ui.get("resize_exit_code"), 0),
                    run_rc=as_int(pc_lane_b_ui.get("run_code_exit_code"), 0),
                    stage=str(pc_lane_b_ui.get("failure_stage") or "-"),
                )
            )
            if str(pc_lane_b_ui.get("failure_code") or "").strip():
                lines.append(f"    - lane_b_ui_failure_code: `{str(pc_lane_b_ui.get('failure_code') or '')}`")
            if pc_stage_counts:
                parts = [f"{k}={pc_stage_counts[k]}" for k in sorted(pc_stage_counts.keys())]
                lines.append(f"    - lane_b_ui_failure_stage_counts: `{' '.join(parts)}`")
            coverage = as_dict(pc_lane_b_ui.get("interaction_checks_coverage"))
            if coverage:
                parts = [f"{k}={str(bool(v)).lower()}" for k, v in sorted(coverage.items())]
                lines.append(f"    - lane_b_ui_interaction_coverage: `{' '.join(parts)}`")
        if str(parallel_cycle.get("summary_json") or ""):
            lines.append(f"  - parallel_cycle_summary_json: `{str(parallel_cycle.get('summary_json') or '')}`")
        if str(parallel_cycle.get("summary_md") or ""):
            lines.append(f"  - parallel_cycle_summary_md: `{str(parallel_cycle.get('summary_md') or '')}`")

    with report_path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
        fh.write("\n")

    print(f"appended report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
