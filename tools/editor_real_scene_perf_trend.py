#!/usr/bin/env python3
"""
Summarize real-scene editor performance trend.

This tool reads artifacts produced by:
- tools/web_viewer/scripts/editor_real_scene_perf_smoke.js
- tools/editor_weekly_validation.sh (optional batch median aggregation)

Inputs (auto-discovered by default):
- build/editor_real_scene_perf/<run_id>/summary.json
- build/editor_real_scene_perf_batch/<batch_id>/summary.json

Outputs:
- JSON summary (machine-readable)
- Markdown summary (human-readable)

Policy: observe-first; optional gate mode will only fail when a *critical* regression
is detected (box_query/drag/hotspot). Pick regressions are informational.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from typing import Any


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


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def as_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        x = float(value)
        if x != x:  # NaN
            return None
        return x
    except Exception:
        return None


def median_or_none(values: list[float | None]) -> float | None:
    xs = [x for x in values if isinstance(x, (int, float))]
    if not xs:
        return None
    return float(median(xs))


def resolve_repo_path(repo_root: Path, raw: str) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p
    return (repo_root / p).resolve()


def load_profile(repo_root: Path, profile_path: str) -> dict[str, Any]:
    resolved = resolve_repo_path(repo_root, profile_path)
    return load_json(resolved) if resolved.exists() else {}


@dataclass
class SceneRun:
    ts: datetime
    source_file: str
    run_id: str
    kind: str  # single|batch
    status: str
    repeat: int
    profile: str
    input_doc: str
    config: dict[str, Any]
    pick_p95_ms: float | None
    box_p95_ms: float | None
    drag_p95_ms: float | None


def discover_summary_paths(scene_dir: Path, scene_batch_dir: Path) -> list[Path]:
    out: list[Path] = []
    if scene_batch_dir.exists():
        out.extend(sorted(scene_batch_dir.glob("*/summary.json")))
    if scene_dir.exists():
        out.extend(sorted(scene_dir.glob("*/summary.json")))
    return out


def parse_scene_run(path: Path) -> SceneRun | None:
    payload = load_json(path)
    ts = parse_time(payload.get("generated_at"))
    if ts is None:
        ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

    aggregate = as_dict(payload.get("aggregate"))
    agg_metrics = as_dict(aggregate.get("metrics"))
    is_batch = (
        isinstance(payload.get("repeat"), int)
        and "pick_p95_ms_median" in agg_metrics
        and "box_p95_ms_median" in agg_metrics
        and "drag_p95_ms_median" in agg_metrics
    )

    run_id = str(payload.get("run_id") or path.parent.name)
    profile = str(payload.get("profile") or "")
    input_doc = str(payload.get("input_doc") or "")
    status = str(payload.get("status") or ("PASS" if payload else "FAIL"))

    if is_batch:
        return SceneRun(
            ts=ts,
            source_file=str(path),
            run_id=run_id,
            kind="batch",
            status=status,
            repeat=as_int(payload.get("repeat"), 0),
            profile=profile,
            input_doc=input_doc,
            config={},  # batch summaries omit config; keep empty
            pick_p95_ms=as_float(agg_metrics.get("pick_p95_ms_median")),
            box_p95_ms=as_float(agg_metrics.get("box_p95_ms_median")),
            drag_p95_ms=as_float(agg_metrics.get("drag_p95_ms_median")),
        )

    metrics = as_dict(payload.get("metrics"))
    pick = as_dict(metrics.get("pick"))
    box = as_dict(metrics.get("box_query"))
    drag = as_dict(metrics.get("drag_commit"))
    config = as_dict(payload.get("config"))
    return SceneRun(
        ts=ts,
        source_file=str(path),
        run_id=run_id,
        kind="single",
        status=status,
        repeat=1,
        profile=profile,
        input_doc=input_doc,
        config=config,
        pick_p95_ms=as_float(pick.get("p95_ms")),
        box_p95_ms=as_float(box.get("p95_ms")),
        drag_p95_ms=as_float(drag.get("p95_ms")),
    )


def filter_runs(
    runs: list[SceneRun],
    expected_profile: Path | None,
    expected_doc: Path | None,
    expected_samples: dict[str, int],
) -> list[SceneRun]:
    out: list[SceneRun] = []
    for r in runs:
        if expected_profile is not None:
            rp = Path(r.profile) if r.profile else None
            if rp is None or rp.name != expected_profile.name:
                continue
        if expected_doc is not None:
            if not r.input_doc:
                continue
            try:
                got = Path(r.input_doc)
                got_resolved = got.resolve() if got.is_absolute() else got
            except Exception:
                continue
            if got_resolved != expected_doc and not str(r.input_doc).endswith(str(expected_doc)):
                continue

        if r.config:
            ok = True
            for key, value in expected_samples.items():
                if value <= 0:
                    continue
                got = as_int(as_dict(r.config).get(key), -1)
                if got != value:
                    ok = False
                    break
            if not ok:
                continue

        out.append(r)
    return out


def evaluate_trend(runs: list[SceneRun], days: int, hotspot_box_ms: float) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    recent = [r for r in runs if r.ts >= window_start]
    if not recent and runs:
        recent = runs[-min(10, len(runs)) :]

    # Prefer median-batch summaries when available; single runs are more prone to noise/outliers.
    # Policy: only treat repeat>=3 as a stable median batch (repeat=2 is still relatively noisy).
    batch_recent = [r for r in recent if r.kind == "batch" and r.repeat >= 3]
    selected = batch_recent if batch_recent else recent
    selection_mode = "batch_only" if batch_recent else "all"

    policy = {
        "baseline_method": "median(excluding_latest_when_possible)",
        "ratio_thresholds": {"pick_p95": 1.30, "box_p95": 1.30, "drag_p95": 1.40},
        "absolute_triggers_ms": {"box_p95_hotspot": hotspot_box_ms},
        "min_batch_repeat": 3,
        "notes": "Prefer batch median runs (repeat>=3). Observe-first: only box_query/drag/hotspot regressions are status-affecting; pick regressions are informational.",
    }

    if not selected:
        return {
            "generated_at": now.isoformat(),
            "days": days,
            "window_start": window_start.isoformat(),
            "status": "no_data",
            "recommendation": "No real-scene perf runs found. Run tools/editor_weekly_validation.sh with RUN_REAL_SCENE_PERF=1.",
            "policy": policy,
            "samples_total": len(runs),
            "samples_in_window": 0,
            "selected_samples_in_window": 0,
            "selection": selection_mode,  # backward compatible key
            "selection_mode": selection_mode,
            "coverage_days": 0.0,
            "baseline": {},
            "latest": {},
            "warnings": ["NO_RUNS"],
            "critical_warnings": [],
            "runs": [],
        }

    latest = selected[-1]
    baseline_runs = selected[:-1] if len(selected) >= 2 else selected
    baseline_pick = median_or_none([r.pick_p95_ms for r in baseline_runs])
    baseline_box = median_or_none([r.box_p95_ms for r in baseline_runs])
    baseline_drag = median_or_none([r.drag_p95_ms for r in baseline_runs])

    def ratio(value: float | None, base: float | None) -> float | None:
        if value is None or base is None or base <= 0:
            return None
        return float(value / base)

    ratios = {
        "pick_p95": ratio(latest.pick_p95_ms, baseline_pick),
        "box_p95": ratio(latest.box_p95_ms, baseline_box),
        "drag_p95": ratio(latest.drag_p95_ms, baseline_drag),
    }

    warnings: list[str] = []
    thr = policy["ratio_thresholds"]
    if ratios["pick_p95"] is not None and ratios["pick_p95"] > float(thr["pick_p95"]):
        warnings.append(f"REGRESSION_PICK_P95 ratio={ratios['pick_p95']:.3f}")
    if ratios["box_p95"] is not None and ratios["box_p95"] > float(thr["box_p95"]):
        warnings.append(f"REGRESSION_BOX_P95 ratio={ratios['box_p95']:.3f}")
    if ratios["drag_p95"] is not None and ratios["drag_p95"] > float(thr["drag_p95"]):
        warnings.append(f"REGRESSION_DRAG_P95 ratio={ratios['drag_p95']:.3f}")

    if latest.status and latest.status.upper() not in {"PASS", "OK"}:
        warnings.append(f"LATEST_STATUS={latest.status}")

    box_hotspot = latest.box_p95_ms is not None and latest.box_p95_ms > float(hotspot_box_ms)
    if box_hotspot:
        warnings.append(f"HOTSPOT_BOX_P95>{hotspot_box_ms:.3f} ({latest.box_p95_ms:.6f})")

    critical = [
        w
        for w in warnings
        if w.startswith("REGRESSION_BOX_P95") or w.startswith("REGRESSION_DRAG_P95") or w.startswith("HOTSPOT_")
    ]

    status = "stable" if not critical else "watch"
    if len(selected) < 5:
        status = "observe" if not warnings else status

    recommendation = "Keep running weekly real-scene perf (repeat=3 median)."
    if critical:
        recommendation = "Investigate real-scene perf regression before tightening any gate."
    elif status == "observe":
        recommendation = "Collect at least 5 samples in-window before calling it stable."

    oldest_ts = min((r.ts for r in selected), default=latest.ts)
    coverage_days = max(0.0, (latest.ts - oldest_ts).total_seconds() / 86400.0)

    return {
        "generated_at": now.isoformat(),
        "days": days,
        "window_start": window_start.isoformat(),
        "status": status,
        "recommendation": recommendation,
        "policy": policy,
        "samples_total": len(runs),
        "samples_in_window": len(recent),
        "selected_samples_in_window": len(selected),
        "selection": selection_mode,  # backward compatible key
        "selection_mode": selection_mode,
        "coverage_days": coverage_days,
        "baseline": {
            "pick_p95_ms_median": baseline_pick,
            "box_p95_ms_median": baseline_box,
            "drag_p95_ms_median": baseline_drag,
            "samples_used": len(baseline_runs),
        },
        "latest": {
            "ts": latest.ts.isoformat(),
            "run_id": latest.run_id,
            "kind": latest.kind,
            "repeat": latest.repeat,
            "status": latest.status,
            "profile": latest.profile,
            "input_doc": latest.input_doc,
            "metrics": {
                "pick_p95_ms": latest.pick_p95_ms,
                "box_p95_ms": latest.box_p95_ms,
                "drag_p95_ms": latest.drag_p95_ms,
            },
            "ratios_vs_baseline": ratios,
            "source_file": latest.source_file,
        },
        "warnings": warnings,
            "critical_warnings": critical,
            "runs": [
                {
                    "ts": r.ts.isoformat(),
                    "run_id": r.run_id,
                    "kind": r.kind,
                    "repeat": r.repeat,
                    "status": r.status,
                    "profile": r.profile,
                    "input_doc": r.input_doc,
                    "pick_p95_ms": r.pick_p95_ms,
                    "box_p95_ms": r.box_p95_ms,
                    "drag_p95_ms": r.drag_p95_ms,
                    "source_file": r.source_file,
                }
            for r in selected[-10:]
        ],
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_md(path: Path, payload: dict[str, Any]) -> None:
    policy = as_dict(payload.get("policy"))
    baseline = as_dict(payload.get("baseline"))
    latest = as_dict(payload.get("latest"))
    latest_metrics = as_dict(latest.get("metrics"))
    latest_ratios = as_dict(latest.get("ratios_vs_baseline"))
    warnings = payload.get("warnings") or []
    runs = payload.get("runs") or []
    selection = str(payload.get("selection") or "")
    coverage_days = as_float(payload.get("coverage_days"))

    def fmt_ratio(value: Any) -> str:
        x = as_float(value)
        return f"{x:.3f}" if x is not None else ""

    def fmt_float(value: Any) -> str:
        x = as_float(value)
        return f"{x:.6f}" if x is not None else ""

    lines: list[str] = []
    lines.append("# Editor Real Scene Perf Trend")
    lines.append("")
    lines.append(f"- generated_at: `{payload.get('generated_at', '')}`")
    lines.append(f"- status: `{payload.get('status', '')}`")
    lines.append(f"- recommendation: `{payload.get('recommendation', '')}`")
    lines.append(
        f"- samples: `{payload.get('samples_in_window', 0)}` in `{payload.get('days', 0)}` day window "
        f"(total `{payload.get('samples_total', 0)}`)"
    )
    if selection:
        lines.append(f"- selection: `{selection}` (selected `{payload.get('selected_samples_in_window', 0)}`)")
    if coverage_days is not None:
        lines.append(f"- coverage_days: `{coverage_days:.2f}`")
    lines.append("")
    lines.append("## Baseline (median)")
    lines.append("")
    lines.append(f"- pick_p95_ms_median: `{baseline.get('pick_p95_ms_median')}`")
    lines.append(f"- box_p95_ms_median: `{baseline.get('box_p95_ms_median')}`")
    lines.append(f"- drag_p95_ms_median: `{baseline.get('drag_p95_ms_median')}`")
    lines.append(f"- samples_used: `{baseline.get('samples_used')}`")
    lines.append("")
    lines.append("## Latest")
    lines.append("")
    lines.append(f"- ts: `{latest.get('ts', '')}`")
    lines.append(f"- run_id: `{latest.get('run_id', '')}`")
    lines.append(f"- kind: `{latest.get('kind', '')}` (repeat=`{latest.get('repeat', '')}`)")
    lines.append(f"- status: `{latest.get('status', '')}`")
    if latest.get("profile"):
        lines.append(f"- profile: `{latest.get('profile', '')}`")
    if latest.get("input_doc"):
        lines.append(f"- input_doc: `{latest.get('input_doc', '')}`")
    lines.append("")
    lines.append("| metric | latest_p95_ms | ratio_vs_baseline |")
    lines.append("| --- | ---: | ---: |")
    lines.append(f"| pick | {fmt_float(latest_metrics.get('pick_p95_ms'))} | {fmt_ratio(latest_ratios.get('pick_p95'))} |")
    lines.append(f"| box_query | {fmt_float(latest_metrics.get('box_p95_ms'))} | {fmt_ratio(latest_ratios.get('box_p95'))} |")
    lines.append(f"| drag_commit | {fmt_float(latest_metrics.get('drag_p95_ms'))} | {fmt_ratio(latest_ratios.get('drag_p95'))} |")
    lines.append("")
    lines.append("## Policy")
    lines.append("")
    ratios = as_dict(policy.get("ratio_thresholds"))
    abs_triggers = as_dict(policy.get("absolute_triggers_ms"))
    lines.append(
        f"- ratio_thresholds: pick={ratios.get('pick_p95')} box={ratios.get('box_p95')} drag={ratios.get('drag_p95')}"
    )
    lines.append(f"- absolute_triggers_ms: box_p95_hotspot={abs_triggers.get('box_p95_hotspot')}")
    lines.append("")
    lines.append("## Warnings")
    lines.append("")
    if warnings:
        for w in warnings:
            lines.append(f"- {w}")
    else:
        lines.append("- (none)")
    lines.append("")
    lines.append("## Recent Runs")
    lines.append("")
    lines.append("| ts | run_id | kind | pick_p95_ms | box_p95_ms | drag_p95_ms | status |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: | --- |")
    for r in runs:
        lines.append(
            "| {ts} | `{run_id}` | {kind} | {pick} | {box} | {drag} | {status} |".format(
                ts=str(r.get("ts", "")),
                run_id=str(r.get("run_id", "")),
                kind=str(r.get("kind", "")),
                pick=fmt_float(r.get("pick_p95_ms")),
                box=fmt_float(r.get("box_p95_ms")),
                drag=fmt_float(r.get("drag_p95_ms")),
                status=str(r.get("status", "")),
            )
        )
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize real-scene perf trend from editor perf runs.")
    parser.add_argument("--real-scene-dir", default="build/editor_real_scene_perf")
    parser.add_argument("--real-scene-batch-dir", default="build/editor_real_scene_perf_batch")
    parser.add_argument("--profile", default="docs/baselines/STEP174_REAL_SCENE_PERF_PROFILE.json")
    parser.add_argument("--mode", default="observe", choices=["observe", "gate"])
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--out-json", default="build/editor_real_scene_perf_trend.json")
    parser.add_argument("--out-md", default="build/editor_real_scene_perf_trend.md")
    parser.add_argument("--pick-samples", type=int, default=2000)
    parser.add_argument("--box-samples", type=int, default=800)
    parser.add_argument("--drag-samples", type=int, default=120)
    args = parser.parse_args()

    repo_root = Path.cwd()

    expected_profile = resolve_repo_path(repo_root, str(args.profile)).resolve()
    profile_payload = load_profile(repo_root, str(args.profile))
    expected_doc: Path | None = None
    if isinstance(profile_payload.get("doc"), str) and profile_payload.get("doc"):
        expected_doc = resolve_repo_path(repo_root, str(profile_payload.get("doc"))).resolve()

    hotspot_box_ms = 0.20
    try:
        thr_box = as_float(as_dict(profile_payload.get("thresholds")).get("box_p95_ms"))
        if thr_box is not None and thr_box > 0:
            hotspot_box_ms = float(thr_box)
    except Exception:
        pass

    scene_dir = resolve_repo_path(repo_root, str(args.real_scene_dir)).resolve()
    scene_batch_dir = resolve_repo_path(repo_root, str(args.real_scene_batch_dir)).resolve()
    out_json = resolve_repo_path(repo_root, str(args.out_json)).resolve()
    out_md = resolve_repo_path(repo_root, str(args.out_md)).resolve()
    days = max(1, int(args.days))

    paths = discover_summary_paths(scene_dir, scene_batch_dir)
    runs: list[SceneRun] = []
    for p in paths:
        one = parse_scene_run(p)
        if one is not None:
            runs.append(one)
    runs.sort(key=lambda x: x.ts)

    expected_samples = {
        "pick_samples": int(args.pick_samples),
        "box_samples": int(args.box_samples),
        "drag_samples": int(args.drag_samples),
    }
    filtered = filter_runs(runs, expected_profile, expected_doc, expected_samples)
    payload = evaluate_trend(filtered, days, hotspot_box_ms=hotspot_box_ms)
    payload["inputs"] = {
        "real_scene_dir": str(scene_dir),
        "real_scene_batch_dir": str(scene_batch_dir),
        "expected_profile": str(expected_profile),
        "expected_doc": str(expected_doc) if expected_doc else "",
        "expected_samples": expected_samples,
        "mode": str(args.mode),
    }

    write_json(out_json, payload)
    write_md(out_md, payload)

    print(f"real_scene_trend_json={out_json}")
    print(f"real_scene_trend_md={out_md}")
    print(f"real_scene_trend_status={payload.get('status', '')}")
    if str(args.mode) == "gate":
        return 2 if payload.get("status") in {"watch", "unstable"} else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
