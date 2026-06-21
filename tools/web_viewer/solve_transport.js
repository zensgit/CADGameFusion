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
