#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EDITOR_SMOKE_MODE="${EDITOR_SMOKE_MODE:-observe}"
# STEP174 rollout: observe with 8-case standard sample for one-week trend window.
EDITOR_SMOKE_LIMIT="${EDITOR_SMOKE_LIMIT:-8}"
EDITOR_SMOKE_CASES="${EDITOR_SMOKE_CASES:-}"
EDITOR_SMOKE_MIN_CASES="${EDITOR_SMOKE_MIN_CASES:-4}"
EDITOR_SMOKE_PRIORITY_SET="${EDITOR_SMOKE_PRIORITY_SET:-}"
EDITOR_SMOKE_TAG_ANY="${EDITOR_SMOKE_TAG_ANY:-}"
GATE_SMOKE_PRIORITY_SET="${GATE_SMOKE_PRIORITY_SET:-$EDITOR_SMOKE_PRIORITY_SET}"
GATE_SMOKE_TAG_ANY="${GATE_SMOKE_TAG_ANY:-$EDITOR_SMOKE_TAG_ANY}"
# Default-on: UI flow smoke is the most direct "CAD is editable" wiring guardrail.
# Can be disabled via RUN_EDITOR_UI_FLOW_SMOKE=0 for environments without Playwright.
RUN_EDITOR_UI_FLOW_SMOKE="${RUN_EDITOR_UI_FLOW_SMOKE:-1}"
EDITOR_UI_FLOW_MODE="${EDITOR_UI_FLOW_MODE:-observe}" # observe|gate
EDITOR_UI_FLOW_PORT="${EDITOR_UI_FLOW_PORT:-}"
EDITOR_UI_FLOW_VIEWPORT="${EDITOR_UI_FLOW_VIEWPORT:-1400,900}"
EDITOR_UI_FLOW_TIMEOUT_MS="${EDITOR_UI_FLOW_TIMEOUT_MS:-25000}"
EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES="${EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES:-2}"
EDITOR_UI_FLOW_OUTDIR="${EDITOR_UI_FLOW_OUTDIR:-}"
EDITOR_UI_FLOW_HEADED="${EDITOR_UI_FLOW_HEADED:-0}"
EDITOR_UI_FLOW_SMOKE_GATE_RUNS="${EDITOR_UI_FLOW_SMOKE_GATE_RUNS:-}"
EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT="${EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT:-3}"
RUN_UI_FLOW_FAILURE_INJECTION="${RUN_UI_FLOW_FAILURE_INJECTION:-1}"
UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS="${UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS:-1}"
UI_FLOW_FAILURE_INJECTION_STRICT="${UI_FLOW_FAILURE_INJECTION_STRICT:-0}"

EDITOR_SMOKE_CASE_SOURCE="${EDITOR_SMOKE_CASE_SOURCE:-}"
if [[ -z "$EDITOR_SMOKE_CASE_SOURCE" ]]; then
  if [[ -n "$EDITOR_SMOKE_CASES" ]]; then
    EDITOR_SMOKE_CASE_SOURCE="explicit"
  else
    EDITOR_SMOKE_CASE_SOURCE="discovery"
  fi
fi
EDITOR_SMOKE_GENERATE_CASES="${EDITOR_SMOKE_GENERATE_CASES:-1}"
EDITOR_SMOKE_GENERATED_CASES_PATH="${EDITOR_SMOKE_GENERATED_CASES_PATH:-local/editor_roundtrip_smoke_cases_weekly.json}"
EDITOR_SMOKE_GENERATED_PRIORITIES="${EDITOR_SMOKE_GENERATED_PRIORITIES:-${EDITOR_SMOKE_PRIORITY_SET:-P0,P1}}"
EDITOR_SMOKE_GENERATED_MIN_CASES="${EDITOR_SMOKE_GENERATED_MIN_CASES:-$EDITOR_SMOKE_MIN_CASES}"
EDITOR_SMOKE_GENERATED_RUN_ID=""
EDITOR_SMOKE_GENERATED_RUN_IDS=""
EDITOR_SMOKE_GENERATED_COUNT=0
EDITOR_SMOKE_GENERATED_COUNT_DECLARED=0
EDITOR_SMOKE_GENERATED_COUNT_ACTUAL=0
EDITOR_SMOKE_GENERATED_COUNT_MISMATCH=0
EDITOR_SMOKE_GENERATED_MISMATCH_POLICY="${EDITOR_SMOKE_GENERATED_MISMATCH_POLICY:-warn}" # ignore|warn|gate
WEEKLY_PARALLEL_DECISION_POLICY="${WEEKLY_PARALLEL_DECISION_POLICY:-observe}" # observe|gate
PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS="${PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS:-}"
PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES="${PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES:-}"
RUN_WEEKLY_SUMMARY_CHECK="${RUN_WEEKLY_SUMMARY_CHECK:-1}"
WEEKLY_SUMMARY_CHECK_STRICT="${WEEKLY_SUMMARY_CHECK_STRICT:-1}"
WEEKLY_SUMMARY_CHECK_DASHBOARD="${WEEKLY_SUMMARY_CHECK_DASHBOARD:-}"
WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD="${WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD:-0}"
STEP176_DASHBOARD_OUT="${STEP176_DASHBOARD_OUT:-}"
RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP="${RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP:-1}"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES="${WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES:-tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json}"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_OUTDIR="${WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_OUTDIR:-build/preview_artifact_prep_legacy_weekly}"
RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE="${RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE:-1}"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES="${WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES:-tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json}"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_OUTDIR="${WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_OUTDIR:-build/preview_artifact_smoke_legacy_weekly}"

if ! [[ "$EDITOR_SMOKE_MIN_CASES" =~ ^[0-9]+$ ]] || [[ "$EDITOR_SMOKE_MIN_CASES" -le 0 ]]; then
  echo "[WEEKLY] WARN invalid EDITOR_SMOKE_MIN_CASES=$EDITOR_SMOKE_MIN_CASES, fallback to 1"
  EDITOR_SMOKE_MIN_CASES="1"
fi
if [[ "$EDITOR_SMOKE_GENERATE_CASES" != "0" && "$EDITOR_SMOKE_GENERATE_CASES" != "1" ]]; then
  echo "[WEEKLY] WARN invalid EDITOR_SMOKE_GENERATE_CASES=$EDITOR_SMOKE_GENERATE_CASES, fallback to 1"
  EDITOR_SMOKE_GENERATE_CASES="1"
fi
if ! [[ "$EDITOR_SMOKE_GENERATED_MIN_CASES" =~ ^[0-9]+$ ]] || [[ "$EDITOR_SMOKE_GENERATED_MIN_CASES" -le 0 ]]; then
  echo "[WEEKLY] WARN invalid EDITOR_SMOKE_GENERATED_MIN_CASES=$EDITOR_SMOKE_GENERATED_MIN_CASES, fallback to EDITOR_SMOKE_MIN_CASES=$EDITOR_SMOKE_MIN_CASES"
  EDITOR_SMOKE_GENERATED_MIN_CASES="$EDITOR_SMOKE_MIN_CASES"
fi
case "$EDITOR_SMOKE_GENERATED_MISMATCH_POLICY" in
  ignore|warn|gate) ;;
  *)
    echo "[WEEKLY] WARN invalid EDITOR_SMOKE_GENERATED_MISMATCH_POLICY=$EDITOR_SMOKE_GENERATED_MISMATCH_POLICY, fallback to warn"
    EDITOR_SMOKE_GENERATED_MISMATCH_POLICY="warn"
    ;;
esac
case "$WEEKLY_PARALLEL_DECISION_POLICY" in
  observe|gate) ;;
  *)
    echo "[WEEKLY] WARN invalid WEEKLY_PARALLEL_DECISION_POLICY=$WEEKLY_PARALLEL_DECISION_POLICY, fallback to observe"
    WEEKLY_PARALLEL_DECISION_POLICY="observe"
    ;;
esac
if [[ -n "$PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS" ]]; then
  if ! [[ "$PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS" =~ ^[0-9]+$ ]] || [[ "$PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS" -le 0 ]]; then
    echo "[WEEKLY] WARN invalid PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=$PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS, ignore"
    PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=""
  fi
fi
if [[ -n "$PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES" ]]; then
  if ! [[ "$PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES" =~ ^[0-9]+$ ]] || [[ "$PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES" -le 0 ]]; then
    echo "[WEEKLY] WARN invalid PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES=$PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES, ignore"
    PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES=""
  fi
fi
if ! [[ "$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES" =~ ^[0-9]+$ ]] || [[ "$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES" -le 0 ]]; then
  echo "[WEEKLY] WARN invalid EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES=$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES, fallback to 2"
  EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES="2"
fi
if [[ "$RUN_WEEKLY_SUMMARY_CHECK" != "0" && "$RUN_WEEKLY_SUMMARY_CHECK" != "1" ]]; then
  echo "[WEEKLY] WARN invalid RUN_WEEKLY_SUMMARY_CHECK=$RUN_WEEKLY_SUMMARY_CHECK, fallback to 1"
  RUN_WEEKLY_SUMMARY_CHECK="1"
fi
if [[ "$WEEKLY_SUMMARY_CHECK_STRICT" != "0" && "$WEEKLY_SUMMARY_CHECK_STRICT" != "1" ]]; then
  echo "[WEEKLY] WARN invalid WEEKLY_SUMMARY_CHECK_STRICT=$WEEKLY_SUMMARY_CHECK_STRICT, fallback to 1"
  WEEKLY_SUMMARY_CHECK_STRICT="1"
fi
if [[ "$WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD" != "0" && "$WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD" != "1" ]]; then
  echo "[WEEKLY] WARN invalid WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=$WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD, fallback to 0"
  WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD="0"
fi
if [[ "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP" != "0" && "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP" != "1" ]]; then
  echo "[WEEKLY] WARN invalid RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP=$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP, fallback to 1"
  RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP="1"
fi
if [[ "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE" != "0" && "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE" != "1" ]]; then
  echo "[WEEKLY] WARN invalid RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE=$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE, fallback to 1"
  RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE="1"
fi

count_case_items() {
  local path="$1"
  python3 - "$path" <<'PY'
import json
import sys
path = sys.argv[1]
if not path:
  print(0)
  raise SystemExit(0)
try:
  payload = json.load(open(path, "r", encoding="utf-8"))
except Exception:
  print(0)
  raise SystemExit(0)
print(len(payload) if isinstance(payload, list) else 0)
PY
}

if [[ -z "$EDITOR_SMOKE_CASES" && "$EDITOR_SMOKE_GENERATE_CASES" == "1" ]]; then
  mkdir -p "$(dirname "$EDITOR_SMOKE_GENERATED_CASES_PATH")"
  GENERATED_META="$(
    python3 tools/generate_editor_roundtrip_cases.py \
      --limit "$EDITOR_SMOKE_LIMIT" \
      --priorities "$EDITOR_SMOKE_GENERATED_PRIORITIES" \
      --out "$EDITOR_SMOKE_GENERATED_CASES_PATH" 2>/dev/null || true
  )"
  EDITOR_SMOKE_GENERATED_RUN_ID="$(printf '%s\n' "$GENERATED_META" | awk -F= '/^selected_run_id=/{print $2; exit}')"
  EDITOR_SMOKE_GENERATED_RUN_IDS="$(printf '%s\n' "$GENERATED_META" | awk -F= '/^selected_run_ids=/{print $2; exit}')"
  if [[ -f "$EDITOR_SMOKE_GENERATED_CASES_PATH" ]]; then
    EDITOR_SMOKE_GENERATED_COUNT="$(count_case_items "$EDITOR_SMOKE_GENERATED_CASES_PATH")"
  fi
  if ! [[ "$EDITOR_SMOKE_GENERATED_COUNT" =~ ^[0-9]+$ ]]; then
    EDITOR_SMOKE_GENERATED_COUNT=0
  fi
  EDITOR_SMOKE_GENERATED_COUNT_DECLARED="$EDITOR_SMOKE_GENERATED_COUNT"
  EDITOR_SMOKE_GENERATED_COUNT_ACTUAL="$EDITOR_SMOKE_GENERATED_COUNT"
  EDITOR_SMOKE_GENERATED_COUNT_MISMATCH=0
  if [[ "$EDITOR_SMOKE_GENERATED_COUNT" -ge "$EDITOR_SMOKE_GENERATED_MIN_CASES" ]]; then
    EDITOR_SMOKE_CASES="$EDITOR_SMOKE_GENERATED_CASES_PATH"
    EDITOR_SMOKE_CASE_SOURCE="generated"
  fi
fi

if [[ -z "$EDITOR_SMOKE_CASES" && -f "local/editor_roundtrip_smoke_cases.json" ]]; then
  EDITOR_SMOKE_CASES="local/editor_roundtrip_smoke_cases.json"
  if [[ "$EDITOR_SMOKE_CASE_SOURCE" == "discovery" ]]; then
    EDITOR_SMOKE_CASE_SOURCE="auto-local"
  fi
fi

EDITOR_SMOKE_CASE_COUNT=0
if [[ -n "$EDITOR_SMOKE_CASES" ]]; then
  if [[ ! -f "$EDITOR_SMOKE_CASES" ]]; then
    echo "[WEEKLY] WARN editor_smoke_cases file missing: $EDITOR_SMOKE_CASES (fallback to discovery)"
    EDITOR_SMOKE_CASES=""
    EDITOR_SMOKE_CASE_SOURCE="discovery"
  else
    EDITOR_SMOKE_CASE_COUNT="$(count_case_items "$EDITOR_SMOKE_CASES")"
    if ! [[ "$EDITOR_SMOKE_CASE_COUNT" =~ ^[0-9]+$ ]]; then
      EDITOR_SMOKE_CASE_COUNT=0
    fi
    if [[ "$EDITOR_SMOKE_CASE_COUNT" -lt "$EDITOR_SMOKE_MIN_CASES" ]]; then
      FIXTURE_CASES="tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json"
      if [[ -f "$FIXTURE_CASES" ]]; then
        FIXTURE_COUNT="$(count_case_items "$FIXTURE_CASES")"
        if ! [[ "$FIXTURE_COUNT" =~ ^[0-9]+$ ]]; then
          FIXTURE_COUNT=0
        fi
        if [[ "$FIXTURE_COUNT" -ge "$EDITOR_SMOKE_MIN_CASES" && "$FIXTURE_COUNT" -gt "$EDITOR_SMOKE_CASE_COUNT" ]]; then
          echo "[WEEKLY] WARN editor_smoke_cases has only $EDITOR_SMOKE_CASE_COUNT cases (<$EDITOR_SMOKE_MIN_CASES), fallback to fixture: $FIXTURE_CASES (count=$FIXTURE_COUNT)"
          EDITOR_SMOKE_CASES="$FIXTURE_CASES"
          EDITOR_SMOKE_CASE_COUNT="$FIXTURE_COUNT"
          EDITOR_SMOKE_CASE_SOURCE="fixture"
        else
          echo "[WEEKLY] WARN editor_smoke_cases has only $EDITOR_SMOKE_CASE_COUNT cases (<$EDITOR_SMOKE_MIN_CASES), fixture_count=$FIXTURE_COUNT not better; fallback to discovery"
          EDITOR_SMOKE_CASES=""
          EDITOR_SMOKE_CASE_COUNT=0
          EDITOR_SMOKE_CASE_SOURCE="discovery"
        fi
      else
        echo "[WEEKLY] WARN fixture cases missing: $FIXTURE_CASES (fallback to discovery)"
        EDITOR_SMOKE_CASES=""
        EDITOR_SMOKE_CASE_COUNT=0
        EDITOR_SMOKE_CASE_SOURCE="discovery"
      fi
    fi
  fi
fi

if [[ -z "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" ]]; then
  if [[ "$RUN_EDITOR_UI_FLOW_SMOKE" == "1" && "$EDITOR_UI_FLOW_MODE" == "gate" ]]; then
    EDITOR_UI_FLOW_SMOKE_GATE_RUNS="$EDITOR_UI_FLOW_SMOKE_GATE_RUNS_DEFAULT"
  else
    EDITOR_UI_FLOW_SMOKE_GATE_RUNS="1"
  fi
fi
if ! [[ "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" =~ ^[0-9]+$ ]] || [[ "$EDITOR_UI_FLOW_SMOKE_GATE_RUNS" -le 0 ]]; then
  echo "[WEEKLY] WARN invalid EDITOR_UI_FLOW_SMOKE_GATE_RUNS=$EDITOR_UI_FLOW_SMOKE_GATE_RUNS, fallback to 1"
  EDITOR_UI_FLOW_SMOKE_GATE_RUNS="1"
fi

CAD_MODE="${CAD_MODE:-observe}"
CAD_MAX_WORKERS="${CAD_MAX_WORKERS:-2}"
CAD_BASELINE="${CAD_BASELINE:-docs/baselines/STEP166_baseline_summary.json}"
# Default-on baseline refresh check (dry-run unless STEP166_BASELINE_REFRESH_APPLY=1).
RUN_STEP166_BASELINE_REFRESH="${RUN_STEP166_BASELINE_REFRESH:-1}"
STEP166_BASELINE_REFRESH_DAYS="${STEP166_BASELINE_REFRESH_DAYS:-5}"
STEP166_BASELINE_REFRESH_APPLY="${STEP166_BASELINE_REFRESH_APPLY:-0}"

# Exported summary fields for baseline refresh (initialized so `set -u` doesn't bite).
STEP166_BASELINE_REFRESH_RC="${STEP166_BASELINE_REFRESH_RC:-0}"
STEP166_BASELINE_REFRESH_ELIGIBLE="${STEP166_BASELINE_REFRESH_ELIGIBLE:-}"
STEP166_BASELINE_REFRESH_APPLIED="${STEP166_BASELINE_REFRESH_APPLIED:-}"
STEP166_BASELINE_REFRESH_REASON="${STEP166_BASELINE_REFRESH_REASON:-}"
STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID="${STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID:-}"
STEP166_BASELINE_REFRESH_BACKUP_PATH="${STEP166_BASELINE_REFRESH_BACKUP_PATH:-}"
STEP166_BASELINE_REFRESH_WINDOW_REPORT="${STEP166_BASELINE_REFRESH_WINDOW_REPORT:-}"

PERF_ENTITIES="${PERF_ENTITIES:-10000}"
PERF_PICK_SAMPLES="${PERF_PICK_SAMPLES:-3000}"
PERF_BOX_SAMPLES="${PERF_BOX_SAMPLES:-1000}"
PERF_DRAG_SAMPLES="${PERF_DRAG_SAMPLES:-120}"
PERF_LABEL="${PERF_LABEL:-step173_weekly_baseline}"
PERF_REPEAT="${PERF_REPEAT:-1}"
PERF_INTERVAL_SEC="${PERF_INTERVAL_SEC:-0}"

RUN_GATE="${RUN_GATE:-0}"
GATE_SMOKE_LIMIT="${GATE_SMOKE_LIMIT:-}"
AUTO_GATE_LIMIT="${AUTO_GATE_LIMIT:-1}"
GATE_SMOKE_LIMIT_DEFAULT="${GATE_SMOKE_LIMIT_DEFAULT:-5}"
GATE_SMOKE_LIMIT_PROMOTED="${GATE_SMOKE_LIMIT_PROMOTED:-8}"
GATE_CAD_ATTEMPTS="${GATE_CAD_ATTEMPTS:-3}"
GATE_EDITOR_SMOKE_GENERATED_CASES_PATH="${GATE_EDITOR_SMOKE_GENERATED_CASES_PATH:-local/editor_roundtrip_smoke_cases_weekly_gate.json}"
GATE_EDITOR_SMOKE_CASES="$EDITOR_SMOKE_CASES"
GATE_EDITOR_SMOKE_CASE_SOURCE="$EDITOR_SMOKE_CASE_SOURCE"
GATE_EDITOR_SMOKE_GENERATED_COUNT=0
GATE_EDITOR_SMOKE_GENERATED_COUNT_DECLARED=0
GATE_EDITOR_SMOKE_GENERATED_COUNT_ACTUAL=0
GATE_EDITOR_SMOKE_GENERATED_COUNT_MISMATCH=0
GATE_EDITOR_SMOKE_GENERATED_RUN_ID=""
GATE_EDITOR_SMOKE_GENERATED_RUN_IDS=""
GATE_EDITOR_SMOKE_GENERATED_PRIORITIES="${GATE_SMOKE_PRIORITY_SET:-$EDITOR_SMOKE_GENERATED_PRIORITIES}"
GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY="${GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY:-$EDITOR_SMOKE_GENERATED_MISMATCH_POLICY}" # ignore|warn|gate
case "$GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY" in
  ignore|warn|gate) ;;
  *)
    echo "[WEEKLY] WARN invalid GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY=$GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY, fallback to $EDITOR_SMOKE_GENERATED_MISMATCH_POLICY"
    GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY="$EDITOR_SMOKE_GENERATED_MISMATCH_POLICY"
    ;;
esac
# Keep backward compatibility: EDITOR_GATE_APPEND_REPORT is the public knob used by tools/editor_gate.sh.
# GATE_APPEND_REPORT is a deprecated alias kept for older environments.
EDITOR_GATE_APPEND_REPORT="${EDITOR_GATE_APPEND_REPORT:-${GATE_APPEND_REPORT:-0}}"
# Qt project persistence gate controls passed to tools/editor_gate.sh during weekly gate.
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK="${GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK:-1}"
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE="${GATE_RUN_QT_PROJECT_PERSISTENCE_GATE:-1}"
GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON="${GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON:-auto}" # auto|0|1
QT_PROJECT_POLICY_DAYS="${QT_PROJECT_POLICY_DAYS:-14}"
QT_PROJECT_POLICY_MIN_SAMPLES="${QT_PROJECT_POLICY_MIN_SAMPLES:-5}"
QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES="${QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES:-3}"
QT_PROJECT_POLICY_JSON="${QT_PROJECT_POLICY_JSON:-build/qt_project_persistence_gate_policy.json}"
QT_PROJECT_POLICY_MD="${QT_PROJECT_POLICY_MD:-build/qt_project_persistence_gate_policy.md}"

TREND_DAYS="${TREND_DAYS:-7}"
TREND_JSON="${TREND_JSON:-build/editor_gate_trend.json}"
TREND_MD="${TREND_MD:-build/editor_gate_trend.md}"
PRE_TREND_JSON="${PRE_TREND_JSON:-build/editor_gate_trend_pre.json}"
PRE_TREND_MD="${PRE_TREND_MD:-build/editor_gate_trend_pre.md}"

UI_FLOW_STAGE_TREND_DAYS="${UI_FLOW_STAGE_TREND_DAYS:-$TREND_DAYS}"
UI_FLOW_STAGE_TREND_JSON="${UI_FLOW_STAGE_TREND_JSON:-build/editor_ui_flow_stage_trend.json}"
UI_FLOW_STAGE_TREND_MD="${UI_FLOW_STAGE_TREND_MD:-build/editor_ui_flow_stage_trend.md}"

PERF_TREND_DAYS="${PERF_TREND_DAYS:-14}"
PERF_TREND_JSON="${PERF_TREND_JSON:-build/editor_perf_trend.json}"
PERF_TREND_MD="${PERF_TREND_MD:-build/editor_perf_trend.md}"
PERF_TREND_MIN_SELECTED="${PERF_TREND_MIN_SELECTED:-5}"

REAL_SCENE_TREND_DAYS="${REAL_SCENE_TREND_DAYS:-14}"
REAL_SCENE_TREND_JSON="${REAL_SCENE_TREND_JSON:-build/editor_real_scene_perf_trend.json}"
REAL_SCENE_TREND_MD="${REAL_SCENE_TREND_MD:-build/editor_real_scene_perf_trend.md}"
REAL_SCENE_TREND_MIN_SELECTED="${REAL_SCENE_TREND_MIN_SELECTED:-5}"

CASE_SELECTION_TREND_WINDOWS="${CASE_SELECTION_TREND_WINDOWS:-7,14}"
CASE_SELECTION_TREND_JSON="${CASE_SELECTION_TREND_JSON:-build/editor_case_selection_trend.json}"
CASE_SELECTION_TREND_MD="${CASE_SELECTION_TREND_MD:-build/editor_case_selection_trend.md}"

RUN_REAL_SCENE_PERF="${RUN_REAL_SCENE_PERF:-1}"
REAL_SCENE_MODE="${REAL_SCENE_MODE:-observe}"
REAL_SCENE_PROFILE="${REAL_SCENE_PROFILE:-docs/baselines/STEP174_REAL_SCENE_PERF_PROFILE.json}"
REAL_SCENE_REPEAT="${REAL_SCENE_REPEAT:-1}"
REAL_SCENE_INTERVAL_SEC="${REAL_SCENE_INTERVAL_SEC:-1}"

SUMMARY_JSON="${SUMMARY_JSON:-build/editor_weekly_validation_summary.json}"
SUMMARY_MD="${SUMMARY_MD:-build/editor_weekly_validation_summary.md}"
# Validate weekly summary trend contract after summary generation.

STEP176_APPEND_REPORT="${STEP176_APPEND_REPORT:-0}"
STEP176_REPORT="${STEP176_REPORT:-docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md}"

# Auto-append weekly summary to STEP170 to keep an audit trail of run_ids and gate outcomes.
STEP170_APPEND_REPORT="${STEP170_APPEND_REPORT:-1}"
STEP170_REPORT="${STEP170_REPORT:-docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md}"

# Optional weekly parallel-cycle snapshot (defaults to lane-B focus).
RUN_EDITOR_PARALLEL_CYCLE="${RUN_EDITOR_PARALLEL_CYCLE:-1}"
PARALLEL_CYCLE_WATCH_POLICY="${PARALLEL_CYCLE_WATCH_POLICY:-observe}" # observe|gate
PARALLEL_CYCLE_RUN_LANE_A="${PARALLEL_CYCLE_RUN_LANE_A:-0}"
PARALLEL_CYCLE_RUN_LANE_B="${PARALLEL_CYCLE_RUN_LANE_B:-1}"
PARALLEL_CYCLE_RUN_LANE_C="${PARALLEL_CYCLE_RUN_LANE_C:-0}"
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW="${PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW:-1}"
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE="${PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE:-gate}"
PARALLEL_CYCLE_STRICT="${PARALLEL_CYCLE_STRICT:-0}"

PRUNE_BUILDS="${PRUNE_BUILDS:-off}" # off|dry|apply
PRUNE_CAD_KEEP="${PRUNE_CAD_KEEP:-20}"
PRUNE_ROUNDTRIP_KEEP="${PRUNE_ROUNDTRIP_KEEP:-20}"

mkdir -p "$(dirname "$SUMMARY_JSON")"

if [[ "$PRUNE_BUILDS" != "off" ]]; then
  echo "[WEEKLY] prune_builds=$PRUNE_BUILDS cad_keep=$PRUNE_CAD_KEEP roundtrip_keep=$PRUNE_ROUNDTRIP_KEEP"
  PRUNE_CMD=(python3 tools/prune_build_runs.py --cad-keep "$PRUNE_CAD_KEEP" --roundtrip-keep "$PRUNE_ROUNDTRIP_KEEP")
  if [[ "$PRUNE_BUILDS" == "apply" ]]; then
    PRUNE_CMD+=(--apply)
  fi
  "${PRUNE_CMD[@]}"
fi

PRE_TREND_STATUS="n/a"
PRE_TREND_RECOMMENDED_LIMIT=""
GATE_LIMIT_SOURCE="default"
if [[ "$RUN_GATE" == "1" ]]; then
  if [[ -z "$GATE_SMOKE_LIMIT" && "$AUTO_GATE_LIMIT" == "1" ]]; then
    PRE_TREND_OUTPUT="$(python3 tools/editor_gate_trend.py \
      --history-dir build/editor_gate_history \
      --days "$TREND_DAYS" \
      --out-json "$PRE_TREND_JSON" \
      --out-md "$PRE_TREND_MD")"
    PRE_TREND_STATUS="$(echo "$PRE_TREND_OUTPUT" | awk -F= '/^trend_status=/{print $2; exit}')"
    PRE_TREND_RECOMMENDED_LIMIT="$(python3 - <<'PY' "$PRE_TREND_JSON"
import json, sys
path = sys.argv[1]
try:
    payload = json.load(open(path, 'r', encoding='utf-8'))
except Exception:
    print("")
    raise SystemExit(0)
policy = payload.get('gate_limit_policy') if isinstance(payload, dict) else {}
value = policy.get('recommended_gate_limit') if isinstance(policy, dict) else None
if isinstance(value, (int, float)) and int(value) > 0:
    print(int(value))
else:
    print("")
PY
)"
    if [[ "$PRE_TREND_RECOMMENDED_LIMIT" =~ ^[0-9]+$ ]] && [[ "$PRE_TREND_RECOMMENDED_LIMIT" -gt 0 ]]; then
      GATE_SMOKE_LIMIT="$PRE_TREND_RECOMMENDED_LIMIT"
    else
      GATE_SMOKE_LIMIT="$GATE_SMOKE_LIMIT_DEFAULT"
    fi
    GATE_LIMIT_SOURCE="auto-trend"
  elif [[ -n "$GATE_SMOKE_LIMIT" ]]; then
    GATE_LIMIT_SOURCE="manual-env"
  else
    GATE_SMOKE_LIMIT="$GATE_SMOKE_LIMIT_DEFAULT"
    GATE_LIMIT_SOURCE="default"
  fi
else
  if [[ -z "$GATE_SMOKE_LIMIT" ]]; then
    GATE_SMOKE_LIMIT="$GATE_SMOKE_LIMIT_DEFAULT"
  fi
  GATE_LIMIT_SOURCE="unused"
fi

echo "[WEEKLY] root=$ROOT_DIR"
echo "[WEEKLY] editor_smoke_mode=$EDITOR_SMOKE_MODE limit=$EDITOR_SMOKE_LIMIT"
echo "[WEEKLY] editor_smoke_cases=${EDITOR_SMOKE_CASES:-<discovery>} source=$EDITOR_SMOKE_CASE_SOURCE"
echo "[WEEKLY] editor_smoke_cases_count=$EDITOR_SMOKE_CASE_COUNT min_required=$EDITOR_SMOKE_MIN_CASES"
echo "[WEEKLY] editor_smoke_generate_cases=$EDITOR_SMOKE_GENERATE_CASES generated_path=$EDITOR_SMOKE_GENERATED_CASES_PATH generated_count=$EDITOR_SMOKE_GENERATED_COUNT generated_min=$EDITOR_SMOKE_GENERATED_MIN_CASES"
echo "[WEEKLY] editor_smoke_generated_mismatch_policy=$EDITOR_SMOKE_GENERATED_MISMATCH_POLICY"
echo "[WEEKLY] editor_smoke_generated_priorities=${EDITOR_SMOKE_GENERATED_PRIORITIES:-<none>}"
echo "[WEEKLY] editor_smoke_generated_run_id=${EDITOR_SMOKE_GENERATED_RUN_ID:-<none>}"
echo "[WEEKLY] editor_smoke_generated_run_ids=${EDITOR_SMOKE_GENERATED_RUN_IDS:-<none>}"
echo "[WEEKLY] editor_smoke_priority_set=${EDITOR_SMOKE_PRIORITY_SET:-<none>}"
echo "[WEEKLY] editor_smoke_tag_any=${EDITOR_SMOKE_TAG_ANY:-<none>}"
echo "[WEEKLY] ui_flow_smoke=$RUN_EDITOR_UI_FLOW_SMOKE mode=$EDITOR_UI_FLOW_MODE port=$EDITOR_UI_FLOW_PORT viewport=$EDITOR_UI_FLOW_VIEWPORT timeout_ms=$EDITOR_UI_FLOW_TIMEOUT_MS open_retries=$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES headed=$EDITOR_UI_FLOW_HEADED"
echo "[WEEKLY] ui_flow_gate_runs_target=$EDITOR_UI_FLOW_SMOKE_GATE_RUNS"
echo "[WEEKLY] ui_flow_failure_injection=$RUN_UI_FLOW_FAILURE_INJECTION timeout_ms=$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS strict=$UI_FLOW_FAILURE_INJECTION_STRICT"
echo "[WEEKLY] parallel_cycle=$RUN_EDITOR_PARALLEL_CYCLE watch_policy=$PARALLEL_CYCLE_WATCH_POLICY weekly_policy=$WEEKLY_PARALLEL_DECISION_POLICY lane_a=$PARALLEL_CYCLE_RUN_LANE_A lane_b=$PARALLEL_CYCLE_RUN_LANE_B lane_c=$PARALLEL_CYCLE_RUN_LANE_C lane_b_ui_flow=$PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW lane_b_ui_mode=$PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE lane_b_ui_timeout_ms=${PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS:-<default>} lane_b_ui_open_retries=${PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES:-<default>} strict=$PARALLEL_CYCLE_STRICT"
CAD_BASELINE_EXISTS="0"
if [[ -f "$CAD_BASELINE" ]]; then
  CAD_BASELINE_EXISTS="1"
fi
echo "[WEEKLY] cad_mode=$CAD_MODE max_workers=$CAD_MAX_WORKERS baseline=$CAD_BASELINE (exists=$CAD_BASELINE_EXISTS)"
echo "[WEEKLY] perf_entities=$PERF_ENTITIES pick=$PERF_PICK_SAMPLES box=$PERF_BOX_SAMPLES drag=$PERF_DRAG_SAMPLES repeat=$PERF_REPEAT"
echo "[WEEKLY] real_scene_perf=$RUN_REAL_SCENE_PERF mode=$REAL_SCENE_MODE profile=$REAL_SCENE_PROFILE repeat=$REAL_SCENE_REPEAT"
echo "[WEEKLY] gate_limit=$GATE_SMOKE_LIMIT source=$GATE_LIMIT_SOURCE pretrend_status=$PRE_TREND_STATUS"
echo "[WEEKLY] qt_policy days=$QT_PROJECT_POLICY_DAYS min_samples=$QT_PROJECT_POLICY_MIN_SAMPLES min_consecutive_passes=$QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES require_on_input=$GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON run_check=$GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK run_gate=$GATE_RUN_QT_PROJECT_PERSISTENCE_GATE"
echo "[WEEKLY] editor_gate_append_report=$EDITOR_GATE_APPEND_REPORT"
echo "[WEEKLY] legacy_preview_artifact_prep=$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP cases=$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES outdir=$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_OUTDIR"
echo "[WEEKLY] legacy_preview_artifact_smoke=$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE cases=$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES outdir=$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_OUTDIR"

echo "[WEEKLY] 1) Web editor command tests"
node --test tools/web_viewer/tests/editor_commands.test.js

UI_FLOW_STATUS="skipped"
UI_FLOW_RUN_ID=""
UI_FLOW_SUMMARY=""
UI_FLOW_RC="0"
UI_FLOW_RUNS_TARGET="0"
UI_FLOW_RUN_COUNT="0"
UI_FLOW_PASS_COUNT="0"
UI_FLOW_FAIL_COUNT="0"
UI_FLOW_RUN_SUMMARIES=""
UI_FLOW_FAILURE_CODE_COUNTS_JSON="{}"
UI_FLOW_FIRST_FAILURE_CODE=""
UI_FLOW_FAILURE_INJECTION_STATUS="SKIPPED"
UI_FLOW_FAILURE_INJECTION_RUN_ID=""
UI_FLOW_FAILURE_INJECTION_SUMMARY=""
UI_FLOW_FAILURE_INJECTION_RC="0"
UI_FLOW_FAILURE_INJECTION_FAILURE_CODE=""
UI_FLOW_FAILURE_INJECTION_FAILURE_DETAIL=""
if [[ "$RUN_EDITOR_UI_FLOW_SMOKE" == "1" ]]; then
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
  echo "[WEEKLY] 1.5) Editor UI flow smoke (mode=$EDITOR_UI_FLOW_MODE)"
  UI_FLOW_RUNS_TARGET="1"
  if [[ "$EDITOR_UI_FLOW_MODE" == "gate" ]]; then
    UI_FLOW_RUNS_TARGET="$EDITOR_UI_FLOW_SMOKE_GATE_RUNS"
  fi
  declare -a UI_FLOW_SUMMARY_PATHS=()

  for ((ui_run_idx=1; ui_run_idx<=UI_FLOW_RUNS_TARGET; ui_run_idx++)); do
    UI_FLOW_CMD=(bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode "$EDITOR_UI_FLOW_MODE" --port "$EDITOR_UI_FLOW_PORT" --viewport "$EDITOR_UI_FLOW_VIEWPORT" --timeout-ms "$EDITOR_UI_FLOW_TIMEOUT_MS" --pwcli-open-retries "$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES")
    if [[ "$EDITOR_UI_FLOW_HEADED" == "1" ]]; then
      UI_FLOW_CMD+=(--headed)
    fi
    if [[ -n "$EDITOR_UI_FLOW_OUTDIR" ]]; then
      if [[ "$UI_FLOW_RUNS_TARGET" -gt 1 ]]; then
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
    UI_FLOW_SUMMARY="$(echo "$UI_FLOW_OUT" | tail -n 1 | tr -d '\r')"
    UI_FLOW_RUN_COUNT=$((UI_FLOW_RUN_COUNT + 1))

    ui_run_ok="false"
    ui_run_id=""
    if [[ -f "$UI_FLOW_SUMMARY" ]]; then
      UI_FLOW_SUMMARY_PATHS+=("$UI_FLOW_SUMMARY")
      eval "$(
        python3 - "$UI_FLOW_SUMMARY" <<'PY'
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
status = "PASS" if ok else "FAIL"
ok_str = "true" if ok else "false"
print('UI_FLOW_RUN_ID_TMP="%s"' % shell_escape(run_id))
print('UI_FLOW_STATUS_TMP="%s"' % status)
print('UI_FLOW_OK_TMP="%s"' % ok_str)
PY
      )"
      UI_FLOW_RUN_ID="$UI_FLOW_RUN_ID_TMP"
      ui_run_id="$UI_FLOW_RUN_ID_TMP"
      ui_run_ok="$UI_FLOW_OK_TMP"
    fi

    if [[ "$ui_run_ok" == "true" ]]; then
      UI_FLOW_PASS_COUNT=$((UI_FLOW_PASS_COUNT + 1))
      echo "[WEEKLY] ui_flow run $ui_run_idx/$UI_FLOW_RUNS_TARGET PASS run_id=$ui_run_id"
    else
      UI_FLOW_FAIL_COUNT=$((UI_FLOW_FAIL_COUNT + 1))
      echo "[WEEKLY] ui_flow run $ui_run_idx/$UI_FLOW_RUNS_TARGET FAIL run_id=$ui_run_id"
    fi
  done

  if [[ "$UI_FLOW_FAIL_COUNT" -eq 0 && "$UI_FLOW_RUN_COUNT" -ge "$UI_FLOW_RUNS_TARGET" ]]; then
    UI_FLOW_STATUS="PASS"
  else
    UI_FLOW_STATUS="FAIL"
  fi
  if [[ "${#UI_FLOW_SUMMARY_PATHS[@]}" -gt 0 ]]; then
    UI_LAST_INDEX=$(( ${#UI_FLOW_SUMMARY_PATHS[@]} - 1 ))
    UI_FLOW_SUMMARY="${UI_FLOW_SUMMARY_PATHS[$UI_LAST_INDEX]}"
    UI_FLOW_RUN_SUMMARIES="$(IFS='|'; echo "${UI_FLOW_SUMMARY_PATHS[*]}")"
    eval "$(
      python3 - "$UI_FLOW_RUN_SUMMARIES" <<'PY'
import json
import sys

def shell_escape(text: str) -> str:
  return str(text or "").replace("\\", "\\\\").replace('"', '\\"')

def load_json(path: str):
  try:
    payload = json.load(open(path, "r", encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}
  except Exception:
    return {}

def first_nonempty(values):
  for value in values:
    text = str(value or "").strip()
    if text:
      return text
  return ""

def classify(payload: dict):
  if payload.get("ok") is True:
    return ("", "")
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

paths = [p for p in str(sys.argv[1] or "").split("|") if p]
counts = {}
first_code = ""
for path in paths:
  payload = load_json(path)
  code, _detail = classify(payload)
  if not code:
    continue
  counts[code] = int(counts.get(code, 0)) + 1
  if not first_code:
    first_code = code

print('UI_FLOW_FAILURE_CODE_COUNTS_JSON="%s"' % shell_escape(json.dumps(counts, ensure_ascii=False, separators=(",", ":"))))
print('UI_FLOW_FIRST_FAILURE_CODE="%s"' % shell_escape(first_code))
PY
    )"
  fi
fi

if [[ "$RUN_UI_FLOW_FAILURE_INJECTION" == "1" ]]; then
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
  echo "[WEEKLY] 1.6) UI flow failure injection smoke (expected fail, timeout_ms=$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS)"
  UI_FLOW_INJECT_CMD=(bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$EDITOR_UI_FLOW_PORT" --viewport "$EDITOR_UI_FLOW_VIEWPORT" --timeout-ms "$UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS" --pwcli-open-retries "$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES")
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
  UI_FLOW_FAILURE_INJECTION_RC="$ui_flow_inject_rc"
  UI_FLOW_FAILURE_INJECTION_SUMMARY="$(echo "$UI_FLOW_INJECT_OUT" | tail -n 1 | tr -d '\r')"
  eval "$(
    python3 - "$UI_FLOW_FAILURE_INJECTION_SUMMARY" <<'PY'
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
ok = payload.get("ok") is True
status = "PASS" if (not ok) else "FAIL"
code, detail = classify(payload)
if ok:
  code = "UI_FLOW_EXPECTED_FAIL_NOT_TRIGGERED"
  detail = "failure injection unexpectedly passed"
elif not code:
  code = "UI_FLOW_UNKNOWN_FAIL"
if len(detail) > 300:
  detail = detail[:300] + "..."
print('UI_FLOW_FAILURE_INJECTION_RUN_ID="%s"' % shell_escape(run_id))
print('UI_FLOW_FAILURE_INJECTION_STATUS="%s"' % shell_escape(status))
print('UI_FLOW_FAILURE_INJECTION_FAILURE_CODE="%s"' % shell_escape(code))
print('UI_FLOW_FAILURE_INJECTION_FAILURE_DETAIL="%s"' % shell_escape(detail))
PY
  )"
  if [[ "$UI_FLOW_FAILURE_INJECTION_STATUS" == "PASS" ]]; then
    echo "[WEEKLY] ui_flow failure injection PASS run_id=$UI_FLOW_FAILURE_INJECTION_RUN_ID code=$UI_FLOW_FAILURE_INJECTION_FAILURE_CODE"
  else
    echo "[WEEKLY] ui_flow failure injection FAIL run_id=$UI_FLOW_FAILURE_INJECTION_RUN_ID code=$UI_FLOW_FAILURE_INJECTION_FAILURE_CODE"
    if [[ "$UI_FLOW_FAILURE_INJECTION_STRICT" == "1" ]]; then
      echo "[WEEKLY] ui_flow failure injection strict mode enabled; failing run"
      exit 2
    fi
  fi
fi

echo "[WEEKLY] 2) Editor round-trip smoke"
SMOKE_CMD=(node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode "$EDITOR_SMOKE_MODE" --limit "$EDITOR_SMOKE_LIMIT")
if [[ -n "$EDITOR_SMOKE_CASES" ]]; then
  SMOKE_CMD+=(--cases "$EDITOR_SMOKE_CASES")
fi
if [[ -n "$EDITOR_SMOKE_PRIORITY_SET" ]]; then
  SMOKE_CMD+=(--priority-set "$EDITOR_SMOKE_PRIORITY_SET")
fi
if [[ -n "$EDITOR_SMOKE_TAG_ANY" ]]; then
  SMOKE_CMD+=(--tag-any "$EDITOR_SMOKE_TAG_ANY")
fi
SMOKE_OUTPUT="$("${SMOKE_CMD[@]}")"
echo "$SMOKE_OUTPUT"
EDITOR_SMOKE_RUN_ID="$(echo "$SMOKE_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
EDITOR_SMOKE_RUN_DIR="$(echo "$SMOKE_OUTPUT" | awk -F= '/^run_dir=/{print $2; exit}')"
EDITOR_SMOKE_SUMMARY="$(echo "$SMOKE_OUTPUT" | awk -F= '/^summary_json=/{print $2; exit}')"

echo "[WEEKLY] 3) STEP166 cad regression"
CAD_CMD=(./scripts/cad_regression_run.py --mode "$CAD_MODE" --max-workers "$CAD_MAX_WORKERS")
# Always compare against the current baseline when it exists, even in observe mode.
# This keeps weekly reports attributable and makes baseline refresh eligibility meaningful.
if [[ -f "$CAD_BASELINE" ]]; then
  CAD_CMD+=(--baseline "$CAD_BASELINE")
fi
CAD_OUTPUT="$("${CAD_CMD[@]}")"
echo "$CAD_OUTPUT"
CAD_RUN_ID="$(echo "$CAD_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
CAD_RUN_DIR="$(echo "$CAD_OUTPUT" | awk -F= '/^run_dir=/{print $2; exit}')"
CAD_SUMMARY="$(echo "$CAD_OUTPUT" | awk -F= '/^summary=/{print $2; exit}')"
CAD_FAILURES="$(echo "$CAD_OUTPUT" | awk -F= '/^failures=/{print $2; exit}')"
CAD_TREND_INPUT="$(echo "$CAD_OUTPUT" | awk -F= '/^trend_input=/{print $2; exit}')"
CAD_GATE_WOULD_FAIL="$(echo "$CAD_OUTPUT" | awk -F= '/^gate_would_fail=/{print $2; exit}')"

if [[ "$RUN_STEP166_BASELINE_REFRESH" == "1" ]]; then
  echo "[WEEKLY] 3.5) STEP166 baseline refresh (policy: ${STEP166_BASELINE_REFRESH_DAYS}d stable window)"
  REFRESH_CMD=(python3 tools/refresh_step166_baseline.py --history-dir build/cad_regression --baseline "$CAD_BASELINE" --days "$STEP166_BASELINE_REFRESH_DAYS")
  if [[ "$STEP166_BASELINE_REFRESH_APPLY" == "1" ]]; then
    REFRESH_CMD+=(--apply)
  else
    REFRESH_CMD+=(--dry-run)
  fi
  set +e
  REFRESH_OUTPUT="$("${REFRESH_CMD[@]}" 2>&1)"
  REFRESH_RC=$?
  set -e
  echo "$REFRESH_OUTPUT"

  STEP166_BASELINE_REFRESH_RC="$REFRESH_RC"
  STEP166_BASELINE_REFRESH_ELIGIBLE="$(echo "$REFRESH_OUTPUT" | awk -F= '/^eligible=/{print $2; exit}')"
  STEP166_BASELINE_REFRESH_APPLIED="$(echo "$REFRESH_OUTPUT" | awk -F= '/^applied=/{print $2; exit}')"
  STEP166_BASELINE_REFRESH_REASON="$(echo "$REFRESH_OUTPUT" | awk -F= '/^reason=/{sub(/^reason=/,""); print; exit}')"
  STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID="$(echo "$REFRESH_OUTPUT" | awk -F= '/^candidate_run_id=/{print $2; exit}')"
  STEP166_BASELINE_REFRESH_BACKUP_PATH="$(echo "$REFRESH_OUTPUT" | awk -F= '/^backup_path=/{sub(/^backup_path=/,""); print; exit}')"
  STEP166_BASELINE_REFRESH_WINDOW_REPORT="$(echo "$REFRESH_OUTPUT" | awk -F= '/^window_report_json=/{sub(/^window_report_json=/,""); print; exit}')"

  export STEP166_BASELINE_REFRESH_RC
  export STEP166_BASELINE_REFRESH_ELIGIBLE
  export STEP166_BASELINE_REFRESH_APPLIED
  export STEP166_BASELINE_REFRESH_REASON
  export STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID
  export STEP166_BASELINE_REFRESH_BACKUP_PATH
  export STEP166_BASELINE_REFRESH_WINDOW_REPORT
fi

if [[ "$RUN_GATE" == "1" && "$EDITOR_SMOKE_GENERATE_CASES" == "1" ]]; then
  mkdir -p "$(dirname "$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH")"
  GATE_EDITOR_SMOKE_GENERATED_PRIORITIES="${GATE_SMOKE_PRIORITY_SET:-$EDITOR_SMOKE_GENERATED_PRIORITIES}"
  GATE_GENERATED_META="$(
    python3 tools/generate_editor_roundtrip_cases.py \
      --run-id "$CAD_RUN_ID" \
      --limit "$GATE_SMOKE_LIMIT" \
      --priorities "$GATE_EDITOR_SMOKE_GENERATED_PRIORITIES" \
      --out "$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH" 2>/dev/null || true
  )"
  GATE_EDITOR_SMOKE_GENERATED_RUN_ID="$(printf '%s\n' "$GATE_GENERATED_META" | awk -F= '/^selected_run_id=/{print $2; exit}')"
  GATE_EDITOR_SMOKE_GENERATED_RUN_IDS="$(printf '%s\n' "$GATE_GENERATED_META" | awk -F= '/^selected_run_ids=/{print $2; exit}')"
  if [[ -f "$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH" ]]; then
    GATE_EDITOR_SMOKE_GENERATED_COUNT="$(count_case_items "$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH")"
  fi
  if ! [[ "$GATE_EDITOR_SMOKE_GENERATED_COUNT" =~ ^[0-9]+$ ]]; then
    GATE_EDITOR_SMOKE_GENERATED_COUNT=0
  fi
  GATE_EDITOR_SMOKE_GENERATED_COUNT_DECLARED="$GATE_EDITOR_SMOKE_GENERATED_COUNT"
  GATE_EDITOR_SMOKE_GENERATED_COUNT_ACTUAL="$GATE_EDITOR_SMOKE_GENERATED_COUNT"
  GATE_EDITOR_SMOKE_GENERATED_COUNT_MISMATCH=0
  if [[ "$GATE_EDITOR_SMOKE_GENERATED_COUNT" -ge "$EDITOR_SMOKE_GENERATED_MIN_CASES" ]]; then
    GATE_EDITOR_SMOKE_CASES="$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH"
    GATE_EDITOR_SMOKE_CASE_SOURCE="generated"
  fi
fi

echo "[WEEKLY] 4) Editor performance smoke"
PERF_RUN_ID=""
PERF_RUN_DIR=""
PERF_SUMMARY=""
if [[ "$PERF_REPEAT" =~ ^[0-9]+$ ]] && [[ "$PERF_REPEAT" -gt 1 ]]; then
  PERF_BATCH_ID="$(python3 - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
PY
)"
  PERF_BATCH_DIR="build/editor_perf_batch/${PERF_BATCH_ID}"
  mkdir -p "$PERF_BATCH_DIR"
  echo "[WEEKLY] perf repeat=$PERF_REPEAT interval_sec=$PERF_INTERVAL_SEC batch=$PERF_BATCH_ID"

  PERF_RUN_SUMMARIES=()
  for ((i=1; i<=PERF_REPEAT; i++)); do
    echo "[WEEKLY] perf run $i/$PERF_REPEAT"
    OUT="$(node tools/web_viewer/scripts/editor_performance_smoke.js \
      --entities "$PERF_ENTITIES" \
      --pick-samples "$PERF_PICK_SAMPLES" \
      --box-samples "$PERF_BOX_SAMPLES" \
      --drag-samples "$PERF_DRAG_SAMPLES" \
      --label "$PERF_LABEL")"
    echo "$OUT"
    SUMMARY_PATH="$(echo "$OUT" | awk -F= '/^summary_json=/{print $2; exit}')"
    if [[ -n "$SUMMARY_PATH" ]]; then
      PERF_RUN_SUMMARIES+=("$SUMMARY_PATH")
    fi
    if [[ "$PERF_INTERVAL_SEC" =~ ^[0-9]+$ ]] && [[ "$PERF_INTERVAL_SEC" -gt 0 ]] && [[ "$i" -lt "$PERF_REPEAT" ]]; then
      sleep "$PERF_INTERVAL_SEC"
    fi
  done

  python3 - "$PERF_BATCH_DIR/summary.json" "$PERF_BATCH_DIR/summary.md" "${PERF_RUN_SUMMARIES[@]}" <<'PY'
import json
import os
import sys
from statistics import median
from datetime import datetime, timezone

out_json = sys.argv[1]
out_md = sys.argv[2]
paths = sys.argv[3:]

def load(path):
  try:
    with open(path, "r", encoding="utf-8") as f:
      return json.load(f)
  except Exception:
    return None

def pick_number(value):
  return float(value) if isinstance(value, (int, float)) else None

runs = []
for path in paths:
  payload = load(path)
  if not isinstance(payload, dict):
    continue
  metrics = payload.get("metrics") if isinstance(payload.get("metrics"), dict) else {}
  run = {
    "run_id": payload.get("run_id", ""),
    "label": payload.get("label", ""),
    "summary_json": path,
    "config": payload.get("config") if isinstance(payload.get("config"), dict) else {},
    "metrics": {
      "pick_p95_ms": pick_number(metrics.get("pick", {}).get("p95_ms")),
      "box_p95_ms": pick_number(metrics.get("box_query", {}).get("p95_ms")),
      "drag_p95_ms": pick_number(metrics.get("drag_commit", {}).get("p95_ms")),
    },
  }
  runs.append(run)

def median_or_zero(values):
  xs = [x for x in values if isinstance(x, (int, float))]
  return float(median(xs)) if xs else 0.0

agg_metrics = {
  "pick_p95_ms_median": median_or_zero([r["metrics"]["pick_p95_ms"] for r in runs]),
  "box_p95_ms_median": median_or_zero([r["metrics"]["box_p95_ms"] for r in runs]),
  "drag_p95_ms_median": median_or_zero([r["metrics"]["drag_p95_ms"] for r in runs]),
}

status = "PASS" if runs else "FAIL"
fail_reasons = [] if runs else ["NO_RUNS"]

payload = {
  "run_id": os.path.basename(os.path.dirname(out_json)) if out_json else "",
  "generated_at": datetime.now(timezone.utc).isoformat(),
  "status": status,
  "repeat": len(runs),
  "runs": runs,
  "aggregate": {
    "method": "median_p95",
    "metrics": agg_metrics,
  },
  "gate_decision": {
    "would_fail": bool(fail_reasons),
    "fail_reasons": fail_reasons,
  },
}

os.makedirs(os.path.dirname(out_json), exist_ok=True)
with open(out_json, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
  f.write("\n")

lines = []
lines.append("# Editor Performance (Batch)")
lines.append("")
lines.append(f"- generated_at: `{payload['generated_at']}`")
lines.append(f"- repeat: `{payload['repeat']}`")
lines.append(f"- status: `{payload['status']}`")
lines.append("")
lines.append("| metric | median_p95_ms |")
lines.append("| --- | ---: |")
lines.append(f"| pick | {agg_metrics['pick_p95_ms_median']:.6f} |")
lines.append(f"| box_query | {agg_metrics['box_p95_ms_median']:.6f} |")
lines.append(f"| drag_commit | {agg_metrics['drag_p95_ms_median']:.6f} |")
lines.append("")
lines.append(f"- gate_would_fail(median): `{payload['gate_decision']['would_fail']}`")
lines.append("")

os.makedirs(os.path.dirname(out_md), exist_ok=True)
with open(out_md, "w", encoding="utf-8") as f:
  f.write("\n".join(lines))
  f.write("\n")
PY

  python3 - <<'PY' "$PERF_BATCH_DIR/summary.json"
import json, sys
payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(f"status={payload.get('status','')}")
print(f"run_id={payload.get('run_id','')}")
print(f"summary_json={sys.argv[1]}")
PY

  PERF_RUN_ID="$PERF_BATCH_ID"
  PERF_RUN_DIR="$PERF_BATCH_DIR"
  PERF_SUMMARY="$PERF_BATCH_DIR/summary.json"
else
  PERF_OUTPUT="$(node tools/web_viewer/scripts/editor_performance_smoke.js \
    --entities "$PERF_ENTITIES" \
    --pick-samples "$PERF_PICK_SAMPLES" \
    --box-samples "$PERF_BOX_SAMPLES" \
    --drag-samples "$PERF_DRAG_SAMPLES" \
    --label "$PERF_LABEL")"
  echo "$PERF_OUTPUT"
  PERF_RUN_ID="$(echo "$PERF_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
  PERF_RUN_DIR="$(echo "$PERF_OUTPUT" | awk -F= '/^run_dir=/{print $2; exit}')"
  PERF_SUMMARY="$(echo "$PERF_OUTPUT" | awk -F= '/^summary_json=/{print $2; exit}')"
fi

REAL_SCENE_STATUS="skipped"
REAL_SCENE_RUN_ID=""
REAL_SCENE_SUMMARY=""
REAL_SCENE_GATE_WOULD_FAIL=""
if [[ "$RUN_REAL_SCENE_PERF" == "1" ]]; then
  echo "[WEEKLY] 5) Real scene perf smoke"
  if [[ "$REAL_SCENE_REPEAT" =~ ^[0-9]+$ ]] && [[ "$REAL_SCENE_REPEAT" -gt 1 ]]; then
    BATCH_ID="$(python3 - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
PY
)"
    BATCH_DIR="build/editor_real_scene_perf_batch/${BATCH_ID}"
    mkdir -p "$BATCH_DIR"
    echo "[WEEKLY] real_scene repeat=$REAL_SCENE_REPEAT interval_sec=$REAL_SCENE_INTERVAL_SEC batch=$BATCH_ID"

    RUN_SUMMARIES=()
    for ((i=1; i<=REAL_SCENE_REPEAT; i++)); do
      echo "[WEEKLY] real_scene run $i/$REAL_SCENE_REPEAT"
      OUT="$(node tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode "$REAL_SCENE_MODE" --profile "$REAL_SCENE_PROFILE")"
      echo "$OUT"
      SUMMARY_PATH="$(echo "$OUT" | awk -F= '/^summary_json=/{print $2; exit}')"
      if [[ -n "$SUMMARY_PATH" ]]; then
        RUN_SUMMARIES+=("$SUMMARY_PATH")
      fi
      if [[ "$REAL_SCENE_INTERVAL_SEC" =~ ^[0-9]+$ ]] && [[ "$REAL_SCENE_INTERVAL_SEC" -gt 0 ]] && [[ "$i" -lt "$REAL_SCENE_REPEAT" ]]; then
        sleep "$REAL_SCENE_INTERVAL_SEC"
      fi
    done

    python3 - "$BATCH_DIR/summary.json" "$BATCH_DIR/summary.md" "${RUN_SUMMARIES[@]}" <<'PY'
import json
import os
import sys
from statistics import median
from datetime import datetime, timezone

out_json = sys.argv[1]
out_md = sys.argv[2]
paths = sys.argv[3:]

def load(path):
  try:
    with open(path, "r", encoding="utf-8") as f:
      return json.load(f)
  except Exception:
    return None

def pick_number(value):
  return float(value) if isinstance(value, (int, float)) else None

runs = []
for path in paths:
  payload = load(path)
  if not isinstance(payload, dict):
    continue
  metrics = payload.get("metrics") if isinstance(payload.get("metrics"), dict) else {}
  thresholds = payload.get("thresholds") if isinstance(payload.get("thresholds"), dict) else {}
  gate = payload.get("gate_decision") if isinstance(payload.get("gate_decision"), dict) else {}
  run = {
    "run_id": payload.get("run_id", ""),
    "mode": payload.get("mode", ""),
    "status": payload.get("status", ""),
    "profile": payload.get("profile", ""),
    "input_doc": payload.get("input_doc", ""),
    "summary_json": path,
    "gate_would_fail": gate.get("would_fail") is True,
    "fail_reasons": gate.get("fail_reasons") if isinstance(gate.get("fail_reasons"), list) else [],
    "metrics": {
      "pick_p95_ms": pick_number(metrics.get("pick", {}).get("p95_ms")),
      "box_p95_ms": pick_number(metrics.get("box_query", {}).get("p95_ms")),
      "drag_p95_ms": pick_number(metrics.get("drag_commit", {}).get("p95_ms")),
    },
    "thresholds": {
      "pick_p95_ms": pick_number(thresholds.get("pick_p95_ms")),
      "box_p95_ms": pick_number(thresholds.get("box_p95_ms")),
      "drag_p95_ms": pick_number(thresholds.get("drag_p95_ms")),
    },
  }
  runs.append(run)

def median_or_zero(values):
  xs = [x for x in values if isinstance(x, (int, float))]
  return float(median(xs)) if xs else 0.0

agg_metrics = {
  "pick_p95_ms_median": median_or_zero([r["metrics"]["pick_p95_ms"] for r in runs]),
  "box_p95_ms_median": median_or_zero([r["metrics"]["box_p95_ms"] for r in runs]),
  "drag_p95_ms_median": median_or_zero([r["metrics"]["drag_p95_ms"] for r in runs]),
}

base_thresholds = runs[0]["thresholds"] if runs else {}
fail_reasons = []
if runs:
  if base_thresholds.get("pick_p95_ms") is not None and agg_metrics["pick_p95_ms_median"] > base_thresholds["pick_p95_ms"]:
    fail_reasons.append(f"MEDIAN_PICK_P95>{base_thresholds['pick_p95_ms']} ({agg_metrics['pick_p95_ms_median']:.6f})")
  if base_thresholds.get("box_p95_ms") is not None and agg_metrics["box_p95_ms_median"] > base_thresholds["box_p95_ms"]:
    fail_reasons.append(f"MEDIAN_BOX_P95>{base_thresholds['box_p95_ms']} ({agg_metrics['box_p95_ms_median']:.6f})")
  if base_thresholds.get("drag_p95_ms") is not None and agg_metrics["drag_p95_ms_median"] > base_thresholds["drag_p95_ms"]:
    fail_reasons.append(f"MEDIAN_DRAG_P95>{base_thresholds['drag_p95_ms']} ({agg_metrics['drag_p95_ms_median']:.6f})")
else:
  fail_reasons.append("NO_RUNS")

run_fail_count = sum(1 for r in runs if r.get("status") != "PASS")

payload = {
  "run_id": os.path.basename(os.path.dirname(out_json)) if out_json else "",
  "generated_at": datetime.now(timezone.utc).isoformat(),
  "mode": runs[0].get("mode", "") if runs else "",
  "status": "PASS" if not fail_reasons else "FAIL",
  "profile": runs[0].get("profile", "") if runs else "",
  "input_doc": runs[0].get("input_doc", "") if runs else "",
  "thresholds": base_thresholds,
  "metrics": {
    "pick": {"p95_ms": agg_metrics["pick_p95_ms_median"]},
    "box_query": {"p95_ms": agg_metrics["box_p95_ms_median"]},
    "drag_commit": {"p95_ms": agg_metrics["drag_p95_ms_median"]},
  },
  "repeat": len(runs),
  "runs": runs,
  "aggregate": {
    "method": "median_p95",
    "metrics": agg_metrics,
    "thresholds": base_thresholds,
    "run_fail_count": run_fail_count,
  },
  "gate_decision": {
    "would_fail": bool(fail_reasons),
    "fail_reasons": fail_reasons,
  },
}

os.makedirs(os.path.dirname(out_json), exist_ok=True)
with open(out_json, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
  f.write("\n")

lines = []
lines.append("# Editor Real Scene Performance (Batch)")
lines.append("")
lines.append(f"- generated_at: `{payload['generated_at']}`")
lines.append(f"- repeat: `{payload['repeat']}`")
lines.append(f"- status: `{payload['status']}`")
lines.append("")
lines.append("| metric | median_p95_ms | threshold_ms |")
lines.append("| --- | ---: | ---: |")
lines.append(f"| pick | {agg_metrics['pick_p95_ms_median']:.6f} | {base_thresholds.get('pick_p95_ms','')} |")
lines.append(f"| box_query | {agg_metrics['box_p95_ms_median']:.6f} | {base_thresholds.get('box_p95_ms','')} |")
lines.append(f"| drag_commit | {agg_metrics['drag_p95_ms_median']:.6f} | {base_thresholds.get('drag_p95_ms','')} |")
lines.append("")
lines.append(f"- run_fail_count: `{run_fail_count}`")
lines.append(f"- gate_would_fail(median): `{payload['gate_decision']['would_fail']}`")
lines.append("")

os.makedirs(os.path.dirname(out_md), exist_ok=True)
with open(out_md, "w", encoding="utf-8") as f:
  f.write("\n".join(lines))
  f.write("\n")
PY

    python3 - <<'PY' "$BATCH_DIR/summary.json"
import json, sys
path = sys.argv[1]
payload = json.load(open(path, "r", encoding="utf-8"))
print(f"status={payload.get('status','')}")
print(f"run_id={payload.get('run_id','')}")
print(f"summary_json={path}")
print(f"gate_would_fail={payload.get('gate_decision',{}).get('would_fail') is True}")
PY
    REAL_SCENE_STATUS="$(python3 - <<'PY' "$BATCH_DIR/summary.json"
import json, sys
payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(payload.get("status",""))
PY
)"
    REAL_SCENE_RUN_ID="$BATCH_ID"
    REAL_SCENE_SUMMARY="$BATCH_DIR/summary.json"
    REAL_SCENE_GATE_WOULD_FAIL="$(python3 - <<'PY' "$BATCH_DIR/summary.json"
import json, sys
payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print("true" if payload.get("gate_decision",{}).get("would_fail") is True else "false")
PY
)"
  else
    REAL_SCENE_OUT="$(node tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode "$REAL_SCENE_MODE" --profile "$REAL_SCENE_PROFILE")"
    echo "$REAL_SCENE_OUT"
    REAL_SCENE_STATUS="$(echo "$REAL_SCENE_OUT" | awk -F= '/^status=/{print $2; exit}')"
    REAL_SCENE_RUN_ID="$(echo "$REAL_SCENE_OUT" | awk -F= '/^run_id=/{print $2; exit}')"
    REAL_SCENE_SUMMARY="$(echo "$REAL_SCENE_OUT" | awk -F= '/^summary_json=/{print $2; exit}')"
    REAL_SCENE_GATE_WOULD_FAIL="$(echo "$REAL_SCENE_OUT" | awk -F= '/^gate_would_fail=/{print $2; exit}')"
  fi
fi

QT_PROJECT_POLICY_STATUS="no_data"
QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON="0"
QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE="0"
QT_PROJECT_POLICY_REQUIRE_ON_SOURCE="auto-policy"
QT_PROJECT_POLICY_OUTPUT="$(python3 tools/qt_project_persistence_gate_policy.py \
  --history-dir build/editor_gate_history \
  --days "$QT_PROJECT_POLICY_DAYS" \
  --min-samples "$QT_PROJECT_POLICY_MIN_SAMPLES" \
  --min-consecutive-passes "$QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES" \
  --out-json "$QT_PROJECT_POLICY_JSON" \
  --out-md "$QT_PROJECT_POLICY_MD")"
echo "[WEEKLY] 5.5) Qt project persistence gate policy"
echo "$QT_PROJECT_POLICY_OUTPUT"
QT_PROJECT_POLICY_STATUS="$(echo "$QT_PROJECT_POLICY_OUTPUT" | awk -F= '/^qt_policy_status=/{print $2; exit}')"
QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON="$(echo "$QT_PROJECT_POLICY_OUTPUT" | awk -F= '/^qt_policy_recommended_require_on=/{print $2; exit}')"
if [[ "$QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON" != "0" && "$QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON" != "1" ]]; then
  QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON="0"
fi

case "$GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON" in
  auto|"")
    QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE="$QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON"
    QT_PROJECT_POLICY_REQUIRE_ON_SOURCE="auto-policy"
    ;;
  0|1)
    QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE="$GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON"
    QT_PROJECT_POLICY_REQUIRE_ON_SOURCE="manual-env"
    ;;
  *)
    echo "[WEEKLY] WARN invalid GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON=$GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON, fallback to auto policy"
    QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE="$QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON"
    QT_PROJECT_POLICY_REQUIRE_ON_SOURCE="auto-policy-fallback"
    ;;
esac
echo "[WEEKLY] qt_policy status=$QT_PROJECT_POLICY_STATUS recommended_require_on=$QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON effective_require_on=$QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE source=$QT_PROJECT_POLICY_REQUIRE_ON_SOURCE"
echo "[WEEKLY] gate_editor_smoke_cases=${GATE_EDITOR_SMOKE_CASES:-<discovery>} source=$GATE_EDITOR_SMOKE_CASE_SOURCE"
echo "[WEEKLY] gate_editor_smoke_generated_path=$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH count=$GATE_EDITOR_SMOKE_GENERATED_COUNT priorities=${GATE_EDITOR_SMOKE_GENERATED_PRIORITIES:-<none>}"
echo "[WEEKLY] gate_editor_smoke_generated_mismatch_policy=$GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY"
echo "[WEEKLY] gate_editor_smoke_generated_run_id=${GATE_EDITOR_SMOKE_GENERATED_RUN_ID:-<none>}"
echo "[WEEKLY] gate_editor_smoke_generated_run_ids=${GATE_EDITOR_SMOKE_GENERATED_RUN_IDS:-<none>}"

GATE_STATUS="${GATE_STATUS:-skipped}"
GATE_SUMMARY="${GATE_SUMMARY:-}"
GATE_RC="0"
if [[ "$RUN_GATE" == "1" ]]; then
  echo "[WEEKLY] 6) One-button gate"
  set +e
  EDITOR_SMOKE_LIMIT="$GATE_SMOKE_LIMIT" \
    EDITOR_SMOKE_CASES="$GATE_EDITOR_SMOKE_CASES" \
    EDITOR_SMOKE_CASE_SOURCE="$GATE_EDITOR_SMOKE_CASE_SOURCE" \
    EDITOR_SMOKE_GENERATED_CASES_PATH="$GATE_EDITOR_SMOKE_GENERATED_CASES_PATH" \
    EDITOR_SMOKE_GENERATED_COUNT="$GATE_EDITOR_SMOKE_GENERATED_COUNT" \
    EDITOR_SMOKE_GENERATED_MISMATCH_POLICY="$GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY" \
    EDITOR_SMOKE_GENERATED_MIN_CASES="$EDITOR_SMOKE_GENERATED_MIN_CASES" \
    EDITOR_SMOKE_GENERATED_PRIORITIES="$GATE_EDITOR_SMOKE_GENERATED_PRIORITIES" \
    EDITOR_SMOKE_GENERATED_RUN_ID="$GATE_EDITOR_SMOKE_GENERATED_RUN_ID" \
    EDITOR_SMOKE_GENERATED_RUN_IDS="$GATE_EDITOR_SMOKE_GENERATED_RUN_IDS" \
    EDITOR_SMOKE_PRIORITY_SET="$GATE_SMOKE_PRIORITY_SET" \
    EDITOR_SMOKE_TAG_ANY="$GATE_SMOKE_TAG_ANY" \
    RUN_PERF_TREND=0 \
    RUN_REAL_SCENE_TREND=0 \
    RUN_QT_PROJECT_PERSISTENCE_CHECK="$GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK" \
    RUN_QT_PROJECT_PERSISTENCE_GATE="$GATE_RUN_QT_PROJECT_PERSISTENCE_GATE" \
    QT_PROJECT_PERSISTENCE_REQUIRE_ON="$QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE" \
    EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES="$EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES" \
    CAD_ATTEMPTS="$GATE_CAD_ATTEMPTS" \
    EDITOR_GATE_APPEND_REPORT="$EDITOR_GATE_APPEND_REPORT" \
    bash tools/editor_gate.sh
  GATE_RC="$?"
  set -e
  if [[ "$GATE_RC" -eq 0 ]]; then
    GATE_STATUS="ok"
  else
    GATE_STATUS="fail"
    echo "[WEEKLY] WARN gate command rc=$GATE_RC (continuing to weekly summary/report append)"
  fi
  GATE_SUMMARY="build/editor_gate_summary.json"
elif [[ -n "$GATE_SUMMARY" ]]; then
  GATE_STATUS="reused"
fi

if [[ -z "$GATE_SUMMARY" && "$RUN_GATE" == "1" && -f "build/editor_gate_summary.json" ]]; then
  GATE_SUMMARY="build/editor_gate_summary.json"
fi
if [[ -z "$GATE_STATUS" && "$RUN_GATE" == "1" ]]; then
  if [[ "${GATE_RC:-0}" -eq 0 ]]; then
    GATE_STATUS="ok"
  else
    GATE_STATUS="fail"
  fi
fi
export GATE_STATUS GATE_SUMMARY GATE_RC

WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="skipped"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RUN_ID=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RC="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASE_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_PASS_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FAIL_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FIRST_FAILED_CASE=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_MISSING_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS="skipped"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RUN_ID=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RC="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASE_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_PASS_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FAIL_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FIRST_FAILED_CASE=""
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_INPUT_COUNT="0"
WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_MANIFEST_COUNT="0"
if [[ "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP" == "1" ]]; then
  echo "[WEEKLY] 6.4) Legacy preview artifact prep"
  set +e
  LEGACY_PREP_OUTPUT="$(python3 tools/prepare_legacy_preview_artifacts.py \
    --cases "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES" \
    --outdir "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_OUTDIR" 2>&1)"
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RC="$?"
  set -e
  printf '%s\n' "$LEGACY_PREP_OUTPUT"
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RUN_ID="$(printf '%s\n' "$LEGACY_PREP_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY="$(printf '%s\n' "$LEGACY_PREP_OUTPUT" | awk -F= '/^summary_json=/{print $2; exit}')"
  if [[ -f "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY" ]]; then
    LEGACY_PREP_COUNTS=()
    while IFS= read -r line; do
      LEGACY_PREP_COUNTS+=("$line")
    done < <(python3 - "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
results = data.get('results', [])
failed = [r for r in results if r.get('status') != 'ok']
print(data.get('passed', 0))
print(data.get('failed', 0))
print(len(results))
print(failed[0].get('id', '') if failed else '')
print(data.get('missing_input_count', 0))
print(data.get('missing_manifest_count', 0))
PY
)
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_PASS_COUNT="${LEGACY_PREP_COUNTS[0]:-0}"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FAIL_COUNT="${LEGACY_PREP_COUNTS[1]:-0}"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASE_COUNT="${LEGACY_PREP_COUNTS[2]:-0}"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FIRST_FAILED_CASE="${LEGACY_PREP_COUNTS[3]:-}"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_INPUT_COUNT="${LEGACY_PREP_COUNTS[4]:-0}"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_MANIFEST_COUNT="${LEGACY_PREP_COUNTS[5]:-0}"
  fi
  if [[ "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RC" -eq 0 && "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FAIL_COUNT" -eq 0 ]]; then
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS="ok"
  elif [[ "${WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_INPUT_COUNT}" != "0" || "${WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_MANIFEST_COUNT}" != "0" ]]; then
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS="skipped_missing_sources"
  else
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS="fail"
  fi
fi
if [[ "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE" == "1" ]]; then
  echo "[WEEKLY] 6.5) Legacy preview artifact smoke"
  LEGACY_META="$(python3 - "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES" <<'PY'
import json
import os
import sys
from pathlib import Path
root = Path.cwd()
path = Path(sys.argv[1])
if not path.is_absolute():
    path = root / path
case_count = 0
missing = []
status = "ok"
if not path.is_file():
    status = "missing_cases"
else:
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload if isinstance(payload, list) else payload.get("cases", [])
    if not isinstance(items, list):
        status = "invalid_cases"
        items = []
    case_count = len(items)
    for item in items:
        target = Path(str(item.get("target") or "").strip())
        if not target:
            continue
        if not target.is_absolute():
            target = root / target
        if not target.exists():
            missing.append(str(target))
print(f"status={status}")
print(f"case_count={case_count}")
print(f"missing_count={len(missing)}")
print(f"first_missing={missing[0] if missing else ''}")
PY
)"
  LEGACY_CASE_STATUS="$(printf '%s\n' "$LEGACY_META" | awk -F= '/^status=/{print $2; exit}')"
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASE_COUNT="$(printf '%s\n' "$LEGACY_META" | awk -F= '/^case_count=/{print $2; exit}')"
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_MISSING_COUNT="$(printf '%s\n' "$LEGACY_META" | awk -F= '/^missing_count=/{print $2; exit}')"
  if [[ "$RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP" == "1" && "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS" != "ok" ]]; then
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="skipped_prep_${WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS}"
  elif [[ "$LEGACY_CASE_STATUS" != "ok" ]]; then
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="$LEGACY_CASE_STATUS"
  elif [[ "${WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_MISSING_COUNT}" != "0" ]]; then
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="skipped_missing_targets"
  else
    set +e
    LEGACY_OUTPUT="$(python3 tools/validate_plm_preview_artifacts_smoke.py \
      --cases "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES" \
      --outdir "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_OUTDIR" 2>&1)"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RC="$?"
    set -e
    printf '%s\n' "$LEGACY_OUTPUT"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RUN_ID="$(printf '%s\n' "$LEGACY_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
    WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY="$(printf '%s\n' "$LEGACY_OUTPUT" | awk -F= '/^summary_json=/{print $2; exit}')"
    if [[ -f "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY" ]]; then
      LEGACY_COUNTS=()
      while IFS= read -r line; do
        LEGACY_COUNTS+=("$line")
      done < <(python3 - "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
results = data.get('results', [])
failed = [r for r in results if r.get('status') != 'ok']
print(data.get('passed', 0))
print(data.get('failed', 0))
print(failed[0].get('id', '') if failed else '')
PY
)
      WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_PASS_COUNT="${LEGACY_COUNTS[0]:-0}"
      WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FAIL_COUNT="${LEGACY_COUNTS[1]:-0}"
      WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FIRST_FAILED_CASE="${LEGACY_COUNTS[2]:-}"
    fi
    if [[ "$WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RC" -eq 0 ]]; then
      WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="ok"
    else
      WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS="fail"
    fi
  fi
fi

echo "[WEEKLY] 7) Gate trend summary (${TREND_DAYS}d)"
TREND_OUTPUT="$(python3 tools/editor_gate_trend.py \
  --history-dir build/editor_gate_history \
  --days "$TREND_DAYS" \
  --out-json "$TREND_JSON" \
  --out-md "$TREND_MD")"
echo "$TREND_OUTPUT"
TREND_STATUS="$(echo "$TREND_OUTPUT" | awk -F= '/^trend_status=/{print $2; exit}')"

echo "[WEEKLY] 7.5) UI-flow stage trend summary (${UI_FLOW_STAGE_TREND_DAYS}d)"
UI_FLOW_STAGE_TREND_OUTPUT="$(python3 tools/editor_ui_flow_stage_trend.py \
  --history-dir build/editor_gate_history \
  --days "$UI_FLOW_STAGE_TREND_DAYS" \
  --out-json "$UI_FLOW_STAGE_TREND_JSON" \
  --out-md "$UI_FLOW_STAGE_TREND_MD")"
echo "$UI_FLOW_STAGE_TREND_OUTPUT"
UI_FLOW_STAGE_TREND_STATUS="$(echo "$UI_FLOW_STAGE_TREND_OUTPUT" | awk -F= '/^ui_flow_stage_trend_status=/{print $2; exit}')"
UI_FLOW_STAGE_TREND_GATE_MODE="$(echo "$UI_FLOW_STAGE_TREND_OUTPUT" | awk -F= '/^ui_flow_stage_trend_gate_mode=/{print $2; exit}')"

echo "[WEEKLY] 8) Synthetic perf trend summary (${PERF_TREND_DAYS}d)"
PERF_TREND_OUTPUT="$(python3 tools/editor_perf_trend.py \
  --days "$PERF_TREND_DAYS" \
  --out-json "$PERF_TREND_JSON" \
  --out-md "$PERF_TREND_MD")"
echo "$PERF_TREND_OUTPUT"
PERF_TREND_STATUS="$(echo "$PERF_TREND_OUTPUT" | awk -F= '/^perf_trend_status=/{print $2; exit}')"

echo "[WEEKLY] 9) Real scene perf trend summary (${REAL_SCENE_TREND_DAYS}d)"
REAL_SCENE_TREND_OUTPUT="$(python3 tools/editor_real_scene_perf_trend.py \
  --profile "$REAL_SCENE_PROFILE" \
  --days "$REAL_SCENE_TREND_DAYS" \
  --out-json "$REAL_SCENE_TREND_JSON" \
  --out-md "$REAL_SCENE_TREND_MD")"
echo "$REAL_SCENE_TREND_OUTPUT"
REAL_SCENE_TREND_STATUS="$(echo "$REAL_SCENE_TREND_OUTPUT" | awk -F= '/^real_scene_trend_status=/{print $2; exit}')"

echo "[WEEKLY] 10) Case selection trend summary (${CASE_SELECTION_TREND_WINDOWS}d windows)"
CASE_SELECTION_TREND_OUTPUT="$(python3 tools/editor_case_selection_trend.py \
  --history-dir build/editor_gate_history \
  --windows "$CASE_SELECTION_TREND_WINDOWS" \
  --out-json "$CASE_SELECTION_TREND_JSON" \
  --out-md "$CASE_SELECTION_TREND_MD")"
echo "$CASE_SELECTION_TREND_OUTPUT"
CASE_SELECTION_TREND_STATUS="$(echo "$CASE_SELECTION_TREND_OUTPUT" | awk -F= '/^case_selection_trend_status=/{print $2; exit}')"

PARALLEL_CYCLE_STATUS="skipped"
PARALLEL_CYCLE_RC=0
PARALLEL_CYCLE_RUN_ID=""
PARALLEL_CYCLE_OUT_DIR=""
PARALLEL_CYCLE_SUMMARY=""
PARALLEL_CYCLE_SUMMARY_MD=""
PARALLEL_CYCLE_GATE_DECISION=""
if [[ "$RUN_EDITOR_PARALLEL_CYCLE" == "1" ]]; then
  echo "[WEEKLY] 11) Editor parallel cycle snapshot"
  PARALLEL_CMD=(env
    PARALLEL_WATCH_POLICY="$PARALLEL_CYCLE_WATCH_POLICY"
    RUN_LANE_A="$PARALLEL_CYCLE_RUN_LANE_A"
    RUN_LANE_B="$PARALLEL_CYCLE_RUN_LANE_B"
    RUN_LANE_C="$PARALLEL_CYCLE_RUN_LANE_C"
    LANE_B_RUN_UI_FLOW="$PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW"
    LANE_B_UI_FLOW_MODE="$PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE"
    LANE_B_UI_FLOW_TIMEOUT_MS="$PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS"
    LANE_B_UI_FLOW_OPEN_RETRIES="$PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES"
    bash tools/editor_parallel_cycle.sh
  )
  set +e
  PARALLEL_CYCLE_OUTPUT="$("${PARALLEL_CMD[@]}")"
  parallel_rc=$?
  set -e
  PARALLEL_CYCLE_RC="$parallel_rc"
  echo "$PARALLEL_CYCLE_OUTPUT"
  PARALLEL_CYCLE_RUN_ID="$(echo "$PARALLEL_CYCLE_OUTPUT" | awk -F= '/^run_id=/{print $2; exit}')"
  PARALLEL_CYCLE_OUT_DIR="$(echo "$PARALLEL_CYCLE_OUTPUT" | awk -F= '/^out_dir=/{print $2; exit}')"
  PARALLEL_CYCLE_SUMMARY="$(echo "$PARALLEL_CYCLE_OUTPUT" | awk -F= '/^summary_json=/{print $2; exit}')"
  PARALLEL_CYCLE_SUMMARY_MD="$(echo "$PARALLEL_CYCLE_OUTPUT" | awk -F= '/^summary_md=/{print $2; exit}')"
  PARALLEL_CYCLE_GATE_DECISION="$(echo "$PARALLEL_CYCLE_OUTPUT" | awk -F= '/^gate_decision=/{print $2; exit}')"
  if [[ -z "$PARALLEL_CYCLE_GATE_DECISION" && -n "$PARALLEL_CYCLE_SUMMARY" && -f "$PARALLEL_CYCLE_SUMMARY" ]]; then
    PARALLEL_CYCLE_GATE_DECISION="$(python3 - "$PARALLEL_CYCLE_SUMMARY" <<'PY'
import json
import sys
try:
  payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
except Exception:
  print("")
  raise SystemExit(0)
gate = payload.get("gate_decision") if isinstance(payload.get("gate_decision"), dict) else {}
print(str(gate.get("decision") or ""))
PY
)"
  fi
  if [[ "$PARALLEL_CYCLE_RC" -eq 0 ]]; then
    PARALLEL_CYCLE_STATUS="pass"
  else
    PARALLEL_CYCLE_STATUS="fail"
    echo "[WEEKLY] WARN editor_parallel_cycle exited with rc=$PARALLEL_CYCLE_RC"
    if [[ "$PARALLEL_CYCLE_STRICT" == "1" ]]; then
      echo "[WEEKLY] ERROR PARALLEL_CYCLE_STRICT=1 and parallel cycle failed"
      exit "$PARALLEL_CYCLE_RC"
    fi
  fi
fi

WEEKLY_HISTORY_DIR="${WEEKLY_HISTORY_DIR:-build/editor_weekly_validation_history}"
WEEKLY_HISTORY_JSON=""
WEEKLY_TS="$(date -u +%Y%m%d_%H%M%S 2>/dev/null || echo "")"
if [[ -n "$WEEKLY_TS" ]]; then
  WEEKLY_HISTORY_JSON="${WEEKLY_HISTORY_DIR}/weekly_${WEEKLY_TS}_${EDITOR_SMOKE_RUN_ID:-no_editor}_${CAD_RUN_ID:-no_cad}.json"
fi
if [[ "$RUN_WEEKLY_SUMMARY_CHECK" == "1" && -z "$WEEKLY_SUMMARY_CHECK_DASHBOARD" ]]; then
  if [[ -n "$STEP176_DASHBOARD_OUT" ]]; then
    WEEKLY_SUMMARY_CHECK_DASHBOARD="$STEP176_DASHBOARD_OUT"
  elif [[ -n "$WEEKLY_TS" ]]; then
    WEEKLY_SUMMARY_CHECK_DASHBOARD="build/step176_dashboard_weekly_${WEEKLY_TS}.md"
  else
    WEEKLY_SUMMARY_CHECK_DASHBOARD="build/step176_dashboard_weekly_latest.md"
  fi
fi

export ROOT_DIR \
  EDITOR_SMOKE_MODE EDITOR_SMOKE_LIMIT EDITOR_SMOKE_CASES EDITOR_SMOKE_CASE_COUNT EDITOR_SMOKE_MIN_CASES EDITOR_SMOKE_CASE_SOURCE EDITOR_SMOKE_PRIORITY_SET EDITOR_SMOKE_TAG_ANY EDITOR_SMOKE_GENERATE_CASES EDITOR_SMOKE_GENERATED_CASES_PATH EDITOR_SMOKE_GENERATED_COUNT EDITOR_SMOKE_GENERATED_COUNT_DECLARED EDITOR_SMOKE_GENERATED_COUNT_ACTUAL EDITOR_SMOKE_GENERATED_COUNT_MISMATCH EDITOR_SMOKE_GENERATED_MISMATCH_POLICY EDITOR_SMOKE_GENERATED_MIN_CASES EDITOR_SMOKE_GENERATED_PRIORITIES EDITOR_SMOKE_GENERATED_RUN_ID EDITOR_SMOKE_GENERATED_RUN_IDS GATE_SMOKE_PRIORITY_SET GATE_SMOKE_TAG_ANY GATE_EDITOR_SMOKE_CASES GATE_EDITOR_SMOKE_CASE_SOURCE GATE_EDITOR_SMOKE_GENERATED_CASES_PATH GATE_EDITOR_SMOKE_GENERATED_COUNT GATE_EDITOR_SMOKE_GENERATED_COUNT_DECLARED GATE_EDITOR_SMOKE_GENERATED_COUNT_ACTUAL GATE_EDITOR_SMOKE_GENERATED_COUNT_MISMATCH GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY GATE_EDITOR_SMOKE_GENERATED_PRIORITIES GATE_EDITOR_SMOKE_GENERATED_RUN_ID GATE_EDITOR_SMOKE_GENERATED_RUN_IDS RUN_EDITOR_UI_FLOW_SMOKE EDITOR_UI_FLOW_MODE EDITOR_UI_FLOW_PORT EDITOR_UI_FLOW_VIEWPORT EDITOR_UI_FLOW_TIMEOUT_MS EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES EDITOR_UI_FLOW_OUTDIR EDITOR_UI_FLOW_HEADED EDITOR_UI_FLOW_SMOKE_GATE_RUNS \
  RUN_UI_FLOW_FAILURE_INJECTION UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS UI_FLOW_FAILURE_INJECTION_STRICT \
  UI_FLOW_STATUS UI_FLOW_RUN_ID UI_FLOW_SUMMARY UI_FLOW_RC UI_FLOW_RUNS_TARGET UI_FLOW_RUN_COUNT UI_FLOW_PASS_COUNT UI_FLOW_FAIL_COUNT UI_FLOW_RUN_SUMMARIES UI_FLOW_FAILURE_CODE_COUNTS_JSON UI_FLOW_FIRST_FAILURE_CODE \
  UI_FLOW_FAILURE_INJECTION_STATUS UI_FLOW_FAILURE_INJECTION_RUN_ID UI_FLOW_FAILURE_INJECTION_SUMMARY UI_FLOW_FAILURE_INJECTION_RC UI_FLOW_FAILURE_INJECTION_FAILURE_CODE UI_FLOW_FAILURE_INJECTION_FAILURE_DETAIL \
  CAD_MODE CAD_MAX_WORKERS CAD_BASELINE RUN_STEP166_BASELINE_REFRESH STEP166_BASELINE_REFRESH_DAYS STEP166_BASELINE_REFRESH_APPLY \
  STEP166_BASELINE_REFRESH_RC STEP166_BASELINE_REFRESH_ELIGIBLE STEP166_BASELINE_REFRESH_APPLIED STEP166_BASELINE_REFRESH_REASON STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID STEP166_BASELINE_REFRESH_BACKUP_PATH STEP166_BASELINE_REFRESH_WINDOW_REPORT \
  PERF_ENTITIES PERF_PICK_SAMPLES PERF_BOX_SAMPLES PERF_DRAG_SAMPLES PERF_REPEAT PERF_INTERVAL_SEC RUN_GATE EDITOR_GATE_APPEND_REPORT \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE RUN_PREVIEW_ARTIFACT_SMOKE_GATE RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE \
  RUN_DWG_OPEN_SMOKE_GATE RUN_DWG_OPEN_DESKTOP_SMOKE_GATE RUN_DWG_OPEN_MATRIX_SMOKE_GATE RUN_SOLVER_ACTION_PANEL_SMOKE_GATE RUN_CONSTRAINTS_BASIC_CTEST_GATE RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE \
  AUTO_GATE_LIMIT GATE_SMOKE_LIMIT GATE_LIMIT_SOURCE GATE_CAD_ATTEMPTS \
  PRE_TREND_STATUS PRE_TREND_JSON PRE_TREND_MD PRE_TREND_RECOMMENDED_LIMIT \
  EDITOR_SMOKE_RUN_ID EDITOR_SMOKE_RUN_DIR EDITOR_SMOKE_SUMMARY \
  CAD_RUN_ID CAD_RUN_DIR CAD_SUMMARY CAD_FAILURES CAD_TREND_INPUT CAD_GATE_WOULD_FAIL \
  PERF_RUN_ID PERF_RUN_DIR PERF_SUMMARY \
  RUN_REAL_SCENE_PERF REAL_SCENE_MODE REAL_SCENE_PROFILE REAL_SCENE_STATUS REAL_SCENE_RUN_ID REAL_SCENE_SUMMARY REAL_SCENE_GATE_WOULD_FAIL \
  REAL_SCENE_REPEAT REAL_SCENE_INTERVAL_SEC \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK GATE_RUN_QT_PROJECT_PERSISTENCE_GATE GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON QT_PROJECT_POLICY_DAYS QT_PROJECT_POLICY_MIN_SAMPLES QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES QT_PROJECT_POLICY_JSON QT_PROJECT_POLICY_MD QT_PROJECT_POLICY_STATUS QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE QT_PROJECT_POLICY_REQUIRE_ON_SOURCE \
  GATE_STATUS GATE_SUMMARY GATE_RC \
  TREND_DAYS TREND_JSON TREND_MD TREND_STATUS \
  UI_FLOW_STAGE_TREND_DAYS UI_FLOW_STAGE_TREND_JSON UI_FLOW_STAGE_TREND_MD UI_FLOW_STAGE_TREND_STATUS UI_FLOW_STAGE_TREND_GATE_MODE \
  PERF_TREND_DAYS PERF_TREND_JSON PERF_TREND_MD PERF_TREND_STATUS PERF_TREND_MIN_SELECTED \
  REAL_SCENE_TREND_DAYS REAL_SCENE_TREND_JSON REAL_SCENE_TREND_MD REAL_SCENE_TREND_STATUS REAL_SCENE_TREND_MIN_SELECTED \
  CASE_SELECTION_TREND_WINDOWS CASE_SELECTION_TREND_JSON CASE_SELECTION_TREND_MD CASE_SELECTION_TREND_STATUS \
  RUN_WEEKLY_SUMMARY_CHECK WEEKLY_SUMMARY_CHECK_STRICT WEEKLY_SUMMARY_CHECK_DASHBOARD WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD STEP176_DASHBOARD_OUT \
  RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_OUTDIR \
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RUN_ID WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RC WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASE_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_PASS_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FAIL_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FIRST_FAILED_CASE WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_INPUT_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_MANIFEST_COUNT \
  RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_OUTDIR \
  WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RUN_ID WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RC WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASE_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_PASS_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FAIL_COUNT WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FIRST_FAILED_CASE WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_MISSING_COUNT \
  RUN_EDITOR_PARALLEL_CYCLE PARALLEL_CYCLE_WATCH_POLICY WEEKLY_PARALLEL_DECISION_POLICY PARALLEL_CYCLE_RUN_LANE_A PARALLEL_CYCLE_RUN_LANE_B PARALLEL_CYCLE_RUN_LANE_C PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES PARALLEL_CYCLE_STRICT \
  PARALLEL_CYCLE_STATUS PARALLEL_CYCLE_RC PARALLEL_CYCLE_RUN_ID PARALLEL_CYCLE_OUT_DIR PARALLEL_CYCLE_SUMMARY PARALLEL_CYCLE_SUMMARY_MD PARALLEL_CYCLE_GATE_DECISION \
  WEEKLY_HISTORY_DIR WEEKLY_HISTORY_JSON

python3 - "$SUMMARY_JSON" "$SUMMARY_MD" <<'PY'
import base64
import json
import os
import sys
from datetime import datetime, timezone

summary_json_path = sys.argv[1]
summary_md_path = sys.argv[2]

env = os.environ

def to_bool(value):
    text = str(value or "").strip().lower()
    return text in ("1", "true", "yes", "on")

def load_json(path: str) -> dict:
    try:
        if not path:
            return {}
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def as_dict(value):
    return value if isinstance(value, dict) else {}

def decode_b64_json_dict(value):
    text = str(value or "").strip()
    if not text:
        return {}
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}

def decode_b64_json_list(value):
    text = str(value or "").strip()
    if not text:
        return []
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []

def parse_json_text(text: str):
    try:
        return json.loads(text)
    except Exception:
        return None

def as_float(value):
    try:
        return float(value)
    except Exception:
        return None

def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default

def to_bool(value):
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return text in ("1", "true", "yes", "on")

def split_paths(text: str):
    if not text:
        return []
    return [item for item in str(text).split("|") if item]

def split_csv(text: str):
    if not text:
        return []
    return [item.strip() for item in str(text).split(",") if item.strip()]

def fmt_counts(raw):
    if not isinstance(raw, dict) or not raw:
        return "-"
    pairs = []
    for key, value in raw.items():
        try:
            ivalue = int(value)
        except Exception:
            continue
        if ivalue > 0:
            pairs.append((str(key), ivalue))
    pairs.sort(key=lambda item: (-item[1], item[0]))
    if not pairs:
        return "-"
    return ", ".join(f"{key}:{value}" for key, value in pairs)

def fmt_nested_counts(raw):
    if not isinstance(raw, dict) or not raw:
        return "-"
    parts = []
    for layout, inner in sorted(raw.items(), key=lambda item: str(item[0])):
        rendered = fmt_counts(as_dict(inner))
        if rendered == "-":
            continue
        parts.append(f"{layout}[{rendered}]")
    return "; ".join(parts) if parts else "-"

def fmt_text_kind_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_counts(as_dict(item.get("text_kind_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_proxy_kind_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_counts(as_dict(item.get("derived_proxy_kind_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_proxy_layout_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_nested_counts(as_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_viewport_proxy_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_nested_counts(as_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_group_source_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_counts(as_dict(item.get("assembly_group_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_group_layout_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_nested_counts(as_dict(item.get("assembly_group_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_exploded_layout_case_details(raw):
    details = decode_b64_json_list(raw)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        rendered = fmt_nested_counts(as_dict(item.get("exploded_origin_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def first_nonempty(values):
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""

def classify_ui_flow_run(run_payload: dict):
    if not isinstance(run_payload, dict):
        return ("UI_FLOW_SUMMARY_INVALID", "summary payload invalid")
    if run_payload.get("ok") is True:
        return ("", "")
    direct_code = str(run_payload.get("flow_failure_code") or "").strip()
    direct_detail = str(run_payload.get("flow_failure_detail") or "").strip()
    if direct_code:
        return (direct_code, direct_detail)
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

def extract_ui_flow_interaction_checks(run_payload: dict):
    if not isinstance(run_payload, dict):
        return {}
    checks = run_payload.get("interaction_checks")
    if isinstance(checks, dict):
        return {str(k): to_bool(v) for k, v in checks.items() if str(k).strip()}
    flow = run_payload.get("flow")
    if not isinstance(flow, dict):
        return {}
    pre = flow.get("fillet_chamfer_preselection") if isinstance(flow.get("fillet_chamfer_preselection"), dict) else {}
    poly = flow.get("fillet_chamfer_polyline_preselection") if isinstance(flow.get("fillet_chamfer_polyline_preselection"), dict) else {}
    if not pre and not poly:
        return {}
    out = {
        "fillet_pair_preselection_ok": (
            to_bool(pre.get("filletPairPromptSecond"))
            and to_bool(pre.get("filletPairApplied"))
            and as_int(pre.get("filletPairArcCount"), 0) >= 1
        ),
        "chamfer_pair_preselection_ok": (
            to_bool(pre.get("chamferPairPromptSecond"))
            and to_bool(pre.get("chamferPairApplied"))
            and as_int(pre.get("chamferPairLineCount"), 0) >= 3
        ),
        "fillet_polyline_preselection_ok": (
            to_bool(poly.get("filletPromptSecond"))
            and (to_bool(poly.get("filletApplied")) or to_bool(poly.get("filletFallbackRecovered")))
            and max(as_int(poly.get("filletArcCount"), 0), as_int(poly.get("filletFallbackArcCount"), 0)) >= 1
        ),
        "chamfer_polyline_preselection_ok": (
            to_bool(poly.get("chamferPromptSecond"))
            and (to_bool(poly.get("chamferApplied")) or to_bool(poly.get("chamferFallbackRecovered")))
            and max(as_int(poly.get("chamferLineCount"), 0), as_int(poly.get("chamferFallbackLineCount"), 0)) >= 1
        ),
    }
    out["complete"] = all(bool(v) for v in out.values())
    return out

def validate_ui_stage_trend_contract(payload: dict):
    data = as_dict(payload)
    issues = []
    days = as_int(data.get("days"), 0)
    status = str(data.get("status") or "").strip()
    mode = str(data.get("recommended_gate_mode") or "").strip()
    summary_json = str(data.get("summary_json") or "").strip()
    summary_md = str(data.get("summary_md") or "").strip()
    enabled_samples = as_int(data.get("enabled_samples_in_window"), 0)
    fail_ratio = as_float(data.get("fail_ratio"))
    attr_ratio = as_float(data.get("attribution_ratio"))

    if days <= 0:
        issues.append("days<=0")
    if not status:
        issues.append("status_missing")
    if mode not in ("observe", "gate"):
        issues.append("recommended_mode_invalid")
    if not summary_json:
        issues.append("summary_json_missing")
    if not summary_md:
        issues.append("summary_md_missing")
    if not isinstance(data.get("failure_stage_counts"), dict):
        issues.append("failure_stage_counts_invalid")
    if not isinstance(data.get("first_failure_stage_counts"), dict):
        issues.append("first_failure_stage_counts_invalid")
    if not isinstance(data.get("setup_exit_nonzero_runs"), dict):
        issues.append("setup_exit_nonzero_runs_invalid")
    if enabled_samples > 0:
        if fail_ratio is None:
            issues.append("fail_ratio_missing")
        if attr_ratio is None:
            issues.append("attribution_ratio_missing")
    return {
        "ok": len(issues) == 0,
        "issues": issues,
        "issue_count": len(issues),
    }

def classify_editor_smoke_case(case_payload: dict, failure_codes):
    codes = {str(code or "").strip() for code in (failure_codes or []) if str(code or "").strip()}
    if "DISCOVERY_EMPTY" in codes or "INPUT_MISSING" in codes or "NOT_CADGF" in codes:
        return "INPUT_INVALID"
    if "ROUNDTRIP_DRIFT" in codes:
        return "RENDER_DRIFT"
    return "IMPORT_FAIL"

def analyze_editor_smoke_summary(summary_path: str):
    summary = load_json(summary_path)
    totals_raw = summary.get("totals") if isinstance(summary.get("totals"), dict) else {}
    totals = {
        "pass": as_int(totals_raw.get("pass"), 0),
        "fail": as_int(totals_raw.get("fail"), 0),
        "skipped": as_int(totals_raw.get("skipped"), 0),
    }
    status = "UNKNOWN"
    if summary:
        status = "FAIL" if totals["fail"] > 0 else "PASS"
    bucket_raw = summary.get("failure_buckets") if isinstance(summary.get("failure_buckets"), dict) else {}
    buckets = {
        "INPUT_INVALID": as_int(bucket_raw.get("INPUT_INVALID"), 0),
        "IMPORT_FAIL": as_int(bucket_raw.get("IMPORT_FAIL"), 0),
        "VIEWPORT_LAYOUT_MISSING": as_int(bucket_raw.get("VIEWPORT_LAYOUT_MISSING"), 0),
        "RENDER_DRIFT": as_int(bucket_raw.get("RENDER_DRIFT"), 0),
        "TEXT_METRIC_DRIFT": as_int(bucket_raw.get("TEXT_METRIC_DRIFT"), 0),
    }
    code_counts = {}
    failed_cases = []
    first_failure_code = ""
    use_result_buckets = not bool(bucket_raw)
    filters_raw = summary.get("filters") if isinstance(summary.get("filters"), dict) else {}
    case_selection_raw = summary.get("case_selection") if isinstance(summary.get("case_selection"), dict) else {}
    case_selection = {
        "total_input": as_int(case_selection_raw.get("total_input"), 0),
        "filtered_count": as_int(case_selection_raw.get("filtered_count"), 0),
        "matched_count": as_int(case_selection_raw.get("matched_count"), 0),
        "selected_count": as_int(case_selection_raw.get("selected_count"), 0),
        "limit": as_int(case_selection_raw.get("limit"), 0),
        "priority_filter": case_selection_raw.get("priority_filter") if isinstance(case_selection_raw.get("priority_filter"), list) else [],
        "tag_any_filter": case_selection_raw.get("tag_any_filter") if isinstance(case_selection_raw.get("tag_any_filter"), list) else [],
        "used_fallback": bool(case_selection_raw.get("used_fallback", False)),
    }
    results = summary.get("results")
    if isinstance(results, list):
        for one in results:
            if not isinstance(one, dict):
                continue
            if str(one.get("status") or "").upper() != "FAIL":
                continue
            failure_codes = []
            raw_codes = one.get("failure_codes")
            if isinstance(raw_codes, list):
                for code in raw_codes:
                    text = str(code or "").strip()
                    if not text:
                        continue
                    failure_codes.append(text)
                    code_counts[text] = int(code_counts.get(text, 0)) + 1
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
        "failure_code_counts": code_counts,
        "first_failure_code": first_failure_code,
        "failed_cases": failed_cases,
        "filters": filters_raw,
        "case_selection": case_selection,
        "summary_loaded": bool(summary),
    }

real_scene_trend_path = env.get("REAL_SCENE_TREND_JSON", "")
real_scene_trend_payload = load_json(real_scene_trend_path)
coverage_days = as_float(real_scene_trend_payload.get("coverage_days")) or 0.0
selected_samples = as_int(real_scene_trend_payload.get("selected_samples_in_window"), 0)
selection_mode = str(real_scene_trend_payload.get("selection_mode") or real_scene_trend_payload.get("selection") or "")
trend_days = as_int(env.get("REAL_SCENE_TREND_DAYS", "0"), 0)
min_selected = as_int(env.get("REAL_SCENE_TREND_MIN_SELECTED", "5"), 5)
auto_gate_mode = (
    "gate"
    if (selection_mode == "batch_only" and coverage_days >= float(trend_days) and selected_samples >= min_selected)
    else "observe"
)

perf_trend_path = env.get("PERF_TREND_JSON", "")
perf_trend_payload = load_json(perf_trend_path)
perf_policy = perf_trend_payload.get("policy") if isinstance(perf_trend_payload.get("policy"), dict) else {}
perf_coverage_days = as_float(perf_trend_payload.get("coverage_days")) or 0.0
perf_selected_samples = as_int(perf_trend_payload.get("selected_samples_in_window"), 0)
perf_selection_mode = str(perf_trend_payload.get("selection_mode") or perf_trend_payload.get("selection") or "")
perf_trend_days = as_int(env.get("PERF_TREND_DAYS", "0"), 0)
perf_min_selected = as_int(env.get("PERF_TREND_MIN_SELECTED", "5"), 5)
perf_auto_gate_mode = (
    "gate"
    if (
        perf_selection_mode == "batch_only"
        and perf_coverage_days >= float(perf_trend_days)
        and perf_selected_samples >= perf_min_selected
    )
    else "observe"
)
case_selection_trend_path = env.get("CASE_SELECTION_TREND_JSON", "")
case_selection_trend_payload = load_json(case_selection_trend_path)
ui_flow_stage_trend_path = env.get("UI_FLOW_STAGE_TREND_JSON", "")
ui_flow_stage_trend_payload = load_json(ui_flow_stage_trend_path)
qt_policy_path = env.get("QT_PROJECT_POLICY_JSON", "")
qt_policy_payload = load_json(qt_policy_path)
parallel_cycle_summary_path = env.get("PARALLEL_CYCLE_SUMMARY", "")
parallel_cycle_summary_payload = load_json(parallel_cycle_summary_path)
parallel_cycle_lanes = parallel_cycle_summary_payload.get("lanes") if isinstance(parallel_cycle_summary_payload.get("lanes"), dict) else {}
editor_smoke_analysis = analyze_editor_smoke_summary(env.get("EDITOR_SMOKE_SUMMARY", ""))
gate_expected = any(
    to_bool(env.get(name, "0"))
    for name in (
        "RUN_GATE",
        "RUN_EDITOR_UI_FLOW_SMOKE_GATE",
        "RUN_PREVIEW_PROVENANCE_SMOKE_GATE",
        "RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE",
        "RUN_PREVIEW_ARTIFACT_SMOKE_GATE",
        "RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE",
        "RUN_DWG_OPEN_SMOKE_GATE",
        "RUN_DWG_OPEN_DESKTOP_SMOKE_GATE",
        "RUN_DWG_OPEN_MATRIX_SMOKE_GATE",
        "RUN_SOLVER_ACTION_PANEL_SMOKE_GATE",
        "RUN_CONSTRAINTS_BASIC_CTEST_GATE",
        "RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE",
    )
)
gate_summary_path = env.get("GATE_SUMMARY", "")
if not gate_summary_path and gate_expected:
    root_dir = env.get("ROOT_DIR", "")
    candidate = os.path.join(root_dir, "build", "editor_gate_summary.json") if root_dir else "build/editor_gate_summary.json"
    if os.path.isfile(candidate):
        gate_summary_path = candidate
gate_summary_payload = load_json(gate_summary_path)
if not gate_summary_payload and gate_expected:
    root_dir = env.get("ROOT_DIR", "")
    candidate = os.path.join(root_dir, "build", "editor_gate_summary.json") if root_dir else "build/editor_gate_summary.json"
    if os.path.isfile(candidate):
        gate_summary_path = candidate
        gate_summary_payload = load_json(gate_summary_path)
gate_decision = gate_summary_payload.get("gate_decision") if isinstance(gate_summary_payload.get("gate_decision"), dict) else {}
gate_editor_smoke = gate_summary_payload.get("editor_smoke") if isinstance(gate_summary_payload.get("editor_smoke"), dict) else {}
gate_editor_smoke_injection = (
    gate_summary_payload.get("editor_smoke_failure_injection")
    if isinstance(gate_summary_payload.get("editor_smoke_failure_injection"), dict)
    else {}
)
gate_qt_project_persistence = (
    gate_summary_payload.get("qt_project_persistence")
    if isinstance(gate_summary_payload.get("qt_project_persistence"), dict)
    else {}
)
gate_ui_flow_smoke = (
    gate_summary_payload.get("ui_flow_smoke")
    if isinstance(gate_summary_payload.get("ui_flow_smoke"), dict)
    else {}
)
gate_preview_provenance_smoke = (
    gate_summary_payload.get("preview_provenance_smoke")
    if isinstance(gate_summary_payload.get("preview_provenance_smoke"), dict)
    else {}
)
gate_dwg_open_smoke = (
    gate_summary_payload.get("dwg_open_smoke")
    if isinstance(gate_summary_payload.get("dwg_open_smoke"), dict)
    else {}
)
gate_dwg_open_matrix_smoke = (
    gate_summary_payload.get("dwg_open_matrix_smoke")
    if isinstance(gate_summary_payload.get("dwg_open_matrix_smoke"), dict)
    else {}
)
gate_dwg_open_desktop_smoke = (
    gate_summary_payload.get("dwg_open_desktop_smoke")
    if isinstance(gate_summary_payload.get("dwg_open_desktop_smoke"), dict)
    else {}
)
gate_solver_action_panel_smoke = (
    gate_summary_payload.get("solver_action_panel_smoke")
    if isinstance(gate_summary_payload.get("solver_action_panel_smoke"), dict)
    else {}
)
gate_preview_provenance_failure_injection = (
    gate_summary_payload.get("preview_provenance_failure_injection")
    if isinstance(gate_summary_payload.get("preview_provenance_failure_injection"), dict)
    else {}
)
gate_step186_preview_artifact_prep = (
    gate_summary_payload.get("step186_preview_artifact_prep")
    if isinstance(gate_summary_payload.get("step186_preview_artifact_prep"), dict)
    else {}
)
gate_preview_artifact_validator_failure_injection = (
    gate_summary_payload.get("preview_artifact_validator_failure_injection")
    if isinstance(gate_summary_payload.get("preview_artifact_validator_failure_injection"), dict)
    else {}
)
gate_preview_artifact_smoke = (
    gate_summary_payload.get("preview_artifact_smoke")
    if isinstance(gate_summary_payload.get("preview_artifact_smoke"), dict)
    else {}
)
gate_assembly_roundtrip_ctest = (
    gate_summary_payload.get("assembly_roundtrip_ctest")
    if isinstance(gate_summary_payload.get("assembly_roundtrip_ctest"), dict)
    else {}
)
gate_constraints_basic_ctest = (
    gate_summary_payload.get("constraints_basic_ctest")
    if isinstance(gate_summary_payload.get("constraints_basic_ctest"), dict)
    else {}
)
gate_step166 = (
    gate_summary_payload.get("step166")
    if isinstance(gate_summary_payload.get("step166"), dict)
    else {}
)
gate_inputs_payload = (
    gate_summary_payload.get("inputs")
    if isinstance(gate_summary_payload.get("inputs"), dict)
    else {}
)
gate_runtime_payload = {
    "profile": str(gate_inputs_payload.get("editor_gate_profile") or env.get("EDITOR_GATE_PROFILE", "") or "<none>"),
    "step166_gate": bool(gate_inputs_payload.get("run_step166_gate", False)),
    "ui_flow_gate": bool(gate_inputs_payload.get("run_editor_ui_flow_smoke_gate", False)),
    "convert_disabled": bool(gate_inputs_payload.get("editor_smoke_no_convert", False)),
    "perf_trend": bool(gate_inputs_payload.get("run_perf_trend", False)),
    "real_scene_trend": bool(gate_inputs_payload.get("run_real_scene_trend", False)),
    "source": "gate.inputs" if gate_inputs_payload else "weekly.inputs",
}

gate_status_value = str(env.get("GATE_STATUS") or "").strip()
gate_status_lower = gate_status_value.lower()
if (not gate_status_value or gate_status_lower == "skipped") and gate_expected:
    inferred_gate_status = ""
    if gate_decision:
        gate_would_fail = bool(gate_decision.get("would_fail", False))
        gate_exit_code = as_int(gate_decision.get("exit_code", 0), 0)
        inferred_gate_status = "fail" if gate_would_fail or gate_exit_code != 0 else "ok"
    elif gate_summary_payload:
        gate_exit_code = as_int(gate_summary_payload.get("exit_code", 0), 0)
        inferred_gate_status = "ok" if gate_exit_code == 0 else "fail"
    elif to_bool(env.get("RUN_GATE", "0")):
        inferred_gate_status = "ok" if as_int(env.get("GATE_RC", "0"), 0) == 0 else "fail"
    if inferred_gate_status:
        gate_status_value = inferred_gate_status

gate_summary_value = str(env.get("GATE_SUMMARY") or "").strip()
if not gate_summary_value:
    gate_summary_value = gate_summary_path

payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "workspace": env.get("ROOT_DIR", ""),
    "history_json": env.get("WEEKLY_HISTORY_JSON", ""),
    "dashboard_markdown": env.get("WEEKLY_SUMMARY_CHECK_DASHBOARD", ""),
    "inputs": {
        "editor_smoke_mode": env.get("EDITOR_SMOKE_MODE", ""),
        "editor_smoke_limit": int(env.get("EDITOR_SMOKE_LIMIT", "0")),
        "editor_smoke_cases": env.get("EDITOR_SMOKE_CASES", ""),
        "editor_smoke_cases_count": int(env.get("EDITOR_SMOKE_CASE_COUNT", "0") or 0),
        "editor_smoke_min_cases": int(env.get("EDITOR_SMOKE_MIN_CASES", "0") or 0),
        "editor_smoke_case_source": env.get("EDITOR_SMOKE_CASE_SOURCE", ""),
        "editor_smoke_priority_set": env.get("EDITOR_SMOKE_PRIORITY_SET", ""),
        "editor_smoke_tag_any": env.get("EDITOR_SMOKE_TAG_ANY", ""),
        "editor_smoke_generate_cases": env.get("EDITOR_SMOKE_GENERATE_CASES", "0") == "1",
        "editor_smoke_generated_cases_path": env.get("EDITOR_SMOKE_GENERATED_CASES_PATH", ""),
        "editor_smoke_generated_count": int(env.get("EDITOR_SMOKE_GENERATED_COUNT", "0") or 0),
        "editor_smoke_generated_count_declared": int(env.get("EDITOR_SMOKE_GENERATED_COUNT_DECLARED", env.get("EDITOR_SMOKE_GENERATED_COUNT", "0")) or 0),
        "editor_smoke_generated_count_actual": int(env.get("EDITOR_SMOKE_GENERATED_COUNT_ACTUAL", env.get("EDITOR_SMOKE_GENERATED_COUNT", "0")) or 0),
        "editor_smoke_generated_count_mismatch": to_bool(env.get("EDITOR_SMOKE_GENERATED_COUNT_MISMATCH", "0")),
        "editor_smoke_generated_mismatch_policy": env.get("EDITOR_SMOKE_GENERATED_MISMATCH_POLICY", "warn"),
        "editor_smoke_generated_min_cases": int(env.get("EDITOR_SMOKE_GENERATED_MIN_CASES", "0") or 0),
        "editor_smoke_generated_priorities": env.get("EDITOR_SMOKE_GENERATED_PRIORITIES", ""),
        "editor_smoke_generated_run_id": env.get("EDITOR_SMOKE_GENERATED_RUN_ID", ""),
        "editor_smoke_generated_run_ids": split_csv(env.get("EDITOR_SMOKE_GENERATED_RUN_IDS", "")),
        "gate_smoke_priority_set": env.get("GATE_SMOKE_PRIORITY_SET", ""),
        "gate_smoke_tag_any": env.get("GATE_SMOKE_TAG_ANY", ""),
        "gate_editor_profile": str(gate_inputs_payload.get("editor_gate_profile") or env.get("EDITOR_GATE_PROFILE", "")),
        "gate_editor_smoke_no_convert": bool(gate_inputs_payload.get("editor_smoke_no_convert", False)),
        "gate_run_step166_gate": bool(gate_inputs_payload.get("run_step166_gate", False)),
        "gate_run_editor_ui_flow_smoke_gate": bool(gate_inputs_payload.get("run_editor_ui_flow_smoke_gate", False)),
        "gate_run_preview_provenance_smoke_gate": bool(gate_inputs_payload.get("run_preview_provenance_smoke_gate", to_bool(env.get("RUN_PREVIEW_PROVENANCE_SMOKE_GATE", "0")))),
        "gate_run_dwg_open_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_SMOKE_GATE", "0")))),
        "gate_run_dwg_open_matrix_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_matrix_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_MATRIX_SMOKE_GATE", "0")))),
        "gate_run_dwg_open_desktop_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_desktop_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_DESKTOP_SMOKE_GATE", "0")))),
        "gate_run_solver_action_panel_smoke_gate": bool(gate_inputs_payload.get("run_solver_action_panel_smoke_gate", to_bool(env.get("RUN_SOLVER_ACTION_PANEL_SMOKE_GATE", "0")))),
        "gate_run_preview_provenance_failure_injection_gate": bool(gate_inputs_payload.get("run_preview_provenance_failure_injection_gate", to_bool(env.get("RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE", "0")))),
        "gate_run_preview_artifact_validator_failure_injection_gate": bool(gate_inputs_payload.get("run_preview_artifact_validator_failure_injection_gate", to_bool(env.get("RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE", "0")))),
        "gate_run_constraints_basic_ctest_gate": bool(gate_inputs_payload.get("run_constraints_basic_ctest_gate", to_bool(env.get("RUN_CONSTRAINTS_BASIC_CTEST_GATE", "0")))),
        "gate_run_assembly_roundtrip_ctest_gate": bool(gate_inputs_payload.get("run_assembly_roundtrip_ctest_gate", to_bool(env.get("RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE", "0")))),
        "gate_run_perf_trend": bool(gate_inputs_payload.get("run_perf_trend", False)),
        "gate_run_real_scene_trend": bool(gate_inputs_payload.get("run_real_scene_trend", False)),
        "gate_editor_smoke_cases": env.get("GATE_EDITOR_SMOKE_CASES", ""),
        "gate_editor_smoke_case_source": env.get("GATE_EDITOR_SMOKE_CASE_SOURCE", ""),
        "gate_editor_smoke_generated_cases_path": env.get("GATE_EDITOR_SMOKE_GENERATED_CASES_PATH", ""),
        "gate_editor_smoke_generated_count": as_int(gate_editor_smoke.get("generated_count"), int(env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT", "0") or 0)),
        "gate_editor_smoke_generated_count_declared": as_int(gate_editor_smoke.get("generated_count_declared"), int(env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT_DECLARED", env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT", "0")) or 0)),
        "gate_editor_smoke_generated_count_actual": as_int(gate_editor_smoke.get("generated_count_actual"), int(env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT_ACTUAL", env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT", "0")) or 0)),
        "gate_editor_smoke_generated_count_mismatch": bool(gate_editor_smoke.get("generated_count_mismatch", to_bool(env.get("GATE_EDITOR_SMOKE_GENERATED_COUNT_MISMATCH", "0")))),
        "gate_editor_smoke_generated_mismatch_policy": str(gate_editor_smoke.get("generated_count_mismatch_policy") or env.get("GATE_EDITOR_SMOKE_GENERATED_MISMATCH_POLICY", "warn")),
        "gate_editor_smoke_generated_mismatch_gate_fail": bool(gate_editor_smoke.get("generated_count_mismatch_gate_fail", False)),
        "gate_editor_smoke_generated_priorities": str(gate_editor_smoke.get("generated_priorities") or env.get("GATE_EDITOR_SMOKE_GENERATED_PRIORITIES", "")),
        "gate_editor_smoke_generated_run_id": str(gate_editor_smoke.get("generated_run_id") or env.get("GATE_EDITOR_SMOKE_GENERATED_RUN_ID", "")),
        "gate_editor_smoke_generated_run_ids": (
            gate_editor_smoke.get("generated_run_ids")
            if isinstance(gate_editor_smoke.get("generated_run_ids"), list)
            else split_csv(env.get("GATE_EDITOR_SMOKE_GENERATED_RUN_IDS", ""))
        ),
        "run_editor_ui_flow_smoke": env.get("RUN_EDITOR_UI_FLOW_SMOKE", "0") == "1",
        "editor_ui_flow_mode": env.get("EDITOR_UI_FLOW_MODE", ""),
        "editor_ui_flow_port": int(env.get("EDITOR_UI_FLOW_PORT", "0") or 0),
        "editor_ui_flow_viewport": env.get("EDITOR_UI_FLOW_VIEWPORT", ""),
        "editor_ui_flow_timeout_ms": int(env.get("EDITOR_UI_FLOW_TIMEOUT_MS", "0") or 0),
        "editor_ui_flow_open_retries": int(env.get("EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES", "0") or 0),
        "editor_ui_flow_headed": env.get("EDITOR_UI_FLOW_HEADED", "0") == "1",
        "run_ui_flow_failure_injection": env.get("RUN_UI_FLOW_FAILURE_INJECTION", "0") == "1",
        "ui_flow_failure_injection_timeout_ms": int(env.get("UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS", "0") or 0),
        "ui_flow_failure_injection_strict": env.get("UI_FLOW_FAILURE_INJECTION_STRICT", "0") == "1",
        "auto_gate_limit": env.get("AUTO_GATE_LIMIT", "0") == "1",
        "gate_smoke_limit": int(env.get("GATE_SMOKE_LIMIT", "0")),
        "gate_limit_source": env.get("GATE_LIMIT_SOURCE", ""),
        "gate_cad_attempts": int(env.get("GATE_CAD_ATTEMPTS", "0")),
        "editor_gate_append_report": env.get("EDITOR_GATE_APPEND_REPORT", "0") == "1",
        "pretrend_status": env.get("PRE_TREND_STATUS", ""),
        "pretrend_json": env.get("PRE_TREND_JSON", ""),
        "cad_mode": env.get("CAD_MODE", ""),
        "cad_max_workers": int(env.get("CAD_MAX_WORKERS", "0")),
        "perf_entities": int(env.get("PERF_ENTITIES", "0")),
        "perf_pick_samples": int(env.get("PERF_PICK_SAMPLES", "0")),
        "perf_box_samples": int(env.get("PERF_BOX_SAMPLES", "0")),
        "perf_drag_samples": int(env.get("PERF_DRAG_SAMPLES", "0")),
        "perf_repeat": int(env.get("PERF_REPEAT", "1")),
        "perf_interval_sec": int(env.get("PERF_INTERVAL_SEC", "0")),
        "run_gate": gate_expected,
        "gate_run_preview_provenance_smoke_gate": bool(gate_inputs_payload.get("run_preview_provenance_smoke_gate", to_bool(env.get("RUN_PREVIEW_PROVENANCE_SMOKE_GATE", "0")))),
        "gate_run_preview_provenance_failure_injection_gate": bool(gate_inputs_payload.get("run_preview_provenance_failure_injection_gate", to_bool(env.get("RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE", "0")))),
        "gate_run_preview_artifact_smoke_gate": bool(gate_inputs_payload.get("run_preview_artifact_smoke_gate", to_bool(env.get("RUN_PREVIEW_ARTIFACT_SMOKE_GATE", "0")))),
        "gate_run_preview_artifact_validator_failure_injection_gate": bool(gate_inputs_payload.get("run_preview_artifact_validator_failure_injection_gate", to_bool(env.get("RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE", "0")))),
        "gate_run_dwg_open_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_SMOKE_GATE", "0")))),
        "gate_run_dwg_open_desktop_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_desktop_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_DESKTOP_SMOKE_GATE", "0")))),
        "gate_run_dwg_open_matrix_smoke_gate": bool(gate_inputs_payload.get("run_dwg_open_matrix_smoke_gate", to_bool(env.get("RUN_DWG_OPEN_MATRIX_SMOKE_GATE", "0")))),
        "gate_run_solver_action_panel_smoke_gate": bool(gate_inputs_payload.get("run_solver_action_panel_smoke_gate", to_bool(env.get("RUN_SOLVER_ACTION_PANEL_SMOKE_GATE", "0")))),
        "gate_run_constraints_basic_ctest_gate": bool(gate_inputs_payload.get("run_constraints_basic_ctest_gate", to_bool(env.get("RUN_CONSTRAINTS_BASIC_CTEST_GATE", "0")))),
        "gate_run_assembly_roundtrip_ctest_gate": bool(gate_inputs_payload.get("run_assembly_roundtrip_ctest_gate", to_bool(env.get("RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE", "0")))),
        "gate_run_qt_project_persistence_check": env.get("GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK", "1") == "1",
        "gate_run_qt_project_persistence_gate": env.get("GATE_RUN_QT_PROJECT_PERSISTENCE_GATE", "1") == "1",
        "gate_qt_project_persistence_require_on": env.get("GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON", "auto"),
        "qt_policy_days": int(env.get("QT_PROJECT_POLICY_DAYS", "0") or 0),
        "qt_policy_min_samples": int(env.get("QT_PROJECT_POLICY_MIN_SAMPLES", "0") or 0),
        "qt_policy_min_consecutive_passes": int(env.get("QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES", "0") or 0),
        "perf_trend_min_selected": perf_min_selected,
        "real_scene_trend_min_selected": min_selected,
        "case_selection_trend_windows": env.get("CASE_SELECTION_TREND_WINDOWS", ""),
        "ui_flow_stage_trend_days": as_int(env.get("UI_FLOW_STAGE_TREND_DAYS", "0"), 0),
        "run_weekly_summary_check": env.get("RUN_WEEKLY_SUMMARY_CHECK", "1") == "1",
        "weekly_summary_check_strict": env.get("WEEKLY_SUMMARY_CHECK_STRICT", "1") == "1",
        "weekly_summary_check_dashboard": env.get("WEEKLY_SUMMARY_CHECK_DASHBOARD", ""),
        "weekly_summary_check_require_dashboard": env.get("WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD", "0") == "1",
        "run_editor_parallel_cycle": env.get("RUN_EDITOR_PARALLEL_CYCLE", "0") == "1",
        "parallel_cycle_watch_policy": env.get("PARALLEL_CYCLE_WATCH_POLICY", "observe"),
        "weekly_parallel_decision_policy": env.get("WEEKLY_PARALLEL_DECISION_POLICY", "observe"),
        "parallel_cycle_run_lane_a": env.get("PARALLEL_CYCLE_RUN_LANE_A", "0") == "1",
        "parallel_cycle_run_lane_b": env.get("PARALLEL_CYCLE_RUN_LANE_B", "0") == "1",
        "parallel_cycle_run_lane_c": env.get("PARALLEL_CYCLE_RUN_LANE_C", "0") == "1",
        "parallel_cycle_lane_b_run_ui_flow": env.get("PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW", "0") == "1",
        "parallel_cycle_lane_b_ui_flow_mode": env.get("PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE", ""),
        "parallel_cycle_lane_b_ui_flow_timeout_ms": as_int(env.get("PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS", "0"), 0),
        "parallel_cycle_lane_b_ui_flow_open_retries": as_int(env.get("PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_RETRIES", "0"), 0),
        "parallel_cycle_strict": env.get("PARALLEL_CYCLE_STRICT", "0") == "1",
    },
    "gate_runtime": gate_runtime_payload,
    "editor_smoke": {
        "run_id": env.get("EDITOR_SMOKE_RUN_ID", ""),
        "run_dir": env.get("EDITOR_SMOKE_RUN_DIR", ""),
        "summary_json": env.get("EDITOR_SMOKE_SUMMARY", ""),
        "status": editor_smoke_analysis.get("status", "UNKNOWN"),
        "totals": editor_smoke_analysis.get("totals", {}),
        "failure_buckets": editor_smoke_analysis.get("failure_buckets", {}),
        "failure_code_counts": editor_smoke_analysis.get("failure_code_counts", {}),
        "first_failure_code": editor_smoke_analysis.get("first_failure_code", ""),
        "failed_cases": editor_smoke_analysis.get("failed_cases", []),
        "filters": editor_smoke_analysis.get("filters", {}),
        "case_selection": editor_smoke_analysis.get("case_selection", {}),
        "summary_loaded": editor_smoke_analysis.get("summary_loaded", False),
    },
    "ui_flow_smoke": {
        "enabled": env.get("RUN_EDITOR_UI_FLOW_SMOKE", "0") == "1",
        "mode": env.get("EDITOR_UI_FLOW_MODE", ""),
        "open_retries": int(env.get("EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES", "0") or 0),
        "open_attempt_count": 0,
        "open_attempt_exit_codes": "",
        "status": env.get("UI_FLOW_STATUS", "skipped"),
        "run_id": env.get("UI_FLOW_RUN_ID", ""),
        "summary_json": env.get("UI_FLOW_SUMMARY", ""),
        "exit_code": int(env.get("UI_FLOW_RC", "0") or 0),
        "gate_runs_target": int(env.get("UI_FLOW_RUNS_TARGET", "0") or 0),
        "gate_run_count": int(env.get("UI_FLOW_RUN_COUNT", "0") or 0),
        "gate_pass_count": int(env.get("UI_FLOW_PASS_COUNT", "0") or 0),
        "gate_fail_count": int(env.get("UI_FLOW_FAIL_COUNT", "0") or 0),
        "run_summaries": split_paths(env.get("UI_FLOW_RUN_SUMMARIES", "")),
        "failure_code_counts": parse_json_text(env.get("UI_FLOW_FAILURE_CODE_COUNTS_JSON", "")) or {},
        "first_failure_code": env.get("UI_FLOW_FIRST_FAILURE_CODE", ""),
    },
    "gate_preview_provenance_smoke": {
        "enabled": bool(gate_preview_provenance_smoke.get("enabled", False)),
        "mode": str(gate_preview_provenance_smoke.get("mode") or ""),
        "gate_required": bool(gate_preview_provenance_smoke.get("gate_required", False)),
        "run_id": str(gate_preview_provenance_smoke.get("run_id") or ""),
        "summary_json": str(gate_preview_provenance_smoke.get("summary_json") or ""),
        "ok": bool(gate_preview_provenance_smoke.get("ok", False)),
        "exit_code": as_int(gate_preview_provenance_smoke.get("exit_code"), 0),
        "case_count": as_int(gate_preview_provenance_smoke.get("case_count"), 0),
        "pass_count": as_int(gate_preview_provenance_smoke.get("pass_count"), 0),
        "fail_count": as_int(gate_preview_provenance_smoke.get("fail_count"), 0),
        "initial_entry_case_count": as_int(gate_preview_provenance_smoke.get("initial_entry_case_count"), 0),
        "deterministic_entry_case_count": as_int(gate_preview_provenance_smoke.get("deterministic_entry_case_count"), 0),
        "focus_check_case_count": as_int(gate_preview_provenance_smoke.get("focus_check_case_count"), 0),
        "first_failed_case": str(gate_preview_provenance_smoke.get("first_failed_case") or ""),
    },
    "gate_dwg_open_smoke": {
        "enabled": bool(gate_dwg_open_smoke.get("enabled", False)),
        "mode": str(gate_dwg_open_smoke.get("mode") or ""),
        "gate_required": bool(gate_dwg_open_smoke.get("gate_required", False)),
        "run_id": str(gate_dwg_open_smoke.get("run_id") or ""),
        "summary_json": str(gate_dwg_open_smoke.get("summary_json") or ""),
        "ok": bool(gate_dwg_open_smoke.get("ok", False)),
        "exit_code": as_int(gate_dwg_open_smoke.get("exit_code"), 0),
        "input_dwg": str(gate_dwg_open_smoke.get("input_dwg") or ""),
        "dwg_convert_ok": bool(gate_dwg_open_smoke.get("dwg_convert_ok", False)),
        "router_ok": bool(gate_dwg_open_smoke.get("router_ok", False)),
        "convert_ok": bool(gate_dwg_open_smoke.get("convert_ok", False)),
        "viewer_ok": bool(gate_dwg_open_smoke.get("viewer_ok", False)),
        "validator_ok_count": as_int(gate_dwg_open_smoke.get("validator_ok_count"), 0),
        "error": str(gate_dwg_open_smoke.get("error") or ""),
    },
    "gate_dwg_open_matrix_smoke": {
        "enabled": bool(gate_dwg_open_matrix_smoke.get("enabled", False)),
        "mode": str(gate_dwg_open_matrix_smoke.get("mode") or ""),
        "gate_required": bool(gate_dwg_open_matrix_smoke.get("gate_required", False)),
        "run_id": str(gate_dwg_open_matrix_smoke.get("run_id") or ""),
        "summary_json": str(gate_dwg_open_matrix_smoke.get("summary_json") or ""),
        "ok": bool(gate_dwg_open_matrix_smoke.get("ok", False)),
        "exit_code": as_int(gate_dwg_open_matrix_smoke.get("exit_code"), 0),
        "case_count": as_int(gate_dwg_open_matrix_smoke.get("case_count"), 0),
        "pass_count": as_int(gate_dwg_open_matrix_smoke.get("pass_count"), 0),
        "fail_count": as_int(gate_dwg_open_matrix_smoke.get("fail_count"), 0),
        "validator_ok_count": as_int(gate_dwg_open_matrix_smoke.get("validator_ok_count"), 0),
        "dwg_convert_ok_count": as_int(gate_dwg_open_matrix_smoke.get("dwg_convert_ok_count"), 0),
        "router_ok_count": as_int(gate_dwg_open_matrix_smoke.get("router_ok_count"), 0),
        "convert_ok_count": as_int(gate_dwg_open_matrix_smoke.get("convert_ok_count"), 0),
        "viewer_ok_count": as_int(gate_dwg_open_matrix_smoke.get("viewer_ok_count"), 0),
        "first_failed_case": str(gate_dwg_open_matrix_smoke.get("first_failed_case") or ""),
        "error": str(gate_dwg_open_matrix_smoke.get("error") or ""),
    },
    "gate_dwg_open_desktop_smoke": {
        "enabled": bool(gate_dwg_open_desktop_smoke.get("enabled", False)),
        "mode": str(gate_dwg_open_desktop_smoke.get("mode") or ""),
        "gate_required": bool(gate_dwg_open_desktop_smoke.get("gate_required", False)),
        "run_id": str(gate_dwg_open_desktop_smoke.get("run_id") or ""),
        "summary_json": str(gate_dwg_open_desktop_smoke.get("summary_json") or ""),
        "ok": bool(gate_dwg_open_desktop_smoke.get("ok", False)),
        "exit_code": as_int(gate_dwg_open_desktop_smoke.get("exit_code"), 0),
        "input_dwg": str(gate_dwg_open_desktop_smoke.get("input_dwg") or ""),
        "desktop_ok": bool(gate_dwg_open_desktop_smoke.get("desktop_ok", False)),
        "manifest_ok": bool(gate_dwg_open_desktop_smoke.get("manifest_ok", False)),
        "preview_artifacts_ok": bool(gate_dwg_open_desktop_smoke.get("preview_artifacts_ok", False)),
        "validator_ok_count": as_int(gate_dwg_open_desktop_smoke.get("validator_ok_count"), 0),
        "error": str(gate_dwg_open_desktop_smoke.get("error") or ""),
    },
    "gate_solver_action_panel_smoke": {
        "enabled": bool(gate_solver_action_panel_smoke.get("enabled", False)),
        "mode": str(gate_solver_action_panel_smoke.get("mode") or ""),
        "gate_required": bool(gate_solver_action_panel_smoke.get("gate_required", False)),
        "run_id": str(gate_solver_action_panel_smoke.get("run_id") or ""),
        "summary_json": str(gate_solver_action_panel_smoke.get("summary_json") or ""),
        "ok": bool(gate_solver_action_panel_smoke.get("ok", False)),
        "exit_code": as_int(gate_solver_action_panel_smoke.get("exit_code"), 0),
        "panel_count": as_int(gate_solver_action_panel_smoke.get("panel_count"), 0),
        "flow_check_count": as_int(gate_solver_action_panel_smoke.get("flow_check_count"), 0),
        "request_count": as_int(gate_solver_action_panel_smoke.get("request_count"), 0),
        "invoke_request_count": as_int(gate_solver_action_panel_smoke.get("invoke_request_count"), 0),
        "focus_request_count": as_int(gate_solver_action_panel_smoke.get("focus_request_count"), 0),
        "flow_request_count": as_int(gate_solver_action_panel_smoke.get("flow_request_count"), 0),
        "replay_request_count": as_int(gate_solver_action_panel_smoke.get("replay_request_count"), 0),
        "import_check_count": as_int(gate_solver_action_panel_smoke.get("import_check_count"), 0),
        "clear_check_count": as_int(gate_solver_action_panel_smoke.get("clear_check_count"), 0),
        "jump_request_count": as_int(gate_solver_action_panel_smoke.get("jump_request_count"), 0),
        "dom_event_count": as_int(gate_solver_action_panel_smoke.get("dom_event_count"), 0),
        "dom_request_event_count": as_int(gate_solver_action_panel_smoke.get("dom_request_event_count"), 0),
        "dom_action_event_count": as_int(gate_solver_action_panel_smoke.get("dom_action_event_count"), 0),
        "dom_focus_event_count": as_int(gate_solver_action_panel_smoke.get("dom_focus_event_count"), 0),
        "dom_flow_event_count": as_int(gate_solver_action_panel_smoke.get("dom_flow_event_count"), 0),
        "dom_replay_event_count": as_int(gate_solver_action_panel_smoke.get("dom_replay_event_count"), 0),
        "event_count": as_int(gate_solver_action_panel_smoke.get("event_count"), 0),
        "invoke_event_count": as_int(gate_solver_action_panel_smoke.get("invoke_event_count"), 0),
        "focus_event_count": as_int(gate_solver_action_panel_smoke.get("focus_event_count"), 0),
        "flow_event_count": as_int(gate_solver_action_panel_smoke.get("flow_event_count"), 0),
        "replay_event_count": as_int(gate_solver_action_panel_smoke.get("replay_event_count"), 0),
        "next_check_count": as_int(gate_solver_action_panel_smoke.get("next_check_count"), 0),
        "jump_check_count": as_int(gate_solver_action_panel_smoke.get("jump_check_count"), 0),
        "rewind_check_count": as_int(gate_solver_action_panel_smoke.get("rewind_check_count"), 0),
        "restart_check_count": as_int(gate_solver_action_panel_smoke.get("restart_check_count"), 0),
        "replay_check_count": as_int(gate_solver_action_panel_smoke.get("replay_check_count"), 0),
        "event_focus_check_count": as_int(gate_solver_action_panel_smoke.get("event_focus_check_count"), 0),
        "banner_check_count": as_int(gate_solver_action_panel_smoke.get("banner_check_count"), 0),
        "banner_event_focus_check_count": as_int(gate_solver_action_panel_smoke.get("banner_event_focus_check_count"), 0),
        "banner_focus_click_check_count": as_int(gate_solver_action_panel_smoke.get("banner_focus_click_check_count"), 0),
        "console_check_count": as_int(gate_solver_action_panel_smoke.get("console_check_count"), 0),
        "console_flow_check_count": as_int(gate_solver_action_panel_smoke.get("console_flow_check_count"), 0),
        "console_event_focus_check_count": as_int(gate_solver_action_panel_smoke.get("console_event_focus_check_count"), 0),
        "console_replay_check_count": as_int(gate_solver_action_panel_smoke.get("console_replay_check_count"), 0),
        "console_event_click_check_count": as_int(gate_solver_action_panel_smoke.get("console_event_click_check_count"), 0),
        "console_focus_click_check_count": as_int(gate_solver_action_panel_smoke.get("console_focus_click_check_count"), 0),
        "console_selection_check_count": as_int(gate_solver_action_panel_smoke.get("console_selection_check_count"), 0),
        "status_check_count": as_int(gate_solver_action_panel_smoke.get("status_check_count"), 0),
        "status_click_check_count": as_int(gate_solver_action_panel_smoke.get("status_click_check_count"), 0),
        "keyboard_check_count": as_int(gate_solver_action_panel_smoke.get("keyboard_check_count"), 0),
        "panel_cycle_check_count": as_int(gate_solver_action_panel_smoke.get("panel_cycle_check_count"), 0),
        "panel_keyboard_check_count": as_int(gate_solver_action_panel_smoke.get("panel_keyboard_check_count"), 0),
        "panel_keyboard_invoke_check_count": as_int(gate_solver_action_panel_smoke.get("panel_keyboard_invoke_check_count"), 0),
        "panel_keyboard_flow_check_count": as_int(gate_solver_action_panel_smoke.get("panel_keyboard_flow_check_count"), 0),
        "keyboard_banner_check_count": as_int(gate_solver_action_panel_smoke.get("keyboard_banner_check_count"), 0),
        "keyboard_jump_check_count": as_int(gate_solver_action_panel_smoke.get("keyboard_jump_check_count"), 0),
        "keyboard_event_focus_check_count": as_int(gate_solver_action_panel_smoke.get("keyboard_event_focus_check_count"), 0),
        "jump_event_count": as_int(gate_solver_action_panel_smoke.get("jump_event_count"), 0),
        "visited_panel_count": as_int(gate_solver_action_panel_smoke.get("visited_panel_count"), 0),
    },
    "gate_preview_provenance_failure_injection": {
        "enabled": bool(gate_preview_provenance_failure_injection.get("enabled", False)),
        "status": str(gate_preview_provenance_failure_injection.get("status") or ""),
        "run_id": str(gate_preview_provenance_failure_injection.get("run_id") or ""),
        "summary_json": str(gate_preview_provenance_failure_injection.get("summary_json") or ""),
        "exit_code": as_int(gate_preview_provenance_failure_injection.get("exit_code"), 0),
        "case_count": as_int(gate_preview_provenance_failure_injection.get("case_count"), 0),
        "pass_count": as_int(gate_preview_provenance_failure_injection.get("pass_count"), 0),
        "fail_count": as_int(gate_preview_provenance_failure_injection.get("fail_count"), 0),
        "first_failed_case": str(gate_preview_provenance_failure_injection.get("first_failed_case") or ""),
        "cases_path": str(gate_preview_provenance_failure_injection.get("cases_path") or ""),
    },
    "step186_preview_artifact_prep": {
        "enabled": bool(gate_step186_preview_artifact_prep.get("enabled", False)),
        "status": str(gate_step186_preview_artifact_prep.get("status") or ""),
        "run_id": str(gate_step186_preview_artifact_prep.get("run_id") or ""),
        "summary_json": str(gate_step186_preview_artifact_prep.get("summary_json") or ""),
        "exit_code": as_int(gate_step186_preview_artifact_prep.get("exit_code"), 0),
        "case_count": as_int(gate_step186_preview_artifact_prep.get("case_count"), 0),
        "pass_count": as_int(gate_step186_preview_artifact_prep.get("pass_count"), 0),
        "fail_count": as_int(gate_step186_preview_artifact_prep.get("fail_count"), 0),
        "first_failed_case": str(gate_step186_preview_artifact_prep.get("first_failed_case") or ""),
    },
    "gate_preview_artifact_smoke": {
        "enabled": bool(gate_preview_artifact_smoke.get("enabled", False)),
        "status": str(gate_preview_artifact_smoke.get("status") or ""),
        "run_id": str(gate_preview_artifact_smoke.get("run_id") or ""),
        "summary_json": str(gate_preview_artifact_smoke.get("summary_json") or ""),
        "exit_code": as_int(gate_preview_artifact_smoke.get("exit_code"), 0),
        "case_count": as_int(gate_preview_artifact_smoke.get("case_count"), 0),
        "pass_count": as_int(gate_preview_artifact_smoke.get("pass_count"), 0),
        "fail_count": as_int(gate_preview_artifact_smoke.get("fail_count"), 0),
        "first_failed_case": str(gate_preview_artifact_smoke.get("first_failed_case") or ""),
        "cases_path": str(gate_preview_artifact_smoke.get("cases_path") or ""),
    },
    "gate_constraints_basic_ctest": {
        "enabled": bool(gate_constraints_basic_ctest.get("enabled", False)),
        "status": str(gate_constraints_basic_ctest.get("status") or ""),
        "build_dir": str(gate_constraints_basic_ctest.get("build_dir") or ""),
        "case_count": as_int(gate_constraints_basic_ctest.get("case_count"), 0),
        "pass_count": as_int(gate_constraints_basic_ctest.get("pass_count"), 0),
        "fail_count": as_int(gate_constraints_basic_ctest.get("fail_count"), 0),
        "missing_count": as_int(gate_constraints_basic_ctest.get("missing_count"), 0),
        "first_failed_case": str(gate_constraints_basic_ctest.get("first_failed_case") or ""),
        "test_name": str(gate_constraints_basic_ctest.get("test_name") or ""),
    },
    "gate_assembly_roundtrip_ctest": {
        "enabled": bool(gate_assembly_roundtrip_ctest.get("enabled", False)),
        "status": str(gate_assembly_roundtrip_ctest.get("status") or ""),
        "build_dir": str(gate_assembly_roundtrip_ctest.get("build_dir") or ""),
        "case_count": as_int(gate_assembly_roundtrip_ctest.get("case_count"), 0),
        "pass_count": as_int(gate_assembly_roundtrip_ctest.get("pass_count"), 0),
        "fail_count": as_int(gate_assembly_roundtrip_ctest.get("fail_count"), 0),
        "missing_count": as_int(gate_assembly_roundtrip_ctest.get("missing_count"), 0),
        "first_failed_case": str(gate_assembly_roundtrip_ctest.get("first_failed_case") or ""),
        "model_status": str(gate_assembly_roundtrip_ctest.get("model_status") or ""),
        "paperspace_status": str(gate_assembly_roundtrip_ctest.get("paperspace_status") or ""),
        "mixed_status": str(gate_assembly_roundtrip_ctest.get("mixed_status") or ""),
        "dense_status": str(gate_assembly_roundtrip_ctest.get("dense_status") or ""),
        "summary_json_count": as_int(gate_assembly_roundtrip_ctest.get("summary_json_count"), 0),
        "import_entity_count": as_int(gate_assembly_roundtrip_ctest.get("import_entity_count"), 0),
        "import_unsupported_count": as_int(gate_assembly_roundtrip_ctest.get("import_unsupported_count"), 0),
        "import_derived_proxy_count": as_int(gate_assembly_roundtrip_ctest.get("import_derived_proxy_count"), 0),
        "import_exploded_origin_count": as_int(gate_assembly_roundtrip_ctest.get("import_exploded_origin_count"), 0),
        "import_assembly_tracked_count": as_int(gate_assembly_roundtrip_ctest.get("import_assembly_tracked_count"), 0),
        "import_assembly_group_count": as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_count"), 0),
        "import_assembly_group_source_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_counts_b64") or ""),
        "import_assembly_group_layout_source_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_counts_b64") or ""),
        "import_assembly_group_layout_source_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_case_count"), 0),
        "import_assembly_group_layout_source_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_assembly_group_layout_source_case_details_b64") or ""),
        "import_assembly_group_source_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_case_count"), 0),
        "import_assembly_group_source_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_assembly_group_source_case_details_b64") or ""),
        "import_proxy_kind_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_proxy_kind_counts_b64") or ""),
        "import_proxy_kind_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_proxy_kind_case_count"), 0),
        "import_proxy_kind_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_proxy_kind_case_details_b64") or ""),
        "import_proxy_layout_kind_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_proxy_layout_kind_counts_b64") or ""),
        "import_proxy_layout_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_proxy_layout_case_count"), 0),
        "import_proxy_layout_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_proxy_layout_case_details_b64") or ""),
        "import_text_kind_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_text_kind_counts_b64") or ""),
        "import_text_kind_layout_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_text_kind_layout_counts_b64") or ""),
        "import_text_kind_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_text_kind_case_count"), 0),
        "import_text_kind_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_text_kind_case_details_b64") or ""),
        "import_exploded_layout_source_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_counts_b64") or ""),
        "import_exploded_layout_source_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_case_count"), 0),
        "import_exploded_layout_source_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_exploded_layout_source_case_details_b64") or ""),
        "import_viewport_count": as_int(gate_assembly_roundtrip_ctest.get("import_viewport_count"), 0),
        "import_viewport_layout_count": as_int(gate_assembly_roundtrip_ctest.get("import_viewport_layout_count"), 0),
        "import_viewport_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_viewport_case_count"), 0),
        "import_viewport_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_viewport_case_details_b64") or ""),
        "import_viewport_proxy_kind_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_kind_counts_b64") or ""),
        "import_viewport_proxy_layout_kind_counts_b64": str(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_layout_kind_counts_b64") or ""),
        "import_viewport_proxy_case_count": as_int(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_case_count"), 0),
        "import_viewport_proxy_case_details_b64": str(gate_assembly_roundtrip_ctest.get("import_viewport_proxy_case_details_b64") or ""),
        "export_derived_proxy_checked_count": as_int(gate_assembly_roundtrip_ctest.get("export_derived_proxy_checked_count"), 0),
        "export_exploded_checked_count": as_int(gate_assembly_roundtrip_ctest.get("export_exploded_checked_count"), 0),
        "export_assembly_checked_count": as_int(gate_assembly_roundtrip_ctest.get("export_assembly_checked_count"), 0),
        "export_assembly_group_count": as_int(gate_assembly_roundtrip_ctest.get("export_assembly_group_count"), 0),
        "export_metadata_drift_count": as_int(gate_assembly_roundtrip_ctest.get("export_metadata_drift_count"), 0),
        "export_group_drift_count": as_int(gate_assembly_roundtrip_ctest.get("export_group_drift_count"), 0),
        "model_summary_json": str(gate_assembly_roundtrip_ctest.get("model_summary_json") or ""),
        "paperspace_summary_json": str(gate_assembly_roundtrip_ctest.get("paperspace_summary_json") or ""),
        "mixed_summary_json": str(gate_assembly_roundtrip_ctest.get("mixed_summary_json") or ""),
        "dense_summary_json": str(gate_assembly_roundtrip_ctest.get("dense_summary_json") or ""),
        "model_case_name": str(gate_assembly_roundtrip_ctest.get("model_case_name") or ""),
        "paperspace_case_name": str(gate_assembly_roundtrip_ctest.get("paperspace_case_name") or ""),
        "mixed_case_name": str(gate_assembly_roundtrip_ctest.get("mixed_case_name") or ""),
        "dense_case_name": str(gate_assembly_roundtrip_ctest.get("dense_case_name") or ""),
    },
    "weekly_legacy_preview_artifact_prep": {
        "enabled": env.get("RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP", "0") == "1",
        "status": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_STATUS", "skipped"),
        "run_id": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RUN_ID", ""),
        "summary_json": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_SUMMARY", ""),
        "exit_code": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_RC", "0") or 0),
        "case_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASE_COUNT", "0") or 0),
        "pass_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_PASS_COUNT", "0") or 0),
        "fail_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FAIL_COUNT", "0") or 0),
        "first_failed_case": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_FIRST_FAILED_CASE", ""),
        "missing_input_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_INPUT_COUNT", "0") or 0),
        "missing_manifest_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_MISSING_MANIFEST_COUNT", "0") or 0),
        "cases_path": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP_CASES", ""),
    },
    "weekly_legacy_preview_artifact_smoke": {
        "enabled": env.get("RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE", "0") == "1",
        "status": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_STATUS", "skipped"),
        "run_id": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RUN_ID", ""),
        "summary_json": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_SUMMARY", ""),
        "exit_code": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_RC", "0") or 0),
        "case_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASE_COUNT", "0") or 0),
        "pass_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_PASS_COUNT", "0") or 0),
        "fail_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FAIL_COUNT", "0") or 0),
        "first_failed_case": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_FIRST_FAILED_CASE", ""),
        "missing_target_count": int(env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_MISSING_COUNT", "0") or 0),
        "cases_path": env.get("WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE_CASES", ""),
    },
    "gate_preview_artifact_validator_failure_injection": {
        "enabled": bool(gate_preview_artifact_validator_failure_injection.get("enabled", False)),
        "status": str(gate_preview_artifact_validator_failure_injection.get("status") or ""),
        "run_id": str(gate_preview_artifact_validator_failure_injection.get("run_id") or ""),
        "summary_json": str(gate_preview_artifact_validator_failure_injection.get("summary_json") or ""),
        "exit_code": as_int(gate_preview_artifact_validator_failure_injection.get("exit_code"), 0),
        "case_count": as_int(gate_preview_artifact_validator_failure_injection.get("case_count"), 0),
        "pass_count": as_int(gate_preview_artifact_validator_failure_injection.get("pass_count"), 0),
        "fail_count": as_int(gate_preview_artifact_validator_failure_injection.get("fail_count"), 0),
        "first_failed_case": str(gate_preview_artifact_validator_failure_injection.get("first_failed_case") or ""),
        "cases_path": str(gate_preview_artifact_validator_failure_injection.get("cases_path") or ""),
    },
    "ui_flow_failure_injection": {
        "enabled": env.get("RUN_UI_FLOW_FAILURE_INJECTION", "0") == "1",
        "status": env.get("UI_FLOW_FAILURE_INJECTION_STATUS", "SKIPPED"),
        "run_id": env.get("UI_FLOW_FAILURE_INJECTION_RUN_ID", ""),
        "summary_json": env.get("UI_FLOW_FAILURE_INJECTION_SUMMARY", ""),
        "exit_code": int(env.get("UI_FLOW_FAILURE_INJECTION_RC", "0") or 0),
        "failure_code": env.get("UI_FLOW_FAILURE_INJECTION_FAILURE_CODE", ""),
        "failure_detail": env.get("UI_FLOW_FAILURE_INJECTION_FAILURE_DETAIL", ""),
    },
    "step166": {
        "run_id": env.get("CAD_RUN_ID", ""),
        "run_dir": env.get("CAD_RUN_DIR", ""),
        "summary_json": env.get("CAD_SUMMARY", ""),
        "failures_json": env.get("CAD_FAILURES", ""),
        "trend_input_json": env.get("CAD_TREND_INPUT", ""),
        "gate_would_fail": to_bool(env.get("CAD_GATE_WOULD_FAIL", "")),
    },
    "step166_baseline_refresh": {
        "enabled": env.get("RUN_STEP166_BASELINE_REFRESH", "0") == "1",
        "days": int(env.get("STEP166_BASELINE_REFRESH_DAYS", "0") or 0),
        "apply": env.get("STEP166_BASELINE_REFRESH_APPLY", "0") == "1",
        "rc": int(env.get("STEP166_BASELINE_REFRESH_RC", "0") or 0),
        "eligible": to_bool(env.get("STEP166_BASELINE_REFRESH_ELIGIBLE", "")),
        "applied": to_bool(env.get("STEP166_BASELINE_REFRESH_APPLIED", "")),
        "candidate_run_id": env.get("STEP166_BASELINE_REFRESH_CANDIDATE_RUN_ID", ""),
        "reason": env.get("STEP166_BASELINE_REFRESH_REASON", ""),
        "backup_path": env.get("STEP166_BASELINE_REFRESH_BACKUP_PATH", ""),
        "baseline_path": env.get("CAD_BASELINE", ""),
        "window_report": parse_json_text(env.get("STEP166_BASELINE_REFRESH_WINDOW_REPORT", "")) or [],
    },
    "performance": {
        "run_id": env.get("PERF_RUN_ID", ""),
        "run_dir": env.get("PERF_RUN_DIR", ""),
        "summary_json": env.get("PERF_SUMMARY", ""),
    },
    "real_scene_perf": {
        "enabled": env.get("RUN_REAL_SCENE_PERF", "0") == "1",
        "mode": env.get("REAL_SCENE_MODE", ""),
        "profile": env.get("REAL_SCENE_PROFILE", ""),
        "status": env.get("REAL_SCENE_STATUS", "skipped"),
        "run_id": env.get("REAL_SCENE_RUN_ID", ""),
        "summary_json": env.get("REAL_SCENE_SUMMARY", ""),
        "gate_would_fail": to_bool(env.get("REAL_SCENE_GATE_WOULD_FAIL", "")),
    },
    "gate": {
        "status": gate_status_value or "skipped",
        "exit_code": as_int(env.get("GATE_RC", "0"), 0),
        "summary_json": gate_summary_value,
        "inputs": gate_inputs_payload,
        "runtime": gate_runtime_payload,
        "gate_decision": gate_decision,
        "editor_smoke": gate_editor_smoke,
        "ui_flow_smoke": gate_ui_flow_smoke,
        "step166": gate_step166,
        "editor_smoke_failure_injection": gate_editor_smoke_injection,
        "qt_project_persistence": gate_qt_project_persistence,
    },
    "qt_project_persistence_policy": {
        "status": env.get("QT_PROJECT_POLICY_STATUS", ""),
        "recommended_require_on": env.get("QT_PROJECT_POLICY_RECOMMENDED_REQUIRE_ON", "0") == "1",
        "effective_require_on": env.get("QT_PROJECT_POLICY_REQUIRE_ON_EFFECTIVE", "0") == "1",
        "effective_source": env.get("QT_PROJECT_POLICY_REQUIRE_ON_SOURCE", ""),
        "summary_json": env.get("QT_PROJECT_POLICY_JSON", ""),
        "summary_md": env.get("QT_PROJECT_POLICY_MD", ""),
        "policy": qt_policy_payload.get("policy") if isinstance(qt_policy_payload.get("policy"), dict) else {},
        "metrics": qt_policy_payload.get("metrics") if isinstance(qt_policy_payload.get("metrics"), dict) else {},
        "samples_in_window": as_int(qt_policy_payload.get("samples_in_window"), 0),
        "samples_total": as_int(qt_policy_payload.get("samples_total"), 0),
        "recommendation": str(qt_policy_payload.get("recommendation") or ""),
    },
    "trend": {
        "days": int(env.get("TREND_DAYS", "0")),
        "status": env.get("TREND_STATUS", ""),
        "pre_summary_json": env.get("PRE_TREND_JSON", ""),
        "summary_json": env.get("TREND_JSON", ""),
        "summary_md": env.get("TREND_MD", ""),
    },
    "ui_flow_stage_trend": {
        "days": as_int(env.get("UI_FLOW_STAGE_TREND_DAYS", "0"), 0),
        "status": env.get("UI_FLOW_STAGE_TREND_STATUS", ""),
        "recommended_gate_mode": env.get("UI_FLOW_STAGE_TREND_GATE_MODE", "observe"),
        "summary_json": env.get("UI_FLOW_STAGE_TREND_JSON", ""),
        "summary_md": env.get("UI_FLOW_STAGE_TREND_MD", ""),
        "enabled_samples_in_window": as_int(ui_flow_stage_trend_payload.get("enabled_samples_in_window"), 0),
        "samples_in_window": as_int(ui_flow_stage_trend_payload.get("samples_in_window"), 0),
        "samples_total": as_int(ui_flow_stage_trend_payload.get("samples_total"), 0),
        "fail_ratio": as_float(as_dict(ui_flow_stage_trend_payload.get("metrics")).get("fail_ratio")),
        "attribution_ratio": as_float(as_dict(ui_flow_stage_trend_payload.get("metrics")).get("attribution_ratio")),
        "failure_stage_counts": as_dict(as_dict(ui_flow_stage_trend_payload.get("metrics")).get("failure_stage_counts")),
        "first_failure_stage_counts": as_dict(as_dict(ui_flow_stage_trend_payload.get("metrics")).get("first_failure_stage_counts")),
        "setup_exit_nonzero_runs": as_dict(as_dict(ui_flow_stage_trend_payload.get("metrics")).get("setup_exit_nonzero_runs")),
        "policy": as_dict(ui_flow_stage_trend_payload.get("policy")),
    },
    "perf_trend": {
        "days": int(env.get("PERF_TREND_DAYS", "0")),
        "status": env.get("PERF_TREND_STATUS", ""),
        "auto_gate_mode": perf_auto_gate_mode,
        "coverage_days": perf_coverage_days,
        "selected_samples_in_window": perf_selected_samples,
        "selection_mode": perf_trend_payload.get("selection_mode") or perf_trend_payload.get("selection") or "",
        "policy": perf_policy,
        "summary_json": env.get("PERF_TREND_JSON", ""),
        "summary_md": env.get("PERF_TREND_MD", ""),
    },
    "real_scene_trend": {
        "days": int(env.get("REAL_SCENE_TREND_DAYS", "0")),
        "status": env.get("REAL_SCENE_TREND_STATUS", ""),
        "auto_gate_mode": auto_gate_mode,
        "coverage_days": coverage_days,
        "selected_samples_in_window": selected_samples,
        "selection_mode": selection_mode,
        "policy": real_scene_trend_payload.get("policy") if isinstance(real_scene_trend_payload.get("policy"), dict) else {},
        "warnings": real_scene_trend_payload.get("warnings") if isinstance(real_scene_trend_payload.get("warnings"), list) else [],
        "critical_warnings": real_scene_trend_payload.get("critical_warnings") if isinstance(real_scene_trend_payload.get("critical_warnings"), list) else [],
        "summary_json": env.get("REAL_SCENE_TREND_JSON", ""),
        "summary_md": env.get("REAL_SCENE_TREND_MD", ""),
    },
    "case_selection_trend": {
        "windows": env.get("CASE_SELECTION_TREND_WINDOWS", ""),
        "status": env.get("CASE_SELECTION_TREND_STATUS", ""),
        "summary_json": env.get("CASE_SELECTION_TREND_JSON", ""),
        "summary_md": env.get("CASE_SELECTION_TREND_MD", ""),
        "samples_total": as_int(case_selection_trend_payload.get("samples_total"), 0),
        "generated_count_mismatch_runs_total": as_int(case_selection_trend_payload.get("generated_count_mismatch_runs_total"), 0),
        "generated_count_mismatch_rate_max": as_float(case_selection_trend_payload.get("generated_count_mismatch_rate_max")),
        "warning_codes": case_selection_trend_payload.get("warning_codes") if isinstance(case_selection_trend_payload.get("warning_codes"), list) else [],
        "window_summaries": case_selection_trend_payload.get("windows") if isinstance(case_selection_trend_payload.get("windows"), list) else [],
    },
    "parallel_cycle": {
        "enabled": env.get("RUN_EDITOR_PARALLEL_CYCLE", "0") == "1",
        "status": env.get("PARALLEL_CYCLE_STATUS", "skipped"),
        "exit_code": as_int(env.get("PARALLEL_CYCLE_RC", "0"), 0),
        "run_id": env.get("PARALLEL_CYCLE_RUN_ID", ""),
        "out_dir": env.get("PARALLEL_CYCLE_OUT_DIR", ""),
        "summary_json": env.get("PARALLEL_CYCLE_SUMMARY", ""),
        "summary_md": env.get("PARALLEL_CYCLE_SUMMARY_MD", ""),
        "watch_policy": env.get("PARALLEL_CYCLE_WATCH_POLICY", "observe"),
        "gate_decision": parallel_cycle_summary_payload.get("gate_decision") if isinstance(parallel_cycle_summary_payload.get("gate_decision"), dict) else {},
        "overall_status": str(parallel_cycle_summary_payload.get("overall_status") or env.get("PARALLEL_CYCLE_STATUS", "skipped")),
        "duration_sec": as_int(parallel_cycle_summary_payload.get("duration_sec"), 0),
        "lanes": parallel_cycle_lanes,
        "summary_loaded": bool(parallel_cycle_summary_payload),
        "gate_decision_raw": env.get("PARALLEL_CYCLE_GATE_DECISION", ""),
    },
}

payload["ui_flow_stage_trend_contract"] = validate_ui_stage_trend_contract(payload.get("ui_flow_stage_trend"))

ui_runs = []
ui_failure_code_counts = payload["ui_flow_smoke"].get("failure_code_counts")
if not isinstance(ui_failure_code_counts, dict):
    ui_failure_code_counts = {}
ui_first_failure_code = str(payload["ui_flow_smoke"].get("first_failure_code") or "")
ui_interaction_coverage = {}
ui_open_attempt_count = as_int(payload["ui_flow_smoke"].get("open_attempt_count"), 0)
ui_open_attempt_exit_codes = str(payload["ui_flow_smoke"].get("open_attempt_exit_codes") or "")
for path in payload["ui_flow_smoke"].get("run_summaries", []):
    run_payload = load_json(path)
    failure_code, failure_detail = classify_ui_flow_run(run_payload)
    run_open_attempt_count = as_int(run_payload.get("open_attempt_count"), 0)
    run_open_attempt_exit_codes = str(run_payload.get("open_attempt_exit_codes") or "")
    ui_open_attempt_count = max(ui_open_attempt_count, run_open_attempt_count)
    if not ui_open_attempt_exit_codes and run_open_attempt_exit_codes:
        ui_open_attempt_exit_codes = run_open_attempt_exit_codes
    interaction_checks = extract_ui_flow_interaction_checks(run_payload)
    if interaction_checks:
        for key, value in interaction_checks.items():
            key_text = str(key or "").strip()
            if not key_text:
                continue
            item = ui_interaction_coverage.setdefault(key_text, {"pass_runs": 0, "total_runs": 0})
            item["total_runs"] = as_int(item.get("total_runs"), 0) + 1
            if bool(value):
                item["pass_runs"] = as_int(item.get("pass_runs"), 0) + 1
    if failure_code:
        ui_failure_code_counts[failure_code] = int(ui_failure_code_counts.get(failure_code, 0)) + 1
        if not ui_first_failure_code:
            ui_first_failure_code = failure_code
    ui_runs.append({
        "summary_json": path,
        "run_id": run_payload.get("run_id", ""),
        "ok": run_payload.get("ok") is True,
        "flow_step": run_payload.get("flow_step", ""),
        "flow_status": run_payload.get("flow_status", ""),
        "flow_selection": run_payload.get("flow_selection", ""),
        "exit_code": as_int(run_payload.get("exit_code"), 0),
        "failure_code": failure_code,
        "failure_detail": failure_detail,
        "open_retry_limit": as_int(run_payload.get("open_retry_limit"), 0),
        "open_attempt_count": run_open_attempt_count,
        "open_attempt_exit_codes": run_open_attempt_exit_codes,
        "interaction_checks": interaction_checks,
        "error_tail": run_payload.get("error_tail") if isinstance(run_payload.get("error_tail"), list) else [],
    })
payload["ui_flow_smoke"]["runs"] = ui_runs
payload["ui_flow_smoke"]["failure_code_counts"] = ui_failure_code_counts
payload["ui_flow_smoke"]["first_failure_code"] = ui_first_failure_code
payload["ui_flow_smoke"]["open_attempt_count"] = ui_open_attempt_count
payload["ui_flow_smoke"]["open_attempt_exit_codes"] = ui_open_attempt_exit_codes
for row in ui_interaction_coverage.values():
    total_runs = as_int(row.get("total_runs"), 0)
    pass_runs = as_int(row.get("pass_runs"), 0)
    row["all_pass"] = (total_runs > 0 and pass_runs >= total_runs)
payload["ui_flow_smoke"]["interaction_checks_coverage"] = ui_interaction_coverage
payload["ui_flow_smoke"]["interaction_checks_complete"] = (
    (not bool(payload["ui_flow_smoke"].get("enabled")))
    or (
        bool(ui_interaction_coverage)
        and all(bool(v.get("all_pass", False)) for k, v in ui_interaction_coverage.items() if str(k) != "complete")
    )
)
ui_failure_code_total = sum(as_int(v, 0) for v in ui_failure_code_counts.values())
payload["ui_flow_smoke"]["failure_code_total"] = ui_failure_code_total
payload["ui_flow_smoke"]["failure_attribution_complete"] = (
    as_int(payload["ui_flow_smoke"].get("gate_fail_count"), 0) <= 0 or ui_failure_code_total > 0
)

os.makedirs(os.path.dirname(summary_json_path), exist_ok=True)
with open(summary_json_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")

lines = []
lines.append("# Editor Weekly Validation Summary")
lines.append("")
lines.append(f"- generated_at: `{payload['generated_at']}`")
lines.append(f"- workspace: `{payload['workspace']}`")
if payload.get("history_json"):
    lines.append(f"- history_json: `{payload['history_json']}`")
lines.append("")
lines.append("## Runs")
editor_totals = payload["editor_smoke"].get("totals") if isinstance(payload["editor_smoke"].get("totals"), dict) else {}
lines.append(
    "- editor_smoke: `status={status}` `run_id={run_id}` `pass={ok}` `fail={fail}` `skipped={skip}`".format(
        status=str(payload["editor_smoke"].get("status", "")),
        run_id=str(payload["editor_smoke"].get("run_id", "")),
        ok=as_int(editor_totals.get("pass"), 0),
        fail=as_int(editor_totals.get("fail"), 0),
        skip=as_int(editor_totals.get("skipped"), 0),
    )
)
editor_filters = payload["editor_smoke"].get("filters")
if isinstance(editor_filters, dict):
    pf = editor_filters.get("priority_set") if isinstance(editor_filters.get("priority_set"), list) else []
    tf = editor_filters.get("tag_any") if isinstance(editor_filters.get("tag_any"), list) else []
    if pf or tf:
        lines.append(
            "- editor_smoke_filters: `priority_set={priority}` `tag_any={tags}`".format(
                priority=",".join([str(x) for x in pf]) or "-",
                tags=",".join([str(x) for x in tf]) or "-",
            )
        )
editor_case_selection = payload["editor_smoke"].get("case_selection")
if isinstance(editor_case_selection, dict):
    lines.append(
        "- editor_smoke_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
            selected=as_int(editor_case_selection.get("selected_count"), 0),
            matched=as_int(editor_case_selection.get("matched_count"), 0),
            candidate=as_int(editor_case_selection.get("filtered_count"), 0),
            total=as_int(editor_case_selection.get("total_input"), 0),
            fallback=str(bool(editor_case_selection.get("used_fallback", False))).lower(),
        )
    )
lines.append(
    "- editor_smoke_cases_source: `{source}`".format(
        source=str(payload.get("inputs", {}).get("editor_smoke_case_source") or "discovery"),
    )
)
if bool(payload.get("inputs", {}).get("editor_smoke_generate_cases", False)):
    generated_run_ids = payload.get("inputs", {}).get("editor_smoke_generated_run_ids")
    if not isinstance(generated_run_ids, list):
        generated_run_ids = []
    generated_declared = as_int(payload.get("inputs", {}).get("editor_smoke_generated_count_declared"), as_int(payload.get("inputs", {}).get("editor_smoke_generated_count"), 0))
    generated_actual = as_int(payload.get("inputs", {}).get("editor_smoke_generated_count_actual"), as_int(payload.get("inputs", {}).get("editor_smoke_generated_count"), 0))
    generated_mismatch = bool(payload.get("inputs", {}).get("editor_smoke_generated_count_mismatch", generated_declared != generated_actual))
    lines.append(
        "- editor_smoke_generated_cases: path=`{path}` `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `priorities={priorities}`".format(
            path=str(payload.get("inputs", {}).get("editor_smoke_generated_cases_path") or ""),
            count=as_int(payload.get("inputs", {}).get("editor_smoke_generated_count"), 0),
            declared=generated_declared,
            actual=generated_actual,
            mismatch=str(generated_mismatch).lower(),
            min_cases=as_int(payload.get("inputs", {}).get("editor_smoke_generated_min_cases"), 0),
            priorities=str(payload.get("inputs", {}).get("editor_smoke_generated_priorities") or ""),
        )
    )
    lines.append(
        "- editor_smoke_generated_mismatch_policy: `policy={policy}`".format(
            policy=str(payload.get("inputs", {}).get("editor_smoke_generated_mismatch_policy") or "warn"),
        )
    )
    lines.append(
        "- editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
            run_id=str(payload.get("inputs", {}).get("editor_smoke_generated_run_id") or ""),
            run_ids=",".join([str(x) for x in generated_run_ids]) or "-",
        )
    )
editor_bucket_counts = payload["editor_smoke"].get("failure_buckets")
if isinstance(editor_bucket_counts, dict) and editor_bucket_counts:
    pairs = []
    for key in ("INPUT_INVALID", "IMPORT_FAIL", "RENDER_DRIFT", "VIEWPORT_LAYOUT_MISSING", "TEXT_METRIC_DRIFT"):
        val = as_int(editor_bucket_counts.get(key), 0)
        if val > 0:
            pairs.append(f"{key}={val}")
    if pairs:
        lines.append(f"- editor_smoke_failure_buckets: `{' '.join(pairs)}`")
editor_code_counts = payload["editor_smoke"].get("failure_code_counts")
if isinstance(editor_code_counts, dict) and editor_code_counts:
    code_parts = [f"{k}={editor_code_counts[k]}" for k in sorted(editor_code_counts.keys())]
    lines.append(f"- editor_smoke_failure_codes: `{' '.join(code_parts)}`")
failed_cases = payload["editor_smoke"].get("failed_cases")
if isinstance(failed_cases, list) and failed_cases:
    top = []
    for one in failed_cases[:3]:
        if not isinstance(one, dict):
            continue
        name = str(one.get("name") or "")
        bucket = str(one.get("bucket") or "")
        codes = one.get("failure_codes") if isinstance(one.get("failure_codes"), list) else []
        code_text = "+".join([str(c or "") for c in codes if str(c or "").strip()])
        item = name or "(unknown)"
        if bucket:
            item += f":{bucket}"
        if code_text:
            item += f":{code_text}"
        top.append(item)
    if top:
        lines.append(f"- editor_smoke_recent_failures: `{' | '.join(top)}`")
if payload.get("ui_flow_smoke", {}).get("enabled"):
    lines.append(f"- ui_flow_smoke: `{payload['ui_flow_smoke']['status']}` `{payload['ui_flow_smoke']['run_id']}`")
    lines.append(f"- ui_flow_open_retries: `{as_int(payload['ui_flow_smoke'].get('open_retries'), 0)}`")
    lines.append(f"- ui_flow_open_attempts: `{as_int(payload['ui_flow_smoke'].get('open_attempt_count'), 0)}` `{str(payload['ui_flow_smoke'].get('open_attempt_exit_codes') or '-')}`")
    lines.append(
        "- ui_flow_gate_runs: `target={target}` `run_count={run_count}` `pass={ok}` `fail={fail}`".format(
            target=as_int(payload["ui_flow_smoke"].get("gate_runs_target"), 0),
            run_count=as_int(payload["ui_flow_smoke"].get("gate_run_count"), 0),
            ok=as_int(payload["ui_flow_smoke"].get("gate_pass_count"), 0),
            fail=as_int(payload["ui_flow_smoke"].get("gate_fail_count"), 0),
        )
    )
    code_counts = payload["ui_flow_smoke"].get("failure_code_counts")
    if isinstance(code_counts, dict) and code_counts:
        parts = [f"{k}={code_counts[k]}" for k in sorted(code_counts.keys())]
        lines.append(f"- ui_flow_gate_failure_codes: `{' '.join(parts)}`")
    ui_cov = payload["ui_flow_smoke"].get("interaction_checks_coverage")
    if isinstance(ui_cov, dict) and ui_cov:
        key_order = [
            "fillet_pair_preselection_ok",
            "chamfer_pair_preselection_ok",
            "fillet_runtime_preselection_ok",
            "chamfer_runtime_preselection_ok",
            "fillet_reset_guard_ok",
            "chamfer_reset_guard_ok",
            "fillet_polyline_preselection_ok",
            "chamfer_polyline_preselection_ok",
            "complete",
        ]
        label_map = {
            "fillet_pair_preselection_ok": "fillet_pair",
            "chamfer_pair_preselection_ok": "chamfer_pair",
            "fillet_runtime_preselection_ok": "fillet_runtime",
            "chamfer_runtime_preselection_ok": "chamfer_runtime",
            "fillet_reset_guard_ok": "fillet_reset",
            "chamfer_reset_guard_ok": "chamfer_reset",
            "fillet_polyline_preselection_ok": "fillet_poly",
            "chamfer_polyline_preselection_ok": "chamfer_poly",
            "complete": "complete",
        }
        parts = []
        for key in key_order + sorted([k for k in ui_cov.keys() if k not in label_map]):
            one = ui_cov.get(key)
            if not isinstance(one, dict):
                continue
            total = as_int(one.get("total_runs"), 0)
            passed = as_int(one.get("pass_runs"), 0)
            if total <= 0:
                continue
            all_pass = bool(one.get("all_pass", passed >= total))
            marker = "" if all_pass else "!"
            parts.append(f"{label_map.get(key, key)}={passed}/{total}{marker}")
        if parts:
            lines.append(
                "- ui_flow_interaction_checks: `{parts}` complete=`{complete}`".format(
                    parts=" ".join(parts),
                    complete=bool(payload["ui_flow_smoke"].get("interaction_checks_complete", False))
                )
            )
if payload.get("ui_flow_failure_injection", {}).get("enabled"):
    lines.append(
        "- ui_flow_failure_injection: `status={status}` `run_id={run_id}` `code={code}`".format(
            status=payload["ui_flow_failure_injection"].get("status", ""),
            run_id=payload["ui_flow_failure_injection"].get("run_id", ""),
            code=payload["ui_flow_failure_injection"].get("failure_code", ""),
        )
    )
lines.append(f"- step166: `{payload['step166']['run_id']}`")
if payload.get("step166_baseline_refresh", {}).get("enabled"):
    br = payload.get("step166_baseline_refresh", {})
    lines.append(
        "- step166_baseline_refresh: `eligible={eligible}` `applied={applied}` `candidate={candidate}`".format(
            eligible=str(br.get("eligible", False)),
            applied=str(br.get("applied", False)),
            candidate=str(br.get("candidate_run_id", "")),
        )
    )
lines.append(f"- performance: `{payload['performance']['run_id']}`")
lines.append(f"- real_scene_perf: `{payload['real_scene_perf']['status']}`")
lines.append(f"- gate: `{payload['gate']['status']}`")
if payload.get("gate", {}).get("exit_code") not in (None, ""):
    lines.append(f"- gate_exit_code: `{as_int(payload['gate'].get('exit_code'), 0)}`")
gate_runtime = payload.get("gate_runtime") if isinstance(payload.get("gate_runtime"), dict) else {}
if gate_runtime:
    lines.append(
        "- gate_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}` `source={source}`".format(
            profile=str(gate_runtime.get("profile") or "<none>"),
            step166=bool(gate_runtime.get("step166_gate", False)),
            ui_flow=bool(gate_runtime.get("ui_flow_gate", False)),
            convert=bool(gate_runtime.get("convert_disabled", False)),
            perf=bool(gate_runtime.get("perf_trend", False)),
            real_scene=bool(gate_runtime.get("real_scene_trend", False)),
            source=str(gate_runtime.get("source") or "weekly.inputs"),
        )
    )
qt_policy = payload.get("qt_project_persistence_policy") if isinstance(payload.get("qt_project_persistence_policy"), dict) else {}
if qt_policy:
    lines.append(
        "- qt_persistence_policy: `status={status}` `recommended_require_on={recommended}` `effective_require_on={effective}` `source={source}`".format(
            status=str(qt_policy.get("status", "")),
            recommended=str(bool(qt_policy.get("recommended_require_on", False))),
            effective=str(bool(qt_policy.get("effective_require_on", False))),
            source=str(qt_policy.get("effective_source", "")),
        )
    )
gate_editor = payload["gate"].get("editor_smoke") if isinstance(payload["gate"].get("editor_smoke"), dict) else {}
if gate_editor:
    gate_editor_totals = gate_editor.get("totals") if isinstance(gate_editor.get("totals"), dict) else {}
    lines.append(
        "- gate_editor_smoke: `status={status}` `run_id={run_id}` `pass={ok}` `fail={fail}` `skipped={skip}`".format(
            status=str(gate_editor.get("status", "")),
            run_id=str(gate_editor.get("run_id", "")),
            ok=as_int(gate_editor_totals.get("pass"), 0),
            fail=as_int(gate_editor_totals.get("fail"), 0),
            skip=as_int(gate_editor_totals.get("skipped"), 0),
        )
    )
    gate_inputs = payload.get("inputs") if isinstance(payload.get("inputs"), dict) else {}
    lines.append(
        "- gate_editor_smoke_cases: `source={source}` path=`{path}`".format(
            source=str(gate_inputs.get("gate_editor_smoke_case_source") or "discovery"),
            path=str(gate_inputs.get("gate_editor_smoke_cases") or "<discovery>"),
        )
    )
    gate_generated_run_ids = gate_inputs.get("gate_editor_smoke_generated_run_ids")
    if not isinstance(gate_generated_run_ids, list):
        gate_generated_run_ids = []
    if gate_inputs.get("gate_editor_smoke_generated_count") not in (None, ""):
        gate_generated_declared = as_int(gate_inputs.get("gate_editor_smoke_generated_count_declared"), as_int(gate_inputs.get("gate_editor_smoke_generated_count"), 0))
        gate_generated_actual = as_int(gate_inputs.get("gate_editor_smoke_generated_count_actual"), as_int(gate_inputs.get("gate_editor_smoke_generated_count"), 0))
        gate_generated_mismatch = bool(gate_inputs.get("gate_editor_smoke_generated_count_mismatch", gate_generated_declared != gate_generated_actual))
        lines.append(
            "- gate_editor_smoke_generated_cases: path=`{path}` `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `priorities={priorities}`".format(
                path=str(gate_inputs.get("gate_editor_smoke_generated_cases_path") or ""),
                count=as_int(gate_inputs.get("gate_editor_smoke_generated_count"), 0),
                declared=gate_generated_declared,
                actual=gate_generated_actual,
                mismatch=str(gate_generated_mismatch).lower(),
                priorities=str(gate_inputs.get("gate_editor_smoke_generated_priorities") or ""),
            )
        )
        lines.append(
            "- gate_editor_smoke_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                policy=str(gate_inputs.get("gate_editor_smoke_generated_mismatch_policy") or "warn"),
                gate_fail=str(bool(gate_inputs.get("gate_editor_smoke_generated_mismatch_gate_fail", False))).lower(),
            )
        )
    if gate_inputs.get("gate_editor_smoke_generated_run_id") or gate_generated_run_ids:
        lines.append(
            "- gate_editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                run_id=str(gate_inputs.get("gate_editor_smoke_generated_run_id") or ""),
                run_ids=",".join([str(x) for x in gate_generated_run_ids if str(x).strip()]) or "-",
            )
        )
    gate_editor_codes = gate_editor.get("failure_code_counts")
    if isinstance(gate_editor_codes, dict) and gate_editor_codes:
        parts = [f"{k}={gate_editor_codes[k]}" for k in sorted(gate_editor_codes.keys())]
        lines.append(f"- gate_editor_smoke_failure_codes: `{' '.join(parts)}`")
    gate_editor_filters = gate_editor.get("filters")
    if isinstance(gate_editor_filters, dict):
        pf = gate_editor_filters.get("priority_set") if isinstance(gate_editor_filters.get("priority_set"), list) else []
        tf = gate_editor_filters.get("tag_any") if isinstance(gate_editor_filters.get("tag_any"), list) else []
        if pf or tf:
            lines.append(
                "- gate_editor_smoke_filters: `priority_set={priority}` `tag_any={tags}`".format(
                    priority=",".join([str(x) for x in pf]) or "-",
                    tags=",".join([str(x) for x in tf]) or "-",
                )
            )
    gate_editor_case_selection = gate_editor.get("case_selection")
    if isinstance(gate_editor_case_selection, dict):
        lines.append(
            "- gate_editor_smoke_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
                selected=as_int(gate_editor_case_selection.get("selected_count"), 0),
                matched=as_int(gate_editor_case_selection.get("matched_count"), 0),
                candidate=as_int(gate_editor_case_selection.get("filtered_count"), 0),
                total=as_int(gate_editor_case_selection.get("total_input"), 0),
                fallback=str(bool(gate_editor_case_selection.get("used_fallback", False))).lower(),
            )
        )
gate_ui_flow = payload["gate"].get("ui_flow_smoke") if isinstance(payload["gate"].get("ui_flow_smoke"), dict) else {}
if gate_ui_flow:
    gate_ui_status = str(gate_ui_flow.get("status") or gate_ui_flow.get("mode") or "skipped")
    lines.append(
        "- gate_ui_flow_smoke: `mode={mode}` `status={status}` `run_count={count}` `pass={ok}` `fail={fail}`".format(
            mode=str(gate_ui_flow.get("mode", "")),
            status=gate_ui_status,
            count=as_int(gate_ui_flow.get("gate_run_count"), 0),
            ok=as_int(gate_ui_flow.get("gate_pass_count"), 0),
            fail=as_int(gate_ui_flow.get("gate_fail_count"), 0),
        )
    )
    run_ids = gate_ui_flow.get("run_ids")
    if isinstance(run_ids, list) and run_ids:
        lines.append(f"- gate_ui_flow_run_ids: `{' '.join([str(x) for x in run_ids if str(x).strip()])}`")
gate_step166 = payload["gate"].get("step166") if isinstance(payload["gate"].get("step166"), dict) else {}
if gate_step166:
    gate_step166_decision = gate_step166.get("gate_decision") if isinstance(gate_step166.get("gate_decision"), dict) else {}
    lines.append(
        "- gate_step166: `enabled={enabled}` `run_id={run_id}` `would_fail={would_fail}`".format(
            enabled=bool(gate_step166.get("enabled", False)),
            run_id=str(gate_step166.get("run_id", "")),
            would_fail=bool(gate_step166_decision.get("would_fail", False)),
        )
    )
gate_editor_injection = payload["gate"].get("editor_smoke_failure_injection")
if isinstance(gate_editor_injection, dict) and gate_editor_injection.get("enabled"):
    lines.append(
        "- gate_editor_smoke_failure_injection: `status={status}` `run_id={run_id}` `code={code}`".format(
            status=str(gate_editor_injection.get("status", "")),
            run_id=str(gate_editor_injection.get("run_id", "")),
            code=str(gate_editor_injection.get("failure_code", "")),
        )
    )
gate_preview_provenance = payload.get("gate_preview_provenance_smoke") if isinstance(payload.get("gate_preview_provenance_smoke"), dict) else {}
if gate_preview_provenance.get("enabled"):
    lines.append(
        "- gate_preview_provenance_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
            mode=str(gate_preview_provenance.get("mode") or ""),
            ok=bool(gate_preview_provenance.get("ok", False)),
            run_id=str(gate_preview_provenance.get("run_id") or ""),
            cases=as_int(gate_preview_provenance.get("case_count"), 0),
            ok_count=as_int(gate_preview_provenance.get("pass_count"), 0),
            fail_count=as_int(gate_preview_provenance.get("fail_count"), 0),
            first_failed=str(gate_preview_provenance.get("first_failed_case") or "-"),
        )
    )
gate_dwg_open = payload.get("gate_dwg_open_smoke") if isinstance(payload.get("gate_dwg_open_smoke"), dict) else {}
if gate_dwg_open.get("enabled"):
    lines.append(
        "- gate_dwg_open_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `dwg_convert={dwg_convert}` `router={router}` `convert={convert}` `viewer={viewer}` `validators_ok={validators}` `input={input}`".format(
            mode=str(gate_dwg_open.get("mode") or ""),
            ok=bool(gate_dwg_open.get("ok", False)),
            run_id=str(gate_dwg_open.get("run_id") or ""),
            dwg_convert=bool(gate_dwg_open.get("dwg_convert_ok", False)),
            router=bool(gate_dwg_open.get("router_ok", False)),
            convert=bool(gate_dwg_open.get("convert_ok", False)),
            viewer=bool(gate_dwg_open.get("viewer_ok", False)),
            validators=as_int(gate_dwg_open.get("validator_ok_count"), 0),
            input=str(gate_dwg_open.get("input_dwg") or "-"),
        )
    )
gate_dwg_open_matrix = payload.get("gate_dwg_open_matrix_smoke") if isinstance(payload.get("gate_dwg_open_matrix_smoke"), dict) else {}
if gate_dwg_open_matrix.get("enabled"):
    lines.append(
        "- gate_dwg_open_matrix_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `dwg_convert_ok={dwg_convert_ok}` `router_ok={router_ok}` `convert_ok={convert_ok}` `viewer_ok={viewer_ok}` `validators_ok={validators}` `first_failed_case={first_failed}`".format(
            mode=str(gate_dwg_open_matrix.get("mode") or ""),
            ok=bool(gate_dwg_open_matrix.get("ok", False)),
            run_id=str(gate_dwg_open_matrix.get("run_id") or ""),
            cases=as_int(gate_dwg_open_matrix.get("case_count"), 0),
            ok_count=as_int(gate_dwg_open_matrix.get("pass_count"), 0),
            fail_count=as_int(gate_dwg_open_matrix.get("fail_count"), 0),
            dwg_convert_ok=as_int(gate_dwg_open_matrix.get("dwg_convert_ok_count"), 0),
            router_ok=as_int(gate_dwg_open_matrix.get("router_ok_count"), 0),
            convert_ok=as_int(gate_dwg_open_matrix.get("convert_ok_count"), 0),
            viewer_ok=as_int(gate_dwg_open_matrix.get("viewer_ok_count"), 0),
            validators=as_int(gate_dwg_open_matrix.get("validator_ok_count"), 0),
            first_failed=str(gate_dwg_open_matrix.get("first_failed_case") or "-"),
        )
    )
gate_dwg_open_desktop = payload.get("gate_dwg_open_desktop_smoke") if isinstance(payload.get("gate_dwg_open_desktop_smoke"), dict) else {}
if gate_dwg_open_desktop.get("enabled"):
    lines.append(
        "- gate_dwg_open_desktop_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `desktop={desktop}` `manifest={manifest}` `preview_artifacts={preview_artifacts}` `validators_ok={validators}` `input={input}`".format(
            mode=str(gate_dwg_open_desktop.get("mode") or ""),
            ok=bool(gate_dwg_open_desktop.get("ok", False)),
            run_id=str(gate_dwg_open_desktop.get("run_id") or ""),
            desktop=bool(gate_dwg_open_desktop.get("desktop_ok", False)),
            manifest=bool(gate_dwg_open_desktop.get("manifest_ok", False)),
            preview_artifacts=bool(gate_dwg_open_desktop.get("preview_artifacts_ok", False)),
            validators=as_int(gate_dwg_open_desktop.get("validator_ok_count"), 0),
            input=str(gate_dwg_open_desktop.get("input_dwg") or "-"),
        )
    )
gate_constraints_basic_ctest = payload.get("gate_constraints_basic_ctest") if isinstance(payload.get("gate_constraints_basic_ctest"), dict) else {}
if gate_constraints_basic_ctest.get("enabled"):
    lines.append(
        "- gate_constraints_basic_ctest: `status={status}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing={missing}` `first_failed_case={first_failed}` `test={test}`".format(
            status=str(gate_constraints_basic_ctest.get("status") or ""),
            cases=as_int(gate_constraints_basic_ctest.get("case_count"), 0),
            ok_count=as_int(gate_constraints_basic_ctest.get("pass_count"), 0),
            fail_count=as_int(gate_constraints_basic_ctest.get("fail_count"), 0),
            missing=as_int(gate_constraints_basic_ctest.get("missing_count"), 0),
            first_failed=str(gate_constraints_basic_ctest.get("first_failed_case") or "-"),
            test=str(gate_constraints_basic_ctest.get("test_name") or "-"),
        )
    )
gate_solver_action_panel = payload.get("gate_solver_action_panel_smoke") if isinstance(payload.get("gate_solver_action_panel_smoke"), dict) else {}
if gate_solver_action_panel.get("enabled"):
    lines.append(
            "- gate_solver_action_panel_smoke: `mode={mode}` `ok={ok}` `run_id={run_id}` `panels={panels}` `flow_checks={flow_checks}` `requests={requests}` `invoke={invoke_count}` `focus={focus_count}` `flow={flow_count}` `replay={replay_count}` `import_checks={import_checks}` `clear_checks={clear_checks}` `jump_requests={jump_request_count}` `dom_events={dom_event_count}` `dom_requests={dom_request_count}` `dom_actions={dom_action_count}` `dom_focus={dom_focus_count}` `dom_flow={dom_flow_count}` `dom_replay={dom_replay_count}` `events={event_count}` `event_invoke={event_invoke_count}` `event_focus={event_focus_count}` `event_flow={event_flow_count}` `event_replay={event_replay_count}` `jump_events={jump_event_count}` `next={next_count}` `jump={jump_count}` `prev={prev_count}` `restart={restart_count}` `replay_checks={replay_checks}` `event_focus_checks={event_focus_checks}` `banner_checks={banner_checks}` `banner_focus_clicks={banner_focus_clicks}` `console={console_checks}` `console_flow={console_flow_checks}` `console_event_focus={console_event_focus_checks}` `console_replay={console_replay_checks}` `console_event_click={console_event_click_checks}` `console_focus_click={console_focus_click_checks}` `console_selection={console_selection_checks}` `status_checks={status_checks}` `status_clicks={status_clicks}` `keyboard={keyboard_checks}` `panel_cycle={panel_cycle_checks}` `panel_keyboard={panel_keyboard_checks}` `panel_keyboard_invoke={panel_keyboard_invoke_checks}` `panel_keyboard_flow={panel_keyboard_flow_checks}` `keyboard_banner={keyboard_banner_checks}` `keyboard_jump={keyboard_jump_checks}` `keyboard_event_focus={keyboard_event_focus_checks}` `visited_panels={visited}`".format(
            mode=str(gate_solver_action_panel.get("mode") or ""),
            ok=bool(gate_solver_action_panel.get("ok", False)),
            run_id=str(gate_solver_action_panel.get("run_id") or ""),
            panels=as_int(gate_solver_action_panel.get("panel_count"), 0),
            flow_checks=as_int(gate_solver_action_panel.get("flow_check_count"), 0),
            requests=as_int(gate_solver_action_panel.get("request_count"), 0),
            invoke_count=as_int(gate_solver_action_panel.get("invoke_request_count"), 0),
            focus_count=as_int(gate_solver_action_panel.get("focus_request_count"), 0),
            flow_count=as_int(gate_solver_action_panel.get("flow_request_count"), 0),
            replay_count=as_int(gate_solver_action_panel.get("replay_request_count"), 0),
            import_checks=as_int(gate_solver_action_panel.get("import_check_count"), 0),
            clear_checks=as_int(gate_solver_action_panel.get("clear_check_count"), 0),
            jump_request_count=as_int(gate_solver_action_panel.get("jump_request_count"), 0),
            dom_event_count=as_int(gate_solver_action_panel.get("dom_event_count"), 0),
            dom_request_count=as_int(gate_solver_action_panel.get("dom_request_event_count"), 0),
            dom_action_count=as_int(gate_solver_action_panel.get("dom_action_event_count"), 0),
            dom_focus_count=as_int(gate_solver_action_panel.get("dom_focus_event_count"), 0),
            dom_flow_count=as_int(gate_solver_action_panel.get("dom_flow_event_count"), 0),
            dom_replay_count=as_int(gate_solver_action_panel.get("dom_replay_event_count"), 0),
            event_count=as_int(gate_solver_action_panel.get("event_count"), 0),
            event_invoke_count=as_int(gate_solver_action_panel.get("invoke_event_count"), 0),
            event_focus_count=as_int(gate_solver_action_panel.get("focus_event_count"), 0),
            event_flow_count=as_int(gate_solver_action_panel.get("flow_event_count"), 0),
            event_replay_count=as_int(gate_solver_action_panel.get("replay_event_count"), 0),
            jump_event_count=as_int(gate_solver_action_panel.get("jump_event_count"), 0),
            next_count=as_int(gate_solver_action_panel.get("next_check_count"), 0),
            jump_count=as_int(gate_solver_action_panel.get("jump_check_count"), 0),
            prev_count=as_int(gate_solver_action_panel.get("rewind_check_count"), 0),
            restart_count=as_int(gate_solver_action_panel.get("restart_check_count"), 0),
            replay_checks=as_int(gate_solver_action_panel.get("replay_check_count"), 0),
            event_focus_checks=as_int(gate_solver_action_panel.get("event_focus_check_count"), 0),
            banner_checks=as_int(gate_solver_action_panel.get("banner_check_count"), 0),
            banner_focus_clicks=as_int(gate_solver_action_panel.get("banner_focus_click_check_count"), 0),
            console_checks=as_int(gate_solver_action_panel.get("console_check_count"), 0),
            console_flow_checks=as_int(gate_solver_action_panel.get("console_flow_check_count"), 0),
            console_event_focus_checks=as_int(gate_solver_action_panel.get("console_event_focus_check_count"), 0),
            console_replay_checks=as_int(gate_solver_action_panel.get("console_replay_check_count"), 0),
            console_event_click_checks=as_int(gate_solver_action_panel.get("console_event_click_check_count"), 0),
            console_focus_click_checks=as_int(gate_solver_action_panel.get("console_focus_click_check_count"), 0),
            console_selection_checks=as_int(gate_solver_action_panel.get("console_selection_check_count"), 0),
            status_checks=as_int(gate_solver_action_panel.get("status_check_count"), 0),
            status_clicks=as_int(gate_solver_action_panel.get("status_click_check_count"), 0),
            keyboard_checks=as_int(gate_solver_action_panel.get("keyboard_check_count"), 0),
            panel_cycle_checks=as_int(gate_solver_action_panel.get("panel_cycle_check_count"), 0),
            panel_keyboard_checks=as_int(gate_solver_action_panel.get("panel_keyboard_check_count"), 0),
            panel_keyboard_invoke_checks=as_int(gate_solver_action_panel.get("panel_keyboard_invoke_check_count"), 0),
            panel_keyboard_flow_checks=as_int(gate_solver_action_panel.get("panel_keyboard_flow_check_count"), 0),
            keyboard_banner_checks=as_int(gate_solver_action_panel.get("keyboard_banner_check_count"), 0),
            keyboard_jump_checks=as_int(gate_solver_action_panel.get("keyboard_jump_check_count"), 0),
            keyboard_event_focus_checks=as_int(gate_solver_action_panel.get("keyboard_event_focus_check_count"), 0),
            visited=as_int(gate_solver_action_panel.get("visited_panel_count"), 0),
        )
    )
step186_preview_artifact_prep = payload.get("step186_preview_artifact_prep") if isinstance(payload.get("step186_preview_artifact_prep"), dict) else {}
if step186_preview_artifact_prep.get("enabled"):
    lines.append(
        "- step186_preview_artifact_prep: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
            status=str(step186_preview_artifact_prep.get("status") or ""),
            run_id=str(step186_preview_artifact_prep.get("run_id") or ""),
            cases=as_int(step186_preview_artifact_prep.get("case_count"), 0),
            ok_count=as_int(step186_preview_artifact_prep.get("pass_count"), 0),
            fail_count=as_int(step186_preview_artifact_prep.get("fail_count"), 0),
            first_failed=str(step186_preview_artifact_prep.get("first_failed_case") or "-"),
        )
    )
gate_preview_provenance_injection = payload.get("gate_preview_provenance_failure_injection") if isinstance(payload.get("gate_preview_provenance_failure_injection"), dict) else {}
if gate_preview_provenance_injection.get("enabled"):
    lines.append(
        "- gate_preview_provenance_failure_injection: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
            status=str(gate_preview_provenance_injection.get("status") or ""),
            run_id=str(gate_preview_provenance_injection.get("run_id") or ""),
            cases=as_int(gate_preview_provenance_injection.get("case_count"), 0),
            ok_count=as_int(gate_preview_provenance_injection.get("pass_count"), 0),
            fail_count=as_int(gate_preview_provenance_injection.get("fail_count"), 0),
            first_failed=str(gate_preview_provenance_injection.get("first_failed_case") or "-"),
        )
    )
gate_preview_artifact = payload.get("gate_preview_artifact_smoke") if isinstance(payload.get("gate_preview_artifact_smoke"), dict) else {}
if gate_preview_artifact.get("enabled"):
    lines.append(
        "- gate_preview_artifact_smoke: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
            status=str(gate_preview_artifact.get("status") or ""),
            run_id=str(gate_preview_artifact.get("run_id") or ""),
            cases=as_int(gate_preview_artifact.get("case_count"), 0),
            ok_count=as_int(gate_preview_artifact.get("pass_count"), 0),
            fail_count=as_int(gate_preview_artifact.get("fail_count"), 0),
            first_failed=str(gate_preview_artifact.get("first_failed_case") or "-"),
        )
    )
gate_preview_artifact_injection = payload.get("gate_preview_artifact_validator_failure_injection") if isinstance(payload.get("gate_preview_artifact_validator_failure_injection"), dict) else {}
if gate_preview_artifact_injection.get("enabled"):
    lines.append(
        "- gate_preview_artifact_validator_failure_injection: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `first_failed_case={first_failed}`".format(
            status=str(gate_preview_artifact_injection.get("status") or ""),
            run_id=str(gate_preview_artifact_injection.get("run_id") or ""),
            cases=as_int(gate_preview_artifact_injection.get("case_count"), 0),
            ok_count=as_int(gate_preview_artifact_injection.get("pass_count"), 0),
            fail_count=as_int(gate_preview_artifact_injection.get("fail_count"), 0),
            first_failed=str(gate_preview_artifact_injection.get("first_failed_case") or "-"),
        )
    )
gate_assembly_roundtrip = payload.get("gate_assembly_roundtrip_ctest") if isinstance(payload.get("gate_assembly_roundtrip_ctest"), dict) else {}
if gate_assembly_roundtrip.get("enabled"):
    lines.append(
        "- gate_assembly_roundtrip_ctest: `status={status}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing={missing}` `model={model}` `paperspace={paperspace}` `mixed={mixed}` `dense={dense}` `summaries={summaries}` `tracked={tracked}` `groups={groups}` `group_sources={group_sources}` `group_source_cases={group_source_cases}` `group_source_case_details={group_source_case_details}` `group_layouts={group_layouts}` `group_layout_cases={group_layout_cases}` `group_layout_case_details={group_layout_case_details}` `proxies={proxies}` `proxy_kinds={proxy_kinds}` `proxy_kind_cases={proxy_kind_cases}` `proxy_kind_case_details={proxy_kind_case_details}` `proxy_layouts={proxy_layouts}` `proxy_layout_cases={proxy_layout_cases}` `proxy_layout_case_details={proxy_layout_case_details}` `text_kinds={text_kinds}` `text_kind_layouts={text_kind_layouts}` `text_kind_cases={text_kind_cases}` `text_kind_case_details={text_kind_case_details}` `exploded={exploded}` `exploded_layouts={exploded_layouts}` `exploded_layout_cases={exploded_layout_cases}` `exploded_layout_case_details={exploded_layout_case_details}` `viewports={viewports}` `viewport_layouts={viewport_layouts}` `viewport_cases={viewport_cases}` `viewport_proxy_kinds={viewport_proxy_kinds}` `viewport_proxy_layouts={viewport_proxy_layouts}` `viewport_proxy_cases={viewport_proxy_cases}` `viewport_proxy_case_details={viewport_proxy_case_details}` `checked={checked}` `drift={metadata_drift}/{group_drift}` `first_failed_case={first_failed}`".format(
            status=str(gate_assembly_roundtrip.get("status") or ""),
            cases=as_int(gate_assembly_roundtrip.get("case_count"), 0),
            ok_count=as_int(gate_assembly_roundtrip.get("pass_count"), 0),
            fail_count=as_int(gate_assembly_roundtrip.get("fail_count"), 0),
            missing=as_int(gate_assembly_roundtrip.get("missing_count"), 0),
            model=str(gate_assembly_roundtrip.get("model_status") or "-"),
            paperspace=str(gate_assembly_roundtrip.get("paperspace_status") or "-"),
            mixed=str(gate_assembly_roundtrip.get("mixed_status") or "-"),
            dense=str(gate_assembly_roundtrip.get("dense_status") or "-"),
            summaries=as_int(gate_assembly_roundtrip.get("summary_json_count"), 0),
            tracked=as_int(gate_assembly_roundtrip.get("import_assembly_tracked_count"), 0),
            groups=as_int(gate_assembly_roundtrip.get("import_assembly_group_count"), 0),
            group_sources=fmt_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_assembly_group_source_counts_b64"))),
            group_source_cases=as_int(gate_assembly_roundtrip.get("import_assembly_group_source_case_count"), 0),
            group_source_case_details=fmt_group_source_case_details(gate_assembly_roundtrip.get("import_assembly_group_source_case_details_b64")),
            group_layouts=fmt_nested_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_assembly_group_layout_source_counts_b64"))),
            group_layout_cases=as_int(gate_assembly_roundtrip.get("import_assembly_group_layout_source_case_count"), 0),
            group_layout_case_details=fmt_group_layout_case_details(gate_assembly_roundtrip.get("import_assembly_group_layout_source_case_details_b64")),
            proxies=as_int(gate_assembly_roundtrip.get("import_derived_proxy_count"), 0),
            proxy_kinds=fmt_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_proxy_kind_counts_b64"))),
            proxy_kind_cases=as_int(gate_assembly_roundtrip.get("import_proxy_kind_case_count"), 0),
            proxy_kind_case_details=fmt_proxy_kind_case_details(gate_assembly_roundtrip.get("import_proxy_kind_case_details_b64")),
            proxy_layouts=fmt_nested_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_proxy_layout_kind_counts_b64"))),
            proxy_layout_cases=as_int(gate_assembly_roundtrip.get("import_proxy_layout_case_count"), 0),
            proxy_layout_case_details=fmt_proxy_layout_case_details(gate_assembly_roundtrip.get("import_proxy_layout_case_details_b64")),
            text_kinds=fmt_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_text_kind_counts_b64"))),
            text_kind_layouts=fmt_nested_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_text_kind_layout_counts_b64"))),
            text_kind_cases=as_int(gate_assembly_roundtrip.get("import_text_kind_case_count"), 0),
            text_kind_case_details=fmt_text_kind_case_details(gate_assembly_roundtrip.get("import_text_kind_case_details_b64")),
            exploded=as_int(gate_assembly_roundtrip.get("import_exploded_origin_count"), 0),
            exploded_layouts=fmt_nested_counts(decode_b64_json_dict(gate_assembly_roundtrip.get("import_exploded_layout_source_counts_b64"))),
            exploded_layout_cases=as_int(gate_assembly_roundtrip.get("import_exploded_layout_source_case_count"), 0),
            exploded_layout_case_details=fmt_exploded_layout_case_details(gate_assembly_roundtrip.get("import_exploded_layout_source_case_details_b64")),
            viewports=as_int(gate_assembly_roundtrip.get("import_viewport_count"), 0),
            viewport_layouts=as_int(gate_assembly_roundtrip.get("import_viewport_layout_count"), 0),
            viewport_cases=as_int(gate_assembly_roundtrip.get("import_viewport_case_count"), 0),
            viewport_proxy_kinds=fmt_counts(as_dict(decode_b64_json_dict(gate_assembly_roundtrip.get("import_viewport_proxy_kind_counts_b64")))),
            viewport_proxy_layouts=fmt_nested_counts(as_dict(decode_b64_json_dict(gate_assembly_roundtrip.get("import_viewport_proxy_layout_kind_counts_b64")))),
            viewport_proxy_cases=as_int(gate_assembly_roundtrip.get("import_viewport_proxy_case_count"), 0),
            viewport_proxy_case_details=fmt_viewport_proxy_case_details(gate_assembly_roundtrip.get("import_viewport_proxy_case_details_b64")),
            checked=as_int(gate_assembly_roundtrip.get("export_assembly_checked_count"), 0),
            metadata_drift=as_int(gate_assembly_roundtrip.get("export_metadata_drift_count"), 0),
            group_drift=as_int(gate_assembly_roundtrip.get("export_group_drift_count"), 0),
            first_failed=str(gate_assembly_roundtrip.get("first_failed_case") or "-"),
        )
    )
weekly_legacy_preview = payload.get("weekly_legacy_preview_artifact_smoke") if isinstance(payload.get("weekly_legacy_preview_artifact_smoke"), dict) else {}
if weekly_legacy_preview.get("enabled"):
    lines.append(
        "- weekly_legacy_preview_artifact_smoke: `status={status}` `run_id={run_id}` `cases={cases}` `pass={ok_count}` `fail={fail_count}` `missing_targets={missing}` `first_failed_case={first_failed}`".format(
            status=str(weekly_legacy_preview.get("status") or ""),
            run_id=str(weekly_legacy_preview.get("run_id") or ""),
            cases=as_int(weekly_legacy_preview.get("case_count"), 0),
            ok_count=as_int(weekly_legacy_preview.get("pass_count"), 0),
            fail_count=as_int(weekly_legacy_preview.get("fail_count"), 0),
            missing=as_int(weekly_legacy_preview.get("missing_target_count"), 0),
            first_failed=str(weekly_legacy_preview.get("first_failed_case") or "-"),
        )
    )
lines.append(f"- trend: `{payload['trend']['status']}`")
ui_flow_stage_trend = payload.get("ui_flow_stage_trend") if isinstance(payload.get("ui_flow_stage_trend"), dict) else {}
if ui_flow_stage_trend:
    lines.append(
        "- ui_flow_stage_trend: `{status}` `recommended_gate_mode={mode}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
            status=str(ui_flow_stage_trend.get("status") or ""),
            mode=str(ui_flow_stage_trend.get("recommended_gate_mode") or "observe"),
            enabled=as_int(ui_flow_stage_trend.get("enabled_samples_in_window"), 0),
            fail_ratio=as_float(ui_flow_stage_trend.get("fail_ratio")) or 0.0,
            attr_ratio=as_float(ui_flow_stage_trend.get("attribution_ratio")) or 0.0,
        )
    )
    ui_stage_counts = ui_flow_stage_trend.get("failure_stage_counts") if isinstance(ui_flow_stage_trend.get("failure_stage_counts"), dict) else {}
    if ui_stage_counts:
        parts = [f"{k}={as_int(ui_stage_counts.get(k), 0)}" for k in sorted(ui_stage_counts.keys()) if as_int(ui_stage_counts.get(k), 0) > 0]
        if parts:
            lines.append(f"- ui_flow_stage_trend_counts: `{' '.join(parts)}`")
ui_flow_stage_contract = payload.get("ui_flow_stage_trend_contract") if isinstance(payload.get("ui_flow_stage_trend_contract"), dict) else {}
if ui_flow_stage_contract:
    lines.append(
        "- ui_flow_stage_trend_contract: `ok={ok}` `issues={issues}` `issue_count={issue_count}`".format(
            ok=bool(ui_flow_stage_contract.get("ok", False)),
            issues=("none" if not isinstance(ui_flow_stage_contract.get("issues"), list) or not ui_flow_stage_contract.get("issues") else " ".join([str(x) for x in ui_flow_stage_contract.get("issues") if str(x).strip()])),
            issue_count=as_int(ui_flow_stage_contract.get("issue_count"), 0),
        )
    )
lines.append(f"- perf_trend: `{payload['perf_trend']['status']}`")
if payload["perf_trend"].get("auto_gate_mode"):
    lines.append(f"- perf_trend_auto_gate_mode: `{payload['perf_trend']['auto_gate_mode']}`")
perf_ratio = payload["perf_trend"].get("policy", {}).get("ratio_thresholds", {})
perf_abs = payload["perf_trend"].get("policy", {}).get("absolute_triggers_ms", {})
if perf_ratio:
    lines.append(
        "- perf_trend_thresholds: "
        f"`ratio pick={perf_ratio.get('pick_p95')} box={perf_ratio.get('box_p95')} drag={perf_ratio.get('drag_p95')}`"
    )
if perf_abs:
    lines.append(f"- perf_trend_hotspot: `box_p95_ms={perf_abs.get('box_p95_hotspot')}`")
lines.append(f"- real_scene_trend: `{payload['real_scene_trend']['status']}`")
if payload["real_scene_trend"].get("auto_gate_mode"):
    lines.append(f"- real_scene_trend_auto_gate_mode: `{payload['real_scene_trend']['auto_gate_mode']}`")
scene_ratio = payload["real_scene_trend"].get("policy", {}).get("ratio_thresholds", {})
scene_abs = payload["real_scene_trend"].get("policy", {}).get("absolute_triggers_ms", {})
if scene_ratio:
    lines.append(
        "- real_scene_trend_thresholds: "
        f"`ratio pick={scene_ratio.get('pick_p95')} box={scene_ratio.get('box_p95')} drag={scene_ratio.get('drag_p95')}`"
    )
if scene_abs:
    lines.append(f"- real_scene_trend_hotspot: `box_p95_ms={scene_abs.get('box_p95_hotspot')}`")
case_selection_trend = payload.get("case_selection_trend") if isinstance(payload.get("case_selection_trend"), dict) else {}
if case_selection_trend:
    lines.append(
        "- case_selection_trend: `{status}` windows=`{windows}` mismatch_runs=`{mismatch_runs}` mismatch_rate_max=`{mismatch_rate:.3f}`".format(
            status=case_selection_trend.get("status", ""),
            windows=case_selection_trend.get("windows", ""),
            mismatch_runs=as_int(case_selection_trend.get("generated_count_mismatch_runs_total"), 0),
            mismatch_rate=as_float(case_selection_trend.get("generated_count_mismatch_rate_max")) or 0.0,
        )
    )
    warning_codes = case_selection_trend.get("warning_codes") if isinstance(case_selection_trend.get("warning_codes"), list) else []
    if warning_codes:
        lines.append(f"- case_selection_trend_warnings: `{' '.join([str(x) for x in warning_codes if str(x).strip()])}`")
    window_summaries = case_selection_trend.get("window_summaries") if isinstance(case_selection_trend.get("window_summaries"), list) else []
    if window_summaries:
        parts = []
        for row in window_summaries:
            if not isinstance(row, dict):
                continue
            days = as_int(row.get("days"), 0)
            matched_ratio = as_float(row.get("matched_ratio")) or 0.0
            fallback_rate = as_float(row.get("fallback_rate")) or 0.0
            mismatch_rate = as_float(row.get("generated_count_mismatch_rate")) or 0.0
            risky_source_rate = as_float(row.get("risky_source_rate")) or 0.0
            samples = as_int(row.get("samples_with_selection"), 0)
            source_counts = row.get("source_counts") if isinstance(row.get("source_counts"), dict) else {}
            source_text = "-"
            if source_counts:
                source_text = "/".join(f"{k}:{as_int(source_counts.get(k), 0)}" for k in sorted(source_counts.keys()))
            parts.append(f"{days}d:m={matched_ratio:.3f},fb={fallback_rate:.3f},mm={mismatch_rate:.3f},rs={risky_source_rate:.3f},n={samples},src={source_text}")
        if parts:
            lines.append(f"- case_selection_trend_windows: `{' | '.join(parts)}`")
parallel_cycle = payload.get("parallel_cycle") if isinstance(payload.get("parallel_cycle"), dict) else {}
if parallel_cycle.get("enabled"):
    gate_decision = parallel_cycle.get("gate_decision") if isinstance(parallel_cycle.get("gate_decision"), dict) else {}
    gate_fail_reasons = gate_decision.get("fail_reasons") if isinstance(gate_decision.get("fail_reasons"), list) else []
    gate_warning_codes = gate_decision.get("warning_codes") if isinstance(gate_decision.get("warning_codes"), list) else []
    gate_failure_codes = gate_decision.get("failure_code_counts") if isinstance(gate_decision.get("failure_code_counts"), dict) else {}
    lines.append(
        "- parallel_cycle: `status={status}` `run_id={run_id}` `watch_policy={policy}` `decision={decision}` `overall={overall}` `duration_sec={duration}` `lane_b_ui_timeout_ms={timeout}` `lane_b_ui_open_retries={open_retries}`".format(
            status=str(parallel_cycle.get("status") or ""),
            run_id=str(parallel_cycle.get("run_id") or ""),
            policy=str(parallel_cycle.get("watch_policy") or ""),
            decision=str(gate_decision.get("decision") or parallel_cycle.get("gate_decision_raw") or ""),
            overall=str(parallel_cycle.get("overall_status") or ""),
            duration=as_int(parallel_cycle.get("duration_sec"), 0),
            timeout=as_int(payload.get("inputs", {}).get("parallel_cycle_lane_b_ui_flow_timeout_ms"), 0),
            open_retries=as_int(payload.get("inputs", {}).get("parallel_cycle_lane_b_ui_flow_open_retries"), 0),
        )
    )
    lines.append(
        "- parallel_cycle_gate: `weekly_policy={weekly_policy}` `raw={raw}` `should_merge={merge}` `watch_escalated={watch}` `fail_reasons={reasons}` `warning_codes={warnings}`".format(
            weekly_policy=str(payload.get("inputs", {}).get("weekly_parallel_decision_policy") or "observe"),
            raw=str(gate_decision.get("raw_decision") or ""),
            merge=bool(gate_decision.get("should_merge", False)),
            watch=bool(gate_decision.get("watch_escalated", False)),
            reasons=(" ".join([str(x) for x in gate_fail_reasons if str(x).strip()]) or "-"),
            warnings=(" ".join([str(x) for x in gate_warning_codes if str(x).strip()]) or "-"),
        )
    )
    if gate_failure_codes:
        lines.append(
            "- parallel_cycle_failure_codes: `"
            + " ".join([f"{k}={gate_failure_codes[k]}" for k in sorted(gate_failure_codes.keys())])
            + "`"
        )
    lane_b = as_dict(as_dict(parallel_cycle.get("lanes")).get("lane_b"))
    lane_b_ui = as_dict(lane_b.get("ui_flow"))
    if lane_b:
        lines.append(
            "- parallel_lane_b: `status={status}` `rc={rc}` `node_test_duration_sec={node}` `ui_flow_enabled={ui_enabled}` `ui_flow_mode={ui_mode}` `ui_flow_status={ui_status}` `ui_flow_open_retries={open_retries}`".format(
                status=str(lane_b.get("status") or ""),
                rc=as_int(lane_b.get("rc"), 0),
                node=as_int(lane_b.get("node_test_duration_sec"), 0),
                ui_enabled=bool(lane_b_ui.get("enabled", False)),
                ui_mode=str(lane_b_ui.get("mode") or ""),
                ui_status=str(lane_b_ui.get("status") or ""),
                open_retries=as_int(lane_b_ui.get("open_retries"), 0),
            )
        )
    if lane_b_ui:
        lines.append(
            "- parallel_lane_b_ui_flow_attribution: `complete={complete}` `failure_code={code}`".format(
                complete=bool(lane_b_ui.get("failure_attribution_complete", True)),
                code=str(lane_b_ui.get("failure_code") or "-"),
            )
        )
        coverage = lane_b_ui.get("interaction_checks_coverage")
        if isinstance(coverage, dict) and coverage:
            parts = []
            for key in sorted(coverage.keys()):
                parts.append(f"{key}={str(bool(coverage.get(key, False))).lower()}")
            lines.append(
                "- parallel_lane_b_ui_flow_interaction_checks: `complete={complete}` `{coverage}`".format(
                    complete=bool(lane_b_ui.get("interaction_checks_complete", False)),
                    coverage=" ".join(parts),
                )
            )
if parallel_cycle.get("summary_json"):
    lines.append(f"- parallel_cycle_summary: `{parallel_cycle.get('summary_json')}`")
if parallel_cycle.get("summary_md"):
    lines.append(f"- parallel_cycle_summary_md: `{parallel_cycle.get('summary_md')}`")
lines.append("")
lines.append("## Artifacts")
lines.append(f"- summary_json: `{summary_json_path}`")
lines.append(f"- editor_smoke_summary: `{payload['editor_smoke']['summary_json']}`")
if payload.get("ui_flow_smoke", {}).get("enabled"):
    lines.append(f"- ui_flow_smoke_summary: `{payload['ui_flow_smoke']['summary_json']}`")
    if payload["ui_flow_smoke"].get("run_summaries"):
        lines.append(f"- ui_flow_smoke_runs: `{len(payload['ui_flow_smoke']['run_summaries'])}`")
if payload.get("ui_flow_failure_injection", {}).get("enabled"):
    lines.append(f"- ui_flow_failure_injection_summary: `{payload['ui_flow_failure_injection']['summary_json']}`")
lines.append(f"- step166_summary: `{payload['step166']['summary_json']}`")
lines.append(f"- perf_summary: `{payload['performance']['summary_json']}`")
if payload["real_scene_perf"]["summary_json"]:
    lines.append(f"- real_scene_perf_summary: `{payload['real_scene_perf']['summary_json']}`")
if payload["gate"]["summary_json"]:
    lines.append(f"- gate_summary: `{payload['gate']['summary_json']}`")
if payload.get("gate_preview_provenance_smoke", {}).get("summary_json"):
    lines.append(f"- gate_preview_provenance_smoke_summary: `{payload['gate_preview_provenance_smoke']['summary_json']}`")
if payload.get("gate_dwg_open_smoke", {}).get("summary_json"):
    lines.append(f"- gate_dwg_open_smoke_summary: `{payload['gate_dwg_open_smoke']['summary_json']}`")
if payload.get("gate_dwg_open_matrix_smoke", {}).get("summary_json"):
    lines.append(f"- gate_dwg_open_matrix_smoke_summary: `{payload['gate_dwg_open_matrix_smoke']['summary_json']}`")
if payload.get("gate_dwg_open_desktop_smoke", {}).get("summary_json"):
    lines.append(f"- gate_dwg_open_desktop_smoke_summary: `{payload['gate_dwg_open_desktop_smoke']['summary_json']}`")
if payload.get("gate_solver_action_panel_smoke", {}).get("summary_json"):
    lines.append(f"- gate_solver_action_panel_smoke_summary: `{payload['gate_solver_action_panel_smoke']['summary_json']}`")
if payload.get("step186_preview_artifact_prep", {}).get("summary_json"):
    lines.append(f"- step186_preview_artifact_prep_summary: `{payload['step186_preview_artifact_prep']['summary_json']}`")
if payload.get("gate_preview_provenance_failure_injection", {}).get("summary_json"):
    lines.append(f"- gate_preview_provenance_failure_injection_summary: `{payload['gate_preview_provenance_failure_injection']['summary_json']}`")
if payload.get("gate_preview_artifact_smoke", {}).get("summary_json"):
    lines.append(f"- gate_preview_artifact_smoke_summary: `{payload['gate_preview_artifact_smoke']['summary_json']}`")
if payload.get("gate_constraints_basic_ctest", {}).get("build_dir"):
    lines.append(f"- gate_constraints_basic_ctest_build_dir: `{payload['gate_constraints_basic_ctest']['build_dir']}`")
if payload.get("gate_assembly_roundtrip_ctest", {}).get("build_dir"):
    lines.append(f"- gate_assembly_roundtrip_ctest_build_dir: `{payload['gate_assembly_roundtrip_ctest']['build_dir']}`")
for key in ("model_summary_json", "paperspace_summary_json", "mixed_summary_json", "dense_summary_json"):
    if payload.get("gate_assembly_roundtrip_ctest", {}).get(key):
        lines.append(f"- gate_assembly_roundtrip_ctest_{key}: `{payload['gate_assembly_roundtrip_ctest'][key]}`")
if payload.get("gate_preview_artifact_validator_failure_injection", {}).get("summary_json"):
    lines.append(f"- gate_preview_artifact_validator_failure_injection_summary: `{payload['gate_preview_artifact_validator_failure_injection']['summary_json']}`")
if payload.get("weekly_legacy_preview_artifact_smoke", {}).get("summary_json"):
    lines.append(f"- weekly_legacy_preview_artifact_smoke_summary: `{payload['weekly_legacy_preview_artifact_smoke']['summary_json']}`")
if isinstance(gate_editor_injection, dict) and gate_editor_injection.get("enabled"):
    lines.append(f"- gate_editor_smoke_failure_injection_summary: `{gate_editor_injection.get('summary_json','')}`")
if payload["trend"]["summary_json"]:
    lines.append(f"- trend_summary_json: `{payload['trend']['summary_json']}`")
if payload["trend"]["summary_md"]:
    lines.append(f"- trend_summary_md: `{payload['trend']['summary_md']}`")
if payload["ui_flow_stage_trend"]["summary_json"]:
    lines.append(f"- ui_flow_stage_trend_summary_json: `{payload['ui_flow_stage_trend']['summary_json']}`")
if payload["ui_flow_stage_trend"]["summary_md"]:
    lines.append(f"- ui_flow_stage_trend_summary_md: `{payload['ui_flow_stage_trend']['summary_md']}`")
if payload["perf_trend"]["summary_json"]:
    lines.append(f"- perf_trend_summary_json: `{payload['perf_trend']['summary_json']}`")
if payload["perf_trend"]["summary_md"]:
    lines.append(f"- perf_trend_summary_md: `{payload['perf_trend']['summary_md']}`")
if payload["real_scene_trend"]["summary_json"]:
    lines.append(f"- real_scene_trend_summary_json: `{payload['real_scene_trend']['summary_json']}`")
if payload["real_scene_trend"]["summary_md"]:
    lines.append(f"- real_scene_trend_summary_md: `{payload['real_scene_trend']['summary_md']}`")
if payload["case_selection_trend"]["summary_json"]:
    lines.append(f"- case_selection_trend_summary_json: `{payload['case_selection_trend']['summary_json']}`")
if payload["case_selection_trend"]["summary_md"]:
    lines.append(f"- case_selection_trend_summary_md: `{payload['case_selection_trend']['summary_md']}`")
if payload.get("qt_project_persistence_policy", {}).get("summary_json"):
    lines.append(f"- qt_persistence_policy_summary_json: `{payload['qt_project_persistence_policy']['summary_json']}`")
if payload.get("qt_project_persistence_policy", {}).get("summary_md"):
    lines.append(f"- qt_persistence_policy_summary_md: `{payload['qt_project_persistence_policy']['summary_md']}`")
if payload.get("parallel_cycle", {}).get("summary_json"):
    lines.append(f"- parallel_cycle_summary_json: `{payload['parallel_cycle']['summary_json']}`")
if payload.get("parallel_cycle", {}).get("summary_md"):
    lines.append(f"- parallel_cycle_summary_md: `{payload['parallel_cycle']['summary_md']}`")
lines.append("")

os.makedirs(os.path.dirname(summary_md_path), exist_ok=True)
with open(summary_md_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
    f.write("\n")
PY

echo "[WEEKLY] wrote $SUMMARY_JSON"
echo "[WEEKLY] wrote $SUMMARY_MD"

if [[ -n "$WEEKLY_HISTORY_JSON" ]]; then
  mkdir -p "$(dirname "$WEEKLY_HISTORY_JSON")"
  cp "$SUMMARY_JSON" "$WEEKLY_HISTORY_JSON"
  echo "[WEEKLY] wrote $WEEKLY_HISTORY_JSON"
fi

if [[ "$RUN_WEEKLY_SUMMARY_CHECK" == "1" && -n "$WEEKLY_SUMMARY_CHECK_DASHBOARD" ]]; then
  python3 tools/write_step176_dashboard.py \
    --gate-history-dir build/editor_gate_history \
    --weekly-history-dir "$WEEKLY_HISTORY_DIR" \
    --out "$WEEKLY_SUMMARY_CHECK_DASHBOARD"
  echo "[WEEKLY] wrote $WEEKLY_SUMMARY_CHECK_DASHBOARD"
fi

if [[ "$RUN_WEEKLY_SUMMARY_CHECK" == "1" ]]; then
  WEEKLY_CHECK_CMD=(bash tools/check_weekly_summary.sh --summary "$SUMMARY_JSON")
  if [[ -n "$WEEKLY_SUMMARY_CHECK_DASHBOARD" ]]; then
    WEEKLY_CHECK_CMD+=(--dashboard "$WEEKLY_SUMMARY_CHECK_DASHBOARD")
  fi
  if [[ "$WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD" == "1" ]]; then
    WEEKLY_CHECK_CMD+=(--require-dashboard)
  fi
  set +e
  "${WEEKLY_CHECK_CMD[@]}"
  WEEKLY_CHECK_RC=$?
  set -e
  if [[ "$WEEKLY_CHECK_RC" -ne 0 ]]; then
    if [[ "$WEEKLY_SUMMARY_CHECK_STRICT" == "1" ]]; then
      echo "[WEEKLY] ERROR weekly summary contract check failed (rc=$WEEKLY_CHECK_RC)"
      exit "$WEEKLY_CHECK_RC"
    fi
    echo "[WEEKLY] WARN weekly summary contract check failed (rc=$WEEKLY_CHECK_RC, strict=0)"
  fi
fi

if [[ "$STEP176_APPEND_REPORT" == "1" ]]; then
  python3 tools/write_step176_weekly_report.py --weekly-summary "$SUMMARY_JSON" --report "$STEP176_REPORT"
fi

if [[ "$STEP170_APPEND_REPORT" == "1" ]]; then
  python3 tools/write_step170_weekly_report.py --weekly-summary "$SUMMARY_JSON" --step170-report "$STEP170_REPORT"
fi

if [[ "$RUN_EDITOR_PARALLEL_CYCLE" == "1" && "$WEEKLY_PARALLEL_DECISION_POLICY" == "gate" ]]; then
  if [[ "$PARALLEL_CYCLE_GATE_DECISION" == "fail" || "$PARALLEL_CYCLE_STATUS" == "fail" ]]; then
    echo "[WEEKLY] ERROR parallel cycle gate policy failed (decision=${PARALLEL_CYCLE_GATE_DECISION:-unknown}, status=${PARALLEL_CYCLE_STATUS:-unknown})"
    if [[ "$PARALLEL_CYCLE_RC" -gt 0 ]]; then
      exit "$PARALLEL_CYCLE_RC"
    fi
    exit 2
  fi
fi

if [[ "$RUN_GATE" == "1" && "$GATE_RC" -ne 0 ]]; then
  exit "$GATE_RC"
fi
