#!/usr/bin/env python3
"""Generate the default Step186 preview artifacts used by smoke/gate checks."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from validate_plm_preview_artifacts import validate_target


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BUILD_DIR = ROOT / "build"
DEFAULT_OUTDIR = DEFAULT_BUILD_DIR / "step186_preview_artifact_prep"


@dataclass(frozen=True)
class ArtifactCase:
    id: str
    input_path: str
    output_dir: str
    emit_json: bool = True
    emit_gltf: bool = True


CASES: List[ArtifactCase] = [
    ArtifactCase(
        id="origin_blocks_insert",
        input_path="tests/plugin_data/importer_blocks.dxf",
        output_dir="build/step186_origin_blocks",
    ),
    ArtifactCase(
        id="origin_dimension_json_only",
        input_path="tests/plugin_data/importer_text_metadata.dxf",
        output_dir="build/step186_origin_dimension",
        emit_gltf=False,
    ),
    ArtifactCase(
        id="origin_hatch_proxy",
        input_path="tests/plugin_data/hatch_dash_sample.dxf",
        output_dir="build/step186_origin_hatch",
    ),
    ArtifactCase(
        id="text_kinds_alignment_json_only",
        input_path="tests/plugin_data/step186_text_kinds_sample.dxf",
        output_dir="build/step186_text_kinds",
        emit_gltf=False,
    ),
    ArtifactCase(
        id="mleader_json_only",
        input_path="tests/plugin_data/step186_mleader_sample.dxf",
        output_dir="build/step186_mleader",
        emit_gltf=False,
    ),
    ArtifactCase(
        id="table_json_only",
        input_path="tests/plugin_data/step186_table_sample.dxf",
        output_dir="build/step186_table",
        emit_gltf=False,
    ),
    ArtifactCase(
        id="leader_proxy",
        input_path="tests/plugin_data/step186_leader_sample.dxf",
        output_dir="build/step186_leader",
    ),
    ArtifactCase(
        id="origin_mixed_insert_dimension_hatch_viewport",
        input_path="tests/plugin_data/step186_mixed_origin_sample.dxf",
        output_dir="build/step186_origin_mixed",
    ),
    ArtifactCase(
        id="insert_triad_modelspace_group_focus",
        input_path="tests/plugin_data/step186_insert_triad_sample.dxf",
        output_dir="build/step186_insert_triad",
    ),
    ArtifactCase(
        id="multi_layout_real_paperspace",
        input_path="tests/plugin_data/step186_multi_layout_sample.dxf",
        output_dir="build/step186_multi_layout",
    ),
    ArtifactCase(
        id="paperspace_insert_styles",
        input_path="tests/plugin_data/step186_paperspace_insert_styles_sample.dxf",
        output_dir="build/step186_paperspace_insert_styles",
    ),
    ArtifactCase(
        id="paperspace_insert_leader",
        input_path="tests/plugin_data/step186_paperspace_insert_leader_sample.dxf",
        output_dir="build/step186_paperspace_insert_leader",
    ),
    ArtifactCase(
        id="paperspace_insert_dimension",
        input_path="tests/plugin_data/step186_paperspace_insert_dimension_sample.dxf",
        output_dir="build/step186_paperspace_insert_dimension",
    ),
    ArtifactCase(
        id="paperspace_insert_dimension_hatch",
        input_path="tests/plugin_data/step186_paperspace_insert_dimension_hatch_sample.dxf",
        output_dir="build/step186_paperspace_insert_dimension_hatch",
    ),
    ArtifactCase(
        id="paperspace_annotation_bundle",
        input_path="tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf",
        output_dir="build/step186_paperspace_annotation_bundle",
    ),
    ArtifactCase(
        id="paperspace_combo",
        input_path="tests/plugin_data/step186_paperspace_combo_sample.dxf",
        output_dir="build/step186_paperspace_combo",
    ),
    ArtifactCase(
        id="viewport_sample_step186",
        input_path="tests/plugin_data/viewport_sample.dxf",
        output_dir="build/step186_viewport_sample",
    ),
]


@dataclass
class CaseResult:
    id: str
    input_path: str
    output_dir: str
    status: str
    error: str


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def resolve_path(raw: str) -> Path:
    candidate = Path(raw)
    if candidate.is_absolute():
        return candidate
    return (ROOT / candidate).resolve()


def find_convert_cli(build_dir: Path) -> Optional[Path]:
    names = ["convert_cli", "convert_cli.exe"]
    for name in names:
        candidate = build_dir / "tools" / name
        if candidate.is_file():
            return candidate
    return None


def find_dxf_plugin(build_dir: Path) -> Optional[Path]:
    candidates = [
        build_dir / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
        build_dir / "plugins" / "libcadgf_dxf_importer_plugin.so",
        build_dir / "plugins" / "cadgf_dxf_importer_plugin.dll",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def generate_case(convert_cli: Path, plugin: Path, case: ArtifactCase) -> None:
    input_path = resolve_path(case.input_path)
    output_dir = resolve_path(case.output_dir)
    if not input_path.is_file():
        raise FileNotFoundError(f"missing source DXF: {input_path}")
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(convert_cli),
        "--plugin",
        str(plugin),
        "--input",
        str(input_path),
        "--out",
        str(output_dir),
    ]
    if case.emit_json:
        cmd.append("--json")
    if case.emit_gltf:
        cmd.append("--gltf")
    subprocess.run(cmd, check=True, cwd=str(ROOT))


def validate_case(case: ArtifactCase) -> None:
    target = resolve_path(case.output_dir)
    validation = validate_target(target, quiet=True)
    if validation.ok():
        return
    first = validation.errors[0] if validation.errors else "validation failed"
    raise RuntimeError(f"{case.id} validation failed: {first}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare the default Step186 preview artifacts")
    parser.add_argument("--build-dir", default=str(DEFAULT_BUILD_DIR), help="Build directory")
    parser.add_argument("--convert-cli", default="", help="Override convert_cli path")
    parser.add_argument("--plugin", default="", help="Override DXF importer plugin path")
    parser.add_argument("--outdir", default=str(DEFAULT_OUTDIR), help="Summary output root")
    parser.add_argument(
        "--skip-validate",
        action="store_true",
        help="Generate artifacts without running validate_plm_preview_artifacts.py checks",
    )
    args = parser.parse_args(argv)

    build_dir = resolve_path(str(args.build_dir).strip() or str(DEFAULT_BUILD_DIR))
    outdir_root = resolve_path(str(args.outdir).strip() or str(DEFAULT_OUTDIR))
    ensure_dir(outdir_root)

    convert_cli = resolve_path(args.convert_cli) if str(args.convert_cli).strip() else find_convert_cli(build_dir)
    if not convert_cli or not convert_cli.is_file():
        raise SystemExit(f"convert_cli not found under {build_dir}")
    plugin = resolve_path(args.plugin) if str(args.plugin).strip() else find_dxf_plugin(build_dir)
    if not plugin or not plugin.is_file():
        raise SystemExit(f"DXF importer plugin not found under {build_dir}")

    run_id = now_stamp()
    run_dir = outdir_root / run_id
    ensure_dir(run_dir)

    results: List[CaseResult] = []
    for case in CASES:
        try:
            generate_case(convert_cli, plugin, case)
            if not args.skip_validate:
                validate_case(case)
            results.append(
                CaseResult(
                    id=case.id,
                    input_path=str(resolve_path(case.input_path)),
                    output_dir=str(resolve_path(case.output_dir)),
                    status="ok",
                    error="",
                )
            )
        except Exception as exc:  # noqa: BLE001
            results.append(
                CaseResult(
                    id=case.id,
                    input_path=str(resolve_path(case.input_path)),
                    output_dir=str(resolve_path(case.output_dir)),
                    status="fail",
                    error=str(exc),
                )
            )
            break

    passed = sum(1 for item in results if item.status == "ok")
    failed = sum(1 for item in results if item.status != "ok")
    summary: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "build_dir": str(build_dir),
        "convert_cli": str(convert_cli),
        "plugin": str(plugin),
        "validated": not args.skip_validate,
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
    return 0 if failed == 0 and passed == len(CASES) else 1


if __name__ == "__main__":
    sys.exit(main())
