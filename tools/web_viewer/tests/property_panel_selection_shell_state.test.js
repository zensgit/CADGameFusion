import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelSelectionShellState } from '../ui/property_panel_selection_shell_state.js';

test('empty presentation returns mode empty with default dataset', () => {
  const state = buildPropertyPanelSelectionShellState(null);
  assert.equal(state.mode, 'empty');
  assert.equal(state.primary, null);
  assert.equal(state.primaryLayer, null);
  assert.deepEqual(state.badges, []);
  assert.deepEqual(state.detailFacts, []);
  assert.equal(state.isReadOnly, false);
  assert.equal(state.dataset.mode, 'empty');
  assert.equal(state.dataset.entityCount, '0');
  assert.equal(state.dataset.primaryType, '');
  assert.equal(state.dataset.readOnly, 'false');
  assert.equal(state.dataset.layerId, '');
  assert.equal(state.dataset.layerName, '');
  assert.equal(state.dataset.layerLocked, 'false');
  assert.equal(state.dataset.layerFrozen, 'false');
  assert.equal(state.dataset.layerPrintable, 'true');
  assert.equal(state.dataset.layerConstruction, 'false');
});

test('single presentation projects dataset correctly', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    entityCount: 1,
    primary: { id: 7, type: 'line', color: '#ffffff' },
    primaryLayer: {
      id: 1,
      name: 'L1',
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
    },
    badges: [],
    detailFacts: [],
  });

  assert.equal(state.mode, 'single');
  assert.equal(state.primary.type, 'line');
  assert.equal(state.isReadOnly, false);
  assert.equal(state.dataset.mode, 'single');
  assert.equal(state.dataset.entityCount, '1');
  assert.equal(state.dataset.primaryType, 'line');
  assert.equal(state.dataset.readOnly, 'false');
  assert.equal(state.dataset.layerId, '1');
  assert.equal(state.dataset.layerName, 'L1');
  assert.equal(state.dataset.layerLocked, 'false');
  assert.equal(state.dataset.layerFrozen, 'false');
  assert.equal(state.dataset.layerPrintable, 'true');
  assert.equal(state.dataset.layerConstruction, 'false');
});

test('readOnly is true for primary with readOnly flag', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    primary: { id: 1, type: 'line', readOnly: true },
  });
  assert.equal(state.isReadOnly, true);
  assert.equal(state.dataset.readOnly, 'true');
});

test('readOnly is true for primary with editMode proxy', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    primary: { id: 1, type: 'line', editMode: 'proxy' },
  });
  assert.equal(state.isReadOnly, true);
  assert.equal(state.dataset.readOnly, 'true');
});

test('readOnly is true for unsupported type', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    primary: { id: 1, type: 'unsupported' },
  });
  assert.equal(state.isReadOnly, true);
  assert.equal(state.dataset.readOnly, 'true');
});

test('multiple mode readOnly is derived from badges', () => {
  const withBadge = buildPropertyPanelSelectionShellState({
    mode: 'multiple',
    primary: { id: 1, type: 'line' },
    badges: [{ key: 'read-only', value: 'Read-only' }],
  });
  assert.equal(withBadge.isReadOnly, true);
  assert.equal(withBadge.dataset.readOnly, 'true');

  const withoutBadge = buildPropertyPanelSelectionShellState({
    mode: 'multiple',
    primary: { id: 1, type: 'line' },
    badges: [{ key: 'layer', value: 'L1' }],
  });
  assert.equal(withoutBadge.isReadOnly, false);
  assert.equal(withoutBadge.dataset.readOnly, 'false');
});

test('entityCount defaults to 1 when primary exists but entityCount missing', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    primary: { id: 1, type: 'line' },
  });
  assert.equal(state.dataset.entityCount, '1');
});

test('entityCount defaults to 0 when no primary', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'empty',
  });
  assert.equal(state.dataset.entityCount, '0');
});

test('layer dataset fields handle locked/frozen/construction flags', () => {
  const state = buildPropertyPanelSelectionShellState({
    mode: 'single',
    primary: { id: 1, type: 'line' },
    primaryLayer: {
      id: 5,
      name: 'Locked Layer',
      locked: true,
      frozen: true,
      printable: false,
      construction: true,
    },
  });
  assert.equal(state.dataset.layerId, '5');
  assert.equal(state.dataset.layerName, 'Locked Layer');
  assert.equal(state.dataset.layerLocked, 'true');
  assert.equal(state.dataset.layerFrozen, 'true');
  assert.equal(state.dataset.layerPrintable, 'false');
  assert.equal(state.dataset.layerConstruction, 'true');
});

test('dataset has exactly the expected keys', () => {
  const state = buildPropertyPanelSelectionShellState({ mode: 'empty' });
  const keys = Object.keys(state.dataset).sort();
  assert.deepEqual(keys, [
    'entityCount',
    'layerConstruction',
    'layerFrozen',
    'layerId',
    'layerLocked',
    'layerName',
    'layerPrintable',
    'mode',
    'primaryType',
    'readOnly',
  ]);
});
