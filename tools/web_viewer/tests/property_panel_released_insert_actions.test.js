import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReleasedInsertArchiveActions } from '../ui/property_panel_released_insert_actions.js';

test('buildReleasedInsertArchiveActions returns empty for missing entity or archive', () => {
  assert.deepEqual(buildReleasedInsertArchiveActions(null, null, {}), []);
  assert.deepEqual(buildReleasedInsertArchiveActions({ id: 1 }, null, {}), []);
  assert.deepEqual(
    buildReleasedInsertArchiveActions({ id: 1 }, { releasedInsert: { archive: null } }, {}),
    [],
  );
});

test('buildReleasedInsertArchiveActions preserves peer navigation and group labels', () => {
  const entity = { id: 31, type: 'text' };
  const actionContext = {
    releasedInsert: {
      archive: { sourceType: 'INSERT', groupId: 5, blockName: 'TAG' },
      groupSummary: { memberIds: [31, 32] },
      peerTargets: [
        { index: 0, target: '1: Model / Model', isCurrent: true },
        { index: 1, target: '2: Paper / A1', isCurrent: false },
      ],
      selectionMatchesGroup: false,
    },
  };
  const actions = buildReleasedInsertArchiveActions(entity, actionContext, {
    openReleasedInsertPeer: () => true,
    selectReleasedInsertGroup: () => true,
    fitReleasedInsertGroup: () => true,
  });

  assert.deepEqual(
    actions.map((action) => action.label),
    [
      'Open 2: Paper / A1',
      'Previous Released Peer',
      'Next Released Peer',
      'Select Released Insert Group (2)',
      'Fit Released Insert Group',
    ],
  );
});

test('buildReleasedInsertArchiveActions omits select action when selection already matches group', () => {
  const actions = buildReleasedInsertArchiveActions(
    { id: 31, type: 'text' },
    {
      releasedInsert: {
        archive: { sourceType: 'INSERT', groupId: 5, blockName: 'TAG' },
        groupSummary: { memberIds: [31, 32] },
        peerTargets: [],
        selectionMatchesGroup: true,
      },
    },
    {
      selectReleasedInsertGroup: () => true,
      fitReleasedInsertGroup: () => true,
    },
  );

  assert.deepEqual(
    actions.map((action) => action.id),
    ['fit-released-insert-group'],
  );
});

test('buildReleasedInsertArchiveActions reports action failure via setStatus', () => {
  const failures = [];
  const actions = buildReleasedInsertArchiveActions(
    { id: 31, type: 'text' },
    {
      releasedInsert: {
        archive: { sourceType: 'INSERT', groupId: 5, blockName: 'TAG' },
        groupSummary: { memberIds: [31, 32] },
        peerTargets: [],
        selectionMatchesGroup: false,
      },
    },
    {
      setStatus: (message) => failures.push(message),
      selectReleasedInsertGroup: () => false,
    },
  );

  const selectAction = actions.find((action) => action.id === 'select-released-insert-group');
  assert.ok(selectAction);
  selectAction.onClick();
  assert.deepEqual(failures, ['Select Released Insert Group failed']);
});
