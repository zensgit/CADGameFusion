#!/usr/bin/env python3
"""Run multiple real DWG-open smoke cases and summarize the batch."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTDIR = ROOT / "build" / "plm_dwg_open_matrix_smoke"
DEFAULT_CASES_PATH = ROOT / "tools" / "plm_dwg_open_matrix_cases.json"


@dataclass
class CaseResult:
    id: str
    input_dwg: str
    status: str
    error: str
    run_id: str
    summary_json: str
    validator_ok_count: int
    dwg_convert_ok: bool
    router_ok: bool
    convert_ok: bool
    viewer_ok: bool
    attempt_count: int = 1


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def resolve_path(raw: str) -> Path:
    candidate = Path(raw)
    if candidate.is_absolute():
        return candidate
    cwd_candidate = (Path.cwd() / candidate).resolve()
    if cwd_candidate.exists() or cwd_candidate.parent.exists():
        return cwd_candidate
    return (ROOT / candidate).resolve()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def shell_args_from_namespace(args: argparse.Namespace) -> List[str]:
    forwarded: List[str] = []
    pairs = [
        ("dwg2dxf", args.dwg2dxf),
        ("plugin", args.plugin),
        ("convert-cli", args.convert_cli),
        ("python", args.python),
        ("router-host", args.router_host),
        ("router-port", str(args.router_port)),
        ("router-url", args.router_url),
        ("public-host", args.public_host),
        ("emit", args.emit),
        ("project-id", args.project_id),
        ("wait-timeout", str(args.wait_timeout)),
        ("router-ready-timeout", str(args.router_ready_timeout)),
        ("convert-timeout", str(args.convert_timeout)),
        ("request-timeout", str(args.request_timeout)),
    ]
    for flag, value in pairs:
        if str(value or "").strip():
            forwarded.extend([f"--{flag}", str(value)])
    if args.keep_router:
        forwarded.append("--keep-router")
    if args.skip_router:
        forwarded.append("--skip-router")
    return forwarded


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
        input_dwg = str(raw.get("input_dwg") or raw.get("input") or "").strip()
        if not case_id:
            raise ValueError(f"case #{index + 1} in {path} has empty id")
        if not input_dwg:
            raise ValueError(f"case {case_id} missing input_dwg")
        normalized.append(
            {
                "id": case_id,
                "input_dwg": str(resolve_path(input_dwg)),
                "document_label": str(raw.get("document_label") or "").strip(),
            }
        )
    return normalized


def parse_summary_path(text: str) -> Path:
    for line in text.splitlines():
        if line.startswith("summary_json="):
            return resolve_path(line.split("=", 1)[1].strip())
    return Path()


def compute_case_result(case: Dict[str, Any], proc: subprocess.CompletedProcess[str], summary_path: Path) -> CaseResult:
    payload: Dict[str, Any] = {}
    if summary_path.is_file():
        payload = json.loads(summary_path.read_text(encoding="utf-8"))
    validators = payload.get("validators") if isinstance(payload.get("validators"), dict) else {}
    validator_ok_count = int(payload.get("validator_ok_count") or 0)
    if not validator_ok_count and validators:
        validator_ok_count = sum(1 for item in validators.values() if isinstance(item, dict) and item.get("ok"))
    router = payload.get("router") if isinstance(payload.get("router"), dict) else {}
    router_health = router.get("health") if isinstance(router.get("health"), dict) else {}
    convert = payload.get("convert") if isinstance(payload.get("convert"), dict) else {}
    convert_payload = convert.get("payload") if isinstance(convert.get("payload"), dict) else {}
    viewer = payload.get("viewer") if isinstance(payload.get("viewer"), dict) else {}
    error = str(payload.get("error") or "").strip()
    if not error and proc.returncode != 0:
        stderr_text = str(proc.stderr or "").strip()
        stdout_tail = "\n".join(str(proc.stdout or "").splitlines()[-10:]).strip()
        error = stderr_text or stdout_tail or f"child exit {proc.returncode}"
    ok = proc.returncode == 0 and bool(payload.get("ok"))
    return CaseResult(
        id=str(case["id"]),
        input_dwg=str(case["input_dwg"]),
        status="ok" if ok else "fail",
        error=error,
        run_id=str(payload.get("run_dir") or "").strip().split("/")[-1] if payload else "",
        summary_json=str(summary_path) if summary_path else "",
        validator_ok_count=validator_ok_count,
        dwg_convert_ok=bool(payload.get("dwg_convert", {}).get("ok")),
        router_ok=bool(router_health.get("ok")),
        convert_ok=str(convert_payload.get("status") or "").lower() == "ok",
        viewer_ok=bool(viewer.get("status_code") == 200 and viewer.get("contains_statusbar") and viewer.get("manifest_exists")),
    )


def run_case_once(case: Dict[str, Any], args: argparse.Namespace, run_dir: Path, attempt: int) -> CaseResult:
    case_root = run_dir / "cases" / str(case["id"])
    case_dir = case_root / f"attempt_{attempt:02d}"
    ensure_dir(case_dir)
    cmd = [
        args.python,
        str(ROOT / "tools" / "plm_dwg_open_smoke.py"),
        "--input-dwg",
        str(case["input_dwg"]),
        "--outdir",
        str(case_dir),
    ]
    if case.get("document_label"):
        cmd.extend(["--document-label", str(case["document_label"])])
    cmd.extend(shell_args_from_namespace(args))
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    log_path = case_dir / "runner.log"
    log_path.write_text(proc.stdout, encoding="utf-8")
    summary_path = parse_summary_path(proc.stdout)
    result = compute_case_result(case, proc, summary_path)
    result.attempt_count = attempt
    return result


def run_case(case: Dict[str, Any], args: argparse.Namespace, run_dir: Path) -> CaseResult:
    max_attempts = max(1, int(args.retries) + 1)
    last_result: Optional[CaseResult] = None
    for attempt in range(1, max_attempts + 1):
        last_result = run_case_once(case, args, run_dir, attempt)
        if last_result.status == "ok":
            return last_result
    assert last_result is not None
    return last_result


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch real DWG-open smoke across multiple real DWG samples")
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH), help="JSON case list")
    parser.add_argument("--dwg2dxf", default="", help="Path to dwg2dxf binary")
    parser.add_argument("--plugin", default="", help="Path to DXF importer plugin")
    parser.add_argument("--convert-cli", default="", help="Path to convert_cli binary")
    parser.add_argument("--python", default=sys.executable, help="Python executable for child smoke")
    parser.add_argument("--router-host", default="127.0.0.1", help="Router bind host")
    parser.add_argument("--router-port", type=int, default=9050, help="Router bind port")
    parser.add_argument("--router-url", default="", help="Override router base URL")
    parser.add_argument("--public-host", default="", help="Router public host")
    parser.add_argument("--emit", default="json,gltf,meta", help="Emit set for router /convert")
    parser.add_argument("--project-id", default="dwg-matrix", help="Project id")
    parser.add_argument("--wait-timeout", type=float, default=120.0, help="Router wait_timeout seconds")
    parser.add_argument("--router-ready-timeout", type=float, default=45.0, help="Router readiness timeout seconds")
    parser.add_argument("--convert-timeout", type=float, default=120.0, help="dwg2dxf timeout seconds")
    parser.add_argument("--request-timeout", type=float, default=180.0, help="HTTP timeout seconds")
    parser.add_argument("--retries", type=int, default=1, help="Retry failed case runs this many times")
    parser.add_argument("--outdir", default=str(DEFAULT_OUTDIR), help="Output root for matrix runs")
    parser.add_argument("--keep-router", action="store_true", help="Forwarded to child smoke")
    parser.add_argument("--skip-router", action="store_true", help="Forwarded to child smoke")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    cases_path = resolve_path(str(args.cases).strip() or str(DEFAULT_CASES_PATH))
    out_root = resolve_path(str(args.outdir).strip() or str(DEFAULT_OUTDIR))
    run_id = now_stamp()
    run_dir = out_root / run_id
    ensure_dir(run_dir)

    cases = load_cases(cases_path)
    results = [asdict(run_case(case, args, run_dir)) for case in cases]
    pass_count = sum(1 for item in results if item["status"] == "ok")
    fail_count = len(results) - pass_count
    validator_ok_count = sum(int(item.get("validator_ok_count") or 0) for item in results)
    dwg_convert_ok_count = sum(1 for item in results if item.get("dwg_convert_ok"))
    router_ok_count = sum(1 for item in results if item.get("router_ok"))
    convert_ok_count = sum(1 for item in results if item.get("convert_ok"))
    viewer_ok_count = sum(1 for item in results if item.get("viewer_ok"))
    first_failed_case = next((str(item["id"]) for item in results if item["status"] != "ok"), "")

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "run_dir": str(run_dir),
        "cases_path": str(cases_path),
        "case_count": len(results),
        "pass_count": pass_count,
        "fail_count": fail_count,
        "validator_ok_count": validator_ok_count,
        "dwg_convert_ok_count": dwg_convert_ok_count,
        "router_ok_count": router_ok_count,
        "convert_ok_count": convert_ok_count,
        "viewer_ok_count": viewer_ok_count,
        "first_failed_case": first_failed_case,
        "results": results,
        "summary_json": str(run_dir / "summary.json"),
        "ok": fail_count == 0,
    }
    summary_path = run_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"run_id={run_id}")
    print(f"run_dir={run_dir}")
    print(f"summary_json={summary_path}")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
