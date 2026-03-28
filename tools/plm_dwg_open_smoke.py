#!/usr/bin/env python3
import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple


DEFAULT_SAMPLE_CANDIDATES = [
    Path("/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg"),
]


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Real DWG-open smoke: DWG -> dwg2dxf -> router /convert -> viewer URL."
    )
    parser.add_argument("--input-dwg", default="", help="Path to input DWG file")
    parser.add_argument("--dwg2dxf", default="", help="Path to dwg2dxf binary")
    parser.add_argument("--plugin", default="", help="Path to DXF importer plugin")
    parser.add_argument("--convert-cli", default="", help="Path to convert_cli binary")
    parser.add_argument("--python", default=sys.executable, help="Python executable for router")
    parser.add_argument("--router-host", default="127.0.0.1", help="Router bind host")
    parser.add_argument("--router-port", type=int, default=9050, help="Router bind port")
    parser.add_argument("--router-url", default="", help="Override router base URL")
    parser.add_argument("--public-host", default="", help="Router public host")
    parser.add_argument("--emit", default="json,gltf,meta", help="Emit set for router /convert")
    parser.add_argument("--project-id", default="dwg-smoke", help="Project id")
    parser.add_argument("--document-label", default="", help="Document label override")
    parser.add_argument("--wait-timeout", type=float, default=120.0, help="Router wait_timeout seconds")
    parser.add_argument("--router-ready-timeout", type=float, default=45.0, help="Router readiness timeout seconds")
    parser.add_argument("--convert-timeout", type=float, default=120.0, help="dwg2dxf timeout seconds")
    parser.add_argument("--request-timeout", type=float, default=180.0, help="HTTP timeout seconds")
    parser.add_argument("--retries", type=int, default=1, help="Retry failed smoke runs this many times")
    parser.add_argument("--outdir", default="", help="Output root for smoke runs")
    parser.add_argument("--keep-router", action="store_true", help="Keep router running after smoke")
    parser.add_argument("--skip-router", action="store_true", help="Assume router already running")
    return parser.parse_args()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def first_existing(candidates):
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return Path(candidate).resolve()
    return Path()


def find_convert_cli(root: Path) -> Path:
    return first_existing(
        [
            root / "build" / "tools" / "convert_cli",
            root / "build_vcpkg" / "tools" / "convert_cli",
            root / "build" / "tools" / "convert_cli.exe",
            root / "build_vcpkg" / "tools" / "convert_cli.exe",
        ]
    )


def find_dxf_plugin(root: Path) -> Path:
    return first_existing(
        [
            root / "build" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
            root / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.dylib",
            root / "build" / "plugins" / "libcadgf_dxf_importer_plugin.so",
            root / "build_vcpkg" / "plugins" / "libcadgf_dxf_importer_plugin.so",
            root / "build" / "plugins" / "cadgf_dxf_importer_plugin.dll",
            root / "build_vcpkg" / "plugins" / "cadgf_dxf_importer_plugin.dll",
        ]
    )


def find_dwg2dxf() -> Path:
    env_candidates = [
        os.getenv("DWG2DXF_BIN", ""),
        os.getenv("VEMCAD_DWG2DXF_BIN", ""),
        os.getenv("CADGF_DWG2DXF_BIN", ""),
    ]
    path_candidates = [
        "/opt/homebrew/bin/dwg2dxf",
        "/usr/local/bin/dwg2dxf",
        "/opt/local/bin/dwg2dxf",
    ]
    return first_existing(env_candidates + path_candidates)


def find_input_dwg() -> Path:
    env_candidates = [
        os.getenv("DWG_INPUT", ""),
        os.getenv("VEMCAD_DWG_SMOKE_INPUT", ""),
    ]
    return first_existing(env_candidates + DEFAULT_SAMPLE_CANDIDATES)


def ensure_path(path_value: Path, label: str) -> Path:
    if not path_value or not path_value.exists():
        raise SystemExit(f"{label} not found: {path_value}")
    return path_value.resolve()


def http_json(url: str, timeout: float, method: str = "GET", data: Optional[bytes] = None, headers=None) -> Tuple[int, dict, str]:
    req = urllib.request.Request(url, method=method, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                payload = {}
            return int(resp.status), payload, text
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = {}
        return int(exc.code), payload, text


def http_text(url: str, timeout: float) -> Tuple[int, str]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        text = resp.read().decode("utf-8", errors="replace")
        return int(resp.status), text


def run_python_check(cmd: list[str], cwd: Path) -> dict:
    result = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
    return {
        "command": cmd,
        "returncode": result.returncode,
        "output": result.stdout,
        "ok": result.returncode == 0,
    }


def wait_for_router(router_url: str, timeout: float) -> dict:
    deadline = time.time() + timeout
    last_error = ""
    while time.time() < deadline:
        try:
            status, payload, text = http_json(f"{router_url}/health", timeout=3.0)
            if status == 200 and payload.get("status") == "ok":
                return {
                    "ok": True,
                    "status_code": status,
                    "payload": payload,
                    "raw": text,
                }
            last_error = text or f"unexpected status {status}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(1.0)
    return {"ok": False, "error": last_error or "router not ready"}


def run_dwg2dxf(dwg2dxf_bin: Path, input_dwg: Path, output_dxf: Path, timeout: float, log_path: Path) -> dict:
    cmd = [str(dwg2dxf_bin), "-y", "-o", str(output_dxf), str(input_dwg)]
    started = time.time()
    with log_path.open("w", encoding="utf-8") as log:
        try:
            result = subprocess.run(
                cmd,
                stdout=log,
                stderr=subprocess.STDOUT,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "error": "dwg2dxf timed out",
                "command": cmd,
                "duration_seconds": round(time.time() - started, 3),
                "log_path": str(log_path),
            }
    log_text = log_path.read_text(encoding="utf-8", errors="replace")
    warning_count = sum(1 for line in log_text.splitlines() if "warning:" in line.lower())
    error_count = sum(1 for line in log_text.splitlines() if "error:" in line.lower())
    return {
        "ok": result.returncode == 0 and output_dxf.exists(),
        "returncode": result.returncode,
        "command": cmd,
        "duration_seconds": round(time.time() - started, 3),
        "log_path": str(log_path),
        "warning_count": warning_count,
        "error_count": error_count,
        "output_exists": output_dxf.exists(),
        "output_size": output_dxf.stat().st_size if output_dxf.exists() else 0,
    }


def encode_multipart(fields: dict, file_field: str, file_path: Path) -> Tuple[bytes, str]:
    boundary = f"----vemcad-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )
    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{file_path.name}"\r\n'
            ).encode(),
            b"Content-Type: application/octet-stream\r\n\r\n",
            file_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), boundary


def parse_manifest_path_from_viewer_url(viewer_url: str, root: Path) -> Path:
    parsed = urllib.parse.urlparse(viewer_url)
    query = urllib.parse.parse_qs(parsed.query)
    manifest = query.get("manifest", [""])[0]
    if not manifest:
        return Path()
    manifest_rel = urllib.parse.unquote(manifest)
    return (root / manifest_rel).resolve()


def write_summary(summary_path: Path, summary: dict) -> None:
    summary["summary_json"] = str(summary_path)
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_attempt(args: argparse.Namespace, root: Path, run_dir: Path) -> tuple[int, dict]:
    run_dir.mkdir(parents=True, exist_ok=True)

    run_dir.mkdir(parents=True, exist_ok=True)

    input_dwg = ensure_path(Path(args.input_dwg).expanduser() if args.input_dwg else find_input_dwg(), "input DWG")
    dwg2dxf_bin = ensure_path(Path(args.dwg2dxf).expanduser() if args.dwg2dxf else find_dwg2dxf(), "dwg2dxf")
    plugin = ensure_path(Path(args.plugin).expanduser() if args.plugin else find_dxf_plugin(root), "DXF plugin")
    convert_cli = ensure_path(Path(args.convert_cli).expanduser() if args.convert_cli else find_convert_cli(root), "convert_cli")

    document_label = args.document_label or input_dwg.stem
    converted_dxf = run_dir / f"{input_dwg.stem}.dxf"
    dwg_log = run_dir / "dwg2dxf.log"
    router_log = run_dir / "router.log"
    router_runs = run_dir / "router_runs"
    router_runs.mkdir(parents=True, exist_ok=True)

    summary = {
        "ok": False,
        "repo_root": str(root),
        "run_dir": str(run_dir),
        "input_dwg": str(input_dwg),
        "converted_dxf": str(converted_dxf),
        "dwg2dxf": str(dwg2dxf_bin),
        "plugin": str(plugin),
        "convert_cli": str(convert_cli),
        "project_id": args.project_id,
        "document_label": document_label,
        "router": {},
        "dwg_convert": {},
        "convert": {},
        "viewer": {},
        "validators": {},
    }

    router_url = args.router_url or f"http://{args.router_host}:{args.router_port}"
    router_proc = None
    try:
        dwg_result = run_dwg2dxf(dwg2dxf_bin, input_dwg, converted_dxf, args.convert_timeout, dwg_log)
        summary["dwg_convert"] = dwg_result
        if not dwg_result.get("ok"):
            raise RuntimeError("dwg2dxf conversion failed")

        if not args.skip_router:
            router_cmd = [
                args.python,
                str(root / "tools" / "plm_router_service.py"),
                "--host",
                args.router_host,
                "--port",
                str(args.router_port),
                "--out-root",
                str(router_runs),
            ]
            if args.public_host:
                router_cmd.extend(["--public-host", args.public_host])
            with router_log.open("w", encoding="utf-8") as log:
                router_proc = subprocess.Popen(
                    router_cmd,
                    cwd=root,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                )
            summary["router"]["command"] = router_cmd
            summary["router"]["log_path"] = str(router_log)
            summary["router"]["pid"] = router_proc.pid

        router_health = wait_for_router(router_url, args.router_ready_timeout)
        summary["router"]["url"] = router_url
        summary["router"]["health"] = router_health
        if not router_health.get("ok"):
            raise RuntimeError(f"router not ready: {router_health.get('error', 'unknown error')}")

        fields = {
            "plugin": str(plugin),
            "convert_cli": str(convert_cli),
            "emit": args.emit,
            "project_id": args.project_id,
            "document_label": document_label,
            "wait_timeout": str(args.wait_timeout),
        }
        multipart_body, boundary = encode_multipart(fields, "file", converted_dxf)
        status, payload, raw = http_json(
            f"{router_url}/convert",
            timeout=args.request_timeout,
            method="POST",
            data=multipart_body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        summary["convert"] = {
            "status_code": status,
            "payload": payload,
            "raw_response": raw,
        }
        if status != 200 or payload.get("status") != "ok":
            raise RuntimeError(payload.get("error") or f"router convert failed ({status})")

        viewer_url = str(payload.get("viewer_url") or "")
        manifest_path = Path(payload.get("manifest_path") or "")
        output_dir = Path(payload.get("output_dir") or "")
        if not manifest_path.exists():
            manifest_path = parse_manifest_path_from_viewer_url(viewer_url, root)
        viewer_status, viewer_html = http_text(viewer_url, timeout=min(args.request_timeout, 30.0))
        summary["viewer"] = {
            "url": viewer_url,
            "status_code": viewer_status,
            "contains_statusbar": 'id="cad-status-message"' in viewer_html,
            "contains_solver_panel": 'id="cad-solver-actions"' in viewer_html,
            "manifest_path": str(manifest_path) if manifest_path else "",
            "manifest_exists": bool(manifest_path and manifest_path.exists()),
            "output_dir": str(output_dir) if output_dir else "",
            "output_dir_exists": bool(output_dir and output_dir.exists()),
        }
        if viewer_status != 200:
            raise RuntimeError(f"viewer URL returned {viewer_status}")
        if not summary["viewer"]["contains_statusbar"]:
            raise RuntimeError("viewer page missing expected statusbar marker")

        validators = {}
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
        validator_ok_count = sum(1 for item in validators.values() if isinstance(item, dict) and item.get("ok"))
        summary["validators"] = validators
        summary["validator_ok_count"] = validator_ok_count
        if validators and not all(item.get("ok") for item in validators.values()):
            raise RuntimeError("router-first DWG smoke validators failed")

        summary["ok"] = True
        summary["completed_at"] = datetime.now().isoformat(timespec="seconds")
        write_summary(run_dir / "summary.json", summary)
        return 0, summary
    except Exception as exc:  # noqa: BLE001
        summary["ok"] = False
        summary["error"] = str(exc)
        if "validator_ok_count" not in summary:
            validators = summary.get("validators") if isinstance(summary.get("validators"), dict) else {}
            summary["validator_ok_count"] = sum(
                1 for item in validators.values() if isinstance(item, dict) and item.get("ok")
            )
        summary["completed_at"] = datetime.now().isoformat(timespec="seconds")
        write_summary(run_dir / "summary.json", summary)
        return 1, summary
    finally:
        if router_proc and not args.keep_router:
            try:
                router_proc.send_signal(signal.SIGTERM)
            except Exception:  # noqa: BLE001
                pass
            try:
                router_proc.wait(timeout=5)
            except Exception:  # noqa: BLE001
                try:
                    router_proc.kill()
                except Exception:  # noqa: BLE001
                    pass


def main() -> int:
    args = parse_args()
    root = repo_root()
    out_root = Path(args.outdir).resolve() if args.outdir else (root / "build" / "plm_dwg_open_smoke")
    top_run_dir = out_root / now_stamp()
    top_run_dir.mkdir(parents=True, exist_ok=True)

    max_attempts = max(1, int(args.retries) + 1)
    attempts = []
    final_summary: dict = {}
    final_rc = 1

    for attempt in range(1, max_attempts + 1):
        attempt_dir = top_run_dir if max_attempts == 1 else (top_run_dir / f"attempt_{attempt:02d}")
        rc, attempt_summary = run_attempt(args, root, attempt_dir)
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
    final_summary["attempt_count"] = len(attempts)
    final_summary["attempts"] = attempts
    final_summary["attempt_run_dir"] = attempt_run_dir
    write_summary(top_run_dir / "summary.json", final_summary)
    print(f"run_id={top_run_dir.name}")
    print(f"summary_json={top_run_dir / 'summary.json'}")
    print(json.dumps(final_summary, indent=2, ensure_ascii=False))
    return 0 if final_summary.get("ok") else final_rc


if __name__ == "__main__":
    raise SystemExit(main())
