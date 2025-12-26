#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from email.parser import BytesParser
from email.policy import default
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse


@dataclass
class ServerConfig:
    repo_root: Path
    out_root: Path
    default_plugin: str
    default_convert_cli: str
    public_host: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PLM router service (upload -> convert -> preview URL).")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=9000, help="Bind port (default: 9000)")
    parser.add_argument(
        "--out-root",
        default="build_vcpkg/plm_service_runs",
        help="Output root for conversion runs",
    )
    parser.add_argument(
        "--default-plugin",
        default="",
        help="Default importer plugin path (used when request omits plugin)",
    )
    parser.add_argument(
        "--default-convert-cli",
        default="",
        help="Default convert_cli path (used when request omits convert_cli)",
    )
    parser.add_argument(
        "--public-host",
        default="",
        help="Public host for viewer URL (defaults to bind host/localhost)",
    )
    return parser.parse_args()


def parse_bool(value: str) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_multipart(body: bytes, content_type: str):
    if not content_type:
        return {}, []
    header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8")
    msg = BytesParser(policy=default).parsebytes(header + body)
    if not msg.is_multipart():
        return {}, []
    fields = {}
    files = []
    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        filename = part.get_filename()
        data = part.get_payload(decode=True) or b""
        if filename:
            files.append(
                {
                    "name": name,
                    "filename": filename,
                    "content_type": part.get_content_type(),
                    "data": data,
                }
            )
        else:
            fields[name] = data.decode("utf-8", errors="replace")
    return fields, files


def sanitize_filename(name: str) -> str:
    base = os.path.basename(name or "")
    return base or "upload.bin"


def make_run_dir(out_root: Path) -> Path:
    out_root.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    suffix = f"{stamp}_{os.getpid()}"
    run_dir = out_root / suffix
    counter = 0
    while run_dir.exists():
        counter += 1
        run_dir = out_root / f"{suffix}_{counter}"
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def load_manifest(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def respond_json(handler, status: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def make_handler(config: ServerConfig):
    class RouterHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(config.repo_root), **kwargs)

        def log_message(self, format, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                respond_json(self, 200, {"status": "ok"})
                return
            super().do_GET()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path != "/convert":
                respond_json(self, 404, {"status": "error", "message": "unknown endpoint"})
                return

            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                respond_json(self, 400, {"status": "error", "message": "empty request"})
                return

            content_type = self.headers.get("Content-Type", "")
            body = self.rfile.read(length)
            fields, files = parse_multipart(body, content_type)
            if not files:
                respond_json(self, 400, {"status": "error", "message": "missing file"})
                return

            file_part = files[0]
            filename = sanitize_filename(file_part.get("filename"))
            run_dir = make_run_dir(config.out_root)
            input_dir = run_dir / "input"
            output_dir = run_dir / "output"
            input_dir.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)

            input_path = input_dir / filename
            with input_path.open("wb") as fh:
                fh.write(file_part.get("data", b""))

            plugin = fields.get("plugin") or config.default_plugin
            if not plugin:
                respond_json(self, 400, {"status": "error", "message": "missing plugin"})
                return
            if not Path(plugin).exists():
                respond_json(self, 400, {"status": "error", "message": "plugin not found"})
                return

            emit = fields.get("emit", "")
            hash_names = parse_bool(fields.get("hash_names", ""))
            keep_legacy = parse_bool(fields.get("keep_legacy_names", ""))
            convert_cli = fields.get("convert_cli") or config.default_convert_cli

            plm_convert = config.repo_root / "tools" / "plm_convert.py"
            cmd = [
                sys.executable,
                str(plm_convert),
                "--plugin",
                plugin,
                "--input",
                str(input_path),
                "--out",
                str(output_dir),
            ]
            if emit:
                cmd.extend(["--emit", emit])
            if hash_names:
                cmd.append("--hash-names")
            if keep_legacy:
                cmd.append("--keep-legacy-names")
            if convert_cli:
                cmd.extend(["--convert-cli", convert_cli])

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                respond_json(
                    self,
                    500,
                    {
                        "status": "error",
                        "message": "conversion failed",
                        "stderr": result.stderr.strip(),
                    },
                )
                return

            manifest_path = output_dir / "manifest.json"
            manifest = load_manifest(manifest_path)

            host = config.public_host
            if not host:
                host = self.server.server_address[0]
                if host in {"0.0.0.0", "::"}:
                    host = "localhost"
            port = self.server.server_address[1]

            manifest_rel = os.path.relpath(manifest_path, config.repo_root)
            manifest_url = quote(Path(manifest_rel).as_posix())
            viewer_url = (
                f"http://{host}:{port}/tools/web_viewer/index.html?manifest={manifest_url}"
            )

            artifact_urls = {}
            for key, name in manifest.get("artifacts", {}).items():
                artifact_path = output_dir / name
                rel = os.path.relpath(artifact_path, config.repo_root)
                artifact_urls[key] = f"http://{host}:{port}/{quote(Path(rel).as_posix())}"

            respond_json(
                self,
                200,
                {
                    "status": "ok",
                    "manifest": manifest,
                    "manifest_path": str(manifest_path),
                    "viewer_url": viewer_url,
                    "artifact_urls": artifact_urls,
                    "output_dir": str(output_dir),
                },
            )

    return RouterHandler


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    out_root = (repo_root / args.out_root).resolve()
    config = ServerConfig(
        repo_root=repo_root,
        out_root=out_root,
        default_plugin=args.default_plugin,
        default_convert_cli=args.default_convert_cli,
        public_host=args.public_host,
    )

    handler = make_handler(config)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving CADGameFusion at http://{args.host}:{args.port}")
    print("POST /convert (multipart form-data) with fields: file, plugin, emit, hash_names")
    print(f"Output root: {out_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
