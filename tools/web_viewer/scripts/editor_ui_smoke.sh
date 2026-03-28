#!/usr/bin/env bash
set -euo pipefail

MODE="observe" # observe | gate
PORT="18080"
OUTDIR=""
VIEWPORT="1400,900"
TIMEOUT_MS="15000"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"; shift 2;;
    --port)
      PORT="$2"; shift 2;;
    --outdir)
      OUTDIR="$2"; shift 2;;
    --viewport)
      VIEWPORT="$2"; shift 2;;
    --timeout-ms)
      TIMEOUT_MS="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--mode observe|gate] [--port N] [--outdir dir] [--viewport W,H] [--timeout-ms MS]"
      exit 0;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ "$MODE" != "observe" && "$MODE" != "gate" ]]; then
  echo "Invalid --mode: $MODE (expected observe|gate)" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Missing dependency: npx" >&2
  exit 1
fi

RUN_ID="$(date +%Y%m%d_%H%M%S)_ui"
if [[ -z "$OUTDIR" ]]; then
  OUTDIR="$ROOT_DIR/build/editor_ui_smoke/$RUN_ID"
fi
mkdir -p "$OUTDIR"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 -m http.server "$PORT" --directory "$ROOT_DIR" >"$OUTDIR/http.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

URL="http://127.0.0.1:$PORT/tools/web_viewer/index.html?mode=editor"
SCREENSHOT="$OUTDIR/editor_ui.png"
SUMMARY="$OUTDIR/summary.json"
PLAYWRIGHT_LOG="$OUTDIR/playwright.log"

set +e
npx playwright screenshot \
  --viewport-size "$VIEWPORT" \
  --wait-for-timeout "$TIMEOUT_MS" \
  "$URL" \
  "$SCREENSHOT" >"$PLAYWRIGHT_LOG" 2>&1
EXIT_CODE=$?
set -e

OK="false"
if [[ "$EXIT_CODE" -eq 0 && -s "$SCREENSHOT" ]]; then
  OK="true"
fi

FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export RUN_ID MODE STARTED_AT FINISHED_AT URL VIEWPORT TIMEOUT_MS SCREENSHOT OK EXIT_CODE PLAYWRIGHT_LOG

python3 - "$SUMMARY" <<'PY'
import json
import os
import sys

path = sys.argv[1]
log_path = os.environ.get("PLAYWRIGHT_LOG", "")
tail = []
if log_path:
  try:
    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
      lines = f.read().splitlines()
    tail = lines[-30:]
  except Exception:
    tail = []
payload = {
  "run_id": os.environ.get("RUN_ID", ""),
  "mode": os.environ.get("MODE", ""),
  "started_at": os.environ.get("STARTED_AT", ""),
  "finished_at": os.environ.get("FINISHED_AT", ""),
  "url": os.environ.get("URL", ""),
  "viewport": os.environ.get("VIEWPORT", ""),
  "timeout_ms": int(os.environ.get("TIMEOUT_MS", "0") or "0"),
  "screenshot": os.environ.get("SCREENSHOT", ""),
  "playwright_log": log_path,
  "error_tail": tail,
  "ok": os.environ.get("OK", "").lower() == "true",
  "exit_code": int(os.environ.get("EXIT_CODE", "0") or "0"),
}
with open(path, "w", encoding="utf-8") as f:
  json.dump(payload, f, indent=2)
print(path)
PY

if [[ "$MODE" == "gate" && "$OK" != "true" ]]; then
  exit 2
fi
exit 0
