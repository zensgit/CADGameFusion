import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelSelectionInfoHelpers } from '../ui/property_panel_selection_info_helpers.js';

function createHarness(overrides = {}) {
  const infoBatches = [];
  const layerActionLayers = [];

  const helpers = createPropertyPanelSelectionInfoHelpers({
    documentState: {
      getLayer: () => null,
      listEntities: () => [],
    },
    appendInfoRows: (rows) => infoBatches.push(rows),
    appendLayerActions: (layer) => layerActionLayers.push(layer),
    ...overrides,
  });

  return {
    helpers,
    infoBatches,
    layerActionLayers,
  };
}

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('createPropertyPanelSelectionInfoHelpers bridges single-selection info and layer actions', () => {
  const primaryLayer = {
    id: 2,
    name: 'REDLINE',
    color: '#00AAFF',
    visible: true,
    locked: false,
    frozen: false,
    printable: true,
    construction: false,
  };
  const { helpers, infoBatches, layerActionLayers } = createHarness({
    documentState: {
      getLayer: () => primaryLayer,
      listEntities: () => [],
    },
  });

  helpers.appendSingleSelectionInfo(
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
    primaryLayer,
  );

  assert.deepEqual(layerActionLayers, [primaryLayer]);
  assert.equal(toMap(infoBatches[0]).layer, '2:REDLINE');
  assert.equal(toMap(infoBatches[0]).space, 'Model');
});

test('createPropertyPanelSelectionInfoHelpers bridges source-group info rows', () => {
  const primary = {
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
  const { helpers, infoBatches } = createHarness({
    documentState: {
      getLayer: () => null,
      listEntities: () => [
        primary,
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
  });

  helpers.appendGroupedSelectionInfo(
    primary,
    {
      memberIds: [11, 12],
      editableIds: [12],
      readOnlyIds: [11],
    },
    null,
    null,
    { insertGroup: null },
  );

  assert.deepEqual(toMap(infoBatches[0]), {
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

test('createPropertyPanelSelectionInfoHelpers bridges insert-group and released-selection info rows', () => {
  const primary = {
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
  const { helpers, infoBatches } = createHarness({
    documentState: {
      getLayer: () => null,
      listEntities: () => [
        primary,
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
  });

  helpers.appendGroupedSelectionInfo(
    primary,
    null,
    {
      memberIds: [21, 22],
      editableIds: [21],
      readOnlyIds: [22],
    },
    {
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
    },
    {
      insertGroup: {
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
    },
  );

  assert.equal(infoBatches.length, 2);
  assert.equal(toMap(infoBatches[0])['insert-group-members'], '2');
  assert.equal(toMap(infoBatches[0])['peer-instance'], '2 / 3');
  assert.equal(toMap(infoBatches[1])['released-block-name'], 'AttdefBlock');
  assert.equal(toMap(infoBatches[1])['released-attribute-modes'], 'Verify / Preset');
});
