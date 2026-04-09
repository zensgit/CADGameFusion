import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLayerActions } from '../ui/property_panel_layer_mainline_actions.js';

test('buildLayerActions preserves current editable layer action labels', () => {
  const layer = { id: 2, name: 'REDLINE', locked: false, visible: true, frozen: false };
  const actions = buildLayerActions(layer, {
    focusLayer: () => true,
    getCurrentLayerId: () => 1,
    useLayer: () => true,
    lockLayer: () => true,
    isolateLayer: () => true,
    turnOffLayer: () => true,
    freezeLayer: () => true,
    hasLayerIsolation: () => false,
    hasLayerFreeze: () => false,
  });

  assert.deepEqual(
    actions.map((action) => [action.id, action.label]),
    [
      ['locate-layer', 'Locate Layer'],
      ['use-layer', 'Make Current'],
      ['lock-layer', 'Lock Layer'],
      ['isolate-layer', 'Isolate Layer'],
      ['turn-off-layer', 'Turn Off Layer'],
      ['freeze-layer', 'Freeze Layer'],
    ],
  );
});

test('buildLayerActions preserves locked or session restore labels', () => {
  const layer = { id: 2, name: 'REDLINE', locked: true, visible: false, frozen: true };
  const actions = buildLayerActions(layer, {
    unlockLayer: () => true,
    turnOnLayer: () => true,
    thawLayer: () => true,
    hasLayerIsolation: () => true,
    restoreLayerIsolation: () => true,
    hasLayerFreeze: () => true,
    restoreLayerFreeze: () => true,
  });

  assert.deepEqual(
    actions.map((action) => [action.id, action.label]),
    [
      ['unlock-layer', 'Unlock Layer'],
      ['turn-on-layer', 'Turn On Layer'],
      ['thaw-layer', 'Thaw Layer'],
      ['restore-layers', 'Restore Layers'],
      ['thaw-layers', 'Thaw Layers'],
    ],
  );
});
