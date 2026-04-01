import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionBadges } from '../ui/selection_badges.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
    type: 'line',
    layerId: 1,
    visible: true,
    color: '#fff',
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
    color: '#fff',
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

test('empty selection returns no badges', () => {
  assert.deepEqual(buildSelectionBadges([], null), []);
});

test('single selection preserves badge order with type, layer, space, layout, color-source', () => {
  const entity = makeEntity();
  const layer = makeLayer();
  const badges = buildSelectionBadges([entity], 1, makeOptions([layer]));

  const keys = badges.map((b) => b.key);
  assert.ok(keys.indexOf('type') < keys.indexOf('layer'));
  assert.ok(keys.indexOf('layer') < keys.indexOf('space'));
  assert.ok(keys.indexOf('space') < keys.indexOf('layout'));
  assert.ok(keys.indexOf('layout') < keys.indexOf('color-source'));

  assert.equal(badges.find((b) => b.key === 'type').value, 'line');
  assert.equal(badges.find((b) => b.key === 'type').tone, 'type');
  assert.equal(badges.find((b) => b.key === 'layer').value, '1:L1');
  assert.equal(badges.find((b) => b.key === 'layer').tone, 'layer');
  assert.equal(badges.find((b) => b.key === 'space').tone, 'space');
  assert.equal(badges.find((b) => b.key === 'color-source').value, 'BYLAYER');
  assert.equal(badges.find((b) => b.key === 'color-source').tone, 'provenance');
});

test('single selection emits layer-state badges for locked/frozen/noprint/construction', () => {
  const entity = makeEntity();
  const layer = makeLayer({ locked: true, frozen: true, printable: false, construction: true });
  const badges = buildSelectionBadges([entity], 1, makeOptions([layer]));

  const stateKeys = badges.filter((b) => b.label === 'Layer State').map((b) => b.value);
  assert.deepEqual(stateKeys, ['Locked', 'Frozen', 'NoPrint', 'Construction']);

  const lockedBadge = badges.find((b) => b.value === 'Locked');
  assert.equal(lockedBadge.tone, 'warning');

  const frozenBadge = badges.find((b) => b.value === 'Frozen');
  assert.equal(frozenBadge.tone, 'state');
});

test('single read-only selection emits read-only badge', () => {
  const entity = makeEntity({ readOnly: true });
  const badges = buildSelectionBadges([entity], 1, makeOptions([makeLayer()]));

  const readOnlyBadge = badges.find((b) => b.key === 'read-only');
  assert.ok(readOnlyBadge);
  assert.equal(readOnlyBadge.value, 'read-only');
  assert.equal(readOnlyBadge.tone, 'warning');
});

test('single non-read-only selection omits read-only badge', () => {
  const entity = makeEntity();
  const badges = buildSelectionBadges([entity], 1, makeOptions([makeLayer()]));

  assert.ok(!badges.find((b) => b.key === 'read-only'));
});

test('multi-selection with read-only entities emits aggregated read-only badge', () => {
  const e1 = makeEntity({ id: 1, readOnly: true });
  const e2 = makeEntity({ id: 2 });
  const e3 = makeEntity({ id: 3, readOnly: true });
  const badges = buildSelectionBadges([e1, e2, e3], 1, makeOptions([makeLayer()]));

  const readOnlyBadge = badges.find((b) => b.key === 'read-only');
  assert.ok(readOnlyBadge);
  assert.equal(readOnlyBadge.value, '2 read-only');
  assert.equal(readOnlyBadge.tone, 'warning');
});

test('multi-selection without read-only entities has only type badge', () => {
  const e1 = makeEntity({ id: 1 });
  const e2 = makeEntity({ id: 2, type: 'circle' });
  const badges = buildSelectionBadges([e1, e2], 1, makeOptions([makeLayer()]));

  assert.equal(badges.length, 1);
  assert.equal(badges[0].key, 'type');
  assert.ok(!badges.find((b) => b.key === 'read-only'));
});

test('primary id fallback uses first entity when primaryId not found', () => {
  const e1 = makeEntity({ id: 1, type: 'line' });
  const e2 = makeEntity({ id: 2, type: 'circle' });
  const badges = buildSelectionBadges([e1, e2], 999, makeOptions([makeLayer()]));

  assert.equal(badges[0].value, 'line');
});
