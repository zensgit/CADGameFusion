#!/usr/bin/env bash
set -euo pipefail

# CI Quick Operations Script
# Trigger key workflows by filename, support repeat/debug/cache_probe, and optional wait.

WORKFLOW_EXPORTS_FILE="core-strict-exports-validation.yml"
WORKFLOW_BUILD_FILE="core-strict-build-tests.yml"
WORKFLOW_DAILY_FILE="daily-ci-status.yml"

REPEAT=1
DEBUG=false
PROBE=false
WAIT=true

usage() {
  cat <<USAGE
Usage: bash scripts/ci_quick_ops.sh <command> [options]

Commands:
  run-exports            Run \
    ${WORKFLOW_EXPORTS_FILE}
  run-build-tests        Run \
    ${WORKFLOW_BUILD_FILE}
  run-daily              Run \
    ${WORKFLOW_DAILY_FILE}
  run-all                Run exports + build-tests, then daily
  status                 Show recent runs (last 3 per workflow)

Options:
  --repeat N             Repeat workflow N times (default: 1)
  --debug                Set workflow input debug=true
  --cache-probe          Set workflow input cache_probe=true (zlib probe)
  --no-wait              Do not wait for completion
  -h, --help             Show this help

Notes:
  - Requires gh + jq; authenticate with gh auth login
  - Shorthand: numeric after command means --repeat N (e.g., run-all 2)
USAGE
}

need_bin() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 2; }; }

parse_args() {
  CMD=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      run-exports|run-build-tests|run-daily|run-all|status) CMD="$1"; shift;;
      --repeat) REPEAT="${2:-1}"; shift 2;;
      --debug) DEBUG=true; shift;;
      --cache-probe) PROBE=true; shift;;
      --no-wait) WAIT=false; shift;;
      -h|--help) usage; exit 0;;
      [0-9]) REPEAT="$1"; shift;;
      [1-9][0-9]*) REPEAT="$1"; shift;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2;;
    esac
  done
  [[ -n "$CMD" ]] || { usage; exit 2; }
}

trigger_and_wait() {
  local wf_file="$1"; shift
  echo "==> Trigger: $wf_file (debug=$DEBUG, cache_probe=$PROBE)"
  local inputs=("-f" "debug=${DEBUG}" "-f" "cache_probe=${PROBE}")
  gh workflow run "$wf_file" "${inputs[@]}" >/dev/null
  if [[ "$WAIT" != true ]]; then
    echo "(not waiting)"; return 0
  fi
  sleep 5
  local run_id
  run_id=$(gh run list --workflow "$wf_file" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
  if [[ -z "$run_id" || "$run_id" == "null" ]]; then
    echo "Could not determine run id for $wf_file" >&2; return 1
  fi
  echo "Waiting for run $run_id to complete..."
  local status="" conclusion=""
  while true; do
    read -r status conclusion < <(gh run view "$run_id" --json status,conclusion -q '.status+" " + (.conclusion//"")')
    echo "  status=$status conclusion=$conclusion"
    [[ "$status" == "completed" ]] && break
    sleep 10
  done
  [[ "$conclusion" == "success" ]] || { echo "Run $run_id concluded: $conclusion" >&2; return 1; }
  echo "Done: $wf_file ($run_id)"
}

main() {
  need_bin gh; need_bin jq
  parse_args "$@"
  case "$CMD" in
    run-exports)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_EXPORTS_FILE" || exit 1; done;;
    run-build-tests)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_BUILD_FILE" || exit 1; done;;
    run-daily)
      trigger_and_wait "$WORKFLOW_DAILY_FILE" || exit 1;;
    run-all)
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_EXPORTS_FILE" || exit 1; done
      for ((i=1; i<=REPEAT; i++)); do trigger_and_wait "$WORKFLOW_BUILD_FILE" || exit 1; done
      trigger_and_wait "$WORKFLOW_DAILY_FILE" || exit 1;;
    status)
      echo "== Recent runs (last 3) =="
      for wf in "$WORKFLOW_EXPORTS_FILE" "$WORKFLOW_BUILD_FILE" "$WORKFLOW_DAILY_FILE"; do
        echo "-- $wf --"
        gh run list --workflow "$wf" --limit 3 --json databaseId,displayTitle,status,conclusion,createdAt,durationMS \
          -q '.[] | "#"+(.databaseId|tostring)+" ["+(.status)+"/"+(.conclusion//"-")+"] "+(.displayTitle)+" ("+(.durationMS|tostring)+" ms) @ "+(.createdAt)'
      done;;
  esac
}

main "$@"
