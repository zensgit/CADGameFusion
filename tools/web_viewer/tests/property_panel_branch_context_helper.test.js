import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelBranchContextHelper } from '../ui/property_panel_branch_context_helper.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function createHarness(overrides = {}) {
  const calls = [];
  const helper = createPropertyPanelBranchContextHelper({
    documentState: {
      getLayer: () => null,
      listEntities: () => [],
    },
    appendInfoRows: (rows) => calls.push(['info', toMap(rows)]),
    appendLayerActions: (layer) => calls.push(['layer', layer]),
    appendSourceGroupActions: (entity) => calls.push(['source-actions', entity.id]),
    appendInsertGroupActions: (entity) => calls.push(['insert-actions', entity.id]),
    appendReleasedInsertArchiveActions: (entity) => calls.push(['released-actions', entity.id]),
    ...overrides,
  });

  return { calls, helper };
}

test('createPropertyPanelBranchContextHelper preserves single-selection branch context wiring', () => {
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
  const { calls, helper } = createHarness({
    documentState: {
      getLayer: () => primaryLayer,
      listEntities: () => [],
    },
  });

  helper.appendBranchContext({
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
    primaryLayer,
    entityCount: 1,
    actionContext: {},
  });

  assert.equal(calls[0][0], 'info');
  assert.equal(calls[0][1].layer, '2:REDLINE');
  assert.deepEqual(calls.slice(1), [
    ['layer', primaryLayer],
    ['source-actions', 7],
    ['insert-actions', 7],
  ]);
});

test('createPropertyPanelBranchContextHelper preserves grouped and released branch context wiring', () => {
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
  const { calls, helper } = createHarness({
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

  helper.appendBranchContext(
    {
      primary,
      primaryLayer: null,
      entityCount: 2,
      sourceGroupSummary: null,
      insertGroupSummary: {
        memberIds: [21, 22],
        editableIds: [21],
        readOnlyIds: [22],
      },
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
      },
      actionContext: {
        insertGroup: {
          peerSummary: {
            peerCount: 2,
            currentIndex: 0,
            peers: [
              { space: 1, layout: 'Layout-A' },
              { space: 1, layout: 'Layout-B' },
            ],
          },
        },
      },
    },
    {
      showReleasedSelectionInfo: true,
      showReleasedActions: true,
    },
  );

  assert.equal(calls[0][0], 'info');
  assert.equal(calls[1][0], 'info');
  assert.equal(calls[1][1]['insert-group-members'], '2');
  assert.equal(calls[2][0], 'info');
  assert.equal(calls[2][1]['released-group-id'], '700');
  assert.deepEqual(calls.slice(3), [
    ['source-actions', 21],
    ['insert-actions', 21],
    ['released-actions', 21],
  ]);
});
