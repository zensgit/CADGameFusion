#!/usr/bin/env bash
set -euo pipefail

# Quick helpers to trigger CI workflows and optionally wait for completion.
# Requires: gh, jq
#
# Examples:
#   bash scripts/ci_quick_ops.sh run-exports --repeat 2
#   bash scripts/ci_quick_ops.sh run-build-tests --repeat 2
#   bash scripts/ci_quick_ops.sh run-exports --debug --cache-probe
#   bash scripts/ci_quick_ops.sh run-daily
#   bash scripts/ci_quick_ops.sh run-all --repeat 2

WORKFLOW_EXPORTS="Core Strict - Exports, Validation, Comparison"
WORKFLOW_BUILD="Core Strict - Build and Tests"
WORKFLOW_DAILY="Daily CI Status Report"

REPEAT=1
DEBUG=false
PROBE=false
WAIT=true

usage() {
  cat <<USAGE
Usage: $0 <command> [options]

Commands:
  run-exports       Run "${WORKFLOW_EXPORTS}"
  run-build-tests   Run "${WORKFLOW_BUILD}"
  run-daily         Run "${WORKFLOW_DAILY}"
  run-all           Run exports + build-tests, then daily

Options:
  --repeat N        Repeat workflow N times (default: 1)
  --debug           Set workflow input debug=true
  --cache-probe     Set workflow input cache_probe=true (install zlib once)
  --no-wait         Do not wait for completion
  -h, --help        Show this help

Notes:
  - Requires GitHub CLI (gh) authenticated with repo scope.
  - For matrix workflows (build-tests), this triggers the default matrix.
USAGE
}

need_bin() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1 in PATH" >&2; exit 2; }; }

parse_args() {
  CMD=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      run-exports|run-build-tests|run-daily|run-all) CMD="$1"; shift;;
      --repeat) REPEAT="${2:-1}"; shift 2;;
      --debug) DEBUG=true; shift;;
      --cache-probe) PROBE=true; shift;;
      --no-wait) WAIT=false; shift;;
      -h|--help) usage; exit 0;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2;;
    esac
  done
  [[ -n "$CMD" ]] || { usage; exit 2; }
}

trigger_and_wait() {
  local wf="$1"; shift
  local extra_inputs=("$@")
  echo "==> Trigger: $wf (debug=$DEBUG, cache_probe=$PROBE)"
  local inputs=("-f" "debug=${DEBUG}")
  # Only pass cache_probe if the workflow supports it (safe to pass anyway; unknown inputs are ignored)
  inputs+=("-f" "cache_probe=${PROBE}")
  gh workflow run "$wf" "${inputs[@]}" >/dev/null
  if [[ "$WAIT" != true ]]; then
    echo "(not waiting)"
    return 0
  fi
  # Poll for the most recent run of this workflow
  sleep 5
  local run_id
  run_id=$(gh run list --workflow "$wf" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
  if [[ -z "$run_id" || "$run_id" == "null" ]]; then
    echo "Could not determine run id for $wf" >&2
    return 1
  fi
  echo "Waiting for run $run_id to complete..."
  local status=""
  local conclusion=""
  while true; do
    read -r status conclusion < <(gh run view "$run_id" --json status,conclusion -q '.status+" " + (.conclusion//"")')
    echo "  status=$status conclusion=$conclusion"
    [[ "$status" == "completed" ]] && break
    sleep 10
  done
  [[ "$conclusion" == "success" ]] || { echo "Run $run_id concluded: $conclusion" >&2; return 1; }
  echo "Done: $wf ($run_id)"
}

main() {
  need_bin gh; need_bin jq
  parse_args "$@"
  case "$CMD" in
    run-exports)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_EXPORTS" || exit 1; done
      ;;
    run-build-tests)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_BUILD" || exit 1; done
      ;;
    run-daily)
      trigger_and_wait "$WORKFLOW_DAILY" || exit 1
      ;;
    run-all)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_EXPORTS" || exit 1; done
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_BUILD" || exit 1; done
      trigger_and_wait "$WORKFLOW_DAILY" || exit 1
      ;;
  esac
}

main "$@"

