// Slice 2 tests: var->geometry mapping (unit) + an end-to-end undoable writeback golden against a
// REAL DocumentState + CommandBus (proving the Ctrl-Z-reversible contract).

import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';

import { parseSolvedVarsToUpdates, applySolvedGeometry } from '../solve_writeback.js';

function setup() {
  const document = new DocumentState();
  const ctx = { document, selection: new SelectionState(), snap: new SnapState(), viewport: new ViewState(), commandBus: null };
  const bus = new CommandBus(ctx);
  registerCadCommands(bus, ctx);
  return { document, bus };
}

test('parseSolvedVarsToUpdates: maps e<id>_<role>.x|y -> entity patches', () => {
  const updates = parseSolvedVarsToUpdates({
    'e1_start.x': 0, 'e1_start.y': 2.5, 'e1_end.x': 10, 'e1_end.y': 2.5,
    'e2_center.x': 4, 'e2_center.y': 4,
  });
  const byId = Object.fromEntries(updates.map((u) => [u.id, u.patch]));
  assert.deepEqual(byId[1], { start: { x: 0, y: 2.5 }, end: { x: 10, y: 2.5 } });
  assert.deepEqual(byId[2], { center: { x: 4, y: 4 } });
});

test('parseSolvedVarsToUpdates: skips incomplete points and non-point vars', () => {
  const updates = parseSolvedVarsToUpdates({
    'e3_start.x': 1,          // missing e3_start.y -> incomplete, skipped
    'foo.x': 5, 'bar': 9,     // non-point keys, skipped
    'e4_end.x': 2, 'e4_end.y': 3,
  });
  assert.deepEqual(updates, [{ id: 4, patch: { end: { x: 2, y: 3 } } }]);
});

test('applySolvedGeometry: no mappable vars -> ok:true, applied 0, document untouched (no undo step)', () => {
  const { document, bus } = setup();
  bus.execute('entity.create', { entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 5 }, layerId: 0 } });
  const before = JSON.stringify(document.listEntities());
  const res = applySolvedGeometry(bus, { ok: true, vars: { 'not.a.point': 1 } });
  assert.equal(res.ok, true);
  assert.equal(res.applied, 0);
  assert.equal(JSON.stringify(document.listEntities()), before);
});

test('GOLDEN: solve writeback flattens a slanted line and is one Ctrl-Z step', () => {
  const { document, bus } = setup();
  // A slanted line (y 0 -> 5); a horizontal solve would flatten both endpoints to y=2.5.
  bus.execute('entity.create', { entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 5 }, layerId: 0 } });
  const id = document.listEntities()[0].id;

  const envelope = {
    ok: true,
    vars: { [`e${id}_start.x`]: 0, [`e${id}_start.y`]: 2.5, [`e${id}_end.x`]: 10, [`e${id}_end.y`]: 2.5 },
  };
  const res = applySolvedGeometry(bus, envelope);
  assert.equal(res.ok, true);
  assert.equal(res.applied, 1);

  // Geometry was written back (line flattened).
  let line = document.listEntities().find((e) => e.id === id);
  assert.equal(line.start.y, 2.5);
  assert.equal(line.end.y, 2.5);

  // Undo restores the original geometry in ONE step (the undoable-writeback contract).
  const undo = bus.execute('history.undo');
  assert.equal(undo.ok, true);
  line = document.listEntities().find((e) => e.id === id);
  assert.equal(line.start.y, 0);
  assert.equal(line.end.y, 5);

  // Redo re-applies it.
  bus.execute('history.redo');
  line = document.listEntities().find((e) => e.id === id);
  assert.equal(line.start.y, 2.5);
  assert.equal(line.end.y, 2.5);
});
