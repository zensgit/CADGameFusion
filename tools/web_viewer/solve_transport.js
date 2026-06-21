// Router solve transport for the editor native solve loop. Produces a `solve(project)` function that
// POSTs a CADGF-PROJ to the router's synchronous POST /solve-cadgf and returns the solver envelope.
//
// The desktop already runs a local python router (for convert) and exposes its URL via the desktop
// settings/bridge; this reuses that loopback service rather than binding solve into the desktop shell,
// so the SAME transport works from the desktop, a dev serve, or the browser. Consumed by
// runSolveAndShow (solve_run.js). The fetch impl is injectable -> unit-testable without a real router.

export function createRouterSolveTransport({ routerUrl, fetchImpl = globalThis.fetch } = {}) {
  const base = String(routerUrl || '').replace(/\/+$/, '');
  return async function solve(project) {
    if (!base) {
      return { ok: false, error_code: 'SOLVE_NO_ROUTER', error: 'router URL not configured' };
    }
    if (typeof fetchImpl !== 'function') {
      return { ok: false, error_code: 'SOLVE_NO_FETCH', error: 'fetch unavailable' };
    }
    // Network errors propagate to runSolveAndShow's try/catch (-> status 'failed'). The router returns
    // a JSON envelope for BOTH a solve (200) and a transport error (4xx/5xx), so we parse + return it
    // regardless of HTTP status; only a non-JSON body is a bad-output transport error.
    const response = await fetchImpl(`${base}/solve-cadgf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project ?? {}),
    });
    try {
      return await response.json();
    } catch {
      return {
        ok: false,
        error_code: 'SOLVE_BAD_OUTPUT',
        error: `router did not return JSON (HTTP ${response?.status ?? '?'})`,
      };
    }
  };
}

// Resolve the local router URL for the native Solve button. Prefers a live setting
// (window.__vemcadRouterUrl, which the desktop/product layer may publish from its current settings),
// then the desktop bridge defaults, then the loopback default. Async because the bridge lookup is async.
export async function resolveSolveRouterUrl() {
  if (typeof window !== 'undefined' && window) {
    if (window.__vemcadRouterUrl) return window.__vemcadRouterUrl;
    const bridge = window.vemcadDesktop;
    if (bridge && typeof bridge.getDefaultSettings === 'function') {
      try {
        const settings = await bridge.getDefaultSettings();
        if (settings && settings.routerUrl) return settings.routerUrl;
      } catch { /* fall through to the loopback default */ }
    }
  }
  return 'http://127.0.0.1:9000';
}

// Classify the SOLVE BACKEND status from a runSolveAndShow result, so the UI can distinguish a
// down / unconfigured / unreachable backend from a real solve verdict. Returns { state, label, hint? }:
//   state: 'solved' | 'blocked' | 'no-constraints' -> the backend worked; label is the verdict.
//          'unavailable'  -> reachable but not configured (no solver binary / no router URL).
//          'unreachable'  -> could not reach the backend at all (network).
//          'error'        -> backend reached but errored (bad output / spawn failure).
// This lets the desktop out-of-the-box case show "Solver backend not available — start the router
// with --default-solve-cli" instead of a cryptic "Solve failed".
export function solveBackendStatus(result) {
  if (!result) return { state: 'error', label: 'Solve failed' };
  switch (result.status) {
    case 'solved': return { state: 'solved', label: 'Solved' };
    case 'blocked': return { state: 'blocked', label: 'Solver: conflicts / unsatisfied — see panel' };
    case 'no-constraints': return { state: 'no-constraints', label: 'No constraints to solve' };
    default: break; // 'failed' / unknown -> distinguish the backend condition below
  }
  const code = result.envelope && result.envelope.error_code;
  const detail = (result.envelope && result.envelope.error) || result.error || result.message || '';
  switch (code) {
    case 'SOLVE_CLI_NOT_FOUND':
      return { state: 'unavailable', label: 'Solver backend not available', hint: 'the router was started without --default-solve-cli' };
    case 'SOLVE_NO_ROUTER':
      return { state: 'unavailable', label: 'No solver backend configured', hint: 'set the router URL in settings' };
    case 'SOLVE_NO_FETCH':
      return { state: 'unavailable', label: 'No solver transport', hint: 'fetch unavailable in this runtime' };
    case 'SOLVE_BAD_OUTPUT':
      return { state: 'error', label: 'Solver returned an invalid response', hint: detail };
    case 'SOLVE_EXCEPTION':
    case 'SOLVE_SPAWN_FAILED':
      return { state: 'error', label: 'Solver backend error', hint: detail };
    default:
      // No envelope error_code: a thrown transport (network) leaves result.error set.
      if (result.error) return { state: 'unreachable', label: 'Solver unreachable', hint: `is the router running? ${result.error}` };
      return { state: 'error', label: 'Solve failed', hint: detail };
  }
}

// One-line status-bar message derived from the backend status (label + optional actionable hint).
export function formatSolveStatus(result) {
  const s = solveBackendStatus(result);
  return s.hint ? `${s.label} — ${s.hint}` : s.label;
}
