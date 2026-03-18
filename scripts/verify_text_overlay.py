#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path


def run(cmd, **kwargs):
    return subprocess.run(cmd, check=False, text=True, **kwargs)


def wait_http(port, retries=60, delay=0.2):
    for _ in range(retries):
        try:
            res = run(["curl", "-fsS", f"http://127.0.0.1:{port}/"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if res.returncode == 0:
                return True
        except Exception:
            pass
        time.sleep(delay)
    return False


def main():
    parser = argparse.ArgumentParser(description="Verify web viewer text overlay and generate report.")
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--outdir", default="docs/assets")
    parser.add_argument("--project-id", default="demo")
    parser.add_argument("--document-label", default="dim_text")
    parser.add_argument("--document-id", default="ZGVtbwpkaW1fdGV4dA")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--report", default="docs/STEP160_WEB_VIEWER_TEXT_OVERLAY_VERIFICATION.md")
    parser.add_argument("--doc-json", default="build/plm_preview_dim/document.json")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    manifest = Path(args.manifest) if args.manifest else repo_root / "build/plm_preview_dim/manifest.json"
    if not manifest.exists():
        print(f"Manifest not found: {manifest}", file=sys.stderr)
        return 1

    outdir = repo_root / args.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if not chrome.exists():
        print(f"Chrome not found at: {chrome}", file=sys.stderr)
        return 1

    server = subprocess.Popen([
        sys.executable,
        "-m",
        "http.server",
        str(args.port),
        "--directory",
        str(repo_root),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        if not wait_http(args.port):
            print("HTTP server failed to start", file=sys.stderr)
            return 1

        base_url = f"http://127.0.0.1:{args.port}/tools/web_viewer/index.html"
        try:
            rel_manifest = manifest.resolve().relative_to(repo_root.resolve())
            manifest_url = rel_manifest.as_posix()
        except Exception:
            manifest_url = os.path.relpath(manifest, repo_root).replace(os.sep, "/")
        encoded_manifest = urllib.parse.quote(manifest_url)
        query = (
            f"manifest={encoded_manifest}"
            f"&project_id={args.project_id}"
            f"&document_label={args.document_label}"
            f"&document_id={args.document_id}"
            f"&text_overlay=1"
        )

        screenshots = {}
        for filter_name in ["dimension", "text", "all"]:
            out_file = outdir / f"step160_text_overlay_{filter_name}.png"
            url = f"{base_url}?{query}&text_filter={filter_name}"
            run([
                str(chrome),
                "--headless=new",
                "--window-size=1400,900",
                "--virtual-time-budget=15000",
                f"--screenshot={out_file}",
                url,
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            screenshots[filter_name] = out_file

        doc_json = repo_root / args.doc_json
        if not doc_json.exists():
            print(f"document.json not found: {doc_json}", file=sys.stderr)
            return 1

        with doc_json.open("r", encoding="utf-8") as f:
            doc = json.load(f)

        entities = doc.get("entities", [])
        text = [e for e in entities if e.get("type") == 7 and "text" in e]
        with_dim = [e for e in text if e.get("text_kind") == "dimension" or e.get("dim_type") is not None]
        missing = [e for e in with_dim if e.get("dim_text_rotation") is None or e.get("dim_text_pos") is None]

        report_path = repo_root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("a", encoding="utf-8") as f:
            f.write("\n\n## Automated verification (scripted)\n")
            f.write(f"- Manifest: `{manifest}`\n")
            f.write(f"- document.json: `{doc_json}`\n")
            f.write("- Screenshots:\n")
            for key in ["dimension", "text", "all"]:
                f.write(f"  - `{screenshots[key]}`\n")
            f.write("- JSON stats:\n")
            f.write(f"  - entities: {len(entities)}\n")
            f.write(f"  - text: {len(text)}\n")
            f.write(f"  - dimension_text: {len(with_dim)}\n")
            f.write(f"  - dimension_missing_meta: {len(missing)}\n")

        print("Screenshots written:")
        for key in ["dimension", "text", "all"]:
            print(f"  {screenshots[key]}")
        print("JSON stats:")
        print("entities", len(entities))
        print("text", len(text))
        print("dimension_text", len(with_dim))
        print("dimension_missing_meta", len(missing))

    finally:
        server.terminate()
        try:
            server.wait(timeout=2)
        except subprocess.TimeoutExpired:
            server.kill()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
