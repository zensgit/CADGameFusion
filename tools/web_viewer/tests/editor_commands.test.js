import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';
import { importCadgfDocument, exportCadgfDocument, isCadgfDocument } from '../adapters/cadgf_document_adapter.js';
import { collectSnapCandidates, findNearestPoint } from '../tools/geometry.js';
import { createToolContext } from '../tools/tool_context.js';
import { createTrimTool } from '../tools/trim_tool.js';
import { createExtendTool } from '../tools/extend_tool.js';
import { createSelectTool } from '../tools/select_tool.js';
import { createBreakTool } from '../tools/break_tool.js';
import { createFilletTool } from '../tools/fillet_tool.js';
import { createChamferTool } from '../tools/chamfer_tool.js';

function setup() {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  const ctx = { document, selection, snap, viewport, commandBus: null };
  const bus = new CommandBus(ctx);
  registerCadCommands(bus, ctx);
  return { document, selection, bus };
}

function approxEqual(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ~= ${expected}`);
}

test('entity.create + undo/redo', () => {
  const { document, selection, bus } = setup();

  const res = bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 1);
  assert.deepEqual(selection.entityIds, [1]);

  const undo = bus.execute('history.undo');
  assert.equal(undo.ok, true);
  assert.equal(document.listEntities().length, 0);

  const redo = bus.execute('history.redo');
  assert.equal(redo.ok, true);
  assert.equal(document.listEntities().length, 1);
});

test('selection.move moves geometry and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 1, y: 2 }, end: { x: 5, y: 2 }, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const move = bus.execute('selection.move', { delta: { x: 3, y: -2 } });
  assert.equal(move.ok, true);

  const after = document.getEntity(1);
  approxEqual(after.start.x, 4);
  approxEqual(after.start.y, 0);
  approxEqual(after.end.x, 8);
  approxEqual(after.end.y, 0);

  bus.execute('history.undo');
  const reverted = document.getEntity(1);
  approxEqual(reverted.start.x, 1);
  approxEqual(reverted.start.y, 2);
});

test('selection.copy duplicates entities and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'circle', center: { x: 0, y: 0 }, radius: 2, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const copy = bus.execute('selection.copy', { delta: { x: 10, y: 0 } });
  assert.equal(copy.ok, true);
  assert.equal(document.listEntities().length, 2);
  assert.ok(selection.entityIds.length >= 1);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
});

test('selection.offset creates offset geometry and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 5, sidePoint: { x: 0, y: 10 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'line');
  approxEqual(created.start.x, 0);
  approxEqual(created.start.y, 5);
  approxEqual(created.end.x, 10);
  approxEqual(created.end.y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset supports open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 2, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 3);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[0].y, -2);
  approxEqual(created.points[1].x, 12);
  approxEqual(created.points[1].y, -2);
  approxEqual(created.points[2].x, 12);
  approxEqual(created.points[2].y, 10);

  const original = document.getEntity(1);
  assert.equal(original.type, 'polyline');
  approxEqual(original.points[0].x, 0);
  approxEqual(original.points[0].y, 0);
  approxEqual(original.points[1].x, 10);
  approxEqual(original.points[1].y, 0);
  approxEqual(original.points[2].x, 10);
  approxEqual(original.points[2].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset supports closed polyline (square) and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 1, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, true);
  assert.equal(created.points.length, 4);
  approxEqual(created.points[0].x, -1);
  approxEqual(created.points[0].y, -1);
  approxEqual(created.points[1].x, 11);
  approxEqual(created.points[1].y, -1);
  approxEqual(created.points[2].x, 11);
  approxEqual(created.points[2].y, 11);
  approxEqual(created.points[3].x, -1);
  approxEqual(created.points[3].y, 11);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset rejects self-intersecting polyline with explainable error_code', () => {
  const { selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 1, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'SELF_INTERSECT');
});

test('selection.break splits a line and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, name: 'L1' },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 5, y: 0 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'line');
  assert.equal(b.type, 'line');
  approxEqual(a.start.x, 0);
  approxEqual(a.end.x, 5);
  approxEqual(b.start.x, 5);
  approxEqual(b.end.x, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break splits an open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 10, y: 5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  assert.equal(a.points.length, 3);
  assert.equal(b.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 10);
  approxEqual(a.points[1].y, 0);
  approxEqual(a.points[2].x, 10);
  approxEqual(a.points[2].y, 5);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 5);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break opens a closed polyline at picked point and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
      name: 'C1',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 10, y: 5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 5);
  approxEqual(opened.points[0].x, 10);
  approxEqual(opened.points[0].y, 5);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  const original = document.getEntity(1);
  assert.equal(original.closed, true);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 1);
});

test('selection.break supports two-point split on line and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, name: 'L2' },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 3, y: 0 }, pick2: { x: 7, y: 0 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'line');
  assert.equal(b.type, 'line');
  approxEqual(a.start.x, 0);
  approxEqual(a.end.x, 3);
  approxEqual(b.start.x, 7);
  approxEqual(b.end.x, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break supports two-point split on open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P2',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 6 },
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  assert.equal(a.points.length, 2);
  assert.equal(b.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 5);
  approxEqual(a.points[1].y, 0);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 6);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break two-point on open polyline handles pick2 insertion before pick1 insertion', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  // pick1 is on the later segment (requires insertion after the middle vertex),
  // pick2 is on the earlier segment (requires insertion before pick1), which can shift indices.
  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 10, y: 6 },
    pick2: { x: 5, y: 0 },
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  approxEqual(a.points[a.points.length - 1].x, 5);
  approxEqual(a.points[a.points.length - 1].y, 0);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 6);
});

test('selection.break supports two-point split on closed polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 2);
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  const original = document.getEntity(1);
  assert.equal(original.closed, true);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 1);
});

test('selection.break supports closed polyline two-point keep=short', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    keep: 'short',
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.equal(opened.points.length, 3);
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[1].x, 10);
  approxEqual(opened.points[1].y, 0);
  approxEqual(opened.points[2].x, 10);
  approxEqual(opened.points[2].y, 5);
});

test('selection.break supports closed polyline two-point keep=long', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    keep: 'long',
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 5);
  // long path should include (0,0) and (0,10)
  assert.ok(opened.points.some((p) => Math.abs(p.x - 0) < 1e-6 && Math.abs(p.y - 0) < 1e-6));
  assert.ok(opened.points.some((p) => Math.abs(p.x - 0) < 1e-6 && Math.abs(p.y - 10) < 1e-6));
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);
});

test('selection.join merges two connected lines into one polyline and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, layerId: 0 },
  });

  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const created = document.getEntity(3);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 3);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[0].y, 0);
  approxEqual(created.points[1].x, 10);
  approxEqual(created.points[1].y, 0);
  approxEqual(created.points[2].x, 10);
  approxEqual(created.points[2].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.join merges 3 connected entities with primary in middle', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: 0 }, end: { x: 30, y: 0 }, layerId: 0 },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 20, y: 0 }, layerId: 0 },
  }); // id=2
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  }); // id=3

  selection.setSelection([1, 2, 3], 2);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const created = document.getEntity(4);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 4);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[1].x, 10);
  approxEqual(created.points[2].x, 20);
  approxEqual(created.points[3].x, 30);
});

test('selection.join returns NO_MATCH for disjoint segments', () => {
  const { selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 100, y: 0 }, end: { x: 110, y: 0 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'NO_MATCH');
});

test('selection.fillet trims two lines and inserts arc with undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  approxEqual(l1.start.x, 2);
  approxEqual(l1.start.y, 0);
  approxEqual(l2.start.x, 0);
  approxEqual(l2.start.y, 2);
  approxEqual(arc.center.x, 2);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
  const backL1 = document.getEntity(1);
  const backL2 = document.getEntity(2);
  approxEqual(backL1.start.x, 0);
  approxEqual(backL2.start.y, 0);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 3);
});

test('selection.filletByPick chooses trim side based on pick points (cross)', () => {
  const { document, bus } = setup();

  // Cross at origin.
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 }, // keep +X
    pick2: { x: 0, y: 5 }, // keep +Y
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  // Horizontal line should keep end at +X and trim the -X side to x=2.
  approxEqual(l1.end.x, 10);
  approxEqual(l1.start.x, 2);
  // Vertical line should keep end at +Y and trim the -Y side to y=2.
  approxEqual(l2.end.y, 10);
  approxEqual(l2.start.y, 2);
  approxEqual(arc.center.x, 2);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick trims an open polyline mid-segment (cross) and keeps picked side', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    // Keep left side of polyline and keep top side of the vertical line.
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[1].x, 10);
  approxEqual(poly.points[2].x, 13);
  approxEqual(poly.points[2].y, 0);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.y, 10);

  assert.equal(arc.type, 'arc');
  approxEqual(arc.center.x, 13);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick supports adjacent segments on same open polyline corner', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 1,
    pick1: { x: 5, y: 0 }, // horizontal segment
    pick2: { x: 10, y: 5 }, // vertical segment
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  assert.equal(document.getEntity(1), null);
  const a = document.getEntity(2);
  const b = document.getEntity(3);
  const arc = document.getEntity(4);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(arc.type, 'arc');

  // Tangency points at a right-angle corner: trimDist = radius.
  assert.equal(a.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 8);
  approxEqual(a.points[1].y, 0);

  assert.equal(b.points.length, 2);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 2);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  approxEqual(arc.center.x, 8);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.fillet rejects parallel lines with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 1 }, end: { x: 10, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.fillet rejects radius too large with explainable error_code', () => {
  const { document, selection, bus } = setup();

  // Two short segments with intersection at the start (0,0); radius bigger than length should fail.
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'RADIUS_TOO_LARGE');
  assert.equal(document.listEntities().length, 2);
});

test('selection.chamfer trims two lines and inserts connector with undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  approxEqual(l1.start.x, 2);
  approxEqual(l1.start.y, 0);
  approxEqual(l2.start.x, 0);
  approxEqual(l2.start.y, 3);
  approxEqual(connector.start.x, 2);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 0);
  approxEqual(connector.end.y, 3);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
  const backL1 = document.getEntity(1);
  const backL2 = document.getEntity(2);
  approxEqual(backL1.start.x, 0);
  approxEqual(backL2.start.y, 0);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 3);
});

test('selection.chamferByPick chooses trim side based on pick points (cross)', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 }, // keep +X
    pick2: { x: 0, y: 5 }, // keep +Y
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  approxEqual(l1.start.x, 2);
  approxEqual(l2.start.y, 3);
  approxEqual(connector.start.x, 2);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 0);
  approxEqual(connector.end.y, 3);
});

test('selection.chamferByPick trims an open polyline mid-segment (cross) and keeps picked side', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    d1: 2,
    d2: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[2].x, 13);
  approxEqual(poly.points[2].y, 0);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.y, 10);

  assert.equal(connector.type, 'line');
  approxEqual(connector.start.x, 13);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 15);
  approxEqual(connector.end.y, 2);
});

test('selection.chamferByPick supports adjacent segments on same open polyline corner', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 1,
    pick1: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  assert.equal(document.getEntity(1), null);
  const a = document.getEntity(2);
  const b = document.getEntity(3);
  const connector = document.getEntity(4);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(connector.type, 'line');

  assert.equal(a.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 8);
  approxEqual(a.points[1].y, 0);

  assert.equal(b.points.length, 2);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 3);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  approxEqual(connector.start.x, 8);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 10);
  approxEqual(connector.end.y, 3);
});

test('selection.chamfer rejects parallel lines with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 1 }, end: { x: 10, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.chamfer rejects distance too large with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'DISTANCE_TOO_LARGE');
  assert.equal(document.listEntities().length, 2);
});

test('selection.extend supports polyline endpoint', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=15
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });

  // target: polyline from (0,0) -> (10,0)
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, layerId: 0 },
  });

  // Extend the polyline endpoint near (10,0) to boundary
  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10.5, y: 0.2 },
  });
  assert.equal(res.ok, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[1].x, 15);
  approxEqual(poly.points[1].y, 0);
});

test('selection.extend on polyline uses segment/path-aware endpoint choice', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=300
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 300, y: -50 }, end: { x: 300, y: 50 }, layerId: 0 },
  });

  // target: pick near a middle segment where path-to-end is shorter than path-to-start.
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 250, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 100, y: 10 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[poly.points.length - 1].x, 300);
  approxEqual(poly.points[poly.points.length - 1].y, 0);
});

test('selection.extend on polyline supports segment-level endpoint extension', () => {
  const { document, selection, bus } = setup();

  // boundaries: lower y=-5 and upper y=12
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: -5 }, end: { x: 20, y: -5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 12 }, end: { x: 20, y: 12 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 5 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.extend', {
    boundaryIds: [1, 2],
    targetId: 3,
    // Pick near lower half of middle vertical segment => extend vertex #1 downward.
    pick: { x: 5.1, y: 1.0 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const poly = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, 5);
  approxEqual(poly.points[1].y, -5);
  approxEqual(poly.points[2].x, 5);
  approxEqual(poly.points[2].y, 5);
  approxEqual(poly.points[3].x, 10);
  approxEqual(poly.points[3].y, 5);
});

test('cadgf adapter import/export keeps unsupported entities and patches geometry', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-02-07T00:00:00Z',
      modified_at: '2026-02-07T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        name: '',
        line_type: 'CONTINUOUS',
        line_weight: null,
        line_type_scale: 1,
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        space: 0,
        line: [[0, 0], [10, 0]],
      },
      {
        id: 2,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        space: 0,
        text: { pos: [1, 2], h: 2.5, rot: 0, value: 'Hi' },
        // Dimension text metadata must survive editor round-trip so the editor can
        // "allow editing" without dropping dimension attribution fields.
        text_kind: 'dimension',
        dim_type: 160,
        dim_style: 'HC_GBDIM',
        dim_text_pos: [5, 6],
        dim_text_rotation: 1.570796,
      },
      {
        id: 3,
        type: 6,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        space: 0,
        spline: { degree: 2, control: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1] },
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 1);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const line = document.getEntity(1);
  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 0);
  approxEqual(line.end.x, 10);

  const unsupported = document.getEntity(3);
  assert.equal(unsupported.type, 'unsupported');
  assert.ok(unsupported.cadgf && unsupported.cadgf.type === 6);

  selection.setSelection([1], 1);
  bus.execute('selection.move', { delta: { x: 5, y: -2 } });

  selection.setSelection([2], 2);
  bus.execute('selection.move', { delta: { x: 3, y: 4 } });

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  assert.equal(isCadgfDocument(exported), true);
  const outLine = exported.entities.find((e) => e.id === 1);
  assert.equal(outLine.type, 2);
  assert.deepEqual(outLine.line, [[5, -2], [15, -2]]);

  const outText = exported.entities.find((e) => e.id === 2);
  assert.equal(outText.type, 7);
  assert.deepEqual(outText.text.pos, [4, 6]);
  assert.equal(outText.text_kind, 'dimension');
  assert.equal(outText.dim_type, 160);
  assert.equal(outText.dim_style, 'HC_GBDIM');
  assert.deepEqual(outText.dim_text_pos, [5, 6]);
  assert.equal(outText.dim_text_rotation, 1.570796);

  const outSpline = exported.entities.find((e) => e.id === 3);
  assert.equal(outSpline.type, 6);
  assert.deepEqual(outSpline.spline.control, fixture.entities[2].spline.control);
});

test('selection.trim on polyline removes picked side (cad-like)', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=12
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 12, y: -5 }, end: { x: 12, y: 5 }, layerId: 0 },
  });

  // target: polyline (0,0) -> (10,0) -> (20,0)
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 18, y: 0 },
  });
  assert.equal(res.ok, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[2].x, 12);
  approxEqual(poly.points[2].y, 0);
});

test('selection.trim on polyline can split into 2 polylines', () => {
  const { document, selection, bus } = setup();

  // boundaries: x=10 and x=20
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: -5 }, end: { x: 10, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: -5 }, end: { x: 20, y: 5 }, layerId: 0 },
  });

  // target polyline: (0,0) -> (30,0)
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], closed: false, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.trim', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 15, y: 0 },
  });
  assert.equal(res.ok, true);

  const polylines = document.listEntities().filter((e) => e.type === 'polyline');
  assert.equal(polylines.length, 2);
  const left = document.getEntity(3);
  assert.equal(left.type, 'polyline');
  assert.deepEqual(left.points, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);

  const right = polylines.find((e) => e.id !== 3);
  assert.ok(right);
  assert.deepEqual(right.points, [{ x: 20, y: 0 }, { x: 30, y: 0 }]);

  assert.ok(selection.entityIds.includes(3));
  assert.ok(selection.entityIds.includes(right.id));
});

test('selection.propertyPatch can insert polyline vertex and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, layerId: 0 },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      points: [{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }],
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.getEntity(1).points.length, 3);

  bus.execute('history.undo');
  assert.equal(document.getEntity(1).points.length, 2);

  bus.execute('history.redo');
  assert.equal(document.getEntity(1).points.length, 3);
});

test('selection.propertyPatch updates arc angles and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      cw: true,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      startAngle: Math.PI / 4,
      endAngle: Math.PI,
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  approxEqual(document.getEntity(1).startAngle, Math.PI / 4);
  approxEqual(document.getEntity(1).endAngle, Math.PI);

  bus.execute('history.undo');
  approxEqual(document.getEntity(1).startAngle, 0);
  approxEqual(document.getEntity(1).endAngle, Math.PI / 2);
});

test('selection.propertyPatch clamps arc radius and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      cw: true,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      radius: 0,
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  approxEqual(document.getEntity(1).radius, 0.001);

  bus.execute('history.undo');
  approxEqual(document.getEntity(1).radius, 10);

  bus.execute('history.redo');
  approxEqual(document.getEntity(1).radius, 0.001);
});

test('selection.propertyPatch updates arc radius and preserves center/angles', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 3, y: 4 },
      radius: 10,
      startAngle: 0.1,
      endAngle: 2.2,
      cw: false,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: { radius: 5 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const after = document.getEntity(1);
  approxEqual(after.radius, 5);
  approxEqual(after.center.x, 3);
  approxEqual(after.center.y, 4);
  approxEqual(after.startAngle, 0.1);
  approxEqual(after.endAngle, 2.2);
  assert.equal(after.cw, false);

  bus.execute('history.undo');
  const reverted = document.getEntity(1);
  approxEqual(reverted.radius, 10);
  approxEqual(reverted.center.x, 3);
  approxEqual(reverted.center.y, 4);
  approxEqual(reverted.startAngle, 0.1);
  approxEqual(reverted.endAngle, 2.2);

  bus.execute('history.redo');
  const redone = document.getEntity(1);
  approxEqual(redone.radius, 5);
});

test('selection.propertyPatch rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  const locked = document.addLayer('locked-prop-patch');
  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: locked.id,
    },
  });
  selection.setSelection([1], 1);
  document.updateLayer(locked.id, { locked: true });

  const res = bus.execute('selection.propertyPatch', {
    patch: { start: { x: 1, y: 1 } },
  });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');

  const after = document.getEntity(1);
  approxEqual(after.start.x, 0);
  approxEqual(after.start.y, 0);
  approxEqual(after.end.x, 10);
  approxEqual(after.end.y, 0);
});

test('snap candidates include circle quadrants + arc endpoints', () => {
  const circle = { id: 1, type: 'circle', center: { x: 0, y: 0 }, radius: 10, visible: true };
  const arc = {
    id: 2,
    type: 'arc',
    center: { x: 0, y: 0 },
    radius: 10,
    startAngle: 0,
    endAngle: Math.PI / 2,
    cw: true,
    visible: true,
  };
  const opts = {
    endpoint: true,
    midpoint: false,
    quadrant: true,
    center: true,
    intersection: false,
  };

  const points = collectSnapCandidates([circle, arc], opts);
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const hasPoint = (kind, x, y) => points.some((p) => p.kind === kind && near(p.x, x) && near(p.y, y));
  assert.ok(hasPoint('CEN', 0, 0));

  // Circle quadrants: (10,0), (0,10), (-10,0), (0,-10)
  assert.ok(hasPoint('QUA', 10, 0));
  assert.ok(hasPoint('QUA', 0, 10));
  assert.ok(hasPoint('QUA', -10, 0));
  assert.ok(hasPoint('QUA', 0, -10));

  // Arc endpoints: (10,0) and (0,10)
  assert.ok(hasPoint('END', 10, 0));
  assert.ok(hasPoint('END', 0, 10));
});

test('intersection snap guard skips INT when too many segments', () => {
  const entities = [];
  for (let i = 0; i < 2500; i += 1) {
    entities.push({
      id: i + 1,
      type: 'line',
      start: { x: i, y: 0 },
      end: { x: i, y: 1 },
      layerId: 0,
      visible: true,
    });
  }
  const points = collectSnapCandidates(entities, {
    endpoint: false,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: true,
  });
  assert.equal(points.length, 0);
  assert.equal(points.some((p) => p.kind === 'INT'), false);
});

test('snap priority prefers END over QUA when close', () => {
  const source = { x: 0, y: 0 };
  const candidates = [
    { x: 0.02, y: 0, kind: 'QUA' },
    { x: 0.03, y: 0, kind: 'END' },
  ];
  const picked = findNearestPoint(source, candidates, 1);
  assert.equal(picked.kind, 'END');

  const far = [
    { x: 0.01, y: 0, kind: 'QUA' },
    { x: 0.6, y: 0, kind: 'END' },
  ];
  const pickedFar = findNearestPoint(source, far, 1);
  assert.equal(pickedFar.kind, 'QUA');
});

test('resolveSnappedPoint supports tangent and nearest snaps', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState({
    endpoint: false,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: false,
    nearest: true,
    tangent: true,
    grid: false,
    snapRadiusPx: 50,
  });
  const viewport = new ViewState();
  viewport.zoom = 1;

  document.addEntity({ id: 1, type: 'circle', center: { x: 0, y: 0 }, radius: 10, layerId: 0, visible: true });
  document.addEntity({ id: 2, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, visible: true });

  const ctx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
    canvasView: { setTransientOverlay() {} },
    setStatus() {},
    readCommandInput() { return {}; },
  });

  // Tangent from (20,0) to circle r=10 yields points ~ (5, +/-8.6603).
  const tan = ctx.resolveSnappedPoint({ x: 5.05, y: 8.7 }, { tangentFrom: { x: 20, y: 0 } });
  assert.equal(tan.kind, 'TAN');
  approxEqual(tan.point.x, 5, 1e-2);
  approxEqual(tan.point.y, 8.660254, 1e-2);

  // Nearest point on the line to (3,1) is (3,0). (Circle is farther for this query point.)
  const nea = ctx.resolveSnappedPoint({ x: 3, y: 1 }, {});
  assert.equal(nea.kind, 'NEA');
  approxEqual(nea.point.x, 3, 1e-6);
  approxEqual(nea.point.y, 0, 1e-6);
});

test('selection.extend supports multiple boundaries and picks nearest valid hit', () => {
  const { document, selection, bus } = setup();

  // boundary A: x=15, boundary B: x=25
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 25, y: -5 }, end: { x: 25, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.extend', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 10.2, y: 0.1 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const line = document.getEntity(3);
  assert.equal(line.type, 'line');
  approxEqual(line.end.x, 15);
  approxEqual(line.end.y, 0);
});

test('selection.trim supports multiple boundaries and trims toward nearest pick-side hit', () => {
  const { document, selection, bus } = setup();

  // boundaries at x=3 and x=7
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 3, y: -5 }, end: { x: 3, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 7, y: -5 }, end: { x: 7, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.trim', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 9, y: 0.2 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const line = document.getEntity(3);
  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 0);
  approxEqual(line.end.x, 7);
});

test('selection.extend rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  const locked = document.addLayer('locked-test');
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: locked.id },
  });
  document.updateLayer(locked.id, { locked: true });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10.2, y: 0.2 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
});

test('selection.trim rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  const locked = document.addLayer('locked-trim');
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: locked.id },
  });
  document.updateLayer(locked.id, { locked: true });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 8.5, y: 0.2 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
});

test('selection.trim rejects boundary without line segments', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'text', position: { x: 2, y: 2 }, value: 'B', height: 2, rotation: 0, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.trim', {
    boundaryId: 2,
    targetId: 1,
    pick: { x: 8, y: 0.1 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'TRIM_BOUNDARY_EMPTY');
});

test('selection.extend rejects boundary without line segments', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'text', position: { x: 2, y: 2 }, value: 'B', height: 2, rotation: 0, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.extend', {
    boundaryId: 2,
    targetId: 1,
    pick: { x: 9.5, y: 0.1 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'EXTEND_BOUNDARY_EMPTY');
});

test('selection.extend returns no-intersection on disjoint boundaries', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 50 }, end: { x: 10, y: 50 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10, y: 0 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'EXTEND_NO_INTERSECTION');
});

test('selection.trim returns no-intersection on disjoint boundaries', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 50 }, end: { x: 10, y: 50 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 8, y: 0 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'TRIM_NO_INTERSECTION');
});

function createToolHarness(toolFactory) {
  const overlays = [];
  const status = [];
  const commands = [];
  const pickQueue = [];

  const ctx = {
    canvasView: {
      setTransientOverlay(name, payload) {
        overlays.push({ name, payload });
      },
    },
    setStatus(message) {
      status.push(message);
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = (id, { shiftKey = false } = {}) => {
    pickQueue.push(id == null ? null : { id });
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x: id == null ? 0 : id, y: 0 },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { overlays, status, commands, pointer, esc };
}

function createToolHarnessWithResults(toolFactory, results = []) {
  const overlayState = {};
  const overlayCalls = [];
  const status = [];
  const commands = [];
  const pickQueue = [];
  const resultQueue = results.map((r) => ({ ...r }));

  const ctx = {
    canvasView: {
      setTransientOverlay(name, payload) {
        overlayCalls.push({ name, payload });
        if (payload == null) {
          delete overlayState[name];
        } else {
          overlayState[name] = payload;
        }
      },
    },
    setStatus(message) {
      status.push(message);
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        const next = resultQueue.length > 0 ? resultQueue.shift() : null;
        return next || { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = (id, { shiftKey = false } = {}) => {
    pickQueue.push(id == null ? null : { id });
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x: id == null ? 0 : id, y: 0 },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { overlayState, overlayCalls, status, commands, pointer, esc };
}

function createBreakToolHarness({ initialSelection = [], toolOptions = null, entityById = null } = {}) {
  const status = [];
  const commands = [];
  const pickQueue = [];

  const selection = {
    entityIds: [...initialSelection],
    primaryId: initialSelection.length > 0 ? initialSelection[0] : null,
    setSelection(ids, primaryId) {
      this.entityIds = [...(ids || [])];
      this.primaryId = primaryId ?? (this.entityIds.length > 0 ? this.entityIds[0] : null);
    },
    clear() {
      this.entityIds = [];
      this.primaryId = null;
    },
  };

  const ctx = {
    document: {
      getEntity(id) {
        if (entityById && Object.prototype.hasOwnProperty.call(entityById, id)) {
          return entityById[id];
        }
        return null;
      },
    },
    toolOptions,
    selection,
    setStatus(message) {
      status.push(message);
    },
    resolveSnappedPoint(worldPoint) {
      return { point: { x: worldPoint.x, y: worldPoint.y }, snapped: false, kind: 'NONE' };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = createBreakTool(ctx);
  tool.activate();

  const pointer = ({ hitId = null, x = 0, y = 0, shiftKey = false } = {}) => {
    if (hitId != null) {
      pickQueue.push({ id: hitId });
    }
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x, y },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { status, commands, selection, pointer, esc };
}

function createTwoLinePickToolHarness(toolFactory, { commandArgs = [], entityTypeById = null } = {}) {
  const status = [];
  const commands = [];
  const pickQueue = [];

  const selection = {
    entityIds: [],
    primaryId: null,
    setSelection(ids, primaryId) {
      this.entityIds = [...(ids || [])];
      this.primaryId = primaryId ?? (this.entityIds.length > 0 ? this.entityIds[0] : null);
    },
    clear() {
      this.entityIds = [];
      this.primaryId = null;
    },
  };

  const ctx = {
    document: {
      getEntity(id) {
        const override = entityTypeById && Object.prototype.hasOwnProperty.call(entityTypeById, id)
          ? entityTypeById[id]
          : null;
        const type = typeof override === 'string' ? override : 'line';
        if (type === 'polyline') {
          return {
            id,
            type: 'polyline',
            layerId: 0,
            closed: false,
            points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          };
        }
        return { id, type: 'line', layerId: 0, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
      },
      getLayer() {
        return { locked: false };
      },
    },
    selection,
    setStatus(message) {
      status.push(message);
    },
    readCommandInput() {
      return { verb: '', args: [...commandArgs] };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = ({ hitId = null, x = 0, y = 0 } = {}) => {
    pickQueue.push(hitId == null ? null : { id: hitId });
    tool.onPointerDown({
      button: 0,
      world: { x, y },
    });
  };

  const esc = () => tool.onKeyDown({ key: 'Escape' });

  return { status, commands, selection, pointer, esc };
}

function createOverlayHarness() {
  const overlays = {};
  const calls = [];
  return {
    overlays,
    calls,
    canvasView: {
      setTransientOverlay(name, payload) {
        calls.push({ name, payload });
        if (payload == null) {
          delete overlays[name];
        } else {
          overlays[name] = payload;
        }
      },
    },
  };
}

test('select tool: grip hover coexists with snap hint and is stable with small jitter', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState({
    endpoint: true,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: false,
    nearest: false,
    tangent: false,
    grid: false,
    snapRadiusPx: 20,
  });
  const viewport = new ViewState();
  viewport.zoom = 1;

  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    visible: true,
  });
  selection.setSelection([1], 1);

  const overlays = createOverlayHarness();
  const ctx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
    canvasView: overlays.canvasView,
    setStatus() {},
    readCommandInput() { return {}; },
  });

  const tool = createSelectTool(ctx);
  tool.activate();

  const gripWorld = { x: 0, y: 0 };
  const gripScreen = viewport.worldToScreen(gripWorld);

  tool.onPointerMove({
    world: { x: 0.02, y: 0.01 },
    screen: { x: gripScreen.x, y: gripScreen.y },
  });
  assert.ok(overlays.overlays.snapHint, 'expected snapHint overlay');
  assert.ok(overlays.overlays.gripHover, 'expected gripHover overlay');

  // Move slightly outside enter tolerance (10px) but within exit tolerance (14px).
  tool.onPointerMove({
    world: { x: 0.02, y: 0.01 },
    screen: { x: gripScreen.x + 12, y: gripScreen.y },
  });
  assert.ok(overlays.overlays.gripHover, 'expected gripHover to remain with hysteresis');
});

test('trim tool keeps boundaries for continuous targets and resets on Escape', () => {
  const h = createToolHarness(createTrimTool);

  // choose boundary #10
  h.pointer(10);
  // target #20
  h.pointer(20);
  // target #21 without reselecting boundary
  h.pointer(21);
  // add second boundary with shift
  h.pointer(11, { shiftKey: true });
  // target #22 should use both boundaries
  h.pointer(22);

  assert.equal(h.commands.length, 3);
  assert.deepEqual(h.commands[0], {
    id: 'selection.trim',
    payload: { boundaryIds: [10], targetId: 20, pick: { x: 20, y: 0 } },
  });
  assert.deepEqual(h.commands[1], {
    id: 'selection.trim',
    payload: { boundaryIds: [10], targetId: 21, pick: { x: 21, y: 0 } },
  });
  assert.deepEqual(h.commands[2], {
    id: 'selection.trim',
    payload: { boundaryIds: [10, 11], targetId: 22, pick: { x: 22, y: 0 } },
  });

  h.esc();
  const before = h.commands.length;
  // after reset, first click becomes boundary selection, not command execution
  h.pointer(23);
  assert.equal(h.commands.length, before);
});

test('extend tool keeps boundaries for continuous targets and resets on Escape', () => {
  const h = createToolHarness(createExtendTool);

  h.pointer(30);
  h.pointer(40);
  h.pointer(41);
  h.pointer(31, { shiftKey: true });
  h.pointer(42);

  assert.equal(h.commands.length, 3);
  assert.deepEqual(h.commands[0], {
    id: 'selection.extend',
    payload: { boundaryIds: [30], targetId: 40, pick: { x: 40, y: 0 } },
  });
  assert.deepEqual(h.commands[1], {
    id: 'selection.extend',
    payload: { boundaryIds: [30], targetId: 41, pick: { x: 41, y: 0 } },
  });
  assert.deepEqual(h.commands[2], {
    id: 'selection.extend',
    payload: { boundaryIds: [30, 31], targetId: 42, pick: { x: 42, y: 0 } },
  });

  h.esc();
  const before = h.commands.length;
  h.pointer(43);
  assert.equal(h.commands.length, before);
});

test('trim tool keeps boundaries after command failure and continues to next target', () => {
  const h = createToolHarnessWithResults(createTrimTool, [
    { ok: false, changed: false, error_code: 'LAYER_LOCKED', message: 'Layer locked' },
    { ok: true, changed: true, message: 'selection.trim:ok' },
  ]);

  h.pointer(10); // boundary
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint after boundary select');

  h.pointer(20); // target -> fail
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0].payload.boundaryIds, [10]);
  assert.ok(h.status.some((msg) => msg.includes('Layer locked')));

  // Boundaries should stay active for the next target.
  h.pointer(21); // target -> ok
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1].payload.boundaryIds, [10]);
  assert.ok(h.status.some((msg) => msg.includes('Trim applied')));
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint to remain after failure');

  h.esc();
  assert.ok(!h.overlayState.constraintHint, 'expected constraintHint cleared on Escape');
});

test('extend tool keeps boundaries after command failure and continues to next target', () => {
  const h = createToolHarnessWithResults(createExtendTool, [
    { ok: false, changed: false, error_code: 'EXTEND_NO_INTERSECTION', message: 'No extend intersection found' },
    { ok: true, changed: true, message: 'selection.extend:ok' },
  ]);

  h.pointer(30); // boundary
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint after boundary select');

  h.pointer(40); // target -> fail
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0].payload.boundaryIds, [30]);
  assert.ok(h.status.some((msg) => msg.includes('No extend intersection found')));

  h.pointer(41); // target -> ok
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1].payload.boundaryIds, [30]);
  assert.ok(h.status.some((msg) => msg.includes('Extend applied')));

  h.esc();
  assert.ok(!h.overlayState.constraintHint, 'expected constraintHint cleared on Escape');
});

test('break tool supports two-point mode and Esc backs out without losing target', () => {
  const h = createBreakToolHarness();

  // pick target
  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.deepEqual(h.selection.entityIds, [10]);
  assert.equal(h.selection.primaryId, 10);

  // first break point (Shift+click enters two-point mode)
  h.pointer({ x: 3, y: 0, shiftKey: true });
  assert.equal(h.commands.length, 0);

  // Esc should cancel second-point stage but keep target selected
  h.esc();
  assert.deepEqual(h.selection.entityIds, [10]);

  // single-point break should now execute normally
  h.pointer({ x: 4, y: 0 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.break',
    payload: { targetId: 10, pick: { x: 4, y: 0 } },
  });

  // pick another target and run two-point break end-to-end
  h.pointer({ hitId: 11, x: 0, y: 0 });
  h.pointer({ x: 2, y: 0, shiftKey: true });
  h.pointer({ x: 8, y: 0 });
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1], {
    id: 'selection.break',
    payload: { targetId: 11, pick: { x: 2, y: 0 }, pick2: { x: 8, y: 0 } },
  });
});

test('break tool two-point closed polyline uses toolOptions.breakKeep override', () => {
  const h = createBreakToolHarness({
    toolOptions: { breakKeep: 'short' },
    entityById: {
      11: {
        id: 11,
        type: 'polyline',
        layerId: 0,
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    },
  });

  h.pointer({ hitId: 11, x: 0, y: 0 });
  h.pointer({ x: 2, y: 0, shiftKey: true });
  h.pointer({ x: 8, y: 0 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.break',
    payload: { targetId: 11, pick: { x: 2, y: 0 }, pick2: { x: 8, y: 0 }, keep: 'short' },
  });
});

test('fillet tool picks two lines and executes selection.filletByPick with radius from command input', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'] });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool allows picking two segments on the same polyline (same id)', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], entityTypeById: { 10: 'polyline' } });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  h.pointer({ hitId: 10, x: 10, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 10,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10]);
});

test('chamfer tool picks two lines and executes selection.chamferByPick with d1/d2 from command input', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, { commandArgs: ['2', '3'] });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20, 21]);
});

test('chamfer tool allows picking two segments on the same polyline (same id)', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, { commandArgs: ['2', '3'], entityTypeById: { 20: 'polyline' } });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  h.pointer({ hitId: 20, x: 10, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 20,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20]);
});

test('fillet tool Escape resets first pick before completing two-line operation', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['1.5'] });

  h.pointer({ hitId: 1, x: 1, y: 0 });
  h.esc();
  h.pointer({ hitId: 2, x: 2, y: 0 });
  h.pointer({ hitId: 3, x: 0, y: 3 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 2,
      secondId: 3,
      pick1: { x: 2, y: 0 },
      pick2: { x: 0, y: 3 },
      radius: 1.5,
    },
  });
  assert.deepEqual(h.selection.entityIds, [2, 3]);
});
