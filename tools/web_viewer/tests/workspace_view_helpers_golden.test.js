import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { ViewState } from '../state/viewState.js';
import { SelectionState } from '../state/selectionState.js';
import {
  computeDocumentExtents,
  fitViewToExtents,
  fitViewToDocument,
  resolveSourceTextGuideForSelection,
} from '../ui/workspace.js';

// Golden / characterization tests for the PURE view-fit + source-text helpers in
// workspace.js. These are the first functions the workbench-split Phase 2 extracts
// (to selection/view_fit.js + selection/source_text_focus.js), so pinning their
// input->output now lets that extraction proceed without silent regressions.
// They are pure (DocumentState/ViewState/SelectionState + a plain {clientWidth,clientHeight}
// canvas stub), so no DOM/canvas-context is needed — the full bootstrapCadWorkspace
// contract is browser-level and stays covered by the Playwright editor smokes.
// Pins observable input->output, NOT internal iteration order or numeric thresholds.

function approxEqual(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ~= ${expected}`);
}

const canvas800x600 = { clientWidth: 800, clientHeight: 600 };

test('golden: computeDocumentExtents bounds line + circle; empty document => null', () => {
  const doc = new DocumentState();
  doc.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, layerId: 0 });
  doc.addEntity({ type: 'circle', center: { x: 50, y: 50 }, radius: 10, layerId: 0 });
  // line spans x[0,100] y{0}; circle adds center +/- radius => x[40,60] y[40,60]
  assert.deepEqual(computeDocumentExtents(doc), { minX: 0, minY: 0, maxX: 100, maxY: 60 });

  assert.equal(computeDocumentExtents(new DocumentState()), null);
});

test('golden: fitViewToExtents fits extents to canvas (zoom/pan) and returns true', () => {
  const viewState = new ViewState();
  const ok = fitViewToExtents({
    viewState,
    canvas: canvas800x600,
    extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  });
  assert.equal(ok, true);
  // zoom = min((800-112)/100, (600-112)/100) = min(6.88, 4.88) = 4.88
  approxEqual(viewState.zoom, 4.88);
  // pan = canvasCenter - extentCenter * zoom
  approxEqual(viewState.pan.x, 156); // 400 - 50*4.88
  approxEqual(viewState.pan.y, 56); //  300 - 50*4.88
});

test('golden: fitViewToExtents returns false on null extents (no mutation)', () => {
  const viewState = new ViewState();
  const before = { zoom: viewState.zoom, pan: { ...viewState.pan } };
  assert.equal(fitViewToExtents({ viewState, canvas: canvas800x600, extents: null }), false);
  assert.equal(viewState.zoom, before.zoom);
  assert.deepEqual(viewState.pan, before.pan);
});

test('golden: fitViewToExtents clamps zoom to viewState.maxZoom for tiny extents', () => {
  const viewState = new ViewState();
  fitViewToExtents({
    viewState,
    canvas: canvas800x600,
    extents: { minX: 0, minY: 0, maxX: 0.5, maxY: 0.5 }, // huge raw zoom -> clamped
  });
  assert.equal(viewState.zoom, viewState.maxZoom);
});

test('golden: fitViewToDocument composes extents + fit', () => {
  const doc = new DocumentState();
  doc.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, layerId: 0 });
  doc.addEntity({ type: 'circle', center: { x: 50, y: 50 }, radius: 10, layerId: 0 });
  const viewState = new ViewState();
  fitViewToDocument({ documentState: doc, viewState, canvas: canvas800x600 });
  // extents {0,0,100,60}: zoom = min((800-112)/100, (600-112)/60) = min(6.88, 8.133) = 6.88
  approxEqual(viewState.zoom, 6.88);
  approxEqual(viewState.pan.x, 56); //  400 - 50*6.88
  approxEqual(viewState.pan.y, 93.6); // 300 - 30*6.88
});

test('golden: resolveSourceTextGuideForSelection — empty selection and plain entity', () => {
  const doc = new DocumentState();
  const line = doc.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 });

  // empty selection -> no primary, no guide
  assert.deepEqual(resolveSourceTextGuideForSelection(doc, new SelectionState()), {
    primary: null,
    guide: null,
  });

  // a plain (non source-group) entity -> primary present, guide null
  const selection = new SelectionState();
  selection.entityIds = [line.id];
  selection.primaryId = line.id;
  const resolved = resolveSourceTextGuideForSelection(doc, selection);
  assert.equal(resolved.primary.id, line.id);
  assert.equal(resolved.guide, null);
});
