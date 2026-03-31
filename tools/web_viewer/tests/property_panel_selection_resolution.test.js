import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelSelectionResolution } from '../ui/property_panel_selection_resolution.js';

function createDocumentState({ entities = [], layers = [] } = {}) {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return {
    getEntity(id) { return entityMap.get(id) || null; },
    getLayer(id) { return layerMap.get(id) || null; },
    listEntities() { return entities; },
  };
}

test('selectionIds filters non-finite values', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [1, null, undefined, NaN, 'a', 2], primaryId: 1 },
    createDocumentState({ entities: [{ id: 1 }, { id: 2 }] }),
  );
  assert.deepEqual(res.selectionIds, [1, 2]);
});

test('selectionIds defaults to empty array when entityIds missing', () => {
  const res = buildPropertyPanelSelectionResolution({}, createDocumentState());
  assert.deepEqual(res.selectionIds, []);
});

test('primaryId normalizes to numeric or null', () => {
  const res1 = buildPropertyPanelSelectionResolution(
    { entityIds: [], primaryId: 5 },
    createDocumentState(),
  );
  assert.equal(res1.primaryId, 5);

  const res2 = buildPropertyPanelSelectionResolution(
    { entityIds: [], primaryId: 'bad' },
    createDocumentState(),
  );
  assert.equal(res2.primaryId, null);

  const res3 = buildPropertyPanelSelectionResolution(
    { entityIds: [], primaryId: null },
    createDocumentState(),
  );
  assert.equal(res3.primaryId, null);
});

test('entities resolves only existing entities from documentState', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [1, 2, 3], primaryId: 1 },
    createDocumentState({ entities: [{ id: 1, type: 'line' }, { id: 3, type: 'circle' }] }),
  );
  assert.equal(res.entities.length, 2);
  assert.equal(res.entities[0].id, 1);
  assert.equal(res.entities[1].id, 3);
});

test('primary resolves from primaryId when entity exists', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [1, 2], primaryId: 2 },
    createDocumentState({ entities: [{ id: 1, type: 'line' }, { id: 2, type: 'circle' }] }),
  );
  assert.equal(res.primary.id, 2);
});

test('primary falls back to first resolved entity when primaryId not found', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [1, 2], primaryId: 999 },
    createDocumentState({ entities: [{ id: 1, type: 'line' }, { id: 2, type: 'circle' }] }),
  );
  assert.equal(res.primary.id, 1);
});

test('primary is null when no entities resolve', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [99], primaryId: 99 },
    createDocumentState(),
  );
  assert.equal(res.primary, null);
});

test('primary is null when selectionIds is empty', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [], primaryId: 1 },
    createDocumentState({ entities: [{ id: 1, type: 'line' }] }),
  );
  assert.equal(res.primary, null);
});

test('getLayer delegates to documentState', () => {
  const layer = { id: 5, name: 'L5' };
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [] },
    createDocumentState({ layers: [layer] }),
  );
  assert.equal(res.getLayer(5), layer);
  assert.equal(res.getLayer(999), null);
});

test('listEntities delegates to documentState', () => {
  const entities = [{ id: 1 }, { id: 2 }];
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [] },
    createDocumentState({ entities }),
  );
  assert.equal(res.listEntities(), entities);
});

test('works without documentState', () => {
  const res = buildPropertyPanelSelectionResolution(
    { entityIds: [1, 2], primaryId: 1 },
    null,
  );
  assert.deepEqual(res.selectionIds, [1, 2]);
  assert.equal(res.primaryId, 1);
  assert.deepEqual(res.entities, []);
  assert.equal(res.primary, null);
  assert.equal(res.getLayer(1), null);
  assert.deepEqual(res.listEntities(), []);
});
