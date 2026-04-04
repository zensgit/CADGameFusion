import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInsertGroupInfoRows,
  buildSourceGroupInfoRows,
} from '../ui/group_info_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('buildSourceGroupInfoRows preserves identity, member, and bounds rows by default', () => {
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

test('buildSourceGroupInfoRows can omit identity rows for selection detail adoption', () => {
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
      includeIdentityRows: false,
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
    'source-group-members': '2',
    'editable-members': '1',
    'read-only-members': '1',
    'group-center': '0, 7',
    'group-size': '40 x 14',
    'group-bounds': '-20, 0 -> 20, 14',
  });
});

test('buildInsertGroupInfoRows preserves block, bounds, and peer rows by default', () => {
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

test('buildInsertGroupInfoRows can omit identity, block, and bounds rows for selection detail adoption', () => {
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
      includeIdentityRows: false,
      includeBlockName: false,
      includeBounds: false,
      peerSummary: {
        peerCount: 2,
        currentIndex: 0,
        peers: [
          { space: 1, layout: 'Layout-B' },
          { space: 1, layout: 'Layout-C' },
        ],
      },
    },
  );

  assert.deepEqual(toMap(rows), {
    'insert-group-members': '2',
    'editable-members': '1',
    'read-only-members': '1',
    'peer-instance': '1 / 2',
    'peer-instances': '2',
    'peer-layouts': 'Paper / Layout-B | Paper / Layout-C',
    'peer-targets': '1: Paper / Layout-B | 2: Paper / Layout-C',
  });
});
