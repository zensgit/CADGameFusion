#!/usr/bin/env python3
import argparse
import base64
import datetime as dt
import json
import os
import queue
import shutil
import socket
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
from urllib.parse import parse_qs, quote, unquote, urlparse


ERROR_CODES = tuple(
    sorted(
        {
            "AUTH_REQUIRED",
            "BAD_CONTENT_LENGTH",
            "CONVERT_CLI_NOT_ALLOWED",
            "CONVERT_CLI_NOT_FOUND",
            "CONVERT_EXCEPTION",
            "CONVERT_FAILED",
            "DOCUMENT_NOT_FOUND",
            "DOCUMENT_SCHEMA_NOT_ALLOWED",
            "DOCUMENT_SCHEMA_NOT_FOUND",
            "EMPTY_REQUEST",
            "INVALID_ANNOTATIONS_JSON",
            "INVALID_BODY",
            "INVALID_DOCUMENT_ID",
            "INVALID_DOCUMENT_TARGET",
            "MANIFEST_MISSING",
            "MISSING_ANNOTATIONS",
            "MISSING_DOCUMENT_IDENTITY",
            "MISSING_FILE",
            "MISSING_PLUGIN",
            "MISSING_PROJECT_ID",
            "PAYLOAD_TOO_LARGE",
            "PLUGIN_NOT_ALLOWED",
            "PLUGIN_NOT_FOUND",
            "QUEUE_FULL",
            "TASK_NOT_FOUND",
            "UNKNOWN_ENDPOINT",
        }
    )
)


@dataclass
class ServerConfig:
    repo_root: Path
    out_root: Path
    default_plugin: str
    plugin_map: Dict[str, str]
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
    migrate_document: bool = False
    document_target: int = 0
    document_backup: bool = False
    validate_document: bool = False
    document_schema: str = ""
    owner: str = ""
    tags: List[str] = field(default_factory=list)
    revision_note: str = ""
    annotations: List[dict] = field(default_factory=list)


@dataclass
class TaskRecord:
    task_id: str
    config: TaskConfig
    status: str = "queued"
    created_at: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
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
            "error_code": task.error_code,
            "project_id": task.config.project_id,
            "document_label": task.config.document_label,
            "owner": task.config.owner,
            "tags": task.config.tags,
            "revision_note": task.config.revision_note,
            "annotations": task.config.annotations,
            "event": "convert",
        }
        if task.status == "done" and task.result:
            entry["viewer_url"] = task.result.get("viewer_url")
        normalize_history_entry(entry)
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
        owner: str = "",
        tags: Optional[List[str]] = None,
        revision: str = "",
        event: str = "",
    ) -> List[dict]:
        with self._lock:
            entries = list(self._history)

        tag_filter = tags or []
        event_filter = event.strip().lower()

        def matches(entry: dict) -> bool:
            normalize_history_entry(entry)
            if project_id and entry.get("project_id") != project_id:
                return False
            if state and entry.get("state") != state:
                return False
            if event_filter:
                entry_event = str(entry.get("event") or "").lower()
                if entry_event != event_filter:
                    return False
            if not matches_metadata(entry, owner, tag_filter, revision):
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

    def list_projects(
        self,
        limit: int,
        owner: str = "",
        tags: Optional[List[str]] = None,
        revision: str = "",
        event: str = "",
    ) -> List[dict]:
        with self._lock:
            entries = list(self._history)

        tag_filter = tags or []
        event_filter = event.strip().lower()
        projects: Dict[str, dict] = {}
        order: List[str] = []
        for entry in entries:
            normalize_history_entry(entry)
            if not matches_metadata(entry, owner, tag_filter, revision):
                continue
            if event_filter:
                entry_event = str(entry.get("event") or "").lower()
                if entry_event != event_filter:
                    continue
            project_id = normalize_project_id(entry.get("project_id"))
            if project_id not in projects:
                annotations = entry.get("annotations") or []
                projects[project_id] = {
                    "project_id": project_id,
                    "latest_task_id": entry.get("task_id"),
                    "latest_state": entry.get("state"),
                    "last_activity": entry.get("created_at"),
                    "owner": entry.get("owner", ""),
                    "tags": entry.get("tags", []),
                    "revision_note": entry.get("revision_note", ""),
                    "annotation_count": len(annotations),
                    "latest_annotation": annotations[-1] if annotations else None,
                    "_docs": set(),
                }
                order.append(project_id)
            label = normalize_document_label(entry.get("document_label"))
            projects[project_id]["_docs"].add(label)

        payload = []
        for project_id in order:
            data = projects[project_id]
            data["document_count"] = len(data.pop("_docs", set()))
            payload.append(data)
            if limit > 0 and len(payload) >= limit:
                break
        return payload

    def list_documents(
        self,
        project_id: str,
        limit: int,
        owner: str = "",
        tags: Optional[List[str]] = None,
        revision: str = "",
        event: str = "",
    ) -> List[dict]:
        with self._lock:
            entries = list(self._history)

        tag_filter = tags or []
        event_filter = event.strip().lower()
        documents: Dict[str, dict] = {}
        order: List[str] = []
        for entry in entries:
            normalize_history_entry(entry)
            if not matches_metadata(entry, owner, tag_filter, revision):
                continue
            if event_filter:
                entry_event = str(entry.get("event") or "").lower()
                if entry_event != event_filter:
                    continue
            if normalize_project_id(entry.get("project_id")) != project_id:
                continue
            label = normalize_document_label(entry.get("document_label"))
            document_id = encode_document_id(project_id, label)
            if document_id not in documents:
                annotations = entry.get("annotations") or []
                documents[document_id] = {
                    "document_id": document_id,
                    "document_label": label,
                    "project_id": project_id,
                    "latest_task_id": entry.get("task_id"),
                    "latest_state": entry.get("state"),
                    "last_activity": entry.get("created_at"),
                    "latest_viewer_url": entry.get("viewer_url"),
                    "owner": entry.get("owner", ""),
                    "tags": entry.get("tags", []),
                    "revision_note": entry.get("revision_note", ""),
                    "annotation_count": len(annotations),
                    "latest_annotation": annotations[-1] if annotations else None,
                    "version_count": 0,
                }
                order.append(document_id)
            documents[document_id]["version_count"] += 1

        payload = []
        for document_id in order:
            payload.append(documents[document_id])
            if limit > 0 and len(payload) >= limit:
                break
        return payload

    def list_document_versions(
        self,
        project_id: str,
        document_label: str,
        limit: int,
        state: str = "",
        from_ts: str = "",
        to_ts: str = "",
        owner: str = "",
        tags: Optional[List[str]] = None,
        revision: str = "",
        event: str = "",
    ) -> List[dict]:
        with self._lock:
            entries = list(self._history)

        tag_filter = tags or []
        event_filter = event.strip().lower()
        payload = []
        for entry in entries:
            normalize_history_entry(entry)
            if not matches_metadata(entry, owner, tag_filter, revision):
                continue
            if normalize_project_id(entry.get("project_id")) != project_id:
                continue
            label = normalize_document_label(entry.get("document_label"))
            if label != document_label:
                continue
            if state and entry.get("state") != state:
                continue
            if event_filter:
                entry_event = str(entry.get("event") or "").lower()
                if entry_event != event_filter:
                    continue
            created = entry.get("created_at") or ""
            if from_ts and created and created < from_ts:
                continue
            if to_ts and created and created > to_ts:
                continue
            payload.append(entry)
            if limit > 0 and len(payload) >= limit:
                break
        return payload

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
                        normalize_history_entry(entry)
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

    def add_annotation(
        self,
        project_id: str,
        document_label: str,
        annotations: List[dict],
        owner: Optional[str] = None,
        tags: Optional[List[str]] = None,
        revision_note: Optional[str] = None,
    ) -> Optional[dict]:
        if not annotations:
            return None
        project_id = normalize_project_id(project_id)
        document_label = normalize_document_label(document_label)

        with self._lock:
            base = None
            for entry in self._history:
                normalize_history_entry(entry)
                if (
                    normalize_project_id(entry.get("project_id")) == project_id
                    and normalize_document_label(entry.get("document_label")) == document_label
                ):
                    base = entry
                    break
            if not base:
                return None

            now = now_iso()
            merged = list(base.get("annotations") or []) + annotations
            entry_owner = owner if owner else base.get("owner", "")
            entry_tags = tags if tags else base.get("tags", [])
            entry_revision = revision_note if revision_note else base.get("revision_note", "")

            new_entry = {
                "task_id": uuid.uuid4().hex,
                "state": base.get("state", "done"),
                "created_at": now,
                "started_at": now,
                "finished_at": now,
                "viewer_url": base.get("viewer_url"),
                "error": base.get("error"),
                "error_code": base.get("error_code"),
                "project_id": project_id,
                "document_label": document_label,
                "owner": entry_owner,
                "tags": entry_tags,
                "revision_note": entry_revision,
                "annotations": merged,
                "event": "annotation",
            }
            normalize_history_entry(new_entry)
            self._history.insert(0, new_entry)
            if self._history_limit and len(self._history) > self._history_limit:
                self._history = self._history[: self._history_limit]
            self._append_history(new_entry)
            return new_entry

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
            result = {"ok": False, "error": str(exc), "error_code": "CONVERT_EXCEPTION"}

        with self._lock:
            if result.get("ok"):
                task.status = "done"
                task.result = result.get("payload", {})
            else:
                task.status = "error"
                task.error = result.get("error", "conversion failed")
                task.error_code = result.get("error_code") or "CONVERT_FAILED"
            task.finished_at = now_iso()
        try:
            self.record_history(task)
        finally:
            task.event.set()

    def _convert(self, config: TaskConfig) -> dict:
        plm_convert = self._config.repo_root / "tools" / "plm_convert.py"
        project_id = normalize_project_id(config.project_id)
        document_label = normalize_document_label(config.document_label)
        document_id = encode_document_id(project_id, document_label)
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
        if project_id:
            cmd.extend(["--project-id", project_id])
        if document_label:
            cmd.extend(["--document-label", document_label])
        if document_id:
            cmd.extend(["--document-id", document_id])
        if config.emit:
            cmd.extend(["--emit", config.emit])
        if config.hash_names:
            cmd.append("--hash-names")
        if config.keep_legacy_names:
            cmd.append("--keep-legacy-names")
        if config.convert_cli:
            cmd.extend(["--convert-cli", config.convert_cli])
        if config.migrate_document:
            cmd.append("--migrate-document")
            if config.document_target > 0:
                cmd.extend(["--document-target", str(config.document_target)])
            if config.document_backup:
                cmd.append("--document-backup")
        if config.validate_document:
            cmd.append("--validate-document")
            if config.document_schema:
                cmd.extend(["--document-schema", config.document_schema])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return {
                "ok": False,
                "error": result.stderr.strip() or "conversion failed",
                "error_code": "CONVERT_FAILED",
            }

        manifest_path = config.output_dir / "manifest.json"
        manifest = load_manifest(manifest_path)
        if not manifest:
            return {
                "ok": False,
                "error": "manifest.json missing or invalid",
                "error_code": "MANIFEST_MISSING",
            }

        manifest_rel = os.path.relpath(manifest_path, self._config.repo_root)
        manifest_url = quote(Path(manifest_rel).as_posix())
        viewer_query = "&".join(
            [
                f"manifest={manifest_url}",
                f"project_id={quote(project_id)}",
                f"document_label={quote(document_label)}",
                f"document_id={quote(document_id)}",
            ]
        )
        viewer_url = f"{self._config.base_url}/tools/web_viewer/index.html?{viewer_query}"
        artifact_urls = {}
        for key, name in manifest.get("artifacts", {}).items():
            artifact_path = config.output_dir / name
            rel = os.path.relpath(artifact_path, self._config.repo_root)
            artifact_urls[key] = f"{self._config.base_url}/{quote(Path(rel).as_posix())}"

        payload = {
            "document_id": document_id,
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
        "--plugin-map",
        default="",
        help="Extension-to-plugin map (e.g. .dxf=path,.json=path)",
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


def parse_tags(value: str) -> List[str]:
    if not value:
        return []
    return parse_csv(value.replace(";", ","))


def decode_query_value(raw: str) -> str:
    try:
        return unquote(raw)
    except Exception:
        return raw


def query_value(query: str, key: str) -> str:
    token = f"{key}="
    if token not in query:
        return ""
    return decode_query_value(query.split(token, 1)[1].split("&", 1)[0])


def query_int(query: str, key: str, default: int) -> int:
    raw = query_value(query, key)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def normalize_project_id(value: Optional[str]) -> str:
    return value if value else "unassigned"


def normalize_document_label(value: Optional[str]) -> str:
    return value if value else "untitled"


def normalize_tags(value) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return parse_tags(value)
    return []


def normalize_annotations(value, fallback_time: str) -> List[dict]:
    if not value:
        return []
    items = value if isinstance(value, list) else [value]
    normalized = []
    for item in items:
        if isinstance(item, dict):
            message = (
                str(item.get("message") or item.get("text") or item.get("note") or "").strip()
            )
            author = str(item.get("author") or "").strip()
            created_at = str(item.get("created_at") or item.get("created") or fallback_time or "").strip()
            kind = str(item.get("kind") or "").strip()
        else:
            message = str(item).strip()
            author = ""
            created_at = fallback_time or ""
            kind = ""
        if not message:
            continue
        entry = {"message": message, "author": author, "created_at": created_at}
        if kind:
            entry["kind"] = kind
        normalized.append(entry)
    return normalized


def build_annotation(message: str, author: str, created_at: str, kind: str = "") -> dict:
    entry = {"message": message, "author": author, "created_at": created_at}
    if kind:
        entry["kind"] = kind
    return entry


def normalize_history_entry(entry: dict) -> None:
    if "owner" not in entry or not isinstance(entry.get("owner"), str):
        entry["owner"] = ""
    if "revision_note" not in entry or not isinstance(entry.get("revision_note"), str):
        entry["revision_note"] = ""
    entry["tags"] = normalize_tags(entry.get("tags"))
    entry["annotations"] = normalize_annotations(entry.get("annotations"), entry.get("created_at", ""))
    event = entry.get("event")
    if not isinstance(event, str) or not event:
        entry["event"] = "convert"


def matches_metadata(entry: dict, owner: str, tags: List[str], revision: str) -> bool:
    if owner:
        entry_owner = entry.get("owner", "")
        if entry_owner.lower() != owner.lower():
            return False
    if tags:
        entry_tags = {tag.lower() for tag in normalize_tags(entry.get("tags"))}
        required = {tag.lower() for tag in tags}
        if not entry_tags.issuperset(required):
            return False
    if revision:
        note = entry.get("revision_note", "")
        if revision.lower() not in note.lower():
            return False
    return True


def encode_document_id(project_id: str, document_label: str) -> str:
    raw = f"{project_id}\n{document_label}".encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii")
    return token.rstrip("=")


def decode_document_id(token: str) -> Optional[tuple]:
    if not token:
        return None
    padding = "=" * (-len(token) % 4)
    try:
        raw = base64.urlsafe_b64decode((token + padding).encode("ascii")).decode("utf-8")
    except Exception:
        return None
    if "\n" not in raw:
        return None
    project_id, document_label = raw.split("\n", 1)
    return project_id, document_label


def parse_allowlist(value: str, repo_root: Path) -> List[Path]:
    entries = []
    for token in parse_csv(value):
        path = Path(token)
        if not path.is_absolute():
            path = repo_root / path
        entries.append(path.resolve())
    return entries


def normalize_extension(value: str) -> str:
    ext = value.strip().lower()
    if ext and not ext.startswith("."):
        ext = f".{ext}"
    return ext


def parse_plugin_map(value: str, repo_root: Path) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for token in parse_csv(value.replace(";", ",")):
        if "=" in token:
            ext_raw, path_raw = token.split("=", 1)
        elif ":" in token:
            ext_raw, path_raw = token.split(":", 1)
        else:
            continue
        ext = normalize_extension(ext_raw)
        if not ext:
            continue
        path = Path(path_raw.strip())
        if not path_raw.strip():
            continue
        if not path.is_absolute():
            path = repo_root / path
        mapping[ext] = str(path.resolve())
    return mapping


def select_plugin_for_filename(filename: str, config: ServerConfig) -> str:
    if filename:
        ext = normalize_extension(Path(filename).suffix)
        if ext and ext in config.plugin_map:
            return config.plugin_map[ext]
    return config.default_plugin


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


def parse_simple_body(body: bytes, content_type: str) -> dict:
    if not content_type:
        return {}
    if "application/json" in content_type:
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
    if "application/x-www-form-urlencoded" in content_type:
        try:
            parsed = parse_qs(body.decode("utf-8"), keep_blank_values=True)
        except Exception:
            return {}
        return {key: values[0] if values else "" for key, values in parsed.items()}
    if "multipart/form-data" in content_type:
        fields, _ = parse_multipart(body, content_type)
        return fields
    return {}


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


def get_git_commit(repo_root: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        return ""
    return ""


def get_core_version(repo_root: Path) -> str:
    version_path = repo_root / "core" / "include" / "core" / "version.hpp"
    if not version_path.exists():
        return ""
    try:
        content = version_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("return") and "\"" in line:
            parts = line.split("\"")
            if len(parts) >= 2:
                return parts[1]
    return ""


def get_build_time() -> str:
    env_value = os.getenv("CADGF_BUILD_TIME", "").strip()
    if not env_value:
        env_value = os.getenv("SOURCE_DATE_EPOCH", "").strip()
    if not env_value:
        return ""
    if env_value.isdigit():
        try:
            return dt.datetime.utcfromtimestamp(int(env_value)).isoformat(timespec="seconds") + "Z"
        except ValueError:
            return ""
    return env_value


def get_hostname() -> str:
    try:
        return socket.gethostname()
    except Exception:
        return ""


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


def respond_error(
    handler,
    status: int,
    message: str,
    code: str,
    extra_headers: Optional[Dict[str, str]] = None,
    error_key: str = "message",
) -> None:
    payload = {"status": "error", error_key: message, "error_code": code}
    respond_json(handler, status, payload, extra_headers)


def make_handler(
    config: ServerConfig,
    manager: TaskManager,
    started_at_monotonic: float,
    started_at_iso: str,
    commit_id: str,
    core_version: str,
    build_time: str,
    hostname: str,
    pid: int,
):
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
                uptime_seconds = max(0, int(time.monotonic() - started_at_monotonic))
                payload = {
                    "status": "ok",
                    "started_at": started_at_iso,
                    "uptime_seconds": uptime_seconds,
                    "commit": commit_id or "",
                    "version": core_version or "",
                    "build_time": build_time or "",
                    "hostname": hostname or "",
                    "pid": pid,
                }
                payload["error_codes"] = list(ERROR_CODES)
                if config.plugin_map:
                    payload["plugin_map"] = sorted(config.plugin_map.keys())
                if config.default_plugin:
                    payload["default_plugin"] = Path(config.default_plugin).name
                if config.default_convert_cli:
                    payload["default_convert_cli"] = Path(config.default_convert_cli).name
                respond_json(self, 200, payload)
                return
            if parsed.path == "/projects":
                if not self._authorized():
                    respond_error(
                        self,
                        401,
                        "unauthorized",
                        "AUTH_REQUIRED",
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                query = parsed.query or ""
                limit = query_int(query, "limit", 50)
                if limit < 0:
                    limit = 0
                owner = query_value(query, "owner")
                tags_value = query_value(query, "tags") or query_value(query, "tag")
                tags = parse_tags(tags_value)
                revision = query_value(query, "revision") or query_value(query, "revision_note")
                event = query_value(query, "event")
                entries = manager.list_projects(limit, owner=owner, tags=tags, revision=revision, event=event)
                respond_json(self, 200, {"status": "ok", "count": len(entries), "items": entries})
                return
            if parsed.path.startswith("/projects/") and parsed.path.endswith("/documents"):
                if not self._authorized():
                    respond_error(
                        self,
                        401,
                        "unauthorized",
                        "AUTH_REQUIRED",
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                project_token = parsed.path[len("/projects/") : -len("/documents")].strip("/")
                if not project_token:
                    respond_error(self, 400, "missing project id", "MISSING_PROJECT_ID")
                    return
                project_id = normalize_project_id(decode_query_value(project_token))
                query = parsed.query or ""
                limit = query_int(query, "limit", 50)
                if limit < 0:
                    limit = 0
                owner = query_value(query, "owner")
                tags_value = query_value(query, "tags") or query_value(query, "tag")
                tags = parse_tags(tags_value)
                revision = query_value(query, "revision") or query_value(query, "revision_note")
                event = query_value(query, "event")
                entries = manager.list_documents(
                    project_id,
                    limit,
                    owner=owner,
                    tags=tags,
                    revision=revision,
                    event=event,
                )
                respond_json(self, 200, {"status": "ok", "count": len(entries), "items": entries})
                return
            if parsed.path.startswith("/documents/") and parsed.path.endswith("/versions"):
                if not self._authorized():
                    respond_error(
                        self,
                        401,
                        "unauthorized",
                        "AUTH_REQUIRED",
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                doc_token = parsed.path[len("/documents/") : -len("/versions")].strip("/")
                document_id = decode_query_value(doc_token)
                decoded = decode_document_id(document_id)
                if not decoded:
                    respond_error(self, 400, "invalid document id", "INVALID_DOCUMENT_ID")
                    return
                project_id, document_label = decoded
                project_id = normalize_project_id(project_id)
                document_label = normalize_document_label(document_label)
                query = parsed.query or ""
                limit = query_int(query, "limit", 50)
                if limit < 0:
                    limit = 0
                state = query_value(query, "state")
                event = query_value(query, "event")
                from_ts = query_value(query, "from")
                to_ts = query_value(query, "to")
                owner = query_value(query, "owner")
                tags_value = query_value(query, "tags") or query_value(query, "tag")
                tags = parse_tags(tags_value)
                revision = query_value(query, "revision") or query_value(query, "revision_note")
                entries = manager.list_document_versions(
                    project_id,
                    document_label,
                    limit,
                    state=state,
                    from_ts=from_ts,
                    to_ts=to_ts,
                    owner=owner,
                    tags=tags,
                    revision=revision,
                    event=event,
                )
                respond_json(self, 200, {"status": "ok", "count": len(entries), "items": entries})
                return
            if parsed.path == "/history":
                if not self._authorized():
                    respond_error(
                        self,
                        401,
                        "unauthorized",
                        "AUTH_REQUIRED",
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
                event = ""
                from_ts = ""
                to_ts = ""
                if "project_id=" in query:
                    project_id = decode_query_value(query.split("project_id=", 1)[1].split("&", 1)[0])
                if "state=" in query:
                    state = decode_query_value(query.split("state=", 1)[1].split("&", 1)[0])
                if "event=" in query:
                    event = decode_query_value(query.split("event=", 1)[1].split("&", 1)[0])
                if "from=" in query:
                    from_ts = decode_query_value(query.split("from=", 1)[1].split("&", 1)[0])
                if "to=" in query:
                    to_ts = decode_query_value(query.split("to=", 1)[1].split("&", 1)[0])
                owner = query_value(query, "owner")
                tags_value = query_value(query, "tags") or query_value(query, "tag")
                tags = parse_tags(tags_value)
                revision = query_value(query, "revision") or query_value(query, "revision_note")
                entries = manager.list_history(
                    limit,
                    project_id=project_id,
                    state=state,
                    from_ts=from_ts,
                    to_ts=to_ts,
                    owner=owner,
                    tags=tags,
                    revision=revision,
                    event=event,
                )
                respond_json(self, 200, {"status": "ok", "count": len(entries), "items": entries})
                return
            if parsed.path.startswith("/status/"):
                if not self._authorized():
                    respond_error(
                        self,
                        401,
                        "unauthorized",
                        "AUTH_REQUIRED",
                        {"WWW-Authenticate": "Bearer"},
                    )
                    return
                task_id = parsed.path.split("/status/", 1)[1]
                task = manager.get(task_id)
                if not task:
                    respond_error(self, 404, "task not found", "TASK_NOT_FOUND")
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
                    payload["error_code"] = task.error_code
                respond_json(self, 200, payload)
                self.log_message("GET /status/%s -> %s", task_id, task.status)
                return
            super().do_GET()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path not in {"/convert", "/annotate"}:
                respond_error(self, 404, "unknown endpoint", "UNKNOWN_ENDPOINT")
                return

            if not self._authorized():
                respond_error(
                    self,
                    401,
                    "unauthorized",
                    "AUTH_REQUIRED",
                    {"WWW-Authenticate": "Bearer"},
                )
                return

            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                respond_error(self, 400, "invalid content length", "BAD_CONTENT_LENGTH")
                return
            if length <= 0:
                respond_error(self, 400, "empty request", "EMPTY_REQUEST")
                return
            if config.max_bytes > 0 and length > config.max_bytes:
                respond_error(self, 413, "payload too large", "PAYLOAD_TOO_LARGE")
                return

            content_type = self.headers.get("Content-Type", "")
            body = self.rfile.read(length)
            if parsed.path == "/annotate":
                fields = parse_simple_body(body, content_type)
                if not isinstance(fields, dict) or not fields:
                    respond_error(self, 400, "invalid request body", "INVALID_BODY")
                    return
                document_id = str(fields.get("document_id", "")).strip()
                if document_id:
                    decoded = decode_document_id(document_id)
                    if not decoded:
                        respond_error(self, 400, "invalid document id", "INVALID_DOCUMENT_ID")
                        return
                    project_id, document_label = decoded
                else:
                    project_id = str(fields.get("project_id", "")).strip()
                    document_label = str(fields.get("document_label", "")).strip()
                if not project_id or not document_label:
                    respond_error(self, 400, "missing document identity", "MISSING_DOCUMENT_IDENTITY")
                    return
                project_id = normalize_project_id(project_id)
                document_label = normalize_document_label(document_label)

                owner = str(fields.get("owner", "")).strip()
                tags = normalize_tags(fields.get("tags"))
                revision_note = str(fields.get("revision_note", "")).strip()

                annotations = []
                annotation_now = now_iso()
                annotations_raw = fields.get("annotations")
                if annotations_raw:
                    if isinstance(annotations_raw, str):
                        try:
                            parsed_annotations = json.loads(annotations_raw)
                        except json.JSONDecodeError:
                            respond_error(self, 400, "invalid annotations json", "INVALID_ANNOTATIONS_JSON")
                            return
                    else:
                        parsed_annotations = annotations_raw
                    annotations = normalize_annotations(parsed_annotations, annotation_now)
                annotation_text = str(fields.get("annotation_text", "")).strip()
                if annotation_text:
                    annotation_author = str(fields.get("annotation_author", "")).strip()
                    annotation_kind = str(fields.get("annotation_kind", "")).strip()
                    annotations.append(
                        build_annotation(annotation_text, annotation_author, annotation_now, annotation_kind)
                    )
                if not annotations:
                    respond_error(self, 400, "missing annotations", "MISSING_ANNOTATIONS")
                    return

                entry = manager.add_annotation(
                    project_id,
                    document_label,
                    annotations,
                    owner=owner or None,
                    tags=tags or None,
                    revision_note=revision_note or None,
                )
                if not entry:
                    respond_error(self, 404, "document not found", "DOCUMENT_NOT_FOUND")
                    return

                respond_json(
                    self,
                    200,
                    {
                        "status": "ok",
                        "document_id": encode_document_id(project_id, document_label),
                        "entry": entry,
                    },
                )
                self.log_message("POST /annotate %s/%s -> ok", project_id, document_label)
                return
            fields, files = parse_multipart(body, content_type)
            if not files:
                respond_error(self, 400, "missing file", "MISSING_FILE")
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

            plugin = fields.get("plugin")
            if not plugin:
                plugin = select_plugin_for_filename(filename, config)
                if plugin:
                    self.log_message("Auto plugin %s for %s", plugin, filename)
            if not plugin:
                respond_error(self, 400, "missing plugin", "MISSING_PLUGIN")
                return
            if not Path(plugin).exists():
                respond_error(self, 400, "plugin not found", "PLUGIN_NOT_FOUND")
                return
            if not is_path_allowed(plugin, config.plugin_allowlist):
                respond_error(self, 403, "plugin not allowed", "PLUGIN_NOT_ALLOWED")
                return

            emit = fields.get("emit", "")
            hash_names = parse_bool(fields.get("hash_names"))
            keep_legacy = parse_bool(fields.get("keep_legacy_names"))
            project_id = fields.get("project_id", "").strip()
            document_label = fields.get("document_label", "").strip()
            owner = fields.get("owner", "").strip()
            tags = parse_tags(fields.get("tags", ""))
            revision_note = fields.get("revision_note", "").strip()
            annotations = []
            annotation_now = now_iso()
            annotations_raw = fields.get("annotations", "").strip()
            if annotations_raw:
                try:
                    parsed = json.loads(annotations_raw)
                except json.JSONDecodeError:
                    respond_error(self, 400, "invalid annotations json", "INVALID_ANNOTATIONS_JSON")
                    return
                annotations = normalize_annotations(parsed, annotation_now)
            annotation_text = fields.get("annotation_text", "").strip()
            if annotation_text:
                annotation_author = fields.get("annotation_author", "").strip()
                annotation_kind = fields.get("annotation_kind", "").strip()
                annotations.append(build_annotation(annotation_text, annotation_author, annotation_now, annotation_kind))
            migrate_document = parse_bool(fields.get("migrate_document"))
            document_backup = parse_bool(fields.get("document_backup"))
            document_target = 0
            if "document_target" in fields:
                try:
                    document_target = int(fields.get("document_target", "0") or 0)
                except ValueError:
                    respond_error(self, 400, "invalid document_target", "INVALID_DOCUMENT_TARGET")
                    return
                if document_target < 0:
                    respond_error(self, 400, "invalid document_target", "INVALID_DOCUMENT_TARGET")
                    return
            validate_document = parse_bool(fields.get("validate_document"))
            document_schema = fields.get("document_schema", "").strip()
            if document_schema:
                schema_path = Path(document_schema)
                if not schema_path.is_absolute():
                    schema_path = config.repo_root / schema_path
                schema_path = schema_path.resolve()
                try:
                    schema_path.relative_to(config.repo_root)
                except ValueError:
                    respond_error(self, 403, "document_schema not allowed", "DOCUMENT_SCHEMA_NOT_ALLOWED")
                    return
                if not schema_path.exists():
                    respond_error(self, 400, "document_schema not found", "DOCUMENT_SCHEMA_NOT_FOUND")
                    return
                document_schema = str(schema_path)
            convert_cli = fields.get("convert_cli") or config.default_convert_cli
            if convert_cli and not Path(convert_cli).exists():
                respond_error(self, 400, "convert_cli not found", "CONVERT_CLI_NOT_FOUND")
                return
            if convert_cli and not is_path_allowed(convert_cli, config.cli_allowlist):
                respond_error(self, 403, "convert_cli not allowed", "CONVERT_CLI_NOT_ALLOWED")
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
                migrate_document=migrate_document,
                document_target=document_target,
                document_backup=document_backup,
                validate_document=validate_document,
                document_schema=document_schema,
                owner=owner,
                tags=tags,
                revision_note=revision_note,
                annotations=annotations,
            )
            task = TaskRecord(task_id=task_id, config=task_config, created_at=now_iso())
            if not manager.submit(task):
                respond_error(self, 429, "queue full", "QUEUE_FULL")
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
                respond_error(self, 404, "task not found", "TASK_NOT_FOUND")
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
                payload = {
                    "task_id": task_id,
                    "state": task.status,
                    "status_url": status_url,
                }
                respond_json(
                    self,
                    500,
                    {
                        **payload,
                        "status": "error",
                        "error": task.error,
                        "error_code": task.error_code or "CONVERT_FAILED",
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
    started_at_monotonic = time.monotonic()
    started_at_iso = now_iso()

    auth_token = env_or_arg(args.auth_token, "CADGF_ROUTER_AUTH_TOKEN")
    cors_raw = env_or_arg(args.cors_origins, "CADGF_ROUTER_CORS_ORIGINS")
    plugin_map_raw = env_or_arg(args.plugin_map, "CADGF_ROUTER_PLUGIN_MAP")
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
    plugin_map = parse_plugin_map(plugin_map_raw, repo_root)
    plugin_allowlist = parse_allowlist(plugin_allowlist_raw, repo_root)
    cli_allowlist = parse_allowlist(cli_allowlist_raw, repo_root)
    commit_id = get_git_commit(repo_root)
    core_version = get_core_version(repo_root)
    build_time = get_build_time()
    hostname = get_hostname()
    pid = os.getpid()
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
        plugin_map=plugin_map,
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
    handler = make_handler(
        config,
        manager,
        started_at_monotonic,
        started_at_iso,
        commit_id,
        core_version,
        build_time,
        hostname,
        pid,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving CADGameFusion at {base_url}")
    print(
        "Router metadata: version=%s commit=%s build_time=%s host=%s pid=%s"
        % (
            core_version or "unknown",
            commit_id or "unknown",
            build_time or "unknown",
            hostname or "unknown",
            pid,
        )
    )
    print("POST /convert (multipart form-data) with fields: file, plugin?, emit, hash_names")
    print("POST /annotate (json/form) with fields: document_id or project_id+document_label, annotation_text")
    print(f"Output root: {out_root}")
    if auth_token:
        print("Auth: enabled (Bearer token)")
    if cors_origins:
        print(f"CORS allowlist: {', '.join(cors_origins)}")
    if plugin_map:
        summary = ", ".join(f"{ext}={Path(path).name}" for ext, path in plugin_map.items())
        print(f"Plugin map: {summary}")
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
