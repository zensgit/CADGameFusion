#!/usr/bin/env python3
"""
Compute an observe->gate policy recommendation for Qt project persistence checks.

Usage:
  python3 tools/qt_project_persistence_gate_policy.py \
    --history-dir build/editor_gate_history \
    --days 14 \
    --min-samples 5 \
    --min-consecutive-passes 3 \
    --out-json build/qt_project_persistence_gate_policy.json \
    --out-md build/qt_project_persistence_gate_policy.md
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def parse_time(text: Any) -> datetime | None:
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


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in ("1", "true", "yes", "on")


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


@dataclass
class QtRun:
    ts: datetime
    source_file: str
    run_id: str
    mode: str
    status: str
    reason: str
    gate_required: bool
    require_on: bool
    target_available: bool
    exit_code: int


def load_history_runs(history_dir: Path) -> list[QtRun]:
    runs: list[QtRun] = []
    if not history_dir.exists():
        return runs

    for path in sorted(history_dir.glob("gate_*.json")):
        payload = load_json(path)
        qt = as_dict(payload.get("qt_project_persistence"))
        if not qt:
            continue
        ts = parse_time(payload.get("generated_at"))
        if ts is None:
            ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        runs.append(
            QtRun(
                ts=ts,
                source_file=str(path),
                run_id=str(qt.get("run_id") or ""),
                mode=str(qt.get("mode") or "skipped"),
                status=str(qt.get("status") or "unknown"),
                reason=str(qt.get("reason") or ""),
                gate_required=as_bool(qt.get("gate_required")),
                require_on=as_bool(qt.get("require_on")),
                target_available=as_bool(qt.get("target_available")),
                exit_code=int(qt.get("exit_code") or 0),
            )
        )

    runs.sort(key=lambda row: row.ts)
    return runs


def count_consecutive_target_passes(runs: list[QtRun]) -> int:
    count = 0
    for row in reversed(runs):
        if row.target_available and row.status == "pass" and row.exit_code == 0:
            count += 1
            continue
        break
    return count


def evaluate_policy(runs: list[QtRun], min_samples: int, min_consecutive_passes: int) -> tuple[str, bool, str]:
    if not runs:
        return ("no_data", False, "No qt_project_persistence data found in window.")

    target_runs = [row for row in runs if row.target_available]
    target_pass_runs = [row for row in target_runs if row.status == "pass" and row.exit_code == 0]
    fail_runs = [row for row in runs if row.status == "fail" or row.exit_code != 0]
    consecutive_target_passes = count_consecutive_target_passes(runs)

    if len(runs) < min_samples:
        return (
            "observe",
            False,
            f"Need >= {min_samples} samples before enabling require_on=1.",
        )

    if fail_runs:
        return (
            "watch",
            False,
            "Recent Qt persistence failures present; keep require_on=0 until stable.",
        )

    if len(target_runs) <= 0:
        return (
            "observe",
            False,
            "No target-available Qt runs in window; keep require_on=0.",
        )

    if consecutive_target_passes < min_consecutive_passes:
        return (
            "observe",
            False,
            f"Need {min_consecutive_passes} consecutive target-available PASS runs; now {consecutive_target_passes}.",
        )

    if len(target_pass_runs) < min_consecutive_passes:
        return (
            "observe",
            False,
            f"Need >= {min_consecutive_passes} target-available PASS samples; now {len(target_pass_runs)}.",
        )

    return (
        "ready",
        True,
        "Qt target-available runs are stable; require_on=1 can be enabled.",
    )


def to_payload(
    history_dir: Path,
    days: int,
    min_samples: int,
    min_consecutive_passes: int,
    all_runs: list[QtRun],
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    runs = [row for row in all_runs if row.ts >= window_start]
    if not runs and all_runs:
        runs = all_runs[-min(10, len(all_runs)) :]

    status, recommended_require_on, recommendation = evaluate_policy(
        runs, min_samples=min_samples, min_consecutive_passes=min_consecutive_passes
    )

    status_counts: dict[str, int] = {}
    reason_counts: dict[str, int] = {}
    for row in runs:
        status_counts[row.status] = int(status_counts.get(row.status, 0)) + 1
        if row.reason:
            reason_counts[row.reason] = int(reason_counts.get(row.reason, 0)) + 1

    target_runs = [row for row in runs if row.target_available]
    target_pass_runs = [row for row in target_runs if row.status == "pass" and row.exit_code == 0]
    target_fail_runs = [row for row in target_runs if row.status == "fail" or row.exit_code != 0]
    consecutive_target_passes = count_consecutive_target_passes(runs)

    return {
        "generated_at": now.isoformat(),
        "history_dir": str(history_dir),
        "days": int(days),
        "window_start": window_start.isoformat(),
        "samples_total": len(all_runs),
        "samples_in_window": len(runs),
        "status": status,
        "recommendation": recommendation,
        "policy": {
            "recommended_require_on": bool(recommended_require_on),
            "run_qt_project_persistence_check": True,
            "run_qt_project_persistence_gate": True,
            "rule": (
                "require_on=1 only when there are sufficient recent samples, "
                "no fail runs, and consecutive target-available PASS runs reach threshold"
            ),
            "thresholds": {
                "min_samples": int(min_samples),
                "min_consecutive_target_passes": int(min_consecutive_passes),
            },
        },
        "metrics": {
            "status_counts": status_counts,
            "reason_counts": reason_counts,
            "target_available_runs": len(target_runs),
            "target_available_pass_runs": len(target_pass_runs),
            "target_available_fail_runs": len(target_fail_runs),
            "consecutive_target_available_pass_runs": int(consecutive_target_passes),
        },
        "latest": (
            {
                "ts": runs[-1].ts.isoformat(),
                "run_id": runs[-1].run_id,
                "status": runs[-1].status,
                "reason": runs[-1].reason,
                "target_available": runs[-1].target_available,
            }
            if runs
            else {}
        ),
        "runs": [
            {
                "ts": row.ts.isoformat(),
                "run_id": row.run_id,
                "mode": row.mode,
                "status": row.status,
                "reason": row.reason,
                "gate_required": row.gate_required,
                "require_on": row.require_on,
                "target_available": row.target_available,
                "exit_code": int(row.exit_code),
                "source_file": row.source_file,
            }
            for row in runs[-10:]
        ],
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_md(path: Path, payload: dict[str, Any]) -> None:
    policy = as_dict(payload.get("policy"))
    metrics = as_dict(payload.get("metrics"))
    thresholds = as_dict(policy.get("thresholds"))
    status_counts = as_dict(metrics.get("status_counts"))
    reason_counts = as_dict(metrics.get("reason_counts"))
    runs = payload.get("runs") if isinstance(payload.get("runs"), list) else []

    status_parts = [f"{key}={status_counts[key]}" for key in sorted(status_counts.keys())]
    reason_parts = [f"{key}={reason_counts[key]}" for key in sorted(reason_counts.keys())]

    lines: list[str] = []
    lines.append("# Qt Project Persistence Gate Policy")
    lines.append("")
    lines.append(f"- generated_at: `{payload.get('generated_at', '')}`")
    lines.append(f"- history_dir: `{payload.get('history_dir', '')}`")
    lines.append(f"- status: `{payload.get('status', '')}`")
    lines.append(f"- recommendation: `{payload.get('recommendation', '')}`")
    lines.append(f"- recommended_require_on: `{policy.get('recommended_require_on', False)}`")
    lines.append(
        f"- thresholds: `min_samples={thresholds.get('min_samples', 0)}` "
        f"`min_consecutive_target_passes={thresholds.get('min_consecutive_target_passes', 0)}`"
    )
    lines.append(
        f"- samples: `{payload.get('samples_in_window', 0)}` in `{payload.get('days', 0)}` day window "
        f"(total `{payload.get('samples_total', 0)}`)"
    )
    lines.append(
        f"- target_available: `runs={metrics.get('target_available_runs', 0)}` "
        f"`pass={metrics.get('target_available_pass_runs', 0)}` "
        f"`fail={metrics.get('target_available_fail_runs', 0)}` "
        f"`consecutive_pass={metrics.get('consecutive_target_available_pass_runs', 0)}`"
    )
    lines.append(f"- status_counts: `{', '.join(status_parts) if status_parts else 'none'}`")
    lines.append(f"- reason_counts: `{', '.join(reason_parts) if reason_parts else 'none'}`")
    lines.append("")
    lines.append("## Recent Runs")
    lines.append("")
    lines.append("| ts | run_id | mode | status | reason | target_available | require_on |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    for row in runs:
        lines.append(
            "| {ts} | `{run_id}` | `{mode}` | `{status}` | `{reason}` | `{target}` | `{require_on}` |".format(
                ts=str(row.get("ts", "")),
                run_id=str(row.get("run_id", "")),
                mode=str(row.get("mode", "")),
                status=str(row.get("status", "")),
                reason=str(row.get("reason", "")),
                target=bool(row.get("target_available", False)),
                require_on=bool(row.get("require_on", False)),
            )
        )
    lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compute Qt persistence gate policy from editor gate history.")
    parser.add_argument("--history-dir", default="build/editor_gate_history")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--min-samples", type=int, default=5)
    parser.add_argument("--min-consecutive-passes", type=int, default=3)
    parser.add_argument("--out-json", default="build/qt_project_persistence_gate_policy.json")
    parser.add_argument("--out-md", default="build/qt_project_persistence_gate_policy.md")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    history_dir = Path(args.history_dir).resolve()
    out_json = Path(args.out_json).resolve()
    out_md = Path(args.out_md).resolve()

    all_runs = load_history_runs(history_dir)
    payload = to_payload(
        history_dir=history_dir,
        days=max(1, int(args.days)),
        min_samples=max(1, int(args.min_samples)),
        min_consecutive_passes=max(1, int(args.min_consecutive_passes)),
        all_runs=all_runs,
    )
    write_json(out_json, payload)
    write_md(out_md, payload)

    policy = as_dict(payload.get("policy"))
    print(f"qt_policy_status={payload.get('status', '')}")
    print(f"qt_policy_recommended_require_on={'1' if policy.get('recommended_require_on') else '0'}")
    print(f"qt_policy_summary_json={out_json}")
    print(f"qt_policy_summary_md={out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
