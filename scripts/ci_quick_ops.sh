#!/usr/bin/env bash
set -euo pipefail

# CI Quick Ops
# Convenience wrapper around `gh workflow run` for common tasks.
# Requires: gh, jq

usage(){
  cat <<USAGE
Usage: $0 <command> [options]

Commands:
  run-daily [--sr N] [--p95 M] [--assignees u1,u2] [--team @org/team]
  run-weekly [--days N] [--archive]
  run-exports [--debug]
  run-build [--debug]
  run-all [--repeat K] [--debug]

Examples:
  $0 run-daily --assignees zensgit --team @org/ci
  $0 run-weekly --days 7 --archive
  $0 run-all --repeat 2 --debug
USAGE
}

need_gh(){
  if ! command -v gh >/dev/null 2>&1; then
    echo "error: gh CLI not found. Please install GitHub CLI." >&2
    exit 2
  fi
}

run_daily(){
  local sr="" p95="" asg="" team=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --sr) sr="$2"; shift 2;;
      --p95) p95="$2"; shift 2;;
      --assignees) asg="$2"; shift 2;;
      --team) team="$2"; shift 2;;
      -h|--help) usage; exit 0;;
      *) echo "unknown option: $1" >&2; usage; exit 2;;
    esac
  done
  need_gh
  local args=()
  [[ -n "$sr" ]] && args+=( -f sr_th="$sr" )
  [[ -n "$p95" ]] && args+=( -f p95_th="$p95" )
  [[ -n "$asg" ]] && args+=( -f assignees="$asg" )
  [[ -n "$team" ]] && args+=( -f team_mention="$team" )
  if [ ${#args[@]} -gt 0 ]; then
    gh workflow run "Daily CI Status Report" "${args[@]}"
  else
    gh workflow run "Daily CI Status Report"
  fi
}

run_weekly(){
  local days="" archive=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --days) days="$2"; shift 2;;
      --archive) archive=true; shift;;
      -h|--help) usage; exit 0;;
      *) echo "unknown option: $1" >&2; usage; exit 2;;
    esac
  done
  need_gh
  local args=()
  [[ -n "$days" ]] && args+=( -f days="$days" )
  $archive && args+=( -f archive_pr=true )
  if [ ${#args[@]} -gt 0 ]; then
    gh workflow run "Weekly CI Trend Digest" "${args[@]}"
  else
    gh workflow run "Weekly CI Trend Digest"
  fi
}

run_exports(){
  local debug=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --debug) debug=true; shift;;
      -h|--help) usage; exit 0;;
      *) echo "unknown option: $1" >&2; usage; exit 2;;
    esac
  done
  need_gh
  local args=()
  $debug && args+=( -f debug=true )
  if [ ${#args[@]} -gt 0 ]; then
    gh workflow run "Core Strict - Exports, Validation, Comparison" "${args[@]}"
  else
    gh workflow run "Core Strict - Exports, Validation, Comparison"
  fi
}

run_build(){
  local debug=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --debug) debug=true; shift;;
      -h|--help) usage; exit 0;;
      *) echo "unknown option: $1" >&2; usage; exit 2;;
    esac
  done
  need_gh
  local args=()
  $debug && args+=( -f debug=true )
  if [ ${#args[@]} -gt 0 ]; then
    gh workflow run "Core Strict - Build and Tests" "${args[@]}"
  else
    gh workflow run "Core Strict - Build and Tests"
  fi
}

run_all(){
  local repeat=1 debug=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repeat) repeat="$2"; shift 2;;
      --debug) debug=true; shift;;
      -h|--help) usage; exit 0;;
      *) echo "unknown option: $1" >&2; usage; exit 2;;
    esac
  done
  for ((i=1;i<=repeat;i++)); do
    echo "[run-all] iteration $i/$repeat"
    run_exports $($debug && echo --debug)
    run_build $($debug && echo --debug)
  done
}

main(){
  local cmd="${1:-}"; shift || true
  case "$cmd" in
    run-daily) run_daily "$@" ;;
    run-weekly) run_weekly "$@" ;;
    run-exports) run_exports "$@" ;;
    run-build) run_build "$@" ;;
    run-all) run_all "$@" ;;
    -h|--help|"") usage ;;
    *) echo "unknown command: $cmd" >&2; usage; exit 2 ;;
  esac
}

main "$@"
