#!/bin/bash
# CI 7-Day Trend Summary Script
# Generates trend statistics for workflows over the past 7 days

set -euo pipefail

# Parse arguments
WORKFLOW=""
DAYS=7
OUTPUT_FORMAT="text"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow)
      WORKFLOW="$2"
      shift 2
      ;;
    --days)
      DAYS="$2"
      shift 2
      ;;
    --markdown)
      OUTPUT_FORMAT="markdown"
      shift
      ;;
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
    *)
      echo "Usage: $0 --workflow <name> [--days N] [--markdown|--json]"
      exit 1
      ;;
  esac
done

if [ -z "$WORKFLOW" ]; then
  echo "Error: --workflow is required"
  exit 1
fi

# Fetch workflow runs for the past N days
SINCE=$(date -u -v-${DAYS}d '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date -u -d "${DAYS} days ago" '+%Y-%m-%dT%H:%M:%S')

# Get runs data
RUNS_JSON=$(gh run list --workflow "$WORKFLOW" --limit 100 --json databaseId,conclusion,status,createdAt,startedAt,updatedAt 2>/dev/null || echo "[]")

# Filter runs from the past N days
FILTERED_RUNS=$(echo "$RUNS_JSON" | jq --arg since "$SINCE" '[.[] | select(.createdAt >= $since)]')

# Calculate statistics
TOTAL=$(echo "$FILTERED_RUNS" | jq 'length')
SUCCESS=$(echo "$FILTERED_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
FAILURE=$(echo "$FILTERED_RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')
CANCELLED=$(echo "$FILTERED_RUNS" | jq '[.[] | select(.conclusion == "cancelled")] | length')

# Calculate success rate
if [ "$TOTAL" -gt 0 ]; then
  SUCCESS_RATE=$(echo "scale=1; $SUCCESS * 100 / $TOTAL" | bc)
else
  SUCCESS_RATE="N/A"
fi

# Calculate duration statistics (in minutes)
DURATIONS=$(echo "$FILTERED_RUNS" | jq -r '.[] | select(.conclusion == "success" and .startedAt != null and .updatedAt != null) |
  (((.updatedAt | fromdateiso8601) - (.startedAt | fromdateiso8601)) / 60 | floor)')

if [ -n "$DURATIONS" ] && [ "$(echo "$DURATIONS" | wc -l | tr -d ' ')" -gt 0 ]; then
  # Sort durations for percentile calculation
  SORTED_DURATIONS=$(echo "$DURATIONS" | sort -n)
  COUNT=$(echo "$SORTED_DURATIONS" | wc -l | tr -d ' ')

  # Calculate p50 (median)
  P50_INDEX=$(echo "($COUNT + 1) / 2" | bc)
  P50=$(echo "$SORTED_DURATIONS" | sed -n "${P50_INDEX}p")

  # Calculate p95
  P95_INDEX=$(echo "($COUNT * 95 + 50) / 100" | bc)
  P95=$(echo "$SORTED_DURATIONS" | sed -n "${P95_INDEX}p")

  # Calculate average
  AVG=$(echo "$DURATIONS" | awk '{sum+=$1} END {printf "%.0f", sum/NR}')
else
  P50="N/A"
  P95="N/A"
  AVG="N/A"
fi

# Output based on format
case "$OUTPUT_FORMAT" in
  json)
    cat <<JSON
{
  "workflow": "$WORKFLOW",
  "period_days": $DAYS,
  "total_runs": $TOTAL,
  "success": $SUCCESS,
  "failure": $FAILURE,
  "cancelled": $CANCELLED,
  "success_rate": "$SUCCESS_RATE%",
  "duration_p50_min": "$P50",
  "duration_p95_min": "$P95",
  "duration_avg_min": "$AVG"
}
JSON
    ;;
  markdown)
    echo "| $WORKFLOW | $TOTAL | ${SUCCESS_RATE}% | ${P50}m | ${P95}m | ${AVG}m |"
    ;;
  text|*)
    echo "=== 7-Day Trend: $WORKFLOW ==="
    echo "Total runs: $TOTAL"
    echo "Success: $SUCCESS, Failure: $FAILURE, Cancelled: $CANCELLED"
    echo "Success rate: ${SUCCESS_RATE}%"
    echo "Duration (minutes) - p50: $P50, p95: $P95, avg: $AVG"
    ;;
esac