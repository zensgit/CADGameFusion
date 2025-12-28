#!/usr/bin/env python3
import argparse
import base64
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PLM preview helper (convert + web viewer URL)."
    )
    parser.add_argument("--plugin", required=True, help="Importer plugin shared library path")
    parser.add_argument("--input", required=True, help="Input CAD/JSON file")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--emit", help="Comma-separated outputs: json,gltf,meta")
    parser.add_argument("--hash-names", action="store_true", help="Rename artifacts with content hashes")
    parser.add_argument(
        "--keep-legacy-names",
        action="store_true",
        help="Keep legacy artifact names alongside hashed ones",
    )
    parser.add_argument("--convert-cli", help="Override convert_cli path")
    parser.add_argument("--skip-convert", action="store_true", help="Skip conversion if manifest exists")
    parser.add_argument("--port", type=int, default=8080, help="HTTP server port")
    parser.add_argument("--project-id", default="", help="Project identifier for viewer metadata")
    parser.add_argument("--document-label", default="", help="Document label for viewer metadata")
    parser.add_argument("--document-id", default="", help="Document id for viewer metadata")
    return parser.parse_args()


def run_convert(args: argparse.Namespace, repo_root: Path) -> int:
    plm_convert = repo_root / "tools" / "plm_convert.py"
    if not plm_convert.exists():
        print("tools/plm_convert.py not found.", file=sys.stderr)
        return 2
    cmd = [
        sys.executable,
        str(plm_convert),
        "--plugin",
        args.plugin,
        "--input",
        args.input,
        "--out",
        args.out,
    ]
    if args.emit:
        cmd.extend(["--emit", args.emit])
    if args.hash_names:
        cmd.append("--hash-names")
    if args.keep_legacy_names:
        cmd.append("--keep-legacy-names")
    if args.convert_cli:
        cmd.extend(["--convert-cli", args.convert_cli])
    result = subprocess.run(cmd)
    return result.returncode


def load_manifest(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def encode_document_id(project_id: str, document_label: str) -> str:
    raw = f"{project_id}\n{document_label}".encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii")
    return token.rstrip("=")


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = Path(args.out)

    if not args.skip_convert:
        result = run_convert(args, repo_root)
        if result != 0:
            return result

    manifest_path = out_dir / "manifest.json"
    if not manifest_path.exists():
        print(f"manifest.json not found at {manifest_path}", file=sys.stderr)
        return 2

    manifest = load_manifest(manifest_path)
    gltf_name = manifest.get("artifacts", {}).get("mesh_gltf", "mesh.gltf")
    gltf_path = manifest_path.parent / gltf_name

    rel_manifest = os.path.relpath(manifest_path, repo_root)
    rel_gltf = os.path.relpath(gltf_path, repo_root)
    manifest_url = quote(Path(rel_manifest).as_posix())
    gltf_url = quote(Path(rel_gltf).as_posix())
    project_id = args.project_id.strip()
    document_label = args.document_label.strip()
    document_id = args.document_id.strip()
    if not document_id and project_id and document_label:
        document_id = encode_document_id(project_id, document_label)
    viewer_params = [f"manifest={manifest_url}"]
    if project_id:
        viewer_params.append(f"project_id={quote(project_id)}")
    if document_label:
        viewer_params.append(f"document_label={quote(document_label)}")
    if document_id:
        viewer_params.append(f"document_id={quote(document_id)}")
    viewer_url = (
        f"http://localhost:{args.port}/tools/web_viewer/index.html?"
        f"{'&'.join(viewer_params)}"
    )

    print("Preview artifacts ready.")
    print("Serve from repo root:")
    print(f"  cd {repo_root} && python3 -m http.server {args.port}")
    print("Open in browser:")
    print(f"  {viewer_url}")
    print("Fallback glTF URL:")
    print(f"  http://localhost:{args.port}/tools/web_viewer/index.html?gltf={gltf_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
