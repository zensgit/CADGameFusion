#!/usr/bin/env bash
set -euo pipefail

# vcpkg log statistics
# Parse logs and estimate cache hit/miss by counting common phrases.
#
# Usage:
#   bash scripts/vcpkg_log_stats.sh \
#     --logs build/_cmake_configure.log build/_cmake_build.log \
#     --out-json build/vcpkg_cache_stats.json \
#     --out-md build/vcpkg_cache_stats.md

OUT_JSON=""
OUT_MD=""
LOGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-json) OUT_JSON="$2"; shift 2;;
    --out-md) OUT_MD="$2"; shift 2;;
    --logs) shift; while [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; do LOGS+=("$1"); shift; done ;;
    -h|--help)
      sed -n '1,60p' "$0" | sed 's/^# //;t;d'; exit 0;;
    *) LOGS+=("$1"); shift;;
  esac
done

if [[ ${#LOGS[@]} -eq 0 ]]; then
  echo "No logs provided" >&2; exit 2
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat "${LOGS[@]}" > "$tmp" || true

lc() { grep -E -i "$1" "$tmp" | wc -l | tr -d ' ' || true; }

# Heuristics for vcpkg
count_install=$(lc "(^| )Installing |(^| )Building package|Computing installation plan")
count_restored=$(lc "Restored|Using cached|package already installed|binary cached")

total=$((count_install + count_restored))
hit_rate=0
cacheable=true
if [[ $total -gt 0 ]]; then
  hit_rate=$(python3 - <<PY $count_restored $total
import sys
r=float(sys.argv[1]); t=float(sys.argv[2])
print(f"{(r/t)*100:.1f}")
PY
)
else
  cacheable=false
fi

json_out=$(cat <<JSON
{
  "installing": $count_install,
  "restored": $count_restored,
  "total_signals": $total,
  "hit_rate": $hit_rate,
  "cacheable": $cacheable
}
JSON
)

if [[ -n "$OUT_JSON" ]]; then
  mkdir -p "$(dirname "$OUT_JSON")"
  echo "$json_out" > "$OUT_JSON"
fi

if [[ -n "$OUT_MD" ]]; then
  mkdir -p "$(dirname "$OUT_MD")"
  {
    echo "### vcpkg Cache Stats"
    echo
    echo "- Installing signals: $count_install"
    echo "- Restored/cached signals: $count_restored"
    echo "- Hit rate: ${hit_rate}%"
  } > "$OUT_MD"
fi

echo "$json_out"
