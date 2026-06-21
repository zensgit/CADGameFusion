// Unit tests for the editor native solve RUN+SHOW loop (no writeback). Pure composition:
// commandBus + solve transport + setSolverDiagnostics are stubbed, so no real solver/desktop needed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { runSolveAndShow, solveEnvelopeToDiagnostics, solveVerdict } from '../solve_run.js';

// The RAW solve_from_project envelope (via the router /solve-cadgf): a conflict is { ok:false,
// analysis:{...} } with NO error_code — must classify as 'blocked', not 'failed'.
const RAW_CONFLICT_ENVELOPE = {
  ok: false, vars: {}, iterations: 12, final_error: 4.2,
  analysis: { constraint_count: 3, conflict_group_count: 1, action_panels: [] },
};
const RAW_SOLVED_ENVELOPE = {
  ok: true, vars: { 'p1.x': 0, 'p1.y': 0 }, iterations: 5, final_error: 1e-10,
  analysis: { constraint_count: 2, dof_estimate: 0 },
};

// A command bus stub that records every command id it executed (to prove NO writeback).
function makeBus({ project = { header: { format: 'CADGF-PROJ' }, scene: {} }, exportOk = true } = {}) {
  const calls = [];
  return {
    calls,
    execute(id) {
      calls.push(id);
      if (id === 'solver.export-project') {
        return exportOk
          ? { ok: true, project }
          : { ok: false, message: 'no constraints' };
      }
      return { ok: true };
    },
  };
}

const SOLVED_ENVELOPE = {
  ok: true,
  value: { vars: { 'e1_start.x': 0, 'e1_start.y': 2.5 }, solve: { ok: true, iterations: 3, finalError: 1e-9 } },
  analysis: { constraint_count: 1, dof: 1 },
};
const UNSAT_ENVELOPE = {
  ok: false, error_code: 'SOLVE_UNSATISFIED', error: 'over-constrained',
  value: { vars: {}, solve: { ok: false } }, analysis: { conflicts: ['c1'] },
};

test('solveEnvelopeToDiagnostics maps the solve envelope to the panel diagnostics shape', () => {
  const d = solveEnvelopeToDiagnostics(SOLVED_ENVELOPE);
  assert.equal(d.ok, true);
  assert.equal(d.iterations, 3);
  assert.equal(d.final_error, 1e-9);
  assert.deepEqual(d.analysis, { constraint_count: 1, dof: 1 });
});

test('runSolveAndShow: solved -> status solved, diagnostics shown, NO writeback', async () => {
  const bus = makeBus();
  let shown = null;
  const res = await runSolveAndShow({
    commandBus: bus,
    solve: async () => SOLVED_ENVELOPE,
    setSolverDiagnostics: (payload) => { shown = payload; },
  });
  assert.equal(res.ok, true);
  assert.equal(res.status, 'solved');
  assert.equal(shown?.ok, true);
  assert.equal(shown?.analysis?.dof, 1);
  // Slice-1 invariant: the ONLY command executed is the export — geometry is never written back.
  assert.deepEqual(bus.calls, ['solver.export-project']);
});

test('runSolveAndShow: unsatisfied -> status blocked, conflict diagnostics shown, NO writeback', async () => {
  const bus = makeBus();
  let shown = null;
  const res = await runSolveAndShow({
    commandBus: bus,
    solve: async () => UNSAT_ENVELOPE,
    setSolverDiagnostics: (payload) => { shown = payload; },
  });
  assert.equal(res.ok, true);
  assert.equal(res.status, 'blocked');
  assert.equal(shown?.ok, false);
  assert.equal(shown?.error_code, 'SOLVE_UNSATISFIED');
  assert.deepEqual(bus.calls, ['solver.export-project']);
});

test('solveVerdict: classifies both envelope shapes (solve_cadgf_cli AND raw solve_from_project)', () => {
  assert.equal(solveVerdict(SOLVED_ENVELOPE), 'solved');         // cli-wrapped, ok
  assert.equal(solveVerdict(RAW_SOLVED_ENVELOPE), 'solved');     // raw binary, ok
  assert.equal(solveVerdict(UNSAT_ENVELOPE), 'blocked');         // cli, error_code SOLVE_UNSATISFIED
  assert.equal(solveVerdict(RAW_CONFLICT_ENVELOPE), 'blocked');  // raw binary: ok:false + analysis, NO error_code
  assert.equal(solveVerdict({ ok: false, error_code: 'SOLVE_CLI_NOT_FOUND' }), 'failed'); // router transport error
  assert.equal(solveVerdict({ ok: false, error_code: 'INVALID_INPUT' }), 'failed');
  assert.equal(solveVerdict(null), 'failed');
});

test('runSolveAndShow: RAW solve_from_project conflict -> status blocked (not failed)', async () => {
  const bus = makeBus();
  let shown = null;
  const res = await runSolveAndShow({
    commandBus: bus,
    solve: async () => RAW_CONFLICT_ENVELOPE,
    setSolverDiagnostics: (payload) => { shown = payload; },
  });
  assert.equal(res.ok, true);
  assert.equal(res.status, 'blocked');
  assert.equal(shown?.ok, false);
  assert.equal(shown?.iterations, 12);             // root-level iterations mapped
  assert.equal(shown?.final_error, 4.2);           // root-level final_error mapped
  assert.equal(shown?.analysis?.conflict_group_count, 1);
  assert.deepEqual(bus.calls, ['solver.export-project']); // still no writeback
});

test('runSolveAndShow: no constraints -> ok:false no-constraints, nothing shown, no solve called', async () => {
  const bus = makeBus({ exportOk: false });
  let shown = null;
  let solveCalled = false;
  const res = await runSolveAndShow({
    commandBus: bus,
    solve: async () => { solveCalled = true; return SOLVED_ENVELOPE; },
    setSolverDiagnostics: (payload) => { shown = payload; },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'no-constraints');
  assert.equal(solveCalled, false);
  assert.equal(shown, null);
});

test('runSolveAndShow: transport throws -> ok:false failed, no writeback', async () => {
  const bus = makeBus();
  const res = await runSolveAndShow({
    commandBus: bus,
    solve: async () => { throw new Error('solver unreachable'); },
    setSolverDiagnostics: () => {},
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'failed');
  assert.match(res.error, /unreachable/);
  assert.deepEqual(bus.calls, ['solver.export-project']);
});

test('runSolveAndShow: missing transport -> ok:false failed (no crash)', async () => {
  const bus = makeBus();
  const res = await runSolveAndShow({ commandBus: bus });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'failed');
});
