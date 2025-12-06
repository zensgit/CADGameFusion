#!/usr/bin/env bash
set -euo pipefail

# Branch Protection Audit
# Compares current required status checks on a branch against an expected baseline JSON.
# Generates a Markdown report and (optionally) returns non-zero on drift.
#
# Usage:
#   bash scripts/audit_branch_protection.sh \
#     [--branch main] \
#     [--expected docs/branch_protection/main_2025_09_22.json] \
#     [--out build/BRANCH_PROTECTION_AUDIT.md] \
#     [--fail-on-drift]

BRANCH="main"
EXPECTED="docs/branch_protection/main_2025_09_22.json"
OUT="build/BRANCH_PROTECTION_AUDIT_$(date -u '+%Y-%m-%dT%H%M%SZ').md"
FAIL_ON_DRIFT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2;;
    --expected) EXPECTED="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --fail-on-drift) FAIL_ON_DRIFT=true; shift;;
    -h|--help)
      sed -n '1,80p' "$0" | sed 's/^# //;t;d'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

mkdir -p "$(dirname "$OUT")"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 2; }; }
need jq

GH_REPO="${GH_REPOSITORY:-${GITHUB_REPOSITORY:-}}"
GH_TOKEN_="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_REPO" ]]; then
  # Best-effort fallback: parse from git remote
  if git remote get-url origin >/dev/null 2>&1; then
    url=$(git remote get-url origin)
    # Expect https://github.com/owner/repo.git
    GH_REPO=$(echo "$url" | sed -E 's#.*/github.com/([^/]+/[^/.]+)(\.git)?#\1#; s#^https?://github.com/##') || true
  fi
fi
if [[ -z "$GH_REPO" ]]; then
  echo "GH_REPOSITORY not set and unable to infer from git remote." >&2
  exit 2
fi
if [[ -z "$GH_TOKEN_" ]]; then
  echo "GITHUB_TOKEN not found in environment. In GitHub Actions this is provided automatically." >&2
  exit 2
fi

api_get() {
  local path="$1"
  curl -sS -H "Authorization: Bearer $GH_TOKEN_" \
       -H "Accept: application/vnd.github+json" \
       -H "X-GitHub-Api-Version: 2022-11-28" \
       "https://api.github.com/repos/$GH_REPO/$path"
}

if [[ ! -f "$EXPECTED" ]]; then
  echo "Expected baseline not found: $EXPECTED" >&2
  exit 2
fi

expected_strict=$(jq -r '.strict // false' "$EXPECTED")
mapfile -t expected_ctx < <(jq -r '.contexts[]? // empty' "$EXPECTED" | sort -u)

resp=$(api_get "branches/$BRANCH/protection/required_status_checks" || true)
if echo "$resp" | jq -e . >/dev/null 2>&1; then
  current_strict=$(echo "$resp" | jq -r '.strict // false')
  mapfile -t current_ctx < <(echo "$resp" | jq -r '.contexts[]? // empty' | sort -u)
else
  echo "Failed to fetch branch protection via API. Raw:" >&2
  echo "$resp" >&2
  exit 2
fi

# Compute sets using temporary files for comm
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
printf "%s\n" "${expected_ctx[@]}" | sort -u > "$tmpdir/expected.txt"
printf "%s\n" "${current_ctx[@]}" | sort -u > "$tmpdir/current.txt"

comm -12 "$tmpdir/expected.txt" "$tmpdir/current.txt" > "$tmpdir/common.txt" || true
comm -23 "$tmpdir/expected.txt" "$tmpdir/current.txt" > "$tmpdir/missing.txt" || true
comm -13 "$tmpdir/expected.txt" "$tmpdir/current.txt" > "$tmpdir/extra.txt" || true

missing_count=$(wc -l < "$tmpdir/missing.txt" | tr -d ' ')
extra_count=$(wc -l < "$tmpdir/extra.txt" | tr -d ' ')
strict_match="NO"
if [[ "$expected_strict" == "$current_strict" ]]; then strict_match="YES"; fi

{
  echo "# Branch Protection Audit"
  echo
  echo "- Repository: $GH_REPO"
  echo "- Branch: $BRANCH"
  echo "- Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo
  echo "## Strict Mode"
  echo "- Expected: $expected_strict"
  echo "- Current:  $current_strict"
  echo "- Match:    $strict_match"
  echo
  echo "## Contexts Summary"
  echo "- Expected count: ${#expected_ctx[@]}"
  echo "- Current count:  ${#current_ctx[@]}"
  echo "- Missing:        $missing_count"
  echo "- Extra:          $extra_count"
  echo
  echo "### Missing (expected but not configured)"
  if [[ $missing_count -gt 0 ]]; then
    while IFS= read -r line; do echo "- $line"; done < "$tmpdir/missing.txt"
  else
    echo "- (none)"
  fi
  echo
  echo "### Extra (configured but not in expected)"
  if [[ $extra_count -gt 0 ]]; then
    while IFS= read -r line; do echo "- $line"; done < "$tmpdir/extra.txt"
  else
    echo "- (none)"
  fi
  echo
  echo "### Common"
  if [[ -s "$tmpdir/common.txt" ]]; then
    while IFS= read -r line; do echo "- $line"; done < "$tmpdir/common.txt"
  else
    echo "- (none)"
  fi
} > "$OUT"

echo "Report written: $OUT"

if $FAIL_ON_DRIFT; then
  if [[ "$strict_match" != "YES" ]] || [[ $missing_count -gt 0 || $extra_count -gt 0 ]]; then
    echo "Drift detected (strict or contexts differ)." >&2
    exit 3
  fi
fi
exit 0

