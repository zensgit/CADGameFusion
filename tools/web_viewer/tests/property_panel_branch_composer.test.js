import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPropertyPanelSelectionBranches } from '../ui/property_panel_branch_composer.js';

function createCallbacks(log) {
  return {
    appendBranchContext: (options) => log.push(['branch-context', options || {}]),
    appendFullTextFields: () => log.push(['full-text']),
    appendInsertProxyTextFields: (options) => log.push(['insert-proxy-text', options || {}]),
    appendSingleSelectionInfo: () => log.push(['single-info']),
    appendGroupedSelectionInfo: () => log.push(['grouped-info']),
    appendCommonSelectionActions: () => log.push(['common-actions']),
    appendCommonPropertyFields: () => log.push(['common-fields']),
    appendStyleActions: () => log.push(['style-actions']),
    appendSingleEntityFields: () => log.push(['single-entity-fields']),
  };
}

test('renderPropertyPanelSelectionBranches short-circuits on blocking read-only branch', () => {
  const log = [];
  const result = renderPropertyPanelSelectionBranches(
    {
      entities: [{ id: 1 }],
      readOnlyCount: 1,
      lockedCount: 0,
      releasedInsertArchive: null,
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
      addReadonlyNote: (text, key) => log.push(['note', key, text]),
      ...createCallbacks(log),
    },
  );

  assert.deepEqual(result, { blockedAt: 'readOnly' });
  assert.deepEqual(log, [
    ['note', 'read-only-note', 'Read only'],
    ['branch-context', { showReleasedSelectionInfo: true }],
    ['full-text'],
  ]);
});

test('renderPropertyPanelSelectionBranches stops after locked branch and still renders released note', () => {
  const log = [];
  const result = renderPropertyPanelSelectionBranches(
    {
      entities: [{ id: 1 }, { id: 2 }],
      readOnlyCount: 0,
      lockedCount: 2,
      releasedInsertArchive: { sourceType: 'INSERT' },
      notePlan: {
        locked: {
          text: 'Locked layer',
          blocksFurtherEditing: true,
        },
        releasedInsert: {
          text: 'Released note',
        },
      },
    },
    {
      addReadonlyNote: (text, key) => log.push(['note', key, text]),
      ...createCallbacks(log),
    },
  );

  assert.deepEqual(result, { blockedAt: 'locked' });
  assert.deepEqual(log, [
    ['note', 'released-note', 'Released note'],
    ['note', 'locked-note', 'Locked layer'],
    ['branch-context', { showReleasedActions: true, preferSourceGroupFallback: true }],
  ]);
});

test('renderPropertyPanelSelectionBranches reaches editable branch when no blocker exists', () => {
  const log = [];
  const result = renderPropertyPanelSelectionBranches(
    {
      entities: [{ id: 1 }],
      readOnlyCount: 0,
      lockedCount: 0,
      releasedInsertArchive: null,
      notePlan: {},
    },
    {
      addReadonlyNote: (text, key) => log.push(['note', key, text]),
      ...createCallbacks(log),
    },
  );

  assert.deepEqual(result, { blockedAt: null });
  assert.deepEqual(log, [
    ['single-info'],
    ['common-actions'],
    ['common-fields'],
    ['style-actions'],
    ['single-entity-fields'],
  ]);
});
