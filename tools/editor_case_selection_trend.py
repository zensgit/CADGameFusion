#!/usr/bin/env python3
"""
Aggregate editor gate case-selection quality over multiple day windows.

Usage:
  python3 tools/editor_case_selection_trend.py \
    --history-dir build/editor_gate_history \
    --windows 7,14 \
    --out-json build/editor_case_selection_trend.json \
    --out-md build/editor_case_selection_trend.md
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from collections import Counter


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


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}


def as_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


@dataclass
class SelectionRun:
    ts: datetime
    source_file: str
    gate_run_id: str
    case_source: str
    selected_count: int
    matched_count: int
    filtered_count: int
    total_input: int
    used_fallback: bool
    generated_count_declared: int
    generated_count_actual: int
    generated_count_mismatch: bool


def parse_windows(raw: str) -> list[int]:
    values = []
    for one in str(raw or "").split(","):
        one = one.strip()
        if not one:
            continue
        try:
            day = int(one)
        except Exception:
            continue
        if day > 0:
            values.append(day)
    out = sorted(set(values))
    return out or [7, 14]


def load_history_runs(history_dir: Path) -> list[SelectionRun]:
    out: list[SelectionRun] = []
    if not history_dir.exists():
        return out
    for path in sorted(history_dir.glob("*.json")):
        payload = load_json(path)
        ts = parse_time(str(payload.get("generated_at") or ""))
        if ts is None:
            ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

        editor = as_dict(payload.get("editor_smoke"))
        selection = as_dict(editor.get("case_selection"))

        out.append(
            SelectionRun(
                ts=ts,
                source_file=str(path),
                gate_run_id=str(editor.get("run_id") or ""),
                case_source=str(editor.get("case_source") or "discovery"),
                selected_count=as_int(selection.get("selected_count"), 0),
                matched_count=as_int(selection.get("matched_count"), 0),
                filtered_count=as_int(selection.get("filtered_count"), 0),
                total_input=as_int(selection.get("total_input"), 0),
                used_fallback=as_bool(selection.get("used_fallback")),
                generated_count_declared=as_int(editor.get("generated_count_declared"), as_int(editor.get("generated_count"), 0)),
                generated_count_actual=as_int(editor.get("generated_count_actual"), as_int(editor.get("generated_count"), 0)),
                generated_count_mismatch=as_bool(editor.get("generated_count_mismatch")),
            )
        )
    out.sort(key=lambda r: r.ts)
    return out


def summarize_window(runs: list[SelectionRun], days: int, now: datetime) -> dict[str, Any]:
    window_start = now - timedelta(days=days)
    in_window = [r for r in runs if r.ts >= window_start]
    if not in_window and runs:
        in_window = runs[-min(10, len(runs)) :]

    with_selection = [r for r in in_window if r.total_input > 0]
    selected_total = sum(r.selected_count for r in with_selection)
    matched_total = sum(r.matched_count for r in with_selection)
    filtered_total = sum(r.filtered_count for r in with_selection)
    input_total = sum(r.total_input for r in with_selection)
    fallback_runs = sum(1 for r in with_selection if r.used_fallback)
    mismatch_runs = sum(1 for r in in_window if r.generated_count_mismatch)
    mismatch_rate = (mismatch_runs / len(in_window)) if in_window else 0.0
    mismatch_declared_total = sum(r.generated_count_declared for r in in_window)
    mismatch_actual_total = sum(r.generated_count_actual for r in in_window)

    matched_ratio = (matched_total / input_total) if input_total > 0 else 0.0
    selected_ratio = (selected_total / input_total) if input_total > 0 else 0.0
    filtered_ratio = (filtered_total / input_total) if input_total > 0 else 0.0
    fallback_rate = (fallback_runs / len(with_selection)) if with_selection else 0.0
    source_counts = Counter(str(r.case_source or "discovery") for r in in_window)
    risky_source_runs = int(source_counts.get("fixture", 0) + source_counts.get("auto-local", 0))
    risky_source_rate = (risky_source_runs / len(in_window)) if in_window else 0.0

    status = "no_data"
    recommendation = "No history in window."
    warning_codes: list[str] = []
    if mismatch_runs > 0:
        warning_codes.append("GENERATED_COUNT_MISMATCH")
    if fallback_rate > 0.1:
        warning_codes.append("CASE_SELECTION_FALLBACK_HIGH")
    if risky_source_rate > 0.4:
        warning_codes.append("CASE_SOURCE_RISKY_HIGH")
    if input_total > 0 and matched_ratio < 0.6:
        warning_codes.append("CASE_SELECTION_MATCHED_RATIO_LOW")
    if with_selection:
        if mismatch_runs == 0 and fallback_rate == 0.0 and matched_ratio >= 0.8 and risky_source_rate <= 0.1:
            status = "stable"
            recommendation = "Selection coverage is stable."
        elif mismatch_rate <= 0.1 and fallback_rate <= 0.1 and matched_ratio >= 0.6 and risky_source_rate <= 0.4:
            status = "watch"
            recommendation = "Coverage acceptable; keep observing."
            if mismatch_runs > 0:
                recommendation = "Coverage acceptable but generated-case mismatch detected; verify case source before gate tightening."
        else:
            status = "degraded"
            recommendation = "Coverage/fallback/source drift detected; refresh generated cases or filters."
            if mismatch_runs > 0:
                recommendation = "Generated-case mismatch and selection drift detected; refresh generated cases before gate tightening."
    elif mismatch_runs > 0:
        status = "degraded"
        recommendation = "Generated-case mismatch detected without usable selection samples; fix provenance first."

    latest = with_selection[-1] if with_selection else (in_window[-1] if in_window else None)
    return {
        "days": int(days),
        "window_start": window_start.isoformat(),
        "samples_in_window": len(in_window),
        "samples_with_selection": len(with_selection),
        "selected_total": selected_total,
        "matched_total": matched_total,
        "filtered_total": filtered_total,
        "input_total": input_total,
        "fallback_runs": fallback_runs,
        "matched_ratio": matched_ratio,
        "selected_ratio": selected_ratio,
        "filtered_ratio": filtered_ratio,
        "fallback_rate": fallback_rate,
        "generated_count_mismatch_runs": mismatch_runs,
        "generated_count_mismatch_rate": mismatch_rate,
        "generated_count_declared_total": mismatch_declared_total,
        "generated_count_actual_total": mismatch_actual_total,
        "source_counts": dict(source_counts),
        "risky_source_runs": risky_source_runs,
        "risky_source_rate": risky_source_rate,
        "status": status,
        "recommendation": recommendation,
        "warning_codes": warning_codes,
        "latest": (
            {
                "ts": latest.ts.isoformat(),
                "gate_run_id": latest.gate_run_id,
                "case_source": latest.case_source,
                "selected_count": latest.selected_count,
                "matched_count": latest.matched_count,
                "total_input": latest.total_input,
                "used_fallback": latest.used_fallback,
                "generated_count_declared": latest.generated_count_declared,
                "generated_count_actual": latest.generated_count_actual,
                "generated_count_mismatch": latest.generated_count_mismatch,
                "source_file": latest.source_file,
            }
            if latest
            else {}
        ),
    }


def summarize(history_dir: Path, windows: list[int]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    runs = load_history_runs(history_dir)
    window_rows = [summarize_window(runs, days, now) for days in windows]
    mismatch_runs_total = sum(as_int(row.get("generated_count_mismatch_runs"), 0) for row in window_rows)
    mismatch_rate_max = max((as_float(row.get("generated_count_mismatch_rate")) for row in window_rows), default=0.0)
    warning_codes = sorted(
        {
            str(code)
            for row in window_rows
            if isinstance(row, dict)
            for code in (row.get("warning_codes") if isinstance(row.get("warning_codes"), list) else [])
            if str(code or "").strip()
        }
    )
    status = "no_data"
    if window_rows:
        if any(row.get("status") == "degraded" for row in window_rows):
            status = "degraded"
        elif any(row.get("status") == "watch" for row in window_rows):
            status = "watch"
        elif all(row.get("status") == "stable" for row in window_rows):
            status = "stable"
        else:
            status = "no_data"
    if status == "stable" and mismatch_runs_total > 0:
        status = "watch"

    return {
        "generated_at": now.isoformat(),
        "history_dir": str(history_dir),
        "windows_requested": windows,
        "samples_total": len(runs),
        "status": status,
        "generated_count_mismatch_runs_total": mismatch_runs_total,
        "generated_count_mismatch_rate_max": mismatch_rate_max,
        "warning_codes": warning_codes,
        "windows": window_rows,
        "latest_run": (
            {
                "ts": runs[-1].ts.isoformat(),
                "gate_run_id": runs[-1].gate_run_id,
                "source_file": runs[-1].source_file,
            }
            if runs
            else {}
        ),
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_md(path: Path, payload: dict[str, Any]) -> None:
    lines: list[str] = []
    lines.append("# Editor Case Selection Trend")
    lines.append("")
    lines.append(f"- generated_at: `{payload.get('generated_at', '')}`")
    lines.append(f"- history_dir: `{payload.get('history_dir', '')}`")
    lines.append(f"- status: `{payload.get('status', '')}`")
    lines.append(f"- samples_total: `{payload.get('samples_total', 0)}`")
    lines.append(
        "- generated_count_mismatch: `runs_total={runs}` `rate_max={rate:.3f}`".format(
            runs=as_int(payload.get("generated_count_mismatch_runs_total"), 0),
            rate=as_float(payload.get("generated_count_mismatch_rate_max")),
        )
    )
    warning_codes = payload.get("warning_codes")
    if isinstance(warning_codes, list) and warning_codes:
        lines.append(f"- warning_codes: `{','.join(str(x) for x in warning_codes if str(x).strip())}`")
    lines.append("")
    lines.append("| window | samples | matched_ratio | selected_ratio | fallback_rate | mismatch_rate | risky_source_rate | source_counts | status | warnings |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |")
    for row in payload.get("windows", []):
        if not isinstance(row, dict):
            continue
        source_counts = row.get("source_counts")
        source_text = "none"
        if isinstance(source_counts, dict) and source_counts:
            source_text = " ".join(f"{k}={source_counts[k]}" for k in sorted(source_counts.keys()))
        warnings = row.get("warning_codes")
        warning_text = "-"
        if isinstance(warnings, list) and warnings:
            warning_text = ",".join(str(x) for x in warnings if str(x).strip()) or "-"
        lines.append(
            "| {days}d | {samples} ({with_sel}) | {matched:.3f} | {selected:.3f} | {fallback:.3f} | {mismatch:.3f} | {risky:.3f} | `{source_text}` | {status} | `{warnings}` |".format(
                days=as_int(row.get("days"), 0),
                samples=as_int(row.get("samples_in_window"), 0),
                with_sel=as_int(row.get("samples_with_selection"), 0),
                matched=as_float(row.get("matched_ratio")),
                selected=as_float(row.get("selected_ratio")),
                fallback=as_float(row.get("fallback_rate")),
                mismatch=as_float(row.get("generated_count_mismatch_rate")),
                risky=as_float(row.get("risky_source_rate")),
                source_text=source_text,
                status=str(row.get("status") or ""),
                warnings=warning_text,
            )
        )
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize editor gate case-selection trend.")
    parser.add_argument("--history-dir", default="build/editor_gate_history")
    parser.add_argument("--windows", default="7,14", help="Comma-separated day windows (default: 7,14)")
    parser.add_argument("--out-json", default="build/editor_case_selection_trend.json")
    parser.add_argument("--out-md", default="build/editor_case_selection_trend.md")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    history_dir = Path(args.history_dir).resolve()
    out_json = Path(args.out_json).resolve()
    out_md = Path(args.out_md).resolve()
    windows = parse_windows(args.windows)

    payload = summarize(history_dir, windows)
    write_json(out_json, payload)
    write_md(out_md, payload)

    print(f"case_selection_trend_json={out_json}")
    print(f"case_selection_trend_md={out_md}")
    print(f"case_selection_trend_status={payload.get('status', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
