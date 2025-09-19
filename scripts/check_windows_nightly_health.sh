#!/usr/bin/env bash
set -euo pipefail

# Check recent results of the Windows nightly workflow and suggest when to
# flip WINDOWS_CONTINUE_ON_ERROR to 'false'.
#
# Requirements:
#   - GitHub CLI (gh) authenticated for this repo
#   - python3 available
#
# Usage:
#   ./scripts/check_windows_nightly_health.sh [--threshold 3] [--limit 10] \
#      [--workflow-name "Windows Nightly - Strict Build Monitor"] [--repo owner/repo]
#
# Exit codes:
#   0: threshold met or exceeded
#   1: threshold not met (keep non-blocking)
#   2: gh/inputs error

THRESHOLD=3
LIMIT=10
WORKFLOW_NAME="Windows Nightly - Strict Build Monitor"
REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold) THRESHOLD="$2"; shift 2;;
    --limit) LIMIT="$2"; shift 2;;
    --workflow-name) WORKFLOW_NAME="$2"; shift 2;;
    --repo) REPO="$2"; shift 2;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "[health] gh (GitHub CLI) not found. Install and authenticate first." >&2
  exit 2
fi

if [[ -z "$REPO" ]]; then
  # Derive from current directory
  if ! REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
    echo "[health] Unable to determine repo. Use --repo owner/repo." >&2
    exit 2
  fi
fi

echo "[health] Repo: $REPO"
echo "[health] Workflow: $WORKFLOW_NAME"
echo "[health] Threshold: $THRESHOLD (consecutive successes)"

JSON=$(gh run list -R "$REPO" -w "$WORKFLOW_NAME" --limit "$LIMIT" \
        --json conclusion,createdAt,workflowName,url 2>/dev/null || true)

if [[ -z "$JSON" ]]; then
  echo "[health] No runs found or API error." >&2
  exit 2
fi

python3 - "$THRESHOLD" << 'PY'
import json, sys

data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else []
thr = int(sys.argv[1])

def summarize(runs):
    lines = []
    for r in runs:
        lines.append(f"- {r.get('createdAt','?')} | {r.get('conclusion','?')} | {r.get('url','')}")
    return "\n".join(lines)

consec = 0
for r in data:
    if r.get('conclusion') == 'success':
        consec += 1
    else:
        break

print(f"[health] Consecutive successes: {consec}")
print("[health] Recent runs:\n" + summarize(data))

if consec >= thr:
    print("[health] Threshold met: You can set WINDOWS_CONTINUE_ON_ERROR='false' in core-strict-build-tests.yml.")
    sys.exit(0)
else:
    print("[health] Threshold NOT met: Keep non-blocking for Windows strict build.")
    sys.exit(1)
PY

