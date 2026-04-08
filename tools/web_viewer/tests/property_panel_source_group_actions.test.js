import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSourceGroupActions } from '../ui/property_panel_source_group_actions.js';

test('buildSourceGroupActions returns empty for missing entity or summary', () => {
  assert.deepEqual(buildSourceGroupActions(null, null, {}), []);
  assert.deepEqual(buildSourceGroupActions({ id: 1 }, null, {}), []);
  assert.deepEqual(
    buildSourceGroupActions({ id: 1 }, { sourceGroup: { summary: null } }, {}),
    [],
  );
});

test('buildSourceGroupActions returns empty for insert-group entity', () => {
  const entity = { id: 1, type: 'text', sourceType: 'INSERT', groupId: 10 };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [1, 2] },
      textMemberCount: 1,
      resettableTextMemberCount: 0,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      sourceTextGuide: null,
    },
  };
  assert.deepEqual(buildSourceGroupActions(entity, actionContext, {}), []);
});

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

test('buildSourceGroupActions preserves leader source action labels', () => {
  const entity = { id: 11, type: 'text', sourceType: 'LEADER', editMode: 'proxy' };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [11, 12] },
      textMemberCount: 1,
      resettableTextMemberCount: 0,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      sourceTextGuide: {
        sourceType: 'LEADER',
        anchor: { x: 0, y: 0 },
        elbowPoint: { x: 10, y: 10 },
        anchorDriverId: null,
      },
    },
  };
  const actions = buildSourceGroupActions(entity, actionContext, {
    selectSourceGroup: () => true,
    selectSourceText: () => true,
    flipLeaderLandingSide: () => true,
    fitSourceAnchor: () => true,
    fitLeaderLanding: () => true,
    fitSourceGroup: () => true,
    editSourceGroupText: () => true,
    releaseSourceGroup: () => true,
  });

  assert.deepEqual(
    actions.map((action) => action.label),
    [
      'Select Source Group (2)',
      'Select Source Text (1)',
      'Use Opposite Landing Side',
      'Fit Source Anchor',
      'Fit Leader Landing',
      'Fit Source Group',
      'Release & Edit Source Text (1)',
      'Release Source Group (2)',
    ],
  );
});

test('buildSourceGroupActions omits select-source-group when selection already matches group', () => {
  const entity = { id: 11, type: 'text', sourceType: 'DIMENSION', editMode: 'proxy' };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [11, 12] },
      textMemberCount: 0,
      resettableTextMemberCount: 0,
      selectionMatchesGroup: true,
      selectionMatchesText: false,
      sourceTextGuide: null,
    },
  };
  const actions = buildSourceGroupActions(entity, actionContext, {
    selectSourceGroup: () => true,
    fitSourceGroup: () => true,
    releaseSourceGroup: () => true,
  });

  assert.ok(!actions.some((action) => action.id === 'select-source-group'));
});

test('buildSourceGroupActions reports action failure via setStatus', () => {
  const failures = [];
  const entity = { id: 11, type: 'text', sourceType: 'DIMENSION', editMode: 'proxy' };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [11, 12] },
      textMemberCount: 0,
      resettableTextMemberCount: 0,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      sourceTextGuide: null,
    },
  };
  const actions = buildSourceGroupActions(entity, actionContext, {
    setStatus: (message) => failures.push(message),
    selectSourceGroup: () => false,
    fitSourceGroup: () => true,
    releaseSourceGroup: () => true,
  });

  const selectAction = actions.find((action) => action.id === 'select-source-group');
  assert.ok(selectAction);
  selectAction.onClick();
  assert.deepEqual(failures, ['Select Source Group failed']);
});
