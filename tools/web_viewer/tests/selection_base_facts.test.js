import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSelectionBaseFacts } from '../ui/selection_base_facts.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
    type: 'line',
    layerId: 1,
    visible: true,
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
    color: '#9ca3af',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
    ...overrides,
  };
}

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('appendSelectionBaseFacts preserves stable base row order and swatches for plain entities', () => {
  const layer = makeLayer();
  const rows = [];
  appendSelectionBaseFacts(rows, makeEntity(), {
    getLayer: (id) => (id === 1 ? layer : null),
    effectiveColor: '#9ca3af',
  });

  assert.deepEqual(rows.map((row) => row.key), [
    'layer',
    'layer-color',
    'layer-state',
    'entity-visibility',
    'effective-color',
    'color-source',
    'space',
    'layout',
  ]);
  assert.equal(rows.find((row) => row.key === 'layer-color').swatch, '#9ca3af');
  assert.equal(rows.find((row) => row.key === 'effective-color').swatch, '#9ca3af');
});

test('appendSelectionBaseFacts includes source-group and source-bundle rows when applicable', () => {
  const rows = [];
  appendSelectionBaseFacts(rows, makeEntity({
    sourceType: 'DIMENSION',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 701,
  }), {
    getLayer: () => makeLayer(),
    effectiveColor: '#5a6b7c',
  });

  const byKey = toMap(rows);
  assert.equal(byKey['group-id'], '700');
  assert.equal(byKey['group-source'], 'DIMENSION / dimension');
  assert.equal(byKey['source-bundle-id'], '701');
});

test('appendSelectionBaseFacts omits source-bundle-id when it matches group-id', () => {
  const rows = [];
  appendSelectionBaseFacts(rows, makeEntity({
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 500,
    sourceBundleId: 500,
  }), {
    getLayer: () => makeLayer(),
    effectiveColor: '#5a6b7c',
  });

  assert.ok(!rows.some((row) => row.key === 'source-bundle-id'));
});

test('appendSelectionBaseFacts includes attribute rows and modes when present', () => {
  const rows = [];
  appendSelectionBaseFacts(rows, makeEntity({
    type: 'text',
    textKind: 'attdef',
    attributeTag: 'ATTDEF_TAG',
    attributeDefault: 'ATTDEF_DEFAULT',
    attributePrompt: 'ATTDEF_PROMPT',
    attributeFlags: 12,
    attributeVerify: true,
    attributePreset: true,
  }), {
    getLayer: () => makeLayer(),
    effectiveColor: '#5a6b7c',
  });

  const byKey = toMap(rows);
  assert.equal(byKey['text-kind'], 'attdef');
  assert.equal(byKey['attribute-tag'], 'ATTDEF_TAG');
  assert.equal(byKey['attribute-default'], 'ATTDEF_DEFAULT');
  assert.equal(byKey['attribute-prompt'], 'ATTDEF_PROMPT');
  assert.equal(byKey['attribute-flags'], '12');
  assert.equal(byKey['attribute-modes'], 'Verify / Preset');
});

test('appendSelectionBaseFacts omits optional rows for empty values', () => {
  const rows = [];
  appendSelectionBaseFacts(rows, makeEntity({
    colorSource: '',
    layout: '',
    blockName: '',
    textKind: '',
    attributeTag: '',
    attributeDefault: '',
    attributePrompt: '',
    attributeFlags: null,
  }), {
    getLayer: () => makeLayer({ name: '' }),
    effectiveColor: '',
  });

  const keys = rows.map((row) => row.key);
  assert.ok(!keys.includes('effective-color'));
  assert.ok(!keys.includes('block-name'));
  assert.ok(!keys.includes('text-kind'));
  assert.ok(!keys.includes('attribute-flags'));
});
