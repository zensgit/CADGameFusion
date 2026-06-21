// Slice 3 — conflict UX. The cadgf web_viewer already has a VERIFIED conflict surface: the solver
// action panel reads payload.analysis.action_panels (solver_action_panel.js) and renders the solver's
// structured conflicts + suggestions. The editor-native solve loop must PRESERVE that structure so the
// existing panel works on the editor's own constraints — reuse, not a new highlight system. (Per the
// plan, redundant / under-constrained highlighting is deliberately NOT added until the solver's
// structural signals are reliable.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { solveEnvelopeToDiagnostics, solveVerdict } from '../solve_run.js';

// A realistic conflict envelope from solve_from_project (via router /solve-cadgf): the structured
// conflict info lives in analysis.action_panels — exactly what solver_action_panel reads.
const CONFLICT_ENVELOPE = {
  ok: false,
  vars: {},
  iterations: 8,
  final_error: 3.1,
  analysis: {
    constraint_count: 3,
    conflict_group_count: 1,
    primary_conflict_constraint_indices: [1, 2],
    action_panels: [
      {
        id: 'primary_conflict',
        category: 'conflict',
        constraint_indices: [1, 2],
        hint: 'Remove one of the conflicting constraints',
        ui: { badge_label: 'Conflict', severity: 'warning' },
      },
    ],
  },
};

test('Slice 3: conflict diagnostics reach the panel-consumable shape (analysis.action_panels preserved)', () => {
  const d = solveEnvelopeToDiagnostics(CONFLICT_ENVELOPE);
  // The verified solver_action_panel reads payload.analysis.action_panels — it must survive the map.
  assert.ok(Array.isArray(d.analysis?.action_panels), 'action_panels preserved');
  assert.equal(d.analysis.action_panels[0].category, 'conflict');
  assert.deepEqual(d.analysis.action_panels[0].constraint_indices, [1, 2]);
  assert.deepEqual(d.analysis.primary_conflict_constraint_indices, [1, 2]);
  assert.equal(d.ok, false);
});

test('Slice 3: a conflict solve is classified blocked (panel shown, geometry untouched)', () => {
  // 'blocked' is what the Solve button uses to show diagnostics WITHOUT writing geometry back.
  assert.equal(solveVerdict(CONFLICT_ENVELOPE), 'blocked');
});
