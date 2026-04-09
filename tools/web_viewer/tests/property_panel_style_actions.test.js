import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStyleActionDescriptors } from '../ui/property_panel_style_actions.js';

test('buildStyleActionDescriptors preserves reset action labels and patch messages', () => {
  const calls = [];
  const actions = buildStyleActionDescriptors(
    {
      colorSource: 'TRUECOLOR',
      lineType: 'CENTER',
      lineWeight: 0.35,
      lineWeightSource: 'EXPLICIT',
      lineTypeScale: 2,
      lineTypeScaleSource: 'EXPLICIT',
    },
    { color: '#00AAFF' },
    { patchSelection: (patch, message) => calls.push([patch, message]) },
  );

  assert.deepEqual(
    actions.map((action) => [action.id, action.label]),
    [
      ['use-layer-color', 'Use Layer Color'],
      ['use-layer-line-type', 'Use Layer Line Type'],
      ['use-layer-line-weight', 'Use Layer Line Weight'],
      ['use-default-line-type-scale', 'Use Default Line Type Scale'],
    ],
  );

  for (const action of actions) {
    action.onClick();
  }

  assert.deepEqual(calls, [
    [{ color: '#00AAFF', colorSource: 'BYLAYER', colorAci: null }, 'Color source: BYLAYER'],
    [{ lineType: 'BYLAYER' }, 'Line type source: BYLAYER'],
    [{ lineWeight: 0, lineWeightSource: 'BYLAYER' }, 'Line weight source: BYLAYER'],
    [{ lineTypeScale: 1, lineTypeScaleSource: 'DEFAULT' }, 'Line type scale source: DEFAULT'],
  ]);
});
