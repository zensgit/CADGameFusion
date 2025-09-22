#!/usr/bin/env bash
set -euo pipefail

# CI Trend Summary (7-day rolling trends)
#
# Usage:
#   bash scripts/ci_trend_summary.sh --workflow "Core Strict - Build and Tests" \
#       [--days 7] [--markdown]
#
# Requires: gh, jq, python3

WORKFLOW=""
DAYS=7
MARKDOWN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow) WORKFLOW="$2"; shift 2;;
    --days) DAYS="$2"; shift 2;;
    --markdown) MARKDOWN=true; shift;;
    -h|--help)
      sed -n '1,80p' "$0" | sed 's/^# //;t;d'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 2; }; }
need gh
need jq
need python3

if [[ -z "$WORKFLOW" ]]; then
  echo "--workflow is required" >&2
  exit 2
fi

# Fetch runs in the last N days
since=$(date -u -v-"${DAYS}"d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || python3 - <<PY
import datetime
print((datetime.datetime.utcnow()-datetime.timedelta(days=int("$DAYS"))).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
)

runs=$(gh run list --workflow "$WORKFLOW" --limit 100 --json conclusion,createdAt,updatedAt 2>/dev/null | \
  jq --arg since "$since" '[.[] | select(.createdAt >= $since)]')

python3 - <<PY "$WORKFLOW" "$DAYS" "$MARKDOWN" <<<"$runs"
import sys, json, datetime, statistics
wf = sys.argv[1]
days = int(sys.argv[2])
md = sys.argv[3].lower()=='true'
runs = json.load(sys.stdin)

# group by day (UTC)
by_day = {}
for r in runs:
    if r.get('conclusion') != 'success':
        continue
    c = r['createdAt']
    u = r['updatedAt']
    dtc = datetime.datetime.fromisoformat(c.replace('Z','+00:00'))
    dtu = datetime.datetime.fromisoformat(u.replace('Z','+00:00'))
    dkey = dtc.date().isoformat()
    dur = (dtu - dtc).total_seconds()/60.0
    by_day.setdefault(dkey, []).append(dur)

days_sorted = sorted(by_day.keys())[-days:]

def pctl(a,p):
    if not a:
        return 0.0
    a=sorted(a)
    k=max(1, int(round(p*len(a))))-1
    return a[k]

rows=[]
for d in days_sorted:
    arr = by_day[d]
    rows.append((d, len(arr), statistics.mean(arr) if arr else 0.0, pctl(arr,0.5), pctl(arr,0.95)))

if md:
    print(f"### 7-Day Trend — {wf}")
    print("| Date (UTC) | Count | p50 (m) | p95 (m) | Avg (m) |")
    print("|------------|-------|---------|---------|---------|")
    for d,c,avg,p50,p95 in rows:
        print(f"| {d} | {c} | {p50:.1f} | {p95:.1f} | {avg:.1f} |")
else:
    print({"workflow": wf, "days": rows})
PY

