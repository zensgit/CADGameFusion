import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionDetailContext } from '../ui/selection_detail_context.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
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
    ...overrides,
  };
}

function makeLayer(overrides = {}) {
  return {
    id: 1,
    name: 'L1',
    color: '#9ca3af',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
    ...overrides,
  };
}

test('buildSelectionDetailContext normalizes collaborator fallbacks and resolves style context', () => {
  const layer = makeLayer();
  const context = buildSelectionDetailContext(makeEntity(), {
    getLayer: (id) => (id === 1 ? layer : null),
    listEntities: null,
  });

  assert.equal(typeof context.getLayer, 'function');
  assert.equal(context.listEntities, null);
  assert.equal(context.layer, layer);
  assert.equal(context.effectiveColor, '#9ca3af');
  assert.equal(context.styleSources.colorSource, 'BYLAYER');
  assert.equal(context.entities, null);
  assert.equal(context.sourceGroupSummary, null);
  assert.equal(context.insertGroupSummary, null);
  assert.equal(context.releasedInsertArchive, null);
  assert.equal(context.sourceTextGuide, null);
});

test('buildSelectionDetailContext keeps invalid listEntities payload from creating summaries', () => {
  const entities = { invalid: true };
  const context = buildSelectionDetailContext(makeEntity({
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    groupId: 100,
  }), {
    getLayer: () => makeLayer(),
    listEntities: () => entities,
  });

  assert.equal(context.entities, entities);
  assert.equal(context.sourceGroupSummary, null);
  assert.equal(context.insertGroupSummary, null);
  assert.equal(context.sourceTextGuide, null);
});

test('buildSelectionDetailContext resolves source-group summary for grouped source entities', () => {
  const entity = makeEntity({
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    groupId: 100,
    sourceBundleId: 101,
    editMode: 'proxy',
  });
  const member = makeEntity({
    id: 2,
    type: 'line',
    groupId: 100,
    sourceBundleId: 101,
    sourceType: 'DIMENSION',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 14 },
  });

  const context = buildSelectionDetailContext(entity, {
    getLayer: () => makeLayer(),
    listEntities: () => [entity, member],
  });

  assert.deepEqual(context.sourceGroupSummary.memberIds, [1, 2]);
  assert.equal(context.insertGroupSummary, null);
  assert.equal(context.insertPeerSummary, null);
});

test('buildSelectionDetailContext resolves insert-group and peer summaries for insert entities', () => {
  const entity = makeEntity({
    type: 'text',
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
  });
  const member = makeEntity({
    id: 2,
    type: 'line',
    sourceType: 'INSERT',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
  });
  const peer = makeEntity({
    id: 3,
    type: 'text',
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-C',
  });

  const context = buildSelectionDetailContext(entity, {
    getLayer: () => makeLayer(),
    listEntities: () => [entity, member, peer],
  });

  assert.deepEqual(context.insertGroupSummary.memberIds, [1, 2]);
  assert.equal(context.insertPeerSummary.peerCount, 2);
  assert.equal(context.insertPeerSummary.currentIndex, 0);
});

test('buildSelectionDetailContext resolves released insert archive and peer summary', () => {
  const entity = makeEntity({
    type: 'text',
    sourceType: 'INSERT',
    proxyKind: 'text',
    space: 1,
    layout: 'Layout-B',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      groupId: 900,
      blockName: 'DoorTag',
    },
  });
  const peerA = makeEntity({
    id: 2,
    type: 'text',
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 900,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
  });
  const peerB = makeEntity({
    id: 3,
    type: 'text',
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 900,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-C',
  });

  const context = buildSelectionDetailContext(entity, {
    getLayer: () => makeLayer(),
    listEntities: () => [peerA, peerB],
  });

  assert.equal(context.releasedInsertArchive.groupId, 900);
  assert.equal(context.releasedInsertPeerSummary.peerCount, 2);
  assert.equal(context.releasedInsertPeerSummary.currentIndex, 0);
});

test('buildSelectionDetailContext resolves source text guide when grouped text has guide data', () => {
  const anchor = makeEntity({
    id: 31,
    type: 'line',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -10, y: 0 },
    end: { x: 10, y: 0 },
    space: 1,
    layout: 'Layout-A',
  });
  const text = makeEntity({
    id: 34,
    type: 'text',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 4, y: 18 },
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    rotation: 0.5,
    space: 1,
    layout: 'Layout-A',
  });

  const context = buildSelectionDetailContext(text, {
    getLayer: () => makeLayer(),
    listEntities: () => [anchor, text],
  });

  assert.equal(context.sourceTextGuide.anchor.x, 0);
  assert.equal(context.sourceTextGuide.anchor.y, 0);
  assert.equal(context.sourceTextGuide.anchorDriverId, 31);
});
