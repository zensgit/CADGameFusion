#!/usr/bin/env bash
# Prints GitHub CLI commands to create v0.3.2 issues from local drafts.
# Safe: does NOT execute any gh command.

set -euo pipefail

REPO="${1:-<owner>/<repo>}"
MILESTONE="v0.3.2"

base=".github/ISSUE_DRAFTS/v0.3.2"
declare -A MAP=(
  ["v0.3.2 — Pre-push Hook Variants & Docs"]="01_pre_push_hook.md"
  ["v0.3.2 — Promote make quick in README"]="02_make_quick_readme.md"
  ["v0.3.2 — Minimal C API Example (CTest)"]="03_minimal_c_api_example.md"
  ["v0.3.2 — Decision Table: Quick vs Strict vs Offline"]="04_decision_table_quick_strict_offline.md"
  ["v0.3.2 — CTest Gate Docs & CI Alignment"]="05_ctest_gate_docs_and_ci.md"
  ["v0.3.2 — Exporter Defaults & Docs"]="06_exporter_defaults_and_docs.md"
)

echo "# Copy/paste the following commands once you've set REPO to your org/repo"
for title in "${!MAP[@]}"; do
  file="$base/${MAP[$title]}"
  if [[ -f "$file" ]]; then
    echo "gh issue create -R \"$REPO\" -t \"$title\" -l v0.3.2 -l task -m \"$MILESTONE\" --body-file \"$file\""
  else
    echo "# Missing draft: $file" 1>&2
  fi
done

echo "# Example: bash scripts/print_v032_issue_cmds.sh yourorg/CADGameFusion > /tmp/v032_cmds.sh"
echo "# Then review and run the generated commands manually."

