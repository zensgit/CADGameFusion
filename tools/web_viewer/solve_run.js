// Editor NATIVE solve — RUN + SHOW (no geometry writeback).
//
// Composes the editor's EXISTING pieces into a one-click loop:
//   solver.export-project (CADGF-PROJ) -> solve transport (injected) -> map the solve envelope to a
//   diagnostics payload -> setSolverDiagnostics (the existing solver action panels / flow console
//   render success / unsatisfied-conflict / failure).
//
// Deliberately does NOT touch geometry — geometry writeback is a separate, later step (it needs an
// undo/redo contract). This loop only RUNS the solver and SHOWS the result, so it is low-risk and
// immediately useful in the editor (incl. the desktop, which loads this web_viewer directly and does
// not get the product-layer solve loop).
//
// Pure composition: commandBus + solve (transport) + setSolverDiagnostics are injected, so this is
// unit-testable without a real solver, HTTP, or desktop. The transport is supplied by the caller
// (e.g. a POST to a local solve endpoint, or a desktop bridge that runs solve_from_project).

// Map a solve_cadgf_cli / /solve-cadgf envelope to the diagnostics payload the solver panels consume
// (the solver.import-diagnostics shape: { ok, iterations, final_error, analysis, ... }). Display only
// — solved variables (envelope.value.vars) are intentionally NOT consumed here (that is writeback).
export function solveEnvelopeToDiagnostics(envelope) {
  const e = envelope && typeof envelope === 'object' ? envelope : {};
  const solve = (e.value && typeof e.value === 'object' ? e.value.solve : null) || {};
  const diagnostics = {
    ok: e.ok === true,
    iterations: solve.iterations ?? e.iterations ?? null,
    final_error: solve.finalError ?? e.final_error ?? null,
    analysis: e.analysis ?? null,
  };
  if (e.error_code) diagnostics.error_code = e.error_code;
  if (e.error) diagnostics.error = e.error;
  return diagnostics;
}

// Run the editor's native solve and show the result.
//   { commandBus, solve, setSolverDiagnostics }
//   - commandBus: the editor command bus (must provide `solver.export-project`).
//   - solve(project) -> Promise<envelope>: the transport that runs the real solver on the CADGF-PROJ.
//   - setSolverDiagnostics(payload, message?): the editor hook that renders diagnostics in the panels.
//
// Returns { ok, status, diagnostics?, envelope?, message?, error? }:
//   - ok=false  -> the loop could not complete (no bus / no constraints / no transport / transport
//                  threw). status: 'no-constraints' | 'failed'. Nothing is shown.
//   - ok=true   -> the loop completed and diagnostics were shown. status is the SOLVE verdict:
//                  'solved' | 'blocked' (unsatisfied/conflict) | 'failed' (solver-side failure).
// Never writes geometry back.
export async function runSolveAndShow({ commandBus, solve, setSolverDiagnostics } = {}) {
  if (!commandBus || typeof commandBus.execute !== 'function') {
    return { ok: false, status: 'failed', error: 'command bus unavailable' };
  }
  const exported = commandBus.execute('solver.export-project');
  if (!exported || exported.ok !== true || !exported.project) {
    return { ok: false, status: 'no-constraints', message: exported?.message ?? 'no constraints to solve' };
  }
  if (typeof solve !== 'function') {
    return { ok: false, status: 'failed', error: 'solve transport unavailable' };
  }

  let envelope;
  try {
    envelope = await solve(exported.project);
  } catch (err) {
    return { ok: false, status: 'failed', error: String(err?.message ?? err) };
  }

  const diagnostics = solveEnvelopeToDiagnostics(envelope);
  if (typeof setSolverDiagnostics === 'function') {
    setSolverDiagnostics(diagnostics, 'Native solve');
  }

  const status = envelope?.ok === true
    ? 'solved'
    : (envelope?.error_code === 'SOLVE_UNSATISFIED' ? 'blocked' : 'failed');
  return { ok: true, status, diagnostics, envelope };
}
