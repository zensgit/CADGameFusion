#!/usr/bin/env python3
"""
Aggregate editor gate history into a 7-day trend summary.

Usage:
  python3 tools/editor_gate_trend.py \
    --history-dir build/editor_gate_history \
    --days 7 \
    --out-json build/editor_gate_trend.json \
    --out-md build/editor_gate_trend.md
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from collections import Counter


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


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


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


def bucket_total(buckets: dict[str, Any]) -> int:
    return sum(as_int(v, 0) for v in buckets.values())


@dataclass
class GateRun:
    ts: datetime
    source_file: str
    editor_run_id: str
    step166_run_id: str
    editor_fail: int
    step166_fail: int
    editor_would_fail: bool
    step166_would_fail: bool
    editor_bucket_total: int
    step166_bucket_total: int
    editor_case_source: str
    editor_selected_count: int
    editor_matched_count: int
    editor_total_input: int
    editor_used_fallback: bool
    generated_count_declared: int
    generated_count_actual: int
    generated_count_mismatch: bool


def load_history_runs(history_dir: Path) -> list[GateRun]:
    out: list[GateRun] = []
    if not history_dir.exists():
        return out
    for path in sorted(history_dir.glob("*.json")):
        data = load_json(path)
        ts = parse_time(data.get("generated_at"))
        if ts is None:
            ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

        editor = as_dict(data.get("editor_smoke"))
        step166 = as_dict(data.get("step166"))
        editor_totals = as_dict(editor.get("totals"))
        step_totals = as_dict(step166.get("totals"))
        editor_buckets = as_dict(editor.get("failure_buckets"))
        step_buckets = as_dict(step166.get("failure_buckets"))
        editor_decision = as_dict(editor.get("gate_decision"))
        step_decision = as_dict(step166.get("gate_decision"))
        selection = as_dict(editor.get("case_selection"))

        out.append(
            GateRun(
                ts=ts,
                source_file=str(path),
                editor_run_id=str(editor.get("run_id") or ""),
                step166_run_id=str(step166.get("run_id") or ""),
                editor_fail=as_int(editor_totals.get("fail"), 0),
                step166_fail=as_int(step_totals.get("fail"), 0),
                editor_would_fail=to_bool(editor_decision.get("would_fail")),
                step166_would_fail=to_bool(step_decision.get("would_fail")),
                editor_bucket_total=bucket_total(editor_buckets),
                step166_bucket_total=bucket_total(step_buckets),
                editor_case_source=str(editor.get("case_source") or "discovery"),
                editor_selected_count=as_int(selection.get("selected_count"), 0),
                editor_matched_count=as_int(selection.get("matched_count"), 0),
                editor_total_input=as_int(selection.get("total_input"), 0),
                editor_used_fallback=to_bool(selection.get("used_fallback")),
                generated_count_declared=as_int(editor.get("generated_count_declared"), as_int(editor.get("generated_count"), 0)),
                generated_count_actual=as_int(editor.get("generated_count_actual"), as_int(editor.get("generated_count"), 0)),
                generated_count_mismatch=to_bool(editor.get("generated_count_mismatch")),
            )
        )
    out.sort(key=lambda x: x.ts)
    return out


def summarize_case_quality(runs: list[GateRun]) -> dict[str, Any]:
    samples = len(runs)
    with_selection = [r for r in runs if r.editor_total_input > 0]
    selected_total = sum(r.editor_selected_count for r in with_selection)
    matched_total = sum(r.editor_matched_count for r in with_selection)
    input_total = sum(r.editor_total_input for r in with_selection)
    fallback_runs = sum(1 for r in with_selection if r.editor_used_fallback)
    mismatch_runs = sum(1 for r in runs if r.generated_count_mismatch)
    mismatch_rate = (mismatch_runs / samples) if samples > 0 else 0.0
    mismatch_declared_total = sum(r.generated_count_declared for r in runs)
    mismatch_actual_total = sum(r.generated_count_actual for r in runs)
    source_counts = Counter(str(r.editor_case_source or "discovery") for r in runs)
    risky_source_runs = int(source_counts.get("fixture", 0) + source_counts.get("auto-local", 0))
    return {
        "samples_with_selection": len(with_selection),
        "selected_total": int(selected_total),
        "matched_total": int(matched_total),
        "input_total": int(input_total),
        "matched_ratio": (matched_total / input_total) if input_total > 0 else 0.0,
        "selected_ratio": (selected_total / input_total) if input_total > 0 else 0.0,
        "fallback_runs": int(fallback_runs),
        "fallback_rate": (fallback_runs / len(with_selection)) if with_selection else 0.0,
        "generated_count_mismatch_runs": int(mismatch_runs),
        "generated_count_mismatch_rate": mismatch_rate,
        "generated_count_declared_total": int(mismatch_declared_total),
        "generated_count_actual_total": int(mismatch_actual_total),
        "source_counts": dict(source_counts),
        "risky_source_runs": int(risky_source_runs),
        "risky_source_rate": (risky_source_runs / samples) if samples > 0 else 0.0,
    }


def evaluate_status(runs: list[GateRun], case_quality: dict[str, Any]) -> tuple[str, str, int, bool, dict[str, bool]]:
    if not runs:
        return (
            "no_data",
            "Collect more gate history before enabling stricter thresholds.",
            5,
            False,
            {
                "core_stable": False,
                "selection_stable": False,
                "provenance_stable": False,
            },
        )

    samples = len(runs)
    editor_gate_fail = sum(1 for r in runs if r.editor_would_fail)
    step_gate_fail = sum(1 for r in runs if r.step166_would_fail)
    hard_fail_runs = sum(
        1
        for r in runs
        if r.editor_fail > 0
        or r.step166_fail > 0
        or r.editor_bucket_total > 0
        or r.step166_bucket_total > 0
    )

    core_stable = samples >= 5 and editor_gate_fail == 0 and step_gate_fail == 0 and hard_fail_runs == 0
    matched_ratio = as_float(case_quality.get("matched_ratio"), 0.0)
    fallback_rate = as_float(case_quality.get("fallback_rate"), 0.0)
    risky_source_rate = as_float(case_quality.get("risky_source_rate"), 0.0)
    mismatch_rate = as_float(case_quality.get("generated_count_mismatch_rate"), 0.0)
    selection_stable = matched_ratio >= 0.8 and fallback_rate <= 0.1
    provenance_stable = risky_source_rate <= 0.1 and mismatch_rate <= 0.0
    promotion_ready = core_stable and selection_stable and provenance_stable and samples >= 10
    recommended_gate_limit = 8 if promotion_ready else 5

    if core_stable:
        if not selection_stable:
            return (
                "watch",
                "Core gate is stable, but case-selection quality is not stable yet; keep limit=5 and observe.",
                recommended_gate_limit,
                promotion_ready,
                {
                    "core_stable": core_stable,
                    "selection_stable": selection_stable,
                    "provenance_stable": provenance_stable,
                },
            )
        if not provenance_stable:
            return (
                "watch",
                "Core gate is stable, but case-source risk is elevated (fixture/auto-local usage or generated mismatch); keep limit=5.",
                recommended_gate_limit,
                promotion_ready,
                {
                    "core_stable": core_stable,
                    "selection_stable": selection_stable,
                    "provenance_stable": provenance_stable,
                },
            )
        if promotion_ready:
            return (
                "stable",
                "Stable window reached; recommended to run standard gate at limit=8.",
                recommended_gate_limit,
                promotion_ready,
                {
                    "core_stable": core_stable,
                    "selection_stable": selection_stable,
                    "provenance_stable": provenance_stable,
                },
            )
        return (
            "stable",
            "Keep gate enabled at limit=5; consider raising to limit=8 after one more stable week.",
            recommended_gate_limit,
            promotion_ready,
            {
                "core_stable": core_stable,
                "selection_stable": selection_stable,
                "provenance_stable": provenance_stable,
            },
        )

    fail_ratio = (editor_gate_fail + step_gate_fail + hard_fail_runs) / max(1, samples * 3)
    if fail_ratio <= 0.15:
        return (
            "watch",
            "Keep observe+gate dual runs and review drift buckets before tightening thresholds.",
            recommended_gate_limit,
            promotion_ready,
            {
                "core_stable": core_stable,
                "selection_stable": selection_stable,
                "provenance_stable": provenance_stable,
            },
        )

    return (
        "unstable",
        "Do not tighten gate; fix failures first and re-check with at least 5 fresh runs.",
        recommended_gate_limit,
        promotion_ready,
        {
            "core_stable": core_stable,
            "selection_stable": selection_stable,
            "provenance_stable": provenance_stable,
        },
    )


def to_payload(history_dir: Path, days: int, runs: list[GateRun]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    recent = [r for r in runs if r.ts >= window_start]
    if not recent and runs:
        recent = runs[-min(10, len(runs)) :]

    case_quality = summarize_case_quality(recent)
    status, recommendation, recommended_gate_limit, promotion_ready, preconditions = evaluate_status(recent, case_quality)
    payload = {
        "generated_at": now.isoformat(),
        "history_dir": str(history_dir),
        "days": days,
        "window_start": window_start.isoformat(),
        "samples_total": len(runs),
        "samples_in_window": len(recent),
        "status": status,
        "recommendation": recommendation,
        "gate_limit_policy": {
            "recommended_gate_limit": int(recommended_gate_limit),
            "promotion_ready": bool(promotion_ready),
            "preconditions": preconditions,
            "rule": "core_stable + selection_stable + provenance_stable + samples>=10 -> limit=8; otherwise limit=5",
        },
        "metrics": {
            "editor_gate_would_fail_runs": sum(1 for r in recent if r.editor_would_fail),
            "step166_gate_would_fail_runs": sum(1 for r in recent if r.step166_would_fail),
            "editor_fail_sum": sum(r.editor_fail for r in recent),
            "step166_fail_sum": sum(r.step166_fail for r in recent),
            "editor_bucket_sum": sum(r.editor_bucket_total for r in recent),
            "step166_bucket_sum": sum(r.step166_bucket_total for r in recent),
            "case_selection": {
                "samples_with_selection": as_int(case_quality.get("samples_with_selection"), 0),
                "selected_total": as_int(case_quality.get("selected_total"), 0),
                "matched_total": as_int(case_quality.get("matched_total"), 0),
                "input_total": as_int(case_quality.get("input_total"), 0),
                "matched_ratio": as_float(case_quality.get("matched_ratio"), 0.0),
                "selected_ratio": as_float(case_quality.get("selected_ratio"), 0.0),
                "fallback_runs": as_int(case_quality.get("fallback_runs"), 0),
                "fallback_rate": as_float(case_quality.get("fallback_rate"), 0.0),
            },
            "case_source": {
                "counts": case_quality.get("source_counts", {}),
                "risky_source_runs": as_int(case_quality.get("risky_source_runs"), 0),
                "risky_source_rate": as_float(case_quality.get("risky_source_rate"), 0.0),
                "generated_count_mismatch_runs": as_int(case_quality.get("generated_count_mismatch_runs"), 0),
                "generated_count_mismatch_rate": as_float(case_quality.get("generated_count_mismatch_rate"), 0.0),
                "generated_count_declared_total": as_int(case_quality.get("generated_count_declared_total"), 0),
                "generated_count_actual_total": as_int(case_quality.get("generated_count_actual_total"), 0),
            },
        },
        "latest": (
            {
                "ts": recent[-1].ts.isoformat(),
                "editor_run_id": recent[-1].editor_run_id,
                "step166_run_id": recent[-1].step166_run_id,
            }
            if recent
            else {}
        ),
        "runs": [
            {
                "ts": r.ts.isoformat(),
                "editor_run_id": r.editor_run_id,
                "step166_run_id": r.step166_run_id,
                "editor_fail": r.editor_fail,
                "step166_fail": r.step166_fail,
                "editor_would_fail": r.editor_would_fail,
                "step166_would_fail": r.step166_would_fail,
                "editor_case_source": r.editor_case_source,
                "case_selection": {
                    "selected_count": r.editor_selected_count,
                    "matched_count": r.editor_matched_count,
                    "total_input": r.editor_total_input,
                    "used_fallback": r.editor_used_fallback,
                },
                "generated_count_declared": r.generated_count_declared,
                "generated_count_actual": r.generated_count_actual,
                "generated_count_mismatch": r.generated_count_mismatch,
                "source_file": r.source_file,
            }
            for r in recent[-10:]
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
    gate_policy = as_dict(payload.get("gate_limit_policy"))
    preconditions = as_dict(gate_policy.get("preconditions"))
    case_selection = as_dict(metrics.get("case_selection"))
    case_source = as_dict(metrics.get("case_source"))
    source_counts = as_dict(case_source.get("counts"))
    runs = payload.get("runs") or []
    lines: list[str] = []
    lines.append("# Editor Gate Trend")
    lines.append("")
    lines.append(f"- generated_at: `{payload.get('generated_at', '')}`")
    lines.append(f"- history_dir: `{payload.get('history_dir', '')}`")
    lines.append(f"- status: `{payload.get('status', '')}`")
    lines.append(f"- recommendation: `{payload.get('recommendation', '')}`")
    lines.append(
        f"- recommended_gate_limit: `{gate_policy.get('recommended_gate_limit', 5)}` "
        f"(promotion_ready=`{gate_policy.get('promotion_ready', False)}`)"
    )
    lines.append(
        f"- samples: `{payload.get('samples_in_window', 0)}` in `{payload.get('days', 0)}` day window "
        f"(total `{payload.get('samples_total', 0)}`)"
    )
    lines.append("")
    lines.append("## Metrics")
    lines.append("")
    lines.append(f"- editor_gate_would_fail_runs: `{metrics.get('editor_gate_would_fail_runs', 0)}`")
    lines.append(f"- step166_gate_would_fail_runs: `{metrics.get('step166_gate_would_fail_runs', 0)}`")
    lines.append(f"- editor_fail_sum: `{metrics.get('editor_fail_sum', 0)}`")
    lines.append(f"- step166_fail_sum: `{metrics.get('step166_fail_sum', 0)}`")
    lines.append(
        "- gate_switch_preconditions: `core_stable={core}` `selection_stable={selection}` `provenance_stable={provenance}`".format(
            core=bool(preconditions.get("core_stable", False)),
            selection=bool(preconditions.get("selection_stable", False)),
            provenance=bool(preconditions.get("provenance_stable", False)),
        )
    )
    lines.append(
        "- case_selection: `matched_ratio={matched:.3f}` `selected_ratio={selected:.3f}` `fallback_rate={fallback:.3f}` (`runs={runs}`)".format(
            matched=as_float(case_selection.get("matched_ratio"), 0.0),
            selected=as_float(case_selection.get("selected_ratio"), 0.0),
            fallback=as_float(case_selection.get("fallback_rate"), 0.0),
            runs=as_int(case_selection.get("samples_with_selection"), 0),
        )
    )
    lines.append(
        "- case_source: `risky_source_rate={risky:.3f}` counts=`{counts}`".format(
            risky=as_float(case_source.get("risky_source_rate"), 0.0),
            counts=" ".join(f"{k}={source_counts[k]}" for k in sorted(source_counts.keys())) if source_counts else "none",
        )
    )
    lines.append(
        "- generated_case_provenance: `mismatch_rate={rate:.3f}` `mismatch_runs={runs}` `declared_total={declared}` `actual_total={actual}`".format(
            rate=as_float(case_source.get("generated_count_mismatch_rate"), 0.0),
            runs=as_int(case_source.get("generated_count_mismatch_runs"), 0),
            declared=as_int(case_source.get("generated_count_declared_total"), 0),
            actual=as_int(case_source.get("generated_count_actual_total"), 0),
        )
    )
    lines.append("")
    lines.append("## Recent Runs")
    lines.append("")
    lines.append("| ts | editor_run_id | step166_run_id | source | selection | generated | editor_fail | step166_fail |")
    lines.append("| --- | --- | --- | --- | --- | --- | ---: | ---: |")
    for row in runs:
        row_selection = as_dict(row.get("case_selection"))
        generated_declared = as_int(row.get("generated_count_declared"), 0)
        generated_actual = as_int(row.get("generated_count_actual"), 0)
        generated_mismatch = bool(row.get("generated_count_mismatch", generated_declared != generated_actual))
        generated_col = f"d={generated_declared}/a={generated_actual}"
        if generated_mismatch:
            generated_col += ":mismatch"
        lines.append(
            "| {ts} | `{er}` | `{cr}` | `{source}` | `{selection}` | `{generated}` | {ef} | {cf} |".format(
                ts=str(row.get("ts", "")),
                er=str(row.get("editor_run_id", "")),
                cr=str(row.get("step166_run_id", "")),
                source=str(row.get("editor_case_source", "")),
                selection="s={selected}/m={matched}/t={total}/fb={fallback}".format(
                    selected=as_int(row_selection.get("selected_count"), 0),
                    matched=as_int(row_selection.get("matched_count"), 0),
                    total=as_int(row_selection.get("total_input"), 0),
                    fallback=bool(row_selection.get("used_fallback", False)),
                ),
                generated=generated_col,
                ef=as_int(row.get("editor_fail"), 0),
                cf=as_int(row.get("step166_fail"), 0),
            )
        )
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize editor gate trend from history files.")
    parser.add_argument("--history-dir", default="build/editor_gate_history")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--out-json", default="build/editor_gate_trend.json")
    parser.add_argument("--out-md", default="build/editor_gate_trend.md")
    args = parser.parse_args()

    history_dir = Path(args.history_dir).resolve()
    out_json = Path(args.out_json).resolve()
    out_md = Path(args.out_md).resolve()
    days = max(1, int(args.days))

    runs = load_history_runs(history_dir)
    payload = to_payload(history_dir, days, runs)
    write_json(out_json, payload)
    write_md(out_md, payload)

    print(f"trend_json={out_json}")
    print(f"trend_md={out_md}")
    print(f"trend_status={payload.get('status', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
