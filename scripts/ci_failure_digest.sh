#!/usr/bin/env bash
set -euo pipefail

# CI Failure Digest
# Summarize recent failed runs for a workflow: last N failures and top failing jobs.
#
# Usage:
#   bash scripts/ci_failure_digest.sh --workflow "Core Strict - Build and Tests" \
#     [--limit 20] [--last 3] --markdown

WF=""
LIMIT=20
LAST=3
FORMAT="text"

usage(){
  cat <<USAGE
Usage: $0 --workflow <name> [--limit 20] [--last 3] [--markdown|--text]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow) WF="$2"; shift 2;;
    --limit) LIMIT="$2"; shift 2;;
    --last) LAST="$2"; shift 2;;
    --markdown) FORMAT="markdown"; shift;;
    --text) FORMAT="text"; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2;;
  esac
done

if [[ -z "$WF" ]]; then echo "--workflow required" >&2; exit 2; fi

# Fetch runs and filter failures
RUNS=$(gh run list --workflow "$WF" --limit "$LIMIT" --json databaseId,conclusion,htmlUrl 2>/dev/null || echo '[]')
FAILS=$(echo "$RUNS" | jq '[.[] | select(.conclusion=="failure")]')
COUNT=$(echo "$FAILS" | jq 'length')

# Collect last K failed run links
LINKS=()
if [[ "$COUNT" -gt 0 ]]; then
  for ((i=0; i<COUNT && i<LAST; i++)); do
    url=$(echo "$FAILS" | jq -r ".[$i].htmlUrl")
    id=$(echo "$FAILS" | jq -r ".[$i].databaseId")
    LINKS+=("#${id} — ${url}")
  done
fi

# Aggregate failing job names across failed runs
declare -A FREQ
for ((i=0; i<COUNT; i++)); do
  rid=$(echo "$FAILS" | jq -r ".[$i].databaseId")
  JOBS=$(gh run view "$rid" --json jobs 2>/dev/null | jq -r '.jobs[] | select(.conclusion!="success") | .name' || true)
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    FREQ["$name"]=$(( ${FREQ["$name"]:-0} + 1 ))
  done <<< "$JOBS"
done

# Top 2 by frequency
TOP=$(for k in "${!FREQ[@]}"; do echo -e "${FREQ[$k]}\t$k"; done | sort -rn | head -n 2 || true)

if [[ "$FORMAT" == "markdown" ]]; then
  echo "#### Recent Failures"
  if [[ ${#LINKS[@]} -gt 0 ]]; then
    for l in "${LINKS[@]}"; do echo "- ${l}"; done
  else
    echo "- None"
  fi
  echo ""
  echo "#### Top Failing Jobs"
  if [[ -n "$TOP" ]]; then
    while IFS=$'\t' read -r cnt name; do
      echo "- ${name} (${cnt})"
    done <<< "$TOP"
  else
    echo "- N/A"
  fi
else
  echo "Recent Failures:"
  for l in "${LINKS[@]}"; do echo "  * $l"; done
  echo "Top Failing Jobs:"
  echo "$TOP"
fi

