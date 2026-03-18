#!/usr/bin/env python3
"""
Append one editor-gate snapshot to STEP176 verification report.

Usage:
  python3 tools/write_step176_gate_report.py \
    --gate-summary build/editor_gate_summary.json \
    --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


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

def as_float(value: Any) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def fmt_path(path: str) -> str:
    return f"`{path}`" if path else "`(missing)`"

def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default

def first_nonempty(values: list[Any]) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""

def collect_ui_flow_run_ids(ui_flow: dict[str, Any]) -> list[str]:
    direct = [str(x).strip() for x in as_list(ui_flow.get("run_ids")) if str(x).strip()]
    if direct:
        return direct
    out: list[str] = []
    for item in as_list(ui_flow.get("runs")):
        if not isinstance(item, dict):
            continue
        run_id = str(item.get("run_id") or "").strip()
        if run_id:
            out.append(run_id)
    return out

def format_ui_flow_interaction_coverage(ui_flow: dict[str, Any], key_prefix: str = "ui_flow_interaction_checks") -> str:
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
    parts_text = " ".join(parts)
    return "- {key}: `{parts}` complete=`{complete}`".format(
        key=key_prefix,
        parts=parts_text,
        complete=bool(ui_flow.get("interaction_checks_complete", False)),
    )

def format_ui_flow_setup_exits(ui_flow: dict[str, Any], key_prefix: str = "ui_flow_setup_exit_codes") -> str:
    open_rc = as_int(ui_flow.get("open_exit_code"), 0)
    resize_rc = as_int(ui_flow.get("resize_exit_code"), 0)
    run_code_rc = as_int(ui_flow.get("run_code_exit_code"), 0)
    stage = str(ui_flow.get("first_failure_stage") or "")
    if not (open_rc or resize_rc or run_code_rc or stage):
        return ""
    return "- {key}: `open={open_rc}` `resize={resize_rc}` `run_code={run_code_rc}` `first_failure_stage={stage}`".format(
        key=key_prefix,
        open_rc=open_rc,
        resize_rc=resize_rc,
        run_code_rc=run_code_rc,
        stage=(stage or "-"),
    )

def format_ui_flow_stage_counts(ui_flow: dict[str, Any], key_prefix: str = "ui_flow_failure_stage_counts") -> str:
    counts = as_dict(ui_flow.get("failure_stage_counts"))
    if not counts:
        return ""
    parts: list[str] = []
    for key in sorted(counts.keys()):
        count = as_int(counts.get(key), 0)
        if count > 0:
            parts.append(f"{key}={count}")
    if not parts:
        return ""
    return "- {key}: `{parts}`".format(key=key_prefix, parts=" ".join(parts))

def format_step166_baseline_compare(step166: dict[str, Any]) -> str:
    baseline = as_dict(step166.get("baseline_compare"))
    if not baseline:
        return ""
    compared = as_int(baseline.get("compared_cases"), 0)
    degraded = as_int(baseline.get("degraded_cases"), 0)
    improved = as_int(baseline.get("improved_cases"), 0)
    baseline_run_id = str(baseline.get("baseline_run_id") or "")
    baseline_file = str(baseline.get("baseline_file") or "")
    if compared == 0 and degraded == 0 and improved == 0 and not baseline_run_id and not baseline_file:
        return ""
    suffix = ""
    if baseline_run_id:
        suffix += f" baseline_run_id=`{baseline_run_id}`"
    if baseline_file:
        suffix += f" baseline={fmt_path(baseline_file)}"
    return f"- step166_baseline_compare: `compared={compared}` `degraded={degraded}` `improved={improved}`{suffix}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Append editor gate snapshot to STEP176 verification report.")
    parser.add_argument("--gate-summary", default="build/editor_gate_summary.json")
    parser.add_argument("--report", default="docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md")
    args = parser.parse_args()

    gate_path = Path(args.gate_summary).resolve()
    report_path = Path(args.report).resolve()

    gate = load_json(gate_path)
    gate_decision = as_dict(gate.get("gate_decision"))
    editor = as_dict(gate.get("editor_smoke"))
    editor_smoke_injection = as_dict(gate.get("editor_smoke_failure_injection"))
    ui_flow = as_dict(gate.get("ui_flow_smoke"))
    ui_flow_injection = as_dict(gate.get("ui_flow_failure_injection"))
    qt_persistence = as_dict(gate.get("qt_project_persistence"))
    step166 = as_dict(gate.get("step166"))
    perf_trend = as_dict(gate.get("perf_trend"))
    real_scene_trend = as_dict(gate.get("real_scene_trend"))
    inputs = as_dict(gate.get("inputs"))
    generated_at = str(gate.get("generated_at") or "")

    lines: list[str] = []
    if not report_path.exists():
        lines.append("# STEP176 Level A 持续开发与验证报告")
        lines.append("")

    lines.append("")
    lines.append(f"## Gate Snapshot ({generated_at or 'unknown'})")
    lines.append(f"- gate_summary_json: {fmt_path(str(gate_path))}")
    lines.append("")
    lines.append("### Runs")
    if gate_decision:
        reasons = gate_decision.get("fail_reasons") if isinstance(gate_decision.get("fail_reasons"), list) else []
        reasons_text = ", ".join([str(x) for x in reasons]) if reasons else ""
        if reasons_text:
            lines.append(
                f"- gate_decision: would_fail=`{gate_decision.get('would_fail', False)}` exit_code=`{gate_decision.get('exit_code', '')}` reasons=`{reasons_text}`"
            )
        else:
            lines.append(
                f"- gate_decision: would_fail=`{gate_decision.get('would_fail', False)}` exit_code=`{gate_decision.get('exit_code', '')}`"
            )
    if inputs:
        lines.append(
            "- gate_inputs: `profile={profile}` `step166={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}`".format(
                profile=str(inputs.get("editor_gate_profile") or ""),
                step166=bool(inputs.get("run_step166_gate", False)),
                ui_flow=bool(inputs.get("run_editor_ui_flow_smoke_gate", False)),
                convert=bool(inputs.get("editor_smoke_no_convert", False)),
            )
        )
    editor_totals = as_dict(editor.get("totals"))
    lines.append(
        "- editor_smoke_run_id: `{run_id}` status=`{status}` pass=`{ok}` fail=`{fail}` skipped=`{skip}`".format(
            run_id=editor.get("run_id", ""),
            status=editor.get("status", ""),
            ok=as_int(editor_totals.get("pass"), 0),
            fail=as_int(editor_totals.get("fail"), 0),
            skip=as_int(editor_totals.get("skipped"), 0),
        )
    )
    lines.append(
        "- editor_smoke_case_guard: `source={source}` `cases={cases}` `min={min_cases}`".format(
            source=str(editor.get("case_source") or "unknown"),
            cases=as_int(editor.get("cases_count"), 0),
            min_cases=as_int(editor.get("min_cases_required"), 0),
        )
    )
    generated_count = as_int(editor.get("generated_count"), 0)
    generated_declared = as_int(editor.get("generated_count_declared"), generated_count)
    generated_actual = as_int(editor.get("generated_count_actual"), generated_count)
    generated_mismatch = bool(editor.get("generated_count_mismatch", generated_declared != generated_actual))
    generated_mismatch_policy = str(editor.get("generated_count_mismatch_policy") or "warn")
    generated_mismatch_gate_fail = bool(editor.get("generated_count_mismatch_gate_fail", False))
    if (
        generated_count > 0
        or generated_declared > 0
        or generated_actual > 0
        or generated_mismatch
        or str(editor.get("generated_run_id") or "").strip()
        or as_list(editor.get("generated_run_ids"))
    ):
        generated_run_ids = [str(x) for x in as_list(editor.get("generated_run_ids")) if str(x).strip()]
        lines.append(
            "- editor_smoke_generated_cases: {path} `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `priorities={priorities}`".format(
                path=fmt_path(str(editor.get("generated_cases_path") or "")),
                count=generated_count,
                declared=generated_declared,
                actual=generated_actual,
                mismatch=generated_mismatch,
                min_cases=as_int(editor.get("generated_min_cases"), 0),
                priorities=str(editor.get("generated_priorities") or ""),
            )
        )
        lines.append(
            "- editor_smoke_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                policy=generated_mismatch_policy,
                gate_fail=generated_mismatch_gate_fail,
            )
        )
        lines.append(
            "- editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                run_id=str(editor.get("generated_run_id") or ""),
                run_ids=",".join(generated_run_ids) if generated_run_ids else "-",
            )
        )
    editor_buckets = as_dict(editor.get("failure_buckets"))
    editor_bucket_parts = []
    for key in ("INPUT_INVALID", "IMPORT_FAIL", "RENDER_DRIFT", "VIEWPORT_LAYOUT_MISSING", "TEXT_METRIC_DRIFT"):
        count = as_int(editor_buckets.get(key), 0)
        if count > 0:
            editor_bucket_parts.append(f"{key}={count}")
    if editor_bucket_parts:
        lines.append(f"- editor_smoke_failure_buckets: `{' '.join(editor_bucket_parts)}`")
    editor_code_counts = as_dict(editor.get("failure_code_counts"))
    if editor_code_counts:
        parts = [f"{k}={editor_code_counts[k]}" for k in sorted(editor_code_counts.keys())]
        lines.append(f"- editor_smoke_failure_codes: `{' '.join(parts)}`")
    lines.append(
        "- editor_smoke_failure_attribution: `complete={complete}` `code_total={total}`".format(
            complete=bool(editor.get("failure_attribution_complete", True)),
            total=as_int(editor.get("failure_code_total"), 0),
        )
    )
    unsupported = as_dict(editor.get("unsupported_passthrough"))
    if unsupported:
        lines.append(
            "- editor_smoke_unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                cases=as_int(unsupported.get("cases_with_checks"), 0),
                checked=as_int(unsupported.get("checked_entities"), 0),
                missing=as_int(unsupported.get("missing_entities"), 0),
                drifted=as_int(unsupported.get("drifted_entities"), 0),
                failed=as_int(unsupported.get("failed_cases"), 0),
            )
        )
    failed_cases = [row for row in as_list(editor.get("failed_cases")) if isinstance(row, dict)]
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
    if editor_smoke_injection.get("enabled"):
        detail = str(editor_smoke_injection.get("failure_detail") or "")
        if len(detail) > 220:
            detail = detail[:220] + "..."
        lines.append(
            "- editor_smoke_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` exit_code=`{exit_code}` detail=`{detail}`".format(
                status=str(editor_smoke_injection.get("status") or ""),
                run_id=str(editor_smoke_injection.get("run_id") or ""),
                code=str(editor_smoke_injection.get("failure_code") or ""),
                exit_code=str(editor_smoke_injection.get("exit_code") or ""),
                detail=detail,
            )
        )
    if ui_flow.get("enabled"):
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append(f"- ui_flow_smoke: `{ui_flow.get('ok', False)}` run_id=`{ui_flow.get('run_id','')}` (mode=`{ui_flow.get('mode','')}`)")
        run_ids = collect_ui_flow_run_ids(ui_flow)
        if run_ids:
            lines.append(f"- ui_flow_run_ids: `{' '.join(run_ids)}`")
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui_flow.get("gate_required", False)),
                explicit=bool(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "- ui_flow_port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
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
        code_counts = ui_flow.get("failure_code_counts")
        if isinstance(code_counts, dict) and code_counts:
            parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
            lines.append(f"- ui_flow_gate_failure_codes: `{' '.join(parts)}`")
        lines.append(
            "- ui_flow_failure_attribution: `complete={complete}` `code_total={total}`".format(
                complete=bool(ui_flow.get("failure_attribution_complete", True)),
                total=as_int(ui_flow.get("failure_code_total"), 0),
            )
        )
        setup_line = format_ui_flow_setup_exits(ui_flow)
        if setup_line:
            lines.append(setup_line)
        stage_line = format_ui_flow_stage_counts(ui_flow)
        if stage_line:
            lines.append(stage_line)
        interaction_line = format_ui_flow_interaction_coverage(ui_flow)
        if interaction_line:
            lines.append(interaction_line)
        failed_runs = [r for r in as_list(ui_flow.get("runs")) if isinstance(r, dict) and not bool(r.get("ok"))]
        if failed_runs:
            fr = failed_runs[0]
            code = str(fr.get("failure_code") or "")
            detail = first_nonempty([fr.get("failure_detail"), fr.get("flow_status")])
            if not detail:
                tails = as_list(fr.get("error_tail"))
                detail = first_nonempty(tails)
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
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append(
            "- ui_flow_smoke: `{ok}` run_id=`{run_id}` (mode=`{mode}` enabled=`{enabled}`)".format(
                ok=ui_flow.get("ok", False),
                run_id=ui_flow.get("run_id", ""),
                mode=ui_flow.get("mode", "skipped"),
                enabled=ui_flow.get("enabled", False),
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
                "- ui_flow_port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        if str(ui_flow.get("first_failure_code") or "").strip():
            lines.append(f"- ui_flow_first_failure_code: `{str(ui_flow.get('first_failure_code') or '')}`")
        setup_line = format_ui_flow_setup_exits(ui_flow)
        if setup_line:
            lines.append(setup_line)
        stage_line = format_ui_flow_stage_counts(ui_flow)
        if stage_line:
            lines.append(stage_line)
    if ui_flow_injection.get("enabled"):
        detail = str(ui_flow_injection.get("failure_detail") or "")
        if len(detail) > 220:
            detail = detail[:220] + "..."
        lines.append(
            "- ui_flow_failure_injection: `{status}` run_id=`{run_id}` code=`{code}` exit_code=`{exit_code}` detail=`{detail}`".format(
                status=str(ui_flow_injection.get("status") or ""),
                run_id=str(ui_flow_injection.get("run_id") or ""),
                code=str(ui_flow_injection.get("failure_code") or ""),
                exit_code=str(ui_flow_injection.get("exit_code") or ""),
                detail=detail,
            )
        )
    if qt_persistence:
        lines.append(
            "- qt_project_persistence: `status={status}` `mode={mode}` `gate_required={required}` `require_on={require_on}` run_id=`{run_id}` reason=`{reason}`".format(
                status=str(qt_persistence.get("status") or ""),
                mode=str(qt_persistence.get("mode") or "skipped"),
                required=bool(qt_persistence.get("gate_required", False)),
                require_on=bool(qt_persistence.get("require_on", False)),
                run_id=str(qt_persistence.get("run_id") or ""),
                reason=str(qt_persistence.get("reason") or ""),
            )
        )
        lines.append(
            "- qt_project_persistence_build: `dir={build_dir}` `BUILD_EDITOR_QT={flag}` `target_available={target}` `script_rc={script}` `build_rc={build}` `test_rc={test}`".format(
                build_dir=str(qt_persistence.get("build_dir") or ""),
                flag=str(qt_persistence.get("build_editor_qt") or ""),
                target=bool(qt_persistence.get("target_available", False)),
                script=as_int(qt_persistence.get("exit_code"), 0),
                build=as_int(qt_persistence.get("build_exit_code"), 0),
                test=as_int(qt_persistence.get("test_exit_code"), 0),
            )
        )
    lines.append(f"- step166_run_id: `{step166.get('run_id','')}` (gate_would_fail=`{as_dict(step166.get('gate_decision')).get('would_fail', False)}`)")
    baseline_line = format_step166_baseline_compare(step166)
    if baseline_line:
        lines.append(baseline_line)
    if perf_trend:
        extra = []
        if perf_trend.get("policy"):
            extra.append(f"policy=`{perf_trend.get('policy','')}`")
        if isinstance(perf_trend.get("min_selected"), int):
            extra.append(f"min_selected=`{perf_trend.get('min_selected')}`")
        cov = as_float(perf_trend.get("coverage_days"))
        if cov is not None:
            extra.append(f"coverage_days=`{cov:.2f}`")
        sel = perf_trend.get("selected_samples_in_window")
        if isinstance(sel, int):
            extra.append(f"selected=`{sel}`")
        if perf_trend.get("selection_mode"):
            extra.append(f"selection_mode=`{perf_trend.get('selection_mode','')}`")
        suffix = f" ({', '.join(extra)})" if extra else ""
        lines.append(
            f"- perf_trend: `{perf_trend.get('status','')}` "
            f"(mode=`{perf_trend.get('mode','')}` enabled=`{perf_trend.get('enabled', False)}`){suffix}"
        )
    if real_scene_trend:
        extra = []
        if real_scene_trend.get("policy"):
            extra.append(f"policy=`{real_scene_trend.get('policy','')}`")
        if isinstance(real_scene_trend.get("min_selected"), int):
            extra.append(f"min_selected=`{real_scene_trend.get('min_selected')}`")
        cov = as_float(real_scene_trend.get("coverage_days"))
        if cov is not None:
            extra.append(f"coverage_days=`{cov:.2f}`")
        sel = real_scene_trend.get("selected_samples_in_window")
        if isinstance(sel, int):
            extra.append(f"selected=`{sel}`")
        if real_scene_trend.get("selection_mode"):
            extra.append(f"selection_mode=`{real_scene_trend.get('selection_mode','')}`")
        suffix = f" ({', '.join(extra)})" if extra else ""
        lines.append(
            f"- real_scene_trend: `{real_scene_trend.get('status','')}` "
            f"(mode=`{real_scene_trend.get('mode','')}` enabled=`{real_scene_trend.get('enabled', False)}`){suffix}"
        )
    lines.append("")
    lines.append("### Artifacts")
    lines.append(f"- editor_smoke_summary: {fmt_path(str(editor.get('summary_json','')))}")
    if editor_smoke_injection.get("enabled"):
        lines.append(f"- editor_smoke_failure_injection_summary: {fmt_path(str(editor_smoke_injection.get('summary_json','')))}")
    if ui_flow.get("enabled"):
        lines.append(f"- ui_flow_smoke_summary: {fmt_path(str(ui_flow.get('summary_json','')))}")
    if ui_flow_injection.get("enabled"):
        lines.append(f"- ui_flow_failure_injection_summary: {fmt_path(str(ui_flow_injection.get('summary_json','')))}")
    if str(qt_persistence.get("summary_json") or ""):
        lines.append(f"- qt_project_persistence_summary: {fmt_path(str(qt_persistence.get('summary_json','')))}")
    lines.append(f"- step166_summary: {fmt_path(str(step166.get('summary_json','')))}")
    if str(perf_trend.get("summary_json") or ""):
        lines.append(f"- perf_trend_json: {fmt_path(str(perf_trend.get('summary_json','')))}")
    if str(real_scene_trend.get("summary_json") or ""):
        lines.append(f"- real_scene_trend_json: {fmt_path(str(real_scene_trend.get('summary_json','')))}")
    lines.append("")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
        fh.write("\n")

    print(f"appended_report={report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
