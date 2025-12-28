#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"

ROUTER_HOST="${ROUTER_HOST:-127.0.0.1}"
ROUTER_PORT="${ROUTER_PORT:-9000}"
ROUTER_URL="${ROUTER_URL:-http://${ROUTER_HOST}:${ROUTER_PORT}}"
SKIP_ROUTER="${SKIP_ROUTER:-0}"

INPUT="${INPUT:-$ROOT/tests/plugin_data/importer_sample.json}"
PLUGIN="${PLUGIN:-$ROOT/build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib}"
EMIT="${EMIT:-json,gltf,meta}"
PROJECT_ID="${PROJECT_ID:-demo}"
DOCUMENT_LABEL="${DOCUMENT_LABEL:-sample}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-30}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "python executable not found: $PYTHON" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found in PATH" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "input not found: $INPUT" >&2
  exit 1
fi
if [[ ! -f "$PLUGIN" ]]; then
  echo "plugin not found: $PLUGIN" >&2
  exit 1
fi

ROUTER_PID=""
cleanup() {
  if [[ -n "$ROUTER_PID" ]]; then
    kill "$ROUTER_PID" >/dev/null 2>&1 || true
    wait "$ROUTER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$SKIP_ROUTER" != "1" ]]; then
  "$PYTHON" "$ROOT/tools/plm_router_service.py" --host "$ROUTER_HOST" --port "$ROUTER_PORT" >/dev/null 2>&1 &
  ROUTER_PID=$!
fi

ready=0
for _ in {1..30}; do
  if curl -s --max-time 2 "$ROUTER_URL/health" | grep -q '"ok"'; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "router not ready at $ROUTER_URL" >&2
  exit 1
fi

convert_response=$(curl -s --max-time 60 -X POST "$ROUTER_URL/convert" \
  -F "file=@$INPUT" \
  -F "plugin=$PLUGIN" \
  -F "emit=$EMIT" \
  -F "project_id=$PROJECT_ID" \
  -F "document_label=$DOCUMENT_LABEL" \
  -F "wait_timeout=$WAIT_TIMEOUT")
echo "$convert_response"
if ! echo "$convert_response" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "convert failed" >&2
  exit 1
fi

annotate_response=$("$PYTHON" "$ROOT/tools/plm_annotate.py" \
  --router "$ROUTER_URL" \
  --project-id "$PROJECT_ID" \
  --document-label "$DOCUMENT_LABEL" \
  --text "Reviewed" \
  --author "smoke")
echo "$annotate_response"
if ! echo "$annotate_response" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "annotate failed" >&2
  exit 1
fi

echo "plm smoke OK"
