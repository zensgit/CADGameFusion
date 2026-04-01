import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEntityMetadataInfoRows,
  buildInsertGroupInfoRows,
  buildReleasedInsertArchiveSelectionInfoRows,
  buildSourceGroupInfoRows,
} from '../ui/property_panel_info_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('buildEntityMetadataInfoRows preserves presenter metadata facts', () => {
  const rows = buildEntityMetadataInfoRows(
    {
      id: 7,
      type: 'line',
      layerId: 2,
      visible: true,
      color: '#00AAFF',
      colorSource: 'TRUECOLOR',
      lineType: 'CONTINUOUS',
      lineWeight: 0,
      lineTypeScale: 1,
      space: 0,
      layout: 'Model',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    },
    {
      getLayer: () => ({
        id: 2,
        name: 'REDLINE',
        color: '#00AAFF',
        visible: true,
        locked: false,
        frozen: false,
        printable: true,
        construction: false,
      }),
      listEntities: () => [],
    },
  );

  const byKey = toMap(rows);
  assert.equal(byKey.layer, '2:REDLINE');
  assert.equal(byKey['effective-color'], '#00aaff');
  assert.equal(byKey.space, 'Model');
});

test('buildSourceGroupInfoRows preserves source group rows and bounds', () => {
  const entity = {
    id: 11,
    type: 'text',
    groupId: 700,
    sourceBundleId: 701,
    sourceType: 'DIMENSION',
    proxyKind: 'text',
    space: 0,
    layout: 'Model',
    position: { x: 0, y: 0 },
  };
  const rows = buildSourceGroupInfoRows(
    entity,
    {
      memberIds: [11, 12],
      editableIds: [12],
      readOnlyIds: [11],
    },
    {
      listEntities: () => [
        entity,
        {
          id: 12,
          type: 'line',
          groupId: 700,
          sourceBundleId: 701,
          sourceType: 'DIMENSION',
          space: 0,
          layout: 'Model',
          start: { x: -20, y: 0 },
          end: { x: 20, y: 14 },
        },
      ],
    },
  );

  assert.deepEqual(toMap(rows), {
    'group-id': '700',
    'group-source': 'DIMENSION / text',
    'source-bundle-id': '701',
    'source-group-members': '2',
    'editable-members': '1',
    'read-only-members': '1',
    'group-center': '0, 7',
    'group-size': '40 x 14',
    'group-bounds': '-20, 0 -> 20, 14',
  });
});

test('buildInsertGroupInfoRows preserves block and peer rows', () => {
  const entity = {
    id: 21,
    type: 'text',
    groupId: 500,
    sourceType: 'INSERT',
    proxyKind: 'text',
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
    position: { x: 0, y: 20 },
  };
  const rows = buildInsertGroupInfoRows(
    entity,
    {
      memberIds: [21, 22],
      editableIds: [21],
      readOnlyIds: [22],
    },
    {
      listEntities: () => [
        entity,
        {
          id: 22,
          type: 'line',
          groupId: 500,
          sourceType: 'INSERT',
          blockName: 'DoorTag',
          space: 1,
          layout: 'Layout-B',
          start: { x: -18, y: 20 },
          end: { x: 18, y: 34 },
        },
      ],
      peerSummary: {
        peerCount: 3,
        currentIndex: 1,
        peers: [
          { space: 1, layout: 'Layout-A' },
          { space: 1, layout: 'Layout-B' },
          { space: 1, layout: 'Layout-C' },
        ],
      },
    },
  );

  assert.deepEqual(toMap(rows), {
    'group-id': '500',
    'group-source': 'INSERT / text',
    'block-name': 'DoorTag',
    'insert-group-members': '2',
    'editable-members': '1',
    'read-only-members': '1',
    'group-center': '0, 27',
    'group-size': '36 x 14',
    'group-bounds': '-18, 20 -> 18, 34',
    'peer-instance': '2 / 3',
    'peer-instances': '3',
    'peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});

test('buildReleasedInsertArchiveSelectionInfoRows preserves released archive rows', () => {
  const rows = buildReleasedInsertArchiveSelectionInfoRows({
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
    peerSummary: {
      peerCount: 3,
      currentIndex: 0,
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
    'released-text-kind': 'attdef',
    'released-attribute-tag': 'ATTDEF_TAG',
    'released-attribute-default': 'ATTDEF_DEFAULT',
    'released-attribute-prompt': 'ATTDEF_PROMPT',
    'released-attribute-flags': '12',
    'released-attribute-modes': 'Verify / Preset',
    'released-peer-instance': '1 / 3',
    'released-peer-instances': '3',
    'released-peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'released-peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});
