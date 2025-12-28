#!/usr/bin/env python3
import argparse
import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Post an annotation to the PLM router service.")
    parser.add_argument("--router", default="http://localhost:9000", help="Router base URL")
    parser.add_argument("--token", default="", help="Bearer token (optional)")
    parser.add_argument("--document-id", default="", help="Document id (base64 token)")
    parser.add_argument("--project-id", default="", help="Project id")
    parser.add_argument("--document-label", default="", help="Document label")
    parser.add_argument("--text", default="", help="Annotation text")
    parser.add_argument("--author", default="", help="Annotation author")
    parser.add_argument("--kind", default="", help="Annotation kind (optional)")
    parser.add_argument("--annotations", default="", help="JSON string for annotations list")
    parser.add_argument("--annotations-file", default="", help="JSON file path for annotations list")
    parser.add_argument("--owner", default="", help="Owner metadata")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--revision-note", default="", help="Revision note metadata")
    parser.add_argument(
        "--print-document-id",
        action="store_true",
        help="Print document_id for project/document and exit",
    )
    parser.add_argument("--timeout", type=float, default=15.0, help="Request timeout seconds")
    return parser.parse_args()


def load_json(value: str, label: str):
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {exc}") from exc


def load_annotations(args: argparse.Namespace):
    items = []
    if args.annotations:
        parsed = load_json(args.annotations, "--annotations")
        if parsed is not None:
            items.append(parsed)
    if args.annotations_file:
        path = Path(args.annotations_file)
        if not path.exists():
            raise ValueError(f"--annotations-file not found: {path}")
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"--annotations-file is not valid JSON: {exc}") from exc
        items.append(parsed)

    if not items:
        return []
    normalized = []
    for item in items:
        if isinstance(item, list):
            normalized.extend(item)
        else:
            normalized.append(item)
    return normalized


def encode_document_id(project_id: str, document_label: str) -> str:
    raw = f"{project_id}\n{document_label}".encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii")
    return token.rstrip("=")


def print_document_id(args: argparse.Namespace) -> int:
    if args.document_id.strip():
        print(args.document_id.strip())
        return 0
    project_id = args.project_id.strip()
    document_label = args.document_label.strip()
    if not project_id or not document_label:
        raise ValueError("Provide --document-id or both --project-id and --document-label to print.")
    print(encode_document_id(project_id, document_label))
    return 0


def build_payload(args: argparse.Namespace) -> dict:
    payload = {}
    if args.document_id:
        payload["document_id"] = args.document_id.strip()
    else:
        project_id = args.project_id.strip()
        document_label = args.document_label.strip()
        if project_id:
            payload["project_id"] = project_id
        if document_label:
            payload["document_label"] = document_label

    if "document_id" not in payload and ("project_id" not in payload or "document_label" not in payload):
        raise ValueError("Provide --document-id or both --project-id and --document-label.")

    annotations = load_annotations(args)
    text = args.text.strip()
    if text:
        payload["annotation_text"] = text
        if args.author.strip():
            payload["annotation_author"] = args.author.strip()
        if args.kind.strip():
            payload["annotation_kind"] = args.kind.strip()

    if annotations:
        payload["annotations"] = annotations

    if "annotation_text" not in payload and "annotations" not in payload:
        raise ValueError("Provide --text and/or --annotations/--annotations-file.")

    if args.owner.strip():
        payload["owner"] = args.owner.strip()
    if args.tags.strip():
        payload["tags"] = args.tags.strip()
    if args.revision_note.strip():
        payload["revision_note"] = args.revision_note.strip()
    return payload


def post_annotation(base_url: str, token: str, payload: dict, timeout: float) -> int:
    url = base_url.rstrip("/") + "/annotate"
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            print(raw)
            return 0
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        if raw:
            print(raw, file=sys.stderr)
        else:
            print(f"HTTP {exc.code}: {exc.reason}", file=sys.stderr)
        return 2
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}", file=sys.stderr)
        return 2


def main() -> int:
    args = parse_args()
    if args.print_document_id:
        try:
            return print_document_id(args)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2
    try:
        payload = build_payload(args)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return post_annotation(args.router, args.token.strip(), payload, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())
