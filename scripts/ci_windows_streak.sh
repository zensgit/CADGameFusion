#!/usr/bin/env bash
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 2; }; }
need gh
need jq

# Fetch last 10 runs of Windows Nightly
json=$(gh run list --workflow "Windows Nightly - Strict Build Monitor" --limit 10 --json databaseId,conclusion,updatedAt,url 2>/dev/null || echo '[]')

streak=0
total=0
success=0
fail=0
while IFS= read -r line; do
  concl=$(echo "$line" | jq -r '.conclusion')
  (( total++ ))
  if [[ "$concl" == "success" ]]; then
    (( success++ ))
    if [[ $streak -eq $((total-1)) ]]; then
      (( streak++ ))
    fi
  elif [[ "$concl" == "failure" ]]; then
    (( fail++ ))
    streak=0
  fi
done < <(echo "$json" | jq -c '.[]')

echo "- Recent runs: $total (success=$success, failure=$fail)"
echo "- Current consecutive success streak: $streak"
