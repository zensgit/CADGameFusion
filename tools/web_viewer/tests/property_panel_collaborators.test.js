import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelCollaborators } from '../ui/property_panel_collaborators.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function createHarness(overrides = {}) {
  const actionRows = [];
  const fieldBatches = [];
  const infoBatches = [];
  const patchCalls = [];
  const buildPatchCalls = [];
  const statusMessages = [];

  const collaborators = createPropertyPanelCollaborators({
    documentState: {
      getLayer: () => null,
      ensureLayer: () => {},
      listEntities: () => [],
    },
    controller: {
      patchSelection: (patch, message) => patchCalls.push([patch, message]),
      buildPatch: (entity, key, value) => {
        buildPatchCalls.push([entity?.id ?? null, key, value]);
        return { entityId: entity?.id ?? null, key, value };
      },
    },
    addActionRow: (actions) => actionRows.push(actions),
    appendFieldDescriptors: (descriptors) => fieldBatches.push(descriptors),
    appendInfoRows: (rows) => infoBatches.push(rows),
    setStatus: (message) => statusMessages.push(message),
    actionBags: {
      layer: {},
      sourceGroup: {},
      insertGroup: {},
    },
    ...overrides,
  });

  return {
    actionRows,
    buildPatchCalls,
    collaborators,
    fieldBatches,
    infoBatches,
    patchCalls,
    statusMessages,
  };
}

test('createPropertyPanelCollaborators preserves glue-facade action and field wiring', () => {
  const { collaborators, actionRows, fieldBatches, patchCalls, buildPatchCalls } = createHarness({
    actionBags: {
      layer: {
        focusLayer: () => true,
        getCurrentLayerId: () => 1,
        useLayer: () => true,
        lockLayer: () => true,
        isolateLayer: () => true,
        turnOffLayer: () => true,
        freezeLayer: () => true,
        hasLayerIsolation: () => true,
        restoreLayerIsolation: () => true,
        hasLayerFreeze: () => true,
        restoreLayerFreeze: () => true,
      },
      sourceGroup: {},
      insertGroup: {},
    },
  });

  collaborators.glueFacade.appendStyleActions(
    {
      id: 10,
      colorSource: 'TRUECOLOR',
      lineType: 'CENTER',
      lineWeight: 0.25,
      lineWeightSource: 'EXPLICIT',
      lineTypeScale: 2,
      lineTypeScaleSource: 'EXPLICIT',
    },
    { id: 3, name: 'ANNOT', color: '#55aaee', visible: true, frozen: false, locked: false },
  );
  collaborators.glueFacade.appendLayerActions({ id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false });
  collaborators.glueFacade.appendCommonPropertyFields(
    {
      id: 8,
      type: 'text',
      layerId: 2,
      color: '#778899',
      visible: true,
      lineType: 'BYLAYER',
      lineWeight: 0,
      lineTypeScale: 1,
      position: { x: 10, y: 20 },
      value: 'TEXT',
      height: 2.5,
      rotation: 0,
      textKind: 'attdef',
    },
    '#112233',
    true,
  );
  fieldBatches[0][0].onChange('7');

  assert.deepEqual(
    actionRows.map((row) => row.map((action) => action.id)),
    [
      ['use-layer-color', 'use-layer-line-type', 'use-layer-line-weight', 'use-default-line-type-scale'],
      ['locate-layer', 'use-layer', 'lock-layer', 'isolate-layer', 'turn-off-layer', 'freeze-layer', 'restore-layers', 'thaw-layers'],
    ],
  );
  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.kind === 'toggle' ? descriptor.label : descriptor.config.name),
    ['layerId', 'color', 'Visible', 'lineType', 'lineWeight', 'lineTypeScale'],
  );
  assert.deepEqual(patchCalls, [
    [{ layerId: 7, colorSource: 'TRUECOLOR', colorAci: null }, 'Layer updated; imported color promoted to explicit'],
  ]);
  assert.deepEqual(buildPatchCalls, []);
});

test('createPropertyPanelCollaborators preserves selection-info wiring through shared layer actions', () => {
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
  const { collaborators, infoBatches, actionRows } = createHarness({
    documentState: {
      getLayer: () => primaryLayer,
      ensureLayer: () => {},
      listEntities: () => [],
    },
    actionBags: {
      layer: {
        focusLayer: () => true,
        getCurrentLayerId: () => 1,
        useLayer: () => true,
        lockLayer: () => true,
        isolateLayer: () => true,
        turnOffLayer: () => true,
        freezeLayer: () => true,
        hasLayerIsolation: () => true,
        restoreLayerIsolation: () => true,
        hasLayerFreeze: () => true,
        restoreLayerFreeze: () => true,
      },
      sourceGroup: {},
      insertGroup: {},
    },
  });

  collaborators.selectionInfoHelpers.appendSingleSelectionInfo(
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

  assert.equal(toMap(infoBatches[0]).layer, '2:REDLINE');
  assert.equal(toMap(infoBatches[0]).space, 'Model');
  assert.deepEqual(actionRows[0].map((action) => action.id), [
    'locate-layer',
    'use-layer',
    'lock-layer',
    'isolate-layer',
    'turn-off-layer',
    'freeze-layer',
    'restore-layers',
    'thaw-layers',
  ]);
});

test('createPropertyPanelCollaborators preserves branch-context helper wiring through shared group actions', () => {
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
  const { collaborators, infoBatches, actionRows } = createHarness({
    documentState: {
      getLayer: () => null,
      ensureLayer: () => {},
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
    actionBags: {
      layer: {},
      sourceGroup: {},
      insertGroup: {
        openInsertPeer: () => true,
        selectInsertGroup: () => true,
        fitInsertGroup: () => true,
        releaseInsertGroup: () => true,
        openReleasedInsertPeer: () => true,
        selectReleasedInsertGroup: () => true,
        fitReleasedInsertGroup: () => true,
      },
    },
  });

  collaborators.branchContextHelper.appendBranchContext(
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
          summary: {
            memberIds: [21, 22],
            editableIds: [21],
            readOnlyIds: [22],
          },
          peerTargets: [
            { index: 0, target: '1: Paper / Layout-A', isCurrent: true },
            { index: 1, target: '2: Paper / Layout-B', isCurrent: false },
          ],
          textMemberCount: 1,
          editableTextMemberCount: 0,
          selectionMatchesGroup: false,
          selectionMatchesText: true,
          selectionMatchesEditableText: true,
          selectionMatchesEditableMembers: true,
          peerNavigableSelection: true,
          peerSummary: {
            peerCount: 2,
            currentIndex: 0,
            peers: [
              { space: 1, layout: 'Layout-A' },
              { space: 1, layout: 'Layout-B' },
            ],
          },
        },
        releasedInsert: {
          archive: {
            sourceType: 'INSERT',
            proxyKind: 'text',
            editMode: 'proxy',
            groupId: 700,
            blockName: 'DoorTag',
          },
          groupSummary: {
            memberIds: [21, 22],
          },
          peerTargets: [
            { index: 0, target: '1: Paper / Layout-A', isCurrent: true },
            { index: 1, target: '2: Paper / Layout-B', isCurrent: false },
          ],
          selectionMatchesGroup: false,
        },
      },
    },
    {
      showReleasedSelectionInfo: true,
      showReleasedActions: true,
    },
  );

  assert.equal(toMap(infoBatches[0])['group-source'], 'INSERT / text');
  assert.equal(toMap(infoBatches[1])['insert-group-members'], '2');
  assert.equal(toMap(infoBatches[2])['released-group-id'], '700');
  const nonEmptyActionRows = actionRows.filter((row) => row.length > 0);
  assert.deepEqual(
    nonEmptyActionRows.slice(0, 2).map((row) => row.map((action) => action.id)),
    [
      ['open-insert-peer-2', 'previous-insert-peer', 'next-insert-peer', 'select-insert-group', 'fit-insert-group', 'edit-insert-text', 'release-insert-group'],
      ['open-released-insert-peer-2', 'previous-released-insert-peer', 'next-released-insert-peer', 'select-released-insert-group', 'fit-released-insert-group'],
    ],
  );
});

test('createPropertyPanelCollaborators prefers domBindings bag over legacy flat bindings', () => {
  const flatActionRows = [];
  const bagActionRows = [];
  const flatInfoBatches = [];
  const bagInfoBatches = [];
  const flatFieldBatches = [];
  const bagFieldBatches = [];

  const collaborators = createPropertyPanelCollaborators({
    documentState: {
      getLayer: () => null,
      ensureLayer: () => {},
      listEntities: () => [],
    },
    controller: {
      patchSelection: () => {},
      buildPatch: () => ({}),
    },
    domBindings: {
      addActionRow: (actions) => bagActionRows.push(actions),
      appendFieldDescriptors: (descriptors) => bagFieldBatches.push(descriptors),
      appendInfoRows: (rows) => bagInfoBatches.push(rows),
    },
    addActionRow: (actions) => flatActionRows.push(actions),
    appendFieldDescriptors: (descriptors) => flatFieldBatches.push(descriptors),
    appendInfoRows: (rows) => flatInfoBatches.push(rows),
    setStatus: () => {},
    actionBags: {
      layer: {
        focusLayer: () => true,
        getCurrentLayerId: () => 1,
        useLayer: () => true,
      },
      sourceGroup: {},
      insertGroup: {},
    },
  });

  collaborators.glueFacade.appendLayerActions({ id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false });

  assert.equal(flatActionRows.length, 0);
  assert.equal(flatFieldBatches.length, 0);
  assert.equal(flatInfoBatches.length, 0);
  assert.deepEqual(bagActionRows[0].map((action) => action.id), ['locate-layer', 'use-layer']);
  assert.equal(bagFieldBatches.length, 0);
  assert.equal(bagInfoBatches.length, 0);
});
