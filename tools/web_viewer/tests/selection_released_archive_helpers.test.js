import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
  summarizeReleasedInsertArchiveSelection,
} from '../ui/selection_released_archive_helpers.js';

test('formatReleasedInsertArchiveOrigin formats origin from archive fields', () => {
  assert.equal(
    formatReleasedInsertArchiveOrigin({ sourceType: 'INSERT', proxyKind: 'fragment', editMode: '' }),
    'INSERT / fragment',
  );
  assert.equal(
    formatReleasedInsertArchiveOrigin({ sourceType: 'INSERT', proxyKind: 'fragment', editMode: 'proxy' }),
    'INSERT / fragment / proxy',
  );
});

test('formatReleasedInsertArchiveOrigin returns empty for null', () => {
  assert.equal(formatReleasedInsertArchiveOrigin(null), '');
});

test('formatReleasedInsertArchiveModes returns modes string', () => {
  assert.equal(
    formatReleasedInsertArchiveModes({ attributeFlags: 0 }),
    'None',
  );
  assert.equal(
    formatReleasedInsertArchiveModes({ attributeInvisible: true, attributeConstant: true }),
    'Invisible / Constant',
  );
  assert.equal(
    formatReleasedInsertArchiveModes({ attributePreset: true, attributeLockPosition: true }),
    'Preset / Lock Position',
  );
});

test('formatReleasedInsertArchiveModes returns empty for entity without attribute metadata', () => {
  assert.equal(formatReleasedInsertArchiveModes({}), '');
  assert.equal(formatReleasedInsertArchiveModes(null), '');
});

test('summarizeReleasedInsertArchiveSelection returns null for empty list', () => {
  assert.equal(summarizeReleasedInsertArchiveSelection([]), null);
});

test('summarizeReleasedInsertArchiveSelection returns null for non-released entities', () => {
  assert.equal(summarizeReleasedInsertArchiveSelection([{ id: 1, type: 'line' }]), null);
});

test('summarizeReleasedInsertArchiveSelection returns summary for matching released entities', () => {
  const archive = {
    sourceType: 'INSERT',
    proxyKind: 'fragment',
    groupId: 700,
    blockName: 'TITLEBLOCK',
    textKind: 'ATTRIB',
    attributeTag: 'TITLE',
  };
  const e1 = { id: 1, releasedInsertArchive: archive };
  const e2 = { id: 2, releasedInsertArchive: archive };
  const result = summarizeReleasedInsertArchiveSelection([e1, e2]);

  assert.ok(result);
  assert.equal(result.archive.groupId, 700);
  assert.equal(result.archive.blockName, 'TITLEBLOCK');
  assert.equal(result.entityCount, 2);
  assert.deepEqual(result.entityIds, [1, 2]);
});

test('summarizeReleasedInsertArchiveSelection returns null when groupIds differ', () => {
  const e1 = { id: 1, releasedInsertArchive: { sourceType: 'INSERT', groupId: 700, blockName: 'A' } };
  const e2 = { id: 2, releasedInsertArchive: { sourceType: 'INSERT', groupId: 701, blockName: 'A' } };
  assert.equal(summarizeReleasedInsertArchiveSelection([e1, e2]), null);
});
