import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyMetadataFacts } from '../ui/property_metadata_facts.js';

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

test('returns empty array for null entity', () => {
  assert.deepEqual(buildPropertyMetadataFacts(null), []);
});

test('includes base selection detail facts', () => {
  const entity = makeEntity();
  const layer = makeLayer();
  const facts = buildPropertyMetadataFacts(entity, makeOptions([layer], [entity]));
  const keys = facts.map((f) => f.key);

  assert.ok(keys.includes('layer'), 'missing base layer fact');
  assert.ok(keys.includes('effective-color'), 'missing base effective-color fact');
  assert.ok(keys.includes('line-type'), 'missing base line-type fact');
});

test('inserts provenance facts after entity-visibility', () => {
  const entity = makeEntity({ sourceType: 'INSERT', editMode: 'proxy', proxyKind: 'fragment' });
  const layer = makeLayer();
  const facts = buildPropertyMetadataFacts(entity, makeOptions([layer], [entity]));
  const keys = facts.map((f) => f.key);

  assert.ok(keys.includes('source-type'));
  assert.ok(keys.includes('edit-mode'));
  assert.ok(keys.includes('proxy-kind'));

  const visIdx = keys.indexOf('entity-visibility');
  const srcIdx = keys.indexOf('source-type');
  assert.ok(visIdx >= 0 && srcIdx > visIdx, 'provenance facts should follow entity-visibility');
});

test('inserts hatch facts after line-type-scale-source', () => {
  const entity = makeEntity({ hatchId: 42, hatchPattern: 'ANSI31' });
  const layer = makeLayer();
  const facts = buildPropertyMetadataFacts(entity, makeOptions([layer], [entity]));
  const keys = facts.map((f) => f.key);

  assert.ok(keys.includes('hatch-id'));
  assert.ok(keys.includes('hatch-pattern'));
  assert.equal(facts.find((f) => f.key === 'hatch-id').value, '42');
  assert.equal(facts.find((f) => f.key === 'hatch-pattern').value, 'ANSI31');

  const ltsIdx = keys.indexOf('line-type-scale-source');
  const hatchIdx = keys.indexOf('hatch-id');
  assert.ok(ltsIdx >= 0 && hatchIdx > ltsIdx, 'hatch facts should follow line-type-scale-source');
});

test('inserts dim facts after attribute-modes anchor', () => {
  const entity = makeEntity({ dimType: 3, dimStyle: 'ISO-25' });
  const layer = makeLayer();
  const facts = buildPropertyMetadataFacts(entity, makeOptions([layer], [entity]));
  const keys = facts.map((f) => f.key);

  assert.ok(keys.includes('dim-type'));
  assert.ok(keys.includes('dim-style'));
  assert.equal(facts.find((f) => f.key === 'dim-type').value, '3');
  assert.equal(facts.find((f) => f.key === 'dim-style').value, 'ISO-25');
});

test('inserts dim text facts for entity with dimTextPos', () => {
  const entity = makeEntity({
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    editMode: 'proxy',
    type: 'text',
    sourceTextPos: { x: 5, y: 10 },
    sourceTextRotation: 0,
    dimTextPos: { x: 5, y: 10 },
    dimTextRotation: 45,
  });
  const layer = makeLayer();
  const facts = buildPropertyMetadataFacts(entity, makeOptions([layer], [entity]));
  const keys = facts.map((f) => f.key);

  assert.ok(keys.includes('dim-text-pos'));
  assert.ok(keys.includes('dim-text-rotation'));
  assert.equal(facts.find((f) => f.key === 'dim-text-pos').value, '5, 10');
  assert.equal(facts.find((f) => f.key === 'dim-text-rotation').value, '45');
});
