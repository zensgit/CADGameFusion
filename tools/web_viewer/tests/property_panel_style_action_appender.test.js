import test from 'node:test';
import assert from 'node:assert/strict';

import { appendStyleActions } from '../ui/property_panel_style_action_appender.js';

test('appendStyleActions preserves style action ordering and patch threading', () => {
  const actionRows = [];
  const patchCalls = [];

  appendStyleActions(
    (actions) => actionRows.push(actions),
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
    {
      patchSelection: (patch, message) => patchCalls.push([patch, message]),
    },
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
