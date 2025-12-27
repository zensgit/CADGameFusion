#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from email.parser import BytesParser
from email.policy import default
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse


@dataclass
class ServerConfig:
    repo_root: Path
    out_root: Path
    default_plugin: str
    default_convert_cli: str
    base_url: str
    auth_token: str
    cors_origins: List[str]
    max_bytes: int
    plugin_allowlist: List[Path]
    cli_allowlist: List[Path]


@dataclass
class TaskConfig:
    plugin: str
    input_path: Path
    output_dir: Path
    emit: str
    hash_names: bool
    keep_legacy_names: bool
    convert_cli: str
    project_id: str = ""
    document_label: str = ""


@dataclass
class TaskRecord:
    task_id: str
    config: TaskConfig
    status: str = "queued"
    created_at: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[dict] = None
    event: threading.Event = field(default_factory=threading.Event)


class TaskManager:
    def __init__(
        self,
        config: ServerConfig,
        max_workers: int,
        queue_size: int,
        ttl_seconds: int,
        cleanup_interval: int,
        history_limit: int,
        history_file: Optional[Path],
        history_load: int,
    ):
        self._config = config
        self._queue = queue.Queue(maxsize=max(queue_size, 0))
        self._tasks: Dict[str, TaskRecord] = {}
        self._lock = threading.Lock()
        self._ttl_seconds = ttl_seconds
        self._cleanup_interval = cleanup_interval
        self._history_limit = max(history_limit, 0)
        self._history: List[dict] = []
        self._history_file = history_file
        self._history_load = max(history_load, 0)
        self._stop_event = threading.Event()
        self._workers = []
        self._load_history()
        for _ in range(max(1, max_workers)):
            worker = threading.Thread(target=self._worker_loop, daemon=True)
            worker.start()
            self._workers.append(worker)
        if ttl_seconds > 0 and cleanup_interval > 0:
            cleaner = threading.Thread(target=self._cleanup_loop, daemon=True)
            cleaner.start()

    def submit(self, task: TaskRecord) -> bool:
        with self._lock:
            self._tasks[task.task_id] = task
        try:
            self._queue.put(task, block=False)
            return True
        except queue.Full:
            with self._lock:
                self._tasks.pop(task.task_id, None)
            return False

    def get(self, task_id: str) -> Optional[TaskRecord]:
        with self._lock:
            return self._tasks.get(task_id)

    def wait(self, task_id: str, timeout: Optional[float]) -> Optional[TaskRecord]:
        task = self.get(task_id)
        if not task:
            return None
        task.event.wait(timeout=timeout)
        return task

    def status_url(self, task_id: str) -> str:
        return f"{self._config.base_url}/status/{task_id}"

    def record_history(self, task: TaskRecord) -> None:
        entry = {
            "task_id": task.task_id,
            "state": task.status,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "finished_at": task.finished_at,
            "viewer_url": None,
            "error": task.error,
            "project_id": task.config.project_id,
            "document_label": task.config.document_label,
        }
        if task.status == "done" and task.result:
            entry["viewer_url"] = task.result.get("viewer_url")
        with self._lock:
            self._history.insert(0, entry)
            if self._history_limit and len(self._history) > self._history_limit:
                self._history = self._history[: self._history_limit]
            self._append_history(entry)

    def list_history(
        self,
        limit: int,
        project_id: str = "",
        state: str = "",
        from_ts: str = "",
        to_ts: str = "",
    ) -> List[dict]:
        with self._lock:
            entries = list(self._history)

        def matches(entry: dict) -> bool:
            if project_id and entry.get("project_id") != project_id:
                return False
            if state and entry.get("state") != state:
                return False
            created = entry.get("created_at") or ""
            if from_ts and created and created < from_ts:
                return False
            if to_ts and created and created > to_ts:
                return False
            return True

        filtered = [entry for entry in entries if matches(entry)]
        if limit <= 0:
            return filtered
        return filtered[:limit]

    def _append_history(self, entry: dict) -> None:
        if not self._history_file:
            return
        try:
            with self._history_file.open("a", encoding="utf-8") as fh:
                json.dump(entry, fh)
                fh.write("\n")
        except Exception as exc:
            sys.stderr.write(f"history write failed: {exc}\n")

    def _load_history(self) -> None:
        if not self._history_file or not self._history_file.exists():
            return
        max_entries = None if self._history_load == 0 else self._history_load
        buffer = deque(maxlen=max_entries)
        try:
            with self._history_file.open("r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(entry, dict):
                        buffer.append(entry)
        except Exception as exc:
            sys.stderr.write(f"history load failed: {exc}\n")
            return
        entries = list(buffer)
        entries.reverse()
        if self._history_limit and len(entries) > self._history_limit:
            entries = entries[: self._history_limit]
        with self._lock:
            self._history = entries

    def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                task = self._queue.get(timeout=0.2)
            except queue.Empty:
                continue
            self._run_task(task)
            self._queue.task_done()

    def _run_task(self, task: TaskRecord) -> None:
        with self._lock:
            task.status = "running"
            task.started_at = now_iso()

        try:
            result = self._convert(task.config)
        except Exception as exc:
            result = {"ok": False, "error": str(exc)}

        with self._lock:
            if result.get("ok"):
                task.status = "done"
                task.result = result.get("payload", {})
            else:
                task.status = "error"
                task.error = result.get("error", "conversion failed")
            task.finished_at = now_iso()
            self.record_history(task)
            task.event.set()

    def _convert(self, config: TaskConfig) -> dict:
        plm_convert = self._config.repo_root / "tools" / "plm_convert.py"
        cmd = [
            sys.executable,
            str(plm_convert),
            "--plugin",
            config.plugin,
            "--input",
            str(config.input_path),
            "--out",
            str(config.output_dir),
        ]
        if config.emit:
            cmd.extend(["--emit", config.emit])
        if config.hash_names:
            cmd.append("--hash-names")
        if config.keep_legacy_names:
            cmd.append("--keep-legacy-names")
        if config.convert_cli:
            cmd.extend(["--convert-cli", config.convert_cli])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr.strip() or "conversion failed"}

        manifest_path = config.output_dir / "manifest.json"
        manifest = load_manifest(manifest_path)
        if not manifest:
            return {"ok": False, "error": "manifest.json missing or invalid"}

        manifest_rel = os.path.relpath(manifest_path, self._config.repo_root)
        manifest_url = quote(Path(manifest_rel).as_posix())
        viewer_url = f"{self._config.base_url}/tools/web_viewer/index.html?manifest={manifest_url}"

        artifact_urls = {}
        for key, name in manifest.get("artifacts", {}).items():
            artifact_path = config.output_dir / name
            rel = os.path.relpath(artifact_path, self._config.repo_root)
            artifact_urls[key] = f"{self._config.base_url}/{quote(Path(rel).as_posix())}"

        payload = {
            "manifest": manifest,
            "manifest_path": str(manifest_path),
            "viewer_url": viewer_url,
            "artifact_urls": artifact_urls,
            "output_dir": str(config.output_dir),
        }
        return {"ok": True, "payload": payload}

    def _cleanup_loop(self) -> None:
        while not self._stop_event.is_set():
            self._cleanup_once()
            self._stop_event.wait(self._cleanup_interval)

    def _cleanup_once(self) -> None:
        if self._ttl_seconds <= 0:
            return
        if not self._config.out_root.exists():
            return
        cutoff = time.time() - self._ttl_seconds
        active_dirs = set()
        with self._lock:
            for task in self._tasks.values():
                if task.status in {"queued", "running"}:
                    active_dirs.add(str(task.config.output_dir))
        for entry in self._config.out_root.iterdir():
            if not entry.is_dir():
                continue
            if str(entry) in active_dirs:
                continue
            try:
                mtime = entry.stat().st_mtime
            except OSError:
                continue
            if mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)


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
    parser.add_argument("--auth-token", default="", help="Bearer token for /convert and /status")
    parser.add_argument(
        "--cors-origins",
        default="",
        help="Comma-separated allowlist of origins (use * to allow all)",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=50 * 1024 * 1024,
        help="Max upload size in bytes (0 disables)",
    )
    parser.add_argument(
        "--plugin-allowlist",
        default="",
        help="Comma-separated allowed plugin paths or directories",
    )
    parser.add_argument(
        "--cli-allowlist",
        default="",
        help="Comma-separated allowed convert_cli paths or directories",
    )
    parser.add_argument("--max-workers", type=int, default=1, help="Max concurrent conversions")
    parser.add_argument("--queue-size", type=int, default=8, help="Max queued jobs (0 = unbounded)")
    parser.add_argument("--ttl-seconds", type=int, default=3600, help="TTL for output cleanup (0 disables)")
    parser.add_argument("--history-limit", type=int, default=200, help="Max history entries (0 = unbounded)")
    parser.add_argument("--history-file", default="", help="Append task history to JSONL file")
    parser.add_argument(
        "--history-load",
        type=int,
        default=200,
        help="Max history entries to load on startup (0 = all)",
    )
    parser.add_argument(
        "--cleanup-interval",
        type=int,
        default=300,
        help="Cleanup interval seconds (0 disables)",
    )
    return parser.parse_args()


def now_iso() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def parse_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def decode_query_value(raw: str) -> str:
    try:
        return unquote(raw)
    except Exception:
        return raw


def parse_allowlist(value: str, repo_root: Path) -> List[Path]:
    entries = []
    for token in parse_csv(value):
        path = Path(token)
        if not path.is_absolute():
            path = repo_root / path
        entries.append(path.resolve())
    return entries


def is_path_allowed(path_value: str, allowlist: List[Path]) -> bool:
    if not allowlist:
        return True
    try:
        resolved = Path(path_value).resolve()
    except Exception:
        return False
    for allowed in allowlist:
        if resolved == allowed:
            return True
        try:
            resolved.relative_to(allowed)
            return True
        except ValueError:
            continue
    return False


def env_or_arg(value: str, key: str) -> str:
    return value if value else os.getenv(key, "")


def env_or_int(value: int, key: str) -> int:
    if value:
        return value
    env_value = os.getenv(key)
    if not env_value:
        return value
    try:
        return int(env_value)
    except ValueError:
        return value


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


def respond_json(handler, status: int, payload: dict, extra_headers: Optional[Dict[str, str]] = None) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(body)


def make_handler(config: ServerConfig, manager: TaskManager):
    class RouterHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(config.repo_root), **kwargs)

        def log_message(self, format, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

        def _get_cors_origin(self) -> Optional[str]:
            origin = self.headers.get("Origin")
            if not origin or not config.cors_origins:
                return None
            if "*" in config.cors_origins:
                return "*"
            if origin in config.cors_origins:
                return origin
            return None

        def end_headers(self):
            origin = self._get_cors_origin()
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Max-Age", "86400")
            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(204)
            self.end_headers()

        def _authorized(self) -> bool:
            if not config.auth_token:
                return True
            header = self.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return False
            token = header[len("Bearer ") :].strip()
            return token == config.auth_token

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                respond_json(self, 200, {"status": "ok"})
                return
            if parsed.path == "/history":
                if not self._authorized():
                    respond_json(
                        self,
                        401,
                        {"status": "error", "message": "unauthorized"},
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                query = parsed.query or ""
                limit = 50
                if "limit=" in query:
                    try:
                        limit = int(query.split("limit=", 1)[1].split("&", 1)[0])
                    except ValueError:
                        limit = 50
                if limit < 0:
                    limit = 0
                project_id = ""
                state = ""
                from_ts = ""
                to_ts = ""
                if "project_id=" in query:
                    project_id = decode_query_value(query.split("project_id=", 1)[1].split("&", 1)[0])
                if "state=" in query:
                    state = decode_query_value(query.split("state=", 1)[1].split("&", 1)[0])
                if "from=" in query:
                    from_ts = decode_query_value(query.split("from=", 1)[1].split("&", 1)[0])
                if "to=" in query:
                    to_ts = decode_query_value(query.split("to=", 1)[1].split("&", 1)[0])
                entries = manager.list_history(limit, project_id=project_id, state=state, from_ts=from_ts, to_ts=to_ts)
                respond_json(self, 200, {"status": "ok", "count": len(entries), "items": entries})
                return
            if parsed.path.startswith("/status/"):
                if not self._authorized():
                    respond_json(
                        self,
                        401,
                        {"status": "error", "message": "unauthorized"},
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                task_id = parsed.path.split("/status/", 1)[1]
                task = manager.get(task_id)
                if not task:
                    respond_json(self, 404, {"status": "error", "message": "task not found"})
                    return
                payload = {
                    "status": "ok",
                    "task_id": task.task_id,
                    "state": task.status,
                    "created_at": task.created_at,
                    "started_at": task.started_at,
                    "finished_at": task.finished_at,
                    "status_url": manager.status_url(task.task_id),
                }
                if task.status == "done" and task.result:
                    payload.update(task.result)
                if task.status == "error":
                    payload["error"] = task.error
                respond_json(self, 200, payload)
                self.log_message("GET /status/%s -> %s", task_id, task.status)
                return
            super().do_GET()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path != "/convert":
                respond_json(self, 404, {"status": "error", "message": "unknown endpoint"})
                return

            if not self._authorized():
                respond_json(
                    self,
                    401,
                    {"status": "error", "message": "unauthorized"},
                    {"WWW-Authenticate": "Bearer"},
                )
                return

            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                respond_json(self, 400, {"status": "error", "message": "invalid content length"})
                return
            if length <= 0:
                respond_json(self, 400, {"status": "error", "message": "empty request"})
                return
            if config.max_bytes > 0 and length > config.max_bytes:
                respond_json(self, 413, {"status": "error", "message": "payload too large"})
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
            if not is_path_allowed(plugin, config.plugin_allowlist):
                respond_json(self, 403, {"status": "error", "message": "plugin not allowed"})
                return

            emit = fields.get("emit", "")
            hash_names = parse_bool(fields.get("hash_names"))
            keep_legacy = parse_bool(fields.get("keep_legacy_names"))
            project_id = fields.get("project_id", "").strip()
            document_label = fields.get("document_label", "").strip()
            convert_cli = fields.get("convert_cli") or config.default_convert_cli
            if convert_cli and not Path(convert_cli).exists():
                respond_json(self, 400, {"status": "error", "message": "convert_cli not found"})
                return
            if convert_cli and not is_path_allowed(convert_cli, config.cli_allowlist):
                respond_json(self, 403, {"status": "error", "message": "convert_cli not allowed"})
                return

            async_flag = parse_bool(fields.get("async"))
            wait_flag = parse_bool(fields.get("wait")) if "wait" in fields else True
            if async_flag:
                wait_flag = False
            wait_timeout = None
            if "wait_timeout" in fields:
                try:
                    wait_timeout = float(fields.get("wait_timeout", "0") or 0)
                except ValueError:
                    wait_timeout = None

            task_id = uuid.uuid4().hex
            task_config = TaskConfig(
                plugin=plugin,
                input_path=input_path,
                output_dir=output_dir,
                emit=emit,
                hash_names=hash_names,
                keep_legacy_names=keep_legacy,
                convert_cli=convert_cli,
                project_id=project_id,
                document_label=document_label or filename,
            )
            task = TaskRecord(task_id=task_id, config=task_config, created_at=now_iso())
            if not manager.submit(task):
                respond_json(self, 429, {"status": "error", "message": "queue full"})
                return

            status_url = manager.status_url(task_id)
            if not wait_flag:
                respond_json(
                    self,
                    202,
                    {
                        "status": "ok",
                        "task_id": task_id,
                        "state": task.status,
                        "status_url": status_url,
                    },
                )
                self.log_message("POST /convert queued task_id=%s", task_id)
                return

            task = manager.wait(task_id, timeout=wait_timeout)
            if not task:
                respond_json(self, 404, {"status": "error", "message": "task not found"})
                return

            if task.status == "done" and task.result:
                payload = {
                    "status": "ok",
                    "task_id": task_id,
                    "state": task.status,
                    "status_url": status_url,
                }
                payload.update(task.result)
                respond_json(self, 200, payload)
                self.log_message("POST /convert done task_id=%s", task_id)
                return
            if task.status == "error":
                respond_json(
                    self,
                    500,
                    {
                        "status": "error",
                        "task_id": task_id,
                        "state": task.status,
                        "status_url": status_url,
                        "error": task.error,
                    },
                )
                self.log_message("POST /convert error task_id=%s", task_id)
                return

            respond_json(
                self,
                202,
                {
                    "status": "ok",
                    "task_id": task_id,
                    "state": task.status,
                    "status_url": status_url,
                },
            )
            self.log_message("POST /convert pending task_id=%s", task_id)

    return RouterHandler


def build_base_url(host: str, port: int, public_host: str) -> str:
    resolved = public_host
    if not resolved:
        resolved = host
        if resolved in {"0.0.0.0", "::"}:
            resolved = "localhost"
    return f"http://{resolved}:{port}"


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    out_root = (repo_root / args.out_root).resolve()
    base_url = build_base_url(args.host, args.port, args.public_host)

    auth_token = env_or_arg(args.auth_token, "CADGF_ROUTER_AUTH_TOKEN")
    cors_raw = env_or_arg(args.cors_origins, "CADGF_ROUTER_CORS_ORIGINS")
    plugin_allowlist_raw = env_or_arg(args.plugin_allowlist, "CADGF_ROUTER_PLUGIN_ALLOWLIST")
    cli_allowlist_raw = env_or_arg(args.cli_allowlist, "CADGF_ROUTER_CLI_ALLOWLIST")
    history_file_raw = env_or_arg(args.history_file, "CADGF_ROUTER_HISTORY_FILE")
    history_load = args.history_load
    env_history_load = os.getenv("CADGF_ROUTER_HISTORY_LOAD")
    if env_history_load and args.history_load == 200:
        try:
            history_load = int(env_history_load)
        except ValueError:
            history_load = args.history_load
    max_bytes = args.max_bytes
    env_max = os.getenv("CADGF_ROUTER_MAX_BYTES")
    if env_max and args.max_bytes == 50 * 1024 * 1024:
        try:
            max_bytes = int(env_max)
        except ValueError:
            max_bytes = args.max_bytes
    if max_bytes < 0:
        max_bytes = 0

    cors_origins = parse_csv(cors_raw)
    plugin_allowlist = parse_allowlist(plugin_allowlist_raw, repo_root)
    cli_allowlist = parse_allowlist(cli_allowlist_raw, repo_root)
    history_file = None
    if history_file_raw:
        history_path = Path(history_file_raw)
        if not history_path.is_absolute():
            history_path = repo_root / history_path
        history_file = history_path.resolve()
        history_file.parent.mkdir(parents=True, exist_ok=True)

    config = ServerConfig(
        repo_root=repo_root,
        out_root=out_root,
        default_plugin=args.default_plugin,
        default_convert_cli=args.default_convert_cli,
        base_url=base_url,
        auth_token=auth_token,
        cors_origins=cors_origins,
        max_bytes=max_bytes,
        plugin_allowlist=plugin_allowlist,
        cli_allowlist=cli_allowlist,
    )

    manager = TaskManager(
        config=config,
        max_workers=args.max_workers,
        queue_size=args.queue_size,
        ttl_seconds=args.ttl_seconds,
        cleanup_interval=args.cleanup_interval,
        history_limit=args.history_limit,
        history_file=history_file,
        history_load=history_load,
    )
    handler = make_handler(config, manager)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving CADGameFusion at {base_url}")
    print("POST /convert (multipart form-data) with fields: file, plugin, emit, hash_names")
    print(f"Output root: {out_root}")
    if auth_token:
        print("Auth: enabled (Bearer token)")
    if cors_origins:
        print(f"CORS allowlist: {', '.join(cors_origins)}")
    if max_bytes > 0:
        print(f"Max upload bytes: {max_bytes}")
    if history_file:
        print(f"History file: {history_file} (load {history_load or 'all'})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
