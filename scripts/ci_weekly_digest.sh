#!/usr/bin/env bash
set -euo pipefail

# Weekly CI Trend Digest
# Aggregates 7-day trends for key workflows using ci_trend_summary.sh
#
# Usage:
#   bash scripts/ci_weekly_digest.sh --out WEEKLY_CI_TREND.md \
#     --workflows "Core Strict - Build and Tests" \
#                 "Core Strict - Exports, Validation, Comparison" \
#                 "Quick Check - Verification + Lint"
#
# Env thresholds (optional): SR_TH (default 85), P95_TH (default 6 minutes)

OUT="WEEKLY_CI_TREND.md"
WORKFLOWS=()
DAYS=7
SR_TH=${SR_TH:-85}
P95_TH=${P95_TH:-6}
CFG=.github/ci/config.json

usage(){
  cat <<USAGE
Usage: $0 --out FILE --workflows <w1> [<w2> ...] [--days 7]
USAGE
}

parse(){
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out) OUT="$2"; shift 2;;
      --workflows) shift; while [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; do WORKFLOWS+=("$1"); shift; done ;;
      --days) DAYS="$2"; shift 2;;
      -h|--help) usage; exit 0;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2;;
    esac
  done
}

emit_header(){
  {
    echo "# Weekly CI Trend Digest"
    echo
    echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "Window: last ${DAYS} days"
    echo
    echo "| Workflow | Runs | Success% | p50 | p95 | Avg | Alert |"
    echo "|----------|------|----------|-----|-----|-----|-------|"
  } > "$OUT"
}

emit_row(){
  local wf="$1"
  local json
  # Per-workflow thresholds
  local sr_eff="$SR_TH" p95_eff="$P95_TH"
  if [[ -f "$CFG" && -z "${SR_TH_IN:-}" && -z "${P95_TH_IN:-}" ]]; then
    local sr_cfg p95_cfg
    sr_cfg=$(jq -r --arg wf "$wf" '.thresholds.per_workflow[$wf].sr_th // empty' "$CFG" || echo '')
    p95_cfg=$(jq -r --arg wf "$wf" '.thresholds.per_workflow[$wf].p95_th // empty' "$CFG" || echo '')
    [[ -n "$sr_cfg" ]] && sr_eff="$sr_cfg"
    [[ -n "$p95_cfg" ]] && p95_eff="$p95_cfg"
  fi
  json=$(bash scripts/ci_trend_summary.sh --workflow "$wf" --days "$DAYS" --json || echo '{}')
  local total sr p50 p95 avg alert
  total=$(echo "$json" | jq -r '.total_runs // "N/A"')
  sr=$(echo "$json" | jq -r '.success_rate // "N/A"' | sed 's/%//')
  p50=$(echo "$json" | jq -r '.duration_p50_min // "N/A"')
  p95=$(echo "$json" | jq -r '.duration_p95_min // "N/A"')
  avg=$(echo "$json" | jq -r '.duration_avg_min // "N/A"')
  alert=""
  if [[ "$sr" != "N/A" && "$p95" != "N/A" ]]; then
    local sr_ok p95_ok p95n
    p95n=$(echo "$p95" | sed 's/[^0-9]//g')
    sr_ok=$(awk -v a="$sr" -v b="$sr_eff" 'BEGIN{print (a+0)>=b?"1":"0"}')
    p95_ok=$(awk -v a="$p95n" -v b="$p95_eff" 'BEGIN{print (a+0)<=b?"1":"0"}')
    if [[ "$sr_ok" == "0" || "$p95_ok" == "0" ]]; then
      alert="[!]"
    else
      alert="-"
    fi
  else
    alert="N/A"
  fi
  echo "| $wf | $total | ${sr}% | ${p50}m | ${p95}m | ${avg}m | $alert |" >> "$OUT"
}

main(){
  parse "$@"
  if [[ ${#WORKFLOWS[@]} -eq 0 ]]; then
    WORKFLOWS=(
      "Core Strict - Build and Tests"
      "Core Strict - Exports, Validation, Comparison"
      "Quick Check - Verification + Lint"
    )
  fi
  emit_header
  for wf in "${WORKFLOWS[@]}"; do emit_row "$wf"; done
}

main "$@"
