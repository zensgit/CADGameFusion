#!/bin/bash
# CI Quick Operations Script
# Usage: bash scripts/ci_quick_ops.sh <command> [options]

set -e

COMMAND=${1:-help}
shift || true

case "$COMMAND" in
  run-all)
    REPEAT=${1:-1}
    shift || true
    if [[ "$1" == "--repeat" ]]; then
      REPEAT=${2:-2}
    fi

    echo "=== Running all workflows $REPEAT times ==="
    for i in $(seq 1 $REPEAT); do
      echo "--- Round $i ---"
      gh workflow run "Core Strict - Build and Tests"
      gh workflow run "Core Strict - Exports, Validation, Comparison" --field use_vcpkg=true
      sleep 5
    done

    echo "=== Running Daily CI Status ==="
    sleep 10
    gh workflow run "Daily CI Status Report"
    echo "✅ All workflows triggered"
    ;;

  run-exports)
    CACHE_PROBE=""
    if [[ "$1" == "--cache-probe" ]]; then
      CACHE_PROBE="--field cache_probe=true"
      echo "=== Running exports with cache_probe=true ==="
    else
      echo "=== Running exports with default settings ==="
    fi

    gh workflow run "Core Strict - Exports, Validation, Comparison" --field use_vcpkg=true $CACHE_PROBE
    echo "✅ Exports workflow triggered"
    ;;

  run-builds)
    echo "=== Running build workflow ==="
    gh workflow run "Core Strict - Build and Tests"
    echo "✅ Build workflow triggered"
    ;;

  daily-ci)
    echo "=== Running Daily CI Status ==="
    gh workflow run "Daily CI Status Report"
    echo "✅ Daily CI triggered"
    ;;

  status)
    echo "=== Recent workflow runs ==="
    gh run list --limit 10 --json name,status,conclusion,databaseId | \
      jq -r '.[] | "\(.databaseId) \(.status) \(.conclusion) \(.name)"'
    ;;

  help|*)
    cat <<EOF2
CI Quick Operations Script

Usage: bash scripts/ci_quick_ops.sh <command> [options]

Commands:
  run-all [--repeat N]    Run all workflows N times (default: 1) and Daily CI
  run-exports [--cache-probe]  Run exports workflow with optional cache_probe
  run-builds              Run build workflow
  daily-ci                Run Daily CI Status Report
  status                  Show recent workflow runs
  help                    Show this help message

Examples:
  # Run all workflows twice and generate daily report
  bash scripts/ci_quick_ops.sh run-all --repeat 2

  # Test cache_probe functionality
  bash scripts/ci_quick_ops.sh run-exports --cache-probe
  bash scripts/ci_quick_ops.sh run-exports

  # Check status
  bash scripts/ci_quick_ops.sh status
EOF2
    ;;
esac
