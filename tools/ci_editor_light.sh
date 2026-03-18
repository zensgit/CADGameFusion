#!/usr/bin/env bash
set -euo pipefail

# CI-friendly light gate:
# - Node command-level tests
# - Editor round-trip smoke against committed fixture cases (schema validation only; no convert)
#
# This is intentionally cross-platform and does not require building C++ plugins.
#
# Prereqs:
# - node >= 18
# - python3 + `jsonschema` installed (pip install jsonschema)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CODEX_HOME_DEFAULT="${CODEX_HOME:-$HOME/.codex}"
PWCLI_DEFAULT="$CODEX_HOME_DEFAULT/skills/playwright/scripts/playwright_cli.sh"
EDITOR_SMOKE_LIMIT="${EDITOR_SMOKE_LIMIT:-1}"
EDITOR_SMOKE_CASES="${EDITOR_SMOKE_CASES:-tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json}"
EDITOR_SMOKE_CASE_SOURCE="${EDITOR_SMOKE_CASE_SOURCE:-fixture}"
EDITOR_SMOKE_PRIORITY_SET="${EDITOR_SMOKE_PRIORITY_SET:-}"
EDITOR_SMOKE_TAG_ANY="${EDITOR_SMOKE_TAG_ANY:-}"
EDITOR_SMOKE_NO_CONVERT="${EDITOR_SMOKE_NO_CONVERT:-1}"

if ! [[ "$EDITOR_SMOKE_LIMIT" =~ ^[0-9]+$ ]] || [[ "$EDITOR_SMOKE_LIMIT" -le 0 ]]; then
  echo "[CI-EDITOR-LIGHT] WARN invalid EDITOR_SMOKE_LIMIT=$EDITOR_SMOKE_LIMIT, fallback to 1"
  EDITOR_SMOKE_LIMIT="1"
fi

pick_free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('127.0.0.1', 0))
print(s.getsockname()[1])
PY
}

run_ui_flow_smoke() {
  local mode="$1"
  local required="${2:-0}"
  local pwcli_path="$PWCLI_DEFAULT"
  if [[ ! -x "$pwcli_path" ]]; then
    if [[ "$required" == "1" ]]; then
      echo "[CI-EDITOR-LIGHT] ERROR missing Playwright wrapper: $pwcli_path" >&2
      echo "[CI-EDITOR-LIGHT] ERROR set CODEX_HOME to a valid skills directory or disable RUN_EDITOR_UI_FLOW_SMOKE(_GATE)" >&2
      return 1
    fi
    echo "[CI-EDITOR-LIGHT] SKIP editor UI flow smoke: missing Playwright wrapper at $pwcli_path"
    return 0
  fi

  echo "[CI-EDITOR-LIGHT] 5) Editor UI flow smoke (${mode})"
  local ui_port="${EDITOR_UI_FLOW_SMOKE_PORT:-}"
  if [[ -z "$ui_port" ]]; then
    ui_port="$(pick_free_port)"
  fi
  bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
    --mode "$mode" \
    --port "$ui_port" \
    --timeout-ms "${EDITOR_UI_FLOW_SMOKE_TIMEOUT_MS:-25000}"
}

echo "[CI-EDITOR-LIGHT] 1) Editor command tests"
node --test tools/web_viewer/tests/editor_commands.test.js

echo "[CI-EDITOR-LIGHT] 2) Ensure python jsonschema is available"
python3 - <<'PY'
try:
  import jsonschema  # noqa: F401
except Exception as e:
  raise SystemExit(f"Missing python dependency: jsonschema ({e}). Install via: pip install jsonschema")
print("jsonschema=ok")
PY

echo "[CI-EDITOR-LIGHT] 3) Editor round-trip smoke (gate)"
echo "[CI-EDITOR-LIGHT] editor_smoke_cases=$EDITOR_SMOKE_CASES source=$EDITOR_SMOKE_CASE_SOURCE limit=$EDITOR_SMOKE_LIMIT no_convert=$EDITOR_SMOKE_NO_CONVERT"
ROUNDTRIP_CMD=(
  node tools/web_viewer/scripts/editor_roundtrip_smoke.js
  --mode gate
  --limit "$EDITOR_SMOKE_LIMIT"
  --cases "$EDITOR_SMOKE_CASES"
)
if [[ "$EDITOR_SMOKE_NO_CONVERT" == "1" ]]; then
  ROUNDTRIP_CMD+=(--no-convert)
fi
if [[ -n "$EDITOR_SMOKE_PRIORITY_SET" ]]; then
  ROUNDTRIP_CMD+=(--priority-set "$EDITOR_SMOKE_PRIORITY_SET")
fi
if [[ -n "$EDITOR_SMOKE_TAG_ANY" ]]; then
  ROUNDTRIP_CMD+=(--tag-any "$EDITOR_SMOKE_TAG_ANY")
fi
"${ROUNDTRIP_CMD[@]}"

if [[ "${RUN_EDITOR_UI_SMOKE:-0}" == "1" || "${RUN_EDITOR_UI_SMOKE_GATE:-0}" == "1" ]]; then
  MODE="observe"
  if [[ "${RUN_EDITOR_UI_SMOKE_GATE:-0}" == "1" ]]; then
    MODE="gate"
  fi
  echo "[CI-EDITOR-LIGHT] 4) Editor UI smoke (${MODE})"
  bash tools/web_viewer/scripts/editor_ui_smoke.sh --mode "$MODE" --port "${EDITOR_UI_SMOKE_PORT:-18080}"
fi

if [[ "${RUN_EDITOR_UI_FLOW_SMOKE:-0}" == "1" || "${RUN_EDITOR_UI_FLOW_SMOKE_GATE:-0}" == "1" ]]; then
  MODE="observe"
  if [[ "${RUN_EDITOR_UI_FLOW_SMOKE_GATE:-0}" == "1" ]]; then
    MODE="gate"
  fi
  run_ui_flow_smoke "$MODE" "1"
fi

# Default: run UI flow smoke in gate mode unless explicitly disabled.
# Rationale: this is the most direct "CAD is editable" guardrail and does not require C++ plugins.
if [[ "${SKIP_EDITOR_UI_FLOW_SMOKE:-0}" != "1" ]]; then
  if [[ -z "${RUN_EDITOR_UI_FLOW_SMOKE+x}" && -z "${RUN_EDITOR_UI_FLOW_SMOKE_GATE+x}" ]]; then
    run_ui_flow_smoke "gate" "0"
  fi
fi

echo "[CI-EDITOR-LIGHT] DONE"
