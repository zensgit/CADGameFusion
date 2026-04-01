import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePropertyPanelSelectionContext } from '../ui/property_panel_selection_context.js';

function createDocumentState({ entities = [], layers = [] } = {}) {
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const layerMap = new Map(layers.map((layer) => [layer.id, layer]));
  return {
    getEntity(id) {
      return entityMap.get(id) || null;
    },
    getLayer(id) {
      return layerMap.get(id) || null;
    },
    listEntities() {
      return entities;
    },
  };
}

test('resolvePropertyPanelSelectionContext preserves empty-selection presentation', () => {
  const context = resolvePropertyPanelSelectionContext(
    { entityIds: [], primaryId: null },
    createDocumentState(),
  );

  assert.equal(context.kind, 'empty');
  assert.deepEqual(context.selectionIds, []);
  assert.equal(context.primary, null);
  assert.equal(context.presentation.mode, 'empty');
  assert.equal(context.presentation.summaryText, 'No selection');
});

test('resolvePropertyPanelSelectionContext preserves missing-entity selection as empty presentation', () => {
  const context = resolvePropertyPanelSelectionContext(
    { entityIds: [7], primaryId: 7 },
    createDocumentState(),
  );

  assert.equal(context.kind, 'missing');
  assert.deepEqual(context.selectionIds, [7]);
  assert.deepEqual(context.entities, []);
  assert.equal(context.presentation.mode, 'empty');
  assert.equal(context.presentation.summaryText, 'No selection');
});

test('resolvePropertyPanelSelectionContext preserves active-selection primary fallback and presentation', () => {
  const entities = [{
    id: 11,
    type: 'line',
    layerId: 1,
    visible: true,
    color: '#9ca3af',
    colorSource: 'BYLAYER',
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineTypeScale: 1,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    space: 0,
    layout: 'Model',
  }, {
    id: 12,
    type: 'text',
    layerId: 1,
    visible: true,
    color: '#9ca3af',
    colorSource: 'BYLAYER',
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineTypeScale: 1,
    position: { x: 5, y: 5 },
    value: 'A',
    height: 2.5,
    rotation: 0,
    space: 0,
    layout: 'Model',
  }];
  const layers = [{
    id: 1,
    name: 'L1',
    color: '#9ca3af',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
  }];

  const context = resolvePropertyPanelSelectionContext(
    { entityIds: [11, 12], primaryId: 999 },
    createDocumentState({ entities, layers }),
  );

  assert.equal(context.kind, 'active');
  assert.deepEqual(context.selectionIds, [11, 12]);
  assert.equal(context.primary.id, 11);
  assert.equal(context.entities.length, 2);
  assert.equal(context.presentation.mode, 'multiple');
  assert.equal(context.presentation.summaryText, '2 selected (line, text)');
});
