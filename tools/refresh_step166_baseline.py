#!/usr/bin/env python3
"""
Refresh STEP166 baseline summary when the recent observe window is stable.

Policy (default):
- Look at the latest run per UTC day under build/cad_regression/<run_id>/summary.json
- Require N consecutive days (default: 5) with a stable latest run:
  - totals.fail == 0
  - gate_decision.would_fail == false
  - failure_buckets sum == 0
  - when a baseline exists, require the run to have compared against that baseline (same baseline version):
    - baseline_compare.baseline_file matches the current baseline path
    - baseline_compare.baseline_run_id matches the current baseline run_id
    - baseline_compare.compared_cases > 0
  - metrics_by_case length >= current baseline metrics_by_case length (when baseline exists)
- Promote the most recent stable run's summary.json as docs/baselines/STEP166_baseline_summary.json

Usage:
  python3 tools/refresh_step166_baseline.py --dry-run
  python3 tools/refresh_step166_baseline.py --apply
"""

from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}


def parse_time(text: Any) -> datetime | None:
    raw = str(text or "").strip()
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


def bucket_total(buckets: dict[str, Any]) -> int:
    return sum(as_int(v, 0) for v in buckets.values())


@dataclass
class Step166Run:
    ts: datetime
    day: str
    run_id: str
    summary_path: Path
    stable: bool
    stable_reason: str
    totals_fail: int
    bucket_total: int
    gate_would_fail: bool
    metrics_count: int
    baseline_file: str
    baseline_run_id: str
    baseline_compared_cases: int


def is_stable(
    summary: dict[str, Any],
    baseline_metrics_count: int,
    baseline_path: Path | None,
    baseline_run_id: str,
) -> tuple[bool, str]:
    totals = as_dict(summary.get("totals"))
    buckets = as_dict(summary.get("failure_buckets"))
    gate = as_dict(summary.get("gate_decision"))
    baseline_compare = as_dict(summary.get("baseline_compare"))
    metrics = summary.get("metrics_by_case") if isinstance(summary.get("metrics_by_case"), list) else []

    totals_fail = as_int(totals.get("fail"), 0)
    if totals_fail != 0:
        return False, f"totals.fail={totals_fail}"

    bucket_sum = bucket_total(buckets)
    if bucket_sum != 0:
        return False, f"failure_buckets.sum={bucket_sum}"

    if to_bool(gate.get("would_fail")):
        return False, "gate_decision.would_fail=true"

    # Baseline refresh must not promote runs that didn't actually compare against the current baseline.
    if baseline_metrics_count > 0:
        expected = baseline_path.resolve() if baseline_path else None
        baseline_file = str(baseline_compare.get("baseline_file") or "").strip()
        observed_run_id = str(baseline_compare.get("baseline_run_id") or "").strip()
        compared_cases = as_int(baseline_compare.get("compared_cases"), 0)
        if not baseline_file:
            return False, "baseline_compare.baseline_file missing (run did not compare baseline?)"
        if baseline_run_id and observed_run_id != baseline_run_id:
            if not observed_run_id:
                return False, "baseline_compare.baseline_run_id missing (run did not compare baseline?)"
            return False, f"baseline_compare.baseline_run_id mismatch ({observed_run_id})"
        if expected and Path(baseline_file).resolve() != expected:
            return False, f"baseline_compare.baseline_file mismatch ({baseline_file})"
        if compared_cases <= 0:
            return False, f"baseline_compare.compared_cases={compared_cases}"

    if baseline_metrics_count > 0 and len(metrics) < baseline_metrics_count:
        return False, f"metrics_by_case too small ({len(metrics)} < {baseline_metrics_count})"

    return True, "ok"

def run_baseline_compatible(run: Step166Run, baseline_path: Path | None, baseline_run_id: str) -> bool:
    if not baseline_path or not baseline_run_id:
        return False
    baseline_file = str(run.baseline_file or "").strip()
    if not baseline_file:
        return False
    try:
        if Path(baseline_file).resolve() != baseline_path.resolve():
            return False
    except Exception:
        return False
    if str(run.baseline_run_id or "").strip() != baseline_run_id:
        return False
    return run.baseline_compared_cases > 0


def load_runs(
    history_dir: Path,
    baseline_metrics_count: int,
    baseline_path: Path | None,
    baseline_run_id: str,
) -> list[Step166Run]:
    out: list[Step166Run] = []
    if not history_dir.exists():
        return out
    for run_dir in sorted(history_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        run_id = run_dir.name
        summary_path = run_dir / "summary.json"
        if not summary_path.exists():
            continue
        payload = load_json(summary_path)
        ts = parse_time(payload.get("started_at")) or datetime.fromtimestamp(summary_path.stat().st_mtime, tz=timezone.utc)
        day = ts.date().isoformat()
        stable, stable_reason = is_stable(payload, baseline_metrics_count, baseline_path, baseline_run_id)
        totals = as_dict(payload.get("totals"))
        buckets = as_dict(payload.get("failure_buckets"))
        gate = as_dict(payload.get("gate_decision"))
        baseline_compare = as_dict(payload.get("baseline_compare"))
        metrics = payload.get("metrics_by_case") if isinstance(payload.get("metrics_by_case"), list) else []

        out.append(
            Step166Run(
                ts=ts,
                day=day,
                run_id=str(payload.get("run_id") or run_id),
                summary_path=summary_path,
                stable=stable,
                stable_reason=stable_reason,
                totals_fail=as_int(totals.get("fail"), 0),
                bucket_total=bucket_total(buckets) if buckets else 0,
                gate_would_fail=to_bool(gate.get("would_fail")) if gate else False,
                metrics_count=len(metrics),
                baseline_file=str(baseline_compare.get("baseline_file") or ""),
                baseline_run_id=str(baseline_compare.get("baseline_run_id") or ""),
                baseline_compared_cases=as_int(baseline_compare.get("compared_cases"), 0),
            )
        )
    out.sort(key=lambda r: r.ts)
    return out


def pick_latest_per_day(runs: list[Step166Run]) -> list[Step166Run]:
    latest: dict[str, Step166Run] = {}
    for r in runs:
        prev = latest.get(r.day)
        if prev is None or r.ts > prev.ts:
            latest[r.day] = r
    return sorted(latest.values(), key=lambda r: r.ts)


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh STEP166 baseline when recent observe window is stable.")
    parser.add_argument("--history-dir", default="build/cad_regression", help="Directory containing STEP166 run folders.")
    parser.add_argument("--baseline", default="docs/baselines/STEP166_baseline_summary.json", help="Baseline file path.")
    parser.add_argument("--days", type=int, default=5, help="Required consecutive stable days.")
    parser.add_argument("--apply", action="store_true", help="Apply baseline update (default: dry-run).")
    parser.add_argument("--dry-run", action="store_true", help="Dry run (no writes).")
    parser.add_argument(
        "--allow-same-day-apply",
        action="store_true",
        help="Allow applying a new baseline multiple times within the same UTC day (default: skip to avoid churn).",
    )
    args = parser.parse_args()

    history_dir = Path(args.history_dir).resolve()
    baseline_path = Path(args.baseline).resolve()
    days_required = max(1, int(args.days or 5))
    do_apply = bool(args.apply) and not bool(args.dry_run)

    baseline_metrics_count = 0
    baseline_payload = load_json(baseline_path)
    baseline_metrics = baseline_payload.get("metrics_by_case") if isinstance(baseline_payload.get("metrics_by_case"), list) else []
    baseline_metrics_count = len(baseline_metrics)
    baseline_run_id = str(baseline_payload.get("run_id") or "")
    baseline_ts = parse_time(baseline_payload.get("started_at")) or parse_time(baseline_payload.get("finished_at"))
    baseline_day = baseline_ts.date().isoformat() if baseline_ts else ""

    runs = load_runs(
        history_dir,
        baseline_metrics_count,
        baseline_path if baseline_metrics_count > 0 else None,
        baseline_run_id,
    )

    # When a baseline exists, prefer runs that actually compared against that baseline (by path + run_id).
    # This prevents a late "no-baseline" dev run from masking the day and blocking refresh eligibility.
    if baseline_metrics_count > 0 and baseline_path.exists() and baseline_run_id:
        runs = [r for r in runs if run_baseline_compatible(r, baseline_path, baseline_run_id)]

    daily = pick_latest_per_day(runs)

    # Policy: require N consecutive UTC days (no gaps) ending at the most recent day with data.
    daily_by_day = {r.day: r for r in daily}
    window: list[Step166Run] = []
    window_report: list[dict[str, Any]] = []
    candidate_day: datetime | None = daily[-1].ts if daily else None
    if candidate_day:
        start = candidate_day.date()
        for offset in range(days_required):
            day_key = (start - timedelta(days=offset)).isoformat()
            run = daily_by_day.get(day_key)
            row: dict[str, Any] = {
                "day": day_key,
                "present": run is not None,
            }
            if run is not None:
                row.update(
                    {
                        "run_id": run.run_id,
                        "stable": run.stable,
                        "stable_reason": run.stable_reason,
                        "totals_fail": run.totals_fail,
                        "bucket_total": run.bucket_total,
                        "gate_would_fail": run.gate_would_fail,
                        "metrics_count": run.metrics_count,
                        "baseline_compared_cases": run.baseline_compared_cases,
                        "baseline_run_id": run.baseline_run_id,
                        "baseline_file": run.baseline_file,
                        "summary_json": str(run.summary_path),
                    }
                )
            window_report.append(row)
            if not run:
                break
            window.append(run)
        window.reverse()
        window_report.reverse()

    eligible = len(window) >= days_required and all(r.stable for r in window)
    reason = ""
    if len(window) < days_required:
        missing_day = ""
        if candidate_day:
            need_day = (candidate_day.date() - timedelta(days=len(window))).isoformat()
            missing_day = f" missing_day={need_day}"
        reason = f"not enough consecutive days: have={len(window)} need={days_required}{missing_day}"
    else:
        for r in window:
            if not r.stable:
                payload = load_json(r.summary_path)
                ok, why = is_stable(
                    payload,
                    baseline_metrics_count,
                    baseline_path if baseline_metrics_count > 0 else None,
                    baseline_run_id,
                )
                assert ok is False
                reason = f"day={r.day} run_id={r.run_id} unstable: {why}"
                break
        if not reason:
            reason = "ok"

    candidate = window[-1] if eligible else None
    applied = False
    backup_path: Path | None = None

    if eligible and candidate and do_apply:
        if baseline_run_id and baseline_run_id == candidate.run_id:
            # Avoid noisy archive growth when re-applying the same baseline.
            applied = False
            reason = "baseline already up-to-date"
        elif not bool(args.allow_same_day_apply) and baseline_day and baseline_day == candidate.day:
            applied = False
            reason = f"skip apply: candidate_day matches baseline_day ({candidate.day})"
        else:
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
            archive_dir = baseline_path.parent / "archive"
            archive_dir.mkdir(parents=True, exist_ok=True)
            if baseline_path.exists():
                backup_path = archive_dir / f"STEP166_baseline_summary_{candidate.run_id}_prev.json"
                shutil.copy2(baseline_path, backup_path)
            shutil.copy2(candidate.summary_path, baseline_path)
            applied = True

    # Machine-readable output for scripts.
    print(f"eligible={str(eligible).lower()}")
    print(f"days_required={days_required}")
    print(f"days_available={len(window)}")
    print(f"history_dir={history_dir}")
    print(f"baseline_path={baseline_path}")
    print(f"baseline_day={baseline_day}")
    print(f"baseline_metrics_count={baseline_metrics_count}")
    print(f"window_anchor_day={candidate_day.date().isoformat() if candidate_day else ''}")
    print(f"window_report_json={json.dumps(window_report, ensure_ascii=False)}")
    print(f"reason={reason}")
    if candidate:
        print(f"candidate_run_id={candidate.run_id}")
        print(f"candidate_day={candidate.day}")
        print(f"candidate_summary_json={candidate.summary_path}")
        print(f"candidate_metrics_count={candidate.metrics_count}")
    print(f"applied={str(applied).lower()}")
    if backup_path:
        print(f"backup_path={backup_path}")

    return 0 if eligible else 1


if __name__ == "__main__":
    raise SystemExit(main())
