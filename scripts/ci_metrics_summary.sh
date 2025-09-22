#!/usr/bin/env bash
set -euo pipefail

# CI Metrics Summary
# Fetch recent workflow runs and compute basic stats (count, success %, p50, p95, avg durations in minutes).
#
# Usage:
#   bash scripts/ci_metrics_summary.sh --workflow "Core Strict - Build and Tests" [--limit 10] [--markdown-row]
#
# Requires: gh, jq

WORKFLOW=""
LIMIT=10
MARKDOWN_ROW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow) WORKFLOW="$2"; shift 2;;
    --limit) LIMIT="$2"; shift 2;;
    --markdown-row) MARKDOWN_ROW=true; shift;;
    -h|--help)
      sed -n '1,80p' "$0" | sed 's/^# //;t;d'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 2; }; }
need gh
need jq

if [[ -z "$WORKFLOW" ]]; then
  echo "--workflow is required" >&2
  exit 2
fi

# Fetch last N runs for the workflow
json=$(gh run list --workflow "$WORKFLOW" --limit "$LIMIT" --json conclusion,createdAt,updatedAt 2>/dev/null || echo '[]')

total=$(echo "$json" | jq 'length')
success=$(echo "$json" | jq '[.[] | select(.conclusion == "success")] | length')
succ_pct=0
if [[ "$total" -gt 0 ]]; then
  succ_pct=$(( success * 100 / total ))
fi

# Durations (minutes) for successful runs
dur_json=$(echo "$json" | jq '[.[] | select(.conclusion == "success") | (((.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)) / 60.0)]')
count=$(echo "$dur_json" | jq 'length')
avg=$(echo "$dur_json" | jq 'if length>0 then (add/length) else 0 end')
sorted=$(echo "$dur_json" | jq 'sort')

percentile() { # args: json_array p (e.g., 0.5 or 0.95)
  local arr="$1" p="$2"
  local n idx
  n=$(echo "$arr" | jq 'length')
  if [[ "$n" -eq 0 ]]; then echo 0; return; fi
  # nearest-rank method
  idx=$(python3 - <<PY
import math,sys,json
arr=json.load(sys.stdin)
p=float(sys.argv[1])
n=len(arr)
rank=max(1, math.ceil(p*n))
print(arr[rank-1])
PY
 "$p" <<<"$arr")
  echo "$idx"
}

p50=$(percentile "$sorted" 0.5)
p95=$(percentile "$sorted" 0.95)

# Round to 1 decimal
round1() { python3 - <<PY "$1";PY
import sys
try:
  v=float(sys.argv[1])
  print(f"{v:.1f}")
except:
  print("0.0")
PY
}

p50m=$(round1 "$p50")
p95m=$(round1 "$p95")
avgm=$(round1 "$avg")

if $MARKDOWN_ROW; then
  echo "| ${WORKFLOW} | ${total} | ${succ_pct}% | ${p50m}m | ${p95m}m | ${avgm}m |"
else
  cat <<OUT
Workflow: ${WORKFLOW}
Runs: ${total} (success ${success}, ${succ_pct}%)
Durations (successful): p50=${p50m}m, p95=${p95m}m, avg=${avgm}m
OUT
fi

