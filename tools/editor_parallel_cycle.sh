#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_LANE_A="${RUN_LANE_A:-1}"
RUN_LANE_B="${RUN_LANE_B:-1}"
RUN_LANE_C="${RUN_LANE_C:-1}"
PARALLEL_WATCH_POLICY="${PARALLEL_WATCH_POLICY:-observe}" # observe|gate

LANE_A_PROFILE="${LANE_A_PROFILE:-lite}"
LANE_A_LIMIT="${LANE_A_LIMIT:-8}"
LANE_A_RUN_STEP166="${LANE_A_RUN_STEP166:-0}"
LANE_A_RUN_UI_FLOW="${LANE_A_RUN_UI_FLOW:-0}"
LANE_A_RUN_PERF_TREND="${LANE_A_RUN_PERF_TREND:-0}"
LANE_A_RUN_REAL_SCENE_TREND="${LANE_A_RUN_REAL_SCENE_TREND:-0}"
LANE_A_GATE_SUMMARY="${LANE_A_GATE_SUMMARY:-}"
LANE_A_GATE_SUMMARY_MD="${LANE_A_GATE_SUMMARY_MD:-}"

LANE_B_RUN_UI_FLOW="${LANE_B_RUN_UI_FLOW:-1}"
LANE_B_UI_FLOW_MODE="${LANE_B_UI_FLOW_MODE:-gate}"
LANE_B_UI_FLOW_TIMEOUT_MS="${LANE_B_UI_FLOW_TIMEOUT_MS:-}"
LANE_B_UI_FLOW_OPEN_RETRIES="${LANE_B_UI_FLOW_OPEN_RETRIES:-}"

LANE_C_WINDOWS="${LANE_C_WINDOWS:-7,14}"
LANE_C_DAYS="${LANE_C_DAYS:-7}"
LANE_C_HISTORY_DIR="${LANE_C_HISTORY_DIR:-build/editor_gate_history}"

RUN_ID="$(python3 - <<'PY'
from datetime import datetime
print(datetime.now().strftime("%Y%m%d_%H%M%S"))
PY
)"

OUT_DIR="${OUT_DIR:-build/editor_parallel_cycle/${RUN_ID}}"
SUMMARY_JSON="${SUMMARY_JSON:-${OUT_DIR}/summary.json}"
SUMMARY_MD="${SUMMARY_MD:-${OUT_DIR}/summary.md}"
mkdir -p "$OUT_DIR"

LANE_A_LOG="$OUT_DIR/lane_a_editor_gate.log"
LANE_B_TEST_LOG="$OUT_DIR/lane_b_node_tests.log"
LANE_B_UI_LOG="$OUT_DIR/lane_b_ui_flow.log"
LANE_C_CASE_LOG="$OUT_DIR/lane_c_case_selection_trend.log"
LANE_C_GATE_LOG="$OUT_DIR/lane_c_gate_trend.log"

LANE_A_STATUS="skipped"
LANE_A_RC=0
LANE_A_SUMMARY_JSON=""
LANE_A_SUMMARY_MD=""

LANE_B_STATUS="skipped"
LANE_B_RC=0
LANE_B_UI_STATUS="skipped"
LANE_B_UI_RC=0
LANE_B_UI_SUMMARY=""

LANE_C_STATUS="skipped"
LANE_C_RC=0
LANE_C_CASE_JSON="$OUT_DIR/editor_case_selection_trend.json"
LANE_C_CASE_MD="$OUT_DIR/editor_case_selection_trend.md"
LANE_C_GATE_JSON="$OUT_DIR/editor_gate_trend.json"
LANE_C_GATE_MD="$OUT_DIR/editor_gate_trend.md"

OVERALL_STATUS="pass"
OVERALL_RC=0

CYCLE_START_EPOCH="$(date +%s)"
CYCLE_DURATION_SEC=0
LANE_A_DURATION_SEC=0
LANE_B_DURATION_SEC=0
LANE_B_NODE_TEST_DURATION_SEC=0
LANE_B_UI_FLOW_DURATION_SEC=0
LANE_C_DURATION_SEC=0
LANE_C_CASE_SELECTION_DURATION_SEC=0
LANE_C_GATE_TREND_DURATION_SEC=0

case "$PARALLEL_WATCH_POLICY" in
  observe|gate) ;;
  *)
    echo "[PARALLEL-CYCLE] WARN invalid PARALLEL_WATCH_POLICY=$PARALLEL_WATCH_POLICY, fallback to observe"
    PARALLEL_WATCH_POLICY="observe"
    ;;
esac
if [[ -n "$LANE_B_UI_FLOW_TIMEOUT_MS" ]]; then
  if ! [[ "$LANE_B_UI_FLOW_TIMEOUT_MS" =~ ^[0-9]+$ ]] || [[ "$LANE_B_UI_FLOW_TIMEOUT_MS" -le 0 ]]; then
    echo "[PARALLEL-CYCLE] WARN invalid LANE_B_UI_FLOW_TIMEOUT_MS=$LANE_B_UI_FLOW_TIMEOUT_MS, ignore"
    LANE_B_UI_FLOW_TIMEOUT_MS=""
  fi
fi
if [[ -n "$LANE_B_UI_FLOW_OPEN_RETRIES" ]]; then
  if ! [[ "$LANE_B_UI_FLOW_OPEN_RETRIES" =~ ^[0-9]+$ ]] || [[ "$LANE_B_UI_FLOW_OPEN_RETRIES" -le 0 ]]; then
    echo "[PARALLEL-CYCLE] WARN invalid LANE_B_UI_FLOW_OPEN_RETRIES=$LANE_B_UI_FLOW_OPEN_RETRIES, ignore"
    LANE_B_UI_FLOW_OPEN_RETRIES=""
  fi
fi

run_cmd() {
  local log_path="$1"
  shift
  set +e
  "$@" >"$log_path" 2>&1
  local rc=$?
  set -e
  return "$rc"
}

extract_summary_json_from_log() {
  local log_path="$1"
  python3 - "$log_path" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
try:
    text = path.read_text(encoding="utf-8", errors="ignore")
except Exception:
    print("")
    raise SystemExit(0)

def resolve(candidate):
    candidate = str(candidate or "").strip()
    if not candidate:
        return ""
    p = pathlib.Path(candidate)
    if p.is_file():
        return str(p)
    if not p.is_absolute():
        rel = pathlib.Path.cwd() / p
        if rel.is_file():
            return str(rel)
    return ""

m = re.search(r"summary_json=([^\n]+)", text)
if m:
    resolved = resolve(m.group(1))
    if resolved:
        print(resolved)
        raise SystemExit(0)

out = re.search(r"out_dir=([^\n]+)", text)
if out:
    out_dir = str(out.group(1) or "").strip()
    if out_dir:
        summary_path = pathlib.Path(out_dir) / "summary.json"
        resolved = resolve(summary_path)
        if resolved:
            print(resolved)
            raise SystemExit(0)

for line in reversed(text.splitlines()):
    candidate = line.strip()
    if not candidate.endswith(".json"):
        continue
    resolved = resolve(candidate)
    if resolved:
        print(resolved)
        raise SystemExit(0)

print("")
PY
}

if [[ "$RUN_LANE_A" == "1" ]]; then
  lane_a_start="$(date +%s)"
  LANE_A_SUMMARY_JSON="$OUT_DIR/editor_gate_summary.json"
  LANE_A_SUMMARY_MD="$OUT_DIR/editor_gate_summary.md"
  if [[ -n "$LANE_A_GATE_SUMMARY" && -f "$LANE_A_GATE_SUMMARY" ]]; then
    LANE_A_SUMMARY_JSON="$LANE_A_GATE_SUMMARY"
    if [[ -n "$LANE_A_GATE_SUMMARY_MD" ]]; then
      LANE_A_SUMMARY_MD="$LANE_A_GATE_SUMMARY_MD"
    fi
    printf "lane_a_precomputed_summary=%s\n" "$LANE_A_SUMMARY_JSON" >"$LANE_A_LOG"
    LANE_A_STATUS="pass"
  else
    if run_cmd "$LANE_A_LOG" \
      env \
        EDITOR_GATE_PROFILE="$LANE_A_PROFILE" \
        EDITOR_SMOKE_LIMIT="$LANE_A_LIMIT" \
        RUN_STEP166_GATE="$LANE_A_RUN_STEP166" \
        RUN_EDITOR_UI_FLOW_SMOKE_GATE="$LANE_A_RUN_UI_FLOW" \
        RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
        RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
        RUN_PERF_TREND="$LANE_A_RUN_PERF_TREND" \
        RUN_REAL_SCENE_TREND="$LANE_A_RUN_REAL_SCENE_TREND" \
        EDITOR_GATE_APPEND_REPORT=0 \
        STEP176_APPEND_REPORT=0 \
        SUMMARY_PATH="$LANE_A_SUMMARY_JSON" \
        SUMMARY_MD="$LANE_A_SUMMARY_MD" \
        bash tools/editor_gate.sh; then
      LANE_A_STATUS="pass"
    else
      LANE_A_RC=$?
      LANE_A_STATUS="fail"
      OVERALL_STATUS="fail"
      OVERALL_RC=1
    fi
  fi
  lane_a_end="$(date +%s)"
  LANE_A_DURATION_SEC=$((lane_a_end - lane_a_start))
  if [[ "$LANE_A_DURATION_SEC" -le 0 ]]; then
    LANE_A_DURATION_SEC=1
  fi
fi

if [[ "$RUN_LANE_B" == "1" ]]; then
  lane_b_start="$(date +%s)"
  lane_b_node_start="$(date +%s)"
  if run_cmd "$LANE_B_TEST_LOG" node --test tools/web_viewer/tests/editor_commands.test.js; then
    LANE_B_STATUS="pass"
  else
    LANE_B_RC=$?
    LANE_B_STATUS="fail"
    OVERALL_STATUS="fail"
    OVERALL_RC=1
  fi
  lane_b_node_end="$(date +%s)"
  LANE_B_NODE_TEST_DURATION_SEC=$((lane_b_node_end - lane_b_node_start))
  if [[ "$LANE_B_NODE_TEST_DURATION_SEC" -le 0 ]]; then
    LANE_B_NODE_TEST_DURATION_SEC=1
  fi

  if [[ "$LANE_B_RUN_UI_FLOW" == "1" ]]; then
    lane_b_ui_start="$(date +%s)"
    LANE_B_UI_CMD=(bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode "$LANE_B_UI_FLOW_MODE")
    if [[ -n "$LANE_B_UI_FLOW_TIMEOUT_MS" ]]; then
      LANE_B_UI_CMD+=(--timeout-ms "$LANE_B_UI_FLOW_TIMEOUT_MS")
    fi
    if [[ -n "$LANE_B_UI_FLOW_OPEN_RETRIES" ]]; then
      LANE_B_UI_CMD+=(--pwcli-open-retries "$LANE_B_UI_FLOW_OPEN_RETRIES")
    fi
    if run_cmd "$LANE_B_UI_LOG" "${LANE_B_UI_CMD[@]}"; then
      LANE_B_UI_STATUS="pass"
    else
      LANE_B_UI_RC=$?
      LANE_B_UI_STATUS="fail"
      LANE_B_STATUS="fail"
      OVERALL_STATUS="fail"
      OVERALL_RC=1
    fi
    LANE_B_UI_SUMMARY="$(extract_summary_json_from_log "$LANE_B_UI_LOG")"
    lane_b_ui_end="$(date +%s)"
    LANE_B_UI_FLOW_DURATION_SEC=$((lane_b_ui_end - lane_b_ui_start))
    if [[ "$LANE_B_UI_FLOW_DURATION_SEC" -le 0 ]]; then
      LANE_B_UI_FLOW_DURATION_SEC=1
    fi
  fi
  lane_b_end="$(date +%s)"
  LANE_B_DURATION_SEC=$((lane_b_end - lane_b_start))
  if [[ "$LANE_B_DURATION_SEC" -le 0 ]]; then
    LANE_B_DURATION_SEC=1
  fi
fi

if [[ "$RUN_LANE_C" == "1" ]]; then
  lane_c_start="$(date +%s)"
  lane_c_case_start="$(date +%s)"
  if run_cmd "$LANE_C_CASE_LOG" python3 tools/editor_case_selection_trend.py \
    --history-dir "$LANE_C_HISTORY_DIR" \
    --windows "$LANE_C_WINDOWS" \
    --out-json "$LANE_C_CASE_JSON" \
    --out-md "$LANE_C_CASE_MD"; then
    :
  else
    LANE_C_RC=$?
    LANE_C_STATUS="fail"
  fi
  lane_c_case_end="$(date +%s)"
  LANE_C_CASE_SELECTION_DURATION_SEC=$((lane_c_case_end - lane_c_case_start))
  if [[ "$LANE_C_CASE_SELECTION_DURATION_SEC" -le 0 ]]; then
    LANE_C_CASE_SELECTION_DURATION_SEC=1
  fi

  lane_c_gate_start="$(date +%s)"
  if run_cmd "$LANE_C_GATE_LOG" python3 tools/editor_gate_trend.py \
    --history-dir "$LANE_C_HISTORY_DIR" \
    --days "$LANE_C_DAYS" \
    --out-json "$LANE_C_GATE_JSON" \
    --out-md "$LANE_C_GATE_MD"; then
    :
  else
    LANE_C_RC=$?
    LANE_C_STATUS="fail"
  fi
  lane_c_gate_end="$(date +%s)"
  LANE_C_GATE_TREND_DURATION_SEC=$((lane_c_gate_end - lane_c_gate_start))
  if [[ "$LANE_C_GATE_TREND_DURATION_SEC" -le 0 ]]; then
    LANE_C_GATE_TREND_DURATION_SEC=1
  fi

  if [[ "$LANE_C_STATUS" != "fail" ]]; then
    LANE_C_STATUS="pass"
  else
    OVERALL_STATUS="fail"
    OVERALL_RC=1
  fi
  lane_c_end="$(date +%s)"
  LANE_C_DURATION_SEC=$((lane_c_end - lane_c_start))
  if [[ "$LANE_C_DURATION_SEC" -le 0 ]]; then
    LANE_C_DURATION_SEC=1
  fi
fi

CYCLE_END_EPOCH="$(date +%s)"
CYCLE_DURATION_SEC=$((CYCLE_END_EPOCH - CYCLE_START_EPOCH))
if [[ "$CYCLE_DURATION_SEC" -lt 0 ]]; then
  CYCLE_DURATION_SEC=0
fi
if [[ "$CYCLE_DURATION_SEC" -le 0 && ("$RUN_LANE_A" == "1" || "$RUN_LANE_B" == "1" || "$RUN_LANE_C" == "1") ]]; then
  CYCLE_DURATION_SEC=1
fi

RUN_ID="$RUN_ID" \
OUT_DIR="$OUT_DIR" \
OVERALL_STATUS="$OVERALL_STATUS" \
PARALLEL_WATCH_POLICY="$PARALLEL_WATCH_POLICY" \
CYCLE_DURATION_SEC="$CYCLE_DURATION_SEC" \
RUN_LANE_A="$RUN_LANE_A" \
LANE_A_STATUS="$LANE_A_STATUS" \
LANE_A_RC="$LANE_A_RC" \
LANE_A_SUMMARY_JSON="$LANE_A_SUMMARY_JSON" \
LANE_A_SUMMARY_MD="$LANE_A_SUMMARY_MD" \
LANE_A_LOG="$LANE_A_LOG" \
LANE_A_PROFILE="$LANE_A_PROFILE" \
LANE_A_LIMIT="$LANE_A_LIMIT" \
LANE_A_RUN_STEP166="$LANE_A_RUN_STEP166" \
LANE_A_RUN_UI_FLOW="$LANE_A_RUN_UI_FLOW" \
LANE_A_RUN_PERF_TREND="$LANE_A_RUN_PERF_TREND" \
LANE_A_RUN_REAL_SCENE_TREND="$LANE_A_RUN_REAL_SCENE_TREND" \
LANE_A_DURATION_SEC="$LANE_A_DURATION_SEC" \
RUN_LANE_B="$RUN_LANE_B" \
LANE_B_STATUS="$LANE_B_STATUS" \
LANE_B_RC="$LANE_B_RC" \
LANE_B_TEST_LOG="$LANE_B_TEST_LOG" \
LANE_B_RUN_UI_FLOW="$LANE_B_RUN_UI_FLOW" \
LANE_B_UI_STATUS="$LANE_B_UI_STATUS" \
LANE_B_UI_RC="$LANE_B_UI_RC" \
LANE_B_UI_FLOW_MODE="$LANE_B_UI_FLOW_MODE" \
LANE_B_UI_FLOW_TIMEOUT_MS="$LANE_B_UI_FLOW_TIMEOUT_MS" \
LANE_B_UI_FLOW_OPEN_RETRIES="$LANE_B_UI_FLOW_OPEN_RETRIES" \
LANE_B_UI_LOG="$LANE_B_UI_LOG" \
LANE_B_UI_SUMMARY="$LANE_B_UI_SUMMARY" \
LANE_B_DURATION_SEC="$LANE_B_DURATION_SEC" \
LANE_B_NODE_TEST_DURATION_SEC="$LANE_B_NODE_TEST_DURATION_SEC" \
LANE_B_UI_FLOW_DURATION_SEC="$LANE_B_UI_FLOW_DURATION_SEC" \
RUN_LANE_C="$RUN_LANE_C" \
LANE_C_STATUS="$LANE_C_STATUS" \
LANE_C_RC="$LANE_C_RC" \
LANE_C_HISTORY_DIR="$LANE_C_HISTORY_DIR" \
LANE_C_WINDOWS="$LANE_C_WINDOWS" \
LANE_C_DAYS="$LANE_C_DAYS" \
LANE_C_CASE_JSON="$LANE_C_CASE_JSON" \
LANE_C_CASE_MD="$LANE_C_CASE_MD" \
LANE_C_CASE_LOG="$LANE_C_CASE_LOG" \
LANE_C_GATE_JSON="$LANE_C_GATE_JSON" \
LANE_C_GATE_MD="$LANE_C_GATE_MD" \
LANE_C_GATE_LOG="$LANE_C_GATE_LOG" \
LANE_C_DURATION_SEC="$LANE_C_DURATION_SEC" \
LANE_C_CASE_SELECTION_DURATION_SEC="$LANE_C_CASE_SELECTION_DURATION_SEC" \
LANE_C_GATE_TREND_DURATION_SEC="$LANE_C_GATE_TREND_DURATION_SEC" \
python3 - "$SUMMARY_JSON" "$SUMMARY_MD" <<'PY'
import json
import os
import pathlib
import sys

summary_json = pathlib.Path(sys.argv[1])
summary_md = pathlib.Path(sys.argv[2])
summary_json.parent.mkdir(parents=True, exist_ok=True)
summary_md.parent.mkdir(parents=True, exist_ok=True)

def as_dict(value):
    return value if isinstance(value, dict) else {}

def as_list(value):
    return value if isinstance(value, list) else []

def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default

def as_bool(value):
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}

def load_json(path_text):
    path_text = str(path_text or "").strip()
    if not path_text:
        return {}
    path = pathlib.Path(path_text)
    try:
        if path.exists() and path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {}

def merge_code_counts(target, source):
    if not isinstance(source, dict):
        return
    for key, raw_value in source.items():
        code = str(key or "").strip()
        if not code:
            continue
        value = as_int(raw_value, 0)
        if value <= 0:
            continue
        target[code] = target.get(code, 0) + value

payload = {
    "run_id": os.environ.get("RUN_ID", ""),
    "out_dir": os.environ.get("OUT_DIR", ""),
    "overall_status": os.environ.get("OVERALL_STATUS", "pass"),
    "duration_sec": as_int(os.environ.get("CYCLE_DURATION_SEC"), 0),
    "lanes": {
        "lane_a": {
            "enabled": os.environ.get("RUN_LANE_A") == "1",
            "status": os.environ.get("LANE_A_STATUS", "skipped"),
            "rc": int(os.environ.get("LANE_A_RC", "0") or 0),
            "summary_json": os.environ.get("LANE_A_SUMMARY_JSON", ""),
            "summary_md": os.environ.get("LANE_A_SUMMARY_MD", ""),
            "log": os.environ.get("LANE_A_LOG", ""),
            "profile": os.environ.get("LANE_A_PROFILE", ""),
            "limit": int(os.environ.get("LANE_A_LIMIT", "0") or 0),
            "duration_sec": as_int(os.environ.get("LANE_A_DURATION_SEC"), 0),
            "runtime_inputs": {},
        },
        "lane_b": {
            "enabled": os.environ.get("RUN_LANE_B") == "1",
            "status": os.environ.get("LANE_B_STATUS", "skipped"),
            "rc": int(os.environ.get("LANE_B_RC", "0") or 0),
            "duration_sec": as_int(os.environ.get("LANE_B_DURATION_SEC"), 0),
            "node_test_duration_sec": as_int(os.environ.get("LANE_B_NODE_TEST_DURATION_SEC"), 0),
            "node_test_log": os.environ.get("LANE_B_TEST_LOG", ""),
            "ui_flow": {
                "enabled": os.environ.get("LANE_B_RUN_UI_FLOW") == "1",
                "status": os.environ.get("LANE_B_UI_STATUS", "skipped"),
                "rc": int(os.environ.get("LANE_B_UI_RC", "0") or 0),
                "mode": os.environ.get("LANE_B_UI_FLOW_MODE", ""),
                "timeout_ms": as_int(os.environ.get("LANE_B_UI_FLOW_TIMEOUT_MS"), 0),
                "open_retries": as_int(os.environ.get("LANE_B_UI_FLOW_OPEN_RETRIES"), 0),
                "log": os.environ.get("LANE_B_UI_LOG", ""),
                "summary_json": os.environ.get("LANE_B_UI_SUMMARY", ""),
                "duration_sec": as_int(os.environ.get("LANE_B_UI_FLOW_DURATION_SEC"), 0),
                "failure_code": "",
                "failure_detail": "",
                "failure_attribution_complete": True,
                "interaction_checks_coverage": {},
                "interaction_checks_complete": True,
                "interaction_checks_failed": [],
            },
        },
        "lane_c": {
            "enabled": os.environ.get("RUN_LANE_C") == "1",
            "status": os.environ.get("LANE_C_STATUS", "skipped"),
            "rc": int(os.environ.get("LANE_C_RC", "0") or 0),
            "history_dir": os.environ.get("LANE_C_HISTORY_DIR", ""),
            "windows": os.environ.get("LANE_C_WINDOWS", ""),
            "days": int(os.environ.get("LANE_C_DAYS", "0") or 0),
            "duration_sec": as_int(os.environ.get("LANE_C_DURATION_SEC"), 0),
            "case_selection": {
                "json": os.environ.get("LANE_C_CASE_JSON", ""),
                "md": os.environ.get("LANE_C_CASE_MD", ""),
                "log": os.environ.get("LANE_C_CASE_LOG", ""),
                "duration_sec": as_int(os.environ.get("LANE_C_CASE_SELECTION_DURATION_SEC"), 0),
            },
            "gate_trend": {
                "json": os.environ.get("LANE_C_GATE_JSON", ""),
                "md": os.environ.get("LANE_C_GATE_MD", ""),
                "log": os.environ.get("LANE_C_GATE_LOG", ""),
                "duration_sec": as_int(os.environ.get("LANE_C_GATE_TREND_DURATION_SEC"), 0),
            },
        },
    },
}

failure_code_counts = {}
warning_codes = []
fail_reasons = []

lane_a_payload = {}
if payload["lanes"]["lane_a"]["enabled"] and payload["lanes"]["lane_a"]["status"] == "pass":
    lane_a_payload = as_dict(load_json(payload["lanes"]["lane_a"]["summary_json"]))
    gate_obj = as_dict(lane_a_payload.get("gate_decision"))
    if not gate_obj:
        gate_obj = as_dict(lane_a_payload.get("gate"))
    editor_smoke = as_dict(lane_a_payload.get("editor_smoke"))
    ui_flow = as_dict(lane_a_payload.get("ui_flow_smoke"))
    lane_a_inputs = as_dict(lane_a_payload.get("inputs"))
    if lane_a_inputs:
        payload["lanes"]["lane_a"]["runtime_inputs"] = {
            "editor_gate_profile": str(lane_a_inputs.get("editor_gate_profile") or ""),
            "editor_smoke_no_convert": bool(lane_a_inputs.get("editor_smoke_no_convert", False)),
            "run_step166_gate": bool(lane_a_inputs.get("run_step166_gate", False)),
            "run_editor_ui_flow_smoke_gate": bool(lane_a_inputs.get("run_editor_ui_flow_smoke_gate", False)),
            "run_perf_trend": bool(lane_a_inputs.get("run_perf_trend", False)),
            "run_real_scene_trend": bool(lane_a_inputs.get("run_real_scene_trend", False)),
        }
    else:
        profile = str(os.environ.get("LANE_A_PROFILE") or "")
        no_convert = profile == "lite"
        payload["lanes"]["lane_a"]["runtime_inputs"] = {
            "editor_gate_profile": profile,
            "editor_smoke_no_convert": no_convert,
            "run_step166_gate": as_bool(os.environ.get("LANE_A_RUN_STEP166")),
            "run_editor_ui_flow_smoke_gate": as_bool(os.environ.get("LANE_A_RUN_UI_FLOW")),
            "run_perf_trend": as_bool(os.environ.get("LANE_A_RUN_PERF_TREND")),
            "run_real_scene_trend": as_bool(os.environ.get("LANE_A_RUN_REAL_SCENE_TREND")),
        }
    merge_code_counts(failure_code_counts, as_dict(editor_smoke.get("failure_code_counts")))
    merge_code_counts(failure_code_counts, as_dict(ui_flow.get("failure_code_counts")))
    if as_bool(gate_obj.get("would_fail")):
        fail_reasons.append("EDITOR_GATE_WOULD_FAIL")
    if as_bool(editor_smoke.get("generated_count_mismatch_gate_fail")):
        fail_reasons.append("EDITOR_SMOKE_GENERATED_COUNT_MISMATCH")

if payload["lanes"]["lane_a"]["enabled"] and payload["lanes"]["lane_a"]["status"] == "fail":
    fail_reasons.append("LANE_A_FAIL")
if payload["lanes"]["lane_b"]["enabled"] and payload["lanes"]["lane_b"]["status"] == "fail":
    fail_reasons.append("LANE_B_FAIL")
if payload["lanes"]["lane_c"]["enabled"] and payload["lanes"]["lane_c"]["status"] == "fail":
    fail_reasons.append("LANE_C_FAIL")

lane_b_ui_payload = {}
lane_b_ui = as_dict(payload["lanes"]["lane_b"].get("ui_flow"))
if payload["lanes"]["lane_b"]["enabled"] and lane_b_ui.get("enabled"):
    lane_b_ui_payload = as_dict(load_json(lane_b_ui.get("summary_json")))
    flow_failure_code = str(lane_b_ui_payload.get("flow_failure_code") or "").strip()
    flow_failure_stage = str(lane_b_ui_payload.get("flow_failure_stage") or "").strip()
    flow_failure_detail = str(lane_b_ui_payload.get("flow_failure_detail") or "").strip()
    open_retry_limit = as_int(lane_b_ui_payload.get("open_retry_limit"), as_int(lane_b_ui.get("open_retries"), 0))
    open_attempt_count = as_int(lane_b_ui_payload.get("open_attempt_count"), 0)
    open_attempt_exit_codes = str(lane_b_ui_payload.get("open_attempt_exit_codes") or "").strip()
    failure_stage_counts = as_dict(lane_b_ui_payload.get("failure_stage_counts"))
    open_exit_code = as_int(lane_b_ui_payload.get("open_exit_code"), 0)
    resize_exit_code = as_int(lane_b_ui_payload.get("resize_exit_code"), 0)
    run_code_exit_code = as_int(lane_b_ui_payload.get("run_code_exit_code"), 0)
    lane_b_ui["open_retries"] = open_retry_limit
    lane_b_ui["open_attempt_count"] = open_attempt_count
    lane_b_ui["open_attempt_exit_codes"] = open_attempt_exit_codes
    lane_b_ui["failure_stage_counts"] = failure_stage_counts
    lane_b_ui["failure_code"] = flow_failure_code
    lane_b_ui["failure_stage"] = flow_failure_stage
    lane_b_ui["failure_detail"] = flow_failure_detail
    lane_b_ui["open_exit_code"] = open_exit_code
    lane_b_ui["resize_exit_code"] = resize_exit_code
    lane_b_ui["run_code_exit_code"] = run_code_exit_code
    lane_b_ui["failure_attribution_complete"] = bool(
        as_bool(lane_b_ui_payload.get("ok")) or bool(flow_failure_code)
    )
    if flow_failure_code:
        failure_code_counts[flow_failure_code] = failure_code_counts.get(flow_failure_code, 0) + 1
    interaction_checks = as_dict(lane_b_ui_payload.get("interaction_checks"))
    interaction_coverage = {}
    for key, value in interaction_checks.items():
        name = str(key or "").strip()
        if not name:
            continue
        interaction_coverage[name] = bool(as_bool(value))
    interaction_failed = sorted([k for k, v in interaction_coverage.items() if not bool(v)])
    lane_b_ui["interaction_checks_coverage"] = interaction_coverage
    lane_b_ui["interaction_checks_failed"] = interaction_failed
    lane_b_ui["interaction_checks_complete"] = bool(interaction_coverage) and not interaction_failed
    mode = str(lane_b_ui.get("mode") or "").strip().lower()
    if str(lane_b_ui.get("status", "")).lower() == "fail":
        fail_reasons.append("LANE_B_UI_FLOW_FAIL")
        if not lane_b_ui["failure_attribution_complete"]:
            fail_reasons.append("LANE_B_UI_FLOW_ATTR_MISSING")
    else:
        if not lane_b_ui["failure_attribution_complete"]:
            fail_reasons.append("LANE_B_UI_FLOW_ATTR_INCOMPLETE")
    if mode == "gate":
        if not lane_b_ui["interaction_checks_complete"]:
            fail_reasons.append("LANE_B_UI_FLOW_INTERACTION_INCOMPLETE")
    elif interaction_coverage and not lane_b_ui["interaction_checks_complete"]:
        warning_codes.append("LANE_B_UI_FLOW_INTERACTION_INCOMPLETE")
if payload["lanes"]["lane_b"]["enabled"] and not lane_b_ui.get("enabled"):
    mode = str(lane_b_ui.get("mode") or "").strip().lower()
    if mode == "gate":
        fail_reasons.append("LANE_B_UI_FLOW_DISABLED")
    elif mode:
        warning_codes.append("LANE_B_UI_FLOW_DISABLED")

lane_c_case_payload = {}
lane_c = as_dict(payload["lanes"]["lane_c"])
if lane_c.get("enabled") and lane_c.get("status") == "pass":
    lane_c_case_payload = as_dict(load_json(as_dict(lane_c.get("case_selection")).get("json")))
    warning_codes.extend(str(x).strip() for x in as_list(lane_c_case_payload.get("warning_codes")) if str(x).strip())

warning_codes = sorted(set(warning_codes))
fail_reasons = sorted(set(fail_reasons))

watch_policy = str(os.environ.get("PARALLEL_WATCH_POLICY") or "observe").strip().lower()
if watch_policy not in {"observe", "gate"}:
    watch_policy = "observe"

raw_decision = "pass"
if fail_reasons:
    raw_decision = "fail"
elif warning_codes:
    raw_decision = "watch"

watch_escalated = raw_decision == "watch" and watch_policy == "gate"
decision = raw_decision
if watch_escalated:
    decision = "fail"
    fail_reasons = sorted(set(fail_reasons + ["WATCH_POLICY_GATE"]))

payload["gate_decision"] = {
    "raw_decision": raw_decision,
    "decision": decision,
    "watch_policy": watch_policy,
    "watch_escalated": watch_escalated,
    "should_merge": decision == "pass",
    "fail_reasons": fail_reasons,
    "warning_codes": warning_codes,
    "failure_code_counts": dict(sorted(failure_code_counts.items())),
}
if decision == "fail":
    payload["overall_status"] = "fail"

summary_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lines = [
    "# Editor Parallel Cycle Summary",
    "",
    f"- run_id: `{payload['run_id']}`",
    f"- out_dir: `{payload['out_dir']}`",
    f"- overall_status: `{payload['overall_status']}`",
    f"- duration_sec: `{payload.get('duration_sec', 0)}`",
    f"- gate_decision: `{payload['gate_decision']['decision']}` raw=`{payload['gate_decision']['raw_decision']}` should_merge=`{payload['gate_decision']['should_merge']}`",
    f"- watch_policy: `{payload['gate_decision']['watch_policy']}` escalated=`{payload['gate_decision']['watch_escalated']}`",
    f"- gate_fail_reasons: `{' '.join(payload['gate_decision']['fail_reasons']) or '-'}`",
    f"- gate_warning_codes: `{' '.join(payload['gate_decision']['warning_codes']) or '-'}`",
    f"- failure_code_counts: `{' '.join([f'{k}={v}' for k, v in payload['gate_decision']['failure_code_counts'].items()]) or '-'}`",
    "",
    "## Lanes",
    f"- lane_a: `{payload['lanes']['lane_a']['status']}` profile=`{payload['lanes']['lane_a']['profile']}` limit=`{payload['lanes']['lane_a']['limit']}` duration_sec=`{payload['lanes']['lane_a'].get('duration_sec', 0)}`",
    (
        "  - runtime: `n/a`"
        if not as_dict(payload["lanes"]["lane_a"].get("runtime_inputs"))
        else "  - runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={scene}`".format(
            profile=str(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("editor_gate_profile") or "<none>"),
            step166=bool(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("run_step166_gate", False)),
            ui_flow=bool(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("run_editor_ui_flow_smoke_gate", False)),
            convert=bool(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("editor_smoke_no_convert", False)),
            perf=bool(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("run_perf_trend", False)),
            scene=bool(as_dict(payload["lanes"]["lane_a"].get("runtime_inputs")).get("run_real_scene_trend", False)),
        )
    ),
    f"  - summary_json: `{payload['lanes']['lane_a']['summary_json'] or '(missing)'}`",
    f"  - log: `{payload['lanes']['lane_a']['log'] or '(missing)'}`",
    f"- lane_b: `{payload['lanes']['lane_b']['status']}` duration_sec=`{payload['lanes']['lane_b'].get('duration_sec', 0)}` node_test_duration_sec=`{payload['lanes']['lane_b'].get('node_test_duration_sec', 0)}`",
    f"  - node_test_log: `{payload['lanes']['lane_b']['node_test_log'] or '(missing)'}`",
    f"  - ui_flow: `{payload['lanes']['lane_b']['ui_flow']['status']}` mode=`{payload['lanes']['lane_b']['ui_flow']['mode']}` timeout_ms=`{payload['lanes']['lane_b']['ui_flow'].get('timeout_ms', 0)}` open_retries=`{payload['lanes']['lane_b']['ui_flow'].get('open_retries', 0)}` open_attempts=`{payload['lanes']['lane_b']['ui_flow'].get('open_attempt_count', 0)}` duration_sec=`{payload['lanes']['lane_b']['ui_flow'].get('duration_sec', 0)}` summary=`{payload['lanes']['lane_b']['ui_flow']['summary_json'] or '(missing)'}`",
    "  - ui_flow_attribution: `complete={complete}` `failure_code={code}`".format(
        complete=bool(payload["lanes"]["lane_b"]["ui_flow"].get("failure_attribution_complete", True)),
        code=str(payload["lanes"]["lane_b"]["ui_flow"].get("failure_code") or "-"),
    ),
    "  - ui_flow_failure_stage: `stage={stage}` `open_exit={open_rc}` `resize_exit={resize_rc}` `run_code_exit={run_rc}`".format(
        stage=str(payload["lanes"]["lane_b"]["ui_flow"].get("failure_stage") or "-"),
        open_rc=as_int(payload["lanes"]["lane_b"]["ui_flow"].get("open_exit_code"), 0),
        resize_rc=as_int(payload["lanes"]["lane_b"]["ui_flow"].get("resize_exit_code"), 0),
        run_rc=as_int(payload["lanes"]["lane_b"]["ui_flow"].get("run_code_exit_code"), 0),
    ),
    "  - ui_flow_open_attempt_exit_codes: `{codes}`".format(
        codes=str(payload["lanes"]["lane_b"]["ui_flow"].get("open_attempt_exit_codes") or "-"),
    ),
    "  - ui_flow_interaction_checks: `complete={complete}` `failed={failed}`".format(
        complete=bool(payload["lanes"]["lane_b"]["ui_flow"].get("interaction_checks_complete", False)),
        failed=(" ".join(str(x) for x in as_list(payload["lanes"]["lane_b"]["ui_flow"].get("interaction_checks_failed"))) or "-"),
    ),
    f"  - ui_flow_log: `{payload['lanes']['lane_b']['ui_flow']['log'] or '(missing)'}`",
    f"- lane_c: `{payload['lanes']['lane_c']['status']}` windows=`{payload['lanes']['lane_c']['windows']}` days=`{payload['lanes']['lane_c']['days']}` duration_sec=`{payload['lanes']['lane_c'].get('duration_sec', 0)}`",
    f"  - case_selection_json: `{payload['lanes']['lane_c']['case_selection']['json'] or '(missing)'}` duration_sec=`{payload['lanes']['lane_c']['case_selection'].get('duration_sec', 0)}`",
    f"  - gate_trend_json: `{payload['lanes']['lane_c']['gate_trend']['json'] or '(missing)'}` duration_sec=`{payload['lanes']['lane_c']['gate_trend'].get('duration_sec', 0)}`",
    "",
]
summary_md.write_text("\n".join(lines), encoding="utf-8")
PY

echo "run_id=$RUN_ID"
echo "out_dir=$OUT_DIR"
echo "summary_json=$SUMMARY_JSON"
echo "summary_md=$SUMMARY_MD"
echo "watch_policy=$PARALLEL_WATCH_POLICY"
GATE_DECISION="$(python3 - "$SUMMARY_JSON" <<'PY'
import json
import sys
try:
  payload = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
except Exception:
  print("unknown")
  raise SystemExit(0)
gate = payload.get("gate_decision") if isinstance(payload.get("gate_decision"), dict) else {}
print(gate.get("decision") or "unknown")
PY
)"
OVERALL_EFFECTIVE="$(python3 - "$SUMMARY_JSON" <<'PY'
import json
import sys
try:
  payload = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
except Exception:
  print("unknown")
  raise SystemExit(0)
print(str(payload.get("overall_status") or "unknown"))
PY
)"
echo "overall_status=$OVERALL_EFFECTIVE"
echo "gate_decision=$GATE_DECISION"
if [[ "$GATE_DECISION" == "fail" ]]; then
  OVERALL_RC=1
fi

exit "$OVERALL_RC"
