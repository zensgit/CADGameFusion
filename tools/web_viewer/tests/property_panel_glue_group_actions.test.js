import test from 'node:test';
import assert from 'node:assert/strict';

import { createGroupActionAppenders } from '../ui/property_panel_glue_group_actions.js';

function createHarness(overrides = {}) {
  const actionRows = [];
  const statusMessages = [];

  const appenders = createGroupActionAppenders({
    addActionRow: (actions) => actionRows.push(actions),
    setStatus: (message) => statusMessages.push(message),
    ...overrides,
  });

  return { appenders, actionRows, statusMessages };
}

const baseActionContext = {
  sourceGroup: {
    summary: { memberIds: [21, 22], editableIds: [], readOnlyIds: [21, 22] },
    textMemberCount: 1,
    resettableTextMemberCount: 0,
    selectionMatchesGroup: false,
    selectionMatchesText: false,
    sourceTextGuide: null,
  },
  insertGroup: {
    summary: { memberIds: [21, 22, 23], editableIds: [21], readOnlyIds: [22, 23] },
    peerTargets: [
      { index: 0, target: '1: Model / Model', isCurrent: true },
      { index: 1, target: '2: Paper / A1', isCurrent: false },
    ],
    textMemberCount: 1,
    editableTextMemberCount: 0,
    selectionMatchesGroup: false,
    selectionMatchesText: false,
    selectionMatchesEditableText: true,
    selectionMatchesEditableMembers: true,
    peerNavigableSelection: true,
  },
  releasedInsert: {
    archive: { sourceType: 'INSERT', groupId: 7, blockName: 'TAG' },
    groupSummary: { memberIds: [31, 32] },
    peerTargets: [
      { index: 0, target: '1: Model / Model', isCurrent: true },
      { index: 1, target: '2: Paper / A1', isCurrent: false },
    ],
    selectionMatchesGroup: false,
  },
};

const baseEntity = { id: 21, type: 'text', sourceType: 'INSERT', proxyKind: 'text', editMode: 'proxy' };

test('createGroupActionAppenders threads source group deps', () => {
  const invokedWith = [];
  const { appenders, actionRows } = createHarness({
    selectSourceGroup: (id) => { invokedWith.push(['selectSourceGroup', id]); return true; },
    selectSourceText: (id) => { invokedWith.push(['selectSourceText', id]); return true; },
    fitSourceGroup: (id) => { invokedWith.push(['fitSourceGroup', id]); return true; },
    releaseSourceGroup: (id) => { invokedWith.push(['releaseSourceGroup', id]); return true; },
    editSourceGroupText: (id) => { invokedWith.push(['editSourceGroupText', id]); return true; },
  });

  appenders.appendSourceGroupActions(baseEntity, baseActionContext);

  assert.equal(actionRows.length, 1);
  const ids = actionRows[0].map((a) => a.id);
  assert.ok(ids.includes('select-source-group'), 'select-source-group present');
  assert.ok(ids.includes('select-source-text'), 'select-source-text present');
  assert.ok(ids.includes('fit-source-group'), 'fit-source-group present');
  assert.ok(ids.includes('release-source-group'), 'release-source-group present');

  actionRows[0].find((a) => a.id === 'select-source-group').onClick();
  assert.deepEqual(invokedWith, [['selectSourceGroup', 21]]);
});

test('createGroupActionAppenders threads insert group deps', () => {
  const invokedWith = [];
  const { appenders, actionRows } = createHarness({
    openInsertPeer: (id, idx) => { invokedWith.push(['openInsertPeer', id, idx]); return true; },
    selectInsertGroup: (id) => { invokedWith.push(['selectInsertGroup', id]); return true; },
    selectInsertText: (id) => { invokedWith.push(['selectInsertText', id]); return true; },
    fitInsertGroup: (id) => { invokedWith.push(['fitInsertGroup', id]); return true; },
    releaseInsertGroup: (id) => { invokedWith.push(['releaseInsertGroup', id]); return true; },
  });

  appenders.appendInsertGroupActions(baseEntity, baseActionContext);

  assert.equal(actionRows.length, 1);
  const ids = actionRows[0].map((a) => a.id);
  assert.ok(ids.includes('select-insert-group'), 'select-insert-group present');
  assert.ok(ids.includes('fit-insert-group'), 'fit-insert-group present');
  assert.ok(ids.includes('release-insert-group'), 'release-insert-group present');

  actionRows[0].find((a) => a.id === 'select-insert-group').onClick();
  assert.deepEqual(invokedWith, [['selectInsertGroup', 21]]);
});

test('createGroupActionAppenders threads released insert deps', () => {
  const invokedWith = [];
  const { appenders, actionRows } = createHarness({
    openReleasedInsertPeer: (id, idx) => { invokedWith.push(['openReleasedInsertPeer', id, idx]); return true; },
    selectReleasedInsertGroup: (id) => { invokedWith.push(['selectReleasedInsertGroup', id]); return true; },
    fitReleasedInsertGroup: (id) => { invokedWith.push(['fitReleasedInsertGroup', id]); return true; },
  });

  appenders.appendReleasedInsertArchiveActions(baseEntity, baseActionContext);

  assert.equal(actionRows.length, 1);
  const ids = actionRows[0].map((a) => a.id);
  assert.ok(ids.includes('select-released-insert-group'), 'select-released-insert-group present');
  assert.ok(ids.includes('fit-released-insert-group'), 'fit-released-insert-group present');

  actionRows[0].find((a) => a.id === 'select-released-insert-group').onClick();
  assert.deepEqual(invokedWith, [['selectReleasedInsertGroup', 21]]);
});

test('createGroupActionAppenders appendCommonSelectionActions produces three rows in order', () => {
  const { appenders, actionRows } = createHarness({
    selectSourceGroup: () => true,
    selectSourceText: () => true,
    fitSourceGroup: () => true,
    releaseSourceGroup: () => true,
    openInsertPeer: () => true,
    selectInsertGroup: () => true,
    fitInsertGroup: () => true,
    releaseInsertGroup: () => true,
    openReleasedInsertPeer: () => true,
    selectReleasedInsertGroup: () => true,
    fitReleasedInsertGroup: () => true,
  });

  appenders.appendCommonSelectionActions(baseEntity, baseActionContext);

  assert.equal(actionRows.length, 3);
  assert.deepEqual(
    actionRows.map((row) => row.map((a) => a.id)),
    [
      ['select-source-group', 'select-source-text', 'fit-source-group', 'edit-source-text', 'release-source-group'],
      ['open-insert-peer-2', 'previous-insert-peer', 'next-insert-peer', 'select-insert-group', 'select-insert-text', 'fit-insert-group', 'edit-insert-text', 'release-insert-group'],
      ['open-released-insert-peer-2', 'previous-released-insert-peer', 'next-released-insert-peer', 'select-released-insert-group', 'fit-released-insert-group'],
    ],
  );
});

test('createGroupActionAppenders appendCommonSelectionActions row ordering: source then insert then released', () => {
  const { appenders, actionRows } = createHarness({
    selectSourceGroup: () => true,
    fitSourceGroup: () => true,
    releaseSourceGroup: () => true,
    openInsertPeer: () => true,
    selectInsertGroup: () => true,
    fitInsertGroup: () => true,
    releaseInsertGroup: () => true,
    openReleasedInsertPeer: () => true,
    selectReleasedInsertGroup: () => true,
    fitReleasedInsertGroup: () => true,
  });

  appenders.appendSourceGroupActions(baseEntity, baseActionContext);
  appenders.appendInsertGroupActions(baseEntity, baseActionContext);
  appenders.appendReleasedInsertArchiveActions(baseEntity, baseActionContext);

  assert.equal(actionRows.length, 3);
  // Row 0 is source, row 1 is insert, row 2 is released
  assert.ok(actionRows[0].some((a) => a.id === 'select-source-group'), 'row 0: source group');
  assert.ok(actionRows[1].some((a) => a.id === 'select-insert-group'), 'row 1: insert group');
  assert.ok(actionRows[2].some((a) => a.id === 'select-released-insert-group'), 'row 2: released insert group');
});
