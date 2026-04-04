import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReleasedInsertArchiveSelectionRows } from '../ui/released_insert_selection_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('buildReleasedInsertArchiveSelectionRows returns empty for missing archive', () => {
  assert.deepEqual(buildReleasedInsertArchiveSelectionRows(null), []);
  assert.deepEqual(buildReleasedInsertArchiveSelectionRows({}), []);
});

test('buildReleasedInsertArchiveSelectionRows preserves released archive rows', () => {
  const rows = buildReleasedInsertArchiveSelectionRows({
    archive: {
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
      attributeVerify: true,
      attributePreset: true,
    },
    entityCount: 2,
    commonModes: 'Verify / Preset',
  });

  assert.deepEqual(toMap(rows), {
    'released-from': 'INSERT / text / proxy',
    'released-group-id': '2',
    'released-block-name': 'AttdefBlock',
    'released-selection-members': '2',
    'released-text-kind': 'attdef',
    'released-attribute-tag': 'ATTDEF_TAG',
    'released-attribute-default': 'ATTDEF_DEFAULT',
    'released-attribute-prompt': 'ATTDEF_PROMPT',
    'released-attribute-flags': '12',
    'released-attribute-modes': 'Verify / Preset',
  });
});

test('buildReleasedInsertArchiveSelectionRows preserves Archived / N peer wording', () => {
  const rows = buildReleasedInsertArchiveSelectionRows({
    archive: {
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      groupId: 2,
      blockName: 'AttdefBlock',
    },
    entityCount: 2,
    peerSummary: {
      peerCount: 3,
      currentIndex: -1,
      peers: [
        { space: 1, layout: 'Layout-A' },
        { space: 1, layout: 'Layout-B' },
        { space: 1, layout: 'Layout-C' },
      ],
    },
  });

  assert.deepEqual(toMap(rows), {
    'released-from': 'INSERT / text / proxy',
    'released-group-id': '2',
    'released-block-name': 'AttdefBlock',
    'released-selection-members': '2',
    'released-peer-instance': 'Archived / 3',
    'released-peer-instances': '3',
    'released-peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'released-peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});
