#!/usr/bin/env python3
"""Run negative PLM preview artifact validator cases and expect failures."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from validate_plm_preview_artifacts import validate_target


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTDIR = ROOT / "build" / "preview_artifact_validator_failure_injection"
DEFAULT_CASES_PATH = ROOT / "tools" / "web_viewer" / "tests" / "fixtures" / "preview_artifact_validator_failure_cases.json"


@dataclass
class CaseResult:
    id: str
    target: str
    status: str
    expected_errors: List[str]
    observed_errors: List[str]
    first_error: str


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def resolve_path(raw: str) -> Path:
    candidate = Path(raw)
    if candidate.is_absolute():
        return candidate
    cwd_candidate = (Path.cwd() / candidate).resolve()
    if cwd_candidate.exists() or cwd_candidate.parent.exists():
        return cwd_candidate
    return (ROOT / candidate).resolve()


def load_cases(path: Path) -> List[Dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload if isinstance(payload, list) else payload.get("cases", [])
    if not isinstance(items, list) or not items:
        raise ValueError(f"no cases found in {path}")
    normalized: List[Dict[str, Any]] = []
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            raise ValueError(f"case #{index + 1} in {path} is not an object")
        case_id = str(raw.get("id") or f"case_{index + 1}").strip()
        target = str(raw.get("target") or "").strip()
        expect_errors = raw.get("expect_errors") or raw.get("expectErrors") or []
        if not case_id:
            raise ValueError(f"case #{index + 1} in {path} has empty id")
        if not target:
            raise ValueError(f"case {case_id} missing target")
        if not isinstance(expect_errors, list) or not expect_errors:
            raise ValueError(f"case {case_id} missing expect_errors")
        normalized.append(
            {
                "id": case_id,
                "target": target,
                "expect_errors": [str(one).strip() for one in expect_errors if str(one).strip()],
            }
        )
    return normalized


def run_case(case: Dict[str, Any]) -> CaseResult:
    target = resolve_path(case["target"])
    result = validate_target(target, quiet=True)
    observed_errors = [str(one) for one in result.errors]
    expected_errors = list(case["expect_errors"])
    missing = [one for one in expected_errors if not any(one in err for err in observed_errors)]
    status = "ok"
    if result.ok():
        status = "unexpected_pass"
    elif missing:
        status = "missing_expected_error"
    return CaseResult(
        id=str(case["id"]),
        target=str(target),
        status=status,
        expected_errors=expected_errors,
        observed_errors=observed_errors,
        first_error=observed_errors[0] if observed_errors else "",
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run negative PLM preview artifact validation cases")
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH), help="JSON case list")
    parser.add_argument("--outdir", default=str(DEFAULT_OUTDIR), help="Output directory root")
    args = parser.parse_args(argv)

    cases_arg = str(args.cases).strip() or str(DEFAULT_CASES_PATH)
    outdir_arg = str(args.outdir).strip() or str(DEFAULT_OUTDIR)
    cases_path = resolve_path(cases_arg)
    outdir_root = resolve_path(outdir_arg)
    run_id = now_stamp()
    run_dir = outdir_root / run_id
    ensure_dir(run_dir)

    cases = load_cases(cases_path)
    results = [run_case(case) for case in cases]
    passed = sum(1 for item in results if item.status == "ok")
    failed = len(results) - passed
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases_path": str(cases_path),
        "outdir": str(run_dir),
        "run_id": run_id,
        "passed": passed,
        "failed": failed,
        "results": [asdict(item) for item in results],
    }
    summary_path = run_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(f"run_id={run_id}")
    print(f"run_dir={run_dir}")
    print(f"summary_json={summary_path}")
    print(json.dumps(summary, indent=2))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
