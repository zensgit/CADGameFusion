#!/usr/bin/env bash
set -euo pipefail

# Validate build/local_ci_summary.json produced by tools/local_ci.sh
#
# Usage:
#   bash tools/check_local_summary.sh [--offline-allowed] [--summary <path>]
#   bash tools/check_local_summary.sh [--offline-allowed] [--build-dir <dir>]
#
# Behavior:
#   - Fails if summary JSON missing or malformed
#   - Fails if any validationFailCount > 0 or missingScenes not empty
#   - Fails if no scenes recorded
#   - By default requires offline=false; with --offline-allowed, accepts either

OFFLINE_ALLOWED=false
SUM_JSON="build/local_ci_summary.json"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --offline-allowed) OFFLINE_ALLOWED=true; shift;;
    --summary)
      SUM_JSON="${2:-}"
      if [[ -z "$SUM_JSON" ]]; then
        echo "Missing value for --summary" >&2
        exit 2
      fi
      shift 2
      ;;
    --build-dir)
      BUILD_DIR_ARG="${2:-}"
      if [[ -z "$BUILD_DIR_ARG" ]]; then
        echo "Missing value for --build-dir" >&2
        exit 2
      fi
      SUM_JSON="${BUILD_DIR_ARG%/}/local_ci_summary.json"
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

[[ -f "$SUM_JSON" ]] || { echo "[summary] Missing $SUM_JSON" >&2; exit 2; }

# Extract fields via Python (avoid jq dependency)
read -r OFFLINE SCENES_COUNT MISSING_COUNT FAIL_COUNT SKIP_COMPARE \
  HATCH_STATUS TEXT_ALIGN_PARTIAL_STATUS TEXT_ALIGN_EXT_STATUS \
  HATCH_DENSE_STATUS HATCH_LARGE_STATUS NONFINITE_STATUS \
  RUN_EDITOR_SMOKE_GATE EDITOR_SMOKE_STATUS \
  EDITOR_SMOKE_GATE_RUNS_TARGET EDITOR_SMOKE_GATE_RUN_COUNT EDITOR_SMOKE_GATE_FAIL_COUNT EDITOR_SMOKE_FAILURE_CODE_COUNT \
  RUN_EDITOR_UI_FLOW_SMOKE_GATE EDITOR_UI_FLOW_SMOKE_STATUS \
  EDITOR_UI_FLOW_SMOKE_GATE_RUNS_TARGET EDITOR_UI_FLOW_SMOKE_GATE_RUN_COUNT EDITOR_UI_FLOW_SMOKE_GATE_FAIL_COUNT EDITOR_UI_FLOW_FAILURE_CODE_COUNT EDITOR_UI_FLOW_OPEN_ATTEMPT_COUNT \
  EDITOR_UI_FLOW_ATTR_COMPLETE EDITOR_UI_FLOW_INTERACTION_COMPLETE \
  RUN_EDITOR_GATE EDITOR_GATE_STATUS EDITOR_GATE_STEP166_ENABLED EDITOR_GATE_BASELINE_COMPARED \
  EDITOR_GATE_BASELINE_RUN_ID EDITOR_GATE_BASELINE_FILE_PRESENT \
  EDITOR_GATE_STEP166_GATE_WOULD_FAIL \
  EDITOR_GATE_EDITOR_SMOKE_FAIL_COUNT EDITOR_GATE_EDITOR_SMOKE_FAILURE_CODE_TOTAL EDITOR_GATE_EDITOR_SMOKE_ATTR_COMPLETE \
  EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_CASES_WITH_CHECKS EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_CHECKED_ENTITIES \
  EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_MISSING_ENTITIES EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_DRIFTED_ENTITIES \
  EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_FAILED_CASES \
  EDITOR_GATE_UI_FLOW_FAIL_COUNT EDITOR_GATE_UI_FLOW_FAILURE_CODE_TOTAL EDITOR_GATE_UI_FLOW_ATTR_COMPLETE EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_COUNT \
  RUN_EDITOR_PARALLEL_CYCLE EDITOR_PARALLEL_CYCLE_STATUS EDITOR_PARALLEL_CYCLE_GATE_DECISION \
  EDITOR_PARALLEL_CYCLE_GATE_RAW_DECISION EDITOR_PARALLEL_CYCLE_GATE_WATCH_POLICY EDITOR_PARALLEL_CYCLE_GATE_WATCH_ESCALATED \
  EDITOR_PARALLEL_CYCLE_RUN_LANE_B EDITOR_PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW EDITOR_PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE \
  EDITOR_PARALLEL_CYCLE_LANE_B_UI_ENABLED EDITOR_PARALLEL_CYCLE_LANE_B_UI_TIMEOUT_MS EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_ATTEMPT_COUNT \
  EDITOR_PARALLEL_CYCLE_LANE_B_UI_ATTR_COMPLETE EDITOR_PARALLEL_CYCLE_LANE_B_UI_INTERACTION_COMPLETE <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json, sys
p = sys.argv[1]
try:
    with open(p, 'r', encoding='utf-8') as f:
        j = json.load(f)
except Exception as e:
    print("ERR", 0, 0, 0, "false", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown",
          "false", "unknown", 0, 0, 0, 0,
          "false", "unknown", 0, 0, 0, 0, 0,
          "true", "false",
          "false", "unknown", "true", 0, "", "false", "false", 0, 0, "true",
          0, 0, 0, 0, 0,
          0, 0, "true", 0,
          "false", "unknown", "unknown", "unknown", "observe", "false",
          "false", "false", "gate", "false", 0, 0, "true", "false")
    sys.exit(0)
def b(v):
    return 'true' if bool(v) else 'false'
offline = b(j.get('offline', False))
scenes = j.get('scenes', []) or []
missing = j.get('missingScenes', []) or []
fails = int(j.get('validationFailCount', 0) or 0)
skipc = b(j.get('skipCompare', False))
ctest_hatch = j.get('ctestHatchDashStatus', 'unknown')
ctest_text_align = j.get('ctestTextAlignPartialStatus', 'unknown')
ctest_text_align_ext = j.get('ctestTextAlignExtendedStatus', 'unknown')
ctest_hatch_dense = j.get('ctestHatchDenseCapStatus', 'unknown')
ctest_hatch_large = j.get('ctestHatchLargeBoundaryBudgetStatus', 'unknown')
ctest_nonfinite = j.get('ctestNonfiniteNumbersStatus', 'unknown')
run_editor_gate = b(j.get('runEditorGate', False))
editor_gate_status = j.get('editorGateStatus', 'unknown')
editor_gate_step166_enabled = b(j.get('editorGateStep166Enabled', True))
editor_gate_baseline_compared = int(j.get('editorGateStep166BaselineCompared', 0) or 0)
editor_gate_baseline_run_id = str(j.get('editorGateStep166BaselineRunId', '') or '').strip() or "__EMPTY__"
editor_gate_baseline_file_present = b(j.get('editorGateStep166BaselineFilePresent', False))
editor_gate_step166_gate_would_fail = b(j.get('editorGateStep166GateWouldFail', False))
editor_gate_editor_smoke_fail_count = int(j.get('editorGateEditorSmokeFailCount', 0) or 0)
editor_gate_editor_smoke_failure_code_total = int(j.get('editorGateEditorSmokeFailureCodeTotal', 0) or 0)
editor_gate_editor_smoke_attr_complete = b(j.get('editorGateEditorSmokeFailureAttributionComplete', True))
editor_gate_editor_smoke_unsupported_cases_with_checks = int(j.get('editorGateEditorSmokeUnsupportedCasesWithChecks', 0) or 0)
editor_gate_editor_smoke_unsupported_checked_entities = int(j.get('editorGateEditorSmokeUnsupportedCheckedEntities', 0) or 0)
editor_gate_editor_smoke_unsupported_missing_entities = int(j.get('editorGateEditorSmokeUnsupportedMissingEntities', 0) or 0)
editor_gate_editor_smoke_unsupported_drifted_entities = int(j.get('editorGateEditorSmokeUnsupportedDriftedEntities', 0) or 0)
editor_gate_editor_smoke_unsupported_failed_cases = int(j.get('editorGateEditorSmokeUnsupportedFailedCases', 0) or 0)
editor_gate_ui_flow_fail_count = int(j.get('editorGateUiFlowFailCount', 0) or 0)
editor_gate_ui_flow_failure_code_total = int(j.get('editorGateUiFlowFailureCodeTotal', 0) or 0)
editor_gate_ui_flow_attr_complete = b(j.get('editorGateUiFlowFailureAttributionComplete', True))
editor_gate_ui_flow_open_attempt_count = int(j.get('editorGateUiFlowOpenAttemptCount', 0) or 0)
run_editor_parallel_cycle = b(j.get('runEditorParallelCycle', False))
editor_parallel_cycle_status = str(j.get('editorParallelCycleStatus', 'unknown') or 'unknown')
editor_parallel_cycle_gate_decision = str(j.get('editorParallelCycleGateDecision', 'unknown') or 'unknown')
editor_parallel_cycle_gate_raw_decision = str(j.get('editorParallelCycleGateRawDecision', 'unknown') or 'unknown')
editor_parallel_cycle_gate_watch_policy = str(j.get('editorParallelCycleGateWatchPolicy', 'observe') or 'observe')
editor_parallel_cycle_gate_watch_escalated = b(j.get('editorParallelCycleGateWatchEscalated', False))
editor_parallel_cycle_run_lane_b = b(j.get('editorParallelCycleRunLaneB', False))
editor_parallel_cycle_lane_b_run_ui_flow = b(j.get('editorParallelCycleLaneBRunUiFlow', False))
editor_parallel_cycle_lane_b_ui_flow_mode = str(j.get('editorParallelCycleLaneBUiFlowMode', 'gate') or 'gate')
editor_parallel_cycle_lane_b_ui_enabled = b(j.get('editorParallelCycleLaneBUiFlowEnabled', j.get('editorParallelCycleLaneBRunUiFlow', False)))
editor_parallel_cycle_lane_b_ui_timeout_ms = int(j.get('editorParallelCycleLaneBUiFlowTimeoutMs', 0) or 0)
editor_parallel_cycle_lane_b_ui_open_attempt_count = int(j.get('editorParallelCycleLaneBUiFlowOpenAttemptCount', 0) or 0)
editor_parallel_cycle_lane_b_ui_attr_complete = b(j.get('editorParallelCycleLaneBUiFlowFailureAttributionComplete', True))
editor_parallel_cycle_lane_b_ui_interaction_complete = b(j.get('editorParallelCycleLaneBUiFlowInteractionChecksComplete', False))
run_editor_smoke_gate = b(j.get('runEditorSmokeGate', False))
editor_smoke_status = str(j.get('editorSmokeStatus', 'unknown') or 'unknown')
editor_smoke_gate_runs_target = int(j.get('editorSmokeGateRunsTarget', 0) or 0)
editor_smoke_gate_run_count = int(j.get('editorSmokeGateRunCount', 0) or 0)
editor_smoke_gate_fail_count = int(j.get('editorSmokeGateFailCount', 0) or 0)
editor_smoke_failure_code_counts = j.get('editorSmokeFailureCodeCounts')
if isinstance(editor_smoke_failure_code_counts, dict):
    editor_smoke_failure_code_count = sum(
        int(v) for v in editor_smoke_failure_code_counts.values() if isinstance(v, (int, float))
    )
else:
    editor_smoke_failure_code_count = int(j.get('editorSmokeFailureCodeCount', 0) or 0)
run_editor_ui_flow_smoke_gate = b(j.get('runEditorUiFlowSmokeGate', False))
editor_ui_flow_smoke_status = str(j.get('editorUiFlowSmokeStatus', 'unknown') or 'unknown')
editor_ui_flow_smoke_gate_runs_target = int(j.get('editorUiFlowSmokeGateRunsTarget', 0) or 0)
editor_ui_flow_smoke_gate_run_count = int(j.get('editorUiFlowSmokeGateRunCount', 0) or 0)
editor_ui_flow_smoke_gate_fail_count = int(j.get('editorUiFlowSmokeGateFailCount', 0) or 0)
editor_ui_flow_open_attempt_count = int(j.get('editorUiFlowSmokeOpenAttemptCount', 0) or 0)
editor_ui_flow_attr_complete = b(j.get('editorUiFlowSmokeFailureAttributionComplete', True))
editor_ui_flow_interaction_complete = b(j.get('editorUiFlowSmokeInteractionChecksComplete', False))
editor_ui_flow_failure_code_counts = j.get('editorUiFlowSmokeFailureCodeCounts')
if isinstance(editor_ui_flow_failure_code_counts, dict):
    editor_ui_flow_failure_code_count = sum(
        int(v) for v in editor_ui_flow_failure_code_counts.values() if isinstance(v, (int, float))
    )
else:
    editor_ui_flow_failure_code_count = int(j.get('editorUiFlowSmokeFailureCodeCount', 0) or 0)
print(offline, len(scenes), len(missing), fails, skipc,
      ctest_hatch, ctest_text_align, ctest_text_align_ext,
      ctest_hatch_dense, ctest_hatch_large, ctest_nonfinite,
      run_editor_smoke_gate, editor_smoke_status,
      editor_smoke_gate_runs_target, editor_smoke_gate_run_count, editor_smoke_gate_fail_count, editor_smoke_failure_code_count,
      run_editor_ui_flow_smoke_gate, editor_ui_flow_smoke_status,
      editor_ui_flow_smoke_gate_runs_target, editor_ui_flow_smoke_gate_run_count, editor_ui_flow_smoke_gate_fail_count, editor_ui_flow_failure_code_count, editor_ui_flow_open_attempt_count,
      editor_ui_flow_attr_complete, editor_ui_flow_interaction_complete,
      run_editor_gate, editor_gate_status, editor_gate_step166_enabled, editor_gate_baseline_compared,
      editor_gate_baseline_run_id, editor_gate_baseline_file_present,
      editor_gate_step166_gate_would_fail,
      editor_gate_editor_smoke_fail_count, editor_gate_editor_smoke_failure_code_total, editor_gate_editor_smoke_attr_complete,
      editor_gate_editor_smoke_unsupported_cases_with_checks, editor_gate_editor_smoke_unsupported_checked_entities,
      editor_gate_editor_smoke_unsupported_missing_entities, editor_gate_editor_smoke_unsupported_drifted_entities,
      editor_gate_editor_smoke_unsupported_failed_cases,
      editor_gate_ui_flow_fail_count, editor_gate_ui_flow_failure_code_total, editor_gate_ui_flow_attr_complete, editor_gate_ui_flow_open_attempt_count,
      run_editor_parallel_cycle, editor_parallel_cycle_status, editor_parallel_cycle_gate_decision,
      editor_parallel_cycle_gate_raw_decision, editor_parallel_cycle_gate_watch_policy, editor_parallel_cycle_gate_watch_escalated,
      editor_parallel_cycle_run_lane_b, editor_parallel_cycle_lane_b_run_ui_flow, editor_parallel_cycle_lane_b_ui_flow_mode,
      editor_parallel_cycle_lane_b_ui_enabled, editor_parallel_cycle_lane_b_ui_timeout_ms, editor_parallel_cycle_lane_b_ui_open_attempt_count,
      editor_parallel_cycle_lane_b_ui_attr_complete, editor_parallel_cycle_lane_b_ui_interaction_complete)
PY
)
EOF

read -r EDITOR_UI_FLOW_SMOKE_OPEN_RETRIES EDITOR_GATE_UI_FLOW_OPEN_RETRIES \
  EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_RETRIES <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        j = json.load(f)
except Exception:
    print(0, 0, 0)
    raise SystemExit(0)

def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default

print(
    as_int(j.get("editorUiFlowSmokeOpenRetries"), 0),
    as_int(j.get("editorGateUiFlowOpenRetries"), 0),
    as_int(j.get("editorParallelCycleLaneBUiFlowOpenRetries"), 0),
)
PY
)
EOF

read -r EDITOR_GATE_RUNTIME_PROFILE EDITOR_GATE_RUNTIME_STEP166_GATE EDITOR_GATE_RUNTIME_UI_FLOW_GATE \
  EDITOR_GATE_RUNTIME_CONVERT_DISABLED EDITOR_GATE_RUNTIME_PERF_TREND EDITOR_GATE_RUNTIME_REAL_SCENE_TREND \
  EDITOR_GATE_RUNTIME_SOURCE PARALLEL_LANE_A_RUNTIME_PROFILE PARALLEL_LANE_A_RUNTIME_STEP166_GATE \
  PARALLEL_LANE_A_RUNTIME_UI_FLOW_GATE PARALLEL_LANE_A_RUNTIME_CONVERT_DISABLED \
  PARALLEL_LANE_A_RUNTIME_PERF_TREND PARALLEL_LANE_A_RUNTIME_REAL_SCENE_TREND \
  PARALLEL_LANE_A_RUNTIME_SOURCE PARALLEL_CYCLE_RUN_LANE_A \
  PARALLEL_CYCLE_DURATION_SEC PARALLEL_CYCLE_LANE_A_DURATION_SEC PARALLEL_CYCLE_LANE_B_DURATION_SEC \
  PARALLEL_CYCLE_LANE_B_NODE_TEST_DURATION_SEC PARALLEL_CYCLE_LANE_B_UI_FLOW_DURATION_SEC \
  PARALLEL_CYCLE_LANE_C_DURATION_SEC PARALLEL_CYCLE_LANE_C_CASE_SELECTION_DURATION_SEC \
  PARALLEL_CYCLE_LANE_C_GATE_TREND_DURATION_SEC <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json, sys
p = sys.argv[1]
try:
    with open(p, "r", encoding="utf-8") as f:
        j = json.load(f)
except Exception:
    print("<none>", "false", "false", "false", "false", "false", "summary_missing",
          "n/a", "false", "false", "false", "false", "false", "summary_missing", "false",
          0, 0, 0, 0, 0, 0, 0, 0)
    raise SystemExit(0)

def as_dict(value):
    return value if isinstance(value, dict) else {}

def b(v):
    return "true" if bool(v) else "false"

gate_runtime = as_dict(j.get("editorGateRuntime"))
if gate_runtime:
    gate_profile = str(gate_runtime.get("profile") or "<none>")
    gate_step166 = b(gate_runtime.get("step166_gate", False))
    gate_ui = b(gate_runtime.get("ui_flow_gate", False))
    gate_convert = b(gate_runtime.get("convert_disabled", False))
    gate_perf = b(gate_runtime.get("perf_trend", False))
    gate_scene = b(gate_runtime.get("real_scene_trend", False))
    gate_source = str(gate_runtime.get("source") or "editorGateRuntime")
else:
    gate_profile = str(j.get("editorGateRuntimeProfile") or j.get("editorGateProfile") or "<none>")
    gate_step166 = b(j.get("editorGateRuntimeStep166Gate", j.get("editorGateStep166Enabled", False)))
    gate_ui = b(j.get("editorGateRuntimeUiFlowGate", False))
    gate_convert = b(j.get("editorGateRuntimeConvertDisabled", False))
    gate_perf = b(j.get("editorGateRuntimePerfTrend", False))
    gate_scene = b(j.get("editorGateRuntimeRealSceneTrend", False))
    gate_source = str(j.get("editorGateRuntimeSource") or "flat_fields")

lane_runtime = as_dict(j.get("editorParallelCycleLaneARuntime"))
if lane_runtime:
    lane_profile = str(lane_runtime.get("profile") or "<none>")
    lane_step166 = b(lane_runtime.get("step166_gate", False))
    lane_ui = b(lane_runtime.get("ui_flow_gate", False))
    lane_convert = b(lane_runtime.get("convert_disabled", False))
    lane_perf = b(lane_runtime.get("perf_trend", False))
    lane_scene = b(lane_runtime.get("real_scene_trend", False))
    lane_source = str(lane_runtime.get("source") or "editorParallelCycleLaneARuntime")
else:
    lane_profile = str(j.get("editorParallelCycleLaneARuntimeProfile") or "n/a")
    lane_step166 = b(j.get("editorParallelCycleLaneARuntimeStep166Gate", False))
    lane_ui = b(j.get("editorParallelCycleLaneARuntimeUiFlowGate", False))
    lane_convert = b(j.get("editorParallelCycleLaneARuntimeConvertDisabled", False))
    lane_perf = b(j.get("editorParallelCycleLaneARuntimePerfTrend", False))
    lane_scene = b(j.get("editorParallelCycleLaneARuntimeRealSceneTrend", False))
    lane_source = str(j.get("editorParallelCycleLaneARuntimeSource") or "flat_fields")

print(gate_profile, gate_step166, gate_ui, gate_convert, gate_perf, gate_scene, gate_source,
      lane_profile, lane_step166, lane_ui, lane_convert, lane_perf, lane_scene, lane_source,
      b(j.get("editorParallelCycleRunLaneA", False)),
      int(j.get("editorParallelCycleDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneADurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneBDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneBNodeTestDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneBUiFlowDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneCDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneCCaseSelectionDurationSec", 0) or 0),
      int(j.get("editorParallelCycleLaneCGateTrendDurationSec", 0) or 0))
PY
)
EOF

read -r EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY_INPUT \
  EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS_INPUT EDITOR_GATE_UI_FLOW_STAGE_TREND_STATUS \
  EDITOR_GATE_UI_FLOW_STAGE_TREND_RECOMMENDED EDITOR_GATE_UI_FLOW_STAGE_TREND_EFFECTIVE \
  EDITOR_GATE_UI_FLOW_STAGE_TREND_SOURCE EDITOR_GATE_UI_FLOW_STAGE_TREND_APPLIED \
  EDITOR_GATE_UI_FLOW_STAGE_TREND_ENABLED_SAMPLES <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json, sys
p = sys.argv[1]
try:
    with open(p, "r", encoding="utf-8") as f:
        j = json.load(f)
except Exception:
    print("false", "", 0, "unknown", "observe", "observe", "", "false", 0)
    raise SystemExit(0)

def b(v):
    return "true" if bool(v) else "false"

print(
    b(j.get("editorGateRunUiFlowStageTrend", False)),
    str(j.get("editorGateUiFlowStageTrendPolicyInput", "") or "").strip(),
    int(j.get("editorGateUiFlowStageTrendDaysInput", 0) or 0),
    str(j.get("editorGateUiFlowStageTrendStatus", "unknown") or "unknown").strip(),
    str(j.get("editorGateUiFlowStageTrendRecommendedMode", "observe") or "observe").strip(),
    str(j.get("editorGateUiFlowStageTrendEffectiveMode", "observe") or "observe").strip(),
    str(j.get("editorGateUiFlowStageTrendGateSource", "") or "").strip(),
    b(j.get("editorGateUiFlowStageTrendGateApplied", False)),
    int(j.get("editorGateUiFlowStageTrendEnabledSamples", 0) or 0),
)
PY
)
EOF

read -r EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_INPUT EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_EFFECTIVE \
  EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_SOURCE \
  EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_OK EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUES \
  EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUE_COUNT EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_STATUS \
  EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_MODE EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DAYS \
  EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json, sys
p = sys.argv[1]
try:
    with open(p, "r", encoding="utf-8") as f:
        j = json.load(f)
except Exception:
    print("observe", "observe", "pass", "none", "true", "none", 0, "unknown", "observe", 0, 0)
    raise SystemExit(0)

def b(v):
    return "true" if bool(v) else "false"

policy_input = str(
    j.get(
        "editorGateUiFlowStageContractPolicyInput",
        j.get("editorGateUiFlowStageTrendPolicyInput", "observe"),
    )
    or "observe"
).strip()
effective = str(
    j.get(
        "editorGateUiFlowStageContractPolicyEffective",
        j.get("editorGateUiFlowStageTrendEffectiveMode", "observe"),
    )
    or "observe"
).strip()
decision = str(j.get("editorGateUiFlowStageContractDecision", "pass") or "pass").strip()
source = str(j.get("editorGateUiFlowStageContractSource", "none") or "none").strip()
ok = b(j.get("editorGateUiFlowStageContractOk", True))
issues = str(j.get("editorGateUiFlowStageContractIssues", "none") or "none").strip()
issue_count = int(j.get("editorGateUiFlowStageContractIssueCount", 0) or 0)
status = str(j.get("editorGateUiFlowStageContractStatus", "unknown") or "unknown").strip()
mode = str(
    j.get(
        "editorGateUiFlowStageContractMode",
        j.get("editorGateUiFlowStageTrendRecommendedMode", "observe"),
    )
    or "observe"
).strip()
days = int(
    j.get(
        "editorGateUiFlowStageContractDays",
        j.get("editorGateUiFlowStageTrendDaysInput", 0),
    )
    or 0
)
rc = int(j.get("editorGateUiFlowStageContractRc", 0) or 0)

print(policy_input, effective, decision, source, ok, issues, issue_count, status, mode, days, rc)
PY
)
EOF

if [[ "$OFFLINE" == "ERR" ]]; then
  echo "[summary] Malformed JSON: $SUM_JSON" >&2
  exit 2
fi
if [[ "$EDITOR_GATE_BASELINE_RUN_ID" == "__EMPTY__" ]]; then
  EDITOR_GATE_BASELINE_RUN_ID=""
fi

echo "[summary] offline=$OFFLINE scenes=$SCENES_COUNT missing=$MISSING_COUNT fails=$FAIL_COUNT skipCompare=$SKIP_COMPARE hatchDash=$HATCH_STATUS textAlign=$TEXT_ALIGN_PARTIAL_STATUS textAlignExt=$TEXT_ALIGN_EXT_STATUS hatchDense=$HATCH_DENSE_STATUS hatchLarge=$HATCH_LARGE_STATUS nonfinite=$NONFINITE_STATUS runEditorSmokeGate=$RUN_EDITOR_SMOKE_GATE editorSmokeStatus=$EDITOR_SMOKE_STATUS editorSmokeGateRuns=$EDITOR_SMOKE_GATE_RUN_COUNT/$EDITOR_SMOKE_GATE_RUNS_TARGET editorSmokeGateFail=$EDITOR_SMOKE_GATE_FAIL_COUNT editorSmokeFailureCodes=$EDITOR_SMOKE_FAILURE_CODE_COUNT runEditorUiFlowSmokeGate=$RUN_EDITOR_UI_FLOW_SMOKE_GATE editorUiFlowSmokeStatus=$EDITOR_UI_FLOW_SMOKE_STATUS editorUiFlowSmokeGateRuns=$EDITOR_UI_FLOW_SMOKE_GATE_RUN_COUNT/$EDITOR_UI_FLOW_SMOKE_GATE_RUNS_TARGET editorUiFlowSmokeGateFail=$EDITOR_UI_FLOW_SMOKE_GATE_FAIL_COUNT editorUiFlowFailureCodes=$EDITOR_UI_FLOW_FAILURE_CODE_COUNT editorUiFlowOpenRetries=$EDITOR_UI_FLOW_SMOKE_OPEN_RETRIES editorUiFlowOpenAttempts=$EDITOR_UI_FLOW_OPEN_ATTEMPT_COUNT editorUiFlowAttr=$EDITOR_UI_FLOW_ATTR_COMPLETE editorUiFlowInteractionComplete=$EDITOR_UI_FLOW_INTERACTION_COMPLETE runEditorGate=$RUN_EDITOR_GATE editorGateStatus=$EDITOR_GATE_STATUS editorGateStep166Enabled=$EDITOR_GATE_STEP166_ENABLED editorGateStep166Compared=$EDITOR_GATE_BASELINE_COMPARED editorGateSmokeFail=$EDITOR_GATE_EDITOR_SMOKE_FAIL_COUNT editorGateSmokeCodeTotal=$EDITOR_GATE_EDITOR_SMOKE_FAILURE_CODE_TOTAL editorGateSmokeAttr=$EDITOR_GATE_EDITOR_SMOKE_ATTR_COMPLETE editorGateSmokeUnsupportedCases=$EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_CASES_WITH_CHECKS editorGateSmokeUnsupportedChecked=$EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_CHECKED_ENTITIES editorGateSmokeUnsupportedMissing=$EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_MISSING_ENTITIES editorGateSmokeUnsupportedDrifted=$EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_DRIFTED_ENTITIES editorGateSmokeUnsupportedFailedCases=$EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_FAILED_CASES editorGateUiFail=$EDITOR_GATE_UI_FLOW_FAIL_COUNT editorGateUiCodeTotal=$EDITOR_GATE_UI_FLOW_FAILURE_CODE_TOTAL editorGateUiOpenRetries=$EDITOR_GATE_UI_FLOW_OPEN_RETRIES editorGateUiOpenAttempts=$EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_COUNT editorGateUiAttr=$EDITOR_GATE_UI_FLOW_ATTR_COMPLETE runEditorParallelCycle=$RUN_EDITOR_PARALLEL_CYCLE parallelStatus=$EDITOR_PARALLEL_CYCLE_STATUS parallelGateDecision=$EDITOR_PARALLEL_CYCLE_GATE_DECISION parallelGateRaw=$EDITOR_PARALLEL_CYCLE_GATE_RAW_DECISION parallelWatchPolicy=$EDITOR_PARALLEL_CYCLE_GATE_WATCH_POLICY parallelWatchEscalated=$EDITOR_PARALLEL_CYCLE_GATE_WATCH_ESCALATED parallelLaneBRun=$EDITOR_PARALLEL_CYCLE_RUN_LANE_B parallelLaneBUiFlow=$EDITOR_PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW parallelLaneBUiMode=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE parallelLaneBUiEnabled=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_ENABLED parallelLaneBUiTimeoutMs=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_TIMEOUT_MS parallelLaneBUiOpenRetries=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_RETRIES parallelLaneBUiOpenAttempts=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_ATTEMPT_COUNT parallelLaneBAttr=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_ATTR_COMPLETE parallelLaneBInteraction=$EDITOR_PARALLEL_CYCLE_LANE_B_UI_INTERACTION_COMPLETE"
echo "[summary] gateUiStageTrend run=$EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND policy=$EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY_INPUT days=$EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS_INPUT status=$EDITOR_GATE_UI_FLOW_STAGE_TREND_STATUS recommended=$EDITOR_GATE_UI_FLOW_STAGE_TREND_RECOMMENDED effective=$EDITOR_GATE_UI_FLOW_STAGE_TREND_EFFECTIVE source=$EDITOR_GATE_UI_FLOW_STAGE_TREND_SOURCE applied=$EDITOR_GATE_UI_FLOW_STAGE_TREND_APPLIED enabledSamples=$EDITOR_GATE_UI_FLOW_STAGE_TREND_ENABLED_SAMPLES"
echo "[summary] gateUiStageContract policyInput=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_INPUT effective=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_EFFECTIVE decision=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION ok=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_OK issues=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUES issueCount=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUE_COUNT source=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_SOURCE status=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_STATUS mode=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_MODE days=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DAYS rc=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC"
echo "[summary] gateRuntime profile=$EDITOR_GATE_RUNTIME_PROFILE step166_gate=$EDITOR_GATE_RUNTIME_STEP166_GATE ui_flow_gate=$EDITOR_GATE_RUNTIME_UI_FLOW_GATE convert_disabled=$EDITOR_GATE_RUNTIME_CONVERT_DISABLED perf_trend=$EDITOR_GATE_RUNTIME_PERF_TREND real_scene_trend=$EDITOR_GATE_RUNTIME_REAL_SCENE_TREND source=$EDITOR_GATE_RUNTIME_SOURCE parallelLaneARuntime profile=$PARALLEL_LANE_A_RUNTIME_PROFILE step166_gate=$PARALLEL_LANE_A_RUNTIME_STEP166_GATE ui_flow_gate=$PARALLEL_LANE_A_RUNTIME_UI_FLOW_GATE convert_disabled=$PARALLEL_LANE_A_RUNTIME_CONVERT_DISABLED perf_trend=$PARALLEL_LANE_A_RUNTIME_PERF_TREND real_scene_trend=$PARALLEL_LANE_A_RUNTIME_REAL_SCENE_TREND source=$PARALLEL_LANE_A_RUNTIME_SOURCE runLaneA=$PARALLEL_CYCLE_RUN_LANE_A"
echo "[summary] parallelDuration total=${PARALLEL_CYCLE_DURATION_SEC}s laneA=${PARALLEL_CYCLE_LANE_A_DURATION_SEC}s laneB=${PARALLEL_CYCLE_LANE_B_DURATION_SEC}s laneBNode=${PARALLEL_CYCLE_LANE_B_NODE_TEST_DURATION_SEC}s laneBUI=${PARALLEL_CYCLE_LANE_B_UI_FLOW_DURATION_SEC}s laneBUITimeoutMs=${EDITOR_PARALLEL_CYCLE_LANE_B_UI_TIMEOUT_MS} laneC=${PARALLEL_CYCLE_LANE_C_DURATION_SEC}s laneCCase=${PARALLEL_CYCLE_LANE_C_CASE_SELECTION_DURATION_SEC}s laneCGate=${PARALLEL_CYCLE_LANE_C_GATE_TREND_DURATION_SEC}s"

RC=0
if [[ "$OFFLINE_ALLOWED" == false && "$OFFLINE" == "true" ]]; then
  echo "[summary] Offline mode not allowed (use --offline-allowed to relax)" >&2
  RC=1
fi
if [[ ${SCENES_COUNT:-0} -le 0 ]]; then
  echo "[summary] No scenes recorded in summary" >&2
  RC=1
fi
if [[ ${MISSING_COUNT:-0} -gt 0 ]]; then
  echo "[summary] Missing scenes detected: $MISSING_COUNT" >&2
  RC=1
fi
if [[ ${FAIL_COUNT:-0} -gt 0 ]]; then
  echo "[summary] Validation failures: $FAIL_COUNT" >&2
  RC=1
fi
if [[ "$HATCH_STATUS" == "fail" || "$HATCH_STATUS" == "missing" ]]; then
  echo "[summary] Hatch dash CTest failed or missing: $HATCH_STATUS" >&2
  RC=1
fi
if [[ "$TEXT_ALIGN_PARTIAL_STATUS" == "fail" || "$TEXT_ALIGN_PARTIAL_STATUS" == "missing" ]]; then
  echo "[summary] Text align partial CTest failed or missing: $TEXT_ALIGN_PARTIAL_STATUS" >&2
  RC=1
fi
if [[ "$TEXT_ALIGN_EXT_STATUS" == "fail" || "$TEXT_ALIGN_EXT_STATUS" == "missing" ]]; then
  echo "[summary] Text align extended CTest failed or missing: $TEXT_ALIGN_EXT_STATUS" >&2
  RC=1
fi
if [[ "$HATCH_DENSE_STATUS" == "fail" || "$HATCH_DENSE_STATUS" == "missing" ]]; then
  echo "[summary] Hatch dense cap CTest failed or missing: $HATCH_DENSE_STATUS" >&2
  RC=1
fi
if [[ "$HATCH_LARGE_STATUS" == "fail" || "$HATCH_LARGE_STATUS" == "missing" ]]; then
  echo "[summary] Hatch large boundary budget CTest failed or missing: $HATCH_LARGE_STATUS" >&2
  RC=1
fi
if [[ "$NONFINITE_STATUS" == "fail" || "$NONFINITE_STATUS" == "missing" ]]; then
  echo "[summary] Nonfinite numbers CTest failed or missing: $NONFINITE_STATUS" >&2
  RC=1
fi
if [[ "$RUN_EDITOR_SMOKE_GATE" == "true" ]]; then
  if [[ "$EDITOR_SMOKE_STATUS" != "ok" ]]; then
    echo "[summary] Editor smoke gate status is not ok: $EDITOR_SMOKE_STATUS" >&2
    RC=1
  fi
  if [[ ${EDITOR_SMOKE_GATE_RUN_COUNT:-0} -lt ${EDITOR_SMOKE_GATE_RUNS_TARGET:-0} ]]; then
    echo "[summary] Editor smoke gate run count below target: $EDITOR_SMOKE_GATE_RUN_COUNT/$EDITOR_SMOKE_GATE_RUNS_TARGET" >&2
    RC=1
  fi
  if [[ ${EDITOR_SMOKE_GATE_FAIL_COUNT:-0} -gt 0 ]]; then
    echo "[summary] Editor smoke gate has failing runs: $EDITOR_SMOKE_GATE_FAIL_COUNT" >&2
    RC=1
    if [[ ${EDITOR_SMOKE_FAILURE_CODE_COUNT:-0} -le 0 ]]; then
      echo "[summary] Editor smoke gate failure attribution missing: failure_code_counts is empty" >&2
      RC=1
    fi
  fi
fi
if [[ "$RUN_EDITOR_UI_FLOW_SMOKE_GATE" == "true" ]]; then
  if [[ "$EDITOR_UI_FLOW_SMOKE_STATUS" != "ok" ]]; then
    echo "[summary] Editor UI flow smoke gate status is not ok: $EDITOR_UI_FLOW_SMOKE_STATUS" >&2
    RC=1
  fi
  if [[ ${EDITOR_UI_FLOW_SMOKE_GATE_RUN_COUNT:-0} -lt ${EDITOR_UI_FLOW_SMOKE_GATE_RUNS_TARGET:-0} ]]; then
    echo "[summary] Editor UI flow smoke gate run count below target: $EDITOR_UI_FLOW_SMOKE_GATE_RUN_COUNT/$EDITOR_UI_FLOW_SMOKE_GATE_RUNS_TARGET" >&2
    RC=1
  fi
  if [[ ${EDITOR_UI_FLOW_SMOKE_GATE_FAIL_COUNT:-0} -gt 0 ]]; then
    echo "[summary] Editor UI flow smoke gate has failing runs: $EDITOR_UI_FLOW_SMOKE_GATE_FAIL_COUNT" >&2
    RC=1
    if [[ ${EDITOR_UI_FLOW_FAILURE_CODE_COUNT:-0} -le 0 ]]; then
      echo "[summary] Editor UI flow smoke gate failure attribution missing: failure_code_counts is empty" >&2
      RC=1
    fi
    if [[ "$EDITOR_UI_FLOW_ATTR_COMPLETE" != "true" ]]; then
      echo "[summary] Editor UI flow smoke gate failure attribution incomplete" >&2
      RC=1
    fi
    if [[ ${EDITOR_UI_FLOW_OPEN_ATTEMPT_COUNT:-0} -le 0 ]]; then
      echo "[summary] Editor UI flow smoke gate missing open attempt telemetry: $EDITOR_UI_FLOW_OPEN_ATTEMPT_COUNT" >&2
      RC=1
    fi
  fi
  if [[ "$EDITOR_UI_FLOW_SMOKE_STATUS" == "ok" && "$EDITOR_UI_FLOW_INTERACTION_COMPLETE" != "true" ]]; then
    echo "[summary] Editor UI flow smoke interaction checks incomplete under gate" >&2
    RC=1
  fi
  if [[ ${EDITOR_UI_FLOW_SMOKE_OPEN_RETRIES:-0} -le 0 ]]; then
    echo "[summary] Editor UI flow smoke open retries missing/invalid: $EDITOR_UI_FLOW_SMOKE_OPEN_RETRIES" >&2
    RC=1
  fi
fi
if [[ "$RUN_EDITOR_GATE" == "true" && "$EDITOR_GATE_STATUS" == "ok" ]]; then
  if [[ "$EDITOR_GATE_STEP166_ENABLED" == "true" ]]; then
    if [[ ${EDITOR_GATE_BASELINE_COMPARED:-0} -le 0 ]]; then
      echo "[summary] Editor gate STEP166 baseline compare missing: compared=$EDITOR_GATE_BASELINE_COMPARED" >&2
      RC=1
    fi
    if [[ "$EDITOR_GATE_BASELINE_FILE_PRESENT" != "true" ]]; then
      echo "[summary] Editor gate STEP166 baseline file missing" >&2
      RC=1
    fi
    if [[ -z "$EDITOR_GATE_BASELINE_RUN_ID" ]]; then
      echo "[summary] Editor gate STEP166 baseline_run_id missing" >&2
      RC=1
    fi
    if [[ "$EDITOR_GATE_STEP166_GATE_WOULD_FAIL" == "true" ]]; then
      echo "[summary] Editor gate STEP166 gate_would_fail=true" >&2
      RC=1
    fi
  fi
fi
if [[ "$RUN_EDITOR_GATE" == "true" ]]; then
  if [[ -z "$EDITOR_GATE_RUNTIME_PROFILE" ]]; then
    echo "[summary] Editor gate runtime profile missing" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_RUNTIME_SOURCE" == "summary_missing" ]]; then
    echo "[summary] Editor gate runtime source invalid: $EDITOR_GATE_RUNTIME_SOURCE" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_RUNTIME_UI_FLOW_GATE" == "true" && ${EDITOR_GATE_UI_FLOW_OPEN_RETRIES:-0} -le 0 ]]; then
    echo "[summary] Editor gate ui-flow open retries missing/invalid while ui_flow_gate is enabled: $EDITOR_GATE_UI_FLOW_OPEN_RETRIES" >&2
    RC=1
  fi
fi
if [[ "$RUN_EDITOR_GATE" == "true" && "$EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND" == "true" ]]; then
  if [[ -z "$EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY_INPUT" ]]; then
    echo "[summary] Editor gate ui-flow stage trend policy missing" >&2
    RC=1
  fi
  if [[ ${EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS_INPUT:-0} -le 0 ]]; then
    echo "[summary] Editor gate ui-flow stage trend days invalid: $EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS_INPUT" >&2
    RC=1
  fi
  if [[ -z "$EDITOR_GATE_UI_FLOW_STAGE_TREND_STATUS" || "$EDITOR_GATE_UI_FLOW_STAGE_TREND_STATUS" == "unknown" ]]; then
    echo "[summary] Editor gate ui-flow stage trend status missing: $EDITOR_GATE_UI_FLOW_STAGE_TREND_STATUS" >&2
    RC=1
  fi
  case "$EDITOR_GATE_UI_FLOW_STAGE_TREND_RECOMMENDED" in
    observe|gate) ;;
    *)
      echo "[summary] Editor gate ui-flow stage trend recommended mode invalid: $EDITOR_GATE_UI_FLOW_STAGE_TREND_RECOMMENDED" >&2
      RC=1
      ;;
  esac
  case "$EDITOR_GATE_UI_FLOW_STAGE_TREND_EFFECTIVE" in
    observe|gate) ;;
    *)
      echo "[summary] Editor gate ui-flow stage trend effective mode invalid: $EDITOR_GATE_UI_FLOW_STAGE_TREND_EFFECTIVE" >&2
      RC=1
      ;;
  esac
  if [[ -z "$EDITOR_GATE_UI_FLOW_STAGE_TREND_SOURCE" ]]; then
    echo "[summary] Editor gate ui-flow stage trend source missing" >&2
    RC=1
  fi
fi
if [[ "$RUN_EDITOR_GATE" == "true" ]]; then
  case "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_INPUT" in
    observe|auto|gate) ;;
    *)
      echo "[summary] Editor gate ui-flow stage contract policy input invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_INPUT" >&2
      RC=1
      ;;
  esac
  case "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_EFFECTIVE" in
    observe|gate) ;;
    *)
      echo "[summary] Editor gate ui-flow stage contract effective policy invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_EFFECTIVE" >&2
      RC=1
      ;;
  esac
  case "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION" in
    pass|fail) ;;
    *)
      echo "[summary] Editor gate ui-flow stage contract decision invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION" >&2
      RC=1
      ;;
  esac
  if [[ -z "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_SOURCE" ]]; then
    echo "[summary] Editor gate ui-flow stage contract source missing" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_OK" != "true" && "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_OK" != "false" ]]; then
    echo "[summary] Editor gate ui-flow stage contract ok flag invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_OK" >&2
    RC=1
  fi
  if [[ ${EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUE_COUNT:-0} -lt 0 ]]; then
    echo "[summary] Editor gate ui-flow stage contract issue_count invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUE_COUNT" >&2
    RC=1
  fi
  case "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_MODE" in
    observe|gate) ;;
    *)
      echo "[summary] Editor gate ui-flow stage contract mode invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_MODE" >&2
      RC=1
      ;;
  esac
  if [[ ${EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DAYS:-0} -lt 0 ]]; then
    echo "[summary] Editor gate ui-flow stage contract days invalid: $EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DAYS" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION" == "pass" && ${EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC:-0} -ne 0 ]]; then
    echo "[summary] Editor gate ui-flow stage contract decision/rc mismatch: decision=pass rc=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION" == "fail" && ${EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC:-0} -eq 0 ]]; then
    echo "[summary] Editor gate ui-flow stage contract decision/rc mismatch: decision=fail rc=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC" >&2
    RC=1
  fi
  if [[ "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY_EFFECTIVE" == "gate" && "$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_DECISION" != "pass" ]]; then
    echo "[summary] Editor gate ui-flow stage contract failed under gate policy: rc=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_RC issues=$EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_ISSUES" >&2
    RC=1
  fi
fi
if [[ "$RUN_EDITOR_GATE" == "true" ]]; then
  if [[ ${EDITOR_GATE_EDITOR_SMOKE_FAIL_COUNT:-0} -gt 0 ]]; then
    if [[ "$EDITOR_GATE_EDITOR_SMOKE_ATTR_COMPLETE" != "true" ]]; then
      echo "[summary] Editor gate smoke attribution missing" >&2
      RC=1
    fi
    if [[ ${EDITOR_GATE_EDITOR_SMOKE_FAILURE_CODE_TOTAL:-0} -le 0 ]]; then
      echo "[summary] Editor gate smoke failure_code_total missing" >&2
      RC=1
    fi
  fi
  if [[ ${EDITOR_GATE_EDITOR_SMOKE_UNSUPPORTED_FAILED_CASES:-0} -gt 0 && ${EDITOR_GATE_EDITOR_SMOKE_FAIL_COUNT:-0} -le 0 ]]; then
    echo "[summary] Editor gate unsupported passthrough failed_cases > 0 but smoke fail_count is 0" >&2
    RC=1
  fi
  if [[ ${EDITOR_GATE_UI_FLOW_FAIL_COUNT:-0} -gt 0 ]]; then
    if [[ "$EDITOR_GATE_UI_FLOW_ATTR_COMPLETE" != "true" ]]; then
      echo "[summary] Editor gate ui-flow attribution missing" >&2
      RC=1
    fi
    if [[ ${EDITOR_GATE_UI_FLOW_FAILURE_CODE_TOTAL:-0} -le 0 ]]; then
      echo "[summary] Editor gate ui-flow failure_code_total missing" >&2
      RC=1
    fi
    if [[ ${EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_COUNT:-0} -le 0 ]]; then
      echo "[summary] Editor gate ui-flow missing open attempt telemetry: $EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_COUNT" >&2
      RC=1
    fi
  fi
fi
if [[ "$RUN_EDITOR_PARALLEL_CYCLE" == "true" ]]; then
  if [[ "$EDITOR_PARALLEL_CYCLE_STATUS" != "ok" ]]; then
    echo "[summary] Editor parallel cycle status is not ok: $EDITOR_PARALLEL_CYCLE_STATUS" >&2
    RC=1
  fi
  if [[ "$EDITOR_PARALLEL_CYCLE_GATE_WATCH_ESCALATED" == "true" && "$EDITOR_PARALLEL_CYCLE_GATE_DECISION" != "fail" ]]; then
    echo "[summary] Editor parallel cycle watch escalation inconsistent: decision=$EDITOR_PARALLEL_CYCLE_GATE_DECISION" >&2
    RC=1
  fi
  if [[ "$EDITOR_PARALLEL_CYCLE_GATE_DECISION" == "fail" || "$EDITOR_PARALLEL_CYCLE_GATE_DECISION" == "unknown" ]]; then
    echo "[summary] Editor parallel cycle gate decision is blocking: $EDITOR_PARALLEL_CYCLE_GATE_DECISION" >&2
    RC=1
  fi
  if [[ "$PARALLEL_LANE_A_RUNTIME_SOURCE" == "summary_missing" ]]; then
    echo "[summary] Editor parallel lane A runtime source invalid: $PARALLEL_LANE_A_RUNTIME_SOURCE" >&2
    RC=1
  fi
  if [[ "$EDITOR_PARALLEL_CYCLE_RUN_LANE_B" == "true" && "$EDITOR_PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW" == "true" && "$EDITOR_PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE" == "gate" ]]; then
    if [[ "$EDITOR_PARALLEL_CYCLE_LANE_B_UI_ENABLED" != "true" ]]; then
      echo "[summary] Editor parallel lane B ui-flow unexpectedly disabled" >&2
      RC=1
    fi
    if [[ "$EDITOR_PARALLEL_CYCLE_LANE_B_UI_ATTR_COMPLETE" != "true" ]]; then
      echo "[summary] Editor parallel lane B ui-flow attribution incomplete" >&2
      RC=1
    fi
    if [[ "$EDITOR_PARALLEL_CYCLE_LANE_B_UI_INTERACTION_COMPLETE" != "true" ]]; then
      echo "[summary] Editor parallel lane B ui-flow interaction checks incomplete" >&2
      RC=1
    fi
    if [[ ${EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_RETRIES:-0} -le 0 ]]; then
      echo "[summary] Editor parallel lane B ui-flow open retries missing/invalid: $EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_RETRIES" >&2
      RC=1
    fi
    if [[ "$EDITOR_PARALLEL_CYCLE_STATUS" != "ok" && ${EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_ATTEMPT_COUNT:-0} -le 0 ]]; then
      echo "[summary] Editor parallel lane B ui-flow missing open attempt telemetry on failure: $EDITOR_PARALLEL_CYCLE_LANE_B_UI_OPEN_ATTEMPT_COUNT" >&2
      RC=1
    fi
  fi
  if [[ "$PARALLEL_CYCLE_RUN_LANE_A" == "true" ]]; then
    if [[ "$PARALLEL_LANE_A_RUNTIME_SOURCE" == "lane_a_missing" ]]; then
      echo "[summary] Editor parallel lane A runtime missing while lane A is enabled" >&2
      RC=1
    fi
    if [[ "$PARALLEL_LANE_A_RUNTIME_PROFILE" == "n/a" ]]; then
      echo "[summary] Editor parallel lane A runtime profile invalid while lane A is enabled: $PARALLEL_LANE_A_RUNTIME_PROFILE" >&2
      RC=1
    fi
  fi
fi

if [[ $RC -ne 0 ]]; then
  exit 2
fi

echo "[summary] OK"
