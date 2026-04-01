import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderGroupedSelectionSection,
  renderNoSelectionSection,
  renderSingleSelectionSection,
} from '../ui/property_panel_section_shells.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('renderNoSelectionSection preserves current-layer default note, info, action, and fields', () => {
  const calls = [];
  const result = renderNoSelectionSection(
    {
      currentLayer: {
        id: 2,
        name: 'REDLINE',
        color: '#00AAFF',
        lineType: 'CENTER',
        lineWeight: 0.35,
        locked: false,
        visible: true,
        frozen: false,
        printable: true,
        construction: false,
      },
      currentSpaceContext: { space: 0, layout: 'Model' },
      paperLayouts: [],
      setCurrentSpaceContext: () => {},
      setStatus: () => {},
      updateCurrentLayer: () => true,
    },
    {
      appendNote: (note) => calls.push(['note', note.key, note.text]),
      appendInfoRows: (rows) => calls.push(['info', toMap(rows)]),
      appendActionRow: (actions) => calls.push(['actions', actions.map((action) => action.id)]),
      appendFieldDescriptors: (fields) => calls.push(['fields', fields.map((field) => field.config.name)]),
    },
  );

  assert.equal(result.rendered, true);
  assert.deepEqual(calls, [
    ['note', 'current-layer-note', 'No selection. Current layer and current space/layout apply to newly created Line/Polyline/Circle/Arc/Text entities.'],
    ['info', {
      'current-space': 'Model',
      'current-layout': 'Model',
      'current-layer': '2:REDLINE',
      'current-layer-color': '#00AAFF',
      'current-layer-state': 'Shown / Open / Live / Print / Normal',
    }],
    ['actions', []],
    ['fields', ['currentLayerColor', 'currentLayerLineType', 'currentLayerLineWeight']],
  ]);
});

test('renderSingleSelectionSection preserves metadata rows before layer actions', () => {
  const calls = [];
  const result = renderSingleSelectionSection(
    {
      primary: {
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
      primaryLayer: { id: 2, name: 'REDLINE' },
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
    {
      appendInfoRows: (rows) => calls.push(['info', toMap(rows)]),
      appendLayerActions: (layer) => calls.push(['layer', layer.id, layer.name]),
    },
  );

  assert.equal(result.rendered, true);
  assert.equal(calls[0][0], 'info');
  assert.equal(calls[0][1].layer, '2:REDLINE');
  assert.equal(calls[0][1]['effective-color'], '#00aaff');
  assert.equal(calls[0][1].space, 'Model');
  assert.deepEqual(calls[1], ['layer', 2, 'REDLINE']);
});

test('renderGroupedSelectionSection preserves insert-group and released rows', () => {
  const calls = [];
  const result = renderGroupedSelectionSection(
    {
      primary: {
        id: 21,
        type: 'text',
        groupId: 500,
        sourceType: 'INSERT',
        proxyKind: 'text',
        blockName: 'DoorTag',
        space: 1,
        layout: 'Layout-B',
        position: { x: 0, y: 20 },
      },
      insertGroupSummary: {
        memberIds: [21, 22],
        editableIds: [21],
        readOnlyIds: [22],
      },
      sourceGroupSummary: null,
      releasedInsertArchiveSelection: {
        archive: {
          sourceType: 'INSERT',
          proxyKind: 'text',
          editMode: 'proxy',
          groupId: 700,
          blockName: 'DoorTag',
        },
        entityCount: 2,
        commonModes: '',
        peerSummary: {
          peerCount: 2,
          currentIndex: 0,
          peers: [
            { space: 1, layout: 'Layout-A' },
            { space: 1, layout: 'Layout-B' },
          ],
        },
      },
      insertPeerSummary: {
        peerCount: 3,
        currentIndex: 1,
        peers: [
          { space: 1, layout: 'Layout-A' },
          { space: 1, layout: 'Layout-B' },
          { space: 1, layout: 'Layout-C' },
        ],
      },
      listEntities: () => [
        {
          id: 21,
          type: 'text',
          groupId: 500,
          sourceType: 'INSERT',
          proxyKind: 'text',
          blockName: 'DoorTag',
          space: 1,
          layout: 'Layout-B',
          position: { x: 0, y: 20 },
        },
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
    },
    {
      appendInfoRows: (rows) => calls.push(toMap(rows)),
    },
  );

  assert.equal(result.rendered, true);
  assert.deepEqual(calls, [
    {
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
    },
    {
      'released-from': 'INSERT / text / proxy',
      'released-group-id': '700',
      'released-block-name': 'DoorTag',
      'released-selection-members': '2',
      'released-peer-instance': '1 / 2',
      'released-peer-instances': '2',
      'released-peer-layouts': 'Paper / Layout-A | Paper / Layout-B',
      'released-peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B',
    },
  ]);
});
