#!/usr/bin/env bash

# Monitor Multiple CI Runs for Windows Stability Assessment
#
# Usage:
#   ./scripts/monitor_ci_runs.sh \
#       [--workflow "Windows Nightly - Strict Build Monitor"] \
#       [--count 3] [--runs "<id>:<desc>,<id>:<desc>"] \
#       [--interval 60] [--max-iterations 30]
#
# Notes:
# - If --runs is provided, it takes precedence.
# - If --workflow is provided (can be repeated), the script will fetch the
#   latest --count runs for each workflow and monitor them.
# - Defaults: interval=60s, max-iterations=30 (30 minutes total).

set -euo pipefail

# Dependencies check
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 2; }; }
need gh
need jq

WORKFLOWS=()
COUNT=3
INTERVAL=60
MAX_ITER=30
EXPLICIT_RUNS=""

print_help() {
  sed -n '1,40p' "$0" | sed -n '1,20p'
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow)
      WORKFLOWS+=("$2"); shift 2;;
    --count)
      COUNT="$2"; shift 2;;
    --runs)
      EXPLICIT_RUNS="$2"; shift 2;;
    --interval)
      INTERVAL="$2"; shift 2;;
    --max-iterations)
      MAX_ITER="$2"; shift 2;;
    -h|--help)
      print_help; exit 0;;
    *)
      echo "Unknown arg: $1" >&2; print_help; exit 2;;
  esac
done

# Build RUNS array
declare -a RUNS
if [[ -n "$EXPLICIT_RUNS" ]]; then
  IFS=',' read -r -a RUNS <<< "$EXPLICIT_RUNS"
elif [[ ${#WORKFLOWS[@]} -gt 0 ]]; then
  # Fetch latest runs for each named workflow
  for wf in "${WORKFLOWS[@]}"; do
    json=$(gh run list --workflow "$wf" -L "$COUNT" --json databaseId,displayTitle,createdAt 2>/dev/null || true)
    if [[ -n "$json" && "$json" != "null" ]]; then
      while IFS= read -r ln; do 
        [[ -n "$ln" ]] && RUNS+=("$ln")
      done < <(echo "$json" | jq -r '.[] | "\(.databaseId):\(.displayTitle)"')
    fi
  done
else
  echo "No --runs or --workflow specified; nothing to monitor." >&2
  exit 2
fi

echo "🔍 监控多个CI运行 - Windows稳定性评估"
echo "========================================"
echo "开始时间: $(date)"
echo "监控对象: ${#RUNS[@]} 个运行 (interval=${INTERVAL}s, max=${MAX_ITER})"
echo ""

# Function to check run status
check_run() {
    local run_id="$1"
    local description="$2"
    
    local result=$(gh run view "$run_id" --json status,conclusion,name 2>/dev/null)
    if [ $? -eq 0 ]; then
        local status=$(echo "$result" | jq -r '.status')
        local conclusion=$(echo "$result" | jq -r '.conclusion')
        local name=$(echo "$result" | jq -r '.name')
        
        printf "%-60s %s" "$description" ""
        
        if [ "$status" = "completed" ]; then
            if [ "$conclusion" = "success" ]; then
                echo "✅ SUCCESS"
                return 0
            elif [ "$conclusion" = "failure" ]; then
                echo "❌ FAILED"
                return 1
            else
                echo "⚠️  $conclusion"
                return 2
            fi
        else
            echo "🔄 $status"
            return 3
        fi
    else
        echo "❓ UNKNOWN (ID: $run_id)"
        return 4
    fi
}

# Function to check Windows-specific job in a run
check_windows_job() {
    local run_id="$1"
    local description="$2"
    
    # Get jobs for this run (current repo)
    # Filter job name case-insensitively containing 'windows'
    local jobs=$(gh api repos/:owner/:repo/actions/runs/$run_id/jobs --jq '.jobs[] | select((.name|ascii_downcase) | contains("windows")) | {name, conclusion, status}' 2>/dev/null || true)
    
    if [ -n "$jobs" ]; then
        echo "$jobs" | while IFS= read -r job; do
            local job_name=$(echo "$job" | jq -r '.name')
            local job_status=$(echo "$job" | jq -r '.status')
            local job_conclusion=$(echo "$job" | jq -r '.conclusion')
            
            printf "  └─ Windows Job: %-40s " "$job_name"
            
            if [ "$job_status" = "completed" ]; then
                if [ "$job_conclusion" = "success" ]; then
                    echo "✅ SUCCESS"
                elif [ "$job_conclusion" = "failure" ]; then
                    echo "❌ FAILED"
                else
                    echo "⚠️  $job_conclusion"
                fi
            else
                echo "🔄 $job_status"
            fi
        done
    fi
}

# Monitor function
monitor_runs() {
    local total_runs=${#RUNS[@]}
    local completed_runs=0
    local successful_runs=0
    local failed_runs=0
    local windows_successes=0
    local windows_failures=0
    
    echo "📊 当前状态:"
    echo "============"
    
    for run_info in "${RUNS[@]}"; do
        IFS=':' read -r run_id description <<< "$run_info"
        
        check_run "$run_id" "$description"
        local result=$?
        
        case $result in
            0) # Success
                ((successful_runs++))
                ((completed_runs++))
                ;;
            1|2) # Failed or other conclusion
                ((failed_runs++))
                ((completed_runs++))
                ;;
            3) # In progress
                ;;
            *) # Unknown
                ;;
        esac
        
        # Check Windows-specific jobs and count success/failure
        local j
        j=$(gh api repos/:owner/:repo/actions/runs/$run_id/jobs --jq '.jobs[] | select((.name|ascii_downcase) | contains("windows")) | {name, conclusion, status}' 2>/dev/null || true)
        if [[ -n "$j" ]]; then
          while IFS= read -r line; do
            local name concl status
            name=$(echo "$line" | jq -r '.name' 2>/dev/null || echo "")
            concl=$(echo "$line" | jq -r '.conclusion' 2>/dev/null || echo "")
            status=$(echo "$line" | jq -r '.status' 2>/dev/null || echo "")
            printf "  └─ Windows Job: %-40s " "$name"
            if [[ "$status" == "completed" ]]; then
              if [[ "$concl" == "success" ]]; then
                echo "✅ SUCCESS"; ((windows_successes++))
              elif [[ "$concl" == "failure" ]]; then
                echo "❌ FAILED"; ((windows_failures++))
              else
                echo "⚠️  $concl"
              fi
            else
              echo "🔄 $status"
            fi
          done < <(echo "$j" | jq -c '.')
        fi
    done
    
    echo ""
    echo "📈 统计摘要:"
    echo "============"
    echo "总运行数: $total_runs"
    echo "已完成: $completed_runs"
    echo "成功: $successful_runs"
    echo "失败: $failed_runs"
    echo "进行中: $((total_runs - completed_runs))"
    echo "Windows Jobs: ${windows_successes} success / ${windows_failures} failure(s)"
    
    if [ $completed_runs -eq $total_runs ]; then
        echo ""
        echo "🎯 所有运行已完成!"
        
        if [ $successful_runs -gt $failed_runs ]; then
            echo "✅ 整体评估: Windows CI稳定性良好 ($successful_runs/$total_runs 成功)"
            echo "💡 建议: 可以考虑合并PR #50启用blocking模式"
        else
            echo "⚠️  整体评估: Windows CI仍不稳定 ($failed_runs/$total_runs 失败)"
            echo "💡 建议: 继续等待Windows镜像恢复"
        fi
        
        return 0
    else
        return 1
    fi
}

# Main monitoring loop
main() {
    local max_iterations=30  # Maximum monitoring time (30 * 60s = 30 minutes)
    local iteration=0
    
    while [ $iteration -lt $max_iterations ]; do
        clear
        echo "🔍 监控多个CI运行 - Windows稳定性评估"
        echo "========================================"
        echo "监控时间: $(date)"
        echo "监控轮次: $((iteration + 1))/$max_iterations"
        echo ""
        
        if monitor_runs; then
            echo ""
            echo "🎉 监控完成! 所有运行都已结束。"
            break
        fi
        
        echo ""
        echo "⏱️  ${INTERVAL}秒后刷新..."
        sleep "$INTERVAL"
        ((iteration++))
    done
    
    if [ $iteration -eq $max_iterations ]; then
        echo ""
        echo "⏰ 监控超时 (30分钟)。请手动检查剩余运行。"
    fi
}

# Check if running interactively
if [ -t 1 ]; then
    # Interactive mode - run monitoring loop
    main
else
    # Non-interactive mode - just show current status
    monitor_runs
fi
