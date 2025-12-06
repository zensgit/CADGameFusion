#!/usr/bin/env bash
set -euo pipefail

# Validate build/local_ci_summary.json produced by tools/local_ci.sh
#
# Usage:
#   bash tools/check_local_summary.sh [--offline-allowed]
#
# Behavior:
#   - Fails if summary JSON missing or malformed
#   - Fails if any validationFailCount > 0 or missingScenes not empty
#   - Fails if no scenes recorded
#   - By default requires offline=false; with --offline-allowed, accepts either

OFFLINE_ALLOWED=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --offline-allowed) OFFLINE_ALLOWED=true; shift;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

SUM_JSON="build/local_ci_summary.json"
[[ -f "$SUM_JSON" ]] || { echo "[summary] Missing $SUM_JSON" >&2; exit 2; }

# Extract fields via Python (avoid jq dependency)
read -r OFFLINE SCENES_COUNT MISSING_COUNT FAIL_COUNT SKIP_COMPARE <<EOF
$(python3 - "$SUM_JSON" <<'PY'
import json, sys
p = sys.argv[1]
try:
    with open(p, 'r', encoding='utf-8') as f:
        j = json.load(f)
except Exception as e:
    print("ERR", 0, 0, 0, "false")
    sys.exit(0)
def b(v):
    return 'true' if bool(v) else 'false'
offline = b(j.get('offline', False))
scenes = j.get('scenes', []) or []
missing = j.get('missingScenes', []) or []
fails = int(j.get('validationFailCount', 0) or 0)
skipc = b(j.get('skipCompare', False))
print(offline, len(scenes), len(missing), fails, skipc)
PY
)
EOF

if [[ "$OFFLINE" == "ERR" ]]; then
  echo "[summary] Malformed JSON: $SUM_JSON" >&2
  exit 2
fi

echo "[summary] offline=$OFFLINE scenes=$SCENES_COUNT missing=$MISSING_COUNT fails=$FAIL_COUNT skipCompare=$SKIP_COMPARE"

RC=0
if [[ "$OFFLINE_ALLOWED" == false && "$OFFLINE" == "true" ]]; then
  echo "[summary] Offline mode not allowed (use --offline-allowed to relax)" >&2
  RC=1
fi
if [[ ${SCENES_COUNT:-0} -le 0 ]]; then
  echo "[summary] No scenes recorded in summary" >&2
  RC=1
fi
if [[ ${MISSING_COUNT:-0} -gt 0 ]]; then
  echo "[summary] Missing scenes detected: $MISSING_COUNT" >&2
  RC=1
fi
if [[ ${FAIL_COUNT:-0} -gt 0 ]]; then
  echo "[summary] Validation failures: $FAIL_COUNT" >&2
  RC=1
fi

if [[ $RC -ne 0 ]]; then
  exit 2
fi

echo "[summary] OK"
