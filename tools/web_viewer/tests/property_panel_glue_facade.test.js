import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelGlueFacade } from '../ui/property_panel_glue_facade.js';

function createHarness(overrides = {}) {
  const actionRows = [];
  const fieldBatches = [];
  const statusMessages = [];
  const patchCalls = [];
  const buildPatchCalls = [];

  const facade = createPropertyPanelGlueFacade({
    addActionRow: (actions) => actionRows.push(actions),
    appendFieldDescriptors: (descriptors) => fieldBatches.push(descriptors),
    patchSelection: (patch, message) => patchCalls.push([patch, message]),
    buildPatch: (entity, key, value) => {
      buildPatchCalls.push([entity.id ?? null, key, value]);
      return { entityId: entity.id ?? null, key, value };
    },
    getLayer: () => null,
    ensureLayer: () => {},
    setStatus: (message) => statusMessages.push(message),
    ...overrides,
  });

  return {
    facade,
    actionRows,
    fieldBatches,
    patchCalls,
    buildPatchCalls,
    statusMessages,
  };
}

test('createPropertyPanelGlueFacade preserves style and layer action bridging', () => {
  const { facade, actionRows } = createHarness({
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
  });

  facade.appendStyleActions(
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
  facade.appendLayerActions({ id: 3, name: 'ANNOT', visible: true, frozen: false, locked: false });

  assert.deepEqual(
    actionRows.map((row) => row.map((action) => action.id)),
    [
      ['use-layer-color', 'use-layer-line-type', 'use-layer-line-weight', 'use-default-line-type-scale'],
      ['locate-layer', 'use-layer', 'lock-layer', 'isolate-layer', 'turn-off-layer', 'freeze-layer', 'restore-layers', 'thaw-layers'],
    ],
  );
});

test('createPropertyPanelGlueFacade preserves grouped action row order', () => {
  const { facade, actionRows } = createHarness({
    selectSourceGroup: () => true,
    selectSourceText: () => true,
    fitSourceGroup: () => true,
    releaseSourceGroup: () => true,
    openInsertPeer: () => true,
    selectInsertGroup: () => true,
    fitInsertGroup: () => true,
    releaseInsertGroup: () => true,
    openReleasedInsertPeer: () => true,
    selectReleasedInsertGroup: () => true,
    fitReleasedInsertGroup: () => true,
  });
  const entity = { id: 21, type: 'text', sourceType: 'INSERT', proxyKind: 'text', editMode: 'proxy' };
  const actionContext = {
    sourceGroup: {
      summary: { memberIds: [21, 22], editableIds: [], readOnlyIds: [21, 22] },
      textMemberCount: 1,
      resettableTextMemberCount: 0,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      sourceTextGuide: null,
    },
    insertGroup: {
      summary: { memberIds: [21, 22, 23], editableIds: [21], readOnlyIds: [22, 23] },
      peerTargets: [
        { index: 0, target: '1: Model / Model', isCurrent: true },
        { index: 1, target: '2: Paper / A1', isCurrent: false },
      ],
      textMemberCount: 1,
      editableTextMemberCount: 0,
      selectionMatchesGroup: false,
      selectionMatchesText: false,
      selectionMatchesEditableText: true,
      selectionMatchesEditableMembers: true,
      peerNavigableSelection: true,
    },
    releasedInsert: {
      archive: { sourceType: 'INSERT', groupId: 7, blockName: 'TAG' },
      groupSummary: { memberIds: [31, 32] },
      peerTargets: [
        { index: 0, target: '1: Model / Model', isCurrent: true },
        { index: 1, target: '2: Paper / A1', isCurrent: false },
      ],
      selectionMatchesGroup: false,
    },
  };

  facade.appendCommonSelectionActions(entity, actionContext);

  assert.deepEqual(
    actionRows.map((row) => row.map((action) => action.id)),
    [
      ['select-source-group', 'select-source-text', 'fit-source-group', 'edit-source-text', 'release-source-group'],
      ['open-insert-peer-2', 'previous-insert-peer', 'next-insert-peer', 'select-insert-group', 'select-insert-text', 'fit-insert-group', 'edit-insert-text', 'release-insert-group'],
      ['open-released-insert-peer-2', 'previous-released-insert-peer', 'next-released-insert-peer', 'select-released-insert-group', 'fit-released-insert-group'],
    ],
  );
});

test('createPropertyPanelGlueFacade preserves field descriptor routing', () => {
  const { facade, fieldBatches, patchCalls, buildPatchCalls } = createHarness();
  const primary = {
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
  };

  facade.appendCommonPropertyFields(primary, '#112233', true);
  facade.appendSourceTextFields(primary);
  facade.appendInsertProxyTextFields(primary, { allowPositionEditing: true });
  facade.appendSingleEntityFields(primary);

  assert.deepEqual(
    fieldBatches.map((batch) => batch.map((descriptor) => descriptor.kind === 'toggle' ? descriptor.label : descriptor.config.name)),
    [
      ['layerId', 'color', 'Visible', 'lineType', 'lineWeight', 'lineTypeScale'],
      ['value', 'position.x', 'position.y', 'height', 'rotation'],
      ['value', 'position.x', 'position.y'],
      ['value', 'position.x', 'position.y', 'height', 'rotation'],
    ],
  );

  fieldBatches[0][0].onChange('7');
  fieldBatches[1][0].onChange('UPDATED');
  fieldBatches[2][1].onChange('42');

  assert.deepEqual(patchCalls, [
    [{ layerId: 7, colorSource: 'TRUECOLOR', colorAci: null }, 'Layer updated; imported color promoted to explicit'],
    [{ entityId: 8, key: 'value', value: 'UPDATED' }, 'Text updated'],
    [{ entityId: 8, key: 'position.x', value: '42' }, 'Text position updated'],
  ]);
  assert.deepEqual(buildPatchCalls, [
    [8, 'value', 'UPDATED'],
    [8, 'position.x', '42'],
  ]);
});
