#!/usr/bin/env bash
set -euo pipefail

# One-button gate for Level A stability:
# - Web editor command-level tests
# - Editor round-trip smoke in gate mode (schema + convert)
# - STEP166 CAD regression in gate mode (DXF+PDF -> viewer compare) with baseline

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASELINE="${BASELINE:-docs/baselines/STEP166_baseline_summary.json}"
EDITOR_SMOKE_LIMIT="${EDITOR_SMOKE_LIMIT:-5}"
EDITOR_SMOKE_CASES="${EDITOR_SMOKE_CASES:-}"
EDITOR_OUTDIR="${EDITOR_OUTDIR:-build/editor_roundtrip}"
EDITOR_PLUGIN="${EDITOR_PLUGIN:-build/plugins/libcadgf_json_importer_plugin.dylib}"
EDITOR_SMOKE_NO_CONVERT="${EDITOR_SMOKE_NO_CONVERT:-0}"
RUN_EDITOR_UI_FLOW_SMOKE="${RUN_EDITOR_UI_FLOW_SMOKE:-0}"
# Default-on for gate: UI-flow smoke is the closest proxy for "CAD is actually editable" wiring.
# Can be disabled via RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 (or both RUN_EDITOR_UI_FLOW_SMOKE* = 0).
RUN_EDITOR_UI_FLOW_SMOKE_GATE="${RUN_EDITOR_UI_FLOW_SMOKE_GATE:-1}"
EDITOR_UI_FLOW_PORT="${EDITOR_UI_FLOW_PORT:-}"
EDITOR_UI_FLOW_VIEWPORT="${EDITOR_UI_FLOW_VIEWPORT:-1400,900}"
EDITOR_UI_FLOW_TIMEOUT_MS="${EDITOR_UI_FLOW_TIMEOUT_MS:-25000}"
EDITOR_UI_FLOW_OUTDIR="${EDITOR_UI_FLOW_OUTDIR:-}"
EDITOR_UI_FLOW_HEADED="${EDITOR_UI_FLOW_HEADED:-0}"
EDITOR_UI_FLOW_SMOKE_GATE_RUNS="${EDITOR_UI_FLOW_SMOKE_GATE_RUNS:-}"
EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_LOCAL="${EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_LOCAL:-2}"
EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_CI="${EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_CI:-3}"
RUN_UI_FLOW_FAILURE_INJECTION_GATE="${RUN_UI_FLOW_FAILURE_INJECTION_GATE:-}"
RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_LOCAL="${RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_LOCAL:-0}"
RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_CI="${RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_CI:-1}"
UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS="${UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS:-1}"
UI_FLOW_FAILURE_INJECTION_STRICT="${UI_FLOW_FAILURE_INJECTION_STRICT:-0}"
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE="${RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE:-}"
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_LOCAL="${RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_LOCAL:-0}"
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_CI="${RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_CI:-1}"
EDITOR_SMOKE_FAILURE_INJECTION_STRICT="${EDITOR_SMOKE_FAILURE_INJECTION_STRICT:-0}"
EDITOR_SMOKE_FAILURE_INJECTION_LIMIT="${EDITOR_SMOKE_FAILURE_INJECTION_LIMIT:-1}"
EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN="${EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN:-/tmp/cadgf_json_missing_plugin.dylib}"
CAD_PORT_BASE="${CAD_PORT_BASE:-$((20000 + RANDOM % 20000))}"
CAD_ATTEMPTS="${CAD_ATTEMPTS:-3}"
CAD_OUTDIR="${CAD_OUTDIR:-build/cad_regression}"
CAD_PLUGIN="${CAD_PLUGIN:-build/plugins/libcadgf_dxf_importer_plugin.dylib}"
RUN_STEP166_GATE="${RUN_STEP166_GATE:-1}"
# Default-on: keep STEP170 verification report updated with every gate run.
EDITOR_GATE_APPEND_REPORT="${EDITOR_GATE_APPEND_REPORT:-1}"
RUN_PERF_TREND_GATE="${RUN_PERF_TREND_GATE:-0}"
PERF_TREND_DAYS="${PERF_TREND_DAYS:-14}"
PERF_TREND_JSON="${PERF_TREND_JSON:-build/editor_perf_trend.json}"
PERF_TREND_MD="${PERF_TREND_MD:-build/editor_perf_trend.md}"
PERF_TREND_POLICY="${PERF_TREND_POLICY:-auto}" # observe|auto|gate
PERF_TREND_MIN_SELECTED="${PERF_TREND_MIN_SELECTED:-5}"

RUN_REAL_SCENE_TREND_GATE="${RUN_REAL_SCENE_TREND_GATE:-0}"
REAL_SCENE_PROFILE="${REAL_SCENE_PROFILE:-docs/baselines/STEP174_REAL_SCENE_PERF_PROFILE.json}"
REAL_SCENE_TREND_DAYS="${REAL_SCENE_TREND_DAYS:-14}"
REAL_SCENE_TREND_JSON="${REAL_SCENE_TREND_JSON:-build/editor_real_scene_perf_trend.json}"
REAL_SCENE_TREND_MD="${REAL_SCENE_TREND_MD:-build/editor_real_scene_perf_trend.md}"
REAL_SCENE_TREND_POLICY="${REAL_SCENE_TREND_POLICY:-auto}" # observe|auto|gate
REAL_SCENE_TREND_MIN_SELECTED="${REAL_SCENE_TREND_MIN_SELECTED:-5}"

SUMMARY_PATH="${SUMMARY_PATH:-build/editor_gate_summary.json}"
HISTORY_DIR="${HISTORY_DIR:-build/editor_gate_history}"

STEP176_APPEND_REPORT="${STEP176_APPEND_REPORT:-0}"
STEP176_REPORT="${STEP176_REPORT:-docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md}"

PRUNE_BUILDS="${PRUNE_BUILDS:-off}" # off|dry|apply
PRUNE_CAD_KEEP="${PRUNE_CAD_KEEP:-20}"
PRUNE_ROUNDTRIP_KEEP="${PRUNE_ROUNDTRIP_KEEP:-20}"

if [[ -z "$EDITOR_SMOKE_CASES" && -f "local/editor_roundtrip_smoke_cases.json" ]]; then
  EDITOR_SMOKE_CASES="local/editor_roundtrip_smoke_cases.json"
fi
if [[ -z "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" ]]; then
  if [[ "$RUN_EDITOR_UI_FLOW_SMOKE_GATE" == "1" ]]; then
    case "${CI:-}" in
      1|true|TRUE|yes|YES|on|ON)
        EDITOR_UI_FLOW_SMOKE_GATE_RUNS="$EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_CI"
        ;;
      *)
        EDITOR_UI_FLOW_SMOKE_GATE_RUNS="$EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT_LOCAL"
        ;;
    esac
  else
    EDITOR_UI_FLOW_SMOKE_GATE_RUNS="1"
  fi
fi
if ! [[ "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" =~ ^[0-9]+$ ]] || [[ "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" -le 0 ]]; then
  echo "[EDITOR-GATE] WARN invalid EDITOR_UI_FLOW_SMOKE_GATE_RUNS=$EDITOR_UI_FLOW_SMOKE_GATE_RUNS, fallback to 1"
  EDITOR_UI_FLOW_SMOKE_GATE_RUNS="1"
fi
if [[ -z "$RUN_UI_FLOW_FAILURE_INJECTION_GATE" ]]; then
  if [[ "$RUN_EDITOR_UI_FLOW_SMOKE_GATE" == "1" ]]; then
    case "${CI:-}" in
      1|true|TRUE|yes|YES|on|ON)
        RUN_UI_FLOW_FAILURE_INJECTION_GATE="$RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_CI"
        ;;
      *)
        RUN_UI_FLOW_FAILURE_INJECTION_GATE="$RUN_UI_FLOW_FAILURE_INJECTION_GATE_DEFAULT_LOCAL"
        ;;
    esac
  else
    RUN_UI_FLOW_FAILURE_INJECTION_GATE="0"
  fi
fi
if [[ "$RUN_UI_FLOW_FAILURE_INJECTION_GATE" != "0" && "$RUN_UI_FLOW_FAILURE_INJECTION_GATE" != "1" ]]; then
  echo "[EDITOR-GATE] WARN invalid RUN_UI_FLOW_FAILURE_INJECTION_GATE=$RUN_UI_FLOW_FAILURE_INJECTION_GATE, fallback to 0"
  RUN_UI_FLOW_FAILURE_INJECTION_GATE="0"
fi
if [[ -z "$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE" ]]; then
  case "${CI:-}" in
    1|true|TRUE|yes|YES|on|ON)
      RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE="$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_CI"
      ;;
    *)
      RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE="$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE_DEFAULT_LOCAL"
      ;;
  esac
fi
if [[ "$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE" != "0" && "$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE" != "1" ]]; then
  echo "[EDITOR-GATE] WARN invalid RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE, fallback to 0"
  RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE="0"
fi
if ! [[ "$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT" =~ ^[0-9]+$ ]] || [[ "$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT" -le 0 ]]; then
  echo "[EDITOR-GATE] WARN invalid EDITOR_SMOKE_FAILURE_INJECTION_LIMIT=$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT, fallback to 1"
  EDITOR_SMOKE_FAILURE_INJECTION_LIMIT="1"
fi
if [[ "$EDITOR_SMOKE_NO_CONVERT" != "0" && "$EDITOR_SMOKE_NO_CONVERT" != "1" ]]; then
  echo "[EDITOR-GATE] WARN invalid EDITOR_SMOKE_NO_CONVERT=$EDITOR_SMOKE_NO_CONVERT, fallback to 0"
  EDITOR_SMOKE_NO_CONVERT="0"
fi
if [[ "$RUN_STEP166_GATE" != "0" && "$RUN_STEP166_GATE" != "1" ]]; then
  echo "[EDITOR-GATE] WARN invalid RUN_STEP166_GATE=$RUN_STEP166_GATE, fallback to 1"
  RUN_STEP166_GATE="1"
fi

echo "[EDITOR-GATE] root=$ROOT"
echo "[EDITOR-GATE] baseline=$BASELINE"
echo "[EDITOR-GATE] editor_smoke_limit=$EDITOR_SMOKE_LIMIT"
echo "[EDITOR-GATE] editor_smoke_cases=${EDITOR_SMOKE_CASES:-<discovery>}"
echo "[EDITOR-GATE] editor_plugin=$EDITOR_PLUGIN"
echo "[EDITOR-GATE] editor_smoke_no_convert=$EDITOR_SMOKE_NO_CONVERT"
echo "[EDITOR-GATE] editor_outdir=$EDITOR_OUTDIR"
echo "[EDITOR-GATE] ui_flow_smoke=$RUN_EDITOR_UI_FLOW_SMOKE ui_flow_smoke_gate=$RUN_EDITOR_UI_FLOW_SMOKE_GATE gate_runs=$EDITOR_UI_FLOW_SMOKE_GATE_RUNS port=$EDITOR_UI_FLOW_PORT viewport=$EDITOR_UI_FLOW_VIEWPORT timeout_ms=$EDITOR_UI_FLOW_TIMEOUT_MS headed=$EDITOR_UI_FLOW_HEADED"
echo "[EDITOR-GATE] ui_flow_failure_injection=$RUN_UI_FLOW_FAILURE_INJECTION_GATE timeout_ms=$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS strict=$UI_FLOW_FAILURE_INJECTION_STRICT"
echo "[EDITOR-GATE] editor_smoke_failure_injection=$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE limit=$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT strict=$EDITOR_SMOKE_FAILURE_INJECTION_STRICT plugin=$EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN"
echo "[EDITOR-GATE] cad_port_base=$CAD_PORT_BASE"
echo "[EDITOR-GATE] cad_plugin=$CAD_PLUGIN"
echo "[EDITOR-GATE] cad_outdir=$CAD_OUTDIR"
echo "[EDITOR-GATE] run_step166_gate=$RUN_STEP166_GATE"
echo "[EDITOR-GATE] perf_trend_gate=$RUN_PERF_TREND_GATE policy=$PERF_TREND_POLICY min_selected=$PERF_TREND_MIN_SELECTED days=$PERF_TREND_DAYS"
echo "[EDITOR-GATE] real_scene_trend_gate=$RUN_REAL_SCENE_TREND_GATE policy=$REAL_SCENE_TREND_POLICY min_selected=$REAL_SCENE_TREND_MIN_SELECTED profile=$REAL_SCENE_PROFILE days=$REAL_SCENE_TREND_DAYS"

GATE_FAIL_RC=0
GATE_FAIL_REASONS=()

if [[ "$PRUNE_BUILDS" != "off" ]]; then
  echo "[EDITOR-GATE] prune_builds=$PRUNE_BUILDS cad_keep=$PRUNE_CAD_KEEP roundtrip_keep=$PRUNE_ROUNDTRIP_KEEP"
  PRUNE_CMD=(python3 tools/prune_build_runs.py --cad-keep "$PRUNE_CAD_KEEP" --roundtrip-keep "$PRUNE_ROUNDTRIP_KEEP")
  if [[ "$PRUNE_BUILDS" == "apply" ]]; then
    PRUNE_CMD+=(--apply)
  fi
  "${PRUNE_CMD[@]}"
fi

echo "[EDITOR-GATE] 1) Web editor command tests"
node --test tools/web_viewer/tests/editor_commands.test.js

UI_FLOW_MODE="skipped"
UI_FLOW_RUN_ID=""
UI_FLOW_SUMMARY_PATH=""
UI_FLOW_OK="false"
UI_FLOW_RC="0"
UI_FLOW_GATE_RUNS_TARGET=0
UI_FLOW_GATE_RUN_COUNT=0
UI_FLOW_GATE_PASS_COUNT=0
UI_FLOW_GATE_FAIL_COUNT=0
UI_FLOW_RUN_SUMMARIES=""
UI_FLOW_FAIL_CODE_COUNTS_STR=""
UI_FLOW_PRIMARY_FAIL_CODE=""
UI_FLOW_INJECTION_STATUS="SKIPPED"
UI_FLOW_INJECTION_RUN_ID=""
UI_FLOW_INJECTION_SUMMARY_PATH=""
UI_FLOW_INJECTION_RC="0"
UI_FLOW_INJECTION_FAILURE_CODE=""
UI_FLOW_INJECTION_FAILURE_DETAIL=""
EDITOR_SMOKE_INJECTION_STATUS="SKIPPED"
EDITOR_SMOKE_INJECTION_RUN_ID=""
EDITOR_SMOKE_INJECTION_SUMMARY_PATH=""
EDITOR_SMOKE_INJECTION_RC="0"
EDITOR_SMOKE_INJECTION_FAILURE_CODE=""
EDITOR_SMOKE_INJECTION_FAILURE_DETAIL=""
if [[ "$RUN_EDITOR_UI_FLOW_SMOKE" == "1" || "$RUN_EDITOR_UI_FLOW_SMOKE_GATE" == "1" ]]; then
  if [[ -z "$EDITOR_UI_FLOW_PORT" ]]; then
    EDITOR_UI_FLOW_PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"
  fi
  UI_FLOW_MODE="observe"
  if [[ "$RUN_EDITOR_UI_FLOW_SMOKE_GATE" == "1" ]]; then
    UI_FLOW_MODE="gate"
  fi
  UI_FLOW_GATE_RUNS_TARGET=1
  if [[ "$UI_FLOW_MODE" == "gate" ]]; then
    UI_FLOW_GATE_RUNS_TARGET="$EDITOR_UI_FLOW_SMOKE_GATE_RUNS"
  fi
  echo "[EDITOR-GATE] 1.5) Editor UI flow smoke ($UI_FLOW_MODE)"
  declare -a UI_FLOW_SUMMARY_PATHS=()
  for ((ui_run_idx=1; ui_run_idx<=UI_FLOW_GATE_RUNS_TARGET; ui_run_idx++)); do
    UI_FLOW_CMD=(bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode "$UI_FLOW_MODE" --port "$EDITOR_UI_FLOW_PORT" --viewport "$EDITOR_UI_FLOW_VIEWPORT" --timeout-ms "$EDITOR_UI_FLOW_TIMEOUT_MS")
    if [[ "$EDITOR_UI_FLOW_HEADED" == "1" ]]; then
      UI_FLOW_CMD+=(--headed)
    fi
    if [[ -n "$EDITOR_UI_FLOW_OUTDIR" ]]; then
      if [[ "$UI_FLOW_GATE_RUNS_TARGET" -gt 1 ]]; then
        UI_FLOW_CMD+=(--outdir "${EDITOR_UI_FLOW_OUTDIR}_r${ui_run_idx}")
      else
        UI_FLOW_CMD+=(--outdir "$EDITOR_UI_FLOW_OUTDIR")
      fi
    fi

    set +e
    UI_FLOW_OUT="$("${UI_FLOW_CMD[@]}")"
    ui_flow_rc=$?
    set -e
    UI_FLOW_RC="$ui_flow_rc"
    run_summary_path="$(echo "$UI_FLOW_OUT" | tail -n 1 | tr -d '\r')"
    UI_FLOW_GATE_RUN_COUNT=$((UI_FLOW_GATE_RUN_COUNT + 1))

    ui_run_ok="false"
    ui_run_id=""
    if [[ -f "$run_summary_path" ]]; then
      UI_FLOW_SUMMARY_PATHS+=("$run_summary_path")
      eval "$(
        python3 - "$run_summary_path" <<'PY'
import json
import sys

path = sys.argv[1]
try:
  payload = json.load(open(path, "r", encoding="utf-8"))
except Exception:
  payload = {}

def shell_escape(text: str) -> str:
  return str(text or "").replace("\\\\", "\\\\\\\\").replace('"', '\\"')

ok = payload.get("ok") is True
run_id = payload.get("run_id", "")
ok_str = "true" if ok else "false"
print('UI_FLOW_RUN_ID_TMP="%s"' % shell_escape(run_id))
print('UI_FLOW_OK_TMP="%s"' % ok_str)
PY
      )"
      ui_run_ok="$UI_FLOW_OK_TMP"
      ui_run_id="$UI_FLOW_RUN_ID_TMP"
      UI_FLOW_RUN_ID="$UI_FLOW_RUN_ID_TMP"
    fi

    if [[ "$ui_run_ok" == "true" ]]; then
      UI_FLOW_GATE_PASS_COUNT=$((UI_FLOW_GATE_PASS_COUNT + 1))
      echo "[EDITOR-GATE] ui_flow run $ui_run_idx/$UI_FLOW_GATE_RUNS_TARGET PASS run_id=$ui_run_id"
    else
      UI_FLOW_GATE_FAIL_COUNT=$((UI_FLOW_GATE_FAIL_COUNT + 1))
      echo "[EDITOR-GATE] ui_flow run $ui_run_idx/$UI_FLOW_GATE_RUNS_TARGET FAIL run_id=$ui_run_id"
    fi
  done

  if [[ "${#UI_FLOW_SUMMARY_PATHS[@]}" -gt 0 ]]; then
    ui_last_index=$(( ${#UI_FLOW_SUMMARY_PATHS[@]} - 1 ))
    UI_FLOW_SUMMARY_PATH="${UI_FLOW_SUMMARY_PATHS[$ui_last_index]}"
    UI_FLOW_RUN_SUMMARIES="$(IFS='|'; echo "${UI_FLOW_SUMMARY_PATHS[*]}")"
  fi

  if [[ -n "$UI_FLOW_RUN_SUMMARIES" ]]; then
    eval "$(
      python3 - "$UI_FLOW_RUN_SUMMARIES" <<'PY'
import json
import sys

def shell_escape(text: str) -> str:
  return str(text or "").replace("\\", "\\\\").replace('"', '\\"')

def load_json(path: str):
  try:
    with open(path, "r", encoding="utf-8") as fh:
      payload = json.load(fh)
    return payload if isinstance(payload, dict) else {}
  except Exception:
    return {}

def first_nonempty(values):
  for v in values:
    s = str(v or "").strip()
    if s:
      return s
  return ""

def classify(payload: dict) -> tuple[str, str]:
  flow = payload.get("flow")
  if not isinstance(flow, dict):
    tails = payload.get("error_tail") if isinstance(payload.get("error_tail"), list) else []
    detail = first_nonempty(tails)
    detail_l = detail.lower()
    if "timeout" in detail_l or "timed out" in detail_l:
      return ("UI_FLOW_TIMEOUT", detail)
    return ("UI_FLOW_FLOW_JSON_INVALID", detail or "flow payload missing")

  err = flow.get("__error")
  if isinstance(err, dict):
    message = str(err.get("message") or "").strip()
    lower = message.lower()
    if "timeout" in lower or "timed out" in lower:
      return ("UI_FLOW_TIMEOUT", message)
    return ("UI_FLOW_ASSERT_FAIL", message or "flow error")

  step = str(payload.get("flow_step") or flow.get("__step") or "").strip()
  status = str(payload.get("flow_status") or "").strip()
  tails = payload.get("error_tail") if isinstance(payload.get("error_tail"), list) else []
  detail = first_nonempty([status] + tails)
  detail_l = detail.lower()
  if "timeout" in detail_l or "timed out" in detail_l:
    return ("UI_FLOW_TIMEOUT", detail)
  if not step and not status:
    return ("UI_FLOW_FLOW_JSON_INVALID", detail or "missing flow step and status")
  return ("UI_FLOW_UNKNOWN_FAIL", detail or "unknown ui flow failure")

paths = [p for p in str(sys.argv[1] or "").split("|") if p]
counts = {}
primary = ""
for path in paths:
  payload = load_json(path)
  if payload.get("ok") is True:
    continue
  code, _detail = classify(payload)
  counts[code] = int(counts.get(code, 0)) + 1
  if not primary:
    primary = code

items = [f"{k}:{counts[k]}" for k in sorted(counts.keys())]
print('UI_FLOW_FAIL_CODE_COUNTS_STR="%s"' % shell_escape(",".join(items)))
print('UI_FLOW_PRIMARY_FAIL_CODE="%s"' % shell_escape(primary))
PY
    )"
  fi

  if [[ "$UI_FLOW_GATE_FAIL_COUNT" -eq 0 && "$UI_FLOW_GATE_RUN_COUNT" -ge "$UI_FLOW_GATE_RUNS_TARGET" ]]; then
    UI_FLOW_OK="true"
  else
    UI_FLOW_OK="false"
  fi

  if [[ "$UI_FLOW_MODE" == "gate" ]]; then
    if [[ "$UI_FLOW_OK" != "true" ]]; then
      GATE_FAIL_RC=2
      GATE_FAIL_REASONS+=("UI_FLOW_SMOKE:FAIL")
      if [[ "$UI_FLOW_GATE_RUN_COUNT" -lt "$UI_FLOW_GATE_RUNS_TARGET" ]]; then
        GATE_FAIL_REASONS+=("UI_FLOW_SMOKE_GATE_RUNS:${UI_FLOW_GATE_RUN_COUNT}/${UI_FLOW_GATE_RUNS_TARGET}")
      fi
      if [[ "$UI_FLOW_GATE_FAIL_COUNT" -gt 0 ]]; then
        GATE_FAIL_REASONS+=("UI_FLOW_SMOKE_GATE_FAIL_COUNT:${UI_FLOW_GATE_FAIL_COUNT}")
      fi
      if [[ -n "$UI_FLOW_FAIL_CODE_COUNTS_STR" ]]; then
        IFS=',' read -ra _ui_fail_items <<<"$UI_FLOW_FAIL_CODE_COUNTS_STR"
        for _item in "${_ui_fail_items[@]}"; do
          if [[ -n "$_item" ]]; then
            GATE_FAIL_REASONS+=("$_item")
          fi
        done
      fi
    fi
  fi
fi

if [[ "$RUN_UI_FLOW_FAILURE_INJECTION_GATE" == "1" ]]; then
  if [[ -z "$EDITOR_UI_FLOW_PORT" ]]; then
    EDITOR_UI_FLOW_PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"
  fi
  echo "[EDITOR-GATE] 1.6) UI flow failure injection (expected fail, timeout_ms=$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS)"
  UI_FLOW_INJECT_CMD=(bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$EDITOR_UI_FLOW_PORT" --viewport "$EDITOR_UI_FLOW_VIEWPORT" --timeout-ms "$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS")
  if [[ "$EDITOR_UI_FLOW_HEADED" == "1" ]]; then
    UI_FLOW_INJECT_CMD+=(--headed)
  fi
  if [[ -n "$EDITOR_UI_FLOW_OUTDIR" ]]; then
    UI_FLOW_INJECT_CMD+=(--outdir "${EDITOR_UI_FLOW_OUTDIR}_inject")
  fi
  set +e
  UI_FLOW_INJECT_OUT="$("${UI_FLOW_INJECT_CMD[@]}")"
  ui_flow_inject_rc=$?
  set -e
  UI_FLOW_INJECTION_RC="$ui_flow_inject_rc"
  UI_FLOW_INJECTION_SUMMARY_PATH="$(echo "$UI_FLOW_INJECT_OUT" | tail -n 1 | tr -d '\r')"
  eval "$(
    python3 - "$UI_FLOW_INJECTION_SUMMARY_PATH" <<'PY'
import json
import sys

path = sys.argv[1]
payload = {}
try:
  if path:
    payload = json.load(open(path, "r", encoding="utf-8"))
    if not isinstance(payload, dict):
      payload = {}
except Exception:
  payload = {}

def shell_escape(text: str) -> str:
  return str(text or "").replace("\\", "\\\\").replace('"', '\\"')

def first_nonempty(values):
  for value in values:
    text = str(value or "").strip()
    if text:
      return text
  return ""

def classify(payload: dict):
  flow = payload.get("flow")
  tails = payload.get("error_tail") if isinstance(payload.get("error_tail"), list) else []
  status = str(payload.get("flow_status") or "")
  detail = first_nonempty([status] + tails)
  detail_l = detail.lower()
  if not isinstance(flow, dict):
    if "timeout" in detail_l or "timed out" in detail_l:
      return ("UI_FLOW_TIMEOUT", detail or "timeout")
    return ("UI_FLOW_FLOW_JSON_INVALID", detail or "flow payload missing")
  err = flow.get("__error")
  if isinstance(err, dict):
    message = str(err.get("message") or "")
    message_l = message.lower()
    if "timeout" in message_l or "timed out" in message_l:
      return ("UI_FLOW_TIMEOUT", message or detail or "timeout")
    return ("UI_FLOW_ASSERT_FAIL", message or detail or "flow error")
  if "timeout" in detail_l or "timed out" in detail_l:
    return ("UI_FLOW_TIMEOUT", detail)
  return ("UI_FLOW_UNKNOWN_FAIL", detail or "unknown ui flow failure")

run_id = str(payload.get("run_id") or "")
if not payload:
  status = "FAIL"
  code = "UI_FLOW_INJECTION_SUMMARY_MISSING"
  detail = "summary missing or invalid"
elif payload.get("ok") is True:
  status = "FAIL"
  code = "UI_FLOW_EXPECTED_FAIL_NOT_TRIGGERED"
  detail = "failure injection unexpectedly passed"
else:
  status = "PASS"
  code, detail = classify(payload)
if len(detail) > 300:
  detail = detail[:300] + "..."
print('UI_FLOW_INJECTION_RUN_ID="%s"' % shell_escape(run_id))
print('UI_FLOW_INJECTION_STATUS="%s"' % shell_escape(status))
print('UI_FLOW_INJECTION_FAILURE_CODE="%s"' % shell_escape(code))
print('UI_FLOW_INJECTION_FAILURE_DETAIL="%s"' % shell_escape(detail))
PY
  )"
  if [[ "$UI_FLOW_INJECTION_STATUS" == "PASS" ]]; then
    echo "[EDITOR-GATE] ui_flow failure injection PASS run_id=$UI_FLOW_INJECTION_RUN_ID code=$UI_FLOW_INJECTION_FAILURE_CODE"
  else
    echo "[EDITOR-GATE] ui_flow failure injection FAIL run_id=$UI_FLOW_INJECTION_RUN_ID code=$UI_FLOW_INJECTION_FAILURE_CODE"
    if [[ "$UI_FLOW_FAILURE_INJECTION_STRICT" == "1" ]]; then
      GATE_FAIL_RC=2
      GATE_FAIL_REASONS+=("UI_FLOW_INJECTION:FAIL")
      if [[ -n "$UI_FLOW_INJECTION_FAILURE_CODE" ]]; then
        GATE_FAIL_REASONS+=("UI_FLOW_INJECTION_CODE:${UI_FLOW_INJECTION_FAILURE_CODE}")
      fi
    fi
  fi
fi

echo "[EDITOR-GATE] 2) Editor round-trip smoke (gate)"
SMOKE_OUT="$(mktemp -t editor_smoke.XXXXXX)"
trap 'rm -f "$SMOKE_OUT"' EXIT
SMOKE_ARGS=(--mode gate --limit "$EDITOR_SMOKE_LIMIT" --outdir "$EDITOR_OUTDIR" --plugin "$EDITOR_PLUGIN")
if [[ "$EDITOR_SMOKE_NO_CONVERT" == "1" ]]; then
  SMOKE_ARGS+=(--no-convert)
fi
if [[ -n "$EDITOR_SMOKE_CASES" ]]; then
  SMOKE_ARGS+=(--cases "$EDITOR_SMOKE_CASES")
fi
SMOKE_RC=0
set +e
node tools/web_viewer/scripts/editor_roundtrip_smoke.js "${SMOKE_ARGS[@]}" | tee "$SMOKE_OUT"
SMOKE_RC=${PIPESTATUS[0]}
set -e
EDITOR_SMOKE_RUN_ID="$(grep -Eo '^run_id=[0-9_]+_[0-9]+_[0-9a-f]+' "$SMOKE_OUT" | head -n 1 | cut -d= -f2 || true)"
EDITOR_SMOKE_SUMMARY_FROM_OUT="$(grep -Eo '^summary_json=.*' "$SMOKE_OUT" | head -n 1 | cut -d= -f2- || true)"
if [[ "$SMOKE_RC" -ne 0 ]]; then
  GATE_FAIL_RC=2
  GATE_FAIL_REASONS+=("EDITOR_SMOKE:FAIL")
  if [[ -n "$EDITOR_SMOKE_SUMMARY_FROM_OUT" && -f "$EDITOR_SMOKE_SUMMARY_FROM_OUT" ]]; then
    while IFS= read -r reason; do
      [[ -z "$reason" ]] && continue
      GATE_FAIL_REASONS+=("EDITOR_SMOKE_${reason}")
    done < <(
      python3 - <<PY
import json
path = "$EDITOR_SMOKE_SUMMARY_FROM_OUT"
try:
  payload = json.load(open(path, "r", encoding="utf-8"))
except Exception:
  payload = {}
decision = payload.get("gate_decision") if isinstance(payload.get("gate_decision"), dict) else {}
reasons = decision.get("fail_reasons") if isinstance(decision.get("fail_reasons"), list) else []
for item in reasons:
  text = str(item or "").strip()
  if text:
    print(text)
PY
    )
  fi
fi

if [[ "$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE" == "1" && "$EDITOR_SMOKE_NO_CONVERT" == "1" ]]; then
  echo "[EDITOR-GATE] 2.5) Editor smoke failure injection skipped (EDITOR_SMOKE_NO_CONVERT=1)"
  EDITOR_SMOKE_INJECTION_STATUS="SKIPPED"
  EDITOR_SMOKE_INJECTION_FAILURE_CODE="SKIP_NO_CONVERT"
  EDITOR_SMOKE_INJECTION_FAILURE_DETAIL="failure injection requires convert stage"
elif [[ "$RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE" == "1" ]]; then
  echo "[EDITOR-GATE] 2.5) Editor smoke failure injection (expected fail, limit=$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT)"
  EDITOR_SMOKE_INJECT_OUT="$(mktemp -t editor_smoke_inject.XXXXXX)"
  EDITOR_SMOKE_INJECT_ARGS=(--mode gate --limit "$EDITOR_SMOKE_FAILURE_INJECTION_LIMIT" --outdir "$EDITOR_OUTDIR" --plugin "$EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN")
  if [[ -n "$EDITOR_SMOKE_CASES" ]]; then
    EDITOR_SMOKE_INJECT_ARGS+=(--cases "$EDITOR_SMOKE_CASES")
  fi
  set +e
  node tools/web_viewer/scripts/editor_roundtrip_smoke.js "${EDITOR_SMOKE_INJECT_ARGS[@]}" | tee "$EDITOR_SMOKE_INJECT_OUT"
  EDITOR_SMOKE_INJECTION_RC=${PIPESTATUS[0]}
  set -e
  EDITOR_SMOKE_INJECTION_RUN_ID="$(grep -Eo '^run_id=[0-9_]+_[0-9]+_[0-9a-f]+' "$EDITOR_SMOKE_INJECT_OUT" | head -n 1 | cut -d= -f2 || true)"
  EDITOR_SMOKE_INJECTION_SUMMARY_PATH="$(grep -Eo '^summary_json=.*' "$EDITOR_SMOKE_INJECT_OUT" | head -n 1 | cut -d= -f2- || true)"
  eval "$(
    python3 - "$EDITOR_SMOKE_INJECTION_SUMMARY_PATH" "$EDITOR_SMOKE_INJECTION_RC" <<'PY'
import json
import sys

path = str(sys.argv[1] or "")
try:
  rc = int(sys.argv[2])
except Exception:
  rc = 0

payload = {}
try:
  if path:
    payload = json.load(open(path, "r", encoding="utf-8"))
    if not isinstance(payload, dict):
      payload = {}
except Exception:
  payload = {}

def shell_escape(text: str) -> str:
  return str(text or "").replace("\\", "\\\\").replace('"', '\\"')

def classify(payload: dict):
  totals = payload.get("totals") if isinstance(payload.get("totals"), dict) else {}
  fail_count = int(totals.get("fail", 0) or 0)
  if fail_count <= 0:
    return ("EDITOR_SMOKE_EXPECTED_FAIL_NOT_TRIGGERED", "summary has no failing cases")
  first_code = ""
  results = payload.get("results")
  if isinstance(results, list):
    for one in results:
      if not isinstance(one, dict):
        continue
      if str(one.get("status") or "").upper() != "FAIL":
        continue
      raw_codes = one.get("failure_codes")
      if isinstance(raw_codes, list):
        for code in raw_codes:
          text = str(code or "").strip()
          if text:
            first_code = text
            break
      name = str(one.get("name") or "")
      if first_code:
        return (first_code, f"case={name}" if name else first_code)
      if name:
        return ("EDITOR_SMOKE_FAIL", f"case={name}")
      break
  return ("EDITOR_SMOKE_FAIL", "roundtrip smoke failed")

if not payload:
  if rc == 0:
    status = "FAIL"
    code = "EDITOR_SMOKE_EXPECTED_FAIL_NOT_TRIGGERED"
    detail = "injection unexpectedly passed without summary"
  else:
    status = "PASS"
    code = "EDITOR_SMOKE_SUMMARY_MISSING"
    detail = "injection failed but summary missing"
elif rc == 0:
  status = "FAIL"
  code = "EDITOR_SMOKE_EXPECTED_FAIL_NOT_TRIGGERED"
  detail = "injection unexpectedly passed"
else:
  status = "PASS"
  code, detail = classify(payload)

if len(detail) > 300:
  detail = detail[:300] + "..."
print('EDITOR_SMOKE_INJECTION_STATUS="%s"' % shell_escape(status))
print('EDITOR_SMOKE_INJECTION_FAILURE_CODE="%s"' % shell_escape(code))
print('EDITOR_SMOKE_INJECTION_FAILURE_DETAIL="%s"' % shell_escape(detail))
PY
  )"
  rm -f "$EDITOR_SMOKE_INJECT_OUT"
  if [[ "$EDITOR_SMOKE_INJECTION_STATUS" == "PASS" ]]; then
    echo "[EDITOR-GATE] editor_smoke failure injection PASS run_id=$EDITOR_SMOKE_INJECTION_RUN_ID code=$EDITOR_SMOKE_INJECTION_FAILURE_CODE"
  else
    echo "[EDITOR-GATE] editor_smoke failure injection FAIL run_id=$EDITOR_SMOKE_INJECTION_RUN_ID code=$EDITOR_SMOKE_INJECTION_FAILURE_CODE"
    if [[ "$EDITOR_SMOKE_FAILURE_INJECTION_STRICT" == "1" ]]; then
      GATE_FAIL_RC=2
      GATE_FAIL_REASONS+=("EDITOR_SMOKE_INJECTION:FAIL")
      if [[ -n "$EDITOR_SMOKE_INJECTION_FAILURE_CODE" ]]; then
        GATE_FAIL_REASONS+=("EDITOR_SMOKE_INJECTION_CODE:${EDITOR_SMOKE_INJECTION_FAILURE_CODE}")
      fi
    fi
  fi
fi

CAD_RUN_ID=""
CAD_RUN_DIR=""
cad_rc=0
CAD_ATTEMPT_USED=0
if [[ "$RUN_STEP166_GATE" == "1" ]]; then
  echo "[EDITOR-GATE] 3) STEP166 CAD regression (gate)"
  CAD_OUT="$(mktemp -t cad_reg.XXXXXX)"
  trap 'rm -f "$SMOKE_OUT" "$CAD_OUT"' EXIT

  CAD_ARGS=(--mode gate)
  if [[ -f "$BASELINE" ]]; then
    CAD_ARGS+=(--baseline "$BASELINE")
  else
    echo "[EDITOR-GATE] WARN: baseline missing; running without --baseline"
  fi

  for attempt in $(seq 1 "$CAD_ATTEMPTS"); do
    CAD_ATTEMPT_USED="$attempt"
    echo "[EDITOR-GATE] step166 attempt=$attempt port_base=$CAD_PORT_BASE"
    : >"$CAD_OUT"
    set +e
    ./scripts/cad_regression_run.py "${CAD_ARGS[@]}" --port-base "$CAD_PORT_BASE" --outdir "$CAD_OUTDIR" --plugin "$CAD_PLUGIN" | tee "$CAD_OUT"
    cad_rc=${PIPESTATUS[0]}
    set -e

    CAD_RUN_ID="$(grep -Eo '^run_id=[0-9_]{15}' "$CAD_OUT" | head -n 1 | cut -d= -f2 || true)"
    CAD_RUN_DIR="$(grep -Eo '^run_dir=.*' "$CAD_OUT" | head -n 1 | cut -d= -f2- || true)"

    if [[ "$cad_rc" -eq 0 ]]; then
      break
    fi

    # Gate failures can include transient infra issues (http.server bind failure etc). Retry those.
    if [[ "$cad_rc" -eq 2 && -n "$CAD_RUN_DIR" && -f "$CAD_RUN_DIR/failures.json" ]]; then
      set +e
      python3 - <<PY
import json, sys
path = "$CAD_RUN_DIR/failures.json"
data = json.load(open(path, "r", encoding="utf-8"))
failures = data.get("failures") or []
unexpected = [f for f in failures if f.get("expected") is not True]
if not unexpected:
  sys.exit(1)
for f in unexpected:
  if f.get("bucket") != "RENDER_DRIFT":
    sys.exit(1)
  detail = str(f.get("detail") or "")
  if "HTTP server failed to start" not in detail:
    sys.exit(1)
sys.exit(0)
PY
      infra_retry=$?
      set -e
      if [[ "$infra_retry" -eq 0 ]]; then
        CAD_PORT_BASE=$((20000 + RANDOM % 20000))
        continue
      fi
    fi

    exit "$cad_rc"
  done

  if [[ "$cad_rc" -ne 0 ]]; then
    exit "$cad_rc"
  fi
else
  echo "[EDITOR-GATE] 3) STEP166 CAD regression skipped (RUN_STEP166_GATE=0)"
fi

echo "[EDITOR-GATE] 4) Synthetic perf trend (${PERF_TREND_DAYS}d, policy=$PERF_TREND_POLICY gate_override=$RUN_PERF_TREND_GATE)"
set +e
python3 tools/editor_perf_trend.py \
  --mode observe \
  --days "$PERF_TREND_DAYS" \
  --out-json "$PERF_TREND_JSON" \
  --out-md "$PERF_TREND_MD"
perf_rc=$?
set -e
if [[ "$perf_rc" -ne 0 ]]; then
  echo "[EDITOR-GATE] WARN perf trend tool rc=$perf_rc (continuing)"
fi

PERF_TREND_EFFECTIVE_MODE="observe"
PERF_TREND_STATUS=""
PERF_TREND_COVERAGE_DAYS="0.00"
PERF_TREND_SELECTED="0"
PERF_TREND_SELECTION_MODE=""
PERF_TREND_AUTO_MODE="observe"
if [[ -f "$PERF_TREND_JSON" ]]; then
  # Always parse trend payload (even in observe), so policy can decide if gate is enabled.
  eval "$(
    python3 - "$PERF_TREND_JSON" "$PERF_TREND_DAYS" "$PERF_TREND_MIN_SELECTED" <<'PY'
import json
import sys

path = sys.argv[1]
days = int(sys.argv[2])
min_selected = int(sys.argv[3])
try:
  payload = json.load(open(path, "r", encoding="utf-8"))
except Exception:
  payload = {}

status = str(payload.get("status") or "")
coverage = payload.get("coverage_days")
try:
  coverage_f = float(coverage) if coverage is not None else 0.0
except Exception:
  coverage_f = 0.0
selected = payload.get("selected_samples_in_window")
try:
  selected_i = int(selected) if selected is not None else 0
except Exception:
  selected_i = 0
selection_mode = str(payload.get("selection_mode") or payload.get("selection") or "")

auto_mode = "observe"
# Only auto-enable perf gate when sampling is stable (batch median) and window is sufficiently covered.
if (
  status not in ("", "no_data")
  and selection_mode == "batch_only"
  and coverage_f >= float(days)
  and selected_i >= int(min_selected)
):
  auto_mode = "gate"

def shell_escape(text: str) -> str:
  return text.replace("\\\\", "\\\\\\\\").replace('"', '\\"')

print(f'PERF_TREND_STATUS=\"{shell_escape(status)}\"')
print(f'PERF_TREND_COVERAGE_DAYS=\"{coverage_f:.2f}\"')
print(f'PERF_TREND_SELECTED=\"{selected_i}\"')
print(f'PERF_TREND_SELECTION_MODE=\"{shell_escape(selection_mode)}\"')
print(f'PERF_TREND_AUTO_MODE=\"{auto_mode}\"')
PY
  )"
fi

if [[ "$RUN_PERF_TREND_GATE" == "1" ]]; then
  PERF_TREND_EFFECTIVE_MODE="gate"
else
  case "$PERF_TREND_POLICY" in
    gate) PERF_TREND_EFFECTIVE_MODE="gate";;
    observe) PERF_TREND_EFFECTIVE_MODE="observe";;
    auto|*) PERF_TREND_EFFECTIVE_MODE="$PERF_TREND_AUTO_MODE";;
  esac
fi

echo "[EDITOR-GATE] perf_trend effective_mode=$PERF_TREND_EFFECTIVE_MODE status=$PERF_TREND_STATUS coverage_days=$PERF_TREND_COVERAGE_DAYS selected=$PERF_TREND_SELECTED selection_mode=$PERF_TREND_SELECTION_MODE"
if [[ "$PERF_TREND_EFFECTIVE_MODE" == "gate" && ( "$PERF_TREND_STATUS" == "watch" || "$PERF_TREND_STATUS" == "unstable" ) ]]; then
  echo "[EDITOR-GATE] perf trend gate failed (status=$PERF_TREND_STATUS)"
  GATE_FAIL_RC=2
  GATE_FAIL_REASONS+=("PERF_TREND:${PERF_TREND_STATUS}")
fi

echo "[EDITOR-GATE] 5) Real scene perf trend (${REAL_SCENE_TREND_DAYS}d, policy=$REAL_SCENE_TREND_POLICY gate_override=$RUN_REAL_SCENE_TREND_GATE)"
set +e
python3 tools/editor_real_scene_perf_trend.py \
  --mode observe \
  --profile "$REAL_SCENE_PROFILE" \
  --days "$REAL_SCENE_TREND_DAYS" \
  --out-json "$REAL_SCENE_TREND_JSON" \
  --out-md "$REAL_SCENE_TREND_MD"
scene_rc=$?
set -e
if [[ "$scene_rc" -ne 0 ]]; then
  echo "[EDITOR-GATE] WARN real scene trend tool rc=$scene_rc (continuing)"
fi

REAL_SCENE_TREND_EFFECTIVE_MODE="observe"
REAL_SCENE_TREND_STATUS=""
REAL_SCENE_TREND_COVERAGE_DAYS="0.00"
REAL_SCENE_TREND_SELECTED="0"
REAL_SCENE_TREND_SELECTION_MODE=""
REAL_SCENE_TREND_AUTO_MODE="observe"
if [[ -f "$REAL_SCENE_TREND_JSON" ]]; then
  # Always parse trend payload (even in observe), so policy can decide if gate is enabled.
  eval "$(
    python3 - "$REAL_SCENE_TREND_JSON" "$REAL_SCENE_TREND_DAYS" "$REAL_SCENE_TREND_MIN_SELECTED" <<'PY'
import json
import sys

path = sys.argv[1]
days = int(sys.argv[2])
min_selected = int(sys.argv[3])
try:
  payload = json.load(open(path, "r", encoding="utf-8"))
except Exception:
  payload = {}

status = str(payload.get("status") or "")
coverage = payload.get("coverage_days")
try:
  coverage_f = float(coverage) if coverage is not None else 0.0
except Exception:
  coverage_f = 0.0
selected = payload.get("selected_samples_in_window")
try:
  selected_i = int(selected) if selected is not None else 0
except Exception:
  selected_i = 0
selection_mode = str(payload.get("selection_mode") or payload.get("selection") or "")

auto_mode = "observe"
if (
  status not in ("", "no_data")
  and selection_mode == "batch_only"
  and coverage_f >= float(days)
  and selected_i >= int(min_selected)
):
  auto_mode = "gate"

def shell_escape(text: str) -> str:
  return text.replace("\\\\", "\\\\\\\\").replace('"', '\\"')

print(f'REAL_SCENE_TREND_STATUS=\"{shell_escape(status)}\"')
print(f'REAL_SCENE_TREND_COVERAGE_DAYS=\"{coverage_f:.2f}\"')
print(f'REAL_SCENE_TREND_SELECTED=\"{selected_i}\"')
print(f'REAL_SCENE_TREND_SELECTION_MODE=\"{shell_escape(selection_mode)}\"')
print(f'REAL_SCENE_TREND_AUTO_MODE=\"{auto_mode}\"')
PY
  )"
fi

if [[ "$RUN_REAL_SCENE_TREND_GATE" == "1" ]]; then
  REAL_SCENE_TREND_EFFECTIVE_MODE="gate"
else
  case "$REAL_SCENE_TREND_POLICY" in
    gate) REAL_SCENE_TREND_EFFECTIVE_MODE="gate";;
    observe) REAL_SCENE_TREND_EFFECTIVE_MODE="observe";;
    auto|*) REAL_SCENE_TREND_EFFECTIVE_MODE="$REAL_SCENE_TREND_AUTO_MODE";;
  esac
fi
echo "[EDITOR-GATE] real_scene_trend effective_mode=$REAL_SCENE_TREND_EFFECTIVE_MODE status=$REAL_SCENE_TREND_STATUS coverage_days=$REAL_SCENE_TREND_COVERAGE_DAYS selected=$REAL_SCENE_TREND_SELECTED selection_mode=$REAL_SCENE_TREND_SELECTION_MODE"
if [[ "$REAL_SCENE_TREND_EFFECTIVE_MODE" == "gate" && ( "$REAL_SCENE_TREND_STATUS" == "watch" || "$REAL_SCENE_TREND_STATUS" == "unstable" ) ]]; then
  echo "[EDITOR-GATE] real scene trend gate failed (status=$REAL_SCENE_TREND_STATUS)"
  GATE_FAIL_RC=2
  GATE_FAIL_REASONS+=("REAL_SCENE_TREND:${REAL_SCENE_TREND_STATUS}")
fi

EDITOR_SUMMARY_PATH=""
if [[ -n "$EDITOR_SMOKE_SUMMARY_FROM_OUT" && -f "$EDITOR_SMOKE_SUMMARY_FROM_OUT" ]]; then
  EDITOR_SUMMARY_PATH="$EDITOR_SMOKE_SUMMARY_FROM_OUT"
fi
if [[ -n "$EDITOR_SMOKE_RUN_ID" ]]; then
  candidate="$EDITOR_OUTDIR/$EDITOR_SMOKE_RUN_ID/summary.json"
  if [[ -z "$EDITOR_SUMMARY_PATH" && -f "$candidate" ]]; then
    EDITOR_SUMMARY_PATH="$candidate"
  fi
fi

STEP166_SUMMARY_PATH=""
if [[ -n "$CAD_RUN_ID" ]]; then
  candidate="$CAD_OUTDIR/$CAD_RUN_ID/summary.json"
  if [[ -f "$candidate" ]]; then
    STEP166_SUMMARY_PATH="$candidate"
  fi
fi

export BASELINE EDITOR_SMOKE_LIMIT EDITOR_SMOKE_CASES EDITOR_OUTDIR EDITOR_PLUGIN EDITOR_SMOKE_NO_CONVERT CAD_PORT_BASE CAD_ATTEMPTS CAD_OUTDIR CAD_PLUGIN RUN_STEP166_GATE
export RUN_EDITOR_UI_FLOW_SMOKE RUN_EDITOR_UI_FLOW_SMOKE_GATE EDITOR_UI_FLOW_PORT EDITOR_UI_FLOW_VIEWPORT EDITOR_UI_FLOW_TIMEOUT_MS EDITOR_UI_FLOW_OUTDIR EDITOR_UI_FLOW_HEADED EDITOR_UI_FLOW_SMOKE_GATE_RUNS
export UI_FLOW_MODE UI_FLOW_RUN_ID UI_FLOW_SUMMARY_PATH UI_FLOW_OK UI_FLOW_RC UI_FLOW_GATE_RUNS_TARGET UI_FLOW_GATE_RUN_COUNT UI_FLOW_GATE_PASS_COUNT UI_FLOW_GATE_FAIL_COUNT UI_FLOW_RUN_SUMMARIES
export RUN_UI_FLOW_FAILURE_INJECTION_GATE UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS UI_FLOW_FAILURE_INJECTION_STRICT
export UI_FLOW_INJECTION_STATUS UI_FLOW_INJECTION_RUN_ID UI_FLOW_INJECTION_SUMMARY_PATH UI_FLOW_INJECTION_RC UI_FLOW_INJECTION_FAILURE_CODE UI_FLOW_INJECTION_FAILURE_DETAIL
export RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE EDITOR_SMOKE_FAILURE_INJECTION_STRICT EDITOR_SMOKE_FAILURE_INJECTION_LIMIT EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN
export EDITOR_SMOKE_INJECTION_STATUS EDITOR_SMOKE_INJECTION_RUN_ID EDITOR_SMOKE_INJECTION_SUMMARY_PATH EDITOR_SMOKE_INJECTION_RC EDITOR_SMOKE_INJECTION_FAILURE_CODE EDITOR_SMOKE_INJECTION_FAILURE_DETAIL
export EDITOR_SMOKE_RUN_ID CAD_RUN_ID CAD_RUN_DIR CAD_ATTEMPT_USED
export EDITOR_SUMMARY_PATH STEP166_SUMMARY_PATH SUMMARY_PATH HISTORY_DIR
export RUN_PERF_TREND_GATE PERF_TREND_DAYS PERF_TREND_JSON PERF_TREND_MD PERF_TREND_POLICY PERF_TREND_MIN_SELECTED PERF_TREND_EFFECTIVE_MODE
export RUN_REAL_SCENE_TREND_GATE REAL_SCENE_PROFILE REAL_SCENE_TREND_DAYS REAL_SCENE_TREND_JSON REAL_SCENE_TREND_MD REAL_SCENE_TREND_POLICY REAL_SCENE_TREND_MIN_SELECTED REAL_SCENE_TREND_EFFECTIVE_MODE
export GATE_FAIL_RC
export GATE_FAIL_REASONS_STR
GATE_FAIL_REASONS_STR="$(IFS=';'; echo "${GATE_FAIL_REASONS[*]-}")"
python3 - <<PY
import json, os, time

def load_json(path):
  if not path:
    return {}
  try:
    with open(path, "r", encoding="utf-8") as f:
      return json.load(f)
  except Exception:
    return {}

def pick(dct, key, default=None):
  if isinstance(dct, dict):
    return dct.get(key, default)
  return default

def split_paths(text):
  if not text:
    return []
  return [item for item in str(text).split("|") if item]

def first_nonempty(values):
  for value in values:
    text = str(value or "").strip()
    if text:
      return text
  return ""

def classify_ui_flow_run(run_payload):
  if not isinstance(run_payload, dict):
    return ("UI_FLOW_SUMMARY_INVALID", "summary payload invalid")
  if run_payload.get("ok") is True:
    return ("", "")

  flow = run_payload.get("flow")
  tails = run_payload.get("error_tail") if isinstance(run_payload.get("error_tail"), list) else []
  status = str(run_payload.get("flow_status") or "").strip()
  step = str(run_payload.get("flow_step") or "").strip()
  detail = first_nonempty([status] + tails)
  detail_l = detail.lower()

  if not isinstance(flow, dict):
    if "timeout" in detail_l or "timed out" in detail_l:
      return ("UI_FLOW_TIMEOUT", detail or "timeout")
    return ("UI_FLOW_FLOW_JSON_INVALID", detail or "flow payload missing")

  err = flow.get("__error")
  if isinstance(err, dict):
    message = str(err.get("message") or "").strip()
    message_l = message.lower()
    if "timeout" in message_l or "timed out" in message_l:
      return ("UI_FLOW_TIMEOUT", message or detail or "timeout")
    return ("UI_FLOW_ASSERT_FAIL", message or detail or "flow error")

  if "timeout" in detail_l or "timed out" in detail_l:
    return ("UI_FLOW_TIMEOUT", detail)
  if not step and not status:
    return ("UI_FLOW_FLOW_JSON_INVALID", detail or "missing flow step and status")
  return ("UI_FLOW_UNKNOWN_FAIL", detail or "unknown ui flow failure")

def classify_editor_smoke_case(case_payload, failure_codes):
  codes = {str(code or "").strip() for code in (failure_codes or []) if str(code or "").strip()}
  if "DISCOVERY_EMPTY" in codes or "INPUT_MISSING" in codes or "NOT_CADGF" in codes:
    return "INPUT_INVALID"
  if "ROUNDTRIP_DRIFT" in codes:
    return "RENDER_DRIFT"
  return "IMPORT_FAIL"

def analyze_editor_smoke(summary_payload):
  totals_raw = summary_payload.get("totals") if isinstance(summary_payload.get("totals"), dict) else {}
  totals = {
    "pass": int(totals_raw.get("pass", 0) or 0),
    "fail": int(totals_raw.get("fail", 0) or 0),
    "skipped": int(totals_raw.get("skipped", 0) or 0),
  }
  status = "UNKNOWN"
  if summary_payload:
    status = "FAIL" if totals["fail"] > 0 else "PASS"
  bucket_raw = summary_payload.get("failure_buckets") if isinstance(summary_payload.get("failure_buckets"), dict) else {}
  buckets = {
    "INPUT_INVALID": int(bucket_raw.get("INPUT_INVALID", 0) or 0),
    "IMPORT_FAIL": int(bucket_raw.get("IMPORT_FAIL", 0) or 0),
    "VIEWPORT_LAYOUT_MISSING": int(bucket_raw.get("VIEWPORT_LAYOUT_MISSING", 0) or 0),
    "RENDER_DRIFT": int(bucket_raw.get("RENDER_DRIFT", 0) or 0),
    "TEXT_METRIC_DRIFT": int(bucket_raw.get("TEXT_METRIC_DRIFT", 0) or 0),
  }
  use_result_buckets = not bool(bucket_raw)
  failure_code_counts = {}
  first_failure_code = ""
  failed_cases = []
  results = summary_payload.get("results")
  if isinstance(results, list):
    for one in results:
      if not isinstance(one, dict):
        continue
      if str(one.get("status") or "").upper() != "FAIL":
        continue
      raw_codes = one.get("failure_codes")
      failure_codes = []
      if isinstance(raw_codes, list):
        for code in raw_codes:
          text = str(code or "").strip()
          if not text:
            continue
          failure_codes.append(text)
          failure_code_counts[text] = int(failure_code_counts.get(text, 0)) + 1
          if not first_failure_code:
            first_failure_code = text
      bucket = classify_editor_smoke_case(one, failure_codes)
      if use_result_buckets:
        buckets[bucket] = int(buckets.get(bucket, 0)) + 1
      failed_cases.append({
        "name": str(one.get("name") or ""),
        "bucket": bucket,
        "failure_codes": failure_codes,
      })
  return {
    "status": status,
    "totals": totals,
    "failure_buckets": buckets,
    "failure_code_counts": failure_code_counts,
    "first_failure_code": first_failure_code,
    "failed_cases": failed_cases,
    "summary_loaded": bool(summary_payload),
  }

editor_summary_path = os.environ.get("EDITOR_SUMMARY_PATH", "")
step166_summary_path = os.environ.get("STEP166_SUMMARY_PATH", "")
editor_summary = load_json(editor_summary_path)
editor_analysis = analyze_editor_smoke(editor_summary)
step166_summary = load_json(step166_summary_path)
ui_flow_summary_path = os.environ.get("UI_FLOW_SUMMARY_PATH", "")
ui_flow_summary = load_json(ui_flow_summary_path)
ui_flow_step = ui_flow_summary.get("flow_step", "")
ui_flow_selection = ui_flow_summary.get("flow_selection", "")
ui_flow_status = ui_flow_summary.get("flow_status", "")
ui_flow_runs_target = int(os.environ.get("UI_FLOW_GATE_RUNS_TARGET", "0") or 0)
ui_flow_run_count = int(os.environ.get("UI_FLOW_GATE_RUN_COUNT", "0") or 0)
ui_flow_pass_count = int(os.environ.get("UI_FLOW_GATE_PASS_COUNT", "0") or 0)
ui_flow_fail_count = int(os.environ.get("UI_FLOW_GATE_FAIL_COUNT", "0") or 0)
ui_flow_run_summaries = split_paths(os.environ.get("UI_FLOW_RUN_SUMMARIES", ""))
ui_flow_runs = []
ui_flow_failure_code_counts = {}
ui_flow_first_failure_code = ""
for path in ui_flow_run_summaries:
  run_payload = load_json(path)
  failure_code, failure_detail = classify_ui_flow_run(run_payload)
  if failure_code:
    ui_flow_failure_code_counts[failure_code] = int(ui_flow_failure_code_counts.get(failure_code, 0)) + 1
    if not ui_flow_first_failure_code:
      ui_flow_first_failure_code = failure_code
  failure_detail = str(failure_detail or "")
  if len(failure_detail) > 400:
    failure_detail = failure_detail[:400] + "..."
  ui_flow_runs.append({
    "summary_json": path,
    "run_id": run_payload.get("run_id", ""),
    "ok": run_payload.get("ok") is True,
    "exit_code": int(run_payload.get("exit_code", 0) or 0),
    "flow_step": run_payload.get("flow_step", ""),
    "flow_selection": run_payload.get("flow_selection", ""),
    "flow_status": run_payload.get("flow_status", ""),
    "failure_code": failure_code,
    "failure_detail": failure_detail,
    "error_tail": run_payload.get("error_tail") if isinstance(run_payload.get("error_tail"), list) else [],
  })
ui_flow_enabled = os.environ.get("UI_FLOW_MODE", "skipped") != "skipped"
if ui_flow_enabled and ui_flow_runs_target <= 0:
  ui_flow_runs_target = 1
if ui_flow_enabled and ui_flow_run_count <= 0:
  ui_flow_run_count = 1
if ui_flow_enabled and ui_flow_pass_count == 0 and ui_flow_fail_count == 0:
  if ui_flow_summary.get("ok") is True:
    ui_flow_pass_count = 1
  else:
    ui_flow_fail_count = 1
ui_flow_overall_ok = (ui_flow_fail_count == 0 and ui_flow_run_count >= ui_flow_runs_target) if ui_flow_enabled else False
perf_trend_path = os.environ.get("PERF_TREND_JSON", "")
perf_trend = load_json(perf_trend_path)
perf_trend_status = str(perf_trend.get("status") or "")
perf_trend_effective_mode = os.environ.get("PERF_TREND_EFFECTIVE_MODE", "observe")
real_scene_trend_path = os.environ.get("REAL_SCENE_TREND_JSON", "")
real_scene_trend = load_json(real_scene_trend_path)
real_scene_trend_status = str(real_scene_trend.get("status") or "")
real_scene_trend_effective_mode = os.environ.get("REAL_SCENE_TREND_EFFECTIVE_MODE", "observe")

payload = {
  "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "gate_decision": {
    "exit_code": int(os.environ.get("GATE_FAIL_RC", "0") or 0),
    "would_fail": (os.environ.get("GATE_FAIL_RC", "0") or "0") != "0",
    "fail_reasons": [x for x in str(os.environ.get("GATE_FAIL_REASONS_STR", "") or "").split(";") if x],
  },
  "baseline": os.environ.get("BASELINE", "$BASELINE"),
  "cad_attempts": {
    "max": int(os.environ.get("CAD_ATTEMPTS", "$CAD_ATTEMPTS") or 0),
    "used": int(os.environ.get("CAD_ATTEMPT_USED", "0") or 0),
  },
  "editor_smoke": {
    "run_id": "$EDITOR_SMOKE_RUN_ID",
    "limit": int(os.environ.get("EDITOR_SMOKE_LIMIT", "$EDITOR_SMOKE_LIMIT") or 0),
    "cases": os.environ.get("EDITOR_SMOKE_CASES", "$EDITOR_SMOKE_CASES"),
    "convert_enabled": os.environ.get("EDITOR_SMOKE_NO_CONVERT", "0") != "1",
    "summary_json": editor_summary_path,
    "status": editor_analysis.get("status", "UNKNOWN"),
    "summary_loaded": editor_analysis.get("summary_loaded", False),
    "totals": editor_analysis.get("totals", {}),
    "failure_buckets": editor_analysis.get("failure_buckets", {}),
    "failure_code_counts": editor_analysis.get("failure_code_counts", {}),
    "first_failure_code": editor_analysis.get("first_failure_code", ""),
    "failed_cases": editor_analysis.get("failed_cases", []),
    "gate_decision": pick(editor_summary, "gate_decision", {}),
  },
  "ui_flow_smoke": {
    "enabled": ui_flow_enabled,
    "mode": os.environ.get("UI_FLOW_MODE", "skipped"),
    "run_id": os.environ.get("UI_FLOW_RUN_ID", ""),
    "summary_json": ui_flow_summary_path,
    "ok": ui_flow_overall_ok,
    "exit_code": int(os.environ.get("UI_FLOW_RC", "0") or 0),
    "gate_runs_target": ui_flow_runs_target,
    "gate_run_count": ui_flow_run_count,
    "gate_pass_count": ui_flow_pass_count,
    "gate_fail_count": ui_flow_fail_count,
    "failure_code_counts": ui_flow_failure_code_counts,
    "first_failure_code": ui_flow_first_failure_code,
    "run_summaries": ui_flow_run_summaries,
    "runs": ui_flow_runs,
    "screenshot": ui_flow_summary.get("screenshot", ""),
    "playwright_log": ui_flow_summary.get("playwright_log", ""),
    "flow_result": ui_flow_summary.get("flow_result", ""),
    "console_log": ui_flow_summary.get("console_log", ""),
    "flow": ui_flow_summary.get("flow", {}),
    "triage": {
      "step": ui_flow_step,
      "selection": ui_flow_selection,
      "status": ui_flow_status,
    },
  },
  "ui_flow_failure_injection": {
    "enabled": os.environ.get("RUN_UI_FLOW_FAILURE_INJECTION_GATE", "0") == "1",
    "status": os.environ.get("UI_FLOW_INJECTION_STATUS", "SKIPPED"),
    "run_id": os.environ.get("UI_FLOW_INJECTION_RUN_ID", ""),
    "summary_json": os.environ.get("UI_FLOW_INJECTION_SUMMARY_PATH", ""),
    "exit_code": int(os.environ.get("UI_FLOW_INJECTION_RC", "0") or 0),
    "failure_code": os.environ.get("UI_FLOW_INJECTION_FAILURE_CODE", ""),
    "failure_detail": os.environ.get("UI_FLOW_INJECTION_FAILURE_DETAIL", ""),
  },
  "editor_smoke_failure_injection": {
    "enabled": os.environ.get("RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE", "0") == "1",
    "status": os.environ.get("EDITOR_SMOKE_INJECTION_STATUS", "SKIPPED"),
    "run_id": os.environ.get("EDITOR_SMOKE_INJECTION_RUN_ID", ""),
    "summary_json": os.environ.get("EDITOR_SMOKE_INJECTION_SUMMARY_PATH", ""),
    "exit_code": int(os.environ.get("EDITOR_SMOKE_INJECTION_RC", "0") or 0),
    "failure_code": os.environ.get("EDITOR_SMOKE_INJECTION_FAILURE_CODE", ""),
    "failure_detail": os.environ.get("EDITOR_SMOKE_INJECTION_FAILURE_DETAIL", ""),
  },
  "step166": {
    "enabled": os.environ.get("RUN_STEP166_GATE", "1") == "1",
    "run_id": "$CAD_RUN_ID",
    "port_base": int(os.environ.get("CAD_PORT_BASE", "$CAD_PORT_BASE") or 0),
    "run_dir": os.environ.get("CAD_RUN_DIR", "$CAD_RUN_DIR"),
    "summary_json": step166_summary_path,
    "totals": pick(step166_summary, "totals", {}),
    "failure_buckets": pick(step166_summary, "failure_buckets", {}),
    "gate_decision": pick(step166_summary, "gate_decision", {}),
    "baseline_compare": pick(step166_summary, "baseline_compare", {}),
  },
  "perf_trend": {
    "enabled": perf_trend_effective_mode == "gate",
    "mode": perf_trend_effective_mode,
    "policy": os.environ.get("PERF_TREND_POLICY", "auto"),
    "min_selected": int(os.environ.get("PERF_TREND_MIN_SELECTED", "5") or 5),
    "days": int(os.environ.get("PERF_TREND_DAYS", "14") or 14),
    "summary_json": perf_trend_path,
    "summary_md": os.environ.get("PERF_TREND_MD", "$PERF_TREND_MD"),
    "status": perf_trend_status,
    "coverage_days": perf_trend.get("coverage_days"),
    "selected_samples_in_window": perf_trend.get("selected_samples_in_window"),
    "selection_mode": perf_trend.get("selection_mode") or perf_trend.get("selection") or "",
    "warnings": perf_trend.get("warnings") if isinstance(perf_trend.get("warnings"), list) else [],
    "critical_warnings": perf_trend.get("critical_warnings") if isinstance(perf_trend.get("critical_warnings"), list) else [],
  },
  "real_scene_trend": {
    "enabled": real_scene_trend_effective_mode == "gate",
    "mode": real_scene_trend_effective_mode,
    "policy": os.environ.get("REAL_SCENE_TREND_POLICY", "auto"),
    "min_selected": int(os.environ.get("REAL_SCENE_TREND_MIN_SELECTED", "5") or 5),
    "profile": os.environ.get("REAL_SCENE_PROFILE", "$REAL_SCENE_PROFILE"),
    "days": int(os.environ.get("REAL_SCENE_TREND_DAYS", "14") or 14),
    "summary_json": real_scene_trend_path,
    "summary_md": os.environ.get("REAL_SCENE_TREND_MD", "$REAL_SCENE_TREND_MD"),
    "status": real_scene_trend_status,
    "coverage_days": real_scene_trend.get("coverage_days"),
    "selected_samples_in_window": real_scene_trend.get("selected_samples_in_window"),
    "selection_mode": real_scene_trend.get("selection_mode") or real_scene_trend.get("selection"),
    "warnings": real_scene_trend.get("warnings") if isinstance(real_scene_trend.get("warnings"), list) else [],
    "critical_warnings": real_scene_trend.get("critical_warnings") if isinstance(real_scene_trend.get("critical_warnings"), list) else [],
  },
}

out = "$SUMMARY_PATH"
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
  f.write("\\n")
print(f"[EDITOR-GATE] wrote {out}")

history_dir = os.environ.get("HISTORY_DIR", "$HISTORY_DIR")
os.makedirs(history_dir, exist_ok=True)
history_name = "gate_{ts}_{er}_{cr}.json".format(
  ts=time.strftime("%Y%m%d_%H%M%S", time.gmtime()),
  er=(payload.get("editor_smoke", {}).get("run_id") or "no_editor"),
  cr=(payload.get("step166", {}).get("run_id") or "no_cad"),
)
history_path = os.path.join(history_dir, history_name)
with open(history_path, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
  f.write("\\n")
print(f"[EDITOR-GATE] wrote {history_path}")
PY

if [[ "$EDITOR_GATE_APPEND_REPORT" == "1" ]]; then
  python3 tools/write_editor_gate_report.py \
    --gate-summary "$SUMMARY_PATH" \
    --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
fi

if [[ "$STEP176_APPEND_REPORT" == "1" ]]; then
  python3 tools/write_step176_gate_report.py --gate-summary "$SUMMARY_PATH" --report "$STEP176_REPORT"
fi

echo "[EDITOR-GATE] DONE"
echo "[EDITOR-GATE] editor_smoke_run_id=$EDITOR_SMOKE_RUN_ID"
echo "[EDITOR-GATE] step166_run_id=$CAD_RUN_ID"
echo "[EDITOR-GATE] summary=$SUMMARY_PATH"

exit "$GATE_FAIL_RC"
