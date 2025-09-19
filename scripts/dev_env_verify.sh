#!/usr/bin/env bash
set -euo pipefail

# CADGameFusion - Development Environment Verification (minimal)
# Purpose: quick sanity checks used by quick-check workflow and local dev.
# Usage: bash scripts/dev_env_verify.sh

ok=true
say() { echo "[dev-env] $*"; }
fail() { echo "[dev-env][FAIL] $*" >&2; ok=false; }

# Core tools
command -v cmake >/dev/null 2>&1 && say "cmake: $(cmake --version | head -n1)" || fail "cmake not found"
command -v python3 >/dev/null 2>&1 && say "python3: $(python3 --version)" || fail "python3 not found"

# Optional speed-up
if command -v ninja >/dev/null 2>&1; then
  say "ninja: $(ninja --version)"
else
  say "ninja: not found (optional)"
fi

# Repository layout quick check
for p in tools/export_cli.cpp tools/validate_export.py tools/compare_fields.py; do
  [ -f "$p" ] || fail "missing file: $p"
done

# Python deps (best-effort)
python3 - <<'PY' || true
try:
  import json, sys
  print('[dev-env] python json module ok')
except Exception as e:
  print('[dev-env][WARN] python stdlib json failed:', e, file=sys.stderr)
PY

if [ "$ok" = true ]; then
  say "Environment OK"
  exit 0
fi
exit 1

