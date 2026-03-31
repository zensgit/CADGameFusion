import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelController } from '../ui/property_panel_controller.js';

function createHarness(overrides = {}) {
  const notes = [];
  const infoBatches = [];
  const actionRows = [];
  const fieldBatches = [];
  const statusMessages = [];
  const spaceContextCalls = [];
  const layerUpdateCalls = [];
  const commandCalls = [];

  const controller = createPropertyPanelController({
    documentState: {
      listEntities: () => [],
    },
    commandBus: {
      execute: (name, payload) => {
        commandCalls.push([name, payload]);
        return { ok: true };
      },
    },
    setStatus: (message) => statusMessages.push(message),
    getCurrentLayer: () => ({
      id: 5,
      name: 'ANNO',
      color: '#55aaee',
      visible: true,
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
      lineType: 'CENTER',
      lineWeight: 0.25,
    }),
    getCurrentSpaceContext: () => ({
      space: 1,
      layout: 'Sheet-A',
    }),
    listPaperLayouts: () => ['Sheet-A', 'Sheet-B'],
    setCurrentSpaceContext: (context) => {
      spaceContextCalls.push(context);
      return true;
    },
    updateCurrentLayer: (layerId, patch) => {
      layerUpdateCalls.push([layerId, patch]);
      return true;
    },
    ...overrides,
    domBindings: {
      addNote: (text, key) => notes.push({ text, key }),
      addActionRow: (actions) => actionRows.push(actions),
      appendFieldDescriptors: (descriptors) => fieldBatches.push(descriptors),
      appendInfoRows: (rows) => infoBatches.push(rows),
      ...(overrides.domBindings || {}),
    },
  });

  return {
    actionRows,
    commandCalls,
    controller,
    fieldBatches,
    infoBatches,
    layerUpdateCalls,
    notes,
    spaceContextCalls,
    statusMessages,
  };
}

test('createPropertyPanelController bridges selection action context lookup', () => {
  const entities = [{
    id: 21,
    type: 'line',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    space: 1,
    layout: 'Layout-A',
  }, {
    id: 22,
    type: 'text',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 0, y: 14 },
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    sourceAnchor: { x: 0, y: 0 },
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'midpoint',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  }];
  const { controller } = createHarness({
    documentState: {
      listEntities: () => entities,
    },
  });

  const actionContext = controller.resolveSelectionActionContext(entities[1], [22]);

  assert.deepEqual(actionContext.sourceGroup.summary.memberIds, [21, 22]);
  assert.equal(actionContext.sourceGroup.selectionMatchesText, true);
  assert.equal(actionContext.insertGroup, null);
  assert.equal(actionContext.releasedInsert, null);
});

test('createPropertyPanelController renders current-layer defaults through section shell handlers', () => {
  const {
    actionRows,
    controller,
    fieldBatches,
    infoBatches,
    layerUpdateCalls,
    notes,
    spaceContextCalls,
    statusMessages,
  } = createHarness();

  controller.renderCurrentLayerDefaults();

  assert.deepEqual(notes, [{
    key: 'current-layer-note',
    text: 'No selection. Current layer and current space/layout apply to newly created Line/Polyline/Circle/Arc/Text entities.',
  }]);
  assert.deepEqual(
    infoBatches[0].map((row) => row.key),
    ['current-space', 'current-layout', 'current-layer', 'current-layer-color', 'current-layer-state'],
  );
  assert.deepEqual(
    actionRows[0].map((action) => action.id),
    ['use-model-space', 'use-layout-sheet-b'],
  );
  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.config.name),
    ['currentLayerColor', 'currentLayerLineType', 'currentLayerLineWeight'],
  );

  actionRows[0][0].onClick();
  fieldBatches[0][0].onChange('#112233');

  assert.deepEqual(spaceContextCalls, [{ space: 0, layout: 'Model' }]);
  assert.deepEqual(layerUpdateCalls, [[5, { color: '#112233' }]]);
  assert.deepEqual(statusMessages, ['Current layer color: ANNO']);
});

test('createPropertyPanelController patches selection and reports command status', () => {
  const { controller, commandCalls, statusMessages } = createHarness({
    commandBus: {
      execute: (name, payload) => {
        commandCalls.push([name, payload]);
        return payload.patch.fail === true
          ? { ok: false, message: 'Patch failed' }
          : { ok: true };
      },
    },
  });

  controller.patchSelection({ color: '#123456' }, 'Color updated');
  controller.patchSelection({ fail: true }, 'Should not be used');

  assert.deepEqual(commandCalls, [
    ['selection.propertyPatch', { patch: { color: '#123456' } }],
    ['selection.propertyPatch', { patch: { fail: true } }],
  ]);
  assert.deepEqual(statusMessages, [
    'Color updated',
    'Patch failed',
  ]);
});

test('createPropertyPanelController prefers controllerInputs and domBindings bags over legacy flat bindings', () => {
  const notes = [];
  const nestedStatusMessages = [];
  const controller = createPropertyPanelController({
    documentState: {
      listEntities: () => [],
    },
    commandBus: {
      execute: () => ({ ok: true }),
    },
    setStatus: () => {},
    getCurrentLayer: () => ({
      id: 1,
      name: 'LEGACY',
      color: '#111111',
      visible: true,
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
    }),
    controllerInputs: {
      getCurrentLayer: () => ({
        id: 9,
        name: 'NESTED',
        color: '#abcdef',
        visible: true,
        locked: false,
        frozen: false,
        printable: true,
        construction: false,
      }),
      getCurrentSpaceContext: () => ({ space: 0, layout: 'Model' }),
      listPaperLayouts: () => [],
      updateCurrentLayer: () => {
        nestedStatusMessages.push('nested-update');
        return true;
      },
    },
    addNote: () => notes.push({ key: 'legacy', text: 'legacy' }),
    domBindings: {
      addNote: (text, key) => notes.push({ key, text }),
      addActionRow: () => {},
      appendFieldDescriptors: () => {},
      appendInfoRows: () => {},
    },
  });

  controller.renderCurrentLayerDefaults();

  assert.deepEqual(notes, [{
    key: 'current-layer-note',
    text: 'No selection. Current layer and current space/layout apply to newly created Line/Polyline/Circle/Arc/Text entities.',
  }]);
  assert.deepEqual(nestedStatusMessages, []);
});
