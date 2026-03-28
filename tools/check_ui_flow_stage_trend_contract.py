#!/usr/bin/env python3
"""Validate ui_flow_stage_trend contract from gate/weekly/local summaries."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_json(path_text: str) -> dict[str, Any]:
    path_text = str(path_text or "").strip()
    if not path_text:
        return {}
    path = Path(path_text)
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def as_float(value: Any, default: float | None = None) -> float | None:
    try:
        return float(value)
    except Exception:
        return default


def bool_text(value: bool) -> str:
    return "true" if value else "false"


def normalize_local(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "days": as_int(payload.get("editorGateUiFlowStageTrendDaysInput"), 0),
        "status": str(payload.get("editorGateUiFlowStageTrendStatus") or "").strip(),
        "recommended_gate_mode": str(payload.get("editorGateUiFlowStageTrendRecommendedMode") or "").strip(),
        "effective_mode": str(payload.get("editorGateUiFlowStageTrendEffectiveMode") or "").strip(),
        "gate_source": str(payload.get("editorGateUiFlowStageTrendGateSource") or "").strip(),
        "gate_applied": bool(payload.get("editorGateUiFlowStageTrendGateApplied", False)),
        "summary_json": str(payload.get("editorGateUiFlowStageTrendJson") or "").strip(),
        "summary_md": str(payload.get("editorGateUiFlowStageTrendMd") or "").strip(),
        "enabled_samples_in_window": as_int(payload.get("editorGateUiFlowStageTrendEnabledSamples"), 0),
        "samples_in_window": as_int(payload.get("editorGateUiFlowStageTrendEnabledSamples"), 0),
        "samples_total": as_int(payload.get("editorGateUiFlowStageTrendEnabledSamples"), 0),
        "fail_ratio": as_float(payload.get("editorGateUiFlowStageTrendFailRatio"), None),
        "attribution_ratio": as_float(payload.get("editorGateUiFlowStageTrendAttributionRatio"), None),
        "failure_stage_counts": as_dict(payload.get("editorGateUiFlowStageTrendFailureStageCounts")),
        "first_failure_stage_counts": {},
        "setup_exit_nonzero_runs": {},
        "policy": {
            "effective_mode": str(payload.get("editorGateUiFlowStageTrendEffectiveMode") or "").strip(),
            "gate_source": str(payload.get("editorGateUiFlowStageTrendGateSource") or "").strip(),
            "gate_applied": bool(payload.get("editorGateUiFlowStageTrendGateApplied", False)),
        },
    }


def validate_contract(raw: dict[str, Any]) -> tuple[bool, list[str]]:
    payload = as_dict(raw)
    issues: list[str] = []

    days = as_int(payload.get("days"), 0)
    status = str(payload.get("status") or "").strip()
    mode = str(payload.get("recommended_gate_mode") or "").strip()
    summary_json = str(payload.get("summary_json") or "").strip()
    summary_md = str(payload.get("summary_md") or "").strip()
    enabled_samples = as_int(payload.get("enabled_samples_in_window"), 0)
    fail_ratio = as_float(payload.get("fail_ratio"), None)
    attr_ratio = as_float(payload.get("attribution_ratio"), None)

    if days <= 0:
        issues.append("days<=0")
    if not status:
        issues.append("status_missing")
    if mode not in {"observe", "gate"}:
        issues.append("recommended_mode_invalid")
    if not summary_json:
        issues.append("summary_json_missing")
    if not summary_md:
        issues.append("summary_md_missing")
    if not isinstance(payload.get("failure_stage_counts"), dict):
        issues.append("failure_stage_counts_invalid")
    if not isinstance(payload.get("first_failure_stage_counts"), dict):
        issues.append("first_failure_stage_counts_invalid")
    if not isinstance(payload.get("setup_exit_nonzero_runs"), dict):
        issues.append("setup_exit_nonzero_runs_invalid")

    if enabled_samples > 0:
        if fail_ratio is None:
            issues.append("fail_ratio_missing")
        if attr_ratio is None:
            issues.append("attribution_ratio_missing")

    if summary_json:
        summary_json_path = Path(summary_json)
        if not summary_json_path.is_absolute():
            summary_json_path = Path.cwd() / summary_json_path
        if not summary_json_path.exists():
            issues.append("summary_json_not_found")
    if summary_md:
        summary_md_path = Path(summary_md)
        if not summary_md_path.is_absolute():
            summary_md_path = Path.cwd() / summary_md_path
        if not summary_md_path.exists():
            issues.append("summary_md_not_found")

    return (len(issues) == 0, issues)


def build_report(source: str, trend: dict[str, Any], ok: bool, issues: list[str]) -> dict[str, Any]:
    return {
        "source": source,
        "ok": bool(ok),
        "issues": list(issues),
        "issue_count": len(list(issues)),
        "status": str(trend.get("status") or "").strip(),
        "recommended_gate_mode": str(trend.get("recommended_gate_mode") or "").strip(),
        "effective_mode": str(trend.get("effective_mode") or "").strip(),
        "days": as_int(trend.get("days"), 0),
        "enabled_samples_in_window": as_int(trend.get("enabled_samples_in_window"), 0),
        "fail_ratio": as_float(trend.get("fail_ratio"), None),
        "attribution_ratio": as_float(trend.get("attribution_ratio"), None),
        "summary_json": str(trend.get("summary_json") or "").strip(),
        "summary_md": str(trend.get("summary_md") or "").strip(),
    }


def write_md(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# UI Flow Stage Trend Contract Check",
        "",
        f"- source: `{report.get('source', '')}`",
        f"- ok: `{bool_text(bool(report.get('ok', False)))}`",
        f"- issues: `{','.join(report.get('issues') or []) if report.get('issues') else 'none'}`",
        f"- issue_count: `{as_int(report.get('issue_count'), 0)}`",
        f"- status: `{report.get('status', '')}`",
        f"- recommended_gate_mode: `{report.get('recommended_gate_mode', '')}`",
        f"- effective_mode: `{report.get('effective_mode', '')}`",
        f"- days: `{report.get('days', 0)}`",
        f"- enabled_samples_in_window: `{report.get('enabled_samples_in_window', 0)}`",
        f"- fail_ratio: `{report.get('fail_ratio')}`",
        f"- attribution_ratio: `{report.get('attribution_ratio')}`",
        f"- summary_json: `{report.get('summary_json', '')}`",
        f"- summary_md: `{report.get('summary_md', '')}`",
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate ui_flow_stage_trend contract.")
    parser.add_argument("--gate-summary", default="")
    parser.add_argument("--weekly-summary", default="")
    parser.add_argument("--local-summary", default="")
    parser.add_argument("--out-json", default="")
    parser.add_argument("--out-md", default="")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when contract is invalid.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    gate_summary = load_json(args.gate_summary)
    weekly_summary = load_json(args.weekly_summary)
    local_summary = load_json(args.local_summary)

    source = ""
    trend: dict[str, Any] = {}

    if gate_summary:
        source = "gate"
        trend = as_dict(gate_summary.get("ui_flow_stage_trend"))
    elif weekly_summary:
        source = "weekly"
        trend = as_dict(weekly_summary.get("ui_flow_stage_trend"))
    elif local_summary:
        source = "local"
        trend = normalize_local(local_summary)
    else:
        source = "none"
        trend = {}

    ok, issues = validate_contract(trend)
    report = build_report(source=source, trend=trend, ok=ok, issues=issues)

    if args.out_json:
        out_json = Path(args.out_json)
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.out_md:
        write_md(Path(args.out_md), report)

    issues_text = ",".join(issues) if issues else "none"
    print(f"ui_flow_stage_trend_contract_source={source}")
    print(f"ui_flow_stage_trend_contract_ok={bool_text(ok)}")
    print(f"ui_flow_stage_trend_contract_issues={issues_text}")
    print(f"ui_flow_stage_trend_contract_issue_count={len(issues)}")
    print(f"ui_flow_stage_trend_contract_status={report.get('status', '')}")
    print(f"ui_flow_stage_trend_contract_mode={report.get('recommended_gate_mode', '')}")
    print(f"ui_flow_stage_trend_contract_days={report.get('days', 0)}")

    if args.strict and not ok:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
