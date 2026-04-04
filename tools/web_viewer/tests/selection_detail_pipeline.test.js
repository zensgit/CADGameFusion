import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionDetailPipeline } from '../ui/selection_detail_pipeline.js';

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

function makeContext(overrides = {}) {
  return {
    getLayer: () => null,
    listEntities: () => [],
    effectiveColor: '#9ca3af',
    effectiveStyle: { lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1 },
    styleSources: { lineTypeSource: 'entity', lineWeightSource: 'entity', lineTypeScaleSource: 'entity' },
    releasedInsertArchive: null,
    sourceGroupSummary: null,
    insertGroupSummary: null,
    insertPeerSummary: null,
    releasedInsertPeerSummary: null,
    sourceTextGuide: null,
    ...overrides,
  };
}

test('pipeline returns base facts in expected order', () => {
  const entity = makeEntity();
  const layer = makeLayer();
  const context = makeContext({ getLayer: () => layer });
  const facts = buildSelectionDetailPipeline(entity, context);

  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('layer'), 'missing layer');
  assert.ok(keys.includes('effective-color'), 'missing effective-color');
  assert.ok(keys.includes('line-type'), 'missing line-type');
  assert.ok(keys.indexOf('layer') < keys.indexOf('effective-color'), 'layer should come before effective-color');
  assert.ok(keys.indexOf('effective-color') < keys.indexOf('line-type'), 'effective-color should come before line-type');
});

test('pipeline uses source-group branch when insertGroupSummary is null', () => {
  const entity = makeEntity({
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    groupId: 100,
    sourceBundleId: 101,
    editMode: 'proxy',
    readOnly: true,
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
  const allEntities = [entity, member];
  const context = makeContext({
    getLayer: () => makeLayer(),
    listEntities: () => allEntities,
    sourceGroupSummary: {
      groupId: 100,
      sourceBundleId: 101,
      sourceType: 'DIMENSION',
      memberIds: [1, 2],
      editableIds: [1, 2],
      readOnlyIds: [],
    },
    insertGroupSummary: null,
  });

  const facts = buildSelectionDetailPipeline(entity, context);
  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('group-id'), 'missing group-id');
  assert.ok(keys.includes('source-group-members'), 'missing source-group-members');
  assert.ok(!keys.includes('insert-group-members'), 'should not have insert-group-members');
});

test('pipeline uses insert-group branch when insertGroupSummary is present', () => {
  const entity = makeEntity({
    type: 'text',
    groupId: 500,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
    position: { x: 0, y: 20 },
  });
  const member = makeEntity({
    id: 2,
    type: 'line',
    groupId: 500,
    sourceType: 'INSERT',
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
    start: { x: -18, y: 20 },
    end: { x: 18, y: 34 },
  });
  const allEntities = [entity, member];
  const context = makeContext({
    getLayer: () => makeLayer(),
    listEntities: () => allEntities,
    insertGroupSummary: {
      groupId: 500,
      sourceType: 'INSERT',
      blockName: 'DoorTag',
      memberIds: [1, 2],
      editableIds: [1, 2],
      readOnlyIds: [],
    },
    insertPeerSummary: null,
  });

  const facts = buildSelectionDetailPipeline(entity, context);
  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('insert-group-members'), 'missing insert-group-members');
  assert.ok(!keys.includes('source-group-members'), 'should not have source-group-members');
});

test('pipeline passes through released peer summary rows', () => {
  const entity = makeEntity({
    id: 1,
    type: 'text',
    space: 1,
    layout: 'Layout-A',
  });
  const context = makeContext({
    getLayer: () => makeLayer(),
    releasedInsertPeerSummary: {
      peerCount: 3,
      currentIndex: 0,
      peers: [
        { space: 1, layout: 'Layout-A' },
        { space: 1, layout: 'Layout-B' },
        { space: 1, layout: 'Layout-C' },
      ],
    },
  });

  const facts = buildSelectionDetailPipeline(entity, context);
  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));
  assert.equal(byKey['released-peer-instance'], '1 / 3');
  assert.equal(byKey['released-peer-instances'], '3');
});

test('pipeline passes through source text guide rows', () => {
  const entity = makeEntity({
    type: 'text',
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    groupId: 100,
    editMode: 'proxy',
    position: { x: 5, y: 10 },
    sourceTextPos: { x: 5, y: 10 },
    sourceTextRotation: 0,
  });
  const anchor = makeEntity({ id: 2, type: 'line', groupId: 100, start: { x: 0, y: 0 }, end: { x: 20, y: 0 } });
  const allEntities = [entity, anchor];
  const context = makeContext({
    getLayer: () => makeLayer(),
    listEntities: () => allEntities,
    sourceGroupSummary: {
      groupId: 100,
      sourceType: 'DIMENSION',
      memberIds: [1, 2],
      editableIds: [1, 2],
      readOnlyIds: [],
    },
    sourceTextGuide: {
      anchor: { x: 0, y: 0 },
      anchorDriver: { entityId: 2, entityType: 'line', kind: 'midpoint' },
      sourceOffset: { x: 0, y: 14 },
      currentOffset: { x: 5, y: 10 },
    },
  });

  const facts = buildSelectionDetailPipeline(entity, context);
  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('source-text-pos'), 'missing source-text-pos');
  assert.ok(keys.includes('source-text-rotation'), 'missing source-text-rotation');
  assert.ok(keys.includes('source-anchor'), 'missing source-anchor');
});

test('pipeline appends rows in correct order: base, archive, group, released-peer, line-style, guide', () => {
  const entity = makeEntity({
    id: 1,
    type: 'text',
    space: 1,
    layout: 'Layout-A',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      groupId: 700,
      blockName: 'AttdefBlock',
      textKind: 'attdef',
      attributeTag: 'ATTDEF_TAG',
    },
    sourceTextPos: { x: 5, y: 10 },
    sourceTextRotation: 0,
    position: { x: 5, y: 10 },
  });
  const context = makeContext({
    getLayer: () => makeLayer(),
    releasedInsertArchive: {
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      groupId: 700,
      blockName: 'AttdefBlock',
      textKind: 'attdef',
      attributeTag: 'ATTDEF_TAG',
    },
    releasedInsertPeerSummary: {
      peerCount: 2,
      currentIndex: 0,
      peers: [
        { space: 1, layout: 'Layout-A' },
        { space: 1, layout: 'Layout-B' },
      ],
    },
    sourceTextGuide: {
      anchor: { x: 0, y: 0 },
      anchorDriver: { entityId: 2, entityType: 'line', kind: 'midpoint' },
      sourceOffset: { x: 0, y: 14 },
      currentOffset: { x: 5, y: 10 },
    },
  });

  const facts = buildSelectionDetailPipeline(entity, context);
  const keys = facts.map((f) => f.key);

  // Base facts come first
  const layerIdx = keys.indexOf('layer');
  // Released archive identity/attribute rows
  const releasedFromIdx = keys.indexOf('released-from');
  // Released peer rows
  const releasedPeerIdx = keys.indexOf('released-peer-instance');
  // Line-style rows
  const lineTypeIdx = keys.indexOf('line-type');
  // Source text guide rows
  const sourceTextIdx = keys.indexOf('source-text-pos');

  assert.ok(layerIdx >= 0, 'missing layer');
  assert.ok(releasedFromIdx >= 0, 'missing released-from');
  assert.ok(releasedPeerIdx >= 0, 'missing released-peer-instance');
  assert.ok(lineTypeIdx >= 0, 'missing line-type');
  assert.ok(sourceTextIdx >= 0, 'missing source-text-pos');

  assert.ok(layerIdx < releasedFromIdx, 'base facts should precede released archive rows');
  assert.ok(releasedFromIdx < releasedPeerIdx, 'released archive rows should precede released peer rows');
  assert.ok(releasedPeerIdx < lineTypeIdx, 'released peer rows should precede line-style rows');
  assert.ok(lineTypeIdx < sourceTextIdx, 'line-style rows should precede source text guide rows');
});
