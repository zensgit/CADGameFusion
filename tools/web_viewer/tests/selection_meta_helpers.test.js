import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeReadOnlySelectionEntity,
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerFlags,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
  listSelectionLayerFlags,
} from '../ui/selection_meta_helpers.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
    type: 'line',
    layerId: 7,
    ...overrides,
  };
}

function makeLayer(overrides = {}) {
  return {
    id: 7,
    name: 'A-WALL',
    color: '#00ff00',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
    ...overrides,
  };
}

function getLayerFactory(layer = null) {
  return (layerId) => (layer && layer.id === layerId ? layer : null);
}

test('isReadOnlySelectionEntity detects explicit read-only, unsupported, and proxy entities', () => {
  assert.equal(isReadOnlySelectionEntity(makeEntity()), false);
  assert.equal(isReadOnlySelectionEntity(makeEntity({ readOnly: true })), true);
  assert.equal(isReadOnlySelectionEntity(makeEntity({ type: 'unsupported' })), true);
  assert.equal(isReadOnlySelectionEntity(makeEntity({ editMode: 'proxy' })), true);
});

test('describeReadOnlySelectionEntity preserves unsupported and source/proxy descriptions', () => {
  assert.equal(describeReadOnlySelectionEntity(null), 'read-only proxy');
  assert.equal(describeReadOnlySelectionEntity(makeEntity({ type: 'unsupported' })), 'unsupported proxy');
  assert.equal(
    describeReadOnlySelectionEntity(makeEntity({ sourceType: 'INSERT', proxyKind: 'fragment' })),
    'INSERT fragment proxy',
  );
  assert.equal(
    describeReadOnlySelectionEntity(makeEntity({ sourceType: 'DIMENSION' })),
    'DIMENSION derived proxy',
  );
});

test('describeSelectionOrigin preserves separator and optional read-only suffix behavior', () => {
  const entity = makeEntity({ sourceType: 'INSERT', proxyKind: 'fragment', editMode: 'proxy' });
  assert.equal(describeSelectionOrigin(entity), 'INSERT / fragment / proxy');
  assert.equal(describeSelectionOrigin(entity, { separator: ' | ' }), 'INSERT | fragment | proxy');

  const readOnlyEntity = makeEntity({ sourceType: 'DIMENSION', readOnly: true });
  assert.equal(
    describeSelectionOrigin(readOnlyEntity, { includeReadOnly: true }),
    'DIMENSION / read-only',
  );
});

test('formatSelectionLayer and formatSelectionLayerColor preserve named, unnamed, and missing layer output', () => {
  const layer = makeLayer();
  const getLayer = getLayerFactory(layer);
  assert.equal(formatSelectionLayer(makeEntity(), getLayer), '7:A-WALL');
  assert.equal(formatSelectionLayerColor(makeEntity(), getLayer), '#00ff00');

  const unnamedLayer = makeLayer({ name: '   ' });
  assert.equal(formatSelectionLayer(makeEntity(), getLayerFactory(unnamedLayer)), '7');

  assert.equal(formatSelectionLayer(makeEntity({ layerId: null }), getLayer), '');
  assert.equal(formatSelectionLayerColor(makeEntity(), null), '');
});

test('listSelectionLayerFlags and formatSelectionLayerFlags preserve layer state flag ordering', () => {
  const layer = makeLayer({ visible: false, locked: true, frozen: true, printable: false, construction: true });
  const getLayer = getLayerFactory(layer);
  assert.deepEqual(listSelectionLayerFlags(makeEntity(), getLayer), [
    'Hidden',
    'Locked',
    'Frozen',
    'NoPrint',
    'Construction',
  ]);
  assert.equal(
    formatSelectionLayerFlags(makeEntity(), getLayer),
    'Hidden / Locked / Frozen / NoPrint / Construction',
  );
  assert.equal(
    formatSelectionLayerFlags(makeEntity(), getLayer, { separator: ' | ' }),
    'Hidden | Locked | Frozen | NoPrint | Construction',
  );
});

test('formatSelectionLayerState preserves combined shown/open/live/print/normal state summary', () => {
  const layer = makeLayer();
  assert.equal(
    formatSelectionLayerState(makeEntity(), getLayerFactory(layer)),
    'Shown / Open / Live / Print / Normal',
  );
  assert.equal(formatSelectionLayerState(makeEntity(), null), '');
});
