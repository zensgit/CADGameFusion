import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildPropertyPanelLockedLayerNote,
} from '../ui/property_panel_note_helpers.js';

// --- buildPropertyPanelReadOnlyNote ---

test('readOnlyNote returns empty for no entities', () => {
  assert.equal(buildPropertyPanelReadOnlyNote([], null), '');
});

test('readOnlyNote returns empty for non-read-only entity', () => {
  const entity = { id: 1, type: 'line' };
  assert.equal(buildPropertyPanelReadOnlyNote([entity], entity), '');
});

test('readOnlyNote single read-only entity returns generic disabled message', () => {
  const entity = { id: 1, type: 'unsupported', readOnly: true };
  const note = buildPropertyPanelReadOnlyNote([entity], entity);
  assert.ok(note.includes('read-only'));
  assert.ok(note.includes('editing disabled'));
});

test('readOnlyNote single INSERT ATTDEF text proxy includes ATTDEF wording', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'INSERT', proxyKind: 'text',
    editMode: 'proxy', readOnly: true, textKind: 'ATTDEF',
    attributeLockPosition: false,
  };
  const note = buildPropertyPanelReadOnlyNote([entity], entity);
  assert.ok(note.includes('INSERT ATTDEF text proxy'));
  assert.ok(note.includes('default text stays editable'));
});

test('readOnlyNote single source text proxy includes source text wording', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'DIMENSION', proxyKind: 'text',
    editMode: 'proxy', readOnly: true,
  };
  const note = buildPropertyPanelReadOnlyNote([entity], entity);
  assert.ok(note.includes('source text proxy'));
  assert.ok(note.includes('text overrides stay editable'));
});

test('readOnlyNote full source group returns source group wording', () => {
  const e1 = { id: 1, type: 'text', readOnly: true, groupId: 100, sourceType: 'DIMENSION', proxyKind: 'text', editMode: 'proxy' };
  const e2 = { id: 2, type: 'line', readOnly: true, groupId: 100 };
  const actionContext = {
    sourceGroup: {
      summary: { readOnlyIds: [1, 2] },
      selectionMatchesGroup: true,
    },
    insertGroup: null,
  };
  const note = buildPropertyPanelReadOnlyNote([e1, e2], e1, actionContext);
  assert.ok(note.includes('source group'));
  assert.ok(note.includes('bundle-level'));
});

// --- buildPropertyPanelReleasedArchiveNote ---

test('releasedArchiveNote returns empty for null', () => {
  assert.equal(buildPropertyPanelReleasedArchiveNote(null), '');
});

test('releasedArchiveNote ATTDEF returns ATTDEF provenance wording', () => {
  const archive = { sourceType: 'INSERT', proxyKind: 'fragment', textKind: 'ATTDEF' };
  const entity = { id: 1, releasedInsertArchive: archive };
  const note = buildPropertyPanelReleasedArchiveNote(entity);
  assert.ok(note.includes('ATTDEF provenance'));
  assert.ok(note.includes('released from imported'));
});

test('releasedArchiveNote non-ATTDEF returns generic insert provenance wording', () => {
  const archive = { sourceType: 'INSERT', proxyKind: 'fragment', textKind: 'ATTRIB' };
  const entity = { id: 1, releasedInsertArchive: archive };
  const note = buildPropertyPanelReleasedArchiveNote(entity);
  assert.ok(note.includes('archived insert provenance'));
  assert.ok(!note.includes('ATTDEF'));
});

// --- buildPropertyPanelLockedLayerNote ---

test('lockedLayerNote returns empty for no entities', () => {
  assert.equal(buildPropertyPanelLockedLayerNote([], null), '');
});

test('lockedLayerNote returns empty when no locked layers', () => {
  const entity = { id: 1, type: 'line', layerId: 1 };
  const getLayer = () => ({ id: 1, name: 'L1', locked: false });
  assert.equal(buildPropertyPanelLockedLayerNote([entity], entity, getLayer), '');
});

test('lockedLayerNote single entity on locked layer includes layer name', () => {
  const entity = { id: 1, type: 'line', layerId: 1 };
  const getLayer = () => ({ id: 1, name: 'L1', locked: true });
  const note = buildPropertyPanelLockedLayerNote([entity], entity, getLayer);
  assert.ok(note.includes('locked layer'));
  assert.ok(note.includes('1:L1'));
  assert.ok(note.includes('editing disabled'));
});

test('lockedLayerNote mixed locked returns count wording', () => {
  const e1 = { id: 1, type: 'line', layerId: 1 };
  const e2 = { id: 2, type: 'line', layerId: 2 };
  const layers = new Map([[1, { id: 1, name: 'L1', locked: true }], [2, { id: 2, name: 'L2', locked: false }]]);
  const getLayer = (id) => layers.get(id) || null;
  const note = buildPropertyPanelLockedLayerNote([e1, e2], e1, getLayer);
  assert.ok(note.includes('1 entities on locked layers'));
  assert.ok(note.includes('edits skip them'));
});
