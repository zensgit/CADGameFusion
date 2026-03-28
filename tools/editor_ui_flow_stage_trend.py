#!/usr/bin/env python3
"""
Aggregate editor UI-flow failure stages from gate history into a trend summary.

Usage:
  python3 tools/editor_ui_flow_stage_trend.py \
    --history-dir build/editor_gate_history \
    --days 7 \
    --out-json build/editor_ui_flow_stage_trend.json \
    --out-md build/editor_ui_flow_stage_trend.md
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


WORKSPACE_ROOT = Path(__file__).resolve().parents[1].resolve()
VALID_STAGES = ("open", "resize", "run_code", "flow")


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}


def parse_time(text: str | None) -> datetime | None:
    if not text:
        return None
    raw = str(text).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def resolve_summary_path(raw: str, history_file: Path) -> Path | None:
    text = str(raw or "").strip()
    if not text:
        return None
    path = Path(text)
    if path.is_absolute():
        return path
    local = (history_file.parent / path).resolve()
    if local.exists():
        return local
    return (WORKSPACE_ROOT / path).resolve()


def classify_failure_stage(summary_payload: dict[str, Any]) -> str:
    stage = str(summary_payload.get("flow_failure_stage") or "").strip().lower()
    if stage in VALID_STAGES:
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


def parse_stage_counts(raw: Any) -> Counter[str]:
    counts: Counter[str] = Counter()
    source = as_dict(raw)
    for key, value in source.items():
        stage = str(key or "").strip().lower()
        if stage not in VALID_STAGES:
            continue
        count = as_int(value, 0)
        if count > 0:
            counts[stage] += count
    return counts


@dataclass
class UiFlowRun:
    ts: datetime
    source_file: str
    run_id: str
    enabled: bool
    mode: str
    status: str
    gate_run_count: int
    gate_pass_count: int
    gate_fail_count: int
    first_failure_stage: str
    stage_counts: dict[str, int]
    failure_code_counts: dict[str, int]
    attribution_complete: bool
    open_exit_code: int
    resize_exit_code: int
    run_code_exit_code: int


def load_history_runs(history_dir: Path) -> list[UiFlowRun]:
    runs: list[UiFlowRun] = []
    if not history_dir.exists():
        return runs
    for path in sorted(history_dir.glob("*.json")):
        data = load_json(path)
        ts = parse_time(str(data.get("generated_at") or ""))
        if ts is None:
            ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

        ui = as_dict(data.get("ui_flow_smoke"))
        run_id = str(ui.get("run_id") or "")
        mode = str(ui.get("mode") or "")
        status = str(ui.get("status") or "")
        enabled = bool(ui.get("enabled", False))
        gate_run_count = as_int(ui.get("gate_run_count"), 0)
        gate_pass_count = as_int(ui.get("gate_pass_count"), 0)
        gate_fail_count = as_int(ui.get("gate_fail_count"), 0)
        first_failure_stage = str(ui.get("first_failure_stage") or "").strip().lower()
        if first_failure_stage not in VALID_STAGES:
            first_failure_stage = ""

        stage_counts_counter = parse_stage_counts(ui.get("failure_stage_counts"))
        open_exit_code = as_int(ui.get("open_exit_code"), 0)
        resize_exit_code = as_int(ui.get("resize_exit_code"), 0)
        run_code_exit_code = as_int(ui.get("run_code_exit_code"), 0)

        if not stage_counts_counter:
            summary_paths: list[Path] = []
            for raw in as_list(ui.get("run_summaries")):
                resolved = resolve_summary_path(str(raw or ""), path)
                if resolved and resolved.exists():
                    summary_paths.append(resolved)
            if not summary_paths:
                resolved = resolve_summary_path(str(ui.get("summary_json") or ""), path)
                if resolved and resolved.exists():
                    summary_paths.append(resolved)
            for summary_path in summary_paths:
                payload = load_json(summary_path)
                stage = classify_failure_stage(payload)
                if stage:
                    stage_counts_counter[stage] += 1
                    if not first_failure_stage:
                        first_failure_stage = stage
                if open_exit_code == 0:
                    open_exit_code = as_int(payload.get("open_exit_code"), 0)
                if resize_exit_code == 0:
                    resize_exit_code = as_int(payload.get("resize_exit_code"), 0)
                if run_code_exit_code == 0:
                    run_code_exit_code = as_int(payload.get("run_code_exit_code"), 0)

        failure_code_counts_src = as_dict(ui.get("failure_code_counts"))
        failure_code_counts: dict[str, int] = {}
        for key, value in failure_code_counts_src.items():
            code = str(key or "").strip()
            count = as_int(value, 0)
            if code and count > 0:
                failure_code_counts[code] = count

        attribution_complete = to_bool(ui.get("failure_attribution_complete"))
        if gate_fail_count <= 0 and not failure_code_counts and not stage_counts_counter:
            attribution_complete = True
        elif "failure_attribution_complete" not in ui:
            attribution_complete = bool(stage_counts_counter)

        runs.append(
            UiFlowRun(
                ts=ts,
                source_file=str(path),
                run_id=run_id,
                enabled=enabled,
                mode=mode,
                status=status,
                gate_run_count=gate_run_count,
                gate_pass_count=gate_pass_count,
                gate_fail_count=gate_fail_count,
                first_failure_stage=first_failure_stage,
                stage_counts=dict(stage_counts_counter),
                failure_code_counts=failure_code_counts,
                attribution_complete=attribution_complete,
                open_exit_code=open_exit_code,
                resize_exit_code=resize_exit_code,
                run_code_exit_code=run_code_exit_code,
            )
        )
    runs.sort(key=lambda x: x.ts)
    return runs


def evaluate_status(
    enabled_samples: int,
    fail_runs: int,
    attribution_incomplete_runs: int,
    fail_stage_total: int,
) -> tuple[str, str, str]:
    if enabled_samples <= 0:
        return (
            "no_data",
            "No UI-flow gate samples with enabled=true in the selected window.",
            "observe",
        )
    if enabled_samples < 5:
        return (
            "watch",
            "Sample size is below 5; keep observe and collect more UI-flow gate runs.",
            "observe",
        )
    fail_ratio = fail_runs / max(1, enabled_samples)
    attribution_ratio = 1.0 - (attribution_incomplete_runs / max(1, fail_runs))
    if fail_runs == 0 and fail_stage_total == 0:
        return (
            "stable",
            "No UI-flow gate failures in window; gate mode is stable.",
            "gate",
        )
    if fail_ratio <= 0.2 and attribution_ratio >= 0.9:
        return (
            "watch",
            "Failure ratio is controlled and attribution is mostly complete; keep observe and monitor stage mix.",
            "observe",
        )
    return (
        "unstable",
        "UI-flow failures are elevated or attribution is incomplete; keep observe and fix setup-stage issues first.",
        "observe",
    )


def to_payload(history_dir: Path, days: int, runs: list[UiFlowRun]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    recent = [r for r in runs if r.ts >= window_start]
    if not recent and runs:
        recent = runs[-min(10, len(runs)) :]

    enabled = [r for r in recent if r.enabled]
    fail_runs = [r for r in enabled if r.gate_fail_count > 0]
    pass_runs = [r for r in enabled if r.gate_fail_count <= 0]
    stage_counts: Counter[str] = Counter()
    first_stage_counts: Counter[str] = Counter()
    failure_code_counts: Counter[str] = Counter()
    setup_exit_nonzero = Counter({"open": 0, "resize": 0, "run_code": 0})
    attribution_incomplete_runs = 0
    for run in enabled:
        stage_counts.update(parse_stage_counts(run.stage_counts))
        if run.first_failure_stage:
            first_stage_counts[run.first_failure_stage] += 1
        failure_code_counts.update(run.failure_code_counts)
        if run.open_exit_code != 0:
            setup_exit_nonzero["open"] += 1
        if run.resize_exit_code != 0:
            setup_exit_nonzero["resize"] += 1
        if run.run_code_exit_code != 0:
            setup_exit_nonzero["run_code"] += 1
        if run.gate_fail_count > 0 and not run.attribution_complete:
            attribution_incomplete_runs += 1

    fail_stage_total = sum(stage_counts.values())
    setup_stage_total = int(
        stage_counts.get("open", 0)
        + stage_counts.get("resize", 0)
        + stage_counts.get("run_code", 0)
    )
    flow_stage_total = int(stage_counts.get("flow", 0))
    status, recommendation, recommended_mode = evaluate_status(
        enabled_samples=len(enabled),
        fail_runs=len(fail_runs),
        attribution_incomplete_runs=attribution_incomplete_runs,
        fail_stage_total=fail_stage_total,
    )
    payload = {
        "generated_at": now.isoformat(),
        "history_dir": str(history_dir),
        "days": days,
        "window_start": window_start.isoformat(),
        "samples_total": len(runs),
        "samples_in_window": len(recent),
        "enabled_samples_in_window": len(enabled),
        "status": status,
        "recommendation": recommendation,
        "recommended_gate_mode": recommended_mode,
        "policy": {
            "stable_min_samples": 5,
            "watch_max_fail_ratio": 0.2,
            "watch_min_attribution_ratio": 0.9,
            "rule": "stable: fail_runs==0 and samples>=5; watch: fail_ratio<=0.2 and attribution>=0.9; else unstable",
        },
        "metrics": {
            "run_counts": {
                "enabled": len(enabled),
                "pass": len(pass_runs),
                "fail": len(fail_runs),
            },
            "fail_ratio": (len(fail_runs) / len(enabled)) if enabled else 0.0,
            "attribution_incomplete_runs": attribution_incomplete_runs,
            "attribution_ratio": (
                1.0 - (attribution_incomplete_runs / max(1, len(fail_runs)))
                if fail_runs
                else 1.0
            ),
            "failure_stage_counts": dict(stage_counts),
            "first_failure_stage_counts": dict(first_stage_counts),
            "failure_code_counts": dict(failure_code_counts),
            "setup_exit_nonzero_runs": {
                "open": int(setup_exit_nonzero.get("open", 0)),
                "resize": int(setup_exit_nonzero.get("resize", 0)),
                "run_code": int(setup_exit_nonzero.get("run_code", 0)),
            },
            "setup_stage_total": setup_stage_total,
            "flow_stage_total": flow_stage_total,
        },
        "latest": (
            {
                "ts": enabled[-1].ts.isoformat(),
                "run_id": enabled[-1].run_id,
                "mode": enabled[-1].mode,
            }
            if enabled
            else {}
        ),
        "runs": [
            {
                "ts": run.ts.isoformat(),
                "run_id": run.run_id,
                "enabled": run.enabled,
                "mode": run.mode,
                "status": run.status,
                "gate_run_count": run.gate_run_count,
                "gate_pass_count": run.gate_pass_count,
                "gate_fail_count": run.gate_fail_count,
                "first_failure_stage": run.first_failure_stage,
                "failure_stage_counts": run.stage_counts,
                "failure_code_counts": run.failure_code_counts,
                "attribution_complete": run.attribution_complete,
                "open_exit_code": run.open_exit_code,
                "resize_exit_code": run.resize_exit_code,
                "run_code_exit_code": run.run_code_exit_code,
                "source_file": run.source_file,
            }
            for run in recent[-12:]
        ],
    }
    return payload


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_md(path: Path, payload: dict[str, Any]) -> None:
    metrics = as_dict(payload.get("metrics"))
    run_counts = as_dict(metrics.get("run_counts"))
    stage_counts = as_dict(metrics.get("failure_stage_counts"))
    first_stage_counts = as_dict(metrics.get("first_failure_stage_counts"))
    code_counts = as_dict(metrics.get("failure_code_counts"))
    setup_exit_nonzero = as_dict(metrics.get("setup_exit_nonzero_runs"))
    runs = as_list(payload.get("runs"))

    def fmt_counts(raw: dict[str, Any]) -> str:
        parts = []
        for key in sorted(raw.keys()):
            value = as_int(raw.get(key), 0)
            if value > 0:
                parts.append(f"{key}={value}")
        return " ".join(parts) if parts else "none"

    lines: list[str] = []
    lines.append("# Editor UI Flow Stage Trend")
    lines.append("")
    lines.append(f"- generated_at: `{payload.get('generated_at', '')}`")
    lines.append(f"- history_dir: `{payload.get('history_dir', '')}`")
    lines.append(f"- status: `{payload.get('status', '')}`")
    lines.append(f"- recommendation: `{payload.get('recommendation', '')}`")
    lines.append(f"- recommended_gate_mode: `{payload.get('recommended_gate_mode', 'observe')}`")
    lines.append(
        f"- samples: `{payload.get('enabled_samples_in_window', 0)}` enabled runs in `{payload.get('days', 0)}` day window "
        f"(total `{payload.get('samples_total', 0)}`)"
    )
    lines.append("")
    lines.append("## Metrics")
    lines.append("")
    lines.append(
        "- run_counts: `enabled={enabled}` `pass={passed}` `fail={failed}` `fail_ratio={ratio:.3f}`".format(
            enabled=as_int(run_counts.get("enabled"), 0),
            passed=as_int(run_counts.get("pass"), 0),
            failed=as_int(run_counts.get("fail"), 0),
            ratio=as_float(metrics.get("fail_ratio"), 0.0),
        )
    )
    lines.append(
        "- attribution: `incomplete={incomplete}` `ratio={ratio:.3f}`".format(
            incomplete=as_int(metrics.get("attribution_incomplete_runs"), 0),
            ratio=as_float(metrics.get("attribution_ratio"), 1.0),
        )
    )
    lines.append(
        "- failure_stage_counts: `{stages}` `setup_total={setup}` `flow_total={flow}`".format(
            stages=fmt_counts(stage_counts),
            setup=as_int(metrics.get("setup_stage_total"), 0),
            flow=as_int(metrics.get("flow_stage_total"), 0),
        )
    )
    lines.append(f"- first_failure_stage_counts: `{fmt_counts(first_stage_counts)}`")
    lines.append(f"- failure_code_counts: `{fmt_counts(code_counts)}`")
    lines.append(f"- setup_exit_nonzero_runs: `{fmt_counts(setup_exit_nonzero)}`")
    lines.append("")
    lines.append("## Recent Runs")
    lines.append("")
    lines.append("| ts | run_id | mode | status | gate(pass/fail) | stage_counts | setup_exits | attribution |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in runs:
        row_dict = as_dict(row)
        row_stage_counts = as_dict(row_dict.get("failure_stage_counts"))
        stage_col = fmt_counts(row_stage_counts)
        setup_col = "open={o} resize={r} run={c}".format(
            o=as_int(row_dict.get("open_exit_code"), 0),
            r=as_int(row_dict.get("resize_exit_code"), 0),
            c=as_int(row_dict.get("run_code_exit_code"), 0),
        )
        gate_col = "{p}/{f}".format(
            p=as_int(row_dict.get("gate_pass_count"), 0),
            f=as_int(row_dict.get("gate_fail_count"), 0),
        )
        lines.append(
            "| {ts} | `{run_id}` | `{mode}` | `{status}` | `{gate}` | `{stage}` | `{setup}` | `{attr}` |".format(
                ts=str(row_dict.get("ts", "")),
                run_id=str(row_dict.get("run_id", "")),
                mode=str(row_dict.get("mode", "")),
                status=str(row_dict.get("status", "")),
                gate=gate_col,
                stage=stage_col,
                setup=setup_col,
                attr=bool(row_dict.get("attribution_complete", False)),
            )
        )
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize UI-flow failure stage trend from editor gate history.")
    parser.add_argument("--history-dir", default="build/editor_gate_history")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--out-json", default="build/editor_ui_flow_stage_trend.json")
    parser.add_argument("--out-md", default="build/editor_ui_flow_stage_trend.md")
    args = parser.parse_args()

    history_dir = Path(args.history_dir).resolve()
    out_json = Path(args.out_json).resolve()
    out_md = Path(args.out_md).resolve()
    days = max(1, int(args.days))

    runs = load_history_runs(history_dir)
    payload = to_payload(history_dir, days, runs)
    write_json(out_json, payload)
    write_md(out_md, payload)

    print(f"ui_flow_stage_trend_json={out_json}")
    print(f"ui_flow_stage_trend_md={out_md}")
    print(f"ui_flow_stage_trend_status={payload.get('status', '')}")
    print(f"ui_flow_stage_trend_gate_mode={payload.get('recommended_gate_mode', 'observe')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
