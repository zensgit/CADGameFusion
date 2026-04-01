import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionContract } from '../ui/selection_contract.js';

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

function makeOptions(layers = []) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return { getLayer: (id) => layerMap.get(id) || null };
}

test('empty selection returns mode none with guidance note', () => {
  const contract = buildSelectionContract([], null);
  assert.equal(contract.mode, 'none');
  assert.equal(contract.entityCount, 0);
  assert.equal(contract.readOnly, false);
  assert.equal(contract.summaryText, 'No selection');
  assert.deepEqual(contract.rows, []);
  assert.ok(contract.note.includes('Select one entity'));
});

test('single selection returns mode single with layer/color/style rows', () => {
  const entity = makeEntity();
  const layer = makeLayer();
  const contract = buildSelectionContract([entity], 1, makeOptions([layer]));

  assert.equal(contract.mode, 'single');
  assert.equal(contract.entityCount, 1);
  assert.equal(contract.primaryType, 'line');
  assert.equal(contract.readOnly, false);
  assert.ok(contract.summaryText.includes('1 selected'));
  assert.equal(contract.note, '');

  const keys = contract.rows.map((r) => r.key);
  assert.ok(keys.includes('layer'), 'missing layer row');
  assert.ok(keys.includes('layer-color'), 'missing layer-color row');
  assert.ok(keys.includes('layer-state'), 'missing layer-state row');
  assert.ok(keys.includes('color'), 'missing color row');
  assert.ok(keys.includes('style'), 'missing style row');
  assert.ok(keys.includes('space'), 'missing space row');
});

test('single read-only selection includes access row', () => {
  const entity = makeEntity({ readOnly: true, sourceType: 'INSERT', proxyKind: 'fragment' });
  const contract = buildSelectionContract([entity], 1, makeOptions([makeLayer()]));

  assert.equal(contract.readOnly, true);
  const accessRow = contract.rows.find((r) => r.key === 'access');
  assert.ok(accessRow, 'missing access row');
  assert.ok(accessRow.value.includes('proxy'));
});

test('multi selection returns mode multi with type summary and note', () => {
  const e1 = makeEntity({ id: 1, type: 'line' });
  const e2 = makeEntity({ id: 2, type: 'circle' });
  const contract = buildSelectionContract([e1, e2], 1);

  assert.equal(contract.mode, 'multi');
  assert.equal(contract.entityCount, 2);
  assert.equal(contract.readOnly, false);
  assert.ok(contract.summaryText.includes('2 selected'));
  assert.ok(contract.note.includes('Single-select'));

  const typesRow = contract.rows.find((r) => r.key === 'types');
  assert.ok(typesRow);
  assert.ok(typesRow.value.includes('line'));
  assert.ok(typesRow.value.includes('circle'));
});

test('multi selection with read-only entities includes access row with mixed encoding', () => {
  const e1 = makeEntity({ id: 1, readOnly: true });
  const e2 = makeEntity({ id: 2 });
  const contract = buildSelectionContract([e1, e2], 1);

  assert.equal(contract.readOnly, 'mixed');
  const accessRow = contract.rows.find((r) => r.key === 'access');
  assert.ok(accessRow);
  assert.ok(accessRow.value.includes('1 read-only'));
});

test('multi selection with all read-only encodes readOnly as all', () => {
  const e1 = makeEntity({ id: 1, readOnly: true });
  const e2 = makeEntity({ id: 2, readOnly: true });
  const contract = buildSelectionContract([e1, e2], 1);

  assert.equal(contract.readOnly, 'all');
  const accessRow = contract.rows.find((r) => r.key === 'access');
  assert.ok(accessRow);
  assert.ok(accessRow.value.includes('All selected'));
});

test('multi selection with released archive includes released rows', () => {
  const archive = {
    sourceType: 'INSERT',
    proxyKind: 'fragment',
    groupId: 700,
    blockName: 'TITLEBLOCK',
  };
  const e1 = makeEntity({ id: 1, releasedInsertArchive: archive });
  const e2 = makeEntity({ id: 2, releasedInsertArchive: archive });
  const contract = buildSelectionContract([e1, e2], 1);

  const keys = contract.rows.map((r) => r.key);
  assert.ok(keys.includes('released-from'));
  assert.ok(keys.includes('released-block-name'));
  assert.ok(keys.includes('released-group-id'));
  assert.equal(contract.rows.find((r) => r.key === 'released-block-name').value, 'TITLEBLOCK');
  assert.equal(contract.rows.find((r) => r.key === 'released-group-id').value, '700');
});

test('primary fallback uses first entity when primaryId not found', () => {
  const e1 = makeEntity({ id: 1, type: 'line' });
  const contract = buildSelectionContract([e1], 999, makeOptions([makeLayer()]));

  assert.equal(contract.mode, 'single');
  assert.equal(contract.primaryType, 'line');
});
