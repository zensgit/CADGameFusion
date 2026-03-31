import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelSelectionContextState } from '../ui/property_panel_selection_context_state.js';

test('empty classification when selectionIds is empty', () => {
  const state = buildPropertyPanelSelectionContextState({
    selectionIds: [],
    primaryId: null,
    entities: [],
    primary: null,
  });

  assert.equal(state.kind, 'empty');
  assert.deepEqual(state.selectionIds, []);
  assert.deepEqual(state.entities, []);
  assert.equal(state.primary, null);
  assert.deepEqual(state.presentationEntities, []);
  assert.equal(state.presentationPrimaryId, null);
});

test('missing classification when selectionIds non-empty but no entities resolved', () => {
  const state = buildPropertyPanelSelectionContextState({
    selectionIds: [7, 8],
    primaryId: 7,
    entities: [],
    primary: null,
  });

  assert.equal(state.kind, 'missing');
  assert.deepEqual(state.selectionIds, [7, 8]);
  assert.deepEqual(state.entities, []);
  assert.equal(state.primary, null);
  assert.deepEqual(state.presentationEntities, []);
  assert.equal(state.presentationPrimaryId, 7);
});

test('active classification when entities exist', () => {
  const entity = { id: 1, type: 'line' };
  const state = buildPropertyPanelSelectionContextState({
    selectionIds: [1],
    primaryId: 1,
    entities: [entity],
    primary: entity,
  });

  assert.equal(state.kind, 'active');
  assert.deepEqual(state.selectionIds, [1]);
  assert.equal(state.entities.length, 1);
  assert.equal(state.primary, entity);
  assert.equal(state.presentationEntities, state.entities);
  assert.equal(state.presentationPrimaryId, 1);
});

test('active presentationPrimaryId uses primary.id when primary exists', () => {
  const entity1 = { id: 1, type: 'line' };
  const entity2 = { id: 2, type: 'circle' };
  const state = buildPropertyPanelSelectionContextState({
    selectionIds: [1, 2],
    primaryId: 999,
    entities: [entity1, entity2],
    primary: entity1,
  });

  assert.equal(state.presentationPrimaryId, 1);
});

test('active presentationPrimaryId falls back to primaryId when primary has no id', () => {
  const entity = { type: 'line' };
  const state = buildPropertyPanelSelectionContextState({
    selectionIds: [1],
    primaryId: 5,
    entities: [entity],
    primary: entity,
  });

  assert.equal(state.presentationPrimaryId, 5);
});

test('empty and missing clear presentation entities regardless of resolution entities', () => {
  const emptyState = buildPropertyPanelSelectionContextState({
    selectionIds: [],
    primaryId: null,
    entities: [{ id: 1 }],
    primary: { id: 1 },
  });
  assert.deepEqual(emptyState.presentationEntities, []);
  assert.equal(emptyState.primary, null);

  const missingState = buildPropertyPanelSelectionContextState({
    selectionIds: [99],
    primaryId: 99,
    entities: [],
    primary: null,
  });
  assert.deepEqual(missingState.presentationEntities, []);
});
