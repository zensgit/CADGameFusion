#!/usr/bin/env bash
set -euo pipefail

# Create a GitHub Release via gh CLI.
# Usage:
#   bash scripts/release_create.sh v0.3.0 \
#     [--title "v0.3.0 — CI vcpkg cache optimization"] \
#     [--notes-file RELEASE_NOTES_v0.3.0_YYYY_MM_DD.md] \
#     [--target main] [--prerelease] [--draft]

VERSION=""
TITLE=""
NOTES_FILE=""
TARGET="main"
PRERELEASE=false
DRAFT=false

usage() {
  cat <<USAGE
Usage: $0 <version> [options]

Options:
  --title TEXT        Release title (default: derived from version)
  --notes-file PATH   Notes file (default: try RELEASE_NOTES_<version>_*.md, else CHANGELOG.md)
  --target REF        Target branch/SHA (default: main)
  --prerelease        Mark as prerelease
  --draft             Create as draft
  -h, --help          Show this help

Examples:
  $0 v0.3.0
  $0 v0.3.0 --prerelease --target main
  $0 v0.3.0 --title "v0.3.0 — CI vcpkg cache" --notes-file RELEASE_NOTES_v0.3.0_2025_09_23.md
USAGE
}

need_bin() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1 in PATH" >&2; exit 2; }; }

parse_args() {
  [[ $# -ge 1 ]] || { usage; exit 2; }
  VERSION="$1"; shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) TITLE="${2:-}"; shift 2;;
      --notes-file) NOTES_FILE="${2:-}"; shift 2;;
      --target) TARGET="${2:-main}"; shift 2;;
      --prerelease) PRERELEASE=true; shift;;
      --draft) DRAFT=true; shift;;
      -h|--help) usage; exit 0;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2;;
    esac
  done
}

default_title() {
  if [[ -n "$TITLE" ]]; then echo "$TITLE"; return; fi
  echo "$VERSION — CI vcpkg cache optimization"
}

default_notes_file() {
  if [[ -n "$NOTES_FILE" && -f "$NOTES_FILE" ]]; then echo "$NOTES_FILE"; return; fi
  # Try release notes file matching the version
  local cand
  cand=$(ls -1 RELEASE_NOTES_${VERSION}_*.md 2>/dev/null | head -n1 || true)
  if [[ -n "$cand" ]]; then echo "$cand"; return; fi
  # Fallback to CHANGELOG.md
  if [[ -f CHANGELOG.md ]]; then echo CHANGELOG.md; return; fi
  echo ""  # no file
}

main() {
  need_bin gh
  parse_args "$@"

  local title notes file_flag
  title=$(default_title)
  file_flag=()
  notes=$(default_notes_file)
  if [[ -n "$notes" ]]; then
    file_flag=("--notes-file" "$notes")
  else
    # Minimal inline notes if no file available
    file_flag=("--notes" "Release $VERSION")
  fi

  local flags=("--title" "$title" "--target" "$TARGET" "${file_flag[@]}")
  if [[ "$PRERELEASE" == true ]]; then flags+=("--prerelease"); fi
  if [[ "$DRAFT" == true ]]; then flags+=("--draft"); fi

  echo "Creating release $VERSION"
  echo "  title:   $title"
  echo "  target:  $TARGET"
  if [[ "${file_flag[0]:-}" == "--notes-file" ]]; then
    echo "  notes:   ${file_flag[1]}"
  else
    echo "  notes:   (inline)"
  fi

  gh release create "$VERSION" "${flags[@]}"
  echo "✅ Release $VERSION created"
}

main "$@"

