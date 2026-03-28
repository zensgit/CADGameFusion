#!/usr/bin/env python3
"""
Run editor weekly validation for multiple rounds and summarize stability.

Example:
  python3 tools/editor_stability_soak.py --rounds 3 --run-gate 1
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def make_run_id() -> str:
    return dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_md(path: Path, payload: dict[str, Any]) -> None:
    rounds = payload.get("rounds", [])
    lines = [
        "# Editor Stability Soak",
        "",
        f"- run_id: `{payload.get('run_id', '')}`",
        f"- started_at: `{payload.get('started_at', '')}`",
        f"- finished_at: `{payload.get('finished_at', '')}`",
        f"- rounds: `{payload.get('config', {}).get('rounds', 0)}`",
        f"- run_gate: `{payload.get('config', {}).get('run_gate', False)}`",
        f"- overall_status: `{payload.get('overall_status', 'unknown')}`",
        "",
        "## Round Results",
        "",
        "| round | rc | editor_smoke | step166_gate_would_fail | real_scene_status | gate_status | trend_status |",
        "| ---: | ---: | --- | --- | --- | --- | --- |",
    ]
    for item in rounds:
        lines.append(
            "| {idx} | {rc} | {smoke} | {step166} | {real_scene} | {gate} | {trend} |".format(
                idx=item.get("round"),
                rc=item.get("returncode"),
                smoke=item.get("editor_smoke_run_id", ""),
                step166=item.get("step166_gate_would_fail", False),
                real_scene=item.get("real_scene_status", ""),
                gate=item.get("gate_status", ""),
                trend=item.get("trend_status", ""),
            )
        )
    lines.extend(
        [
            "",
            "## Summary",
            "",
            f"- passes: `{payload.get('metrics', {}).get('passes', 0)}`",
            f"- failures: `{payload.get('metrics', {}).get('failures', 0)}`",
            f"- stable_rounds: `{payload.get('metrics', {}).get('stable_rounds', 0)}`",
            f"- recommendation: `{payload.get('recommendation', '')}`",
            "",
        ]
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run weekly validation multiple rounds and summarize stability.")
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--interval-sec", type=int, default=0)
    parser.add_argument("--run-gate", choices=["0", "1"], default="1")
    parser.add_argument("--weekly-script", default="tools/editor_weekly_validation.sh")
    parser.add_argument("--summary-json", default="build/editor_weekly_validation_summary.json")
    parser.add_argument("--outdir", default="build/editor_stability_soak")
    parser.add_argument("--append-report", choices=["0", "1"], default="0")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rounds = max(1, int(args.rounds))
    interval_sec = max(0, int(args.interval_sec))
    root = Path(__file__).resolve().parents[1]
    weekly_script = (root / args.weekly_script).resolve()
    summary_json = (root / args.summary_json).resolve()
    outdir_root = (root / args.outdir).resolve()
    run_id = make_run_id()
    run_dir = outdir_root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    started_at = utc_now()
    round_rows = []
    passes = 0
    stable_rounds = 0

    for i in range(1, rounds + 1):
        env = os.environ.copy()
        env["RUN_GATE"] = args.run_gate
        env["EDITOR_GATE_APPEND_REPORT"] = args.append_report
        round_started = utc_now()
        proc = subprocess.run(
            ["bash", str(weekly_script)],
            cwd=str(root),
            text=True,
            capture_output=True,
            env=env,
        )
        round_finished = utc_now()
        log_path = run_dir / f"round_{i}.log"
        log_path.write_text((proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else ""), encoding="utf-8")

        local_summary = load_json(summary_json)
        round_summary_path = run_dir / f"round_{i}_summary.json"
        if summary_json.exists():
            shutil.copy2(summary_json, round_summary_path)

        step166_gate_would_fail = bool(((local_summary.get("step166") or {}).get("gate_would_fail")))
        gate_status = str((local_summary.get("gate") or {}).get("status", ""))
        real_scene_status = str((local_summary.get("real_scene_perf") or {}).get("status", ""))
        trend_status = str((local_summary.get("trend") or {}).get("status", ""))
        editor_smoke_run_id = str((local_summary.get("editor_smoke") or {}).get("run_id", ""))

        is_pass = (
            proc.returncode == 0
            and not step166_gate_would_fail
            and real_scene_status != "FAIL"
            and (args.run_gate != "1" or gate_status == "ok")
        )
        if is_pass:
            passes += 1
        if trend_status == "stable":
            stable_rounds += 1

        round_rows.append(
            {
                "round": i,
                "started_at": round_started,
                "finished_at": round_finished,
                "returncode": proc.returncode,
                "pass": is_pass,
                "editor_smoke_run_id": editor_smoke_run_id,
                "step166_gate_would_fail": step166_gate_would_fail,
                "real_scene_status": real_scene_status,
                "gate_status": gate_status,
                "trend_status": trend_status,
                "round_summary_json": str(round_summary_path) if round_summary_path.exists() else "",
                "log_file": str(log_path),
            }
        )

        if i < rounds and interval_sec > 0:
            time.sleep(interval_sec)

    finished_at = utc_now()
    failures = rounds - passes
    overall_status = "stable" if failures == 0 else ("watch" if passes > 0 else "unstable")
    if overall_status == "stable":
        recommendation = "Keep current gate settings; continue daily soak and monitor trend drift."
    elif overall_status == "watch":
        recommendation = "Investigate failed rounds and keep gate with retries until drift root cause is resolved."
    else:
        recommendation = "Do not tighten gate; fix regressions before next soak window."

    payload = {
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": finished_at,
        "workspace": str(root),
        "config": {
            "rounds": rounds,
            "interval_sec": interval_sec,
            "run_gate": args.run_gate == "1",
            "weekly_script": str(weekly_script),
            "summary_json": str(summary_json),
        },
        "metrics": {
            "passes": passes,
            "failures": failures,
            "stable_rounds": stable_rounds,
        },
        "overall_status": overall_status,
        "recommendation": recommendation,
        "rounds": round_rows,
    }

    out_json = run_dir / "summary.json"
    out_md = run_dir / "summary.md"
    write_json(out_json, payload)
    write_md(out_md, payload)

    print(f"run_id={run_id}")
    print(f"run_dir={run_dir}")
    print(f"summary_json={out_json}")
    print(f"summary_md={out_md}")
    print(f"overall_status={overall_status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
