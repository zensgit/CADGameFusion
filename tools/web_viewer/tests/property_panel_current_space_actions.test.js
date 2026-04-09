import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurrentSpaceActions } from '../ui/property_panel_current_space_actions.js';

test('buildCurrentSpaceActions preserves model and paper layout labels', () => {
  const actions = buildCurrentSpaceActions(
    { space: 1, layout: 'Layout-A' },
    ['Layout-A', 'Layout-B', 'Layout C'],
    { setCurrentSpaceContext: () => true },
  );

  assert.deepEqual(
    actions.map((action) => [action.id, action.label]),
    [
      ['use-model-space', 'Use Model Space'],
      ['use-layout-layout-b', 'Use Layout Layout-B'],
      ['use-layout-layout-c', 'Use Layout Layout C'],
    ],
  );
});

test('buildCurrentSpaceActions preserves status messaging for false result', () => {
  const status = [];
  const actions = buildCurrentSpaceActions(
    { space: 1, layout: 'Layout-A' },
    ['Layout-B'],
    {
      setCurrentSpaceContext: () => false,
      setStatus: (message) => status.push(message),
    },
  );

  actions[0].onClick();
  actions[1].onClick();

  assert.deepEqual(status, [
    'Current space unchanged: Model',
    'Current layout unchanged: Layout-B',
  ]);
});
