import test from 'node:test';
import assert from 'node:assert/strict';

import { createStyleLayerActionAppenders } from '../ui/property_panel_glue_style_layer_actions.js';

function createHarness(overrides = {}) {
  const actionRows = [];
  const patchCalls = [];
  const statusMessages = [];
  const invokedWith = [];

  const appenders = createStyleLayerActionAppenders({
    addActionRow: (actions) => actionRows.push(actions),
    patchSelection: (patch, message) => patchCalls.push([patch, message]),
    setStatus: (message) => statusMessages.push(message),
    focusLayer: (id) => { invokedWith.push(['focusLayer', id]); return true; },
    getCurrentLayerId: () => 1,
    useLayer: (id) => { invokedWith.push(['useLayer', id]); return true; },
    lockLayer: (id) => { invokedWith.push(['lockLayer', id]); return true; },
    isolateLayer: (id) => { invokedWith.push(['isolateLayer', id]); return true; },
    turnOffLayer: (id) => { invokedWith.push(['turnOffLayer', id]); return true; },
    freezeLayer: (id) => { invokedWith.push(['freezeLayer', id]); return true; },
    hasLayerIsolation: () => true,
    restoreLayerIsolation: () => { invokedWith.push(['restoreLayerIsolation']); return true; },
    hasLayerFreeze: () => true,
    restoreLayerFreeze: () => { invokedWith.push(['restoreLayerFreeze']); return true; },
    ...overrides,
  });

  return {
    appenders,
    actionRows,
    patchCalls,
    statusMessages,
    invokedWith,
  };
}

test('createStyleLayerActionAppenders threads style action deps', () => {
  const { appenders, actionRows, patchCalls } = createHarness();

  appenders.appendStyleActions(
    {
      id: 10,
      colorSource: 'TRUECOLOR',
      lineType: 'CENTER',
      lineWeight: 0.25,
      lineWeightSource: 'EXPLICIT',
      lineTypeScale: 2,
      lineTypeScaleSource: 'EXPLICIT',
    },
    { id: 3, name: 'ANNOT', color: '#55aaee', visible: true, frozen: false, locked: false },
  );

  assert.deepEqual(
    actionRows[0].map((action) => action.id),
    ['use-layer-color', 'use-layer-line-type', 'use-layer-line-weight', 'use-default-line-type-scale'],
  );

  actionRows[0][0].onClick();

  assert.deepEqual(patchCalls, [[
    { color: '#55aaee', colorSource: 'BYLAYER', colorAci: null },
    'Color source: BYLAYER',
  ]]);
});

test('createStyleLayerActionAppenders threads layer action deps', () => {
  const { appenders, actionRows, invokedWith, statusMessages } = createHarness();
  const layer = { id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false };

  appenders.appendLayerActions(layer);

  assert.deepEqual(
    actionRows[0].map((action) => action.id),
    ['locate-layer', 'use-layer', 'lock-layer', 'isolate-layer', 'turn-off-layer', 'freeze-layer', 'restore-layers', 'thaw-layers'],
  );

  actionRows[0][0].onClick();
  actionRows[0][1].onClick();

  assert.deepEqual(invokedWith.slice(0, 2), [
    ['focusLayer', 3],
    ['useLayer', 3],
  ]);
  assert.deepEqual(statusMessages, ['Layer focused: ANNOT']);
});

test('createStyleLayerActionAppenders preserves row ordering when style then layer appenders run', () => {
  const { appenders, actionRows } = createHarness();
  const layer = { id: 3, name: 'ANNOT', color: '#55aaee', visible: true, frozen: false, locked: false };

  appenders.appendStyleActions(
    {
      id: 10,
      colorSource: 'TRUECOLOR',
      lineType: 'CENTER',
      lineWeight: 0.25,
      lineWeightSource: 'EXPLICIT',
      lineTypeScale: 2,
      lineTypeScaleSource: 'EXPLICIT',
    },
    layer,
  );
  appenders.appendLayerActions(layer);

  assert.deepEqual(
    actionRows.map((row) => row.map((action) => action.id)),
    [
      ['use-layer-color', 'use-layer-line-type', 'use-layer-line-weight', 'use-default-line-type-scale'],
      ['locate-layer', 'use-layer', 'lock-layer', 'isolate-layer', 'turn-off-layer', 'freeze-layer', 'restore-layers', 'thaw-layers'],
    ],
  );
});
