#!/usr/bin/env python3
"""Regenerate legacy preview artifact directories from their existing manifests."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTDIR = ROOT / "build" / "preview_artifact_prep_legacy_weekly"
DEFAULT_CASES_PATH = ROOT / "tools" / "web_viewer" / "tests" / "fixtures" / "preview_artifact_smoke_cases_legacy.json"
DEFAULT_PLM_CONVERT = ROOT / "tools" / "plm_convert.py"


@dataclass
class CaseResult:
    id: str
    target: str
    input: str
    plugin: str
    status: str
    exit_code: int
    duration_ms: int
    error: str


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
        if not case_id:
            raise ValueError(f"case #{index + 1} in {path} has empty id")
        if not target:
            raise ValueError(f"case {case_id} missing target")
        normalized.append({"id": case_id, "target": target})
    return normalized


def find_plugin(manifest_plugin: str) -> Path:
    candidates: List[Path] = []
    if manifest_plugin:
        candidates.append(Path(manifest_plugin))
    candidates.extend(
        [
            ROOT / "build" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
            ROOT / "build" / "plugins" / "libcadgf_dxf_importer_plugin.so",
            ROOT / "build" / "plugins" / "cadgf_dxf_importer_plugin.dll",
            ROOT / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
            ROOT / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.so",
            ROOT / "build_vcpkg" / "plugins" / "cadgf_dxf_importer_plugin.dll",
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return Path()


def normalize_emit(outputs: Any) -> str:
    if not isinstance(outputs, list):
        return "json,gltf,meta"
    tokens = [str(one).strip().lower() for one in outputs if str(one).strip()]
    normalized: List[str] = []
    for token in tokens:
        if token in {"json", "gltf", "meta"} and token not in normalized:
            normalized.append(token)
    if not normalized:
        return "json,gltf,meta"
    if "meta" in normalized and "gltf" not in normalized:
        normalized.append("gltf")
    return ",".join(normalized)


def run_case(case: Dict[str, Any], plm_convert: Path) -> CaseResult:
    target = resolve_path(str(case["target"]))
    manifest_path = target / "manifest.json"
    started = time.perf_counter()

    if not manifest_path.exists():
        return CaseResult(str(case["id"]), str(target), "", "", "missing_manifest", 0, 0, str(manifest_path))

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return CaseResult(str(case["id"]), str(target), "", "", "invalid_manifest", 0, 0, str(exc))

    input_path = Path(str(manifest.get("input") or "")).expanduser()
    if not input_path.exists():
        return CaseResult(
            str(case["id"]),
            str(target),
            str(input_path),
            "",
            "missing_input",
            0,
            0,
            f"missing input: {input_path}",
        )

    plugin_path = find_plugin(str(manifest.get("plugin") or ""))
    if not plugin_path.exists():
        return CaseResult(
            str(case["id"]),
            str(target),
            str(input_path),
            "",
            "missing_plugin",
            0,
            0,
            "plugin not found",
        )

    emit = normalize_emit(manifest.get("outputs"))
    cmd = [
        sys.executable,
        str(plm_convert),
        "--plugin",
        str(plugin_path),
        "--input",
        str(input_path),
        "--out",
        str(target),
        "--clean",
        "--emit",
        emit,
    ]
    for key in ("project_id", "document_label", "document_id"):
        value = str(manifest.get(key) or "").strip()
        if value:
            cmd.extend([f"--{key.replace('_', '-')}", value])

    proc = subprocess.run(cmd, capture_output=True, text=True)
    duration_ms = int((time.perf_counter() - started) * 1000)
    if proc.returncode == 0:
        return CaseResult(
            str(case["id"]),
            str(target),
            str(input_path),
            str(plugin_path),
            "ok",
            0,
            duration_ms,
            "",
        )
    error = proc.stderr.strip() or proc.stdout.strip() or f"plm_convert failed rc={proc.returncode}"
    return CaseResult(
        str(case["id"]),
        str(target),
        str(input_path),
        str(plugin_path),
        "fail",
        int(proc.returncode),
        duration_ms,
        error,
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Regenerate legacy preview artifact directories from manifest.json")
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH), help="JSON case list")
    parser.add_argument("--outdir", default=str(DEFAULT_OUTDIR), help="Output directory root")
    parser.add_argument("--plm-convert", default=str(DEFAULT_PLM_CONVERT), help="plm_convert.py path")
    args = parser.parse_args(argv)

    cases_path = resolve_path(str(args.cases).strip() or str(DEFAULT_CASES_PATH))
    outdir_root = resolve_path(str(args.outdir).strip() or str(DEFAULT_OUTDIR))
    plm_convert = resolve_path(str(args.plm_convert).strip() or str(DEFAULT_PLM_CONVERT))
    run_id = now_stamp()
    run_dir = outdir_root / run_id
    ensure_dir(run_dir)

    cases = load_cases(cases_path)
    results = [run_case(case, plm_convert) for case in cases]
    passed = sum(1 for item in results if item.status == "ok")
    failed = len(results) - passed
    missing_input_count = sum(1 for item in results if item.status == "missing_input")
    missing_manifest_count = sum(1 for item in results if item.status == "missing_manifest")
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases_path": str(cases_path),
        "outdir": str(run_dir),
        "run_id": run_id,
        "passed": passed,
        "failed": failed,
        "missing_input_count": missing_input_count,
        "missing_manifest_count": missing_manifest_count,
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
