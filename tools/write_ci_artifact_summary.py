#!/usr/bin/env python3
"""Write a compact Markdown summary for CI artifacts and failure attribution."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


def load_json(path: str) -> Dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.is_file():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def non_empty_counts(raw: Dict[str, Any]) -> List[Tuple[str, int]]:
    pairs: List[Tuple[str, int]] = []
    for key, value in raw.items():
        try:
            ivalue = int(value)
        except Exception:
            continue
        if ivalue > 0:
            pairs.append((str(key), ivalue))
    pairs.sort(key=lambda item: (-item[1], item[0]))
    return pairs


def fmt_counts(raw: Dict[str, Any]) -> str:
    pairs = non_empty_counts(raw)
    if not pairs:
        return "none"
    return ", ".join(f"{key}={value}" for key, value in pairs)


def find_first_roundtrip_failure(summary: Dict[str, Any]) -> Tuple[str, str]:
    for item in as_list(summary.get("results")):
        one = as_dict(item)
        if str(one.get("status") or "").upper() != "FAIL":
            continue
        name = str(one.get("name") or "")
        codes = [str(code).strip() for code in as_list(one.get("failure_codes")) if str(code).strip()]
        if codes:
            return (codes[0], name)
        return ("FAIL", name)
    return ("", "")


def bool_text(value: Any) -> str:
    return "true" if bool(value) else "false"


def render(args: argparse.Namespace, gate: Dict[str, Any], roundtrip: Dict[str, Any]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines: List[str] = []
    lines.append(f"# {args.title}")
    lines.append("")
    lines.append(f"- generated_at: `{now}`")
    lines.append(f"- workflow_mode: `{args.mode}`")

    if gate:
        gate_decision = as_dict(gate.get("gate_decision"))
        would_fail = bool(gate_decision.get("would_fail"))
        exit_code = int(gate_decision.get("exit_code", 0) or 0)
        fail_reasons = [str(x) for x in as_list(gate_decision.get("fail_reasons")) if str(x).strip()]

        editor_smoke = as_dict(gate.get("editor_smoke"))
        editor_totals = as_dict(editor_smoke.get("totals"))
        editor_fail_codes = as_dict(editor_smoke.get("failure_code_counts"))

        ui_flow = as_dict(gate.get("ui_flow_smoke"))
        ui_fail_codes = as_dict(ui_flow.get("failure_code_counts"))

        step166 = as_dict(gate.get("step166"))
        step166_decision = as_dict(step166.get("gate_decision"))

        editor_inject = as_dict(gate.get("editor_smoke_failure_injection"))
        ui_inject = as_dict(gate.get("ui_flow_failure_injection"))

        lines.append("")
        lines.append("## Editor Gate")
        lines.append(
            "- decision: `would_fail={wf}` `exit_code={code}` `fail_reasons={reasons}`".format(
                wf=bool_text(would_fail),
                code=exit_code,
                reasons=("none" if not fail_reasons else ",".join(fail_reasons)),
            )
        )
        lines.append(
            "- editor_smoke: `run_id={run_id}` `status={status}` `pass={p}` `fail={f}` `first_failure_code={ffc}` `failure_codes={codes}`".format(
                run_id=editor_smoke.get("run_id", ""),
                status=editor_smoke.get("status", "UNKNOWN"),
                p=int(editor_totals.get("pass", 0) or 0),
                f=int(editor_totals.get("fail", 0) or 0),
                ffc=editor_smoke.get("first_failure_code", ""),
                codes=fmt_counts(editor_fail_codes),
            )
        )
        lines.append(
            "- ui_flow_smoke: `enabled={enabled}` `run_id={run_id}` `ok={ok}` `first_failure_code={ffc}` `failure_codes={codes}`".format(
                enabled=bool_text(ui_flow.get("enabled", False)),
                run_id=ui_flow.get("run_id", ""),
                ok=bool_text(ui_flow.get("ok", False)),
                ffc=ui_flow.get("first_failure_code", ""),
                codes=fmt_counts(ui_fail_codes),
            )
        )
        lines.append(
            "- step166: `enabled={enabled}` `run_id={run_id}` `gate_would_fail={gwf}`".format(
                enabled=bool_text(step166.get("enabled", True)),
                run_id=step166.get("run_id", ""),
                gwf=bool_text(step166_decision.get("would_fail", False)),
            )
        )
        lines.append(
            "- editor_smoke_injection: `status={status}` `code={code}` `run_id={run_id}`".format(
                status=editor_inject.get("status", "SKIPPED"),
                code=editor_inject.get("failure_code", ""),
                run_id=editor_inject.get("run_id", ""),
            )
        )
        lines.append(
            "- ui_flow_injection: `status={status}` `code={code}` `run_id={run_id}`".format(
                status=ui_inject.get("status", "SKIPPED"),
                code=ui_inject.get("failure_code", ""),
                run_id=ui_inject.get("run_id", ""),
            )
        )

    if roundtrip:
        totals = as_dict(roundtrip.get("totals"))
        failure_codes = as_dict(roundtrip.get("failure_code_counts"))
        rt_status = str(roundtrip.get("status") or "").strip()
        if not rt_status:
            fail_count = int(totals.get("fail", 0) or 0)
            rt_status = "FAIL" if fail_count > 0 else "PASS"
        first_code, first_name = find_first_roundtrip_failure(roundtrip)
        lines.append("")
        lines.append("## Roundtrip")
        lines.append(
            "- run: `run_id={run_id}` `mode={mode}` `status={status}`".format(
                run_id=roundtrip.get("run_id", ""),
                mode=roundtrip.get("mode", ""),
                status=rt_status,
            )
        )
        lines.append(
            "- totals: `pass={p}` `fail={f}` `skipped={s}`".format(
                p=int(totals.get("pass", 0) or 0),
                f=int(totals.get("fail", 0) or 0),
                s=int(totals.get("skipped", 0) or 0),
            )
        )
        lines.append(f"- failure_codes: `{fmt_counts(failure_codes)}`")
        if first_code:
            lines.append(f"- first_failure: `code={first_code}` `case={first_name}`")

    lines.append("")
    lines.append("## Artifacts")
    if args.gate_summary:
        lines.append(f"- gate_summary: `{args.gate_summary}`")
    if args.roundtrip_summary:
        lines.append(f"- roundtrip_summary: `{args.roundtrip_summary}`")

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write CI artifact summary markdown.")
    parser.add_argument("--title", default="CADGameFusion CI Artifact Summary")
    parser.add_argument("--mode", default="observe", choices=["observe", "gate"])
    parser.add_argument("--gate-summary", default="")
    parser.add_argument("--roundtrip-summary", default="")
    parser.add_argument("--out", default="")
    parser.add_argument("--append-github-step-summary", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gate = load_json(args.gate_summary)
    roundtrip = load_json(args.roundtrip_summary)

    output = render(args, gate, roundtrip)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        print(str(out_path))
    else:
        print(output, end="")

    if args.append_github_step_summary:
        gh = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
        if gh:
            with open(gh, "a", encoding="utf-8") as handle:
                handle.write("\n")
                handle.write(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
