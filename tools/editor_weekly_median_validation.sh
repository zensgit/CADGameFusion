#!/usr/bin/env bash
set -euo pipefail

# Opinionated wrapper for weekly "stable sampling" runs.
# Uses repeat=3 to produce batch-median perf summaries (selection_mode=batch_only),
# which is required before auto-gate can enable perf trend gates.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

: "${STEP176_APPEND_REPORT:=1}"
: "${STEP176_REPORT:=docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md}"

: "${PERF_REPEAT:=3}"
: "${PERF_INTERVAL_SEC:=1}"
: "${REAL_SCENE_REPEAT:=3}"
: "${REAL_SCENE_INTERVAL_SEC:=1}"

: "${RUN_GATE:=1}"
: "${CAD_MAX_WORKERS:=2}"
: "${GATE_CAD_ATTEMPTS:=3}"

export STEP176_APPEND_REPORT STEP176_REPORT
export PERF_REPEAT PERF_INTERVAL_SEC REAL_SCENE_REPEAT REAL_SCENE_INTERVAL_SEC
export RUN_GATE CAD_MAX_WORKERS GATE_CAD_ATTEMPTS

exec bash tools/editor_weekly_validation.sh

