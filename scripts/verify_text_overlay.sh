#!/usr/bin/env bash
set -euo pipefail

PORT=8080
MANIFEST=""
OUTDIR="docs/assets"
PROJECT_ID="demo"
DOCUMENT_LABEL="dim_text"
DOCUMENT_ID="ZGVtbwpkaW1fdGV4dA"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"; shift 2;;
    --outdir)
      OUTDIR="$2"; shift 2;;
    --project-id)
      PROJECT_ID="$2"; shift 2;;
    --document-label)
      DOCUMENT_LABEL="$2"; shift 2;;
    --document-id)
      DOCUMENT_ID="$2"; shift 2;;
    --port)
      PORT="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--manifest path] [--outdir dir] [--project-id id] [--document-label label] [--document-id id] [--port N]"
      exit 0;;
    *)
      echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_MANIFEST="$REPO_ROOT/build/plm_preview_dim/manifest.json"

if [[ -z "$MANIFEST" ]]; then
  MANIFEST="$DEFAULT_MANIFEST"
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

mkdir -p "$REPO_ROOT/$OUTDIR"

PYTHON_BIN="/usr/bin/python3"
PLAYWRIGHT_BIN="npx"

export MANIFEST
export REPO_ROOT

command -v "$PLAYWRIGHT_BIN" >/dev/null 2>&1 || { echo "npx not found" >&2; exit 1; }

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

$PYTHON_BIN -m http.server "$PORT" --directory "$REPO_ROOT" >/tmp/vemcad_text_overlay_http.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

BASE_URL="http://127.0.0.1:$PORT/tools/web_viewer/index.html"
ENCODED_MANIFEST="$($PYTHON_BIN - <<'PY'
import os
import pathlib
import urllib.parse
root = pathlib.Path(os.environ["REPO_ROOT"]).resolve()
manifest = pathlib.Path(os.environ["MANIFEST"]).resolve()
try:
    rel = manifest.relative_to(root).as_posix()
except Exception:
    rel = os.path.relpath(manifest, root).replace(os.sep, "/")
print(urllib.parse.quote(rel))
PY
)"
QUERY="manifest=${ENCODED_MANIFEST}&project_id=$PROJECT_ID&document_label=$DOCUMENT_LABEL&document_id=$DOCUMENT_ID&text_overlay=1"

for filter in dimension text all; do
  OUT_FILE="$REPO_ROOT/$OUTDIR/step160_text_overlay_${filter}.png"
  "$PLAYWRIGHT_BIN" playwright screenshot \
    --viewport-size 1400,900 \
    --wait-for-timeout 15000 \
    "${BASE_URL}?${QUERY}&text_filter=${filter}" \
    "$OUT_FILE" >/dev/null 2>&1 || true
  echo "Wrote $OUT_FILE"
done

$PYTHON_BIN - <<'PY'
import json
path='build/plm_preview_dim/document.json'
with open(path,'r',encoding='utf-8') as f:
    doc=json.load(f)
ents=doc.get('entities',[])
text=[e for e in ents if e.get('type')==7 and 'text' in e]
with_dim=[e for e in text if e.get('text_kind')=='dimension' or e.get('dim_type') is not None]
missing=[e for e in with_dim if e.get('dim_text_rotation') is None or e.get('dim_text_pos') is None]
print('entities',len(ents))
print('text',len(text))
print('dimension_text',len(with_dim))
print('dimension_missing_meta',len(missing))
PY
