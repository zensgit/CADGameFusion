import test from 'node:test';
import assert from 'node:assert/strict';

import { appendLayerActions } from '../ui/property_panel_layer_action_appender.js';

test('appendLayerActions preserves layer action ordering', () => {
  const actionRows = [];

  appendLayerActions(
    (actions) => actionRows.push(actions),
    { id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false },
    {
      setStatus: () => {},
      focusLayer: () => true,
      getCurrentLayerId: () => 1,
      useLayer: () => true,
      lockLayer: () => true,
      isolateLayer: () => true,
      turnOffLayer: () => true,
      freezeLayer: () => true,
      hasLayerIsolation: () => true,
      restoreLayerIsolation: () => true,
      hasLayerFreeze: () => true,
      restoreLayerFreeze: () => true,
    },
  );

  assert.deepEqual(
    actionRows[0].map((action) => action.id),
    ['locate-layer', 'use-layer', 'lock-layer', 'isolate-layer', 'turn-off-layer', 'freeze-layer', 'restore-layers', 'thaw-layers'],
  );
});

test('appendLayerActions preserves layer callback threading and status messaging', () => {
  const actionRows = [];
  const invokedWith = [];
  const statusMessages = [];

  appendLayerActions(
    (actions) => actionRows.push(actions),
    { id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false },
    {
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
    },
  );

  actionRows[0][0].onClick();
  actionRows[0][1].onClick();

  assert.deepEqual(invokedWith.slice(0, 2), [
    ['focusLayer', 3],
    ['useLayer', 3],
  ]);
  assert.deepEqual(statusMessages, ['Layer focused: ANNOT']);
});
