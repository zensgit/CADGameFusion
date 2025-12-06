#!/usr/bin/env bash
set -euo pipefail

# Seed GitHub milestone v0.3.2 and related issues (single maintainer friendly).
#
# Prerequisites:
#   - GitHub CLI installed and authenticated: gh auth login
#   - This repo's remote points to GitHub (gh repo view works)
#
# Usage:
#   bash scripts/seed_v032_issues.sh [--assignee <user>] [--dry-run]

ASSIGNEE=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --assignee) ASSIGNEE="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install GitHub CLI first." >&2
  exit 2
fi

REPO=${GH_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)}
if [[ -z "$REPO" ]]; then
  echo "Unable to determine repo via gh. Run inside a GitHub repo or set GH_REPO." >&2
  exit 2
fi

if [[ -z "$ASSIGNEE" ]]; then
  ASSIGNEE=$(gh api user --jq .login)
fi

MILESTONE_TITLE="v0.3.2 — Quick defaults & hooks adoption"
MILESTONE_DESC="Make quick checks default, strengthen pre-push gating, and polish developer UX."

echo "[seed] repo=$REPO assignee=$ASSIGNEE"

# Find existing milestone if any
MS_NUM=$(gh api repos/"$REPO"/milestones --jq \
  ".[] | select(.title==\"$MILESTONE_TITLE\") | .number" 2>/dev/null || true)
if [[ -z "$MS_NUM" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[seed] DRY-RUN create milestone: $MILESTONE_TITLE"
    MS_NUM=0
  else
    MS_NUM=$(gh api repos/"$REPO"/milestones -f title="$MILESTONE_TITLE" -f description="$MILESTONE_DESC" -f state=open --jq .number)
    echo "[seed] milestone created #$MS_NUM"
  fi
else
  echo "[seed] milestone exists #$MS_NUM"
fi

create_issue() {
  local title="$1"; shift
  local labels="$1"; shift
  local body="$1"; shift || true
  # Check existing open issue with same title
  local existing
  existing=$(gh issue list --state open --json title --jq \
    ".[] | select(.title==\"$title\") | .title" | head -n1 || true)
  if [[ "$existing" == "$title" ]]; then
    echo "[seed] skip exists: $title"
    return 0
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[seed] DRY-RUN issue: $title [labels=$labels]"
    return 0
  fi
  local tmp
  tmp=$(mktemp)
  printf "%s\n" "$body" > "$tmp"
  gh issue create \
    --title "$title" \
    --body-file "$tmp" \
    --label "$labels" \
    --assignee "$ASSIGNEE" \
    --milestone "$MILESTONE_TITLE" >/dev/null
  rm -f "$tmp"
  echo "[seed] issue created: $title"
}

# Issues to create
create_issue \
  "v0.3.2: Pre-push hook finalize + docs" \
  "ci,docs" \
  "Finalize pre-push hook template with variants (strict/structure-only/offline). Update README and Troubleshooting.\n\nAcceptance:\n- Hook runs strict quick check by default\n- Variants documented\n- README + Troubleshooting updated"

create_issue \
  "v0.3.2: CI mirror quick strict job with summary" \
  "ci" \
  "Add a dedicated CI job mirroring quick_check.sh --strict. Publish local_ci_summary.json as artifact; surface summary in logs.\n\nAcceptance:\n- Job green\n- Summary visible in job logs"

create_issue \
  "v0.3.2: Stabilize quick spec + goldens" \
  "tooling,tests" \
  "Ensure quick spec scene and golden samples stay in sync. Add guard in local_ci to warn on spec/golden drift.\n\nAcceptance:\n- No false negatives in quick\n- Drift warning present"

create_issue \
  "v0.3.2: Make 'make quick' the recommended local gate" \
  "docs" \
  "Promote 'make quick' in README. Provide short rationale and link to Offline guide.\n\nAcceptance:\n- README updated\n- Link to OFFLINE_MODE.md"

create_issue \
  "v0.3.2: local_ci summary JSON enhancements" \
  "tooling,ci" \
  "Add counts/durations/strict flag to build/local_ci_summary.json; document schema.\n\nAcceptance:\n- JSON includes durations per phase\n- strictExit boolean present\n- Minimal schema documented"

create_issue \
  "v0.3.2: Troubleshooting: check_local_summary usage" \
  "docs" \
  "Extend Troubleshooting with 'quick/strict' failure diagnosis, and how to use tools/check_local_summary.sh.\n\nAcceptance:\n- Section added with examples"

create_issue \
  "v0.3.2: Minimal C API example for quick subset" \
  "core,examples" \
  "Add a minimal C/C++ example calling core_c to create/draw polygon/triangulate and export within quick subset.\n\nAcceptance:\n- Example builds in CI\n- Mentioned in README"

create_issue \
  "v0.3.2: Unity adapter smoke scene" \
  "adapters,examples" \
  "Add a Unity smoke scene that exercises quick pipeline end-to-end using CoreBindings.cs.\n\nAcceptance:\n- Scene opens and runs\n- Doc page updated"

create_issue \
  "v0.3.2: Docs — Quick vs Strict decision table" \
  "docs" \
  "Add a concise decision table documenting when to use quick vs strict, offline guidance, and expected gates.\n\nAcceptance:\n- New doc section linked from README"

echo "[seed] done"

