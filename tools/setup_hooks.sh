#!/usr/bin/env bash
set -euo pipefail

# Install git hook symlinks for quick pre-push checks

HOOKS_DIR=".git/hooks"
SRC_PRE_PUSH="tools/git-hooks/pre-push.example"
DEST_PRE_PUSH="$HOOKS_DIR/pre-push"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "[hooks] .git/hooks not found; are you in a git repo?" >&2
  exit 1
fi

if [[ -f "$DEST_PRE_PUSH" || -L "$DEST_PRE_PUSH" ]]; then
  echo "[hooks] pre-push already exists; skipping (remove to reinstall)"
  exit 0
fi

ln -s "../../$SRC_PRE_PUSH" "$DEST_PRE_PUSH"
chmod +x "$SRC_PRE_PUSH"
echo "[hooks] Installed pre-push hook -> $DEST_PRE_PUSH"

