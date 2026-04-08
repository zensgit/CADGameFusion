import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsertGroupActions } from '../ui/property_panel_insert_group_actions.js';

test('buildInsertGroupActions returns empty for missing entity or summary', () => {
  assert.deepEqual(buildInsertGroupActions(null, null, {}), []);
  assert.deepEqual(buildInsertGroupActions({ id: 1 }, null, {}), []);
  assert.deepEqual(
    buildInsertGroupActions({ id: 1 }, { insertGroup: { summary: null } }, {}),
    [],
  );
});

test('buildInsertGroupActions preserves peer and editable action labels', () => {
  const actions = buildInsertGroupActions(
    { id: 21, type: 'text', sourceType: 'INSERT', proxyKind: 'text', editMode: 'proxy' },
    {
      insertGroup: {
        summary: { memberIds: [21, 22, 23], editableIds: [21], readOnlyIds: [22, 23] },
        peerTargets: [
          { index: 0, target: '1: Model / Model', isCurrent: true },
          { index: 1, target: '2: Paper / A1', isCurrent: false },
        ],
        textMemberCount: 2,
        editableTextMemberCount: 1,
        selectionMatchesGroup: false,
        selectionMatchesText: false,
        selectionMatchesEditableText: false,
        selectionMatchesEditableMembers: false,
        peerNavigableSelection: true,
      },
    },
    {
      openInsertPeer: () => true,
      selectInsertGroup: () => true,
      selectInsertText: () => true,
      selectEditableInsertText: () => true,
      selectEditableInsertGroup: () => true,
      fitInsertGroup: () => true,
      editInsertText: () => true,
      releaseInsertGroup: () => true,
    },
  );

  assert.deepEqual(
    actions.map((action) => action.label),
    [
      'Open 2: Paper / A1',
      'Previous Peer Instance',
      'Next Peer Instance',
      'Select Insert Group (3)',
      'Select Insert Text (2)',
      'Select Editable Insert Text (1)',
      'Select Editable Members (1)',
      'Fit Insert Group',
      'Release & Edit Insert Text (2)',
      'Release Insert Group (3)',
    ],
  );
});

test('buildInsertGroupActions omits editable-member action when selection already matches editable members', () => {
  const actions = buildInsertGroupActions(
    { id: 21, type: 'text' },
    {
      insertGroup: {
        summary: { memberIds: [21, 22, 23], editableIds: [21], readOnlyIds: [22, 23] },
        peerTargets: [],
        textMemberCount: 0,
        editableTextMemberCount: 0,
        selectionMatchesGroup: false,
        selectionMatchesText: false,
        selectionMatchesEditableText: false,
        selectionMatchesEditableMembers: true,
        peerNavigableSelection: false,
      },
    },
    {
      selectEditableInsertGroup: () => true,
      fitInsertGroup: () => true,
      releaseInsertGroup: () => true,
    },
  );

  assert.ok(!actions.some((action) => action.id === 'select-insert-editable'));
});

test('buildInsertGroupActions reports selection failure via setStatus', () => {
  const failures = [];
  const actions = buildInsertGroupActions(
    { id: 21, type: 'text' },
    {
      insertGroup: {
        summary: { memberIds: [21, 22], editableIds: [], readOnlyIds: [21, 22] },
        peerTargets: [],
        textMemberCount: 0,
        editableTextMemberCount: 0,
        selectionMatchesGroup: false,
        selectionMatchesText: false,
        selectionMatchesEditableText: false,
        selectionMatchesEditableMembers: false,
        peerNavigableSelection: false,
      },
    },
    {
      setStatus: (message) => failures.push(message),
      selectInsertGroup: () => false,
    },
  );

  const selectAction = actions.find((action) => action.id === 'select-insert-group');
  assert.ok(selectAction);
  selectAction.onClick();
  assert.deepEqual(failures, ['Select Insert Group failed']);
});
