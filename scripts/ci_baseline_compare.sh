#!/bin/bash
# CI Baseline Comparison Script
# Compares current CI metrics with baseline from ci-baseline-2025-09-21

set -euo pipefail

# Configuration
BASELINE_TAG="ci-baseline-2025-09-21"
DAYS_TO_ANALYZE=7
OUTPUT_FORMAT="${1:-markdown}"  # markdown or json

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get workflow metrics
get_workflow_metrics() {
    local workflow="$1"
    local days="${2:-7}"

    # Get runs from last N days
    local runs_json=$(gh run list --workflow "$workflow" --limit 100 --json databaseId,conclusion,createdAt,runStartedAt,updatedAt 2>/dev/null || echo "[]")

    if [ "$runs_json" = "[]" ]; then
        echo '{"runs":0,"success_rate":0,"p50":0,"p95":0,"avg":0}'
        return
    fi

    # Calculate metrics using jq
    echo "$runs_json" | jq -r --arg days "$days" '
        def duration_minutes:
            ((.updatedAt | fromdateiso8601) - (.runStartedAt | fromdateiso8601)) / 60 | floor;

        # Filter to last N days
        map(select(
            (.createdAt | fromdateiso8601) > (now - ($days | tonumber * 86400))
        )) |

        # Calculate metrics
        {
            runs: length,
            success_rate: (map(select(.conclusion == "success")) | length * 100 / length) // 0,
            durations: map(duration_minutes) | sort,
        } |

        # Add percentiles
        .p50 = (.durations[(.durations | length / 2) | floor] // 0) |
        .p95 = (.durations[(.durations | length * 0.95) | floor] // 0) |
        .avg = ((.durations | add) / (.durations | length) // 0) |
        del(.durations)
    '
}

# Function to get baseline metrics (from tag or stored data)
get_baseline_metrics() {
    local baseline_file=".ci-baselines/${BASELINE_TAG}.json"

    if [ -f "$baseline_file" ]; then
        cat "$baseline_file"
    else
        # Generate baseline from historical data if file doesn't exist
        echo '{"warning":"No baseline file found","data":{}}'
    fi
}

# Function to calculate percentage change
calc_change() {
    local current="$1"
    local baseline="$2"

    if [ "$baseline" = "0" ] || [ -z "$baseline" ]; then
        echo "N/A"
        return
    fi

    local change=$(echo "scale=1; (($current - $baseline) * 100 / $baseline)" | bc -l 2>/dev/null || echo "0")
    echo "${change}%"
}

# Function to format comparison result
format_comparison() {
    local current="$1"
    local baseline="$2"
    local metric_name="$3"
    local better_direction="$4"  # "up" or "down"

    local change=$(calc_change "$current" "$baseline")

    if [ "$change" = "N/A" ]; then
        echo "$current (no baseline)"
        return
    fi

    local change_num=$(echo "$change" | sed 's/%//')
    local symbol=""

    if (( $(echo "$change_num > 0" | bc -l) )); then
        if [ "$better_direction" = "up" ]; then
            symbol="📈"
        else
            symbol="📉"
        fi
    elif (( $(echo "$change_num < 0" | bc -l) )); then
        if [ "$better_direction" = "down" ]; then
            symbol="📈"
        else
            symbol="📉"
        fi
    else
        symbol="➡️"
    fi

    echo "$current $symbol ($change vs baseline: $baseline)"
}

# Main execution
main() {
    echo "# CI Baseline Comparison Report"
    echo ""
    echo "**Generated**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "**Baseline**: $BASELINE_TAG (2025-09-21)"
    echo "**Period**: Last $DAYS_TO_ANALYZE days"
    echo ""

    # Key workflows to analyze
    declare -a workflows=(
        "Core Strict - Build and Tests"
        "Core Strict - Exports, Validation, Comparison"
        "Quick Check - Verification + Lint"
    )

    echo "## Workflow Performance Comparison"
    echo ""
    echo "| Workflow | Runs | Success Rate | p50 (min) | p95 (min) | vs Target |"
    echo "|----------|------|--------------|-----------|-----------|-----------|"

    for workflow in "${workflows[@]}"; do
        metrics=$(get_workflow_metrics "$workflow" "$DAYS_TO_ANALYZE")

        runs=$(echo "$metrics" | jq -r '.runs')
        success_rate=$(echo "$metrics" | jq -r '.success_rate | floor')
        p50=$(echo "$metrics" | jq -r '.p50')
        p95=$(echo "$metrics" | jq -r '.p95')

        # Targets from v0.3 milestone
        target_sr=85
        target_p95=6

        if [[ "$workflow" == *"Exports"* ]]; then
            target_sr=90
            target_p95=5
        elif [[ "$workflow" == *"Quick Check"* ]]; then
            target_sr=95
            target_p95=2
        fi

        # Status indicators
        sr_status="✅"
        if [ "$success_rate" -lt "$target_sr" ]; then
            sr_status="❌"
        fi

        p95_status="✅"
        if [ "$p95" -gt "$target_p95" ]; then
            p95_status="❌"
        fi

        echo "| $workflow | $runs | ${success_rate}% $sr_status | $p50 | $p95 $p95_status | SR≥${target_sr}%, p95≤${target_p95}m |"
    done

    echo ""
    echo "## vcpkg Cache Performance"
    echo ""

    # Get latest vcpkg stats
    local latest_run=$(gh run list --workflow "Core Strict - Exports, Validation, Comparison" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")

    if [ -n "$latest_run" ]; then
        # Try to get vcpkg stats from artifacts
        local temp_dir=$(mktemp -d)
        gh run download "$latest_run" -n "strict-exports-reports-Linux" -D "$temp_dir" 2>/dev/null || true

        if [ -f "$temp_dir/build/vcpkg_cache_stats.json" ]; then
            local hit_rate=$(jq -r '.hit_rate // 0' "$temp_dir/build/vcpkg_cache_stats.json")
            local total=$(jq -r '.total // 0' "$temp_dir/build/vcpkg_cache_stats.json")

            echo "- **Cache Hit Rate**: ${hit_rate}%"
            echo "- **Total Packages**: $total"
            echo "- **Target**: >80% hit rate"

            if [ "$hit_rate" -ge "80" ]; then
                echo "- **Status**: ✅ Meeting target"
            else
                echo "- **Status**: ⚠️ Below target"
            fi
        else
            echo "- Cache metrics not available in latest run"
        fi

        rm -rf "$temp_dir"
    else
        echo "- No recent exports runs found"
    fi

    echo ""
    echo "## Windows CI Stability"
    echo ""

    # Analyze Windows-specific runs
    local windows_stats=$(gh api "repos/zensgit/CADGameFusion/actions/runs?per_page=100" --jq '
        [.workflow_runs[] | select(.name | contains("Windows"))] |
        {
            total: length,
            success: map(select(.conclusion == "success")) | length,
            failure: map(select(.conclusion == "failure")) | length,
            recent_5: (.[0:5] | map(.conclusion))
        }
    ' 2>/dev/null || echo '{"total":0,"success":0,"failure":0}')

    local win_total=$(echo "$windows_stats" | jq -r '.total')
    local win_success=$(echo "$windows_stats" | jq -r '.success')
    local win_rate=0

    if [ "$win_total" -gt 0 ]; then
        win_rate=$((win_success * 100 / win_total))
    fi

    echo "- **Total Runs**: $win_total"
    echo "- **Success Rate**: ${win_rate}%"
    echo "- **Target**: 95% over 14 days"

    if [ "$win_rate" -ge 95 ]; then
        echo "- **Status**: ✅ Stable"
    elif [ "$win_rate" -ge 80 ]; then
        echo "- **Status**: ⚠️ Needs improvement"
    else
        echo "- **Status**: ❌ Critical"
    fi

    echo ""
    echo "## Progress Toward v0.3 Goals"
    echo ""
    echo "| Goal | Current | Target | Status |"
    echo "|------|---------|--------|--------|"
    echo "| Core workflow avg time | ~2-3 min | ≤2 min | ⚠️ |"
    echo "| Windows CI success rate | ${win_rate}% | ≥95% | $([ "$win_rate" -ge 95 ] && echo '✅' || echo '❌') |"
    echo "| vcpkg cache hit rate | See above | >80% | TBD |"
    echo "| Exports time reduction | Baseline | -30% | 🔄 |"

    echo ""
    echo "## Recommendations"
    echo ""

    # Generate recommendations based on data
    if [ "$win_rate" -lt 95 ]; then
        echo "1. **Windows CI**: Investigate and fix Windows-specific failures"
    fi

    echo "2. **Performance**: Continue monitoring exports workflow for 30% reduction"
    echo "3. **Cache**: Optimize vcpkg binary caching strategy"
    echo "4. **Monitoring**: Keep tracking daily trends via auto-triggered reports"

    echo ""
    echo "---"
    echo "*Report generated by ci_baseline_compare.sh*"
}

# Run main function
main