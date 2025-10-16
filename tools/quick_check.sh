#!/usr/bin/env bash
set -euo pipefail

# One-command health check wrapper around tools/local_ci.sh and tools/check_local_summary.sh
#
# Usage:
#   bash tools/quick_check.sh [--strict] [--scenes a,b] [--no-clean]
#
# Default behavior:
#   - Offline quick subset (--quick --offline)
#   - Clean exports before run
#   - Write summary JSON and run health check (allow offline)

STRICT=false
SCENES=""
CLEAN_EXPORTS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=true; shift;;
    --scenes) SCENES="$2"; shift 2;;
    --no-clean) CLEAN_EXPORTS=false; shift;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

LCI_ARGS=(--quick --summary-json)
if [[ -n "$SCENES" ]]; then LCI_ARGS+=(--scenes "$SCENES"); fi
if [[ "$CLEAN_EXPORTS" == true ]]; then LCI_ARGS+=(--clean-exports); fi

if [[ "$STRICT" == true ]]; then
  echo "[quick_check] Strict quick subset"
  bash tools/local_ci.sh "${LCI_ARGS[@]}" --strict-exit
  bash tools/check_local_summary.sh
else
  echo "[quick_check] Offline quick subset"
  bash tools/local_ci.sh "${LCI_ARGS[@]}" --offline
  bash tools/check_local_summary.sh --offline-allowed
fi

echo "[quick_check] Done"

