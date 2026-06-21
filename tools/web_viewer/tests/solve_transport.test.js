// Unit tests for the router solve transport. Injected fetch -> no real router/network needed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouterSolveTransport, resolveSolveRouterUrl, formatSolveStatus, solveBackendStatus } from '../solve_transport.js';

function fakeFetch(envelope, { status = 200, jsonThrows = false } = {}) {
  const f = async (url, opts) => {
    f.lastUrl = url;
    f.lastOpts = opts;
    return { status, json: async () => { if (jsonThrows) throw new Error('not json'); return envelope; } };
  };
  return f;
}

test('createRouterSolveTransport: POSTs CADGF-PROJ to <router>/solve-cadgf, returns the envelope', async () => {
  const env = { ok: true, vars: { 'p1.x': 0 }, analysis: { dof_estimate: 0 } };
  const f = fakeFetch(env);
  const solve = createRouterSolveTransport({ routerUrl: 'http://127.0.0.1:9000/', fetchImpl: f });
  const out = await solve({ scene: { entities: [] } });
  assert.deepEqual(out, env);
  assert.equal(f.lastUrl, 'http://127.0.0.1:9000/solve-cadgf'); // trailing slash trimmed
  assert.equal(f.lastOpts.method, 'POST');
  assert.match(f.lastOpts.headers['Content-Type'], /json/);
  assert.equal(JSON.parse(f.lastOpts.body).scene.entities.length, 0);
});

test('createRouterSolveTransport: returns the router ERROR envelope on 4xx/5xx (still JSON)', async () => {
  const errEnv = { ok: false, error_code: 'SOLVE_CLI_NOT_FOUND', error: 'solver not configured' };
  const solve = createRouterSolveTransport({ routerUrl: 'http://x', fetchImpl: fakeFetch(errEnv, { status: 503 }) });
  assert.deepEqual(await solve({}), errEnv);
});

test('createRouterSolveTransport: no router URL -> SOLVE_NO_ROUTER, fetch not called', async () => {
  let called = false;
  const solve = createRouterSolveTransport({ routerUrl: '', fetchImpl: async () => { called = true; } });
  const out = await solve({});
  assert.equal(out.ok, false);
  assert.equal(out.error_code, 'SOLVE_NO_ROUTER');
  assert.equal(called, false);
});

test('createRouterSolveTransport: non-JSON response -> SOLVE_BAD_OUTPUT (no throw)', async () => {
  const solve = createRouterSolveTransport({ routerUrl: 'http://x', fetchImpl: fakeFetch(null, { jsonThrows: true }) });
  const out = await solve({});
  assert.equal(out.ok, false);
  assert.equal(out.error_code, 'SOLVE_BAD_OUTPUT');
});

test('formatSolveStatus: verdict messages + backend hints', () => {
  assert.equal(formatSolveStatus({ status: 'solved' }), 'Solved');
  assert.match(formatSolveStatus({ status: 'blocked' }), /conflicts|unsatisfied/);
  assert.equal(formatSolveStatus({ status: 'no-constraints' }), 'No constraints to solve');
  // backend-unavailable now reads clearly + actionably (not a cryptic "Solve failed")
  assert.match(
    formatSolveStatus({ status: 'failed', envelope: { error_code: 'SOLVE_CLI_NOT_FOUND' } }),
    /not available.*default-solve-cli/,
  );
  // network throw -> unreachable
  assert.match(formatSolveStatus({ status: 'failed', error: 'ECONNREFUSED' }), /unreachable.*ECONNREFUSED/);
  assert.equal(formatSolveStatus(null), 'Solve failed');
});

test('solveBackendStatus: distinguishes backend conditions from the solve verdict', () => {
  // backend worked -> verdict states
  assert.equal(solveBackendStatus({ status: 'solved' }).state, 'solved');
  assert.equal(solveBackendStatus({ status: 'blocked' }).state, 'blocked');
  assert.equal(solveBackendStatus({ status: 'no-constraints' }).state, 'no-constraints');
  // not configured -> 'unavailable' (router has no --default-solve-cli / no router URL / no fetch)
  assert.equal(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_CLI_NOT_FOUND' } }).state, 'unavailable');
  assert.equal(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_NO_ROUTER' } }).state, 'unavailable');
  assert.equal(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_NO_FETCH' } }).state, 'unavailable');
  // reached but errored -> 'error'
  assert.equal(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_BAD_OUTPUT', error: 'x' } }).state, 'error');
  assert.equal(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_EXCEPTION', error: 'x' } }).state, 'error');
  // couldn't reach the backend (transport threw) -> 'unreachable'
  assert.equal(solveBackendStatus({ status: 'failed', error: 'ECONNREFUSED' }).state, 'unreachable');
  // CLI_NOT_FOUND carries an actionable hint
  assert.match(solveBackendStatus({ status: 'failed', envelope: { error_code: 'SOLVE_CLI_NOT_FOUND' } }).hint, /default-solve-cli/);
});

test('resolveSolveRouterUrl: live global > bridge default > loopback default', async () => {
  const prev = globalThis.window;
  try {
    globalThis.window = { __vemcadRouterUrl: 'http://custom:1234' };
    assert.equal(await resolveSolveRouterUrl(), 'http://custom:1234');
    globalThis.window = { vemcadDesktop: { getDefaultSettings: async () => ({ routerUrl: 'http://bridge:9000' }) } };
    assert.equal(await resolveSolveRouterUrl(), 'http://bridge:9000');
    globalThis.window = {}; // no live global, no bridge
    assert.equal(await resolveSolveRouterUrl(), 'http://127.0.0.1:9000');
  } finally {
    if (prev === undefined) delete globalThis.window; else globalThis.window = prev;
  }
});
