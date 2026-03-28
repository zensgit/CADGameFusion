#!/usr/bin/env python3
"""
Append one editor-gate run summary to STEP170 verification report.

Usage:
  python3 tools/write_editor_gate_report.py \
    --gate-summary build/editor_gate_summary.json \
    --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


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

def as_list(value) -> list:
    return value if isinstance(value, list) else []


def format_fail_reasons(decision: dict) -> str:
    reasons = decision.get("fail_reasons")
    if isinstance(reasons, list) and reasons:
        return "; ".join(str(x) for x in reasons)
    return "none"

def format_ui_flow_triage(ui_flow: dict) -> str:
    triage = ui_flow.get("triage")
    if not isinstance(triage, dict):
        return ""
    step = str(triage.get("step") or "")
    selection = str(triage.get("selection") or "")
    status = str(triage.get("status") or "")
    if not (step or selection or status):
        return ""
    return f"- triage: step=`{step}` selection=`{selection}` status=`{status}`"

def format_ui_flow_setup_exits(ui_flow: dict) -> str:
    open_rc = as_int(ui_flow.get("open_exit_code"), 0)
    resize_rc = as_int(ui_flow.get("resize_exit_code"), 0)
    run_code_rc = as_int(ui_flow.get("run_code_exit_code"), 0)
    stage = str(ui_flow.get("first_failure_stage") or "")
    if not (open_rc or resize_rc or run_code_rc or stage):
        return ""
    return (
        "- setup_exit_codes: `open={open_rc}` `resize={resize_rc}` `run_code={run_code_rc}` `first_failure_stage={stage}`".format(
            open_rc=open_rc,
            resize_rc=resize_rc,
            run_code_rc=run_code_rc,
            stage=(stage or "-"),
        )
    )

def format_ui_flow_stage_counts(ui_flow: dict) -> str:
    stage_counts = as_dict(ui_flow.get("failure_stage_counts"))
    if not stage_counts:
        return ""
    parts: list[str] = []
    for key in sorted(stage_counts.keys()):
        count = as_int(stage_counts.get(key), 0)
        if count > 0:
            parts.append(f"{key}={count}")
    if not parts:
        return ""
    return f"- failure_stage_counts: `{' '.join(parts)}`"

def format_ui_flow_failure_attribution(ui_flow: dict) -> str:
    if ui_flow.get("ok") is True:
        return ""
    failed_runs = [r for r in as_list(ui_flow.get("runs")) if isinstance(r, dict) and not bool(r.get("ok"))]
    if failed_runs:
        fr = failed_runs[0]
        step = str(fr.get("flow_step") or "")
        selection = str(fr.get("flow_selection") or "")
        code = str(fr.get("failure_code") or "")
        detail = str(fr.get("failure_detail") or "")
        status = str(fr.get("flow_status") or "")
        if not detail:
            detail = status
        if not detail:
            tails = as_list(fr.get("error_tail"))
            for item in tails:
                text = str(item or "").strip()
                if text:
                    detail = text
                    break
        if len(detail) > 220:
            detail = detail[:220] + "..."
        return (
            "- failure_attribution: first_failed_run="
            f"`{str(fr.get('run_id') or '')}` code=`{code}` step=`{step}` selection=`{selection}` detail=`{detail}`"
        )
    flow = ui_flow.get("flow")
    if not isinstance(flow, dict):
        flow = {}
    step = str(flow.get("__step") or "")
    error = str(flow.get("__error") or "")
    if not step and not error:
        triage = ui_flow.get("triage")
        if isinstance(triage, dict):
            step = str(triage.get("step") or "")
            status = str(triage.get("status") or "")
            if status and not error:
                error = status
    if not step and not error:
        return ""
    if len(error) > 220:
        error = error[:220] + "..."
    return f"- failure_attribution: step=`{step}` error=`{error}`"

def resolve_ui_flow_runs(ui_flow: dict) -> tuple[int, int, int, int]:
    target = as_int(ui_flow.get("gate_runs_target"), 0)
    run_count = as_int(ui_flow.get("gate_run_count"), 0)
    pass_count = as_int(ui_flow.get("gate_pass_count"), 0)
    fail_count = as_int(ui_flow.get("gate_fail_count"), 0)
    if target <= 0 and ui_flow.get("enabled", False):
        target = 1
    if run_count <= 0 and ui_flow.get("enabled", False):
        run_count = 1
    if pass_count == 0 and fail_count == 0 and ui_flow.get("enabled", False):
        if ui_flow.get("ok") is True:
            pass_count = 1
        else:
            fail_count = 1
    return target, run_count, pass_count, fail_count

def collect_ui_flow_run_ids(ui_flow: dict) -> list[str]:
    direct = [str(x).strip() for x in as_list(ui_flow.get("run_ids")) if str(x).strip()]
    if direct:
        return direct
    run_ids = []
    for item in as_list(ui_flow.get("runs")):
        if not isinstance(item, dict):
            continue
        run_id = str(item.get("run_id") or "").strip()
        if run_id:
            run_ids.append(run_id)
    return run_ids

def format_ui_flow_interaction_coverage(ui_flow: dict, key_prefix: str = "interaction_checks") -> str:
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
    return "- {prefix}: `{parts}` complete=`{complete}`".format(
        prefix=key_prefix,
        parts=parts_text,
        complete=bool(ui_flow.get("interaction_checks_complete", False)),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Append editor gate summary to STEP170 verification report.")
    parser.add_argument("--gate-summary", default="build/editor_gate_summary.json")
    parser.add_argument("--step170-report", default="docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md")
    args = parser.parse_args()

    gate_summary_path = Path(args.gate_summary).resolve()
    report_path = Path(args.step170_report).resolve()

    if not gate_summary_path.exists():
        raise FileNotFoundError(f"gate summary not found: {gate_summary_path}")

    gate = load_json(gate_summary_path)
    editor = as_dict(gate.get("editor_smoke"))
    editor_smoke_injection = as_dict(gate.get("editor_smoke_failure_injection"))
    ui_flow = as_dict(gate.get("ui_flow_smoke"))
    ui_flow_injection = as_dict(gate.get("ui_flow_failure_injection"))
    qt_persistence = as_dict(gate.get("qt_project_persistence"))
    step166 = as_dict(gate.get("step166"))
    attempts = as_dict(gate.get("cad_attempts"))
    inputs = as_dict(gate.get("inputs"))

    editor_totals = as_dict(editor.get("totals"))
    editor_buckets = as_dict(editor.get("failure_buckets"))
    editor_decision = as_dict(editor.get("gate_decision"))

    step_totals = as_dict(step166.get("totals"))
    step_buckets = as_dict(step166.get("failure_buckets"))
    step_decision = as_dict(step166.get("gate_decision"))
    step_baseline = as_dict(step166.get("baseline_compare"))

    lines = []
    if not report_path.exists():
        lines.append("# STEP170 AutoCAD-like UI + 2D Operations Verification")
        lines.append("")

    lines.append("")
    lines.append(f"## Incremental Verification ({gate.get('generated_at', 'unknown')} editor gate)")
    lines.append("### One-button gate")
    lines.append("```bash")
    lines.append("bash tools/editor_gate.sh")
    lines.append("```")
    lines.append(f"- baseline: `{gate.get('baseline', '')}`")
    if inputs:
        lines.append(
            "- gate_inputs: `profile={profile}` `step166={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}`".format(
                profile=str(inputs.get("editor_gate_profile") or ""),
                step166=bool(inputs.get("run_step166_gate", False)),
                ui_flow=bool(inputs.get("run_editor_ui_flow_smoke_gate", False)),
                convert=bool(inputs.get("editor_smoke_no_convert", False)),
            )
        )
    lines.append(f"- cad_attempts: `used={attempts.get('used', 0)}/{attempts.get('max', 0)}`")
    lines.append(f"- summary_json: `{gate_summary_path}`")
    lines.append("")

    lines.append("### Editor round-trip gate result")
    lines.append(f"- run_id: `{editor.get('run_id', '')}`")
    lines.append(f"- status: `{editor.get('status', '')}`")
    lines.append(f"- summary_json: `{editor.get('summary_json', '')}`")
    lines.append(
        "- case_guard: `source={source}` `cases={cases}` `min={min_cases}`".format(
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
        generated_ids = [str(x) for x in as_list(editor.get("generated_run_ids")) if str(x).strip()]
        lines.append(
            "- generated_cases: `path={path}` `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `priorities={priorities}`".format(
                path=str(editor.get("generated_cases_path") or ""),
                count=generated_count,
                declared=generated_declared,
                actual=generated_actual,
                mismatch=generated_mismatch,
                min_cases=as_int(editor.get("generated_min_cases"), 0),
                priorities=str(editor.get("generated_priorities") or ""),
            )
        )
        lines.append(
            "- generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                policy=generated_mismatch_policy,
                gate_fail=generated_mismatch_gate_fail,
            )
        )
        lines.append(
            "- generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                run_id=str(editor.get("generated_run_id") or ""),
                run_ids=",".join(generated_ids) if generated_ids else "-",
            )
        )
    lines.append(
        "- totals: `pass={pass_} fail={fail} skipped={skipped}`".format(
            pass_=editor_totals.get("pass", 0),
            fail=editor_totals.get("fail", 0),
            skipped=editor_totals.get("skipped", 0),
        )
    )
    lines.append(
        "- failure_buckets: `INPUT_INVALID={input_invalid} IMPORT_FAIL={import_fail} "
        "VIEWPORT_LAYOUT_MISSING={viewport_missing} RENDER_DRIFT={render_drift} "
        "TEXT_METRIC_DRIFT={text_drift}`".format(
            input_invalid=editor_buckets.get("INPUT_INVALID", 0),
            import_fail=editor_buckets.get("IMPORT_FAIL", 0),
            viewport_missing=editor_buckets.get("VIEWPORT_LAYOUT_MISSING", 0),
            render_drift=editor_buckets.get("RENDER_DRIFT", 0),
            text_drift=editor_buckets.get("TEXT_METRIC_DRIFT", 0),
        )
    )
    editor_code_counts = as_dict(editor.get("failure_code_counts"))
    if editor_code_counts:
        code_parts = [f"{k}={editor_code_counts[k]}" for k in sorted(editor_code_counts.keys())]
        lines.append(f"- failure_codes: `{' '.join(code_parts)}`")
    lines.append(
        "- failure_attribution_complete: `{ok}` `code_total={total}`".format(
            ok=bool(editor.get("failure_attribution_complete", True)),
            total=as_int(editor.get("failure_code_total"), 0),
        )
    )
    unsupported = as_dict(editor.get("unsupported_passthrough"))
    if unsupported:
        lines.append(
            "- unsupported_passthrough: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}` `first_failed_case={first}`".format(
                cases=as_int(unsupported.get("cases_with_checks"), 0),
                checked=as_int(unsupported.get("checked_entities"), 0),
                missing=as_int(unsupported.get("missing_entities"), 0),
                drifted=as_int(unsupported.get("drifted_entities"), 0),
                failed=as_int(unsupported.get("failed_cases"), 0),
                first=str(unsupported.get("first_failed_case") or ""),
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
            lines.append(f"- recent_failures: `{' | '.join(preview)}`")
    selection = as_dict(editor.get("case_selection"))
    lines.append(
        "- case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
            selected=as_int(selection.get("selected_count"), 0),
            matched=as_int(selection.get("matched_count"), 0),
            candidate=as_int(selection.get("filtered_count"), 0),
            total=as_int(selection.get("total_input"), 0),
            fallback=bool(selection.get("used_fallback", False)),
        )
    )
    lines.append(f"- gate_would_fail: `{editor_decision.get('would_fail', False)}`")
    lines.append(f"- gate_fail_reasons: `{format_fail_reasons(editor_decision)}`")
    lines.append("")

    if editor_smoke_injection.get("enabled", False):
        detail = str(editor_smoke_injection.get("failure_detail") or "")
        if len(detail) > 220:
            detail = detail[:220] + "..."
        lines.append("### Editor round-trip failure injection")
        lines.append(
            f"- status: `{editor_smoke_injection.get('status', '')}` run_id=`{editor_smoke_injection.get('run_id', '')}`"
        )
        lines.append(
            f"- code: `{editor_smoke_injection.get('failure_code', '')}` exit_code=`{editor_smoke_injection.get('exit_code', '')}` detail=`{detail}`"
        )
        lines.append(f"- summary_json: `{editor_smoke_injection.get('summary_json', '')}`")
        lines.append("")

    if ui_flow.get("enabled", False):
        ui_target, ui_runs, ui_pass, ui_fail = resolve_ui_flow_runs(ui_flow)
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append("### Editor UI flow smoke")
        lines.append(f"- mode: `{ui_flow.get('mode', '')}`")
        lines.append(
            "- gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui_flow.get("gate_required", False)),
                explicit=bool(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "- port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        lines.append(f"- run_id: `{ui_flow.get('run_id', '')}`")
        run_ids = collect_ui_flow_run_ids(ui_flow)
        if run_ids:
            lines.append(f"- run_ids: `{' '.join(run_ids)}`")
        lines.append(f"- ok: `{ui_flow.get('ok', False)}` exit_code=`{ui_flow.get('exit_code', '')}`")
        lines.append(f"- gate_runs: `target={ui_target}` `run_count={ui_runs}` `pass={ui_pass}` `fail={ui_fail}`")
        code_counts = ui_flow.get("failure_code_counts")
        if isinstance(code_counts, dict) and code_counts:
            parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
            lines.append(f"- gate_failure_codes: `{' '.join(parts)}`")
        lines.append(
            "- failure_attribution_complete: `{ok}` `code_total={total}`".format(
                ok=bool(ui_flow.get("failure_attribution_complete", True)),
                total=as_int(ui_flow.get("failure_code_total"), 0),
            )
        )
        setup_exit_line = format_ui_flow_setup_exits(ui_flow)
        if setup_exit_line:
            lines.append(setup_exit_line)
        stage_counts_line = format_ui_flow_stage_counts(ui_flow)
        if stage_counts_line:
            lines.append(stage_counts_line)
        lines.append(f"- summary_json: `{ui_flow.get('summary_json', '')}`")
        triage_line = format_ui_flow_triage(ui_flow)
        if triage_line:
            lines.append(triage_line)
        interaction_line = format_ui_flow_interaction_coverage(ui_flow)
        if interaction_line:
            lines.append(interaction_line)
        failure_line = format_ui_flow_failure_attribution(ui_flow)
        if failure_line:
            lines.append(failure_line)
        if ui_flow.get("screenshot"):
            lines.append(f"- screenshot: `{ui_flow.get('screenshot', '')}`")
        lines.append("")
    elif ui_flow.get("gate_required", False) or as_dict(ui_flow.get("port_allocation")):
        ui_port = as_dict(ui_flow.get("port_allocation"))
        lines.append("### Editor UI flow smoke")
        lines.append(f"- mode: `{ui_flow.get('mode', 'skipped')}` enabled=`{ui_flow.get('enabled', False)}`")
        lines.append(
            "- gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool(ui_flow.get("gate_required", False)),
                explicit=bool(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "- port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        if ui_flow.get("first_failure_code"):
            lines.append(f"- first_failure_code: `{ui_flow.get('first_failure_code', '')}`")
        setup_exit_line = format_ui_flow_setup_exits(ui_flow)
        if setup_exit_line:
            lines.append(setup_exit_line)
        stage_counts_line = format_ui_flow_stage_counts(ui_flow)
        if stage_counts_line:
            lines.append(stage_counts_line)
        lines.append("")

    if ui_flow_injection.get("enabled", False):
        detail = str(ui_flow_injection.get("failure_detail") or "")
        if len(detail) > 220:
            detail = detail[:220] + "..."
        lines.append("### Editor UI flow failure injection")
        lines.append(f"- status: `{ui_flow_injection.get('status', '')}` run_id=`{ui_flow_injection.get('run_id', '')}`")
        lines.append(
            f"- code: `{ui_flow_injection.get('failure_code', '')}` exit_code=`{ui_flow_injection.get('exit_code', '')}` detail=`{detail}`"
        )
        lines.append(f"- summary_json: `{ui_flow_injection.get('summary_json', '')}`")
        lines.append("")

    if qt_persistence:
        lines.append("### Qt project persistence")
        lines.append(
            "- mode: `{mode}` gate_required=`{required}` require_on=`{require_on}`".format(
                mode=str(qt_persistence.get("mode") or "skipped"),
                required=bool(qt_persistence.get("gate_required", False)),
                require_on=bool(qt_persistence.get("require_on", False)),
            )
        )
        lines.append(
            "- status: `{status}` reason=`{reason}` run_id=`{run_id}`".format(
                status=str(qt_persistence.get("status") or ""),
                reason=str(qt_persistence.get("reason") or ""),
                run_id=str(qt_persistence.get("run_id") or ""),
            )
        )
        lines.append(
            "- build: `dir={build_dir}` `BUILD_EDITOR_QT={flag}` `target_available={target}`".format(
                build_dir=str(qt_persistence.get("build_dir") or ""),
                flag=str(qt_persistence.get("build_editor_qt") or ""),
                target=bool(qt_persistence.get("target_available", False)),
            )
        )
        lines.append(
            "- exit_codes: `script={script}` `build={build}` `test={test}`".format(
                script=as_int(qt_persistence.get("exit_code"), 0),
                build=as_int(qt_persistence.get("build_exit_code"), 0),
                test=as_int(qt_persistence.get("test_exit_code"), 0),
            )
        )
        lines.append(f"- summary_json: `{str(qt_persistence.get('summary_json') or '')}`")
        lines.append("")

    lines.append("### STEP166 baseline gate result")
    lines.append(f"- run_id: `{step166.get('run_id', '')}`")
    lines.append(f"- run_dir: `{step166.get('run_dir', '')}`")
    lines.append(f"- summary_json: `{step166.get('summary_json', '')}`")
    lines.append(
        "- totals: `pass={pass_} fail={fail} skipped={skipped}`".format(
            pass_=step_totals.get("pass", 0),
            fail=step_totals.get("fail", 0),
            skipped=step_totals.get("skipped", 0),
        )
    )
    lines.append(
        "- failure_buckets: `INPUT_INVALID={input_invalid} IMPORT_FAIL={import_fail} "
        "VIEWPORT_LAYOUT_MISSING={viewport_missing} RENDER_DRIFT={render_drift} "
        "TEXT_METRIC_DRIFT={text_drift}`".format(
            input_invalid=step_buckets.get("INPUT_INVALID", 0),
            import_fail=step_buckets.get("IMPORT_FAIL", 0),
            viewport_missing=step_buckets.get("VIEWPORT_LAYOUT_MISSING", 0),
            render_drift=step_buckets.get("RENDER_DRIFT", 0),
            text_drift=step_buckets.get("TEXT_METRIC_DRIFT", 0),
        )
    )
    lines.append(f"- gate_would_fail: `{step_decision.get('would_fail', False)}`")
    lines.append(f"- gate_fail_reasons: `{format_fail_reasons(step_decision)}`")
    baseline_run_id = str(step_baseline.get("baseline_run_id") or "")
    baseline_file = str(step_baseline.get("baseline_file") or "")
    baseline_suffix = ""
    if baseline_run_id:
        baseline_suffix += f" baseline_run_id=`{baseline_run_id}`"
    if baseline_file:
        baseline_suffix += f" baseline=`{baseline_file}`"
    lines.append(
        "- baseline_compare: `compared={compared} degraded={degraded} improved={improved}`{suffix}".format(
            compared=step_baseline.get("compared_cases", 0),
            degraded=step_baseline.get("degraded_cases", 0),
            improved=step_baseline.get("improved_cases", 0),
            suffix=baseline_suffix,
        )
    )

    with report_path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
        fh.write("\n")

    print(f"appended report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
