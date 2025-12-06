#!/bin/bash
# CI Performance Benchmark Tool
# Compare CI performance against baseline or record new baseline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="zensgit"
REPO_NAME="CADGameFusion"
BASELINE_DIR=".ci-baselines"
DEFAULT_BASELINE="ci-baseline-2025-09-21"

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

CI Performance Benchmark Tool - Record and compare CI performance metrics

OPTIONS:
    --record <name>           Record current metrics as a new baseline
    --compare <name>          Compare current metrics with a baseline (default: $DEFAULT_BASELINE)
    --compare-md <name> <file> Compare and output markdown report to file
    --list                    List available baselines
    --help                    Show this help message

EXAMPLES:
    $0 --record my-baseline-2025-09-22
    $0 --compare ci-baseline-2025-09-21
    $0 --compare-md ci-baseline-2025-09-21 report.md
    $0 --list

EOF
    exit 0
}

# Function to fetch workflow runs data
fetch_workflow_data() {
    local ref=$1
    local output_file=$2

    echo -e "${BLUE}Fetching workflow data...${NC}"

    # Get recent workflow runs (last 50) regardless of ref for baseline purposes
    gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=50" \
        --jq '.workflow_runs[] | select(.conclusion == "success" or .conclusion == "failure") | {
            name: .name,
            status: .status,
            conclusion: .conclusion,
            created_at: .created_at,
            updated_at: .updated_at,
            run_time: (((.updated_at | fromdateiso8601) - (.created_at | fromdateiso8601)) / 60 | floor)
        }' > "$output_file" 2>/dev/null || echo "[]" > "$output_file"

    local count=$(jq -s 'length' "$output_file")
    echo -e "${GREEN}Fetched $count workflow runs${NC}"
}

# Function to calculate statistics
calculate_stats() {
    local data_file=$1

    # Calculate success rate
    local total=$(jq -s 'length' "$data_file")
    local success=$(jq -s '[.[] | select(.conclusion == "success")] | length' "$data_file")
    local success_rate=0
    if [ "$total" -gt 0 ]; then
        success_rate=$(( success * 100 / total ))
    fi

    # Calculate average runtime (for successful runs)
    local avg_runtime=$(jq -s '[.[] | select(.conclusion == "success") | .run_time] | add / length' "$data_file" 2>/dev/null || echo "0")

    # Get min and max runtimes
    local min_runtime=$(jq -s '[.[] | select(.conclusion == "success") | .run_time] | min' "$data_file" 2>/dev/null || echo "0")
    local max_runtime=$(jq -s '[.[] | select(.conclusion == "success") | .run_time] | max' "$data_file" 2>/dev/null || echo "0")

    echo "{
        \"total_runs\": $total,
        \"successful_runs\": $success,
        \"success_rate\": $success_rate,
        \"avg_runtime_min\": $avg_runtime,
        \"min_runtime_min\": $min_runtime,
        \"max_runtime_min\": $max_runtime
    }"
}

# Function to record baseline
record_baseline() {
    local baseline_name=$1

    echo -e "${BLUE}Recording baseline: $baseline_name${NC}"

    # Create baseline directory if it doesn't exist
    mkdir -p "$BASELINE_DIR"

    # Get current commit SHA
    local commit_sha=$(git rev-parse HEAD)

    # Fetch current workflow data
    local temp_file="/tmp/ci_benchmark_$$.json"
    fetch_workflow_data "HEAD" "$temp_file"

    # Calculate statistics
    local stats=$(calculate_stats "$temp_file")

    # Create baseline file
    local baseline_file="$BASELINE_DIR/$baseline_name.json"
    cat > "$baseline_file" << EOF
{
    "name": "$baseline_name",
    "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "commit": "$commit_sha",
    "stats": $stats,
    "workflows": $(cat "$temp_file" | jq -s '.')
}
EOF

    # Clean up
    rm -f "$temp_file"

    echo -e "${GREEN}✓ Baseline recorded: $baseline_file${NC}"

    # Display summary
    echo -e "\n${YELLOW}Baseline Summary:${NC}"
    echo "  Success Rate: $(echo "$stats" | jq -r '.success_rate')%"
    echo "  Avg Runtime: $(echo "$stats" | jq -r '.avg_runtime_min') minutes"
    echo "  Min Runtime: $(echo "$stats" | jq -r '.min_runtime_min') minutes"
    echo "  Max Runtime: $(echo "$stats" | jq -r '.max_runtime_min') minutes"
}

# Function to compare with baseline
compare_baseline() {
    local baseline_name=${1:-$DEFAULT_BASELINE}
    local output_markdown=${2:-}
    local baseline_file="$BASELINE_DIR/$baseline_name.json"

    if [ ! -f "$baseline_file" ]; then
        echo -e "${RED}Error: Baseline '$baseline_name' not found${NC}"
        echo "Available baselines:"
        list_baselines
        exit 1
    fi

    echo -e "${BLUE}Comparing with baseline: $baseline_name${NC}\n"

    # Fetch current workflow data
    local temp_file="/tmp/ci_benchmark_current_$$.json"
    fetch_workflow_data "HEAD" "$temp_file"

    # Calculate current statistics
    local current_stats=$(calculate_stats "$temp_file")

    # Read baseline statistics
    local baseline_stats=$(jq '.stats' "$baseline_file")

    # Calculate deltas
    local baseline_success=$(echo "$baseline_stats" | jq -r '.success_rate')
    local current_success=$(echo "$current_stats" | jq -r '.success_rate')
    local success_delta=$((current_success - baseline_success))

    local baseline_avg=$(echo "$baseline_stats" | jq -r '.avg_runtime_min')
    local current_avg=$(echo "$current_stats" | jq -r '.avg_runtime_min')
    local avg_delta=$(echo "scale=2; $current_avg - $baseline_avg" | bc)
    local avg_pct=$(echo "scale=2; (($current_avg - $baseline_avg) / $baseline_avg) * 100" | bc 2>/dev/null || echo "0")

    # Display comparison report
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║           CI Performance Comparison Report              ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo
    echo "Baseline: $baseline_name ($(jq -r '.date' "$baseline_file"))"
    echo "Current:  $(git rev-parse --short HEAD) ($(date -u +"%Y-%m-%dT%H:%M:%SZ"))"
    echo
    echo "┌─────────────────────┬──────────┬──────────┬────────────┐"
    echo "│ Metric              │ Baseline │ Current  │ Change     │"
    echo "├─────────────────────┼──────────┼──────────┼────────────┤"

    # Success Rate
    printf "│ Success Rate        │ %7s%% │ %7s%% │ "  "$baseline_success" "$current_success"
    if [ $success_delta -gt 0 ]; then
        echo -e "${GREEN}+$success_delta%${NC}       │"
    elif [ $success_delta -lt 0 ]; then
        echo -e "${RED}$success_delta%${NC}       │"
    else
        echo "0%         │"
    fi

    # Average Runtime
    printf "│ Avg Runtime (min)   │ %8.1f │ %8.1f │ " "$baseline_avg" "$current_avg"
    if (( $(echo "$avg_delta < 0" | bc -l) )); then
        echo -e "${GREEN}$avg_delta (${avg_pct}%)${NC} │"
    elif (( $(echo "$avg_delta > 0" | bc -l) )); then
        echo -e "${RED}+$avg_delta (+${avg_pct}%)${NC} │"
    else
        echo "0 (0%)     │"
    fi

    echo "└─────────────────────┴──────────┴──────────┴────────────┘"

    # Summary
    echo
    echo -e "${YELLOW}Summary:${NC}"
    if [ $success_delta -gt 0 ] && (( $(echo "$avg_delta < 0" | bc -l) )); then
        echo -e "  ${GREEN}✓ Performance improved! Higher success rate and faster builds.${NC}"
    elif [ $success_delta -lt -5 ] || (( $(echo "$avg_delta > 1" | bc -l) )); then
        echo -e "  ${RED}⚠ Performance degraded. Investigation recommended.${NC}"
    else
        echo -e "  ${BLUE}→ Performance is stable.${NC}"
    fi

    # Clean up
    rm -f "$temp_file"

    # Generate Markdown report if requested
    if [ -n "$output_markdown" ]; then
        generate_markdown_report "$baseline_name" "$baseline_stats" "$current_stats" "$output_markdown"
    fi
}

# Function to generate markdown report
generate_markdown_report() {
    local baseline_name=$1
    local baseline_stats=$2
    local current_stats=$3
    local output_file=$4

    local baseline_success=$(echo "$baseline_stats" | jq -r '.success_rate')
    local current_success=$(echo "$current_stats" | jq -r '.success_rate')
    local success_delta=$((current_success - baseline_success))

    local baseline_avg=$(echo "$baseline_stats" | jq -r '.avg_runtime_min')
    local current_avg=$(echo "$current_stats" | jq -r '.avg_runtime_min')
    local avg_delta=$(echo "scale=2; $current_avg - $baseline_avg" | bc)
    local avg_pct=$(echo "scale=2; (($current_avg - $baseline_avg) / $baseline_avg) * 100" | bc 2>/dev/null || echo "0")

    cat > "$output_file" << EOF
# CI Performance Comparison Report

**Generated**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Baseline**: $baseline_name
**Current**: $(git rev-parse --short HEAD)

## Summary

$(if [ $success_delta -gt 0 ] && (( $(echo "$avg_delta < 0" | bc -l) )); then
    echo "✅ **Performance Improved**: Higher success rate and faster builds"
elif [ $success_delta -lt -5 ] || (( $(echo "$avg_delta > 1" | bc -l) )); then
    echo "⚠️ **Performance Degraded**: Investigation recommended"
else
    echo "➡️ **Performance Stable**: No significant changes detected"
fi)

## Metrics Comparison

| Metric | Baseline | Current | Change | Status |
|--------|----------|---------|--------|--------|
| Success Rate | ${baseline_success}% | ${current_success}% | $([ $success_delta -gt 0 ] && echo "+")${success_delta}% | $([ $success_delta -ge 0 ] && echo "✅" || echo "❌") |
| Avg Runtime | ${baseline_avg} min | ${current_avg} min | $([ $(echo "$avg_delta > 0" | bc -l) -eq 1 ] && echo "+")${avg_delta} min ($([ $(echo "$avg_pct > 0" | bc -l) -eq 1 ] && echo "+")${avg_pct}%) | $([ $(echo "$avg_delta <= 0" | bc -l) -eq 1 ] && echo "✅" || echo "❌") |

## Detailed Statistics

### Baseline ($baseline_name)
- **Total Runs**: $(echo "$baseline_stats" | jq -r '.total_runs')
- **Successful Runs**: $(echo "$baseline_stats" | jq -r '.successful_runs')
- **Min Runtime**: $(echo "$baseline_stats" | jq -r '.min_runtime_min') minutes
- **Max Runtime**: $(echo "$baseline_stats" | jq -r '.max_runtime_min') minutes

### Current
- **Total Runs**: $(echo "$current_stats" | jq -r '.total_runs')
- **Successful Runs**: $(echo "$current_stats" | jq -r '.successful_runs')
- **Min Runtime**: $(echo "$current_stats" | jq -r '.min_runtime_min') minutes
- **Max Runtime**: $(echo "$current_stats" | jq -r '.max_runtime_min') minutes

## Recommendations

$(if [ $success_delta -lt -5 ]; then
    echo "- 🔍 Investigate recent failures to identify root causes"
    echo "- 📊 Review recent changes that may have impacted CI stability"
fi)
$(if (( $(echo "$avg_delta > 1" | bc -l) )); then
    echo "- ⚡ Analyze build time increases and identify bottlenecks"
    echo "- 🗄️ Check cache effectiveness and dependency updates"
fi)
$(if [ $success_delta -gt 5 ] && (( $(echo "$avg_delta < -1" | bc -l) )); then
    echo "- 🎉 Document successful optimizations for future reference"
    echo "- 📈 Consider setting new performance baselines"
fi)

---

*Report generated by benchmark_ci.sh*
EOF

    echo -e "${GREEN}✓ Markdown report saved: $output_file${NC}"
}

# Function to list baselines
list_baselines() {
    echo -e "${BLUE}Available baselines:${NC}"

    if [ ! -d "$BASELINE_DIR" ] || [ -z "$(ls -A $BASELINE_DIR 2>/dev/null)" ]; then
        echo "  No baselines found"
        return
    fi

    for baseline in "$BASELINE_DIR"/*.json; do
        if [ -f "$baseline" ]; then
            local name=$(basename "$baseline" .json)
            local date=$(jq -r '.date' "$baseline")
            local success_rate=$(jq -r '.stats.success_rate' "$baseline")
            echo "  • $name (Date: $date, Success Rate: ${success_rate}%)"
        fi
    done
}

# Main execution
main() {
    # Check for gh CLI
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI (gh) is required but not installed${NC}"
        echo "Install from: https://cli.github.com/"
        exit 1
    fi

    # Parse arguments
    case "${1:-}" in
        --record)
            if [ -z "${2:-}" ]; then
                echo -e "${RED}Error: Baseline name required${NC}"
                usage
            fi
            record_baseline "$2"
            ;;
        --compare)
            compare_baseline "${2:-}"
            ;;
        --compare-md)
            if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
                echo -e "${RED}Error: Baseline name and output file required${NC}"
                usage
            fi
            compare_baseline "$2" "$3"
            ;;
        --list)
            list_baselines
            ;;
        --help|-h|"")
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${NC}"
            usage
            ;;
    esac
}

# Run main function
main "$@"