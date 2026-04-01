import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInsertGroupActions,
  buildReleasedInsertArchiveActions,
  buildSourceGroupActions,
} from '../ui/property_panel_group_actions.js';

test('buildSourceGroupActions preserves dimension source action labels', () => {
  const entity = { id: 11, type: 'text', sourceType: 'DIMENSION', editMode: 'proxy' };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [11, 12], editableIds: [], readOnlyIds: [11, 12] },
      textMemberCount: 1,
      resettableTextMemberCount: 1,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      sourceTextGuide: {
        sourceType: 'DIMENSION',
        anchor: { x: 0, y: 0 },
        anchorDriverId: 77,
      },
    },
  };
  const actions = buildSourceGroupActions(entity, actionContext, {
    selectSourceGroup: () => true,
    selectSourceText: () => true,
    selectSourceAnchorDriver: () => true,
    flipDimensionTextSide: () => true,
    resetSourceTextPlacement: () => true,
    fitSourceAnchor: () => true,
    fitSourceGroup: () => true,
    editSourceGroupText: () => true,
    releaseSourceGroup: () => true,
  });

  assert.deepEqual(
    actions.map((action) => action.label),
    [
      'Select Source Group (2)',
      'Select Source Text (1)',
      'Select Anchor Driver',
      'Use Opposite Text Side',
      'Reset Source Text Placement (1)',
      'Fit Source Anchor',
      'Fit Source Group',
      'Release & Edit Source Text (1)',
      'Release Source Group (2)',
    ],
  );
});

test('buildInsertGroupActions preserves peer and editable-text action labels', () => {
  const entity = { id: 21, type: 'text', sourceType: 'INSERT', proxyKind: 'text', editMode: 'proxy' };
  const actionContext = {
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
  };
  const actions = buildInsertGroupActions(entity, actionContext, {
    openInsertPeer: () => true,
    selectInsertGroup: () => true,
    selectInsertText: () => true,
    selectEditableInsertText: () => true,
    selectEditableInsertGroup: () => true,
    fitInsertGroup: () => true,
    editInsertText: () => true,
    releaseInsertGroup: () => true,
  });

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

test('buildReleasedInsertArchiveActions preserves released peer navigation and group labels', () => {
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
