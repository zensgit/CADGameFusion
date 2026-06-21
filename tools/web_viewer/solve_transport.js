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

// Map a runSolveAndShow result to a concise status-bar message.
export function formatSolveStatus(result) {
  if (!result) return 'Solve failed';
  switch (result.status) {
    case 'solved': return 'Solved';
    case 'blocked': return 'Solver: conflicts / unsatisfied — see panel';
    case 'no-constraints': return 'No constraints to solve';
    default: return `Solve failed${result.error ? ': ' + result.error : ''}`;
  }
}
