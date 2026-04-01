import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderEditableSelectionBranch,
  renderLockedSelectionBranch,
  renderReadOnlySelectionBranch,
  renderReleasedInsertArchiveNote,
} from '../ui/property_panel_branch_renderers.js';

test('renderReadOnlySelectionBranch preserves branch context and direct source text editing flow', () => {
  const calls = [];
  const result = renderReadOnlySelectionBranch(
    {
      entities: [{ id: 1 }],
      readOnlyCount: 1,
      notePlan: {
        readOnly: {
          text: 'Read only',
          blocksFurtherEditing: true,
          allowDirectSourceTextEditing: true,
          allowDirectInsertTextEditing: false,
          allowInsertTextPositionEditing: false,
        },
      },
    },
    {
      addReadonlyNote: (text, key) => calls.push(['note', text, key]),
      appendBranchContext: (options) => calls.push(['context', options]),
      appendFullTextFields: () => calls.push(['source-fields']),
      appendInsertProxyTextFields: (options) => calls.push(['insert-fields', options]),
    },
  );

  assert.equal(result.blocked, true);
  assert.deepEqual(calls, [
    ['note', 'Read only', 'read-only-note'],
    ['context', { showReleasedSelectionInfo: true }],
    ['source-fields'],
  ]);
});

test('renderReleasedInsertArchiveNote preserves released note gating', () => {
  const calls = [];
  const result = renderReleasedInsertArchiveNote(
    {
      releasedInsertArchive: { groupId: 2 },
      notePlan: {
        releasedInsert: { text: 'Released archive' },
      },
    },
    {
      addReadonlyNote: (text, key) => calls.push([text, key]),
    },
  );

  assert.equal(result.rendered, true);
  assert.deepEqual(calls, [['Released archive', 'released-note']]);
});

test('renderLockedSelectionBranch preserves locked-note blocking behavior', () => {
  const calls = [];
  const result = renderLockedSelectionBranch(
    {
      entities: [{ id: 1 }, { id: 2 }],
      lockedCount: 2,
      notePlan: {
        locked: {
          text: 'Locked layer',
          blocksFurtherEditing: true,
        },
      },
    },
    {
      addReadonlyNote: (text, key) => calls.push(['note', text, key]),
      appendBranchContext: (options) => calls.push(['context', options]),
    },
  );

  assert.equal(result.blocked, true);
  assert.deepEqual(calls, [
    ['note', 'Locked layer', 'locked-note'],
    ['context', { showReleasedActions: true, preferSourceGroupFallback: true }],
  ]);
});

test('renderEditableSelectionBranch preserves single-selection render order', () => {
  const calls = [];
  renderEditableSelectionBranch(
    {
      entities: [{ id: 1 }],
    },
    {
      appendSingleSelectionInfo: () => calls.push('single-info'),
      appendGroupedSelectionInfo: () => calls.push('grouped-info'),
      appendCommonSelectionActions: () => calls.push('actions'),
      appendCommonPropertyFields: () => calls.push('common-fields'),
      appendStyleActions: () => calls.push('style-actions'),
      appendSingleEntityFields: () => calls.push('entity-fields'),
    },
  );

  assert.deepEqual(calls, [
    'single-info',
    'actions',
    'common-fields',
    'style-actions',
    'entity-fields',
  ]);
});

test('renderEditableSelectionBranch preserves multi-selection render order without single-entity fields', () => {
  const calls = [];
  renderEditableSelectionBranch(
    {
      entities: [{ id: 1 }, { id: 2 }],
    },
    {
      appendSingleSelectionInfo: () => calls.push('single-info'),
      appendGroupedSelectionInfo: () => calls.push('grouped-info'),
      appendCommonSelectionActions: () => calls.push('actions'),
      appendCommonPropertyFields: () => calls.push('common-fields'),
      appendStyleActions: () => calls.push('style-actions'),
      appendSingleEntityFields: () => calls.push('entity-fields'),
    },
  );

  assert.deepEqual(calls, [
    'grouped-info',
    'actions',
    'common-fields',
    'style-actions',
  ]);
});
