#!/usr/bin/env bash
set -euo pipefail

# CADGameFusion - Strict validation quick checker
#
# Purpose:
#   Lightweight local gate after running tools/local_ci.sh.
#   Verifies field-level reports, consistency stats, and basic scene presence
#   without re-running the full pipeline.
#
# Usage:
#   bash scripts/check_verification.sh [--root build] [--verbose]
#
# Exit codes:
#   0 = all checks passed
#   1 = missing required files (exports dir, field_*.json, consistency_stats.txt)
#   2 = field_* status failure (not "passed" or "ok")
#   3 = consistency stats anomalies (missing expected scenes)
#   4 = unexpected JSON structure (NaN values, malformed data)
#
# Features:
#   - Checks field_*.json status is "passed" or "ok"
#   - Verifies 8 expected scenes in consistency_stats.txt
#   - Lightweight structural validation (NaN detection)
#   - Clear exit codes for different failure types
#   - Suitable for pre-push hooks

ROOT_DIR="build"
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT_DIR="$2"; shift 2;;
    --verbose|-v)
      VERBOSE=true; shift;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

EXPORTS_DIR="$ROOT_DIR/exports"
STATS_FILE="$ROOT_DIR/consistency_stats.txt"
FIELD_GLOB="$ROOT_DIR/field_*.json"

echo "[check] Root: $ROOT_DIR"

fail() { echo "[FAIL] $1" >&2; exit "$2"; }
note() { echo "[info] $1"; }

# 1. Basic presence
if [ ! -d "$EXPORTS_DIR" ]; then
  fail "Exports directory not found: $EXPORTS_DIR (run tools/local_ci.sh first)" 1
fi

shopt -s nullglob
FIELD_FILES=($FIELD_GLOB)
shopt -u nullglob
if [ ${#FIELD_FILES[@]} -eq 0 ]; then
  fail "No field_*.json files found under $ROOT_DIR (did strict export run?)" 1
fi
note "Found ${#FIELD_FILES[@]} field report(s)."

# 2. Field-level status check
FIELD_FAIL=0
PASSED_COUNT=0
for f in "${FIELD_FILES[@]}"; do
  filename=$(basename "$f")
  # Accept status : passed / ok
  if grep -q '"status"' "$f"; then
    if grep -E '"status"\s*:\s*"(passed|ok)"' "$f" >/dev/null; then
      PASSED_COUNT=$((PASSED_COUNT + 1))
      if [ "$VERBOSE" = true ]; then
        echo "[pass-field] $filename: status OK" >&2
      fi
    else
      echo "[fail-field] $filename: unexpected status (not 'passed' or 'ok')" >&2
      if [ "$VERBOSE" = true ]; then
        echo "  Content: $(grep '"status"' "$f")" >&2
      fi
      FIELD_FAIL=1
    fi
  else
    echo "[fail-field] $filename: missing status key" >&2
    FIELD_FAIL=1
  fi
done
if [ $FIELD_FAIL -ne 0 ]; then
  fail "Field validation failed: $FIELD_FAIL failures, $PASSED_COUNT passed" 2
fi
note "Field validation: $PASSED_COUNT/$((${#FIELD_FILES[@]})) status entries passed."

# 3. Consistency stats sanity
if [ ! -f "$STATS_FILE" ]; then
  fail "Missing stats file: $STATS_FILE" 1
fi

EXPECTED_SCENES=(sample holes multi units complex complex_spec concave_spec nested_holes_spec)
MISSING=()
for s in "${EXPECTED_SCENES[@]}"; do
  if ! grep -q "scene_cli_${s}" "$STATS_FILE"; then
    MISSING+=("$s")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  fail "Missing scenes in stats: ${MISSING[*]} (expected 8 total)" 3
fi

# Check for scenes with ok=NO
OK_COUNT=$(grep -c "ok=YES" "$STATS_FILE" || echo "0")
NO_COUNT=$(grep -c "ok=NO" "$STATS_FILE" || echo "0")
if [ "$NO_COUNT" -gt 0 ]; then
  echo "[warn] Found $NO_COUNT scenes with ok=NO in consistency stats" >&2
  if [ "$VERBOSE" = true ]; then
    grep "ok=NO" "$STATS_FILE" >&2
  fi
fi
note "Consistency stats: $OK_COUNT scenes OK, $NO_COUNT failed, ${#EXPECTED_SCENES[@]} expected scenes present."

# 4. Lightweight JSON structural spot check (first field file only)
STRUCT_FILE=${FIELD_FILES[0]}
if ! grep -q '"values"' "$STRUCT_FILE"; then
  note "No 'values' key in $STRUCT_FILE (acceptable if schema changed), skipping heuristic."
else
  if grep -q 'NaN' "$STRUCT_FILE"; then
    fail "Detected NaN in $STRUCT_FILE" 4
  fi
fi

echo "[PASS] Strict validation quick checks OK."
exit 0
