#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


DEFAULT_SAMPLE_CANDIDATES = [
    Path("/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg"),
    Path("/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg"),
]


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Desktop DWG-open smoke using the real Electron main-process path."
    )
    parser.add_argument("--input-dwg", default="", help="Path to real DWG input")
    parser.add_argument("--electron-bin", default="", help="Path to Electron binary")
    parser.add_argument("--use-packaged-app", action="store_true", help="Run the packaged desktop app instead of electron .")
    parser.add_argument("--pack-if-needed", action="store_true", help="Run `npm run pack` if the packaged app is missing")
    parser.add_argument("--plugin", default="", help="DXF importer plugin")
    parser.add_argument("--convert-cli", default="", help="convert_cli path")
    parser.add_argument("--project-id", default="dwg-desktop-smoke", help="Project id")
    parser.add_argument("--dwg-route-mode", default="auto", help="DWG route mode: auto, direct-plugin, or local-convert")
    parser.add_argument("--router-auto-start-mode", default="on", help="Router auto-start override: on, off, or default")
    parser.add_argument("--router-url", default="http://127.0.0.1:9060", help="Router URL")
    parser.add_argument("--use-runtime-autodetect", action="store_true", help="Do not pass plugin/convert_cli/DWG convert overrides; rely on desktop runtime auto-detect")
    parser.add_argument("--emit", default="json,gltf,meta", help="Emit set")
    parser.add_argument("--outdir", default="", help="Output directory root")
    parser.add_argument("--python", default=sys.executable, help="Python executable")
    parser.add_argument("--retries", type=int, default=1, help="Retry failed desktop smoke runs this many times")
    return parser.parse_args()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def first_existing(candidates) -> Path:
    for candidate in candidates:
        if not candidate:
            continue
        candidate_path = Path(candidate).expanduser()
        if candidate_path.exists():
            return candidate_path.resolve()
    return Path()


def ensure_path(path_value: Path, label: str) -> Path:
    if not path_value or not path_value.exists():
        raise SystemExit(f"{label} not found: {path_value}")
    return path_value.resolve()


def find_input_dwg(input_arg: str) -> Path:
    if input_arg:
        return ensure_path(Path(input_arg).expanduser(), "input DWG")
    return ensure_path(first_existing(DEFAULT_SAMPLE_CANDIDATES), "input DWG")


def find_convert_cli(root: Path, override: str) -> Path:
    if override:
        return ensure_path(Path(override).expanduser(), "convert_cli")
    return ensure_path(
        first_existing(
            [
                root / "build" / "tools" / "convert_cli",
                root / "build_vcpkg" / "tools" / "convert_cli",
                root / "build" / "tools" / "convert_cli.exe",
                root / "build_vcpkg" / "tools" / "convert_cli.exe",
            ]
        ),
        "convert_cli",
    )


def find_plugin(root: Path, override: str) -> Path:
    if override:
        return ensure_path(Path(override).expanduser(), "DXF plugin")
    return ensure_path(
        first_existing(
            [
                root / "build" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
                root / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
                root / "build" / "plugins" / "libcadgf_dxf_importer_plugin.so",
                root / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.so",
                root / "build" / "plugins" / "cadgf_dxf_importer_plugin.dll",
                root / "build_vcpkg" / "plugins" / "cadgf_dxf_importer_plugin.dll",
            ]
        ),
        "DXF plugin",
    )


def find_electron(desktop_dir: Path, override: str) -> Path:
    if override:
        return ensure_path(Path(override).expanduser(), "Electron binary")
    return ensure_path(
        first_existing(
            [
                desktop_dir / "node_modules" / ".bin" / "electron",
                desktop_dir / "node_modules" / ".bin" / "electron.cmd",
            ]
        ),
        "Electron binary",
    )


def find_packaged_app_binary(desktop_dir: Path) -> Optional[Path]:
    dist_dir = desktop_dir / "dist"
    candidates = []
    candidates.extend(sorted(dist_dir.glob("mac*/VemCAD.app/Contents/MacOS/VemCAD")))
    candidates.extend(sorted(dist_dir.glob("VemCAD.app/Contents/MacOS/VemCAD")))
    candidates.extend(sorted(dist_dir.glob("win-*/VemCAD.exe")))
    candidates.extend(sorted(dist_dir.glob("win-unpacked/VemCAD.exe")))
    candidates.extend(sorted(dist_dir.glob("linux-*/VemCAD")))
    candidates.extend(sorted(dist_dir.glob("linux-unpacked/VemCAD")))
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return None


def ensure_packaged_app(desktop_dir: Path) -> Path:
    packaged = find_packaged_app_binary(desktop_dir)
    if packaged and packaged.exists():
        return packaged
    result = subprocess.run(["npm", "run", "pack"], cwd=desktop_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    if result.returncode != 0:
        raise SystemExit(f"npm run pack failed:\n{result.stdout}")
    packaged = find_packaged_app_binary(desktop_dir)
    if not packaged or not packaged.exists():
        raise SystemExit("packaged desktop app not found after `npm run pack`")
    return packaged


def find_dwg2dxf() -> Path:
    return first_existing(
        [
            os.getenv("DWG2DXF_BIN", ""),
            os.getenv("VEMCAD_DWG2DXF_BIN", ""),
            os.getenv("CADGF_DWG2DXF_BIN", ""),
            "/opt/homebrew/bin/dwg2dxf",
            "/usr/local/bin/dwg2dxf",
            "/opt/local/bin/dwg2dxf",
        ]
    )


def find_dwg_service(root: Path) -> Path:
    return first_existing(
        [
            os.getenv("VEMCAD_DWG_SERVICE_PATH", ""),
            os.getenv("CADGF_DWG_SERVICE_PATH", ""),
            root / ".." / "cadgf-dwg-service",
            Path("/Users/huazhou/Downloads/Github/cadgf-dwg-service"),
        ]
    )


def build_dwg_convert_cmd(python_bin: str, service_dir: Path, dwg2dxf: Path) -> str:
    if not service_dir:
        return ""
    script = service_dir / "cadgf_dwg_service.py"
    if not script.exists():
        return ""
    cmd = f'{python_bin} "{script}" convert'
    if dwg2dxf and dwg2dxf.exists():
        cmd += f' --dwg2dxf "{dwg2dxf}"'
    return cmd


def run_subprocess(cmd: list[str], cwd: Path, log_path: Path) -> dict:
    started = datetime.now().isoformat(timespec="seconds")
    with log_path.open("w", encoding="utf-8") as log:
        result = subprocess.run(cmd, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, check=False)
    return {
        "command": cmd,
        "cwd": str(cwd),
        "started_at": started,
        "returncode": result.returncode,
        "log_path": str(log_path),
    }


def run_python_check(cmd: list[str], cwd: Path) -> dict:
    result = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    return {
        "command": cmd,
        "returncode": result.returncode,
        "output": result.stdout,
        "ok": result.returncode == 0,
    }


def write_summary(summary_path: Path, summary: dict) -> None:
    summary["summary_json"] = str(summary_path)
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_attempt(args: argparse.Namespace, root: Path, desktop_dir: Path, run_dir: Path) -> tuple[int, dict]:
    run_dir.mkdir(parents=True, exist_ok=True)
    input_dwg = find_input_dwg(args.input_dwg)
    plugin = find_plugin(root, args.plugin)
    convert_cli = find_convert_cli(root, args.convert_cli)
    desktop_bin = (
        ensure_packaged_app(desktop_dir) if args.use_packaged_app and args.pack_if_needed
        else (ensure_path(Path(args.electron_bin).expanduser(), "packaged desktop app") if args.use_packaged_app and args.electron_bin
              else (find_packaged_app_binary(desktop_dir) if args.use_packaged_app else find_electron(desktop_dir, args.electron_bin)))
    )
    if not desktop_bin or not Path(desktop_bin).exists():
        raise SystemExit("packaged desktop app not found; pass --pack-if-needed or --electron-bin")
    dwg_service = find_dwg_service(root)
    dwg2dxf = find_dwg2dxf()
    dwg_convert_cmd = build_dwg_convert_cmd(args.python, dwg_service, dwg2dxf)
    desktop_summary_path = run_dir / "desktop_summary.json"
    desktop_log = run_dir / "desktop_smoke.log"

    cmd = [
        str(desktop_bin),
        "--smoke-dwg",
        str(input_dwg),
        "--smoke-summary",
        str(desktop_summary_path),
        "--router-url",
        args.router_url,
        "--router-emit",
        args.emit,
        "--project-id",
        args.project_id,
        "--dwg-route",
        args.dwg_route_mode,
    ]
    if args.router_auto_start_mode != "default":
        cmd.extend(["--router-auto-start", args.router_auto_start_mode])
    if not args.use_runtime_autodetect:
        cmd.extend([
            "--router-plugin",
            str(plugin),
            "--router-convert-cli",
            str(convert_cli),
        ])
    if dwg_convert_cmd and not args.use_runtime_autodetect:
        cmd.extend(["--dwg-convert-cmd", dwg_convert_cmd])

    desktop_run = run_subprocess(cmd, desktop_dir, desktop_log)
    if not desktop_summary_path.exists():
        summary = {
            "ok": False,
            "error": "desktop summary not written",
            "input_dwg": str(input_dwg),
            "desktop_run": desktop_run,
        }
        write_summary(run_dir / "summary.json", summary)
        return 1, summary

    desktop_summary = json.loads(desktop_summary_path.read_text(encoding="utf-8"))
    manifest_path = Path(desktop_summary.get("convert", {}).get("manifest_path", "") or "")
    if not manifest_path.exists():
        manifest_path = Path(desktop_summary.get("viewer", {}).get("manifest_path", "") or "")
    output_dir = Path(desktop_summary.get("convert", {}).get("output_dir", "") or "")
    if not output_dir.exists() and manifest_path.exists():
        output_dir = manifest_path.parent

    validators = {}
    prepared = desktop_summary.get("prepared", {}) or {}
    convert = desktop_summary.get("convert", {}) or {}
    route_lines = []
    route_ok = True
    prepared_route = prepared.get("route", "") or ""
    convert_route = convert.get("route", "") or ""
    prepared_route_mode = prepared.get("route_mode", "") or ""
    convert_route_mode = convert.get("route_mode", "") or ""
    if prepared_route:
        route_lines.append(f"prepared.route={prepared_route}")
        route_lines.append(f"convert.route={convert_route or '<missing>'}")
        if convert_route != prepared_route:
            route_ok = False
            route_lines.append("route mismatch between prepared plan and convert result")
    if prepared_route_mode:
        route_lines.append(f"prepared.route_mode={prepared_route_mode}")
        route_lines.append(f"convert.route_mode={convert_route_mode or '<missing>'}")
        if convert_route_mode != prepared_route_mode:
            route_ok = False
            route_lines.append("route_mode mismatch between prepared plan and convert result")
    if args.dwg_route_mode and args.dwg_route_mode != "auto":
        route_lines.append(f"requested.route_mode={args.dwg_route_mode}")
        if prepared_route_mode != args.dwg_route_mode or convert_route_mode != args.dwg_route_mode:
            route_ok = False
            route_lines.append("forced route_mode not preserved in prepared/convert results")
        expected_route = args.dwg_route_mode
        if prepared_route != expected_route or convert_route != expected_route:
            route_ok = False
            route_lines.append("forced route_mode did not produce the expected route")
    prepared_dwg_plugin = prepared.get("dwg_plugin_path", "") or ""
    convert_dwg_plugin = convert.get("dwg_plugin_path", "") or ""
    if prepared_route == "direct-plugin":
        route_lines.append(f"prepared.dwg_plugin_path={prepared_dwg_plugin or '<missing>'}")
        route_lines.append(f"convert.dwg_plugin_path={convert_dwg_plugin or '<missing>'}")
        if convert_dwg_plugin != prepared_dwg_plugin:
            route_ok = False
            route_lines.append("direct-plugin DWG plugin path missing from convert result")
    validators["route_contract"] = {
        "command": ["desktop-smoke", "route-contract"],
        "returncode": 0 if route_ok else 1,
        "output": "\n".join(route_lines) if route_lines else "no route facts available",
        "ok": route_ok,
    }

    if args.use_packaged_app and args.use_runtime_autodetect:
        packaged_dwg2dxf = str(desktop_summary.get("dwg2dxf_bin", "") or "")
        packaged_lines = [f"desktop_summary.dwg2dxf_bin={packaged_dwg2dxf or '<missing>'}"]
        normalized_dwg2dxf = packaged_dwg2dxf.replace("\\", "/")
        packaged_ok = "/cad_resources/dwg_service/bin/" in normalized_dwg2dxf
        if not packaged_ok:
            packaged_lines.append("packaged runtime did not resolve dwg2dxf from cad_resources/dwg_service/bin")
        validators["packaged_dwg2dxf_runtime"] = {
            "command": ["desktop-smoke", "packaged-dwg2dxf-runtime"],
            "returncode": 0 if packaged_ok else 1,
            "output": "\n".join(packaged_lines),
            "ok": packaged_ok,
        }

    if output_dir and output_dir.exists():
        validators["preview_artifacts"] = run_python_check(
            [args.python, "tools/validate_plm_preview_artifacts.py", str(output_dir)],
            root,
        )
    if manifest_path and manifest_path.exists():
        validators["manifest"] = run_python_check(
            [
                args.python,
                "tools/validate_plm_manifest.py",
                str(manifest_path),
                "--schema",
                "schemas/plm_manifest.schema.json",
                "--document-schema",
                "schemas/document.schema.json",
                "--check-hashes",
                "--check-document",
            ],
            root,
        )

    validator_ok_count = sum(1 for item in validators.values() if item.get("ok"))
    ok = desktop_run["returncode"] == 0 and bool(desktop_summary.get("ok"))
    ok = ok and all(item.get("ok") for item in validators.values())
    summary = {
        "ok": ok,
        "repo_root": str(root),
        "run_dir": str(run_dir),
        "input_dwg": str(input_dwg),
        "desktop_bin": str(desktop_bin),
        "use_packaged_app": bool(args.use_packaged_app),
        "plugin": str(plugin),
        "convert_cli": str(convert_cli),
        "use_runtime_autodetect": bool(args.use_runtime_autodetect),
        "dwg_route_mode": args.dwg_route_mode,
        "dwg_service": str(dwg_service) if dwg_service else "",
        "dwg2dxf": str(dwg2dxf) if dwg2dxf else "",
        "dwg_convert_cmd": dwg_convert_cmd,
        "desktop_run": desktop_run,
        "desktop_summary_path": str(desktop_summary_path),
        "desktop_summary": desktop_summary,
        "validators": validators,
        "validator_ok_count": validator_ok_count,
    }
    write_summary(run_dir / "summary.json", summary)
    return (0 if ok else 1), summary


def main() -> int:
    args = parse_args()
    root = repo_root()
    desktop_dir = root / "tools" / "web_viewer_desktop"
    out_root = Path(args.outdir).resolve() if args.outdir else (root / "build" / "plm_dwg_open_desktop_smoke")
    top_run_dir = out_root / now_stamp()
    top_run_dir.mkdir(parents=True, exist_ok=True)

    max_attempts = max(1, int(args.retries) + 1)
    attempts = []
    final_summary: dict = {}
    final_rc = 1

    for attempt in range(1, max_attempts + 1):
        attempt_dir = top_run_dir if max_attempts == 1 else (top_run_dir / f"attempt_{attempt:02d}")
        rc, attempt_summary = run_attempt(args, root, desktop_dir, attempt_dir)
        attempts.append(
            {
                "attempt": attempt,
                "ok": bool(attempt_summary.get("ok")),
                "run_dir": str(attempt_summary.get("run_dir", "")),
                "summary_json": str(attempt_summary.get("summary_json", "")),
                "error": str(attempt_summary.get("error", "")),
            }
        )
        final_summary = dict(attempt_summary)
        final_rc = rc
        if rc == 0 and attempt_summary.get("ok"):
            break

    attempt_run_dir = str(final_summary.get("run_dir", ""))
    final_summary["run_dir"] = str(top_run_dir)
    final_summary["attempt_run_dir"] = attempt_run_dir
    final_summary["attempt_count"] = len(attempts)
    final_summary["attempts"] = attempts
    write_summary(top_run_dir / "summary.json", final_summary)
    print(f"run_id={top_run_dir.name}")
    print(f"summary_json={top_run_dir / 'summary.json'}")
    print(json.dumps(final_summary, indent=2, ensure_ascii=False))
    return 0 if final_summary.get("ok") else final_rc


if __name__ == "__main__":
    raise SystemExit(main())
