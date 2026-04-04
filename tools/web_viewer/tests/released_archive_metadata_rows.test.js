import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendReleasedArchiveIdentityRows,
  appendReleasedArchiveAttributeRows,
} from '../ui/released_archive_metadata_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('appendReleasedArchiveIdentityRows does nothing for null archive', () => {
  const rows = [];
  appendReleasedArchiveIdentityRows(rows, null);
  assert.deepEqual(rows, []);
});

test('appendReleasedArchiveIdentityRows pushes released-from, released-group-id, released-block-name', () => {
  const rows = [];
  appendReleasedArchiveIdentityRows(rows, {
    sourceType: 'INSERT',
    proxyKind: 'text',
    editMode: 'proxy',
    groupId: 5,
    blockName: 'TagBlock',
  });

  assert.deepEqual(toMap(rows), {
    'released-from': 'INSERT / text / proxy',
    'released-group-id': '5',
    'released-block-name': 'TagBlock',
  });
  assert.equal(rows[0].key, 'released-from');
  assert.equal(rows[1].key, 'released-group-id');
  assert.equal(rows[2].key, 'released-block-name');
});

test('appendReleasedArchiveIdentityRows omits optional rows when values are absent', () => {
  const rows = [];
  appendReleasedArchiveIdentityRows(rows, {
    sourceType: 'INSERT',
  });
  const keys = rows.map((row) => row.key);
  assert.ok(keys.includes('released-from'));
  assert.ok(!keys.includes('released-group-id'));
  assert.ok(!keys.includes('released-block-name'));
});

test('appendReleasedArchiveAttributeRows does nothing for null archive', () => {
  const rows = [];
  appendReleasedArchiveAttributeRows(rows, null);
  assert.deepEqual(rows, []);
});

test('appendReleasedArchiveAttributeRows pushes attribute rows with computed modes', () => {
  const rows = [];
  appendReleasedArchiveAttributeRows(rows, {
    textKind: 'attdef',
    attributeTag: 'ATTDEF_TAG',
    attributeDefault: 'ATTDEF_DEFAULT',
    attributePrompt: 'ATTDEF_PROMPT',
    attributeFlags: 12,
    attributeVerify: true,
    attributePreset: true,
  });

  assert.deepEqual(toMap(rows), {
    'released-text-kind': 'attdef',
    'released-attribute-tag': 'ATTDEF_TAG',
    'released-attribute-default': 'ATTDEF_DEFAULT',
    'released-attribute-prompt': 'ATTDEF_PROMPT',
    'released-attribute-flags': '12',
    'released-attribute-modes': 'Verify / Preset',
  });
});

test('appendReleasedArchiveAttributeRows uses commonModes when provided', () => {
  const rows = [];
  appendReleasedArchiveAttributeRows(rows, {
    textKind: 'attdef',
    attributeVerify: true,
    attributePreset: true,
  }, { commonModes: 'Verify / Preset' });

  assert.equal(toMap(rows)['released-attribute-modes'], 'Verify / Preset');
});

test('combined single-selection ordering stays stable', () => {
  const rows = [];
  const archive = {
    sourceType: 'INSERT',
    proxyKind: 'fragment',
    editMode: '',
    groupId: 700,
    blockName: 'TITLEBLOCK',
    textKind: 'ATTRIB',
    attributeTag: 'TITLE',
    attributeDefault: 'My Title',
    attributePrompt: 'Enter title',
    attributeFlags: 12,
    attributeVerify: true,
    attributePreset: true,
  };

  appendReleasedArchiveIdentityRows(rows, archive);
  appendReleasedArchiveAttributeRows(rows, archive);

  assert.deepEqual(rows.map((row) => row.key), [
    'released-from',
    'released-group-id',
    'released-block-name',
    'released-text-kind',
    'released-attribute-tag',
    'released-attribute-default',
    'released-attribute-prompt',
    'released-attribute-flags',
    'released-attribute-modes',
  ]);
});

test('combined released-selection ordering stays stable with selection-members row inserted', () => {
  const rows = [];
  const archive = {
    sourceType: 'INSERT',
    proxyKind: 'text',
    editMode: 'proxy',
    groupId: 2,
    blockName: 'AttdefBlock',
    textKind: 'attdef',
    attributeTag: 'ATTDEF_TAG',
    attributeDefault: 'ATTDEF_DEFAULT',
    attributePrompt: 'ATTDEF_PROMPT',
    attributeFlags: 12,
  };

  appendReleasedArchiveIdentityRows(rows, archive);
  rows.push({ key: 'released-selection-members', label: 'Released Selection Members', value: '2' });
  appendReleasedArchiveAttributeRows(rows, archive, { commonModes: 'Verify / Preset' });

  assert.deepEqual(rows.map((row) => row.key), [
    'released-from',
    'released-group-id',
    'released-block-name',
    'released-selection-members',
    'released-text-kind',
    'released-attribute-tag',
    'released-attribute-default',
    'released-attribute-prompt',
    'released-attribute-flags',
    'released-attribute-modes',
  ]);
  assert.equal(toMap(rows)['released-attribute-modes'], 'Verify / Preset');
});
