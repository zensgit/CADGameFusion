#!/usr/bin/env bash
# Decide whether the editor-solve-loop files changed, for the Editor Solve CI gate.
#
# Writes `solve=true|false` to $GITHUB_OUTPUT. ALWAYS exits 0. Fail-safe: any detection failure ->
# solve=true (run the real validation rather than wrongly skip — a required check must never be
# silently bypassed). Non-PR events (push to main, manual dispatch) always run the real work.
#
# Inputs (env): EVENT_NAME (github.event_name), BASE_REF (github.base_ref).
set -uo pipefail

emit() { echo "solve=$1" >> "${GITHUB_OUTPUT:-/dev/stdout}"; echo "detect: solve=$1"; }

if [ "${EVENT_NAME:-}" != "pull_request" ]; then
  echo "detect: non-PR event (${EVENT_NAME:-unknown}) -> run real work"; emit true; exit 0
fi

if [ -z "${BASE_REF:-}" ]; then
  echo "detect: no BASE_REF -> fail-safe"; emit true; exit 0
fi

if ! git fetch origin "$BASE_REF" --quiet 2>/dev/null; then
  echo "detect: 'git fetch origin $BASE_REF' failed -> fail-safe"; emit true; exit 0
fi

CHANGED="$(git diff --name-only "origin/${BASE_REF}...HEAD" 2>/dev/null)" || {
  echo "detect: git diff failed -> fail-safe"; emit true; exit 0
}

echo "Changed files:"; echo "$CHANGED"

# Solve-loop files: the run+show core, transport, writeback, the Solve button, the router endpoint +
# its smoke, the solver tool, the core lib it links, and the gate's own workflow/script.
PATTERN='^(tools/web_viewer/solve_|tools/web_viewer/tests/solve_|tools/web_viewer/ui/workspace\.js|tools/plm_router_service\.py|tools/plm_solve_cadgf_smoke\.py|tools/solve_from_project\.cpp|core/|\.github/workflows/editor-solve-ci\.yml|\.github/scripts/detect_solve_changes\.sh)'

if echo "$CHANGED" | grep -qE "$PATTERN"; then
  emit true
else
  emit false
fi
exit 0
