#!/usr/bin/env python3
import argparse
import json
import mimetypes
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Dict, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PLM router smoke test (upload -> convert -> preview URL)."
    )
    parser.add_argument("--router-url", default="http://localhost:9000", help="Router base URL")
    parser.add_argument("--input", required=True, help="Input CAD/JSON file path")
    parser.add_argument("--plugin", default="", help="Importer plugin path (optional)")
    parser.add_argument("--emit", default="", help="Emit list (e.g. json,gltf,meta)")
    parser.add_argument("--project-id", default="", help="Project identifier")
    parser.add_argument("--document-label", default="", help="Document label")
    parser.add_argument("--token", default="", help="Bearer token for auth (optional)")
    parser.add_argument("--async", dest="async_mode", action="store_true", help="Queue async")
    parser.add_argument("--poll-interval", type=float, default=1.0, help="Poll interval (seconds)")
    parser.add_argument("--timeout", type=float, default=120.0, help="Timeout for async polling")
    return parser.parse_args()


def normalize_base_url(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return "http://localhost:9000"
    return trimmed[:-1] if trimmed.endswith("/") else trimmed


def build_multipart(fields: Dict[str, str], file_field: str, file_path: Path) -> Tuple[str, bytes]:
    boundary = uuid.uuid4().hex
    body = bytearray()

    def add_text(text: str) -> None:
        body.extend(text.encode("utf-8"))

    for key, value in fields.items():
        if value is None:
            continue
        add_text(f"--{boundary}\r\n")
        add_text(f"Content-Disposition: form-data; name=\"{key}\"\r\n\r\n")
        add_text(str(value))
        add_text("\r\n")

    filename = file_path.name
    mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    add_text(f"--{boundary}\r\n")
    add_text(
        f"Content-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
    )
    add_text(f"Content-Type: {mime_type}\r\n\r\n")
    body.extend(file_path.read_bytes())
    add_text("\r\n")
    add_text(f"--{boundary}--\r\n")

    return boundary, bytes(body)


def request_json(url: str, body: bytes, headers: Dict[str, str]) -> Tuple[int, dict]:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
            status = response.getcode()
    except urllib.error.HTTPError as err:
        raw = err.read()
        status = err.code
    payload = parse_json_payload(raw)
    return status, payload


def get_json(url: str, headers: Dict[str, str]) -> Tuple[int, dict]:
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
            status = response.getcode()
    except urllib.error.HTTPError as err:
        raw = err.read()
        status = err.code
    payload = parse_json_payload(raw)
    return status, payload


def parse_json_payload(raw: bytes) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {"raw": raw.decode("utf-8", errors="replace")}


def build_headers(boundary: str, body: bytes, token: str) -> Dict[str, str]:
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def poll_status(url: str, token: str, poll_interval: float, timeout: float) -> dict:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    deadline = time.monotonic() + max(timeout, 0.0)
    while True:
        _, payload = get_json(url, headers)
        state = payload.get("state", "")
        if state in {"done", "error"}:
            return payload
        if timeout > 0 and time.monotonic() > deadline:
            return {"status": "error", "error": "status poll timeout", "state": "timeout"}
        time.sleep(max(poll_interval, 0.1))


def main() -> int:
    args = parse_args()
    base_url = normalize_base_url(args.router_url)
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        return 2

    fields = {}
    if args.plugin:
        fields["plugin"] = args.plugin
    if args.emit:
        fields["emit"] = args.emit
    if args.project_id:
        fields["project_id"] = args.project_id
    if args.document_label:
        fields["document_label"] = args.document_label
    if args.async_mode:
        fields["async"] = "true"

    boundary, body = build_multipart(fields, "file", input_path)
    headers = build_headers(boundary, body, args.token)

    status, payload = request_json(f"{base_url}/convert", body, headers)
    print(json.dumps(payload, indent=2))

    viewer_url = payload.get("viewer_url")
    status_url = payload.get("status_url")
    state = payload.get("state")
    if viewer_url:
        print(f"viewer_url: {viewer_url}")
        return 0

    if args.async_mode and status_url:
        result = poll_status(status_url, args.token, args.poll_interval, args.timeout)
        print(json.dumps(result, indent=2))
        viewer_url = result.get("viewer_url")
        if viewer_url:
            print(f"viewer_url: {viewer_url}")
            return 0
        if result.get("state") == "error":
            return 1
        return 2

    if status >= 400 or state == "error":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
