#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"

ROUTER_HOST="${ROUTER_HOST:-127.0.0.1}"
ROUTER_PORT="${ROUTER_PORT:-9033}"
ROUTER_URL="${ROUTER_URL:-http://${ROUTER_HOST}:${ROUTER_PORT}}"
SKIP_ROUTER="${SKIP_ROUTER:-0}"
AUTH_TOKEN="${AUTH_TOKEN:-testtoken}"
OUT_DIR="${OUT_DIR:-$ROOT/build_vcpkg/plm_service_runs_error_codes}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "python executable not found: $PYTHON" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found in PATH" >&2
  exit 1
fi

README_PATH="$ROOT/README.md"
if [[ ! -f "$README_PATH" ]]; then
  echo "README not found: $README_PATH" >&2
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
  mkdir -p "$OUT_DIR"
  "$PYTHON" "$ROOT/tools/plm_router_service.py" \
    --host "$ROUTER_HOST" \
    --port "$ROUTER_PORT" \
    --out-root "$OUT_DIR" \
    --auth-token "$AUTH_TOKEN" >/dev/null 2>&1 &
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

health_response=$(curl -s --max-time 10 "$ROUTER_URL/health")
echo "$health_response"
if ! echo "$health_response" | grep -q '"error_codes"'; then
  echo "[health] expected error_codes list" >&2
  exit 1
fi
if ! echo "$health_response" | grep -q '"uptime_seconds"'; then
  echo "[health] expected uptime_seconds" >&2
  exit 1
fi
if ! echo "$health_response" | grep -q '"version"'; then
  echo "[health] expected version" >&2
  exit 1
fi
if ! echo "$health_response" | grep -q '"commit"'; then
  echo "[health] expected commit" >&2
  exit 1
fi
if ! echo "$health_response" | grep -q '"AUTH_REQUIRED"'; then
  echo "[health] expected AUTH_REQUIRED in error_codes" >&2
  exit 1
fi

check_error_code() {
  local label="$1"
  local expected="$2"
  local response="$3"
  echo "$response"
  if ! echo "$response" | grep -q '"status"[[:space:]]*:[[:space:]]*"error"'; then
    echo "[$label] expected status=error" >&2
    exit 1
  fi
  if ! echo "$response" | grep -q "\"error_code\"[[:space:]]*:[[:space:]]*\"$expected\""; then
    echo "[$label] expected error_code=$expected" >&2
    exit 1
  fi
}

unauth_response=$(curl -s --max-time 10 "$ROUTER_URL/projects")
check_error_code "unauthorized" "AUTH_REQUIRED" "$unauth_response"

status_response=$(curl -s --max-time 10 \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$ROUTER_URL/status/not-a-task")
check_error_code "missing task" "TASK_NOT_FOUND" "$status_response"

convert_response=$(curl -s --max-time 20 -X POST "$ROUTER_URL/convert" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@$README_PATH")
check_error_code "missing plugin" "MISSING_PLUGIN" "$convert_response"

annotate_response=$(curl -s --max-time 10 -X POST "$ROUTER_URL/annotate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample"}')
check_error_code "missing annotations" "MISSING_ANNOTATIONS" "$annotate_response"

echo "plm error code smoke OK"
