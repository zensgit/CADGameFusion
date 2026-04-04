import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionPresentation } from '../ui/selection_presentation.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
    type: 'line',
    layerId: 1,
    visible: true,
    color: '#fff',
    colorSource: 'BYLAYER',
    space: 0,
    layout: 'Model',
    ...overrides,
  };
}

function makeLayer(overrides = {}) {
  return {
    id: 1,
    name: 'L1',
    color: '#fff',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
    ...overrides,
  };
}

function makeOptions(layers = []) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return { getLayer: (id) => layerMap.get(id) || null };
}

test('empty selection returns mode=empty, entityCount=0, primary=null', () => {
  const result = buildSelectionPresentation([], null);
  assert.equal(result.mode, 'empty');
  assert.equal(result.entityCount, 0);
  assert.equal(result.primary, null);
  assert.equal(result.primaryLayer, null);
});

test('single selection uses the requested primary and resolves primaryLayer', () => {
  const layer = makeLayer({ id: 5, name: 'Walls' });
  const entity = makeEntity({ id: 10, layerId: 5 });
  const result = buildSelectionPresentation([entity], 10, makeOptions([layer]));
  assert.equal(result.mode, 'single');
  assert.equal(result.entityCount, 1);
  assert.equal(result.primary, entity);
  assert.equal(result.primaryLayer, layer);
});

test('single selection falls back to first entity when primaryId misses', () => {
  const entity = makeEntity({ id: 10 });
  const result = buildSelectionPresentation([entity], 999);
  assert.equal(result.mode, 'single');
  assert.equal(result.primary, entity);
});

test('multi selection returns mode=multiple', () => {
  const a = makeEntity({ id: 1, type: 'line' });
  const b = makeEntity({ id: 2, type: 'circle' });
  const result = buildSelectionPresentation([a, b], 1);
  assert.equal(result.mode, 'multiple');
  assert.equal(result.entityCount, 2);
});

test('single selection uses buildSelectionDetailFacts', () => {
  const entity = makeEntity({ id: 1 });
  const result = buildSelectionPresentation([entity], 1);
  assert.ok(Array.isArray(result.detailFacts));
  // Single-entity detail facts are produced by buildSelectionDetailFacts
  assert.equal(result.mode, 'single');
});

test('multi selection uses buildMultiSelectionDetailFacts', () => {
  const a = makeEntity({ id: 1 });
  const b = makeEntity({ id: 2 });
  const result = buildSelectionPresentation([a, b], 1);
  assert.ok(Array.isArray(result.detailFacts));
  assert.equal(result.mode, 'multiple');
});
