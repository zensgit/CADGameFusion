#!/usr/bin/env bash
set -euo pipefail

# Opinionated wrapper for day-to-day validation.
# Defaults are chosen to keep signal high while keeping runtime reasonable.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

: "${STEP176_APPEND_REPORT:=1}"
: "${STEP176_REPORT:=docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md}"

# Daily default: run the full one-button gate but keep perf sampling lightweight.
: "${RUN_GATE:=1}"

# Default-on: keep the UI wiring guardrail active for daily checks.
: "${RUN_EDITOR_UI_FLOW_SMOKE:=1}"
: "${EDITOR_UI_FLOW_MODE:=gate}"

# Keep STEP166 parallelism sane on dev machines.
: "${CAD_MAX_WORKERS:=2}"
: "${GATE_CAD_ATTEMPTS:=3}"

export STEP176_APPEND_REPORT STEP176_REPORT RUN_GATE RUN_EDITOR_UI_FLOW_SMOKE EDITOR_UI_FLOW_MODE CAD_MAX_WORKERS GATE_CAD_ATTEMPTS

exec bash tools/editor_weekly_validation.sh
