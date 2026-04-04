import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionDetailFacts, buildMultiSelectionDetailFacts } from '../ui/selection_detail_facts.js';

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

function makeOptions(layers = [], entities = []) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return {
    getLayer: (id) => layerMap.get(id) || null,
    listEntities: () => entities,
  };
}

test('buildSelectionDetailFacts returns empty array for null entity', () => {
  assert.deepEqual(buildSelectionDetailFacts(null), []);
});

test('buildSelectionDetailFacts includes origin, layer, effective-color, style facts', () => {
  const entity = makeEntity();
  const layer = makeLayer();
  const facts = buildSelectionDetailFacts(entity, makeOptions([layer], [entity]));

  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('layer'), 'missing layer');
  assert.ok(keys.includes('layer-color'), 'missing layer-color');
  assert.ok(keys.includes('layer-state'), 'missing layer-state');
  assert.ok(keys.includes('entity-visibility'), 'missing entity-visibility');
  assert.ok(keys.includes('effective-color'), 'missing effective-color');
  assert.ok(keys.includes('color-source'), 'missing color-source');
  assert.ok(keys.includes('space'), 'missing space');
  assert.ok(keys.includes('layout'), 'missing layout');
  assert.ok(keys.includes('line-type'), 'missing line-type');
  assert.ok(keys.includes('line-weight-source'), 'missing line-weight-source');
  assert.ok(keys.includes('line-type-scale'), 'missing line-type-scale');

  assert.equal(facts.find((f) => f.key === 'layer').value, '1:L1');
  assert.equal(facts.find((f) => f.key === 'effective-color').swatch, '#9ca3af');
});

test('buildSelectionDetailFacts includes source-group facts for grouped entity', () => {
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
  const layer = makeLayer();
  const facts = buildSelectionDetailFacts(entity, makeOptions([layer], [entity, member]));

  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('origin'), 'missing origin');
  assert.ok(keys.includes('group-id'), 'missing group-id');
  assert.equal(facts.find((f) => f.key === 'group-id').value, '100');
  assert.equal(facts.find((f) => f.key === 'source-group-members').value, '2');
  assert.equal(facts.find((f) => f.key === 'group-center').value, '0, 7');
  assert.equal(facts.find((f) => f.key === 'group-bounds').value, '-20, 0 -> 20, 14');
});

test('buildSelectionDetailFacts preserves insert-group peer rows without insert-only identity duplicates', () => {
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
  const peer = makeEntity({
    id: 3,
    type: 'text',
    groupId: 500,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'DoorTag',
    position: { x: 50, y: 20 },
    space: 1,
    layout: 'Layout-C',
  });
  const facts = buildSelectionDetailFacts(entity, makeOptions([makeLayer()], [entity, member, peer]));
  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));

  assert.equal(byKey['insert-group-members'], '2');
  assert.equal(byKey['group-source'], 'INSERT / text');
  assert.equal(byKey['group-center'], '0, 27');
  assert.equal(byKey['group-bounds'], '-18, 20 -> 18, 34');
  assert.equal(byKey['peer-instance'], '1 / 2');
  assert.equal(byKey['peer-instances'], '2');
  assert.equal(byKey['peer-layouts'], 'Paper / Layout-B | Paper / Layout-C');
  assert.equal(byKey['peer-targets'], '1: Paper / Layout-B | 2: Paper / Layout-C');
  assert.equal(byKey['block-name'], 'DoorTag');
  assert.equal(facts.filter((fact) => fact.key === 'group-id').length, 1);
  assert.equal(facts.filter((fact) => fact.key === 'block-name').length, 1);
});

test('buildSelectionDetailFacts includes source text position for editable source text', () => {
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
  const layer = makeLayer();
  const facts = buildSelectionDetailFacts(entity, makeOptions([layer], [entity, anchor]));

  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('source-text-pos'), 'missing source-text-pos');
  assert.ok(keys.includes('source-text-rotation'), 'missing source-text-rotation');
  assert.equal(facts.find((f) => f.key === 'source-text-pos').value, '5, 10');
});

test('buildSelectionDetailFacts includes DIMENSION source guide rows for editable source text', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 1,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -10, y: 0 },
    end: { x: 10, y: 0 },
  }, {
    id: 34,
    type: 'text',
    layerId: 1,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 4, y: 18 },
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    rotation: 0.5,
  }];

  const facts = buildSelectionDetailFacts(entities[1], makeOptions([makeLayer({ id: 1, name: 'REF' })], entities));
  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));

  assert.equal(byKey['source-anchor'], '0, 0');
  assert.equal(byKey['source-anchor-driver'], '31:line midpoint');
  assert.equal(byKey['source-offset'], '0, 14');
  assert.equal(byKey['current-offset'], '4, 18');
});

test('buildSelectionDetailFacts includes LEADER landing rows for editable source text', () => {
  const entities = [{
    id: 41,
    type: 'line',
    layerId: 1,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    start: { x: 50, y: 0 },
    end: { x: 56, y: 6 },
  }, {
    id: 42,
    type: 'text',
    layerId: 1,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    position: { x: 63, y: 9 },
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    rotation: 0.3926990817,
  }];

  const facts = buildSelectionDetailFacts(entities[1], makeOptions([makeLayer({ id: 1, name: 'REF' })], entities));
  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));

  assert.equal(byKey['leader-landing'], '56, 6');
  assert.equal(byKey['leader-elbow'], '50, 0');
  assert.equal(byKey['leader-landing-length'], '8.485');
});

test('buildSelectionDetailFacts adopts shared released peer rows for single-selection released inserts', () => {
  const archive = {
    sourceType: 'INSERT',
    proxyKind: 'text',
    editMode: 'proxy',
    groupId: 700,
    blockName: 'AttdefBlock',
    textKind: 'attdef',
    attributeTag: 'ATTDEF_TAG',
  };
  const entity = makeEntity({
    id: 1,
    type: 'text',
    space: 1,
    layout: 'Layout-A',
    releasedInsertArchive: archive,
  });
  const peerA = makeEntity({
    id: 2,
    type: 'text',
    groupId: 700,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'AttdefBlock',
    space: 1,
    layout: 'Layout-A',
  });
  const peerB = makeEntity({
    id: 3,
    type: 'text',
    groupId: 700,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'AttdefBlock',
    space: 1,
    layout: 'Layout-B',
  });
  const peerC = makeEntity({
    id: 4,
    type: 'text',
    groupId: 700,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'AttdefBlock',
    space: 1,
    layout: 'Layout-C',
  });

  const facts = buildSelectionDetailFacts(entity, makeOptions([makeLayer()], [entity, peerA, peerB, peerC]));
  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));

  assert.equal(byKey['released-peer-instance'], '1 / 3');
  assert.equal(byKey['released-peer-instances'], '3');
  assert.equal(byKey['released-peer-layouts'], 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C');
  assert.equal(byKey['released-peer-targets'], '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C');
});

test('buildMultiSelectionDetailFacts returns empty for non-released entities', () => {
  const e1 = makeEntity({ id: 1 });
  const e2 = makeEntity({ id: 2 });
  const facts = buildMultiSelectionDetailFacts([e1, e2]);
  assert.deepEqual(facts, []);
});

test('buildMultiSelectionDetailFacts includes released archive facts for released insert selection', () => {
  const archive = {
    sourceType: 'INSERT',
    editMode: '',
    proxyKind: 'fragment',
    groupId: 700,
    blockName: 'TITLEBLOCK',
    textKind: 'ATTRIB',
    attributeTag: 'TITLE',
  };
  const e1 = makeEntity({ id: 1, releasedInsertArchive: archive });
  const e2 = makeEntity({ id: 2, releasedInsertArchive: archive });
  const facts = buildMultiSelectionDetailFacts([e1, e2], makeOptions([], [e1, e2]));

  const keys = facts.map((f) => f.key);
  assert.ok(keys.includes('released-from'), 'missing released-from');
  assert.ok(keys.includes('released-group-id'), 'missing released-group-id');
  assert.ok(keys.includes('released-block-name'), 'missing released-block-name');
  assert.ok(keys.includes('released-selection-members'), 'missing released-selection-members');
  assert.equal(facts.find((f) => f.key === 'released-group-id').value, '700');
  assert.equal(facts.find((f) => f.key === 'released-block-name').value, 'TITLEBLOCK');
});
