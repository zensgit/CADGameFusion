import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';
import { importCadgfDocument, exportCadgfDocument, isCadgfDocument } from '../adapters/cadgf_document_adapter.js';
import { collectSnapCandidates, findNearestPoint } from '../tools/geometry.js';
import { createToolContext } from '../tools/tool_context.js';
import { createLineTool } from '../tools/line_tool.js';
import { createPolylineTool } from '../tools/polyline_tool.js';
import { createCircleTool } from '../tools/circle_tool.js';
import { createArcTool } from '../tools/arc_tool.js';
import { createTextTool } from '../tools/text_tool.js';
import { createTrimTool } from '../tools/trim_tool.js';
import { createExtendTool } from '../tools/extend_tool.js';
import { createSelectTool } from '../tools/select_tool.js';
import { createBreakTool } from '../tools/break_tool.js';
import { createJoinTool, getDefaultJoinTolerance } from '../tools/join_tool.js';
import { createFilletTool } from '../tools/fillet_tool.js';
import { createChamferTool } from '../tools/chamfer_tool.js';
import {
  activateLayerLock,
  activateLayerIsolation,
  activateLayerOff,
  activateLayerFreeze,
  activateLayerUnlock,
  formatLayerRef,
  isEditableLayer,
  resolveCurrentLayerId,
  resolveSelectionCurrentLayer,
  resolveSelectionLayerLockLayers,
  resolveSelectionIsolationLayers,
  resolveSelectionLayerOffLayers,
  resolveSelectionLayerFreezeLayers,
  resolveSelectionLayerUnlockLayers,
  restoreLayerIsolation,
  restoreLayerOff,
  restoreLayerFreeze,
} from '../ui/layer_session_policy.js';
import {
  buildPropertyMetadataFacts,
  buildPropertyPanelLockedLayerNote,
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildSelectionActionContext,
  buildSelectionContract,
  buildSelectionPresentation,
  formatSelectionStatus,
} from '../ui/selection_presenter.js';
import { buildActionFlowSteps, buildSolverActionRequest, extractSolverActionPanels } from '../ui/solver_action_panel.js';
import {
  resolveCanvasLineDash,
  resolveCanvasStrokeStyle,
  resolveEntityStyleSources,
  resolveEffectiveEntityColor,
  resolveEffectiveEntityStyle,
  resolveLinePattern,
  resolveScaledLineWidth,
} from '../line_style.js';
import {
  classifyInsertSelectionScope,
  resolveInsertPeerSelection,
  resolveReleasedInsertPeerSelection,
  resolveSourceTextGuide,
  summarizeReleasedInsertPeerInstances,
  summarizeInsertGroupMembers,
} from '../insert_group.js';
import { matchesSpaceLayout, resolveCurrentSpaceLayoutContext } from '../space_layout.js';

function setup() {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  const ctx = { document, selection, snap, viewport, commandBus: null };
  const bus = new CommandBus(ctx);
  registerCadCommands(bus, ctx);
  return { document, selection, bus };
}

function approxEqual(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ~= ${expected}`);
}

function createCreateToolHarness(toolFactory, {
  currentLayerId = 0,
  currentLayer = null,
  currentSpaceContext = { space: 0, layout: 'Model' },
  commandInput = { raw: '', verb: '', args: [], text: '', height: undefined },
} = {}) {
  const overlayState = {};
  const status = [];
  const commands = [];
  const resolvedCurrentLayer = currentLayer || {
    id: currentLayerId,
    name: `L${currentLayerId}`,
    color: '#ff6600',
  };

  const ctx = {
    canvasView: {
      setTransientOverlay(name, payload) {
        if (payload == null) {
          delete overlayState[name];
        } else {
          overlayState[name] = payload;
        }
      },
    },
    setStatus(message) {
      status.push(message);
    },
    getCurrentLayerId() {
      return currentLayerId;
    },
    getCurrentLayer() {
      return { ...resolvedCurrentLayer };
    },
    buildDraftEntity(entity = {}) {
      return {
        layerId: currentLayerId,
        visible: true,
        color: resolvedCurrentLayer.color,
        colorSource: 'BYLAYER',
        lineType: 'BYLAYER',
        lineWeight: 0,
        lineWeightSource: 'BYLAYER',
        lineTypeScaleSource: 'DEFAULT',
        space: currentSpaceContext.space,
        layout: currentSpaceContext.layout,
        ...entity,
      };
    },
    readCommandInput() {
      return { ...commandInput };
    },
    resolveSnappedPoint(worldPoint) {
      return {
        point: { x: worldPoint.x, y: worldPoint.y },
        snapped: false,
        kind: 'NONE',
      };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  return {
    commands,
    overlayState,
    status,
    pointerDown({ x, y, detail = 1 } = {}) {
      tool.onPointerDown({
        button: 0,
        detail,
        world: { x, y },
      });
    },
    pointerMove({ x, y } = {}) {
      tool.onPointerMove?.({
        world: { x, y },
      });
    },
    keyDown(key) {
      tool.onKeyDown?.({ key });
    },
  };
}

test('entity.create + undo/redo', () => {
  const { document, selection, bus } = setup();

  const res = bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 1);
  assert.deepEqual(selection.entityIds, [1]);

  const undo = bus.execute('history.undo');
  assert.equal(undo.ok, true);
  assert.equal(document.listEntities().length, 0);

  const redo = bus.execute('history.redo');
  assert.equal(redo.ok, true);
  assert.equal(document.listEntities().length, 1);
});

test('selection.move moves geometry and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 1, y: 2 }, end: { x: 5, y: 2 }, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const move = bus.execute('selection.move', { delta: { x: 3, y: -2 } });
  assert.equal(move.ok, true);

  const after = document.getEntity(1);
  approxEqual(after.start.x, 4);
  approxEqual(after.start.y, 0);
  approxEqual(after.end.x, 8);
  approxEqual(after.end.y, 0);

  bus.execute('history.undo');
  const reverted = document.getEntity(1);
  approxEqual(reverted.start.x, 1);
  approxEqual(reverted.start.y, 2);
});

test('selection.copy duplicates entities and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'circle', center: { x: 0, y: 0 }, radius: 2, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const copy = bus.execute('selection.copy', { delta: { x: 10, y: 0 } });
  assert.equal(copy.ok, true);
  assert.equal(document.listEntities().length, 2);
  assert.ok(selection.entityIds.length >= 1);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
});

test('resolveCurrentLayerId prefers populated editable layers and falls back from invalid preferred layer', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 2 });

  assert.equal(isEditableLayer(document.getLayer(2)), true);
  assert.equal(formatLayerRef(document.getLayer(2)), '2:REDLINE');
  assert.equal(resolveCurrentLayerId(document, null, { preferPopulated: true }), 2);

  document.updateLayer(2, { locked: true });
  assert.equal(resolveCurrentLayerId(document, 2), 1);
});

test('resolveSelectionCurrentLayer uses primary selection and rejects locked layer targets', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 2 });

  const empty = resolveSelectionCurrentLayer(document, selection);
  assert.equal(empty.ok, false);
  assert.equal(empty.error_code, 'NO_SELECTION');

  selection.setSelection([1, 2], 2);
  const resolved = resolveSelectionCurrentLayer(document, selection);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.layerId, 2);
  assert.equal(resolved.entityId, 2);

  document.updateLayer(2, { locked: true });
  const locked = resolveSelectionCurrentLayer(document, selection);
  assert.equal(locked.ok, false);
  assert.equal(locked.error_code, 'LAYER_UNAVAILABLE');
  assert.equal(locked.layerId, 2);
});

test('resolveSelectionIsolationLayers collects unique selected layers from current selection', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 1 });
  document.addEntity({ type: 'line', start: { x: 0, y: 4 }, end: { x: 5, y: 4 }, layerId: 2 });

  const empty = resolveSelectionIsolationLayers(document, selection);
  assert.equal(empty.ok, false);
  assert.equal(empty.error_code, 'NO_SELECTION');

  selection.setSelection([1, 2, 3], 3);
  const resolved = resolveSelectionIsolationLayers(document, selection);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.layerIds, [1, 2]);
  assert.equal(resolved.primaryEntityId, 3);
  assert.equal(resolved.primaryLayerId, 2);
});

test('resolveSelectionLayerOffLayers collects unique selected layers from current selection', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 2 });

  const empty = resolveSelectionLayerOffLayers(document, selection);
  assert.equal(empty.ok, false);
  assert.equal(empty.error_code, 'NO_SELECTION');

  selection.setSelection([1, 2], 2);
  const resolved = resolveSelectionLayerOffLayers(document, selection);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.layerIds, [1, 2]);
  assert.equal(resolved.primaryEntityId, 2);
  assert.equal(resolved.primaryLayerId, 2);
});

test('resolveSelectionLayerFreezeLayers collects unique selected layers from current selection', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');

  const first = document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  const second = document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 2 });

  selection.setSelection([first.id, second.id], second.id);

  const resolved = resolveSelectionLayerFreezeLayers(document, selection);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.layerIds, [1, 2]);
  assert.equal(resolved.primaryEntityId, 2);
  assert.equal(resolved.primaryLayerId, 2);
});

test('resolveSelectionLayerLockLayers collects unique selected layers from current selection', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');

  const first = document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  const second = document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 2 });

  selection.setSelection([first.id, second.id], second.id);

  const resolved = resolveSelectionLayerLockLayers(document, selection);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.layerIds, [1, 2]);
  assert.equal(resolved.primaryEntityId, 2);
  assert.equal(resolved.primaryLayerId, 2);
});

test('resolveSelectionLayerUnlockLayers collects unique selected layers from current selection', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');

  const first = document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 1 });
  const second = document.addEntity({ type: 'line', start: { x: 0, y: 2 }, end: { x: 5, y: 2 }, layerId: 2 });

  selection.setSelection([first.id, second.id], second.id);

  const resolved = resolveSelectionLayerUnlockLayers(document, selection);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.layerIds, [1, 2]);
  assert.equal(resolved.primaryEntityId, 2);
  assert.equal(resolved.primaryLayerId, 2);
});

test('activateLayerIsolation hides non-target layers and restoreLayerIsolation restores prior visibility', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.updateLayer(2, { visible: false });

  const isolated = activateLayerIsolation(document, [1]);
  assert.equal(isolated.ok, true);
  assert.equal(document.getLayer(0)?.visible, false);
  assert.equal(document.getLayer(1)?.visible, true);
  assert.equal(document.getLayer(2)?.visible, false);

  const restored = restoreLayerIsolation(document, isolated.session);
  assert.equal(restored.ok, true);
  assert.equal(document.getLayer(0)?.visible, true);
  assert.equal(document.getLayer(1)?.visible, true);
  assert.equal(document.getLayer(2)?.visible, false);
});

test('activateLayerOff turns off selected layers, falls back from the current layer, and restoreLayerOff restores visibility', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addLayer('DETAIL');
  document.updateLayer(2, { visible: false });

  const off = activateLayerOff(document, [1, 2], { currentLayerId: 1 });
  assert.equal(off.ok, true);
  assert.equal(off.nextCurrentLayerId, 3);
  assert.equal(document.getLayer(0)?.visible, true);
  assert.equal(document.getLayer(1)?.visible, false);
  assert.equal(document.getLayer(2)?.visible, false);
  assert.equal(document.getLayer(3)?.visible, true);

  const restored = restoreLayerOff(document, off.session);
  assert.equal(restored.ok, true);
  assert.equal(restored.restoreCurrentLayerId, 1);
  assert.equal(restored.nextCurrentLayerId, 1);
  assert.equal(document.getLayer(0)?.visible, true);
  assert.equal(document.getLayer(1)?.visible, true);
  assert.equal(document.getLayer(2)?.visible, false);
  assert.equal(document.getLayer(3)?.visible, true);
});

test('activateLayerOff rejects turning off the only visible editable current layer', () => {
  const document = new DocumentState();

  const off = activateLayerOff(document, [0], { currentLayerId: 0 });
  assert.equal(off.ok, false);
  assert.equal(off.error_code, 'NO_FALLBACK_LAYER');
});

test('activateLayerFreeze freezes selected layers, falls back from the current layer, and restoreLayerFreeze restores frozen state', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addLayer('DETAIL');
  document.updateLayer(2, { frozen: true });

  const frozen = activateLayerFreeze(document, [1, 2], { currentLayerId: 1 });
  assert.equal(frozen.ok, true);
  assert.equal(frozen.nextCurrentLayerId, 3);
  assert.equal(document.getLayer(0)?.frozen, false);
  assert.equal(document.getLayer(1)?.frozen, true);
  assert.equal(document.getLayer(2)?.frozen, true);
  assert.equal(document.getLayer(3)?.frozen, false);

  const restored = restoreLayerFreeze(document, frozen.session);
  assert.equal(restored.ok, true);
  assert.equal(restored.restoreCurrentLayerId, 1);
  assert.equal(restored.nextCurrentLayerId, 1);
  assert.equal(document.getLayer(0)?.frozen, false);
  assert.equal(document.getLayer(1)?.frozen, false);
  assert.equal(document.getLayer(2)?.frozen, true);
  assert.equal(document.getLayer(3)?.frozen, false);
});

test('activateLayerFreeze rejects freezing the only visible editable current layer', () => {
  const document = new DocumentState();

  const frozen = activateLayerFreeze(document, [0], { currentLayerId: 0 });
  assert.equal(frozen.ok, false);
  assert.equal(frozen.error_code, 'NO_FALLBACK_LAYER');
});

test('activateLayerLock locks selected layers and falls back from the current layer', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.addLayer('DETAIL');

  const locked = activateLayerLock(document, [1, 2], { currentLayerId: 1 });
  assert.equal(locked.ok, true);
  assert.equal(locked.nextCurrentLayerId, 3);
  assert.equal(document.getLayer(0)?.locked, false);
  assert.equal(document.getLayer(1)?.locked, true);
  assert.equal(document.getLayer(2)?.locked, true);
  assert.equal(document.getLayer(3)?.locked, false);
});

test('activateLayerLock rejects locking the only visible editable current layer', () => {
  const document = new DocumentState();

  const locked = activateLayerLock(document, [0], { currentLayerId: 0 });
  assert.equal(locked.ok, false);
  assert.equal(locked.error_code, 'NO_FALLBACK_LAYER');
});

test('activateLayerUnlock unlocks selected layers without affecting others', () => {
  const document = new DocumentState();
  document.addLayer('PLOT');
  document.addLayer('REDLINE');
  document.updateLayer(1, { locked: true });
  document.updateLayer(2, { locked: true });

  const unlocked = activateLayerUnlock(document, [2]);
  assert.equal(unlocked.ok, true);
  assert.equal(document.getLayer(1)?.locked, true);
  assert.equal(document.getLayer(2)?.locked, false);
});

test('create tools use current layer for new entities', () => {
  const currentLayer = {
    id: 7,
    name: 'REDLINE',
    color: '#ff3300',
  };
  const currentSpaceContext = {
    space: 1,
    layout: 'Layout-A',
  };
  const cases = [
    {
      label: 'line',
      toolFactory: createLineTool,
      run(harness) {
        harness.pointerDown({ x: 0, y: 0 });
        harness.pointerDown({ x: 10, y: 0 });
      },
    },
    {
      label: 'polyline',
      toolFactory: createPolylineTool,
      run(harness) {
        harness.pointerDown({ x: 0, y: 0 });
        harness.pointerDown({ x: 10, y: 0 });
        harness.keyDown('Enter');
      },
    },
    {
      label: 'circle',
      toolFactory: createCircleTool,
      run(harness) {
        harness.pointerDown({ x: 0, y: 0 });
        harness.pointerDown({ x: 5, y: 0 });
      },
    },
    {
      label: 'arc',
      toolFactory: createArcTool,
      run(harness) {
        harness.pointerDown({ x: 0, y: 0 });
        harness.pointerDown({ x: 5, y: 0 });
        harness.pointerDown({ x: 0, y: 5 });
      },
    },
    {
      label: 'text',
      toolFactory: createTextTool,
      run(harness) {
        harness.pointerDown({ x: 2, y: 3 });
      },
    },
  ];

  for (const testCase of cases) {
    const harness = createCreateToolHarness(testCase.toolFactory, {
      currentLayerId: 7,
      currentLayer,
      currentSpaceContext,
      commandInput: {
        raw: 'text NOTE 3',
        verb: 'text',
        args: ['NOTE', '3'],
        text: 'NOTE',
        height: 3,
      },
    });
    testCase.run(harness);
    const createCommand = harness.commands.find((command) => command.id === 'entity.create');
    assert.ok(createCommand, `${testCase.label}: missing entity.create`);
    assert.equal(createCommand.payload?.entity?.layerId, 7, `${testCase.label}: wrong layer`);
    assert.equal(createCommand.payload?.entity?.color, '#ff3300', `${testCase.label}: wrong bylayer color`);
    assert.equal(createCommand.payload?.entity?.colorSource, 'BYLAYER', `${testCase.label}: wrong color source`);
    assert.equal(createCommand.payload?.entity?.lineType, 'BYLAYER', `${testCase.label}: wrong line type source`);
    assert.equal(createCommand.payload?.entity?.lineWeight, 0, `${testCase.label}: wrong line weight source`);
    assert.equal(createCommand.payload?.entity?.lineWeightSource, 'BYLAYER', `${testCase.label}: wrong line weight provenance`);
    assert.equal(createCommand.payload?.entity?.lineTypeScaleSource, 'DEFAULT', `${testCase.label}: wrong line type scale source`);
    assert.equal(createCommand.payload?.entity?.space, 1, `${testCase.label}: wrong drafting space`);
    assert.equal(createCommand.payload?.entity?.layout, 'Layout-A', `${testCase.label}: wrong drafting layout`);
  }
});

test('resolveCurrentSpaceLayoutContext prefers model when available and falls back to paper layouts', () => {
  const mixed = [
    { id: 1, type: 'line', space: 0, layout: 'Model' },
    { id: 2, type: 'line', space: 1, layout: 'Layout-B' },
    { id: 3, type: 'line', space: 1, layout: 'Layout-A' },
  ];
  assert.deepEqual(resolveCurrentSpaceLayoutContext(mixed, null), { space: 0, layout: 'Model' });
  assert.deepEqual(resolveCurrentSpaceLayoutContext(mixed, { space: 1, layout: 'Layout-B' }), { space: 1, layout: 'Layout-B' });
  assert.deepEqual(resolveCurrentSpaceLayoutContext(mixed, { space: 1, layout: 'Missing' }), { space: 0, layout: 'Model' });

  const paperOnly = [
    { id: 2, type: 'line', space: 1, layout: 'Layout-B' },
    { id: 3, type: 'line', space: 1, layout: 'Layout-A' },
  ];
  assert.deepEqual(resolveCurrentSpaceLayoutContext(paperOnly, null), { space: 1, layout: 'Layout-A' });
});

test('document state current space/layout filters renderable entities', () => {
  const document = new DocumentState();
  document.addEntity({ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, space: 0, layout: 'Model' });
  document.addEntity({ type: 'line', start: { x: 0, y: 10 }, end: { x: 10, y: 10 }, space: 1, layout: 'Layout-A' });
  document.addEntity({ type: 'line', start: { x: 0, y: 20 }, end: { x: 10, y: 20 }, space: 1, layout: 'Layout-B' });

  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [1]);
  assert.equal(matchesSpaceLayout(document.getEntity(2), document.getCurrentSpaceContext()), false);

  document.setCurrentSpaceContext({ space: 1, layout: 'Layout-B' });
  assert.deepEqual(document.getCurrentSpaceContext(), { space: 1, layout: 'Layout-B' });
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [3]);

  document.setCurrentSpaceContext({ space: 1, layout: 'Layout-A' });
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [2]);

  document.setCurrentSpaceContext({ space: 0, layout: 'Model' });
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [1]);
});

test('selection.insertGroup selects matching INSERT members in the same space/layout', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 10,
    type: 'line',
    start: { x: 0, y: 20 },
    end: { x: 10, y: 20 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
  });
  document.addEntity({
    id: 11,
    type: 'line',
    start: { x: 0, y: 30 },
    end: { x: 10, y: 30 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 501,
    blockName: 'WindowTag',
    space: 1,
    layout: 'Layout-A',
  });

  document.setCurrentSpaceContext({ space: 1, layout: 'Layout-A' });
  selection.setSelection([7], 7);

  const result = bus.execute('selection.insertGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(selection.entityIds, [7, 8, 9]);
  assert.equal(selection.primaryId, 7);
});

test('resolveInsertPeerSelection preserves text-only insert scope across peer instances', () => {
  const entities = [
    {
      id: 21,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 22,
      type: 'text',
      name: 'tag-main',
      position: { x: 2, y: 2 },
      value: 'MAIN-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 23,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 2 },
      value: 'SUB-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 24,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 10, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 25,
      type: 'text',
      name: 'tag-main',
      position: { x: 3, y: 22 },
      value: 'MAIN-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 26,
      type: 'text',
      name: 'tag-sub',
      position: { x: 9, y: 22 },
      value: 'SUB-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
  ];
  const currentSummary = summarizeInsertGroupMembers(entities, entities[2]);
  const peer = summarizeInsertGroupMembers(entities.slice(3), entities[3]);
  const currentSelectionIds = [22, 23];

  assert.equal(classifyInsertSelectionScope(entities[2], currentSelectionIds, currentSummary), 'text');

  const result = resolveInsertPeerSelection(peer, entities[2], currentSelectionIds, currentSummary);
  assert.equal(result.scope, 'text');
  assert.deepEqual(result.selectionIds, [25, 26]);
  assert.equal(result.primaryId, 26);
});

test('resolveInsertPeerSelection preserves editable-only insert scope across peer instances', () => {
  const entities = [
    {
      id: 31,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 32,
      type: 'circle',
      center: { x: 4, y: 4 },
      radius: 2,
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 33,
      type: 'text',
      position: { x: 6, y: 1 },
      value: 'TAG-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 34,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 10, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 35,
      type: 'circle',
      center: { x: 4, y: 24 },
      radius: 2,
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 36,
      type: 'text',
      position: { x: 6, y: 21 },
      value: 'TAG-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 701,
      blockName: 'DoorEditable',
      space: 1,
      layout: 'Layout-B',
    },
  ];
  const currentSummary = summarizeInsertGroupMembers(entities, entities[0]);
  const peer = summarizeInsertGroupMembers(entities.slice(3), entities[3]);
  const currentSelectionIds = [31, 32];

  assert.equal(classifyInsertSelectionScope(entities[0], currentSelectionIds, currentSummary), 'editable');

  const result = resolveInsertPeerSelection(peer, entities[0], currentSelectionIds, currentSummary);
  assert.equal(result.scope, 'editable');
  assert.deepEqual(result.selectionIds, [34, 35]);
  assert.equal(result.primaryId, 34);
});

test('resolveInsertPeerSelection preserves editable-text insert scope across peer instances', () => {
  const entities = [
    {
      id: 41,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 12, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 42,
      type: 'text',
      name: 'editable-tag',
      position: { x: 5, y: 2 },
      value: 'EDIT-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeLockPosition: false,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 43,
      type: 'text',
      name: 'editable-note',
      position: { x: 8, y: 2 },
      value: 'EDIT-NOTE-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeLockPosition: false,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 44,
      type: 'text',
      name: 'constant-tag',
      position: { x: 9, y: 2 },
      value: 'CONST-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeConstant: true,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 45,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 12, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 46,
      type: 'text',
      name: 'editable-tag',
      position: { x: 6, y: 22 },
      value: 'EDIT-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeLockPosition: false,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 47,
      type: 'text',
      name: 'editable-note',
      position: { x: 8, y: 22 },
      value: 'EDIT-NOTE-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeLockPosition: false,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 48,
      type: 'text',
      name: 'constant-tag',
      position: { x: 10, y: 22 },
      value: 'CONST-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      attributeConstant: true,
      groupId: 702,
      blockName: 'DoorAttrs',
      space: 1,
      layout: 'Layout-B',
    },
  ];
  const currentSummary = summarizeInsertGroupMembers(entities, entities[1]);
  const peer = summarizeInsertGroupMembers(entities.slice(4), entities[4]);
  const currentSelectionIds = [42, 43];

  assert.equal(classifyInsertSelectionScope(entities[1], currentSelectionIds, currentSummary), 'editable-text');

  const result = resolveInsertPeerSelection(peer, entities[1], currentSelectionIds, currentSummary);
  assert.equal(result.scope, 'editable-text');
  assert.deepEqual(result.selectionIds, [46, 47]);
  assert.equal(result.primaryId, 46);
});

test('resolveReleasedInsertPeerSelection matches released insert text to peer text by archived name', () => {
  const entities = [
    {
      id: 21,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 12, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 22,
      type: 'text',
      name: 'tag-main',
      position: { x: 4, y: 2 },
      value: 'MAIN-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 23,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 2 },
      value: 'SUB-A',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 24,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 12, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 25,
      type: 'text',
      name: 'tag-main',
      position: { x: 4, y: 22 },
      value: 'MAIN-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 26,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 22 },
      value: 'SUB-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 90,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 2 },
      value: 'SUB-A-DETACHED',
      layerId: 0,
      releasedInsertArchive: {
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        name: 'tag-sub',
        groupId: 700,
        blockName: 'DoorNotes',
        textKind: 'attdef',
      },
      space: 1,
      layout: 'Layout-A',
    },
  ];
  const released = entities[6];
  const peerSummary = summarizeReleasedInsertPeerInstances(entities, released);
  assert.equal(peerSummary?.peerCount, 2);
  assert.equal(peerSummary?.currentIndex, 0);
  const peer = peerSummary.peers[1];
  const result = resolveReleasedInsertPeerSelection(peer, released, [90]);
  assert.equal(result.scope, 'released-single');
  assert.deepEqual(result.selectionIds, [26]);
  assert.equal(result.primaryId, 26);
});

test('resolveReleasedInsertPeerSelection falls back to surviving fragment when peer text is missing', () => {
  const entities = [
    {
      id: 7,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 500,
      blockName: 'DoorTag',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 8,
      type: 'circle',
      center: { x: 5, y: 4 },
      radius: 2,
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 500,
      blockName: 'DoorTag',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 10,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 10, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 500,
      blockName: 'DoorTag',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 90,
      type: 'text',
      name: 'insert-group-text-a',
      position: { x: 6, y: 3 },
      value: 'TAG-A-DETACHED',
      layerId: 0,
      releasedInsertArchive: {
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        name: 'insert-group-text-a',
        groupId: 500,
        blockName: 'DoorTag',
      },
      space: 1,
      layout: 'Layout-A',
    },
  ];
  const released = entities[3];
  const peerSummary = summarizeReleasedInsertPeerInstances(entities, released);
  assert.equal(peerSummary?.peerCount, 2);
  const peer = peerSummary.peers[1];
  const result = resolveReleasedInsertPeerSelection(peer, released, [90]);
  assert.equal(result.scope, 'released-single');
  assert.deepEqual(result.selectionIds, [10]);
  assert.equal(result.primaryId, 10);
});

test('resolveReleasedInsertPeerSelection preserves released text-only scope across peer instances', () => {
  const entities = [
    {
      id: 20,
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 24, y: 0 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 21,
      type: 'text',
      name: 'tag-main',
      position: { x: 4, y: 2 },
      value: 'MAIN-A-DETACHED',
      layerId: 0,
      releasedInsertArchive: {
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        name: 'tag-main',
        groupId: 700,
        blockName: 'DoorNotes',
      },
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 22,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 2 },
      value: 'SUB-A-DETACHED',
      layerId: 0,
      releasedInsertArchive: {
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        name: 'tag-sub',
        groupId: 700,
        blockName: 'DoorNotes',
      },
      space: 1,
      layout: 'Layout-A',
    },
    {
      id: 23,
      type: 'line',
      start: { x: 0, y: 20 },
      end: { x: 24, y: 20 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 24,
      type: 'text',
      name: 'tag-main',
      position: { x: 4, y: 22 },
      value: 'MAIN-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 25,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 22 },
      value: 'SUB-B',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-B',
    },
    {
      id: 26,
      type: 'line',
      start: { x: 0, y: 40 },
      end: { x: 24, y: 40 },
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'fragment',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-C',
    },
    {
      id: 27,
      type: 'text',
      name: 'tag-main',
      position: { x: 4, y: 42 },
      value: 'MAIN-C',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-C',
    },
    {
      id: 28,
      type: 'text',
      name: 'tag-sub',
      position: { x: 8, y: 42 },
      value: 'SUB-C',
      layerId: 0,
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 700,
      blockName: 'DoorNotes',
      space: 1,
      layout: 'Layout-C',
    },
  ];
  const peerSummary = summarizeReleasedInsertPeerInstances(entities, entities[1]);
  assert.equal(peerSummary?.peerCount, 3);
  const peer = peerSummary.peers[2];
  const result = resolveReleasedInsertPeerSelection(peer, entities[2], [21, 22], entities);
  assert.equal(result.scope, 'released-text');
  assert.deepEqual(result.selectionIds, [27, 28]);
  assert.equal(result.primaryId, 28);
});

test('selection.insertGroup rejects non-INSERT selection', () => {
  const { document, selection, bus } = setup();
  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    space: 1,
    layout: 'Layout-A',
  });
  selection.setSelection([1], 1);
  const result = bus.execute('selection.insertGroup');
  assert.equal(result.ok, false);
  assert.equal(result.error_code, 'NOT_INSERT_GROUP');
});

test('selection.sourceGroup selects matching grouped source members in the same space/layout', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: -20, y: 12 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 23,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 24,
    type: 'line',
    start: { x: 0, y: -10 },
    end: { x: 10, y: -10 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-B',
  });
  document.addEntity({
    id: 25,
    type: 'line',
    start: { x: 0, y: -20 },
    end: { x: 10, y: -20 },
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([23], 23);

  const result = bus.execute('selection.sourceGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(selection.entityIds, [21, 22, 23]);
  assert.equal(selection.primaryId, 23);
});

test('selection.sourceGroup uses sourceBundleId to include split imported DIMENSION fragments', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: -20, y: 12 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 23,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 24,
    type: 'polyline',
    points: [{ x: -20.5, y: 0 }, { x: -20, y: 0.4 }, { x: -20, y: -0.4 }],
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 25,
    type: 'polyline',
    points: [{ x: 20.5, y: 0 }, { x: 20, y: 0.4 }, { x: 20, y: -0.4 }],
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 702,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 26,
    type: 'line',
    start: { x: -10, y: -4 },
    end: { x: 10, y: -4 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    space: 1,
    layout: 'Layout-B',
  });

  selection.setSelection([23], 23);

  const result = bus.execute('selection.sourceGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(selection.entityIds, [21, 22, 23, 24, 25]);
  assert.equal(selection.primaryId, 23);
});

test('cadgf adapter derives DIMENSION sourceBundleId for split anonymous *D bundles when payload omits it', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 21,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        line: [[26.25, 0], [103.75, 0]],
      },
      {
        id: 25,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        text: { pos: [65, 152], h: 1, rot: 0, value: '78' },
        text_kind: 'dimension',
      },
      {
        id: 26,
        type: 0,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 6,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        polyline: [[26.25, -0.0411], [26, 0], [26.25, 0.0411], [26.25, -0.0411]],
      },
      {
        id: 27,
        type: 0,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 7,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        polyline: [[103.75, 0.0411], [104, 0], [103.75, -0.0411], [103.75, 0.0411]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  assert.equal(document.getEntity(21)?.sourceBundleId, 5);
  assert.equal(document.getEntity(25)?.sourceBundleId, 5);
  assert.equal(document.getEntity(26)?.sourceBundleId, 5);
  assert.equal(document.getEntity(27)?.sourceBundleId, 5);

  selection.setSelection([26], 26);
  const result = bus.execute('selection.sourceGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(selection.entityIds, [21, 25, 26, 27]);
  assert.equal(selection.primaryId, 26);

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 25);
  const outArrowhead = exported.entities.find((entity) => entity.id === 26);
  const outArrowheadTwo = exported.entities.find((entity) => entity.id === 27);
  assert.equal(outText?.source_bundle_id, 5);
  assert.equal(outArrowhead?.source_bundle_id, 5);
  assert.equal(outArrowheadTwo?.source_bundle_id, 5);
});

test('selection.sourceGroup rejects non-grouped selection', () => {
  const { document, selection, bus } = setup();
  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
  });
  selection.setSelection([1], 1);
  const result = bus.execute('selection.sourceGroup');
  assert.equal(result.ok, false);
  assert.equal(result.error_code, 'NOT_SOURCE_GROUP');
});

test('selection.insertEditableGroup selects only editable INSERT members in the same space/layout', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 10,
    type: 'line',
    start: { x: 0, y: 20 },
    end: { x: 10, y: 20 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
  });

  document.setCurrentSpaceContext({ space: 1, layout: 'Layout-A' });
  selection.setSelection([9], 9);

  const result = bus.execute('selection.insertEditableGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(selection.entityIds, [7, 8]);
  assert.equal(selection.primaryId, 7);
});

test('selection.insertEditableGroup rejects INSERT groups without editable members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 17,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([17], 17);
  const result = bus.execute('selection.insertEditableGroup');
  assert.equal(result.ok, false);
  assert.equal(result.error_code, 'GROUP_NOT_EDITABLE');
});

test('selection.propertyPatch allows value-only edits for imported INSERT text proxies', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([9], 9);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'TAG-PROXY-EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(9).value, 'TAG-PROXY-EDITED');
  assert.deepEqual(document.getEntity(9).position, { x: 6, y: 1 });
  assert.equal(document.getEntity(9).sourceType, 'INSERT');
  assert.equal(document.getEntity(9).editMode, 'proxy');
  assert.equal(document.getEntity(9).proxyKind, 'text');
  assert.equal(document.getEntity(9).groupId, 500);

  const geometryPatch = bus.execute('selection.propertyPatch', { patch: { position: { x: 9, y: 4 } } });
  assert.equal(geometryPatch.ok, false);
  assert.equal(geometryPatch.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.deepEqual(document.getEntity(9).position, { x: 6, y: 1 });

  const exported = exportCadgfDocument(document);
  const outText = exported.entities.find((entity) => entity.id === 9);
  assert.equal(outText.type, 7);
  assert.equal(outText.source_type, 'INSERT');
  assert.equal(outText.edit_mode, 'proxy');
  assert.equal(outText.proxy_kind, 'text');
  assert.equal(outText.group_id, 500);
  assert.equal(outText.block_name, 'DoorTag');
  assert.deepEqual(outText.text.pos, [6, 1]);
  assert.equal(outText.text.rot, 0);
  assert.equal(outText.text.value, 'TAG-PROXY-EDITED');
});

test('importCadgfDocument promotes real imported ATTRIB/ATTDEF insert texts to value-only INSERT text proxies', () => {
  const fixture = {
    cadgf_version: '1.0.0',
    schema_version: 1,
    layers: [
      { id: 0, name: '0', visible: 1, locked: 0, color: 0xffffff },
    ],
    metadata: {},
    settings: {},
    feature_flags: {},
    entities: [
      {
        id: 1,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 1,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'AttribBlock',
        text_kind: 'attrib',
        attribute_tag: 'ATTRIB_TAG',
        attribute_flags: 16,
        attribute_invisible: false,
        attribute_constant: false,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: true,
        text: {
          pos: [67, 12],
          h: 2.5,
          rot: 0,
          value: 'ATTRIB_INSERT_OVERRIDE',
        },
      },
      {
        id: 2,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 1,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'AttribBlock',
        line: [[60, 10], [74, 10]],
      },
      {
        id: 3,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 2,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'AttdefBlock',
        text_kind: 'attdef',
        attribute_tag: 'ATTDEF_TAG',
        attribute_default: 'ATTDEF_INSERT_DEFAULT',
        attribute_prompt: 'ATTDEF_PROMPT',
        attribute_flags: 12,
        attribute_invisible: false,
        attribute_constant: false,
        attribute_verify: true,
        attribute_preset: true,
        attribute_lock_position: false,
        text: {
          pos: [26, 12],
          h: 2.5,
          rot: 0,
          value: 'ATTDEF_INSERT_DEFAULT',
        },
      },
      {
        id: 4,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 2,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'AttdefBlock',
        line: [[20, 10], [32, 10]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const attrib = document.getEntity(1);
  const attdef = document.getEntity(3);
  const attribLine = document.getEntity(2);

  assert.equal(attrib?.sourceType, 'INSERT');
  assert.equal(attrib?.editMode, 'proxy');
  assert.equal(attrib?.proxyKind, 'text');
  assert.equal(attrib?.textKind, 'attrib');
  assert.equal(attrib?.groupId, 1);
  assert.equal(attrib?.blockName, 'AttribBlock');
  assert.equal(attrib?.attributeTag, 'ATTRIB_TAG');
  assert.equal(attrib?.attributeFlags, 16);
  assert.equal(attrib?.attributeInvisible, false);
  assert.equal(attrib?.attributeConstant, false);
  assert.equal(attrib?.attributeVerify, false);
  assert.equal(attrib?.attributePreset, false);
  assert.equal(attrib?.attributeLockPosition, true);

  assert.equal(attdef?.sourceType, 'INSERT');
  assert.equal(attdef?.editMode, 'proxy');
  assert.equal(attdef?.proxyKind, 'text');
  assert.equal(attdef?.textKind, 'attdef');
  assert.equal(attdef?.groupId, 2);
  assert.equal(attdef?.blockName, 'AttdefBlock');
  assert.equal(attdef?.attributeTag, 'ATTDEF_TAG');
  assert.equal(attdef?.attributeDefault, 'ATTDEF_INSERT_DEFAULT');
  assert.equal(attdef?.attributePrompt, 'ATTDEF_PROMPT');
  assert.equal(attdef?.attributeFlags, 12);
  assert.equal(attdef?.attributeInvisible, false);
  assert.equal(attdef?.attributeConstant, false);
  assert.equal(attdef?.attributeVerify, true);
  assert.equal(attdef?.attributePreset, true);
  assert.equal(attdef?.attributeLockPosition, false);

  assert.equal(attribLine?.sourceType, 'INSERT');
  assert.equal(attribLine?.editMode, 'exploded');
  assert.equal(attribLine?.proxyKind, 'insert');

  selection.setSelection([1], 1);
  const attribPatch = bus.execute('selection.propertyPatch', { patch: { value: 'ATTRIB_PROXY_EDITED' } });
  assert.equal(attribPatch.ok, true);
  assert.equal(document.getEntity(1)?.value, 'ATTRIB_PROXY_EDITED');

  const attribGeometryPatch = bus.execute('selection.propertyPatch', { patch: { position: { x: 99, y: 77 } } });
  assert.equal(attribGeometryPatch.ok, false);
  assert.equal(attribGeometryPatch.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.deepEqual(document.getEntity(1)?.position, { x: 67, y: 12 });

  selection.setSelection([3], 3);
  const attdefPatch = bus.execute('selection.propertyPatch', { patch: { value: 'ATTDEF_PROXY_EDITED' } });
  assert.equal(attdefPatch.ok, true);
  assert.equal(document.getEntity(3)?.value, 'ATTDEF_PROXY_EDITED');
  assert.equal(document.getEntity(3)?.attributeDefault, 'ATTDEF_PROXY_EDITED');

  const attdefPositionPatch = bus.execute('selection.propertyPatch', { patch: { position: { x: 29, y: 15 } } });
  assert.equal(attdefPositionPatch.ok, true);
  assert.deepEqual(document.getEntity(3)?.position, { x: 29, y: 15 });

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outAttrib = exported.entities.find((entity) => entity.id === 1);
  const outAttdef = exported.entities.find((entity) => entity.id === 3);
  const outAttribLine = exported.entities.find((entity) => entity.id === 2);
  assert.equal(outAttrib?.source_type, 'INSERT');
  assert.equal(outAttrib?.edit_mode, 'proxy');
  assert.equal(outAttrib?.proxy_kind, 'text');
  assert.equal(outAttrib?.text_kind, 'attrib');
  assert.equal(outAttrib?.attribute_tag, 'ATTRIB_TAG');
  assert.equal(outAttrib?.attribute_flags, 16);
  assert.equal(outAttrib?.attribute_invisible, false);
  assert.equal(outAttrib?.attribute_constant, false);
  assert.equal(outAttrib?.attribute_verify, false);
  assert.equal(outAttrib?.attribute_preset, false);
  assert.equal(outAttrib?.attribute_lock_position, true);
  assert.equal(outAttrib?.group_id, 1);
  assert.equal(outAttrib?.block_name, 'AttribBlock');
  assert.equal(outAttrib?.text?.value, 'ATTRIB_PROXY_EDITED');
  assert.equal(outAttdef?.source_type, 'INSERT');
  assert.equal(outAttdef?.edit_mode, 'proxy');
  assert.equal(outAttdef?.proxy_kind, 'text');
  assert.equal(outAttdef?.text_kind, 'attdef');
  assert.equal(outAttdef?.attribute_tag, 'ATTDEF_TAG');
  assert.equal(outAttdef?.attribute_default, 'ATTDEF_PROXY_EDITED');
  assert.equal(outAttdef?.attribute_prompt, 'ATTDEF_PROMPT');
  assert.equal(outAttdef?.attribute_flags, 12);
  assert.equal(outAttdef?.attribute_invisible, false);
  assert.equal(outAttdef?.attribute_constant, false);
  assert.equal(outAttdef?.attribute_verify, true);
  assert.equal(outAttdef?.attribute_preset, true);
  assert.equal(outAttdef?.attribute_lock_position, false);
  assert.equal(outAttdef?.group_id, 2);
  assert.equal(outAttdef?.block_name, 'AttdefBlock');
  assert.equal(outAttdef?.text?.value, 'ATTDEF_PROXY_EDITED');
  assert.deepEqual(outAttdef?.text?.pos, [29, 15]);
  assert.equal(outAttribLine?.edit_mode, 'exploded');
  assert.equal(outAttribLine?.proxy_kind, 'insert');
});

test('importCadgfDocument upgrades legacy ATTDEF payloads from mixed default plus prompt text', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    metadata: {
      label: 'Legacy Insert Attribute Fixture',
      author: 'test',
      comment: '',
      unit_name: 'mm',
    },
    settings: {},
    feature_flags: {},
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 3,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 2,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'LegacyAttdefBlock',
        text_kind: 'attdef',
        attribute_tag: 'LEGACY_ATTDEF_TAG',
        attribute_prompt: 'LEGACY_PROMPT',
        attribute_flags: 12,
        attribute_invisible: false,
        attribute_constant: false,
        attribute_verify: true,
        attribute_preset: true,
        attribute_lock_position: false,
        text: {
          pos: [26, 12],
          h: 2.5,
          rot: 0,
          value: 'LEGACY_DEFAULT\nLEGACY_PROMPT',
        },
      },
      {
        id: 4,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 2,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'LegacyAttdefBlock',
        line: [[20, 10], [32, 10]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const attdef = document.getEntity(3);
  assert.equal(attdef?.textKind, 'attdef');
  assert.equal(attdef?.value, 'LEGACY_DEFAULT');
  assert.equal(attdef?.attributeDefault, 'LEGACY_DEFAULT');
  assert.equal(attdef?.attributePrompt, 'LEGACY_PROMPT');

  selection.setSelection([3], 3);
  const patchResult = bus.execute('selection.propertyPatch', { patch: { value: 'LEGACY_EDITED' } });
  assert.equal(patchResult.ok, true);
  assert.equal(document.getEntity(3)?.value, 'LEGACY_EDITED');
  assert.equal(document.getEntity(3)?.attributeDefault, 'LEGACY_EDITED');

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outAttdef = exported.entities.find((entity) => entity.id === 3);
  assert.equal(outAttdef?.text?.value, 'LEGACY_EDITED');
  assert.equal(outAttdef?.attribute_default, 'LEGACY_EDITED');
  assert.equal(outAttdef?.attribute_prompt, 'LEGACY_PROMPT');
});

test('document restore upgrades legacy ATTDEF snapshots to default-only text semantics', () => {
  const { document } = setup();
  document.restore({
    nextEntityId: 2,
    nextLayerId: 1,
    layers: [
      { id: 0, name: '0', visible: true, locked: false, printable: true, frozen: false, construction: false, color: '#ffffff' },
    ],
    entities: [
      {
        id: 1,
        type: 'text',
        layerId: 0,
        visible: true,
        color: '#ffffff',
        name: '',
        position: { x: 5, y: 6 },
        value: 'RESTORE_DEFAULT\nRESTORE_PROMPT',
        height: 2.5,
        rotation: 0,
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        textKind: 'attdef',
        attributeTag: 'RESTORE_TAG',
        attributePrompt: 'RESTORE_PROMPT',
      },
    ],
    meta: {
      label: '',
      author: '',
      comment: '',
      unit: 'mm',
      schema: 'vemcad-web-2d-v1',
      currentSpace: 0,
      currentLayout: 'Model',
    },
  });

  const restored = document.getEntity(1);
  assert.equal(restored?.value, 'RESTORE_DEFAULT');
  assert.equal(restored?.attributeDefault, 'RESTORE_DEFAULT');
  assert.equal(restored?.attributePrompt, 'RESTORE_PROMPT');
});

test('imported invisible constant INSERT attributes stay hidden, can be focused as insert text, and reject direct edits', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    metadata: {
      label: 'Hidden Constant Insert Attribute Fixture',
      author: 'test',
      comment: '',
      unit_name: 'mm',
    },
    settings: {},
    feature_flags: {},
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 5,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenConstBlock',
        text_kind: 'attdef',
        attribute_tag: 'HIDDEN_CONST_TAG',
        attribute_default: 'HIDDEN_CONST_DEFAULT',
        attribute_prompt: 'HIDDEN_CONST_PROMPT',
        attribute_flags: 3,
        attribute_invisible: true,
        attribute_constant: true,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: false,
        text: {
          pos: [106, 22],
          h: 2.5,
          rot: 0,
          value: 'HIDDEN_CONST_DEFAULT',
        },
      },
      {
        id: 6,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenConstBlock',
        line: [[96, 18], [116, 18]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const hiddenConst = document.getEntity(5);
  assert.equal(hiddenConst?.visible, false);
  assert.equal(hiddenConst?.attributeInvisible, true);
  assert.equal(hiddenConst?.attributeConstant, true);
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [6]);

  selection.setSelection([6], 6);
  const selectText = bus.execute('selection.insertSelectText', { targetId: 6 });
  assert.equal(selectText.ok, true);
  assert.deepEqual(selection.entityIds, [5]);
  assert.equal(selection.primaryId, 5);

  const patchResult = bus.execute('selection.propertyPatch', { patch: { value: 'SHOULD_NOT_EDIT' } });
  assert.equal(patchResult.ok, false);
  assert.equal(patchResult.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.equal(document.getEntity(5)?.value, 'HIDDEN_CONST_DEFAULT');

  const selectGroup = bus.execute('selection.insertGroup', { targetId: 5 });
  assert.equal(selectGroup.ok, true);
  assert.deepEqual(selection.entityIds, [5, 6]);
});

test('document restore hides invisible INSERT text proxies when legacy snapshots omit visible', () => {
  const { document } = setup();
  document.restore({
    nextEntityId: 3,
    nextLayerId: 1,
    layers: [
      { id: 0, name: '0', visible: true, locked: false, printable: true, frozen: false, construction: false, color: '#ffffff' },
    ],
    entities: [
      {
        id: 1,
        type: 'text',
        layerId: 0,
        color: '#ffffff',
        name: '',
        position: { x: 8, y: 9 },
        value: 'HIDDEN_VALUE',
        height: 2.5,
        rotation: 0,
        sourceType: 'INSERT',
        editMode: 'proxy',
        proxyKind: 'text',
        textKind: 'attrib',
        attributeTag: 'HIDDEN_TAG',
        attributeInvisible: true,
      },
      {
        id: 2,
        type: 'line',
        layerId: 0,
        color: '#ffffff',
        name: '',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      },
    ],
    meta: {
      label: '',
      author: '',
      comment: '',
      unit: 'mm',
      schema: 'vemcad-web-2d-v1',
      currentSpace: 0,
      currentLayout: 'Model',
    },
  });

  assert.equal(document.getEntity(1)?.visible, false);
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [2]);
});

test('imported invisible editable INSERT text proxies stay hidden but accept value and position overrides when not lock-positioned', () => {
  const fixture = {
    cadgf_version: '1.0.0',
    schema_version: 1,
    feature_flags: { earcut: false, clipper2: false },
    metadata: {
      label: '',
      author: '',
      company: '',
      comment: '',
      created_at: '',
      modified_at: '',
      unit_name: '',
      meta: {
        'dxf.default_space': '0',
        'dxf.entity.1.attribute_constant': '0',
        'dxf.entity.1.attribute_flags': '1',
        'dxf.entity.1.attribute_invisible': '1',
        'dxf.entity.1.attribute_tag': 'HIDDEN_EDITABLE_TAG',
        'dxf.entity.1.block_name': 'HiddenEditableBlock',
        'dxf.entity.1.color_source': 'BYLAYER',
        'dxf.entity.1.edit_mode': 'exploded',
        'dxf.entity.1.proxy_kind': 'insert',
        'dxf.entity.1.source_type': 'INSERT',
        'dxf.entity.1.space': '0',
        'dxf.entity.1.text_kind': 'attrib',
        'dxf.entity.2.block_name': 'HiddenEditableBlock',
        'dxf.entity.2.color_source': 'BYLAYER',
        'dxf.entity.2.edit_mode': 'exploded',
        'dxf.entity.2.proxy_kind': 'insert',
        'dxf.entity.2.source_type': 'INSERT',
        'dxf.entity.2.space': '0',
      },
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 7,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: 1,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenEditableBlock',
        text: { pos: [16, 12], h: 2.5, rot: 0, value: 'HIDDEN_EDITABLE_VALUE' },
        text_kind: 'attrib',
        attribute_tag: 'HIDDEN_EDITABLE_TAG',
        attribute_flags: 1,
        attribute_invisible: true,
        attribute_constant: false,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: false,
      },
      {
        id: 2,
        type: 2,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: 1,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenEditableBlock',
        line: [[10, 10], [24, 10]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const hiddenEditable = document.getEntity(1);
  assert.equal(hiddenEditable?.visible, false);
  assert.equal(hiddenEditable?.attributeInvisible, true);
  assert.equal(hiddenEditable?.attributeConstant, false);
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [2]);

  selection.setSelection([2], 2);
  const selectText = bus.execute('selection.insertSelectText', { targetId: 2 });
  assert.equal(selectText.ok, true);
  assert.deepEqual(selection.entityIds, [1]);
  assert.equal(selection.primaryId, 1);

  const patchResult = bus.execute('selection.propertyPatch', { patch: { value: 'HIDDEN_EDITABLE_PATCHED' } });
  assert.equal(patchResult.ok, true);
  assert.equal(document.getEntity(1)?.value, 'HIDDEN_EDITABLE_PATCHED');

  const positionPatch = bus.execute('selection.propertyPatch', { patch: { position: { x: 19, y: 14 } } });
  assert.equal(positionPatch.ok, true);
  assert.deepEqual(document.getEntity(1)?.position, { x: 19, y: 14 });
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [2]);

  const exported = exportCadgfDocument(document);
  const exportedText = exported.entities.find((entity) => entity.id === 1);
  assert.equal(exportedText?.attribute_invisible, true);
  assert.equal(exportedText?.attribute_constant, false);
  assert.equal(exportedText?.text?.value, 'HIDDEN_EDITABLE_PATCHED');
  assert.deepEqual(exportedText?.text?.pos, [19, 14]);
});

test('selection.insertSelectEditableText narrows mixed INSERT groups to directly editable text only', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 31,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 12, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'exploded',
    proxyKind: 'insert',
    groupId: 41,
    blockName: 'MixedAttributeBlock',
    space: 0,
    layout: 'Model',
  });
  document.addEntity({
    id: 32,
    type: 'text',
    position: { x: 4, y: 2 },
    value: 'MIXED_EDITABLE_VALUE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attrib',
    attributeTag: 'MIXED_EDITABLE_TAG',
    attributeFlags: 0,
    attributeConstant: false,
    attributeLockPosition: false,
    groupId: 41,
    blockName: 'MixedAttributeBlock',
    space: 0,
    layout: 'Model',
  });
  document.addEntity({
    id: 33,
    type: 'text',
    position: { x: 8, y: 2 },
    value: 'MIXED_CONST',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attdef',
    attributeTag: 'MIXED_CONST_TAG',
    attributeDefault: 'MIXED_CONST',
    attributePrompt: 'MIXED_CONST_PROMPT',
    attributeFlags: 2,
    attributeConstant: true,
    attributeLockPosition: false,
    groupId: 41,
    blockName: 'MixedAttributeBlock',
    space: 0,
    layout: 'Model',
  });

  selection.setSelection([31], 31);

  const selectText = bus.execute('selection.insertSelectText');
  assert.equal(selectText.ok, true);
  assert.deepEqual(selection.entityIds, [32, 33]);
  assert.equal(selection.primaryId, 32);

  selection.setSelection([31], 31);
  const selectEditableText = bus.execute('selection.insertSelectEditableText');
  assert.equal(selectEditableText.ok, true);
  assert.equal(selectEditableText.changed, true);
  assert.equal(selectEditableText.message, 'Selected editable insert text (1 of 3 entities)');
  assert.deepEqual(selection.entityIds, [32]);
  assert.equal(selection.primaryId, 32);
});

test('selection.insertSelectEditableText rejects INSERT groups without editable text', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 34,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 12, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'exploded',
    proxyKind: 'insert',
    groupId: 42,
    blockName: 'MixedAttributeBlock',
    space: 0,
    layout: 'Model',
  });
  document.addEntity({
    id: 35,
    type: 'text',
    position: { x: 8, y: 2 },
    value: 'MIXED_CONST',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attdef',
    attributeTag: 'MIXED_CONST_TAG',
    attributeDefault: 'MIXED_CONST',
    attributePrompt: 'MIXED_CONST_PROMPT',
    attributeFlags: 2,
    attributeConstant: true,
    attributeLockPosition: false,
    groupId: 42,
    blockName: 'MixedAttributeBlock',
    space: 0,
    layout: 'Model',
  });

  selection.setSelection([34], 34);

  const selectEditableText = bus.execute('selection.insertSelectEditableText');
  assert.equal(selectEditableText.ok, false);
  assert.equal(selectEditableText.error_code, 'GROUP_HAS_NO_EDITABLE_TEXT');
  assert.deepEqual(selection.entityIds, [34]);
  assert.equal(selection.primaryId, 34);
});

test('selection.insertReleaseGroup releases imported insert members to editable geometry', () => {
  const { document, selection, bus } = setup();

  document.ensureLayer(12);
  document.updateLayer(12, { color: '#88aaee' });
  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 12,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    lineType: 'BYBLOCK',
    color: '#334455',
    colorSource: 'BYBLOCK',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 12,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    color: '#556677',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    height: 2.5,
    layerId: 12,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    color: '#778899',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([9], 9);
  const proxyPatch = bus.execute('selection.propertyPatch', { patch: { value: 'TAG_PROXY_EDITED' } });
  assert.equal(proxyPatch.ok, true);
  assert.equal(proxyPatch.changed, true);
  assert.equal(document.getEntity(9).value, 'TAG_PROXY_EDITED');

  selection.setSelection([7], 7);
  const released = bus.execute('selection.insertReleaseGroup');
  assert.equal(released.ok, true);
  assert.equal(released.changed, true);
  assert.equal(released.message, 'Released insert group to editable geometry (3 entities)');
  assert.deepEqual(selection.entityIds, [7, 8, 9]);

  const line = document.getEntity(7);
  const text = document.getEntity(9);
  assert.equal(line.sourceType, undefined);
  assert.equal(line.editMode, undefined);
  assert.equal(line.groupId, undefined);
  assert.equal(line.blockName, undefined);
  assert.equal(line.colorSource, 'TRUECOLOR');
  assert.equal(line.color, '#334455');
  assert.equal(line.lineType, 'CONTINUOUS');
  assert.equal(text.value, 'TAG_PROXY_EDITED');

  assert.equal(text.sourceType, undefined);
  assert.equal(text.editMode, undefined);
  assert.equal(text.proxyKind, undefined);
  assert.equal(text.groupId, undefined);
  assert.equal(text.blockName, undefined);

  selection.setSelection([9], 9);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(9).value, 'EDITED');
});

test('selection.insertEditText releases only insert text members and keeps remaining insert geometry grouped', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'CONST_TAG',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attdef',
    attributeTag: 'CONST_TAG',
    attributeDefault: 'CONST_TAG',
    attributePrompt: 'CONST_TAG_PROMPT',
    attributeConstant: true,
    attributeLockPosition: true,
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7], 7);
  const released = bus.execute('selection.insertEditText');
  assert.equal(released.ok, true);
  assert.equal(released.changed, true);
  assert.equal(released.message, 'Released insert text to editable geometry (1 of 2 entities)');
  assert.deepEqual(selection.entityIds, [9]);
  assert.equal(selection.primaryId, 9);

  const line = document.getEntity(7);
  const text = document.getEntity(9);
  assert.equal(line.sourceType, 'INSERT');
  assert.equal(line.editMode, 'fragment');
  assert.equal(line.groupId, 500);
  assert.equal(line.blockName, 'DoorTag');

  assert.equal(text.sourceType, undefined);
  assert.equal(text.editMode, undefined);
  assert.equal(text.proxyKind, undefined);
  assert.equal(text.groupId, undefined);
  assert.equal(text.blockName, undefined);
  assert.equal(text.value, 'CONST_TAG');
  assert.equal(text.textKind, undefined);
  assert.equal(text.attributeTag, undefined);
  assert.equal(text.attributeDefault, undefined);
  assert.equal(text.attributePrompt, undefined);
  assert.equal(text.attributeConstant, undefined);
  assert.equal(text.attributeLockPosition, undefined);
  assert.equal(text.releasedInsertArchive?.sourceType, 'INSERT');
  assert.equal(text.releasedInsertArchive?.editMode, 'proxy');
  assert.equal(text.releasedInsertArchive?.proxyKind, 'text');
  assert.equal(text.releasedInsertArchive?.groupId, 500);
  assert.equal(text.releasedInsertArchive?.blockName, 'DoorTag');
  assert.equal(text.releasedInsertArchive?.textKind, 'attdef');
  assert.equal(text.releasedInsertArchive?.attributeTag, 'CONST_TAG');
  assert.equal(text.releasedInsertArchive?.attributeDefault, 'CONST_TAG');
  assert.equal(text.releasedInsertArchive?.attributePrompt, 'CONST_TAG_PROMPT');
  assert.equal(text.releasedInsertArchive?.attributeConstant, true);
  assert.equal(text.releasedInsertArchive?.attributeLockPosition, true);

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'DETACHED_TAG', position: { x: 8, y: 3 }, height: 3.5 } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(9).value, 'DETACHED_TAG');
  assert.deepEqual(document.getEntity(9).position, { x: 8, y: 3 });
  assert.equal(document.getEntity(9).height, 3.5);
  assert.equal(document.getEntity(9).releasedInsertArchive?.attributeTag, 'CONST_TAG');

  const exported = exportCadgfDocument(document);
  const outText = exported.entities.find((entity) => entity.id === 9);
  assert.equal(outText?.source_type, undefined);
  assert.equal(outText?.edit_mode, undefined);
  assert.equal(outText?.proxy_kind, undefined);
  assert.equal(outText?.text_kind, undefined);
  assert.equal(outText?.attribute_tag, undefined);
  assert.equal(outText?.attribute_default, undefined);
  assert.equal(outText?.attribute_prompt, undefined);
  assert.equal(outText?.attribute_constant, undefined);
  assert.equal(outText?.attribute_lock_position, undefined);
  assert.equal(outText?.released_insert_archive, undefined);
  assert.equal(outText?.releasedInsertArchive, undefined);
});

test('selection.releasedInsertGroup selects the surviving imported insert members from released text', () => {
  const { document, selection, bus } = setup();
  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 12, y: 0 },
    layerId: 0,
    color: '#ffffff',
    colorSource: 'BYLAYER',
    sourceType: 'INSERT',
    editMode: 'fragment',
    proxyKind: 'insert',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    value: 'CONST_TAG',
    position: { x: 6, y: 3 },
    height: 2.5,
    rotation: 0,
    layerId: 0,
    color: '#ffffff',
    colorSource: 'BYLAYER',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 500,
      blockName: 'DoorTag',
      textKind: 'attdef',
      attributeTag: 'CONST_TAG',
    },
    space: 1,
    layout: 'Layout-A',
  });
  selection.setSelection([9], 9);

  const result = bus.execute('selection.releasedInsertGroup');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Selected released insert group (1 entities)');
  assert.deepEqual(selection.entityIds, [7]);
  assert.equal(selection.primaryId, 7);
});

test('selection.insertReleaseGroup rejects insert groups with unsupported members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'unsupported',
    layerId: 0,
    visible: true,
    readOnly: true,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 500,
    blockName: 'DoorTag',
    display_proxy: {
      kind: 'point',
      point: { x: 2, y: 2 },
    },
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7], 7);
  const released = bus.execute('selection.insertReleaseGroup');
  assert.equal(released.ok, false);
  assert.equal(released.error_code, 'UNSUPPORTED_INSERT_MEMBER');
  assert.equal(document.getEntity(7).sourceType, 'INSERT');
  assert.equal(document.getEntity(8).sourceType, 'INSERT');
});

test('selection.sourceReleaseGroup releases imported source-group members to editable geometry', () => {
  const { document, selection, bus } = setup();

  document.ensureLayer(12);
  document.updateLayer(12, { color: '#88aaee' });
  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 12,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    lineType: 'BYBLOCK',
    color: '#334455',
    colorSource: 'BYBLOCK',
    dimType: 0,
    dimStyle: 'STANDARD',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 12,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    color: '#778899',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21], 21);
  const released = bus.execute('selection.sourceReleaseGroup');
  assert.equal(released.ok, true);
  assert.equal(released.changed, true);
  assert.equal(released.message, 'Released source group to editable geometry (2 entities)');
  assert.deepEqual(selection.entityIds, [21, 22]);

  const line = document.getEntity(21);
  const text = document.getEntity(22);
  assert.equal(line.sourceType, undefined);
  assert.equal(line.editMode, undefined);
  assert.equal(line.proxyKind, undefined);
  assert.equal(line.groupId, undefined);
  assert.equal(line.colorSource, 'TRUECOLOR');
  assert.equal(line.color, '#334455');
  assert.equal(line.lineType, 'CONTINUOUS');
  assert.equal(line.dimType, undefined);
  assert.equal(line.dimStyle, undefined);

  assert.equal(text.sourceType, undefined);
  assert.equal(text.editMode, undefined);
  assert.equal(text.proxyKind, undefined);
  assert.equal(text.groupId, undefined);
  assert.equal(text.dimTextPos, undefined);
  assert.equal(text.dimTextRotation, undefined);

  selection.setSelection([22], 22);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(22).value, 'EDITED');
});

test('selection.sourceReleaseGroup rejects unsupported source-group members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'unsupported',
    layerId: 0,
    visible: true,
    readOnly: true,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    display_proxy: {
      kind: 'point',
      point: { x: 2, y: 2 },
    },
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21], 21);
  const released = bus.execute('selection.sourceReleaseGroup');
  assert.equal(released.ok, false);
  assert.equal(released.error_code, 'UNSUPPORTED_SOURCE_MEMBER');
  assert.equal(document.getEntity(21).sourceType, 'DIMENSION');
  assert.equal(document.getEntity(22).sourceType, 'DIMENSION');
});

test('selection.sourceEditGroupText releases source group and selects released text members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 31,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 32,
    type: 'text',
    position: { x: 4, y: 1 },
    value: 'NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([31], 31);
  const result = bus.execute('selection.sourceEditGroupText');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Released source group and selected source text (1 of 2 entities)');
  assert.deepEqual(selection.entityIds, [32]);
  assert.equal(selection.primaryId, 32);
  assert.equal(document.getEntity(31).sourceType, undefined);
  assert.equal(document.getEntity(32).sourceType, undefined);
  assert.equal(document.getEntity(32).editMode, undefined);

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'EDITED NOTE' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(32).value, 'EDITED NOTE');
});

test('selection.sourceEditGroupText releases single imported MLEADER proxy text to editable text', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 51,
    type: 'text',
    position: { x: 12, y: 18 },
    value: 'MLEADER_NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'mleader',
    textKind: 'mleader',
    groupId: 901,
    sourceTextPos: { x: 12, y: 18 },
    sourceTextRotation: 0,
    space: 0,
    layout: 'Model',
  });

  selection.setSelection([51], 51);
  const result = bus.execute('selection.sourceEditGroupText');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Released source group and selected source text (1 of 1 entities)');
  assert.deepEqual(selection.entityIds, [51]);
  assert.equal(selection.primaryId, 51);
  assert.equal(document.getEntity(51).sourceType, undefined);
  assert.equal(document.getEntity(51).editMode, undefined);
  assert.equal(document.getEntity(51).proxyKind, undefined);
  assert.equal(document.getEntity(51).groupId, undefined);
  assert.equal(document.getEntity(51).textKind, 'mleader');
  assert.equal(document.getEntity(51).sourceTextPos, undefined);
  assert.equal(document.getEntity(51).sourceTextRotation, undefined);

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'MLEADER_EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(51).value, 'MLEADER_EDITED');
});

test('selection.sourceSelectText narrows a DIMENSION source group to proxy text without release', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 24,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21], 21);
  const selectText = bus.execute('selection.sourceSelectText');
  assert.equal(selectText.ok, true);
  assert.equal(selectText.changed, true);
  assert.equal(selectText.message, 'Selected source text (1 of 2 entities)');
  assert.deepEqual(selection.entityIds, [24]);
  assert.equal(selection.primaryId, 24);
  assert.equal(document.getEntity(24).sourceType, 'DIMENSION');
  assert.equal(document.getEntity(24).editMode, 'proxy');

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'DIM_EDITED_IN_PLACE' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(24).value, 'DIM_EDITED_IN_PLACE');
  assert.equal(document.getEntity(24).sourceType, 'DIMENSION');
  assert.equal(document.getEntity(24).editMode, 'proxy');
});

test('selection.sourceSelectText rejects source groups without text members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'polyline',
    points: [{ x: 30, y: 0 }, { x: 38, y: 0 }, { x: 38, y: 6 }, { x: 30, y: 6 }, { x: 30, y: 0 }],
    closed: false,
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 701,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41], 41);
  const result = bus.execute('selection.sourceSelectText');
  assert.equal(result.ok, false);
  assert.equal(result.error_code, 'GROUP_HAS_NO_TEXT');
});

test('selection.sourceResetTextPlacement restores DIMENSION proxy text placement and syncs dim metadata', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 24,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 4, y: 18 },
    value: '42',
    height: 2.5,
    rotation: Math.PI / 6,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 4, y: 18 },
    dimTextRotation: Math.PI / 6,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([24], 24);
  const result = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Reset source text placement (1 of 1 entities)');
  assert.deepEqual(document.getEntity(24).position, { x: 0, y: 14 });
  approxEqual(document.getEntity(24).rotation, 0);
  assert.deepEqual(document.getEntity(24).dimTextPos, { x: 0, y: 14 });
  approxEqual(document.getEntity(24).dimTextRotation, 0);
  assert.equal(document.getEntity(24).sourceType, 'DIMENSION');
  assert.equal(document.getEntity(24).editMode, 'proxy');
});

test('selection.dimensionFlipTextSide applies opposite side to DIMENSION proxy text without mutating source placement', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 24,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21], 21);
  const result = bus.execute('selection.dimensionFlipTextSide');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Applied opposite DIMENSION text side (1 of 2 entities)');
  assert.deepEqual(document.getEntity(24).position, { x: 0, y: -14 });
  assert.deepEqual(document.getEntity(24).dimTextPos, { x: 0, y: -14 });
  approxEqual(document.getEntity(24).rotation, 0);
  approxEqual(document.getEntity(24).dimTextRotation, 0);
  assert.deepEqual(document.getEntity(24).sourceTextPos, { x: 0, y: 14 });
  assert.deepEqual(document.getEntity(24).sourceType, 'DIMENSION');
  assert.deepEqual(document.getEntity(24).editMode, 'proxy');
});

test('selection.dimensionFlipTextSide uses transformed source anchor for moved DIMENSION bundles', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -17, y: -2 },
    end: { x: 23, y: -2 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 24,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 3, y: 12 },
    value: '42',
    height: 2.5,
    rotation: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceTextPos: { x: 3, y: 12 },
    sourceTextRotation: 0,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 3, y: 12 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([24], 24);
  const result = bus.execute('selection.dimensionFlipTextSide');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Applied opposite DIMENSION text side (1 of 2 entities)');
  assert.deepEqual(document.getEntity(24).position, { x: 3, y: -16 });
  assert.deepEqual(document.getEntity(24).dimTextPos, { x: 3, y: -16 });
  approxEqual(document.getEntity(24).rotation, 0);
  approxEqual(document.getEntity(24).dimTextRotation, 0);
  assert.deepEqual(document.getEntity(24).sourceTextPos, { x: 3, y: 12 });
});

test('selection.leaderFlipLandingSide applies opposite landing side to LEADER proxy text without mutating source placement', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'line',
    start: { x: 50, y: 0 },
    end: { x: 56, y: 6 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 58, y: 7 },
    value: 'LEADER_NOTE',
    height: 2.5,
    rotation: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41], 41);
  const result = bus.execute('selection.leaderFlipLandingSide');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Applied opposite LEADER landing side (1 of 2 entities)');
  assert.deepEqual(document.getEntity(42).position, { x: 57, y: 8 });
  approxEqual(document.getEntity(42).rotation, 0);
  assert.deepEqual(document.getEntity(42).sourceTextPos, { x: 58, y: 7 });
  assert.deepEqual(document.getEntity(42).sourceType, 'LEADER');
  assert.deepEqual(document.getEntity(42).editMode, 'proxy');
});

test('selection.leaderFlipLandingSide uses transformed landing guide for moved LEADER bundles', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'line',
    start: { x: 53, y: -2 },
    end: { x: 59, y: 4 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 61, y: 5 },
    value: 'LEADER_NOTE',
    height: 2.5,
    rotation: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    sourceTextPos: { x: 61, y: 5 },
    sourceTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([42], 42);
  const result = bus.execute('selection.leaderFlipLandingSide');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Applied opposite LEADER landing side (1 of 2 entities)');
  assert.deepEqual(document.getEntity(42).position, { x: 60, y: 6 });
  approxEqual(document.getEntity(42).rotation, 0);
  assert.deepEqual(document.getEntity(42).sourceTextPos, { x: 61, y: 5 });
});

test('selection.sourceEditGroupText rejects source groups without text members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'polyline',
    points: [{ x: 30, y: 0 }, { x: 38, y: 0 }, { x: 38, y: 6 }, { x: 30, y: 6 }, { x: 30, y: 0 }],
    closed: false,
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 701,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'line',
    start: { x: 31, y: 1 },
    end: { x: 37, y: 5 },
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 701,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41], 41);
  const result = bus.execute('selection.sourceEditGroupText');
  assert.equal(result.ok, false);
  assert.equal(result.error_code, 'GROUP_HAS_NO_TEXT');
  assert.equal(document.getEntity(41).sourceType, 'HATCH');
  assert.equal(document.getEntity(42).sourceType, 'HATCH');
});

test('selection.propertyPatch allows direct text override on read-only DIMENSION text proxy', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 24,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([24], 24);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'OVERRIDE', rotation: Math.PI / 6 } });
  assert.equal(patch.ok, true);
  assert.equal(patch.changed, true);
  assert.equal(document.getEntity(24).value, 'OVERRIDE');
  approxEqual(document.getEntity(24).rotation, Math.PI / 6);
  approxEqual(document.getEntity(24).dimTextRotation, Math.PI / 6);
  assert.equal(document.getEntity(24).sourceType, 'DIMENSION');
  assert.equal(document.getEntity(24).editMode, 'proxy');
});

test('selection.propertyPatch syncs dimension text proxy position into dimTextPos', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 24,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([24], 24);
  const patch = bus.execute('selection.propertyPatch', { patch: { position: { x: 3, y: 18 } } });
  assert.equal(patch.ok, true);
  assert.equal(patch.changed, true);
  assert.deepEqual(document.getEntity(24).position, { x: 3, y: 18 });
  assert.deepEqual(document.getEntity(24).dimTextPos, { x: 3, y: 18 });
});

test('selection.propertyPatch allows direct text override on read-only LEADER text proxy', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 42,
    type: 'text',
    layerId: 0,
    visible: true,
    color: '#808080',
    position: { x: 58, y: 7 },
    value: 'LEADER_NOTE',
    height: 2.5,
    rotation: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([42], 42);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'LEADER_EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(patch.changed, true);
  assert.equal(document.getEntity(42).value, 'LEADER_EDITED');
  assert.equal(document.getEntity(42).sourceType, 'LEADER');
  assert.equal(document.getEntity(42).editMode, 'proxy');
});

test('selection.sourceSelectText narrows a LEADER source group to proxy text without release', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'line',
    start: { x: 50, y: 0 },
    end: { x: 58, y: 7 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'text',
    position: { x: 58, y: 7 },
    value: 'LEADER_NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41], 41);
  const selectText = bus.execute('selection.sourceSelectText');
  assert.equal(selectText.ok, true);
  assert.equal(selectText.changed, true);
  assert.equal(selectText.message, 'Selected source text (1 of 2 entities)');
  assert.deepEqual(selection.entityIds, [42]);
  assert.equal(selection.primaryId, 42);

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'LEADER_EDITED_IN_PLACE' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(42).value, 'LEADER_EDITED_IN_PLACE');
  assert.equal(document.getEntity(42).sourceType, 'LEADER');
  assert.equal(document.getEntity(42).editMode, 'proxy');
});

test('selection.sourceResetTextPlacement restores LEADER proxy text placement from grouped selection', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'line',
    start: { x: 50, y: 0 },
    end: { x: 58, y: 7 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'text',
    position: { x: 63, y: 9 },
    value: 'LEADER_NOTE',
    height: 2.5,
    rotation: Math.PI / 8,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41], 41);
  const result = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.message, 'Reset source text placement (1 of 2 entities)');
  assert.deepEqual(document.getEntity(42).position, { x: 58, y: 7 });
  approxEqual(document.getEntity(42).rotation, 0);
  assert.equal(document.getEntity(42).sourceType, 'LEADER');
  assert.equal(document.getEntity(42).editMode, 'proxy');
});

test('selection.copy duplicates full imported insert group as detached geometry', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    height: 2.5,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8, 9], 7);
  const copy = bus.execute('selection.copy', { delta: { x: 20, y: 5 } });
  assert.equal(copy.ok, true);
  assert.equal(copy.changed, true);
  assert.equal(copy.message, 'Copied insert group as detached geometry (3 entities)');
  assert.equal(document.listEntities().length, 6);
  assert.equal(selection.entityIds.length, 3);
  const copiedIds = selection.entityIds;
  const copiedEntities = copiedIds.map((id) => document.getEntity(id));
  assert.ok(copiedEntities.every((entity) => !entity.sourceType && !entity.editMode && !entity.proxyKind && !Number.isFinite(entity.groupId)));
  assert.ok(copiedEntities.some((entity) => entity.type === 'text' && entity.value === 'TAG'));
  const copiedText = copiedEntities.find((entity) => entity.type === 'text');
  approxEqual(copiedText.position.x, 26);
  approxEqual(copiedText.position.y, 6);
});

test('selection.copy duplicates full imported source group as detached geometry', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimType: 0,
    dimStyle: 'STANDARD',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    dimType: 0,
    dimStyle: 'STANDARD',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21, 22], 21);
  const copy = bus.execute('selection.copy', { delta: { x: 20, y: 5 } });
  assert.equal(copy.ok, true);
  assert.equal(copy.changed, true);
  assert.equal(copy.message, 'Copied source group as detached geometry (2 entities)');
  assert.equal(document.listEntities().length, 4);
  assert.equal(selection.entityIds.length, 2);
  const copiedIds = selection.entityIds;
  const copiedEntities = copiedIds.map((id) => document.getEntity(id));
  assert.ok(copiedEntities.every((entity) => !entity.sourceType && !entity.editMode && !entity.proxyKind && !Number.isFinite(entity.groupId)));
  const copiedText = copiedEntities.find((entity) => entity.type === 'text');
  approxEqual(copiedText.position.x, 20);
  approxEqual(copiedText.position.y, 19);
});

test('selection.copy rejects full imported insert group with unsupported members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'unsupported',
    layerId: 0,
    visible: true,
    readOnly: true,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 500,
    blockName: 'DoorTag',
    display_proxy: {
      kind: 'point',
      point: { x: 2, y: 2 },
    },
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8], 7);
  const copy = bus.execute('selection.copy', { delta: { x: 5, y: 0 } });
  assert.equal(copy.ok, false);
  assert.equal(copy.error_code, 'UNSUPPORTED_INSERT_MEMBER');
  assert.equal(document.listEntities().length, 2);
});

test('selection.delete removes full imported insert group including read-only proxy', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    height: 2.5,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8], 7);
  const deleted = bus.execute('selection.delete');
  assert.equal(deleted.ok, true);
  assert.equal(deleted.changed, true);
  assert.equal(deleted.message, 'Deleted insert group (2 entities, including 1 proxy)');
  assert.equal(document.listEntities().length, 0);
  assert.deepEqual(selection.entityIds, []);
});

test('selection.delete removes full imported source group including read-only members', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21, 22], 21);
  const deleted = bus.execute('selection.delete');
  assert.equal(deleted.ok, true);
  assert.equal(deleted.changed, true);
  assert.equal(deleted.message, 'Deleted source group (2 entities, including 2 read-only)');
  assert.equal(document.listEntities().length, 0);
  assert.deepEqual(selection.entityIds, []);
});

test('selection.move rejects read-only unsupported proxy', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      display_proxy: { kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }] },
      cadgf: { id: 9001, type: 6, spline: { control: [[0, 0], [3, 0]] } },
    },
  });

  selection.setSelection([1], 1);
  const move = bus.execute('selection.move', { delta: { x: 2, y: 1 } });
  assert.equal(move.ok, false);
  assert.equal(move.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.equal(document.listEntities().length, 1);
});

test('selection.move rejects derived proxy entity by editMode', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'text',
      layerId: 0,
      visible: true,
      color: '#ffffff',
      position: { x: 2, y: 3 },
      value: 'DIM',
      height: 2.5,
      rotation: 0,
      sourceType: 'DIMENSION',
      editMode: 'proxy',
      proxyKind: 'dimension',
      blockName: '*D12',
      textKind: 'dimension',
      dimType: 0,
      dimStyle: 'STANDARD',
    },
  });

  selection.setSelection([1], 1);
  const move = bus.execute('selection.move', { delta: { x: 2, y: 1 } });
  assert.equal(move.ok, false);
  assert.equal(move.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.equal(document.getEntity(1).position.x, 2);
  assert.equal(document.getEntity(1).position.y, 3);
});

test('selection.move keeps read-only INSERT proxy with the full insert group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8, 9], 7);
  const move = bus.execute('selection.move', { delta: { x: 5, y: -3 } });
  assert.equal(move.ok, true);
  assert.equal(move.changed, true);
  assert.equal(move.message, 'Moved insert group (3 entities, including 1 proxy)');
  assert.deepEqual(document.getEntity(7).start, { x: 5, y: -3 });
  assert.deepEqual(document.getEntity(7).end, { x: 15, y: -3 });
  assert.deepEqual(document.getEntity(8).center, { x: 9, y: 1 });
  assert.deepEqual(document.getEntity(9).position, { x: 11, y: -2 });
});

test('selection.move keeps read-only DIMENSION members with the full source group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21, 22], 21);
  const move = bus.execute('selection.move', { delta: { x: 5, y: -3 } });
  assert.equal(move.ok, true);
  assert.equal(move.changed, true);
  assert.equal(move.message, 'Moved source group (2 entities, including 2 read-only)');
  assert.deepEqual(document.getEntity(21).start, { x: -15, y: -3 });
  assert.deepEqual(document.getEntity(21).end, { x: 25, y: -3 });
  assert.deepEqual(document.getEntity(22).position, { x: 5, y: 11 });
});

test('selection.move carries DIMENSION source placement metadata and reset follows moved source', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    sourceAnchor: { x: 0, y: 0 },
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'midpoint',
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21, 22], 21);
  const move = bus.execute('selection.move', { delta: { x: 5, y: -3 } });
  assert.equal(move.ok, true);
  assert.deepEqual(document.getEntity(22).position, { x: 5, y: 11 });
  assert.deepEqual(document.getEntity(22).sourceTextPos, { x: 5, y: 11 });
  assert.equal(document.getEntity(22).sourceTextRotation, 0);
  assert.deepEqual(document.getEntity(22).sourceAnchor, { x: 5, y: -3 });
  assert.deepEqual(document.getEntity(22).dimTextPos, { x: 5, y: 11 });
  assert.equal(document.getEntity(22).dimTextRotation, 0);

  selection.setSelection([22], 22);
  const patch = bus.execute('selection.propertyPatch', {
    patch: {
      position: { x: 9, y: 13 },
      rotation: 0.5,
    },
  });
  assert.equal(patch.ok, true);
  const reset = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(reset.ok, true);
  assert.equal(reset.changed, true);
  assert.equal(reset.message, 'Reset source text placement (1 of 2 entities)');
  assert.deepEqual(document.getEntity(22).position, { x: 5, y: 11 });
  assert.equal(document.getEntity(22).rotation, 0);
  assert.deepEqual(document.getEntity(22).dimTextPos, { x: 5, y: 11 });
  assert.equal(document.getEntity(22).dimTextRotation, 0);
});

test('selection.move carries explicit LEADER guide metadata and resolver follows moved guide', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 31,
    type: 'polyline',
    points: [{ x: 50, y: 0 }, { x: 56, y: 6 }, { x: 64, y: 10 }],
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 801,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 32,
    type: 'text',
    position: { x: 58, y: 7 },
    value: 'NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 801,
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    sourceAnchor: { x: 50, y: 0 },
    leaderLanding: { x: 50, y: 0 },
    leaderElbow: { x: 56, y: 6 },
    sourceAnchorDriverType: 'polyline',
    sourceAnchorDriverKind: 'endpoint',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([31, 32], 31);
  const move = bus.execute('selection.move', { delta: { x: 5, y: -3 } });
  assert.equal(move.ok, true);
  assert.deepEqual(document.getEntity(32).position, { x: 63, y: 4 });
  assert.deepEqual(document.getEntity(32).sourceTextPos, { x: 63, y: 4 });
  assert.deepEqual(document.getEntity(32).sourceAnchor, { x: 55, y: -3 });
  assert.deepEqual(document.getEntity(32).leaderLanding, { x: 55, y: -3 });
  assert.deepEqual(document.getEntity(32).leaderElbow, { x: 61, y: 3 });

  const guide = resolveSourceTextGuide(document.listEntities(), document.getEntity(32));
  assert.deepEqual(guide?.anchor, { x: 55, y: -3 });
  assert.deepEqual(guide?.landingPoint, { x: 55, y: -3 });
  assert.deepEqual(guide?.elbowPoint, { x: 61, y: 3 });
  assert.equal(guide?.anchorDriverId, 31);
  assert.equal(guide?.anchorDriverLabel, 'polyline endpoint');
});

test('selection.move still skips INSERT proxy when only editable members are selected', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 4, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 6, y: 1 },
    value: 'TAG',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8], 7);
  const move = bus.execute('selection.move', { delta: { x: 5, y: -3 } });
  assert.equal(move.ok, true);
  assert.equal(move.changed, true);
  assert.equal(move.message, 'Moved 2 entities');
  assert.deepEqual(document.getEntity(7).start, { x: 5, y: -3 });
  assert.deepEqual(document.getEntity(8).center, { x: 9, y: 1 });
  assert.deepEqual(document.getEntity(9).position, { x: 6, y: 1 });
});

test('selection.rotate keeps read-only INSERT proxy with the full insert group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 2, y: 1 },
    value: 'TAG',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 9], 7);
  const rotate = bus.execute('selection.rotate', {
    center: { x: 0, y: 0 },
    angle: Math.PI / 2,
  });
  assert.equal(rotate.ok, true);
  assert.equal(rotate.changed, true);
  assert.equal(rotate.message, 'Rotated insert group (2 entities, including 1 proxy)');
  approxEqual(document.getEntity(7).start.x, 0);
  approxEqual(document.getEntity(7).start.y, 1);
  approxEqual(document.getEntity(7).end.x, 0);
  approxEqual(document.getEntity(7).end.y, 3);
  approxEqual(document.getEntity(9).position.x, -1);
  approxEqual(document.getEntity(9).position.y, 2);
  approxEqual(document.getEntity(9).rotation, Math.PI / 2);
});

test('selection.rotate keeps read-only LEADER members with the full source group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 31,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 32,
    type: 'text',
    position: { x: 4, y: 1 },
    value: 'NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([31, 32], 31);
  const rotate = bus.execute('selection.rotate', {
    center: { x: 0, y: 0 },
    angle: Math.PI / 2,
  });
  assert.equal(rotate.ok, true);
  assert.equal(rotate.changed, true);
  assert.equal(rotate.message, 'Rotated source group (2 entities, including 2 read-only)');
  approxEqual(document.getEntity(31).start.x, 0);
  approxEqual(document.getEntity(31).start.y, 1);
  approxEqual(document.getEntity(31).end.x, 0);
  approxEqual(document.getEntity(31).end.y, 3);
  approxEqual(document.getEntity(32).position.x, -1);
  approxEqual(document.getEntity(32).position.y, 4);
  approxEqual(document.getEntity(32).rotation, Math.PI / 2);
});

test('selection.rotate carries LEADER source placement metadata and reset follows rotated source', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 31,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 32,
    type: 'text',
    position: { x: 4, y: 1 },
    value: 'NOTE',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 800,
    sourceTextPos: { x: 4, y: 1 },
    sourceTextRotation: 0,
    sourceAnchor: { x: 3, y: 0 },
    leaderLanding: { x: 3, y: 0 },
    leaderElbow: { x: 1, y: 0 },
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'endpoint',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([31, 32], 31);
  const rotate = bus.execute('selection.rotate', {
    center: { x: 0, y: 0 },
    angle: Math.PI / 2,
  });
  assert.equal(rotate.ok, true);
  approxEqual(document.getEntity(32).position.x, -1);
  approxEqual(document.getEntity(32).position.y, 4);
  approxEqual(document.getEntity(32).rotation, Math.PI / 2);
  approxEqual(document.getEntity(32).sourceTextPos.x, -1);
  approxEqual(document.getEntity(32).sourceTextPos.y, 4);
  approxEqual(document.getEntity(32).sourceTextRotation, Math.PI / 2);
  approxEqual(document.getEntity(32).sourceAnchor.x, 0);
  approxEqual(document.getEntity(32).sourceAnchor.y, 3);
  approxEqual(document.getEntity(32).leaderLanding.x, 0);
  approxEqual(document.getEntity(32).leaderLanding.y, 3);
  approxEqual(document.getEntity(32).leaderElbow.x, 0);
  approxEqual(document.getEntity(32).leaderElbow.y, 1);

  selection.setSelection([32], 32);
  const patch = bus.execute('selection.propertyPatch', {
    patch: {
      position: { x: -2, y: 5 },
      rotation: 2,
    },
  });
  assert.equal(patch.ok, true);
  const reset = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(reset.ok, true);
  assert.equal(reset.changed, true);
  assert.equal(reset.message, 'Reset source text placement (1 of 2 entities)');
  approxEqual(document.getEntity(32).position.x, -1);
  approxEqual(document.getEntity(32).position.y, 4);
  approxEqual(document.getEntity(32).rotation, Math.PI / 2);
  const guide = resolveSourceTextGuide(document.listEntities(), document.getEntity(32));
  approxEqual(guide?.anchor?.x, 0);
  approxEqual(guide?.anchor?.y, 3);
  approxEqual(guide?.landingPoint?.x, 0);
  approxEqual(guide?.landingPoint?.y, 3);
  approxEqual(guide?.elbowPoint?.x, 0);
  approxEqual(guide?.elbowPoint?.y, 1);
  assert.equal(guide?.anchorDriverId, 31);
  assert.equal(guide?.anchorDriverLabel, 'line endpoint');
});

test('selection.scale scales geometry and can undo/redo', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
  });
  document.addEntity({
    id: 2,
    type: 'circle',
    center: { x: 2, y: 1 },
    radius: 1.5,
    layerId: 0,
  });

  selection.setSelection([1, 2], 1);
  const scale = bus.execute('selection.scale', {
    center: { x: 0, y: 0 },
    factor: 2,
  });
  assert.equal(scale.ok, true);
  assert.equal(scale.changed, true);
  assert.equal(scale.message, 'Scaled 2 entities');
  approxEqual(document.getEntity(1).start.x, 2);
  approxEqual(document.getEntity(1).start.y, 0);
  approxEqual(document.getEntity(1).end.x, 6);
  approxEqual(document.getEntity(1).end.y, 0);
  approxEqual(document.getEntity(2).center.x, 4);
  approxEqual(document.getEntity(2).center.y, 2);
  approxEqual(document.getEntity(2).radius, 3);

  const undo = bus.execute('history.undo');
  assert.equal(undo.ok, true);
  approxEqual(document.getEntity(1).start.x, 1);
  approxEqual(document.getEntity(1).start.y, 0);
  approxEqual(document.getEntity(1).end.x, 3);
  approxEqual(document.getEntity(1).end.y, 0);
  approxEqual(document.getEntity(2).center.x, 2);
  approxEqual(document.getEntity(2).center.y, 1);
  approxEqual(document.getEntity(2).radius, 1.5);

  const redo = bus.execute('history.redo');
  assert.equal(redo.ok, true);
  approxEqual(document.getEntity(1).start.x, 2);
  approxEqual(document.getEntity(1).start.y, 0);
  approxEqual(document.getEntity(1).end.x, 6);
  approxEqual(document.getEntity(1).end.y, 0);
  approxEqual(document.getEntity(2).center.x, 4);
  approxEqual(document.getEntity(2).center.y, 2);
  approxEqual(document.getEntity(2).radius, 3);
});

test('selection.scale keeps read-only INSERT proxy with the full insert group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 2, y: 0 },
    end: { x: 6, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 0, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 8, y: 6 },
    value: 'TAG',
    height: 2.5,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8, 9], 7);
  const scale = bus.execute('selection.scale', {
    center: { x: 0, y: 0 },
    factor: 0.5,
  });
  assert.equal(scale.ok, true);
  assert.equal(scale.changed, true);
  assert.equal(scale.message, 'Scaled insert group (3 entities, including 1 proxy)');
  approxEqual(document.getEntity(7).start.x, 1);
  approxEqual(document.getEntity(7).start.y, 0);
  approxEqual(document.getEntity(7).end.x, 3);
  approxEqual(document.getEntity(7).end.y, 0);
  approxEqual(document.getEntity(8).center.x, 0);
  approxEqual(document.getEntity(8).center.y, 2);
  approxEqual(document.getEntity(8).radius, 1);
  approxEqual(document.getEntity(9).position.x, 4);
  approxEqual(document.getEntity(9).position.y, 3);
  approxEqual(document.getEntity(9).height, 1.25);
});

test('selection.scale keeps read-only HATCH members with the full source group', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 41,
    type: 'polyline',
    points: [{ x: 30, y: 0 }, { x: 38, y: 0 }, { x: 38, y: 6 }, { x: 30, y: 6 }, { x: 30, y: 0 }],
    closed: false,
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 701,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 42,
    type: 'line',
    start: { x: 31, y: 1 },
    end: { x: 37, y: 5 },
    layerId: 0,
    sourceType: 'HATCH',
    editMode: 'proxy',
    proxyKind: 'hatch',
    groupId: 701,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([41, 42], 41);
  const scale = bus.execute('selection.scale', {
    center: { x: 30, y: 0 },
    factor: 0.5,
  });
  assert.equal(scale.ok, true);
  assert.equal(scale.changed, true);
  assert.equal(scale.message, 'Scaled source group (2 entities, including 2 read-only)');
  assert.deepEqual(document.getEntity(41).points, [
    { x: 30, y: 0 },
    { x: 34, y: 0 },
    { x: 34, y: 3 },
    { x: 30, y: 3 },
    { x: 30, y: 0 },
  ]);
  approxEqual(document.getEntity(42).start.x, 30.5);
  approxEqual(document.getEntity(42).start.y, 0.5);
  approxEqual(document.getEntity(42).end.x, 33.5);
  approxEqual(document.getEntity(42).end.y, 2.5);
});

test('selection.scale carries DIMENSION source placement metadata and reset follows scaled source', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 21,
    type: 'line',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 22,
    type: 'text',
    position: { x: 0, y: 14 },
    value: '42',
    height: 2.5,
    rotation: 0,
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    dimTextPos: { x: 0, y: 14 },
    dimTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([21, 22], 21);
  const scale = bus.execute('selection.scale', {
    center: { x: 0, y: 0 },
    factor: 0.5,
  });
  assert.equal(scale.ok, true);
  approxEqual(document.getEntity(22).position.x, 0);
  approxEqual(document.getEntity(22).position.y, 7);
  approxEqual(document.getEntity(22).height, 1.25);
  approxEqual(document.getEntity(22).sourceTextPos.x, 0);
  approxEqual(document.getEntity(22).sourceTextPos.y, 7);
  approxEqual(document.getEntity(22).sourceTextRotation, 0);
  approxEqual(document.getEntity(22).dimTextPos.x, 0);
  approxEqual(document.getEntity(22).dimTextPos.y, 7);
  approxEqual(document.getEntity(22).dimTextRotation, 0);

  selection.setSelection([22], 22);
  const patch = bus.execute('selection.propertyPatch', {
    patch: {
      position: { x: 2, y: 9 },
      rotation: 0.25,
    },
  });
  assert.equal(patch.ok, true);
  const reset = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(reset.ok, true);
  assert.equal(reset.changed, true);
  assert.equal(reset.message, 'Reset source text placement (1 of 2 entities)');
  approxEqual(document.getEntity(22).position.x, 0);
  approxEqual(document.getEntity(22).position.y, 7);
  approxEqual(document.getEntity(22).rotation, 0);
  approxEqual(document.getEntity(22).dimTextPos.x, 0);
  approxEqual(document.getEntity(22).dimTextPos.y, 7);
  approxEqual(document.getEntity(22).dimTextRotation, 0);
});

test('selection.scale still skips INSERT proxy when only editable members are selected', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 7,
    type: 'line',
    start: { x: 2, y: 0 },
    end: { x: 6, y: 0 },
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 8,
    type: 'circle',
    center: { x: 0, y: 4 },
    radius: 2,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });
  document.addEntity({
    id: 9,
    type: 'text',
    position: { x: 8, y: 6 },
    value: 'TAG',
    height: 2.5,
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-A',
  });

  selection.setSelection([7, 8], 7);
  const scale = bus.execute('selection.scale', {
    center: { x: 0, y: 0 },
    factor: 0.5,
  });
  assert.equal(scale.ok, true);
  assert.equal(scale.changed, true);
  assert.equal(scale.message, 'Scaled 2 entities');
  approxEqual(document.getEntity(7).start.x, 1);
  approxEqual(document.getEntity(7).end.x, 3);
  approxEqual(document.getEntity(8).center.y, 2);
  approxEqual(document.getEntity(8).radius, 1);
  approxEqual(document.getEntity(9).position.x, 8);
  approxEqual(document.getEntity(9).position.y, 6);
  approxEqual(document.getEntity(9).height, 2.5);
});

test('selection.scale rejects invalid factor', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 1, y: 0 },
    end: { x: 3, y: 0 },
    layerId: 0,
  });

  selection.setSelection([1], 1);
  const scale = bus.execute('selection.scale', {
    center: { x: 0, y: 0 },
    factor: 0,
  });
  assert.equal(scale.ok, false);
  assert.equal(scale.error_code, 'INVALID_SCALE');
  approxEqual(document.getEntity(1).start.x, 1);
  approxEqual(document.getEntity(1).end.x, 3);
});

test('line style helpers keep preview and editor mappings aligned', () => {
  assert.deepEqual(resolveLinePattern('CONTINUOUS', 2), null);
  assert.deepEqual(resolveLinePattern('BYLAYER', 2), null);
  assert.deepEqual(resolveLinePattern('CENTER', 0.5), { dash: 9, gap: 3 });
  assert.deepEqual(resolveLinePattern('DASHDOT', 1), { dash: 2, gap: 4 });

  assert.equal(resolveEffectiveEntityColor({ color: '#112233', colorSource: 'BYLAYER' }, { color: '#ff0000' }), '#ff0000');
  assert.deepEqual(resolveEffectiveEntityStyle(
    { lineType: 'BYLAYER', lineWeight: 0, lineTypeScale: 1, color: '#112233', colorSource: 'BYLAYER' },
    { lineType: 'CENTER', lineWeight: 0.35, color: '#ff0000' },
  ), {
    color: '#ff0000',
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1,
  });
  assert.deepEqual(resolveEntityStyleSources({
    colorSource: 'BYLAYER',
    lineType: 'BYLAYER',
    lineWeight: 0,
    lineWeightSource: 'BYLAYER',
    lineTypeScale: 1,
  }), {
    colorSource: 'BYLAYER',
    lineTypeSource: 'BYLAYER',
    lineWeightSource: 'BYLAYER',
    lineTypeScaleSource: 'DEFAULT',
  });
  assert.deepEqual(resolveEntityStyleSources({
    colorSource: 'TRUECOLOR',
    lineType: 'HIDDEN2',
    lineWeight: 0.55,
    lineWeightSource: 'EXPLICIT',
    lineTypeScale: 1.5,
  }), {
    colorSource: 'TRUECOLOR',
    lineTypeSource: 'EXPLICIT',
    lineWeightSource: 'EXPLICIT',
    lineTypeScaleSource: 'EXPLICIT',
  });
  assert.deepEqual(resolveEntityStyleSources({
    lineWeight: 0,
    lineWeightSource: 'EXPLICIT',
  }), {
    colorSource: 'TRUECOLOR',
    lineTypeSource: 'EXPLICIT',
    lineWeightSource: 'EXPLICIT',
    lineTypeScaleSource: 'DEFAULT',
  });

  assert.equal(resolveScaledLineWidth(0, { scale: 3 }), 0.54);
  assert.equal(resolveScaledLineWidth(0.35, { scale: 4, min: 1.2, max: 4.8 }), 1.4);
  assert.equal(resolveScaledLineWidth(4, { scale: 4, min: 1.2, max: 4.8 }), 4.8);

  assert.deepEqual(resolveCanvasLineDash('CENTER', 0.5, 2), [18, 6]);
  assert.deepEqual(resolveCanvasLineDash('HIDDEN', 1, 0.1), [2, 2]);
  assert.deepEqual(resolveCanvasLineDash('BYBLOCK', 1, 4), []);

  const style = resolveCanvasStrokeStyle({
    lineType: 'DASHED',
    lineTypeScale: 1.5,
    lineWeight: 0.6,
  }, 2);
  assert.equal(style.lineWidth, 2.4);
  assert.deepEqual(style.lineDash, [30, 18]);

  const selected = resolveCanvasStrokeStyle({
    lineType: 'CENTER',
    lineTypeScale: 1,
    lineWeight: 0.2,
  }, 3, { selected: true });
  assert.equal(selected.lineWidth, 2.4);
  assert.deepEqual(selected.lineDash, []);

  const byLayerStroke = resolveCanvasStrokeStyle({
    lineType: 'BYLAYER',
    lineWeight: 0,
    lineTypeScale: 1,
  }, 2, {
    layer: {
      lineType: 'CENTER',
      lineWeight: 0.35,
    },
  });
  assert.equal(byLayerStroke.lineWidth, 1.4);
  assert.deepEqual(byLayerStroke.lineDash, [36, 12]);
});

test('selection contract surfaces compact provenance and effective style for single select', () => {
  const contract = buildSelectionContract([{
    id: 7,
    type: 'line',
    layerId: 3,
    color: '#808080',
    colorSource: 'BYLAYER',
    colorAci: 8,
    space: 0,
    layout: 'Layout-A',
    sourceType: 'INSERT',
    editMode: 'fragment',
    lineType: 'HIDDEN2',
    lineWeight: 0.55,
    lineTypeScale: 1.7,
  }], 7, {
    getLayer: (layerId) => (
      layerId === 3
        ? { id: 3, name: 'PLOT', visible: true, locked: false, printable: true, frozen: false, construction: false, color: '#d0d7de' }
        : null
    ),
  });

  assert.equal(contract.mode, 'single');
  assert.equal(contract.entityCount, 1);
  assert.equal(contract.primaryType, 'line');
  assert.equal(contract.summaryText, '1 selected (line)');
  assert.equal(contract.note, '');
  assert.deepEqual(contract.rows, [
    { key: 'origin', label: 'Origin', value: 'INSERT / fragment' },
    { key: 'layer', label: 'Layer', value: '3:PLOT' },
    { key: 'layer-color', label: 'Layer Color', value: '#d0d7de' },
    { key: 'layer-state', label: 'Layer State', value: 'Shown / Open / Live / Print / Normal' },
    { key: 'color', label: 'Color', value: '#d0d7de | BYLAYER | ACI 8' },
    { key: 'space', label: 'Space', value: 'Model / Layout-A' },
    { key: 'style', label: 'Style', value: 'LT HIDDEN2 | LW 0.55 | LTS 1.7' },
  ]);
});

test('selection contract resolves effective BYLAYER style from layer defaults', () => {
  const contract = buildSelectionContract([{
    id: 7,
    type: 'line',
    layerId: 3,
    color: '#808080',
    colorSource: 'BYLAYER',
    lineType: 'BYLAYER',
    lineWeight: 0,
    lineTypeScale: 1,
  }], 7, {
    getLayer: (layerId) => (
      layerId === 3
        ? {
          id: 3,
          name: 'PLOT',
          visible: true,
          locked: false,
          printable: true,
          frozen: false,
          construction: false,
          color: '#ff0000',
          lineType: 'CENTER',
          lineWeight: 0.35,
        }
        : null
    ),
  });

  assert.ok(contract.rows.some((row) => row.key === 'color' && row.value === '#ff0000 | BYLAYER'));
  assert.ok(contract.rows.some((row) => row.key === 'style' && row.value === 'LT CENTER | LW 0.35 | LTS 1'));
});

test('selection contract keeps multi-select summary stable without scraping property rows', () => {
  const contract = buildSelectionContract([
    { id: 1, type: 'line' },
    { id: 2, type: 'circle', editMode: 'proxy' },
  ], 1);

  assert.equal(contract.mode, 'multi');
  assert.equal(contract.entityCount, 2);
  assert.equal(contract.primaryType, 'line');
  assert.equal(contract.summaryText, '2 selected (line, circle)');
  assert.equal(contract.readOnly, 'mixed');
  assert.deepEqual(contract.rows, [
    { key: 'types', label: 'Types', value: 'line | circle' },
    { key: 'access', label: 'Access', value: '1 read-only in selection' },
  ]);
  assert.equal(contract.note, 'Single-select to inspect provenance and effective style.');
});

test('selection contract mirrors imported CADGF provenance and style metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-22T00:00:00Z',
      modified_at: '2026-03-22T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 1, name: 'PLOT', color: 0x808080, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 7,
        type: 2,
        layer_id: 1,
        name: 'selection-summary-line',
        color: 0x808080,
        color_source: 'BYLAYER',
        color_aci: 8,
        line_type: 'HIDDEN2',
        line_weight: 0.55,
        line_type_scale: 1.7,
        source_type: 'INSERT',
        edit_mode: 'fragment',
        space: 1,
        layout: 'Layout-A',
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);
  const contract = buildSelectionContract([doc.getEntity(7)], 7, {
    getLayer: (layerId) => doc.getLayer(layerId),
  });

  assert.equal(contract.mode, 'single');
  assert.equal(contract.summaryText, '1 selected (line)');
  assert.deepEqual(contract.rows, [
    { key: 'origin', label: 'Origin', value: 'INSERT / fragment' },
    { key: 'layer', label: 'Layer', value: '1:PLOT' },
    { key: 'layer-color', label: 'Layer Color', value: '#808080' },
    { key: 'layer-state', label: 'Layer State', value: 'Shown / Open / Live / Print / Normal' },
    { key: 'color', label: 'Color', value: '#808080 | BYLAYER | ACI 8' },
    { key: 'space', label: 'Space', value: 'Paper / Layout-A' },
    { key: 'style', label: 'Style', value: 'LT HIDDEN2 | LW 0.55 | LTS 1.7' },
  ]);
});

test('selection presentation exposes stable badges and detail facts for single select', () => {
  const presentation = buildSelectionPresentation([{
    id: 9,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 0,
    sourceType: 'INSERT',
    proxyKind: 'insert',
    editMode: 'exploded',
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1.25,
  }], 9, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: false,
          frozen: false,
          construction: true,
          color: '#d0d7de',
        }
        : null
    ),
  });

  assert.equal(presentation.mode, 'single');
  assert.equal(presentation.entityCount, 1);
  assert.equal(presentation.summaryText, '1 selected (line)');
  assert.equal(presentation.statusText, 'Selection: line | INSERT / insert / exploded');
  assert.deepEqual(presentation.badges.map((badge) => `${badge.key}:${badge.value}`), [
    'type:line',
    'layer:12:REF',
    'space:Model',
    'color-source:TRUECOLOR',
    'layer-noprint:NoPrint',
    'layer-construction:Construction',
  ]);
  assert.deepEqual(presentation.detailFacts, [
    { key: 'origin', label: 'Origin', value: 'INSERT / insert / exploded' },
    { key: 'layer', label: 'Layer', value: '12:REF' },
    { key: 'layer-color', label: 'Layer Color', value: '#d0d7de', swatch: '#d0d7de' },
    { key: 'layer-state', label: 'Layer State', value: 'Shown / Open / Live / NoPrint / Construction' },
    { key: 'entity-visibility', label: 'Entity Visibility', value: 'Shown' },
    { key: 'effective-color', label: 'Effective Color', value: '#5a6b7c', swatch: '#5a6b7c' },
    { key: 'color-source', label: 'Color Source', value: 'TRUECOLOR' },
    { key: 'space', label: 'Space', value: 'Model' },
    { key: 'line-type', label: 'Line Type', value: 'CENTER' },
    { key: 'line-type-source', label: 'Line Type Source', value: 'EXPLICIT' },
    { key: 'line-weight', label: 'Line Weight', value: '0.35' },
    { key: 'line-weight-source', label: 'Line Weight Source', value: 'EXPLICIT' },
    { key: 'line-type-scale', label: 'Line Type Scale', value: '1.25' },
    { key: 'line-type-scale-source', label: 'Line Type Scale Source', value: 'EXPLICIT' },
  ]);
});

test('property metadata facts reuse shared selection facts and append property-only CAD fields', () => {
  const facts = buildPropertyMetadataFacts({
    id: 9,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    proxyKind: 'dimension',
    editMode: 'proxy',
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1.25,
    textKind: 'mtext',
    hatchId: 42,
    hatchPattern: 'ANSI31',
    dimType: 32,
    dimStyle: 'ARCH',
    sourceTextPos: { x: 10, y: 20 },
    sourceTextRotation: Math.PI / 6,
    dimTextPos: { x: 30, y: 40 },
    dimTextRotation: Math.PI / 4,
  }, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: false,
          frozen: false,
          construction: true,
          color: '#d0d7de',
        }
        : null
    ),
  });

  const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));
  assert.equal(byKey.origin, 'DIMENSION / dimension / proxy');
  assert.equal(byKey.layer, '12:REF');
  assert.equal(byKey['layer-state'], 'Shown / Open / Live / NoPrint / Construction');
  assert.equal(byKey['effective-color'], '#5a6b7c');
  assert.equal(byKey['source-type'], 'DIMENSION');
  assert.equal(byKey['edit-mode'], 'proxy');
  assert.equal(byKey['proxy-kind'], 'dimension');
  assert.equal(byKey['line-type'], 'CENTER');
  assert.equal(byKey['line-weight-source'], 'EXPLICIT');
  assert.equal(byKey['text-kind'], 'mtext');
  assert.equal(byKey['hatch-id'], '42');
  assert.equal(byKey['hatch-pattern'], 'ANSI31');
  assert.equal(byKey['dim-type'], '32');
  assert.equal(byKey['dim-style'], 'ARCH');
  assert.equal(byKey['source-text-pos'], '10, 20');
  assert.equal(byKey['source-text-rotation'], '0.524');
  assert.equal(byKey['dim-text-pos'], '30, 40');
  assert.equal(byKey['dim-text-rotation'], '0.785');
});

test('selection action context exposes source-group guide and selection matches for property actions', () => {
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

  const actionContext = buildSelectionActionContext(entities[1], [22], {
    listEntities: () => entities,
  });

  assert.deepEqual(actionContext.sourceGroup.summary.memberIds, [21, 22]);
  assert.equal(actionContext.sourceGroup.textMemberCount, 1);
  assert.deepEqual(actionContext.sourceGroup.textIds, [22]);
  assert.equal(actionContext.sourceGroup.resettableTextMemberCount, 1);
  assert.deepEqual(actionContext.sourceGroup.resettableTextIds, [22]);
  assert.equal(actionContext.sourceGroup.selectionMatchesGroup, false);
  assert.equal(actionContext.sourceGroup.selectionMatchesText, true);
  assert.equal(actionContext.sourceGroup.sourceTextGuide.sourceType, 'DIMENSION');
  assert.equal(actionContext.insertGroup, null);
  assert.equal(actionContext.releasedInsert, null);
});

test('selection action context exposes insert peer scope and released insert peer context', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 900,
    blockName: 'DoorTag',
    start: { x: -5, y: 0 },
    end: { x: 5, y: 0 },
    space: 0,
    layout: 'Model',
  }, {
    id: 32,
    type: 'text',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attrib',
    attributeConstant: false,
    groupId: 900,
    blockName: 'DoorTag',
    position: { x: 2, y: 3 },
    space: 0,
    layout: 'Model',
  }, {
    id: 33,
    type: 'line',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 900,
    blockName: 'DoorTag',
    start: { x: -5, y: 10 },
    end: { x: 5, y: 10 },
    space: 1,
    layout: 'Layout-A',
  }, {
    id: 34,
    type: 'text',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attrib',
    attributeConstant: false,
    groupId: 900,
    blockName: 'DoorTag',
    position: { x: 2, y: 13 },
    space: 1,
    layout: 'Layout-A',
  }, {
    id: 35,
    type: 'text',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'plain',
    value: 'Released',
    position: { x: 12, y: 3 },
    releasedInsertArchive: {
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 900,
      blockName: 'DoorTag',
    },
    space: 0,
    layout: 'Model',
  }];

  const insertContext = buildSelectionActionContext(entities[1], [32], {
    listEntities: () => entities,
  });
  assert.deepEqual(insertContext.insertGroup.summary.memberIds, [31, 32]);
  assert.equal(insertContext.insertGroup.textMemberCount, 1);
  assert.deepEqual(insertContext.insertGroup.textIds, [32]);
  assert.deepEqual(insertContext.insertGroup.editableTextIds, [32]);
  assert.equal(insertContext.insertGroup.peerScope, 'single');
  assert.equal(insertContext.insertGroup.peerNavigableSelection, true);
  assert.equal(insertContext.insertGroup.selectionMatchesText, true);
  assert.equal(insertContext.insertGroup.selectionMatchesEditableText, true);
  assert.equal(insertContext.insertGroup.peerSummary.peerCount, 2);
  assert.deepEqual(insertContext.insertGroup.peerTargets.map((entry) => entry.target), [
    '1: Model / Model',
    '2: Paper / Layout-A',
  ]);
  assert.deepEqual(insertContext.insertGroup.peerTargets.map((entry) => entry.isCurrent), [true, false]);
  assert.equal(insertContext.releasedInsert, null);

  const releasedContext = buildSelectionActionContext(entities[4], [35], {
    listEntities: () => entities,
  });
  assert.equal(releasedContext.releasedInsert.archive.groupId, 900);
  assert.deepEqual(releasedContext.releasedInsert.groupSummary.memberIds, [31, 32]);
  assert.equal(releasedContext.releasedInsert.peerSummary.peerCount, 2);
  assert.deepEqual(releasedContext.releasedInsert.peerTargets.map((entry) => entry.target), [
    '1: Model / Model',
    '2: Paper / Layout-A',
  ]);
  assert.deepEqual(releasedContext.releasedInsert.peerTargets.map((entry) => entry.isCurrent), [true, false]);
  assert.equal(releasedContext.releasedInsert.selectionMatchesGroup, false);
});

test('property panel read-only note preserves INSERT ATTDEF text proxy messaging', () => {
  const entity = {
    id: 41,
    type: 'text',
    layerId: 0,
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    textKind: 'attdef',
    attributeConstant: false,
    attributeInvisible: true,
    attributeLockPosition: false,
    position: { x: 1, y: 2 },
  };

  const note = buildPropertyPanelReadOnlyNote([entity], entity, buildSelectionActionContext(entity, [41], {
    listEntities: () => [entity],
  }));

  assert.equal(
    note,
    'Selected entity is a read-only INSERT ATTDEF text proxy (INSERT text proxy); default text stays editable while prompt remains read-only, text position stays editable while instance geometry remains proxy-only, and invisible attributes stay hidden until focused through insert text selection.',
  );
});

test('property panel read-only note preserves full source-group messaging', () => {
  const entities = [{
    id: 51,
    type: 'line',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    start: { x: -10, y: 0 },
    end: { x: 10, y: 0 },
    space: 1,
    layout: 'Layout-A',
  }, {
    id: 52,
    type: 'text',
    layerId: 0,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    position: { x: 0, y: 12 },
    sourceTextPos: { x: 0, y: 12 },
    sourceTextRotation: 0,
    space: 1,
    layout: 'Layout-A',
  }];

  const note = buildPropertyPanelReadOnlyNote(entities, entities[0], buildSelectionActionContext(entities[0], [51, 52], {
    listEntities: () => entities,
  }));

  assert.equal(
    note,
    'Selected entities are a read-only source group; full-group move/rotate/scale/copy/delete stay bundle-level until release while source-text edit stays available when the bundle has text.',
  );
});

test('property panel released archive note preserves ATTDEF provenance wording', () => {
  const note = buildPropertyPanelReleasedArchiveNote({
    sourceType: 'INSERT',
    proxyKind: 'text',
    editMode: 'proxy',
    textKind: 'attdef',
  });

  assert.equal(
    note,
    'Selected entity was released from imported INSERT / text / proxy; archived ATTDEF provenance remains visible as read-only context while the detached text now edits like plain text.',
  );
});

test('property panel locked-layer note preserves single-entity wording', () => {
  const entity = {
    id: 61,
    type: 'line',
    layerId: 2,
  };

  const note = buildPropertyPanelLockedLayerNote([entity], entity, (layerId) => (
    layerId === 2
      ? {
        id: 2,
        name: 'REDLINE',
        locked: true,
      }
      : null
  ));

  assert.equal(
    note,
    'Selected entity is on locked layer 2:REDLINE; editing disabled until the layer is unlocked.',
  );
});

test('selection presentation exposes insert group facts for imported INSERT fragments', () => {
  const entities = [{
    id: 17,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    start: { x: -18, y: 0 },
    end: { x: 18, y: 0 },
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1.25,
  }, {
    id: 18,
    type: 'circle',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    center: { x: 0, y: 10 },
    radius: 4,
  }, {
    id: 19,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    position: { x: 12, y: 11 },
  }, {
    id: 20,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-B',
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    start: { x: -16, y: -12 },
    end: { x: 16, y: -12 },
  }, {
    id: 21,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-C',
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    start: { x: -14, y: 20 },
    end: { x: 14, y: 20 },
  }, {
    id: 22,
    type: 'circle',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-C',
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 500,
    blockName: 'DoorTag',
    center: { x: 0, y: 28 },
    radius: 3,
  }, {
    id: 23,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-C',
    sourceType: 'INSERT',
    editMode: 'proxy',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    position: { x: 10, y: 29 },
  }];
  const presentation = buildSelectionPresentation([entities[0]], 17, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: false,
          frozen: false,
          construction: true,
          color: '#d0d7de',
        }
        : null
    ),
    listEntities: () => entities,
  });

  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-id' && fact.value === '500'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'block-name' && fact.value === 'DoorTag'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'insert-group-members' && fact.value === '3'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'editable-members' && fact.value === '2'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'read-only-members' && fact.value === '1'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-center' && fact.value === '0, 7'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-size' && fact.value === '36 x 14'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-bounds' && fact.value === '-18, 0 -> 18, 14'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'peer-instance' && fact.value === '1 / 3'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'peer-instances' && fact.value === '3'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'peer-layouts' && fact.value === 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'peer-targets' && fact.value === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C'));
});

test('selection presentation exposes archived insert provenance for released insert attribute text', () => {
  const presentation = buildSelectionPresentation([{
    id: 29,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    position: { x: 8, y: 3 },
    value: 'DETACHED_TAG',
    height: 3.5,
    rotation: 0,
    space: 1,
    layout: 'Layout-A',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      groupId: 500,
      blockName: 'DoorTag',
      textKind: 'attdef',
      attributeTag: 'CONST_TAG',
      attributeDefault: 'CONST_TAG',
      attributePrompt: 'CONST_TAG_PROMPT',
      attributeFlags: 18,
      attributeConstant: true,
      attributeLockPosition: true,
    },
  }], 29, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: true,
          frozen: false,
          construction: false,
          color: '#d0d7de',
        }
        : null
    ),
  });

  assert.equal(presentation.statusText, 'Selection: text');
  assert.ok(!presentation.detailFacts.some((fact) => fact.key === 'attribute-tag'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-from' && fact.value === 'INSERT / text / proxy'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-group-id' && fact.value === '500'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-block-name' && fact.value === 'DoorTag'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-text-kind' && fact.value === 'attdef'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-attribute-tag' && fact.value === 'CONST_TAG'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-attribute-prompt' && fact.value === 'CONST_TAG_PROMPT'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-attribute-modes' && fact.value === 'Constant / Lock Position'));
});

test('selection presentation exposes common archived insert context for released multi-text selection', () => {
  const entities = [{
    id: 21,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    position: { x: 44, y: 3 },
    value: 'MAIN-A',
    height: 2.5,
    rotation: 0,
    space: 1,
    layout: 'Layout-A',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      name: 'tag-main',
      groupId: 700,
      blockName: 'DoorNotes',
    },
  }, {
    id: 22,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    position: { x: 58, y: 3 },
    value: 'SUB-A',
    height: 2.5,
    rotation: 0,
    space: 1,
    layout: 'Layout-A',
    releasedInsertArchive: {
      sourceType: 'INSERT',
      editMode: 'proxy',
      proxyKind: 'text',
      name: 'tag-sub',
      groupId: 700,
      blockName: 'DoorNotes',
    },
  }, {
    id: 20,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    start: { x: 40, y: 0 },
    end: { x: 64, y: 0 },
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 700,
    blockName: 'DoorNotes',
    space: 1,
    layout: 'Layout-A',
  }, {
    id: 23,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    start: { x: 42, y: -18 },
    end: { x: 66, y: -18 },
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 700,
    blockName: 'DoorNotes',
    space: 1,
    layout: 'Layout-B',
  }, {
    id: 26,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    start: { x: 44, y: 22 },
    end: { x: 68, y: 22 },
    sourceType: 'INSERT',
    editMode: 'fragment',
    groupId: 700,
    blockName: 'DoorNotes',
    space: 1,
    layout: 'Layout-C',
  }];
  const presentation = buildSelectionPresentation([entities[0], entities[1]], 22, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: true,
          frozen: false,
          construction: false,
          color: '#d0d7de',
        }
        : null
    ),
    listEntities: () => entities,
  });

  assert.equal(presentation.mode, 'multiple');
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-from' && fact.value === 'INSERT / text / proxy'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-group-id' && fact.value === '700'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-block-name' && fact.value === 'DoorNotes'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-selection-members' && fact.value === '2'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-peer-instance' && fact.value === '1 / 3'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'released-peer-targets' && fact.value === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C'));
});

test('selection presentation exposes generic source-group facts for grouped derived proxies', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
  }, {
    id: 32,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: -20, y: 12 },
  }, {
    id: 33,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: 20, y: 0 },
    end: { x: 20, y: 12 },
  }, {
    id: 34,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 0, y: 14 },
  }, {
    id: 35,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-B',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -10, y: -4 },
    end: { x: 10, y: -4 },
  }];
  const presentation = buildSelectionPresentation([entities[3]], 34, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: false,
          frozen: false,
          construction: true,
          color: '#d0d7de',
        }
        : null
    ),
    listEntities: () => entities,
  });

  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-id' && fact.value === '700'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-source' && fact.value === 'DIMENSION / dimension'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-group-members' && fact.value === '4'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'editable-members' && fact.value === '0'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'read-only-members' && fact.value === '4'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-center' && fact.value === '0, 7'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-size' && fact.value === '40 x 14'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-bounds' && fact.value === '-20, 0 -> 20, 14'));
  assert.ok(!presentation.detailFacts.some((fact) => fact.key === 'insert-group-members'));
  assert.ok(!presentation.detailFacts.some((fact) => fact.key === 'peer-targets'));
});

test('selection presentation uses sourceBundleId for split imported DIMENSION bundle facts', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
  }, {
    id: 32,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    position: { x: 0, y: 14 },
  }, {
    id: 33,
    type: 'polyline',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    sourceBundleId: 700,
    blockName: '*D1',
    points: [{ x: -20.5, y: 0 }, { x: -20, y: 0.4 }, { x: -20, y: -0.4 }],
  }, {
    id: 34,
    type: 'polyline',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 702,
    sourceBundleId: 700,
    blockName: '*D1',
    points: [{ x: 20.5, y: 0 }, { x: 20, y: 0.4 }, { x: 20, y: -0.4 }],
  }];
  const presentation = buildSelectionPresentation([entities[2]], 33, {
    getLayer: (layerId) => (
      layerId === 12
        ? {
          id: 12,
          name: 'REF',
          visible: true,
          locked: false,
          printable: false,
          frozen: false,
          construction: true,
          color: '#d0d7de',
        }
        : null
    ),
    listEntities: () => entities,
  });

  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'group-id' && fact.value === '701'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-bundle-id' && fact.value === '700'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-group-members' && fact.value === '4'));
});

test('resolveSourceTextGuide resolves DIMENSION anchor from longest non-text member', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
  }, {
    id: 32,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: -20, y: 12 },
  }, {
    id: 34,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 4, y: 18 },
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    rotation: 0.5,
  }];
  const guide = resolveSourceTextGuide(entities, entities[2]);
  assert.deepEqual(guide?.anchor, { x: 0, y: 0 });
  assert.equal(guide?.anchorDriverId, 31);
  assert.equal(guide?.anchorDriverLabel, 'line midpoint');
  assert.deepEqual(guide?.sourceOffset, { x: 0, y: 14 });
  assert.deepEqual(guide?.currentOffset, { x: 4, y: 18 });
});

test('resolveSourceTextGuide prefers explicit imported DIMENSION guide metadata and matches anchor driver', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    start: { x: 26.25, y: 0 },
    end: { x: 103.75, y: 0 },
  }, {
    id: 32,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    start: { x: 26, y: 136 },
    end: { x: 26, y: 0 },
  }, {
    id: 34,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    position: { x: 69, y: 170 },
    sourceTextPos: { x: 65, y: 152 },
    sourceTextRotation: 0,
    dimTextPos: { x: 65, y: 152 },
    dimTextRotation: 0,
    rotation: 0.5,
    sourceAnchor: { x: 65, y: 0 },
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'midpoint',
  }];
  const guide = resolveSourceTextGuide(entities, entities[2]);
  assert.deepEqual(guide?.anchor, { x: 65, y: 0 });
  assert.equal(guide?.anchorDriverId, 31);
  assert.equal(guide?.anchorDriverLabel, 'line midpoint');
  assert.deepEqual(guide?.sourceOffset, { x: 0, y: 152 });
  assert.deepEqual(guide?.currentOffset, { x: 4, y: 170 });
});

test('resolveSourceTextGuide resolves DIMENSION anchor from split bundle arrowhead selection when sourceBundleId is present', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
  }, {
    id: 32,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    sourceBundleId: 700,
    blockName: '*D1',
    position: { x: 0, y: 14 },
    sourceTextPos: { x: 0, y: 14 },
  }, {
    id: 33,
    type: 'polyline',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 701,
    sourceBundleId: 700,
    blockName: '*D1',
    points: [{ x: -20.5, y: 0 }, { x: -20, y: 0.4 }, { x: -20, y: -0.4 }],
  }];
  const guide = resolveSourceTextGuide(entities, entities[2]);
  assert.ok(guide);
  assert.equal(guide?.textId, 32);
  assert.deepEqual(guide?.anchor, { x: 0, y: 0 });
  assert.equal(guide?.anchorDriverId, 31);
  assert.equal(guide?.anchorDriverLabel, 'line midpoint');
});

test('resolveSourceTextGuide resolves LEADER anchor from nearest endpoint', () => {
  const entities = [{
    id: 41,
    type: 'line',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    start: { x: 50, y: 0 },
    end: { x: 56, y: 6 },
  }, {
    id: 42,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    position: { x: 63, y: 9 },
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    rotation: 0.3926990817,
  }];
  const guide = resolveSourceTextGuide(entities, entities[1]);
  assert.deepEqual(guide?.anchor, { x: 56, y: 6 });
  assert.deepEqual(guide?.landingPoint, { x: 56, y: 6 });
  assert.deepEqual(guide?.elbowPoint, { x: 50, y: 0 });
  approxEqual(guide?.landingLength, Math.sqrt(72));
  assert.equal(guide?.anchorDriverId, 41);
  assert.equal(guide?.anchorDriverLabel, 'line endpoint');
  assert.deepEqual(guide?.sourceOffset, { x: 2, y: 1 });
  assert.deepEqual(guide?.currentOffset, { x: 7, y: 3 });
});

test('resolveSourceTextGuide prefers explicit LEADER guide metadata and matches driver by anchor', () => {
  const entities = [{
    id: 51,
    type: 'polyline',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 704,
    points: [
      { x: 188, y: 150 },
      { x: 204, y: 162 },
      { x: 220, y: 182 },
    ],
  }, {
    id: 52,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 704,
    position: { x: 214, y: 158 },
    sourceTextPos: { x: 210, y: 154 },
    sourceTextRotation: 0,
    rotation: 0,
    sourceAnchor: { x: 188, y: 150 },
    leaderLanding: { x: 188, y: 150 },
    leaderElbow: { x: 204, y: 162 },
    sourceAnchorDriverType: 'polyline',
    sourceAnchorDriverKind: 'endpoint',
  }];

  const guide = resolveSourceTextGuide(entities, entities[1]);
  assert.deepEqual(guide?.anchor, { x: 188, y: 150 });
  assert.deepEqual(guide?.landingPoint, { x: 188, y: 150 });
  assert.deepEqual(guide?.elbowPoint, { x: 204, y: 162 });
  approxEqual(guide?.landingLength, 20);
  assert.equal(guide?.anchorDriverId, 51);
  assert.equal(guide?.anchorDriverLabel, 'polyline endpoint');
  assert.deepEqual(guide?.sourceOffset, { x: 22, y: 4 });
  assert.deepEqual(guide?.currentOffset, { x: 26, y: 8 });
});

test('resolveSourceTextGuide prefers explicit imported LEADER guide metadata and matches anchor driver', () => {
  const entities = [{
    id: 41,
    type: 'polyline',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 703,
    points: [{ x: 50, y: 0 }, { x: 56, y: 6 }, { x: 64, y: 10 }],
  }, {
    id: 42,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 703,
    position: { x: 63, y: 9 },
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    rotation: 0.3926990817,
    sourceAnchor: { x: 50, y: 0 },
    leaderLanding: { x: 50, y: 0 },
    leaderElbow: { x: 56, y: 6 },
    sourceAnchorDriverType: 'polyline',
    sourceAnchorDriverKind: 'endpoint',
  }];
  const guide = resolveSourceTextGuide(entities, entities[1]);
  assert.deepEqual(guide?.anchor, { x: 50, y: 0 });
  assert.deepEqual(guide?.landingPoint, { x: 50, y: 0 });
  assert.deepEqual(guide?.elbowPoint, { x: 56, y: 6 });
  approxEqual(guide?.landingLength, Math.sqrt(72));
  assert.equal(guide?.anchorDriverId, 41);
  assert.equal(guide?.anchorDriverLabel, 'polyline endpoint');
  assert.deepEqual(guide?.sourceOffset, { x: 8, y: 7 });
  assert.deepEqual(guide?.currentOffset, { x: 13, y: 9 });
});

test('resolveSourceTextGuide prefers explicit sourceAnchorDriverId over ambiguous anchor matches', () => {
  const entities = [{
    id: 51,
    type: 'polyline',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 703,
    points: [{ x: 50, y: 0 }, { x: 56, y: 6 }, { x: 64, y: 10 }],
  }, {
    id: 52,
    type: 'polyline',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 703,
    points: [{ x: 50, y: 0 }, { x: 48, y: 4 }, { x: 46, y: 8 }],
  }, {
    id: 53,
    type: 'text',
    layerId: 12,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 703,
    position: { x: 58, y: 7 },
    sourceTextPos: { x: 56, y: 5 },
    sourceTextRotation: 0,
    rotation: 0,
    sourceAnchor: { x: 50, y: 0 },
    leaderLanding: { x: 50, y: 0 },
    sourceAnchorDriverId: 52,
    sourceAnchorDriverType: 'polyline',
    sourceAnchorDriverKind: 'endpoint',
  }];

  const guide = resolveSourceTextGuide(entities, entities[2]);
  assert.deepEqual(guide?.anchor, { x: 50, y: 0 });
  assert.deepEqual(guide?.landingPoint, { x: 50, y: 0 });
  assert.deepEqual(guide?.elbowPoint, { x: 48, y: 4 });
  assert.equal(guide?.anchorDriverId, 52);
  assert.equal(guide?.anchorDriverLabel, 'polyline endpoint');
});

test('selection.sourceSelectAnchorDriver narrows imported source text to its driving geometry', () => {
  const { document, selection, bus } = setup();
  document.addEntities([{
    id: 41,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    visible: true,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    start: { x: 50, y: 0 },
    end: { x: 56, y: 6 },
  }, {
    id: 42,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    visible: true,
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    position: { x: 63, y: 9 },
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    rotation: 0.3926990817,
  }]);
  selection.setSelection([42], 42);

  const result = bus.execute('selection.sourceSelectAnchorDriver');

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.match(String(result.message || ''), /Selected source anchor driver/);
  assert.deepEqual(selection.entityIds, [41]);
  assert.equal(selection.primaryId, 41);
});

test('selection presentation exposes source anchor and offsets for imported source text proxies', () => {
  const entities = [{
    id: 31,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    start: { x: -20, y: 0 },
    end: { x: 20, y: 0 },
  }, {
    id: 34,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    groupId: 700,
    position: { x: 4, y: 18 },
    sourceTextPos: { x: 0, y: 14 },
    sourceTextRotation: 0,
    rotation: 0.5,
  }];
  const presentation = buildSelectionPresentation([entities[1]], 34, {
    getLayer: () => ({
      id: 12,
      name: 'REF',
      visible: true,
      locked: false,
      printable: true,
      frozen: false,
      construction: false,
      color: '#d0d7de',
    }),
    listEntities: () => entities,
  });

  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-anchor' && fact.value === '0, 0'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-anchor-driver' && fact.value === '31:line midpoint'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'source-offset' && fact.value === '0, 14'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'current-offset' && fact.value === '4, 18'));
});

test('selection presentation exposes LEADER landing facts for imported source text proxies', () => {
  const entities = [{
    id: 41,
    type: 'line',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    start: { x: 50, y: 0 },
    end: { x: 56, y: 6 },
  }, {
    id: 42,
    type: 'text',
    layerId: 12,
    color: '#5a6b7c',
    colorSource: 'TRUECOLOR',
    space: 1,
    layout: 'Layout-A',
    sourceType: 'LEADER',
    editMode: 'proxy',
    proxyKind: 'leader',
    groupId: 702,
    position: { x: 63, y: 9 },
    sourceTextPos: { x: 58, y: 7 },
    sourceTextRotation: 0,
    rotation: 0.3926990817,
  }];
  const presentation = buildSelectionPresentation([entities[1]], 42, {
    getLayer: () => ({
      id: 12,
      name: 'REF',
      visible: true,
      locked: false,
      printable: true,
      frozen: false,
      construction: false,
      color: '#d0d7de',
    }),
    listEntities: () => entities,
  });

  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'leader-landing' && fact.value === '56, 6'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'leader-elbow' && fact.value === '50, 0'));
  assert.ok(presentation.detailFacts.some((fact) => fact.key === 'leader-landing-length' && fact.value === '8.485'));
});

test('selection presentation resolves effective BYLAYER detail facts from layer defaults', () => {
  const presentation = buildSelectionPresentation([{
    id: 7,
    type: 'line',
    layerId: 3,
    color: '#808080',
    colorSource: 'BYLAYER',
    lineType: 'BYLAYER',
    lineWeight: 0,
    lineTypeScale: 1,
  }], 7, {
    getLayer: (layerId) => (
      layerId === 3
        ? {
          id: 3,
          name: 'PLOT',
          visible: true,
          locked: false,
          printable: true,
          frozen: false,
          construction: false,
          color: '#00aaff',
          lineType: 'CENTER',
          lineWeight: 0.35,
        }
        : null
    ),
  });

  assert.equal(presentation.mode, 'single');
  assert.deepEqual(presentation.detailFacts, [
    { key: 'layer', label: 'Layer', value: '3:PLOT' },
    { key: 'layer-color', label: 'Layer Color', value: '#00aaff', swatch: '#00aaff' },
    { key: 'layer-state', label: 'Layer State', value: 'Shown / Open / Live / Print / Normal' },
    { key: 'entity-visibility', label: 'Entity Visibility', value: 'Shown' },
    { key: 'effective-color', label: 'Effective Color', value: '#00aaff', swatch: '#00aaff' },
    { key: 'color-source', label: 'Color Source', value: 'BYLAYER' },
    { key: 'line-type', label: 'Line Type', value: 'CENTER' },
    { key: 'line-type-source', label: 'Line Type Source', value: 'BYLAYER' },
    { key: 'line-weight', label: 'Line Weight', value: '0.35' },
    { key: 'line-weight-source', label: 'Line Weight Source', value: 'BYLAYER' },
    { key: 'line-type-scale', label: 'Line Type Scale', value: '1' },
    { key: 'line-type-scale-source', label: 'Line Type Scale Source', value: 'DEFAULT' },
  ]);
});

test('selection presentation exposes locked layer state for single select', () => {
  const presentation = buildSelectionPresentation([{
    id: 4,
    type: 'arc',
    layerId: 6,
    color: '#f97316',
    colorSource: 'TRUECOLOR',
  }], 4, {
    getLayer: (layerId) => (
      layerId === 6
        ? {
          id: 6,
          name: 'LOCKED',
          visible: true,
          locked: true,
          printable: true,
          frozen: false,
          construction: false,
          color: '#d0d7de',
        }
        : null
    ),
  });

  assert.deepEqual(presentation.badges.map((badge) => `${badge.key}:${badge.value}`), [
    'type:arc',
    'layer:6:LOCKED',
    'color-source:TRUECOLOR',
    'layer-locked:Locked',
  ]);
  assert.deepEqual(presentation.detailFacts.slice(0, 5), [
    { key: 'layer', label: 'Layer', value: '6:LOCKED' },
    { key: 'layer-color', label: 'Layer Color', value: '#d0d7de', swatch: '#d0d7de' },
    { key: 'layer-state', label: 'Layer State', value: 'Shown / Locked / Live / Print / Normal' },
    { key: 'entity-visibility', label: 'Entity Visibility', value: 'Shown' },
    { key: 'effective-color', label: 'Effective Color', value: '#f97316', swatch: '#f97316' },
  ]);
});

test('selection status stays compact for multi-select with read-only entities', () => {
  const text = formatSelectionStatus([
    { id: 1, type: 'line' },
    { id: 2, type: 'circle', editMode: 'proxy' },
    { id: 3, type: 'arc' },
  ], 1);

  assert.equal(text, 'Selection: 3 entities | line,circle,arc | 1 read-only');
});

test('selection.copy skips read-only unsupported proxy in mixed selection', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 1, y: 2 }, end: { x: 5, y: 2 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      display_proxy: { kind: 'point', point: { x: 8, y: 8 } },
      cadgf: { id: 9002, type: 1, point: [8, 8] },
    },
  });

  selection.setSelection([1, 2], 1);
  const copy = bus.execute('selection.copy', { delta: { x: 10, y: 0 } });
  assert.equal(copy.ok, true);
  assert.equal(copy.changed, true);
  assert.match(copy.message || '', /skipped 1 read-only/);
  assert.equal(document.listEntities().length, 3);
  assert.equal(document.getEntity(3).type, 'line');
  assert.equal(selection.primaryId, 3);
});

test('selection.copy clears imported assembly provenance on created entity', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 1, y: 2 },
      end: { x: 5, y: 2 },
      layerId: 0,
      groupId: 7,
      sourceType: 'INSERT',
      editMode: 'exploded',
      proxyKind: 'insert',
      blockName: 'BlockF',
      colorSource: 'BYLAYER',
      colorAci: 5,
      space: 1,
      layout: 'LayoutStyle',
    },
  });

  selection.setSelection([1], 1);
  const copy = bus.execute('selection.copy', { delta: { x: 10, y: 0 } });
  assert.equal(copy.ok, true);
  assert.equal(copy.changed, true);
  const created = document.getEntity(2);
  assert.equal(created.type, 'line');
  assert.equal(created.groupId, undefined);
  assert.equal(created.sourceType, undefined);
  assert.equal(created.editMode, undefined);
  assert.equal(created.proxyKind, undefined);
  assert.equal(created.blockName, undefined);
  assert.equal(created.colorSource, undefined);
  assert.equal(created.colorAci, undefined);
  assert.equal(created.space, 1);
  assert.equal(created.layout, 'LayoutStyle');
});

test('extractSolverActionPanels normalizes and sorts analysis action panels for UI', () => {
  const normalized = extractSolverActionPanels({
    analysis: {
      action_panel_count: 4,
      action_panels: [
        {
          id: 'smallest_redundancy',
          category: 'redundancy',
          scope: 'smallest',
          enabled: true,
          label: 'Trim smallest redundancy witness',
          hint: 'Trim the smallest redundancy witness first.',
          tag: 'redundancy-smallest-witness',
          summary: 'smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)',
          selection_explanation: 'smallest_redundancy_witness',
          anchor_constraint_index: 0,
          priority_score: 980,
          constraint_indices: [0, 1],
          basis_constraint_indices: [0],
          redundant_constraint_indices: [1],
          variable_keys: ['p0.x', 'p1.x'],
          free_variable_keys: [],
          selection_policy: ['witness_constraint_count_asc'],
          ui: {
            title: 'Trim smallest redundancy witness',
            subtitle: 'smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)',
            description: 'Trim the smallest redundancy witness first.',
            badge_label: 'Redundancy',
            severity: 'notice',
            cta_label: 'Trim smallest redundancy witness',
            recommended: false,
            display_order: 3,
          },
        },
        {
          id: 'primary_conflict',
          category: 'conflict',
          scope: 'primary',
          enabled: true,
          label: 'Relax primary conflict',
          hint: 'Inspect the primary conflict group first.',
          tag: 'conflict-primary-priority',
          summary: 'highest_priority_conflict_group(state=mixed,constraints=3,score=16322,anchor=2)',
          selection_explanation: 'highest_priority_conflict_group',
          anchor_constraint_index: 2,
          priority_score: 16322,
          constraint_indices: [2, 3, 4],
          basis_constraint_indices: [],
          redundant_constraint_indices: [],
          variable_keys: ['p4.x', 'p5.x'],
          free_variable_keys: ['p5.x'],
          selection_policy: ['priority_score_desc'],
          ui: {
            title: 'Relax primary conflict',
            subtitle: 'highest_priority_conflict_group(state=mixed,constraints=3,score=16322,anchor=2)',
            description: 'Inspect the primary conflict group first.',
            badge_label: 'Conflict',
            severity: 'warning',
            cta_label: 'Relax primary conflict',
            recommended: true,
            display_order: 0,
          },
        },
      ],
    },
  });

  assert.equal(normalized.source, 'analysis');
  assert.equal(normalized.actionPanelCount, 4);
  assert.equal(normalized.panels.length, 2);
  assert.equal(normalized.panels[0].id, 'primary_conflict');
  assert.equal(normalized.panels[0].ui.title, 'Relax primary conflict');
  assert.equal(normalized.panels[0].ui.severity, 'warning');
  assert.equal(normalized.panels[1].id, 'smallest_redundancy');
  assert.equal(normalized.panels[1].ui.badgeLabel, 'Redundancy');
  assert.deepEqual(normalized.panels[1].constraintIndices, [0, 1]);
});

test('extractSolverActionPanels falls back to structural_summary and preserves disabled slots', () => {
  const normalized = extractSolverActionPanels({
    structural_summary: {
      action_panel_count: 4,
      action_panels: [
        {
          id: 'primary_conflict',
          category: 'conflict',
          scope: 'primary',
          enabled: false,
          anchor_constraint_index: -1,
          ui: {
            badge_label: 'Conflict',
            severity: 'warning',
            display_order: 0,
            recommended: true,
          },
        },
      ],
    },
  });

  assert.equal(normalized.source, 'structural_summary');
  assert.equal(normalized.actionPanelCount, 4);
  assert.equal(normalized.panels.length, 1);
  assert.equal(normalized.panels[0].enabled, false);
  assert.equal(normalized.panels[0].ui.badgeLabel, 'Conflict');
  assert.equal(normalized.panels[0].ui.severity, 'warning');
  assert.equal(normalized.panels[0].ui.title, 'primary_conflict');
});

test('buildActionFlowSteps starts from anchor then variables for conflict panels', () => {
  const normalized = extractSolverActionPanels({
    analysis: {
      action_panels: [
        {
          id: 'primary_conflict',
          enabled: true,
          anchor_constraint_index: 2,
          constraint_indices: [2, 3, 4],
          variable_keys: ['p4.x', 'p5.x'],
          free_variable_keys: ['p5.x'],
          ui: { display_order: 0 },
        },
      ],
    },
  });
  const steps = buildActionFlowSteps(normalized.panels[0]);
  assert.deepEqual(steps.slice(0, 4), [
    { kind: 'constraint', value: 2, label: 'Anchor constraint 2' },
    { kind: 'variable', value: 'p4.x', label: 'Variable p4.x' },
    { kind: 'variable', value: 'p5.x', label: 'Variable p5.x' },
    { kind: 'free-variable', value: 'p5.x', label: 'Free variable p5.x' },
  ]);
});

test('buildActionFlowSteps suppresses generic constraint duplicates when basis/redundant steps exist', () => {
  const normalized = extractSolverActionPanels({
    analysis: {
      action_panels: [
        {
          id: 'primary_redundancy',
          enabled: true,
          anchor_constraint_index: 0,
          constraint_indices: [0, 1],
          basis_constraint_indices: [0],
          redundant_constraint_indices: [1],
          variable_keys: ['p0.x', 'p1.x'],
          ui: { display_order: 0 },
        },
      ],
    },
  });
  const steps = buildActionFlowSteps(normalized.panels[0]);
  assert.deepEqual(steps, [
    { kind: 'constraint', value: 0, label: 'Anchor constraint 0' },
    { kind: 'variable', value: 'p0.x', label: 'Variable p0.x' },
    { kind: 'variable', value: 'p1.x', label: 'Variable p1.x' },
    { kind: 'basis-constraint', value: 0, label: 'Basis constraint 0' },
    { kind: 'redundant-constraint', value: 1, label: 'Redundant constraint 1' },
  ]);
});

test('buildSolverActionRequest classifies flow and focus requests with typed targets', () => {
  const normalized = extractSolverActionPanels({
    analysis: {
      action_panels: [
        {
          id: 'primary_conflict',
          category: 'conflict',
          scope: 'primary',
          enabled: true,
          label: 'Relax primary conflict',
          hint: 'Inspect the primary conflict group first.',
          tag: 'conflict-primary-priority',
          summary: 'highest_priority_conflict_group(...)',
          selection_explanation: 'highest_priority_conflict_group',
          anchor_constraint_index: 2,
          priority_score: 16322,
          constraint_indices: [2, 3, 4],
          variable_keys: ['p4.x', 'p5.x'],
          free_variable_keys: ['p5.x'],
          ui: {
            title: 'Relax primary conflict',
            cta_label: 'Relax primary conflict',
            severity: 'warning',
          },
        },
      ],
    },
  });
  const panel = normalized.panels[0];

  const startRequest = buildSolverActionRequest(panel, {
    flowAction: 'start',
    focusKind: 'constraint',
    focusValue: '2',
    flowStepIndex: 0,
    flowStepCount: 5,
  }, 1);
  assert.equal(startRequest.requestKind, 'invoke');
  assert.equal(startRequest.target.kind, 'constraint');
  assert.equal(startRequest.target.constraintIndex, 2);

  const focusRequest = buildSolverActionRequest(panel, {
    flowAction: 'focus',
    focusKind: 'variable',
    focusValue: 'p5.x',
    flowStepIndex: 2,
    flowStepCount: 5,
  }, 1);
  assert.equal(focusRequest.requestKind, 'focus');
  assert.equal(focusRequest.target.kind, 'variable');
  assert.equal(focusRequest.target.variableKey, 'p5.x');
  assert.equal(focusRequest.ui.ctaLabel, 'Relax primary conflict');

  const nextRequest = buildSolverActionRequest(panel, {
    flowAction: 'next',
    focusKind: 'variable',
    focusValue: 'p4.x',
    flowStepIndex: 1,
    flowStepCount: 5,
  }, 1);
  assert.equal(nextRequest.requestKind, 'flow');
  assert.equal(nextRequest.flowAction, 'next');
  assert.equal(nextRequest.flowStepIndex, 1);
  assert.equal(nextRequest.flowStepCount, 5);
  assert.equal(nextRequest.target.variableKey, 'p4.x');
});

test('selection.propertyPatch skips read-only unsupported proxy in mixed selection', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, layerId: 0, color: '#123456' },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      color: '#123456',
      display_proxy: { kind: 'polyline', points: [{ x: 0, y: 2 }, { x: 5, y: 2 }] },
      cadgf: { id: 9003, type: 5, ellipse: { c: [2.5, 2], rx: 2, ry: 1, rot: 0 } },
    },
  });

  selection.setSelection([1, 2], 1);
  const patch = bus.execute('selection.propertyPatch', { patch: { color: '#abcdef' } });
  assert.equal(patch.ok, true);
  assert.equal(patch.changed, true);
  assert.match(patch.message || '', /read-only/);
  assert.equal(document.getEntity(1).color, '#abcdef');
  assert.equal(document.getEntity(2).color, '#123456');
});

test('selection.delete keeps read-only unsupported proxies and removes editable entities', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      display_proxy: { kind: 'point', point: { x: 9, y: 2 } },
      cadgf: { id: 9004, type: 1, point: [9, 2] },
    },
  });

  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.delete');
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.match(res.message || '', /skipped 1 read-only/);
  assert.equal(document.getEntity(1), null);
  assert.equal(document.getEntity(2)?.type, 'unsupported');
  assert.deepEqual(selection.entityIds, [2]);

  selection.setSelection([2], 2);
  const readonlyDelete = bus.execute('selection.delete');
  assert.equal(readonlyDelete.ok, false);
  assert.equal(readonlyDelete.error_code, 'UNSUPPORTED_READ_ONLY');
});

test('selection.offset creates offset geometry and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 5, sidePoint: { x: 0, y: 10 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'line');
  approxEqual(created.start.x, 0);
  approxEqual(created.start.y, 5);
  approxEqual(created.end.x, 10);
  approxEqual(created.end.y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset rejects derived proxy entity by editMode', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
      ],
      closed: false,
      layerId: 0,
      sourceType: 'LEADER',
      editMode: 'proxy',
      proxyKind: 'leader',
      groupId: 1,
      space: 1,
      layout: 'LayoutStyle',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 1.5, sidePoint: { x: 1, y: 3 } });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'UNSUPPORTED_READ_ONLY');
  assert.equal(document.listEntities().length, 1);
});

test('selection.offset skips read-only proxy in mixed selection', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 9 },
      ],
      closed: false,
      layerId: 0,
      sourceType: 'LEADER',
      editMode: 'proxy',
      proxyKind: 'leader',
      groupId: 7,
      space: 1,
      layout: 'LayoutStyle',
    },
  });

  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.offset', { distance: 2, sidePoint: { x: 0, y: 3 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.match(res.message || '', /skipped 1 read-only/);
  assert.equal(document.listEntities().length, 3);
  const created = document.getEntity(3);
  assert.equal(created.type, 'line');
  approxEqual(created.start.x, 0);
  approxEqual(created.start.y, 2);
  approxEqual(created.end.x, 10);
  approxEqual(created.end.y, 2);
  assert.deepEqual(selection.entityIds, [3]);
  assert.equal(document.getEntity(2).editMode, 'proxy');
});

test('selection.offset clears imported assembly provenance on created entity', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      groupId: 9,
      sourceType: 'INSERT',
      editMode: 'exploded',
      proxyKind: 'insert',
      blockName: 'BlockMixed',
      colorSource: 'BYBLOCK',
      colorAci: 1,
      space: 1,
      layout: 'LayoutMixed',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 2, sidePoint: { x: 0, y: 3 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  const created = document.getEntity(2);
  assert.equal(created.type, 'line');
  assert.equal(created.groupId, undefined);
  assert.equal(created.sourceType, undefined);
  assert.equal(created.editMode, undefined);
  assert.equal(created.proxyKind, undefined);
  assert.equal(created.blockName, undefined);
  assert.equal(created.colorSource, undefined);
  assert.equal(created.colorAci, undefined);
  assert.equal(created.space, 1);
  assert.equal(created.layout, 'LayoutMixed');
  approxEqual(created.start.y, 2);
  approxEqual(created.end.y, 2);
});

test('selection.offset supports open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 2, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 3);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[0].y, -2);
  approxEqual(created.points[1].x, 12);
  approxEqual(created.points[1].y, -2);
  approxEqual(created.points[2].x, 12);
  approxEqual(created.points[2].y, 10);

  const original = document.getEntity(1);
  assert.equal(original.type, 'polyline');
  approxEqual(original.points[0].x, 0);
  approxEqual(original.points[0].y, 0);
  approxEqual(original.points[1].x, 10);
  approxEqual(original.points[1].y, 0);
  approxEqual(original.points[2].x, 10);
  approxEqual(original.points[2].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset supports closed polyline (square) and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 1, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const created = document.getEntity(2);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, true);
  assert.equal(created.points.length, 4);
  approxEqual(created.points[0].x, -1);
  approxEqual(created.points[0].y, -1);
  approxEqual(created.points[1].x, 11);
  approxEqual(created.points[1].y, -1);
  approxEqual(created.points[2].x, 11);
  approxEqual(created.points[2].y, 11);
  approxEqual(created.points[3].x, -1);
  approxEqual(created.points[3].y, 11);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.offset rejects self-intersecting polyline with explainable error_code', () => {
  const { selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.offset', { distance: 1, sidePoint: { x: 5, y: -5 } });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'SELF_INTERSECT');
});

test('selection.break splits a line and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, name: 'L1' },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 5, y: 0 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'line');
  assert.equal(b.type, 'line');
  approxEqual(a.start.x, 0);
  approxEqual(a.end.x, 5);
  approxEqual(b.start.x, 5);
  approxEqual(b.end.x, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break splits an open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 10, y: 5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  assert.equal(a.points.length, 3);
  assert.equal(b.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 10);
  approxEqual(a.points[1].y, 0);
  approxEqual(a.points[2].x, 10);
  approxEqual(a.points[2].y, 5);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 5);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break opens a closed polyline at picked point and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
      name: 'C1',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 10, y: 5 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 5);
  approxEqual(opened.points[0].x, 10);
  approxEqual(opened.points[0].y, 5);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  const original = document.getEntity(1);
  assert.equal(original.closed, true);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 1);
});

test('selection.break supports two-point split on line and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, name: 'L2' },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', { pick: { x: 3, y: 0 }, pick2: { x: 7, y: 0 } });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'line');
  assert.equal(b.type, 'line');
  approxEqual(a.start.x, 0);
  approxEqual(a.end.x, 3);
  approxEqual(b.start.x, 7);
  approxEqual(b.end.x, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break supports two-point split on open polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P2',
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 6 },
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  assert.equal(a.points.length, 2);
  assert.equal(b.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 5);
  approxEqual(a.points[1].y, 0);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 6);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.break two-point on open polyline handles pick2 insertion before pick1 insertion', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  // pick1 is on the later segment (requires insertion after the middle vertex),
  // pick2 is on the earlier segment (requires insertion before pick1), which can shift indices.
  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 10, y: 6 },
    pick2: { x: 5, y: 0 },
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 2);

  const a = document.getEntity(2);
  const b = document.getEntity(3);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(a.closed, false);
  assert.equal(b.closed, false);
  approxEqual(a.points[a.points.length - 1].x, 5);
  approxEqual(a.points[a.points.length - 1].y, 0);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 6);
});

test('selection.break supports two-point split on closed polyline and can undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 2);
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 1);
  const original = document.getEntity(1);
  assert.equal(original.closed, true);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 1);
});

test('selection.break supports closed polyline two-point keep=short', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    keep: 'short',
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.equal(opened.points.length, 3);
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[1].x, 10);
  approxEqual(opened.points[1].y, 0);
  approxEqual(opened.points[2].x, 10);
  approxEqual(opened.points[2].y, 5);
});

test('selection.break supports closed polyline two-point keep=long', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.break', {
    pick: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    keep: 'long',
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const opened = document.getEntity(2);
  assert.equal(opened.type, 'polyline');
  assert.equal(opened.closed, false);
  assert.ok(opened.points.length >= 5);
  // long path should include (0,0) and (0,10)
  assert.ok(opened.points.some((p) => Math.abs(p.x - 0) < 1e-6 && Math.abs(p.y - 0) < 1e-6));
  assert.ok(opened.points.some((p) => Math.abs(p.x - 0) < 1e-6 && Math.abs(p.y - 10) < 1e-6));
  approxEqual(opened.points[0].x, 5);
  approxEqual(opened.points[0].y, 0);
  approxEqual(opened.points[opened.points.length - 1].x, 10);
  approxEqual(opened.points[opened.points.length - 1].y, 5);
});

test('selection.join merges two connected lines into one polyline and can undo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, layerId: 0 },
  });

  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const created = document.getEntity(3);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 3);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[0].y, 0);
  approxEqual(created.points[1].x, 10);
  approxEqual(created.points[1].y, 0);
  approxEqual(created.points[2].x, 10);
  approxEqual(created.points[2].y, 10);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
});

test('selection.join merges 3 connected entities with primary in middle', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: 0 }, end: { x: 30, y: 0 }, layerId: 0 },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 20, y: 0 }, layerId: 0 },
  }); // id=2
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  }); // id=3

  selection.setSelection([1, 2, 3], 2);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 1);
  const created = document.getEntity(4);
  assert.equal(created.type, 'polyline');
  assert.equal(created.closed, false);
  assert.equal(created.points.length, 4);
  approxEqual(created.points[0].x, 0);
  approxEqual(created.points[1].x, 10);
  approxEqual(created.points[2].x, 20);
  approxEqual(created.points[3].x, 30);
});

test('selection.join returns NO_MATCH for disjoint segments', () => {
  const { selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 100, y: 0 }, end: { x: 110, y: 0 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.join');
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'NO_MATCH');
});

test('selection.fillet trims two lines and inserts arc with undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  approxEqual(l1.start.x, 2);
  approxEqual(l1.start.y, 0);
  approxEqual(l2.start.x, 0);
  approxEqual(l2.start.y, 2);
  approxEqual(arc.center.x, 2);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
  const backL1 = document.getEntity(1);
  const backL2 = document.getEntity(2);
  approxEqual(backL1.start.x, 0);
  approxEqual(backL2.start.y, 0);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 3);
});

test('selection.filletByPick chooses trim side based on pick points (cross)', () => {
  const { document, bus } = setup();

  // Cross at origin.
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 }, // keep +X
    pick2: { x: 0, y: 5 }, // keep +Y
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  // Horizontal line should keep end at +X and trim the -X side to x=2.
  approxEqual(l1.end.x, 10);
  approxEqual(l1.start.x, 2);
  // Vertical line should keep end at +Y and trim the -Y side to y=2.
  approxEqual(l2.end.y, 10);
  approxEqual(l2.start.y, 2);
  approxEqual(arc.center.x, 2);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick supports unlocked cross-layer targets', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 1 },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 },
    pick2: { x: 0, y: 5 },
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  // New fillet entity follows first target layer for deterministic output.
  assert.equal(arc.layerId, 0);
});

test('selection.filletByPick rejects locked layer in cross-layer mode', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 1 },
  });
  document.updateLayer(1, { locked: true });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 },
    pick2: { x: 0, y: 5 },
    radius: 2,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
  assert.match(res.message || '', /L1/);
  assert.equal(document.listEntities().length, 2);
});

test('selection.filletByPick supports line+arc targets', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 8, y: 5 },
      radius: 3,
      startAngle: Math.PI,
      endAngle: Math.PI * 1.5,
      cw: true,
      layerId: 0,
    },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 9, y: 0 },
    pick2: { x: 5, y: 5 },
    radius: 1,
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(res.message, 'Fillet applied (line+arc)');
  assert.equal(document.listEntities().length, 3);

  const line = document.getEntity(1);
  const sourceArc = document.getEntity(2);
  const filletArc = document.getEntity(3);
  assert.equal(line.type, 'line');
  assert.equal(sourceArc.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(line.start.x, 8);
  approxEqual(line.start.y, 0);
  approxEqual(line.end.x, 10);
  approxEqual(line.end.y, 0);
  approxEqual(filletArc.center.x, 8);
  approxEqual(filletArc.center.y, 1);
  approxEqual(filletArc.radius, 1);
});

test('selection.filletByPick trims arc+arc targets and inserts fillet arc (existing test)', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 4,
      startAngle: 0,
      endAngle: Math.PI / 2,
      cw: true,
      layerId: 0,
    },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 8, y: 0 },
      radius: 4,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
      cw: true,
      layerId: 0,
    },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 2.8, y: 2.8 },
    pick2: { x: 5.2, y: 2.8 },
    radius: 1,
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const filletArc = document.getEntity(3);
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.radius, 1);
  // Fillet center: circle-circle intersection of offset arcs (R1=R2=5, d=8)
  // a=4, h=3, center at (4, 3)
  approxEqual(filletArc.center.x, 4, 1e-3);
  approxEqual(filletArc.center.y, 3, 1e-3);
});

test('selection.filletByPick trims an open polyline mid-segment (cross) and keeps picked side', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    // Keep left side of polyline and keep top side of the vertical line.
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[1].x, 10);
  approxEqual(poly.points[2].x, 13);
  approxEqual(poly.points[2].y, 0);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.y, 10);

  assert.equal(arc.type, 'arc');
  approxEqual(arc.center.x, 13);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick supports closed polyline mid-segment (cross) and preserves closure', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
        { x: -10, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const arc = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, true);
  assert.equal(poly.points.length, 5);
  approxEqual(poly.points[0].x, -10);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, 13);
  approxEqual(poly.points[1].y, 0);
  approxEqual(poly.points[2].x, 30);
  approxEqual(poly.points[2].y, 0);
  approxEqual(poly.points[3].x, 30);
  approxEqual(poly.points[3].y, 10);
  approxEqual(poly.points[4].x, -10);
  approxEqual(poly.points[4].y, 10);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.x, 15);
  approxEqual(line.end.y, 10);

  assert.equal(arc.type, 'arc');
  approxEqual(arc.center.x, 13);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick supports adjacent segments on same open polyline corner', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 1,
    pick1: { x: 5, y: 0 }, // horizontal segment
    pick2: { x: 10, y: 5 }, // vertical segment
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  assert.equal(document.getEntity(1), null);
  const a = document.getEntity(2);
  const b = document.getEntity(3);
  const arc = document.getEntity(4);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(arc.type, 'arc');

  // Tangency points at a right-angle corner: trimDist = radius.
  assert.equal(a.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 8);
  approxEqual(a.points[1].y, 0);

  assert.equal(b.points.length, 2);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 2);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  approxEqual(arc.center.x, 8);
  approxEqual(arc.center.y, 2);
  approxEqual(arc.radius, 2);
});

test('selection.filletByPick auto-pairs two-segment polyline corner when picks land on same segment', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 1,
    // Both picks are on the same horizontal leg; command should auto-pair to the only corner.
    pick1: { x: 2, y: 0 },
    pick2: { x: 6, y: 0 },
    radius: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const arc = document.getEntity(4);
  assert.equal(arc.type, 'arc');
  approxEqual(arc.radius, 2);
});

test('selection.fillet rejects parallel lines with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 1 }, end: { x: 10, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.fillet rejects radius too large with explainable error_code', () => {
  const { document, selection, bus } = setup();

  // Two short segments with intersection at the start (0,0); radius bigger than length should fail.
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'RADIUS_TOO_LARGE');
  assert.equal(document.listEntities().length, 2);
});

test('selection.filletByPick returns NO_INTERSECTION when polyline cross-entity would require extend', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }],
      closed: false,
      layerId: 0,
    },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 15, y: 0 },
    pick2: { x: 0, y: 5 },
    radius: 1,
  });

  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.fillet supports unlocked cross-layer lines', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 1 },
  });
  selection.setSelection([1, 2], 1);

  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);
  const arc = document.getEntity(3);
  assert.equal(arc.type, 'arc');
  assert.equal(arc.layerId, 0);
});

test('selection.fillet rejects locked secondary layer in cross-layer mode', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 1 },
  });
  document.updateLayer(1, { locked: true });
  selection.setSelection([1, 2], 1);

  const res = bus.execute('selection.fillet', { radius: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
  assert.match(res.message || '', /L1/);
  assert.equal(document.listEntities().length, 2);
});

// --- Fillet: line + arc ---

test('selection.filletByPick trims line+arc and inserts fillet arc', () => {
  const { document, bus } = setup();

  // Horizontal line along x-axis
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  }); // id=1

  // Right semicircle arc: center at (0,8), radius 5, from -π/2 to π/2, CCW
  // Bottom of arc is at (0,3), right at (5,8), top at (0,13)
  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 8 },
      radius: 5,
      startAngle: -Math.PI / 2,
      endAngle: Math.PI / 2,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },   // keep right side of line
    pick2: { x: -3, y: 5 },  // pick left side of arc
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const line = document.getEntity(1);
  const filletArc = document.getEntity(3);
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.radius, 2);

  // Fillet center: offset line at y=2, offset arc (outside) radius=7
  // Intersection with line y=2 and circle(0,8,7): x²+36=49 => x=±√13
  // Arc sweep convention means the left-side candidate (-√13) is in-sweep
  const sqrt13 = Math.sqrt(13);
  approxEqual(filletArc.center.x, -sqrt13, 1e-3);
  approxEqual(filletArc.center.y, 2, 1e-3);

  // Line trimmed: start moves to tangent point (~-3.606, 0), end stays at (10, 0)
  approxEqual(line.start.x, -sqrt13, 1e-3);
  approxEqual(line.start.y, 0, 1e-3);
  assert.equal(line.end.x, 10);
  assert.equal(line.end.y, 0);
});

test('selection.filletByPick trims line+circle and inserts fillet arc', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 8 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: -3, y: 5 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const line = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const filletArc = document.getEntity(3);
  const sqrt13 = Math.sqrt(13);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.center.x, sqrt13, 1e-3);
  approxEqual(filletArc.center.y, 2, 1e-3);
  approxEqual(filletArc.radius, 2);
  approxEqual(line.start.x, sqrt13, 1e-3);
  approxEqual(line.start.y, 0, 1e-3);
  assert.equal(line.end.x, 10);
  assert.equal(line.end.y, 0);
});

test('selection.filletByPick preserves closed polyline and inserts tangent point for polyline+arc', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 8 },
      radius: 5,
      startAngle: -Math.PI / 2,
      endAngle: Math.PI / 2,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: -3, y: 5 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const filletArc = document.getEntity(3);
  const sqrt13 = Math.sqrt(13);

  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, true);
  assert.equal(poly.points.length, 5);
  approxEqual(poly.points[0].x, -10);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, -sqrt13, 1e-3);
  approxEqual(poly.points[1].y, 0, 1e-3);
  approxEqual(poly.points[2].x, 10);
  approxEqual(poly.points[2].y, 0);
  approxEqual(poly.points[3].x, 10);
  approxEqual(poly.points[3].y, 10);
  approxEqual(poly.points[4].x, -10);
  approxEqual(poly.points[4].y, 10);

  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.center.x, -sqrt13, 1e-3);
  approxEqual(filletArc.center.y, 2, 1e-3);
  approxEqual(filletArc.radius, 2);
});

test('selection.filletByPick trims circle+arc and inserts fillet arc', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 12, y: 0 },
      radius: 5,
      startAngle: Math.PI,
      endAngle: Math.PI / 2,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 3, y: 3 },
    pick2: { x: 9, y: 3 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const trimmedCircle = document.getEntity(1);
  const filletArc = document.getEntity(3);
  const sqrt13 = Math.sqrt(13);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.radius, 2);
  approxEqual(filletArc.center.x, 6, 1e-3);
  approxEqual(filletArc.center.y, sqrt13, 1e-3);
});

test('selection.filletByPick trims circle+circle and inserts fillet arc', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 8, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 3, y: 3 },
    pick2: { x: 5, y: 3 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const trimmed1 = document.getEntity(1);
  const trimmed2 = document.getEntity(2);
  const filletArc = document.getEntity(3);

  assert.equal(trimmed1.type, 'arc');
  assert.equal(trimmed2.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.radius, 2);
});

test('selection.filletByPick trims open polyline+circle and keeps picked side', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 8 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: -3, y: 5 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const filletArc = document.getEntity(3);
  const sqrt13 = Math.sqrt(13);

  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[0].x, sqrt13, 1e-3);
  approxEqual(poly.points[0].y, 0, 1e-3);
  approxEqual(poly.points[1].x, 10);
  approxEqual(poly.points[1].y, 0);
  approxEqual(poly.points[2].x, 10);
  approxEqual(poly.points[2].y, 10);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.center.x, sqrt13, 1e-3);
  approxEqual(filletArc.center.y, 2, 1e-3);
  approxEqual(filletArc.radius, 2);
});

test('selection.filletByPick preserves closed polyline and inserts tangent point for polyline+circle', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 8 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: -3, y: 5 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const filletArc = document.getEntity(3);
  const sqrt13 = Math.sqrt(13);

  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, true);
  assert.equal(poly.points.length, 5);
  approxEqual(poly.points[0].x, -10);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, sqrt13, 1e-3);
  approxEqual(poly.points[1].y, 0, 1e-3);
  approxEqual(poly.points[2].x, 10);
  approxEqual(poly.points[2].y, 0);
  approxEqual(poly.points[3].x, 10);
  approxEqual(poly.points[3].y, 10);
  approxEqual(poly.points[4].x, -10);
  approxEqual(poly.points[4].y, 10);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.center.x, sqrt13, 1e-3);
  approxEqual(filletArc.center.y, 2, 1e-3);
  approxEqual(filletArc.radius, 2);
});

test('selection.filletByPick trims arc+arc and inserts fillet arc', () => {
  const { document, bus } = setup();

  // Quarter-circle arc1: center (0,0), r=5, first quadrant
  // Convention: cw=false, startAngle=π/2, endAngle=0 → sweep covers [0, π/2]
  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: Math.PI / 2,
      endAngle: 0,
      cw: false,
      layerId: 0,
    },
  }); // id=1

  // Quarter-circle arc2: center (12,0), r=5, second quadrant
  // Convention: cw=false, startAngle=π, endAngle=π/2 → sweep covers [π/2, π]
  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 12, y: 0 },
      radius: 5,
      startAngle: Math.PI,
      endAngle: Math.PI / 2,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.filletByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 3, y: 3 },
    pick2: { x: 9, y: 3 },
    radius: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const filletArc = document.getEntity(3);
  assert.equal(filletArc.type, 'arc');
  approxEqual(filletArc.radius, 2);

  // Fillet center: circle-circle intersection of offset arcs (R1=R2=7, d=12)
  // a=6, h=√13, center at (6, √13)
  const sqrt13 = Math.sqrt(13);
  approxEqual(filletArc.center.x, 6, 1e-3);
  approxEqual(filletArc.center.y, sqrt13, 1e-3);
});

test('selection.chamferByPick trims line+arc and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 4 }, end: { x: 10, y: 4 }, layerId: 0 },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: -Math.PI / 2,
      endAngle: Math.PI / 2,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 4 },
    pick2: { x: 1, y: 5 },
    d1: 2,
    d2: 1,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const line = document.getEntity(1);
  const trimmedArc = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(trimmedArc.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(line.start.x, -1, 1e-3);
  approxEqual(line.start.y, 4, 1e-3);
  approxEqual(connector.start.x, -1, 1e-3);
  approxEqual(connector.start.y, 4, 1e-3);
});

test('selection.chamferByPick trims line+circle and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: 3, y: 3 },
    d1: 2,
    d2: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const line = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(line.start.x, 7, 1e-3);
  approxEqual(line.start.y, 0, 1e-3);
  approxEqual(connector.start.x, 7, 1e-3);
  approxEqual(connector.start.y, 0, 1e-3);
});

test('selection.chamferByPick trims open polyline+circle and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 8, y: 0 },
    pick2: { x: 3, y: 3 },
    d1: 2,
    d2: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[0].x, 7, 1e-3);
  approxEqual(poly.points[0].y, 0, 1e-3);
  approxEqual(poly.points[1].x, 10, 1e-3);
  approxEqual(poly.points[1].y, 0, 1e-3);
  approxEqual(poly.points[2].x, 10, 1e-3);
  approxEqual(poly.points[2].y, 10, 1e-3);

  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(connector.start.x, 7, 1e-3);
  approxEqual(connector.start.y, 0, 1e-3);
  approxEqual(connector.end.x, 5 * Math.cos(0.4), 1e-3);
  approxEqual(connector.end.y, 5 * Math.sin(0.4), 1e-3);
});

test('selection.chamferByPick trims circle+circle and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 8, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 3, y: 3 },
    pick2: { x: 5, y: 3 },
    d1: 2,
    d2: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const arc1 = document.getEntity(1);
  const arc2 = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(arc1.type, 'arc');
  assert.equal(arc2.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(Math.hypot(connector.start.x - arc1.center.x, connector.start.y - arc1.center.y), 5, 1e-3);
  approxEqual(Math.hypot(connector.end.x - arc2.center.x, connector.end.y - arc2.center.y), 5, 1e-3);
});

test('selection.chamferByPick trims arc+arc and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: Math.PI,
      endAngle: 0,
      cw: false,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 8, y: 0 },
      radius: 5,
      startAngle: Math.PI,
      endAngle: 0,
      cw: false,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 2, y: 4 },
    pick2: { x: 6, y: 4 },
    d1: 2,
    d2: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const trimmed1 = document.getEntity(1);
  const trimmed2 = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(trimmed1.type, 'arc');
  assert.equal(trimmed2.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(Math.hypot(connector.start.x - trimmed1.center.x, connector.start.y - trimmed1.center.y), 5, 1e-3);
  approxEqual(Math.hypot(connector.end.x - trimmed2.center.x, connector.end.y - trimmed2.center.y), 5, 1e-3);
});

test('selection.chamferByPick trims arc+circle and inserts connector', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: Math.PI,
      endAngle: 0,
      cw: false,
      layerId: 0,
    },
  }); // id=1

  bus.execute('entity.create', {
    entity: {
      type: 'circle',
      center: { x: 8, y: 0 },
      radius: 5,
      layerId: 0,
    },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 2, y: 4 },
    pick2: { x: 6, y: 4 },
    d1: 2,
    d2: 2,
  });

  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const trimmedArc = document.getEntity(1);
  const trimmedCircle = document.getEntity(2);
  const connector = document.getEntity(3);

  assert.equal(trimmedArc.type, 'arc');
  assert.equal(trimmedCircle.type, 'arc');
  assert.equal(connector.type, 'line');
  approxEqual(Math.hypot(connector.start.x - trimmedArc.center.x, connector.start.y - trimmedArc.center.y), 5, 1e-3);
  approxEqual(Math.hypot(connector.end.x - trimmedCircle.center.x, connector.end.y - trimmedCircle.center.y), 5, 1e-3);
});

test('selection.chamfer trims two lines and inserts connector with undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  approxEqual(l1.start.x, 2);
  approxEqual(l1.start.y, 0);
  approxEqual(l2.start.x, 0);
  approxEqual(l2.start.y, 3);
  approxEqual(connector.start.x, 2);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 0);
  approxEqual(connector.end.y, 3);

  bus.execute('history.undo');
  assert.equal(document.listEntities().length, 2);
  const backL1 = document.getEntity(1);
  const backL2 = document.getEntity(2);
  approxEqual(backL1.start.x, 0);
  approxEqual(backL2.start.y, 0);

  bus.execute('history.redo');
  assert.equal(document.listEntities().length, 3);
});

test('selection.chamferByPick chooses trim side based on pick points (cross)', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 }, // keep +X
    pick2: { x: 0, y: 5 }, // keep +Y
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const l1 = document.getEntity(1);
  const l2 = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  approxEqual(l1.start.x, 2);
  approxEqual(l2.start.y, 3);
  approxEqual(connector.start.x, 2);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 0);
  approxEqual(connector.end.y, 3);
});

test('selection.chamferByPick supports unlocked cross-layer targets', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 1 },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 5, y: 0 },
    pick2: { x: 0, y: 5 },
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  // Connector follows first target layer for deterministic output.
  assert.equal(connector.layerId, 0);
});

test('selection.chamferByPick trims an open polyline mid-segment (cross) and keeps picked side', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    d1: 2,
    d2: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, false);
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[2].x, 13);
  approxEqual(poly.points[2].y, 0);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.y, 10);

  assert.equal(connector.type, 'line');
  approxEqual(connector.start.x, 13);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 15);
  approxEqual(connector.end.y, 2);
});

test('selection.chamferByPick supports closed polyline mid-segment (cross) and preserves closure', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: -10, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
        { x: -10, y: 10 },
      ],
      closed: true,
      layerId: 0,
    },
  }); // id=1
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -10 }, end: { x: 15, y: 10 }, layerId: 0 },
  }); // id=2

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 12, y: 0 },
    pick2: { x: 15, y: 5 },
    d1: 2,
    d2: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const poly = document.getEntity(1);
  const line = document.getEntity(2);
  const connector = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.closed, true);
  assert.equal(poly.points.length, 5);
  approxEqual(poly.points[0].x, -10);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, 13);
  approxEqual(poly.points[1].y, 0);
  approxEqual(poly.points[2].x, 30);
  approxEqual(poly.points[2].y, 0);
  approxEqual(poly.points[3].x, 30);
  approxEqual(poly.points[3].y, 10);
  approxEqual(poly.points[4].x, -10);
  approxEqual(poly.points[4].y, 10);

  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 15);
  approxEqual(line.start.y, 2);
  approxEqual(line.end.x, 15);
  approxEqual(line.end.y, 10);

  assert.equal(connector.type, 'line');
  approxEqual(connector.start.x, 13);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 15);
  approxEqual(connector.end.y, 2);
});

test('selection.chamferByPick supports adjacent segments on same open polyline corner', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 1,
    pick1: { x: 5, y: 0 },
    pick2: { x: 10, y: 5 },
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  assert.equal(document.getEntity(1), null);
  const a = document.getEntity(2);
  const b = document.getEntity(3);
  const connector = document.getEntity(4);
  assert.equal(a.type, 'polyline');
  assert.equal(b.type, 'polyline');
  assert.equal(connector.type, 'line');

  assert.equal(a.points.length, 2);
  approxEqual(a.points[0].x, 0);
  approxEqual(a.points[0].y, 0);
  approxEqual(a.points[1].x, 8);
  approxEqual(a.points[1].y, 0);

  assert.equal(b.points.length, 2);
  approxEqual(b.points[0].x, 10);
  approxEqual(b.points[0].y, 3);
  approxEqual(b.points[1].x, 10);
  approxEqual(b.points[1].y, 10);

  approxEqual(connector.start.x, 8);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 10);
  approxEqual(connector.end.y, 3);
});

test('selection.chamferByPick auto-pairs two-segment polyline corner when picks land on same segment', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
      layerId: 0,
      name: 'P1',
    },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 1,
    // Both picks are on the same horizontal leg; command should auto-pair to the only corner.
    pick1: { x: 2, y: 0 },
    pick2: { x: 6, y: 0 },
    d1: 2,
    d2: 3,
  });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);

  const connector = document.getEntity(4);
  assert.equal(connector.type, 'line');
  approxEqual(connector.start.x, 8);
  approxEqual(connector.start.y, 0);
  approxEqual(connector.end.x, 10);
  approxEqual(connector.end.y, 3);
});

test('selection.chamfer rejects parallel lines with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 1 }, end: { x: 10, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.chamfer rejects distance too large with explainable error_code', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, layerId: 0 },
  });
  selection.setSelection([1, 2], 1);
  const res = bus.execute('selection.chamfer', { d1: 2, d2: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'DISTANCE_TOO_LARGE');
  assert.equal(document.listEntities().length, 2);
});

test('selection.chamferByPick returns NO_INTERSECTION when polyline cross-entity would require extend', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }],
      closed: false,
      layerId: 0,
    },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 }, layerId: 0 },
  });

  const res = bus.execute('selection.chamferByPick', {
    firstId: 1,
    secondId: 2,
    pick1: { x: 15, y: 0 },
    pick2: { x: 0, y: 5 },
    d1: 1,
    d2: 1,
  });

  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'NO_INTERSECTION');
  assert.equal(document.listEntities().length, 2);
});

test('selection.chamfer supports unlocked cross-layer lines', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 1 },
  });
  selection.setSelection([1, 2], 1);

  const res = bus.execute('selection.chamfer', { d1: 2, d2: 3 });
  assert.equal(res.ok, true);
  assert.equal(document.listEntities().length, 3);
  const connector = document.getEntity(3);
  assert.equal(connector.type, 'line');
  assert.equal(connector.layerId, 0);
});

test('selection.chamfer rejects locked secondary layer in cross-layer mode', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, layerId: 1 },
  });
  document.updateLayer(1, { locked: true });
  selection.setSelection([1, 2], 1);

  const res = bus.execute('selection.chamfer', { d1: 2, d2: 3 });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
  assert.match(res.message || '', /L1/);
  assert.equal(document.listEntities().length, 2);
});

test('selection.extend supports polyline endpoint', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=15
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });

  // target: polyline from (0,0) -> (10,0)
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, layerId: 0 },
  });

  // Extend the polyline endpoint near (10,0) to boundary
  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10.5, y: 0.2 },
  });
  assert.equal(res.ok, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[1].x, 15);
  approxEqual(poly.points[1].y, 0);
});

test('selection.extend on polyline uses segment/path-aware endpoint choice', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=300
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 300, y: -50 }, end: { x: 300, y: 50 }, layerId: 0 },
  });

  // target: pick near a middle segment where path-to-end is shorter than path-to-start.
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 250, y: 0 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 100, y: 10 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[poly.points.length - 1].x, 300);
  approxEqual(poly.points[poly.points.length - 1].y, 0);
});

test('selection.extend on polyline supports segment-level endpoint extension', () => {
  const { document, selection, bus } = setup();

  // boundaries: lower y=-5 and upper y=12
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: -5 }, end: { x: 20, y: -5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 12 }, end: { x: 20, y: 12 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 5 },
      ],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.extend', {
    boundaryIds: [1, 2],
    targetId: 3,
    // Pick near lower half of middle vertical segment => extend vertex #1 downward.
    pick: { x: 5.1, y: 1.0 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const poly = document.getEntity(3);
  assert.equal(poly.type, 'polyline');
  approxEqual(poly.points[0].x, 0);
  approxEqual(poly.points[0].y, 0);
  approxEqual(poly.points[1].x, 5);
  approxEqual(poly.points[1].y, -5);
  approxEqual(poly.points[2].x, 5);
  approxEqual(poly.points[2].y, 5);
  approxEqual(poly.points[3].x, 10);
  approxEqual(poly.points[3].y, 5);
});

test('selection.extend supports sequential polyline endpoint extends with isolated undo/redo', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: -10 }, end: { x: 20, y: 10 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: -10, y: 0 }, { x: 5, y: 0 }], closed: false, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: -10, y: -4 }, { x: 3, y: -4 }], closed: false, layerId: 0 },
  });

  const extend1 = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 5.5, y: 0.1 },
  });
  const extend2 = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 3,
    pick: { x: 3.5, y: -3.9 },
  });
  assert.equal(extend1.ok, true);
  assert.equal(extend1.changed, true);
  assert.equal(extend2.ok, true);
  assert.equal(extend2.changed, true);

  let poly1 = document.getEntity(2);
  let poly2 = document.getEntity(3);
  approxEqual(poly1.points[1].x, 20);
  approxEqual(poly1.points[1].y, 0);
  approxEqual(poly2.points[1].x, 20);
  approxEqual(poly2.points[1].y, -4);

  bus.execute('history.undo');
  poly1 = document.getEntity(2);
  poly2 = document.getEntity(3);
  approxEqual(poly1.points[1].x, 20);
  approxEqual(poly1.points[1].y, 0);
  approxEqual(poly2.points[1].x, 3);
  approxEqual(poly2.points[1].y, -4);

  bus.execute('history.redo');
  poly2 = document.getEntity(3);
  approxEqual(poly2.points[1].x, 20);
  approxEqual(poly2.points[1].y, -4);
});

test('selection.extend keeps failure isolated before next polyline success and history replay', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: -10 }, end: { x: 20, y: 10 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 28, y: -2 }, { x: 28, y: 4 }], closed: false, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: -10, y: -6 }, { x: 4, y: -6 }], closed: false, layerId: 0 },
  });

  const fail = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 28.5, y: 1 },
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.changed, false);
  assert.equal(fail.error_code, 'EXTEND_NO_INTERSECTION');

  const ok = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 3,
    pick: { x: 4.5, y: -5.9 },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.changed, true);

  let failPoly = document.getEntity(2);
  let okPoly = document.getEntity(3);
  approxEqual(failPoly.points[1].x, 28);
  approxEqual(failPoly.points[1].y, 4);
  approxEqual(okPoly.points[1].x, 20);
  approxEqual(okPoly.points[1].y, -6);

  bus.execute('history.undo');
  failPoly = document.getEntity(2);
  okPoly = document.getEntity(3);
  approxEqual(failPoly.points[1].x, 28);
  approxEqual(failPoly.points[1].y, 4);
  approxEqual(okPoly.points[1].x, 4);
  approxEqual(okPoly.points[1].y, -6);

  bus.execute('history.redo');
  okPoly = document.getEntity(3);
  approxEqual(okPoly.points[1].x, 20);
  approxEqual(okPoly.points[1].y, -6);
});

test('cadgf adapter import/export keeps unsupported entities and patches geometry', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-02-07T00:00:00Z',
      modified_at: '2026-02-07T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        name: '',
        group_id: 41,
        line_type: 'CONTINUOUS',
        line_weight: null,
        line_type_scale: 1,
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        space: 0,
        layout: 'Model',
        line: [[0, 0], [10, 0]],
      },
      {
        id: 2,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        group_id: 42,
        space: 0,
        layout: 'Model',
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D7',
        text: { pos: [1, 2], h: 2.5, rot: 0, value: 'Hi' },
        // Dimension text metadata must survive editor round-trip even though
        // derived dimension proxies are now treated as read-only.
        text_kind: 'dimension',
        dim_type: 160,
        dim_style: 'HC_GBDIM',
        dim_text_pos: [5, 6],
        dim_text_rotation: 1.570796,
      },
      {
        id: 3,
        type: 6,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        space: 0,
        spline: { degree: 2, control: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1] },
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 1);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const line = document.getEntity(1);
  assert.equal(line.type, 'line');
  assert.equal(line.groupId, 41);
  assert.equal(line.space, 0);
  assert.equal(line.layout, 'Model');
  approxEqual(line.start.x, 0);
  approxEqual(line.end.x, 10);

  const importedText = document.getEntity(2);
  assert.equal(importedText.type, 'text');
  assert.equal(importedText.groupId, 42);
  assert.equal(importedText.space, 0);
  assert.equal(importedText.layout, 'Model');
  assert.equal(importedText.sourceType, 'DIMENSION');
  assert.equal(importedText.textKind, 'dimension');
  assert.equal(importedText.dimType, 160);
  assert.equal(importedText.dimStyle, 'HC_GBDIM');
  assert.deepEqual(importedText.dimTextPos, { x: 5, y: 6 });
  assert.equal(importedText.dimTextRotation, 1.570796);

  const unsupported = document.getEntity(3);
  assert.equal(unsupported.type, 'unsupported');
  assert.ok(unsupported.cadgf && unsupported.cadgf.type === 6);
  assert.ok(unsupported.display_proxy);
  assert.equal(unsupported.display_proxy.kind, 'polyline');
  assert.equal(unsupported.readOnly, true);
  assert.equal(unsupported.visible, true);

  selection.setSelection([1], 1);
  bus.execute('selection.move', { delta: { x: 5, y: -2 } });

  selection.setSelection([2], 2);
  const moveDerived = bus.execute('selection.move', { delta: { x: 3, y: 4 } });
  assert.equal(moveDerived.ok, false);
  assert.equal(moveDerived.error_code, 'UNSUPPORTED_READ_ONLY');

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  assert.equal(isCadgfDocument(exported), true);
  const outLine = exported.entities.find((e) => e.id === 1);
  assert.equal(outLine.type, 2);
  assert.equal(outLine.group_id, 41);
  assert.equal(outLine.space, 0);
  assert.equal(outLine.layout, 'Model');
  assert.deepEqual(outLine.line, [[5, -2], [15, -2]]);

  const outText = exported.entities.find((e) => e.id === 2);
  assert.equal(outText.type, 7);
  assert.equal(outText.group_id, 42);
  assert.equal(outText.space, 0);
  assert.equal(outText.layout, 'Model');
  assert.deepEqual(outText.text.pos, [1, 2]);
  assert.equal(outText.source_type, 'DIMENSION');
  assert.equal(outText.edit_mode, 'proxy');
  assert.equal(outText.proxy_kind, 'dimension');
  assert.equal(outText.block_name, '*D7');
  assert.equal(outText.text_kind, 'dimension');
  assert.equal(outText.dim_type, 160);
  assert.equal(outText.dim_style, 'HC_GBDIM');
  assert.deepEqual(outText.dim_text_pos, [5, 6]);
  assert.equal(outText.dim_text_rotation, 1.570796);

  const outSpline = exported.entities.find((e) => e.id === 3);
  assert.equal(outSpline.type, 6);
  assert.deepEqual(outSpline.spline.control, fixture.entities[2].spline.control);
});

test('cadgf adapter infers imported MLEADER text as LEADER proxy source groups', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 1, name: 'AnnoLayer', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 1,
        name: 'existing-group',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 41,
        line: [[0, 0], [10, 0]],
      },
      {
        id: 2,
        type: 7,
        layer_id: 1,
        name: '',
        color_source: 'BYLAYER',
        space: 0,
        text: { pos: [12, 18], h: 2.5, rot: 0, value: 'MLEADER_STEP186\nSECOND_LINE' },
        text_kind: 'mleader',
      },
      {
        id: 3,
        type: 7,
        layer_id: 1,
        name: '',
        color_source: 'BYLAYER',
        space: 0,
        text: { pos: [32, 18], h: 2.5, rot: 0.25, value: 'SECOND_MLEADER' },
        text_kind: 'mleader',
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const mleaderOne = document.getEntity(2);
  const mleaderTwo = document.getEntity(3);
  assert.equal(mleaderOne.type, 'text');
  assert.equal(mleaderOne.sourceType, 'LEADER');
  assert.equal(mleaderOne.editMode, 'proxy');
  assert.equal(mleaderOne.proxyKind, 'mleader');
  assert.equal(mleaderOne.textKind, 'mleader');
  assert.deepEqual(mleaderOne.sourceTextPos, { x: 12, y: 18 });
  assert.equal(mleaderOne.sourceTextRotation, 0);
  assert.equal(mleaderOne.groupId, 42);
  assert.equal(mleaderTwo.groupId, 43);
  assert.deepEqual(mleaderTwo.sourceTextPos, { x: 32, y: 18 });
  approxEqual(mleaderTwo.sourceTextRotation, 0.25);

  selection.setSelection([2], 2);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'MLEADER_EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(2).value, 'MLEADER_EDITED');
  assert.equal(document.getEntity(2).sourceType, 'LEADER');
  assert.equal(document.getEntity(2).editMode, 'proxy');
  assert.equal(document.getEntity(2).proxyKind, 'mleader');
  assert.equal(document.getEntity(2).groupId, 42);

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 2);
  const outTextTwo = exported.entities.find((entity) => entity.id === 3);
  assert.equal(outText.type, 7);
  assert.equal(outText.text_kind, 'mleader');
  assert.equal(outText.source_type, 'LEADER');
  assert.equal(outText.edit_mode, 'proxy');
  assert.equal(outText.proxy_kind, 'mleader');
  assert.equal(outText.group_id, 42);
  assert.deepEqual(outText.text.pos, [12, 18]);
  assert.equal(outText.text.rot, 0);
  assert.equal(outText.text.value, 'MLEADER_EDITED');
  assert.equal(outTextTwo.group_id, 43);
  assert.equal(outTextTwo.source_type, 'LEADER');
  assert.equal(outTextTwo.proxy_kind, 'mleader');
  assert.equal(outTextTwo.text_kind, 'mleader');
});

test('cadgf adapter imports and exports explicit MLEADER proxy metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 1, name: 'AnnoLayer', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 7,
        layer_id: 1,
        name: '',
        color_source: 'BYLAYER',
        group_id: 17,
        source_type: 'LEADER',
        edit_mode: 'proxy',
        proxy_kind: 'mleader',
        space: 0,
        text: { pos: [12, 18], h: 2.5, rot: 0, value: 'MLEADER_STEP186\nSECOND_LINE' },
        text_kind: 'mleader',
        source_anchor: [12, 18],
        leader_landing: [12, 18],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const mleader = document.getEntity(1);
  assert.equal(mleader.type, 'text');
  assert.equal(mleader.sourceType, 'LEADER');
  assert.equal(mleader.editMode, 'proxy');
  assert.equal(mleader.proxyKind, 'mleader');
  assert.equal(mleader.textKind, 'mleader');
  assert.equal(mleader.groupId, 17);
  assert.deepEqual(mleader.sourceTextPos, { x: 12, y: 18 });
  assert.equal(mleader.sourceTextRotation, 0);
  assert.deepEqual(mleader.sourceAnchor, { x: 12, y: 18 });
  assert.deepEqual(mleader.leaderLanding, { x: 12, y: 18 });

  selection.setSelection([1], 1);
  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'MLEADER_EXPLICIT_EDITED' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(1).value, 'MLEADER_EXPLICIT_EDITED');
  assert.equal(document.getEntity(1).groupId, 17);
  assert.deepEqual(document.getEntity(1).sourceAnchor, { x: 12, y: 18 });

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outText.group_id, 17);
  assert.equal(outText.source_type, 'LEADER');
  assert.equal(outText.edit_mode, 'proxy');
  assert.equal(outText.proxy_kind, 'mleader');
  assert.equal(outText.text_kind, 'mleader');
  assert.deepEqual(outText.source_anchor, [12, 18]);
  assert.deepEqual(outText.leader_landing, [12, 18]);
  assert.equal(outText.text.value, 'MLEADER_EXPLICIT_EDITED');
});

test('cadgf adapter infers imported TABLE text as TABLE proxy source groups', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 1, name: 'AnnoLayer', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 7,
        layer_id: 1,
        name: '',
        color_source: 'BYLAYER',
        space: 0,
        text: { pos: [24, 12], h: 3, rot: 0, value: 'TABLE_STEP186\nROW_2' },
        text_kind: 'table',
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document, selection, bus } = setup();
  document.restore(imported.docSnapshot);

  const table = document.getEntity(1);
  assert.equal(table.type, 'text');
  assert.equal(table.sourceType, 'TABLE');
  assert.equal(table.editMode, 'proxy');
  assert.equal(table.proxyKind, 'table');
  assert.equal(table.textKind, 'table');
  assert.deepEqual(table.sourceTextPos, { x: 24, y: 12 });
  assert.equal(table.sourceTextRotation, 0);
  assert.equal(table.groupId, 1);

  selection.setSelection([1], 1);
  const patch = bus.execute('selection.propertyPatch', {
    patch: {
      value: 'TABLE_PROXY_EDITED',
      position: { x: 28, y: 14 },
    },
  });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(1).value, 'TABLE_PROXY_EDITED');
  assert.deepEqual(document.getEntity(1).position, { x: 28, y: 14 });
  assert.equal(document.getEntity(1).sourceType, 'TABLE');
  assert.equal(document.getEntity(1).editMode, 'proxy');
  assert.equal(document.getEntity(1).proxyKind, 'table');

  const reset = bus.execute('selection.sourceResetTextPlacement');
  assert.equal(reset.ok, true);
  assert.equal(reset.changed, true);
  assert.equal(reset.message, 'Reset source text placement (1 of 1 entities)');
  assert.deepEqual(document.getEntity(1).position, { x: 24, y: 12 });

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outText.type, 7);
  assert.equal(outText.text_kind, 'table');
  assert.equal(outText.source_type, 'TABLE');
  assert.equal(outText.edit_mode, 'proxy');
  assert.equal(outText.proxy_kind, 'table');
  assert.equal(outText.group_id, 1);
  assert.deepEqual(outText.text.pos, [24, 12]);
  assert.equal(outText.text.rot, 0);
  assert.equal(outText.text.value, 'TABLE_PROXY_EDITED');
});

test('selection.sourceEditGroupText releases single imported TABLE proxy text to editable text', () => {
  const { document, selection, bus } = setup();

  document.addEntity({
    id: 61,
    type: 'text',
    layerId: 0,
    position: { x: 24, y: 12 },
    value: 'TABLE_STEP186\nROW_2',
    height: 3,
    rotation: 0,
    sourceType: 'TABLE',
    editMode: 'proxy',
    proxyKind: 'table',
    textKind: 'table',
    sourceTextPos: { x: 24, y: 12 },
    sourceTextRotation: 0,
    groupId: 61,
    space: 0,
  });

  selection.setSelection([61], 61);
  const released = bus.execute('selection.sourceEditGroupText');
  assert.equal(released.ok, true);
  assert.equal(released.changed, true);
  assert.equal(released.message, 'Released source group and selected source text (1 of 1 entities)');

  const entity = document.getEntity(61);
  assert.equal(entity.textKind, 'table');
  assert.equal(entity.sourceType, undefined);
  assert.equal(entity.editMode, undefined);
  assert.equal(entity.proxyKind, undefined);
  assert.equal(entity.groupId, undefined);

  const patch = bus.execute('selection.propertyPatch', { patch: { value: 'TABLE_RELEASED_EDIT' } });
  assert.equal(patch.ok, true);
  assert.equal(document.getEntity(61).value, 'TABLE_RELEASED_EDIT');
});

test('cadgf adapter imports and exports explicit classic LEADER guide metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 8,
        type: 0,
        layer_id: 0,
        name: '',
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'LEADER',
        edit_mode: 'proxy',
        proxy_kind: 'leader',
        space: 1,
        layout: 'LayoutCombo',
        polyline: [[188, 150], [204, 162], [220, 182]],
      },
      {
        id: 15,
        type: 7,
        layer_id: 0,
        name: '',
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'LEADER',
        edit_mode: 'proxy',
        proxy_kind: 'leader',
        space: 1,
        layout: 'LayoutCombo',
        text: { pos: [210, 154], h: 2.6, rot: 0, value: 'THIRD NOTE' },
        text_kind: 'text',
        source_anchor: [188, 150],
        leader_landing: [188, 150],
        leader_elbow: [204, 162],
        source_anchor_driver_id: 8,
        source_anchor_driver_type: 'polyline',
        source_anchor_driver_kind: 'endpoint',
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const importedText = imported.docSnapshot.entities.find((entity) => entity.id === 15);
  assert.deepEqual(importedText?.sourceAnchor, { x: 188, y: 150 });
  assert.deepEqual(importedText?.leaderLanding, { x: 188, y: 150 });
  assert.deepEqual(importedText?.leaderElbow, { x: 204, y: 162 });
  assert.equal(importedText?.sourceAnchorDriverId, 8);
  assert.equal(importedText?.sourceAnchorDriverType, 'polyline');
  assert.equal(importedText?.sourceAnchorDriverKind, 'endpoint');

  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);
  doc.updateEntity(15, {
    position: { x: 214, y: 158 },
    sourceAnchor: { x: 190, y: 152 },
    leaderLanding: { x: 190, y: 152 },
    leaderElbow: { x: 206, y: 164 },
  });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 15);
  assert.deepEqual(outText?.source_anchor, [190, 152]);
  assert.deepEqual(outText?.leader_landing, [190, 152]);
  assert.deepEqual(outText?.leader_elbow, [206, 164]);
  assert.equal(outText?.source_anchor_driver_id, 8);
  assert.equal(outText?.source_anchor_driver_type, 'polyline');
  assert.equal(outText?.source_anchor_driver_kind, 'endpoint');
});

test('cadgf adapter imports and exports explicit LEADER guide metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 8,
        type: 0,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'LEADER',
        edit_mode: 'proxy',
        proxy_kind: 'leader',
        space: 1,
        layout: 'LayoutCombo',
        polyline: [[188, 150], [204, 162], [220, 182]],
      },
      {
        id: 15,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 3,
        source_type: 'LEADER',
        edit_mode: 'proxy',
        proxy_kind: 'leader',
        space: 1,
        layout: 'LayoutCombo',
        text: { pos: [210, 154], h: 2.6, rot: 0, value: 'THIRD NOTE' },
        text_kind: 'text',
        source_anchor: [188, 150],
        leader_landing: [188, 150],
        leader_elbow: [204, 162],
        source_anchor_driver_type: 'polyline',
        source_anchor_driver_kind: 'endpoint',
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document } = setup();
  document.restore(imported.docSnapshot);

  const leaderText = document.getEntity(15);
  assert.deepEqual(leaderText.sourceAnchor, { x: 188, y: 150 });
  assert.deepEqual(leaderText.leaderLanding, { x: 188, y: 150 });
  assert.deepEqual(leaderText.leaderElbow, { x: 204, y: 162 });
  assert.equal(leaderText.sourceAnchorDriverType, 'polyline');
  assert.equal(leaderText.sourceAnchorDriverKind, 'endpoint');

  const guide = resolveSourceTextGuide(document.listEntities(), leaderText);
  assert.deepEqual(guide?.anchor, { x: 188, y: 150 });
  assert.deepEqual(guide?.landingPoint, { x: 188, y: 150 });
  assert.deepEqual(guide?.elbowPoint, { x: 204, y: 162 });
  assert.equal(guide?.anchorDriverId, 8);

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 15);
  assert.deepEqual(outText.source_anchor, [188, 150]);
  assert.deepEqual(outText.leader_landing, [188, 150]);
  assert.deepEqual(outText.leader_elbow, [204, 162]);
  assert.equal(outText.source_anchor_driver_type, 'polyline');
  assert.equal(outText.source_anchor_driver_kind, 'endpoint');
});

test('cadgf adapter imports and exports explicit DIMENSION guide metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 21,
        type: 2,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        line: [[26.25, 0], [103.75, 0]],
      },
      {
        id: 25,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        text: { pos: [65, 152], h: 1, rot: 0, value: '78' },
        text_kind: 'dimension',
        dim_text_pos: [65, 152],
        dim_text_rotation: 0,
        source_anchor: [65, 0],
        source_anchor_driver_id: 21,
        source_anchor_driver_type: 'line',
        source_anchor_driver_kind: 'midpoint',
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const { document } = setup();
  document.restore(imported.docSnapshot);

  const dimText = document.getEntity(25);
  assert.deepEqual(dimText.sourceAnchor, { x: 65, y: 0 });
  assert.equal(dimText.sourceAnchorDriverId, 21);
  assert.equal(dimText.sourceAnchorDriverType, 'line');
  assert.equal(dimText.sourceAnchorDriverKind, 'midpoint');

  const guide = resolveSourceTextGuide(document.listEntities(), dimText);
  assert.deepEqual(guide?.anchor, { x: 65, y: 0 });
  assert.equal(guide?.anchorDriverId, 21);
  assert.equal(guide?.anchorDriverLabel, 'line midpoint');

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 25);
  assert.deepEqual(outText.source_anchor, [65, 0]);
  assert.equal(outText.source_anchor_driver_id, 21);
  assert.equal(outText.source_anchor_driver_type, 'line');
  assert.equal(outText.source_anchor_driver_kind, 'midpoint');
});

test('cadgf adapter imports and exports DIMENSION source bundle metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-24T00:00:00Z',
      modified_at: '2026-03-24T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 25,
        type: 7,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 5,
        source_bundle_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        text: { pos: [65, 152], h: 1, rot: 0, value: '78' },
        text_kind: 'dimension',
      },
      {
        id: 26,
        type: 0,
        layer_id: 0,
        name: '',
        color: 0xffffff,
        color_source: 'BYLAYER',
        group_id: 6,
        source_bundle_id: 5,
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        block_name: '*D1',
        dim_type: 160,
        dim_style: 'Standard',
        space: 1,
        layout: 'LayoutCombo',
        polyline: [[26.25, -0.0411], [26, 0], [26.25, 0.0411], [26.25, -0.0411]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 0);

  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const text = doc.getEntity(25);
  const arrowhead = doc.getEntity(26);
  assert.equal(text?.sourceBundleId, 5);
  assert.equal(arrowhead?.sourceBundleId, 5);
  assert.equal(text?.groupId, 5);
  assert.equal(arrowhead?.groupId, 6);

  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 25);
  const outArrowhead = exported.entities.find((entity) => entity.id === 26);
  assert.equal(outText?.source_bundle_id, 5);
  assert.equal(outArrowhead?.source_bundle_id, 5);
  assert.equal(outText?.group_id, 5);
  assert.equal(outArrowhead?.group_id, 6);
});

test('cadgf adapter imports and exports printable/frozen/construction layer flags', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-21T00:00:00Z',
      modified_at: '2026-03-21T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 7, name: 'A-ANNO', color: 0x00ff00, visible: 1, locked: 1, printable: 0, frozen: 1, construction: 1, line_type: 'CENTER', line_weight: 0.35 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 7,
        name: '',
        color: 0x00ff00,
        color_source: 'BYLAYER',
        color_aci: 3,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const importedLayer = doc.getLayer(7);
  assert.equal(importedLayer?.locked, true);
  assert.equal(importedLayer?.printable, false);
  assert.equal(importedLayer?.frozen, true);
  assert.equal(importedLayer?.construction, true);
  assert.equal(importedLayer?.lineType, 'CENTER');
  assert.equal(importedLayer?.lineWeight, 0.35);
  assert.deepEqual(doc.listVisibleEntities().map((entity) => entity.id), []);

  doc.updateLayer(7, { printable: true, frozen: false, construction: false, lineType: 'DASHED', lineWeight: 0.6 });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLayer = exported.layers.find((layer) => layer.id === 7);
  assert.equal(outLayer?.locked, 1);
  assert.equal(outLayer?.printable, 1);
  assert.equal(outLayer?.frozen, 0);
  assert.equal(outLayer?.construction, 0);
  assert.equal(outLayer?.line_type, 'DASHED');
  assert.equal(outLayer?.line_weight, 0.6);
});

test('cadgf adapter imports and exports entity line style fields', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-22T00:00:00Z',
      modified_at: '2026-03-22T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        name: 'styled-line',
        line_type: 'CENTER',
        line_weight: 0.35,
        line_type_scale: 0.25,
        color: 0xffffff,
        color_source: 'BYLAYER',
        color_aci: 7,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const line = doc.getEntity(1);
  assert.equal(line?.lineType, 'CENTER');
  assert.equal(line?.lineWeight, 0.35);
  assert.equal(line?.lineWeightSource, 'EXPLICIT');
  assert.equal(line?.lineTypeScale, 0.25);
  assert.equal(line?.lineTypeScaleSource, 'EXPLICIT');

  doc.updateEntity(1, { lineType: 'DASHED', lineWeight: 0.6, lineTypeScale: 1.5 });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outLine?.line_type, 'DASHED');
  assert.equal(outLine?.line_weight, 0.6);
  assert.equal(outLine?.line_type_scale, 1.5);
});

test('cadgf adapter omits line_type_scale when explicit scale returns to default source', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-23T00:00:00Z',
      modified_at: '2026-03-23T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        name: 'scaled-line',
        line_type_scale: 0.25,
        color: 0xffffff,
        color_source: 'BYLAYER',
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  doc.updateEntity(1, { lineTypeScale: 1, lineTypeScaleSource: 'DEFAULT' });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(Object.prototype.hasOwnProperty.call(outLine || {}, 'line_type_scale'), false);
});

test('cadgf adapter omits line_weight when explicit weight returns to BYLAYER', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-23T00:00:00Z',
      modified_at: '2026-03-23T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        name: 'weighted-line',
        line_weight: 0.35,
        color: 0xffffff,
        color_source: 'BYLAYER',
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  doc.updateEntity(1, { lineWeight: 0, lineWeightSource: 'BYLAYER' });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(Object.prototype.hasOwnProperty.call(outLine || {}, 'line_weight'), false);
});

test('cadgf adapter preserves explicit zero line_weight', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-23T00:00:00Z',
      modified_at: '2026-03-23T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 7, name: 'A-WALL', color: 0x00ff00, line_weight: 0.35, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 7,
        name: 'zero-weight',
        line_weight: 0,
        color: 0x00ff00,
        color_source: 'BYLAYER',
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const line = doc.getEntity(1);
  assert.equal(line?.lineWeight, 0);
  assert.equal(line?.lineWeightSource, 'EXPLICIT');

  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outLine?.line_weight, 0);
});

test('cadgf adapter imports color provenance and exports explicit color edits', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-22T00:00:00Z',
      modified_at: '2026-03-22T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 7, name: 'A-WALL', color: 0x00ff00, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 7,
        name: 'line-colored',
        color: 0x00ff00,
        color_source: 'BYLAYER',
        color_aci: 3,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const line = doc.getEntity(1);
  assert.equal(line?.color, '#00ff00');
  assert.equal(line?.colorSource, 'BYLAYER');
  assert.equal(line?.colorAci, 3);

  doc.updateEntity(1, { color: '#abcdef', colorSource: 'TRUECOLOR', colorAci: null });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outLine?.color_source, 'TRUECOLOR');
  assert.equal(outLine?.color, 0xabcdef);
  assert.equal(outLine?.color_aci, 0);
});

test('cadgf adapter clears stale color_aci when explicit color returns to BYLAYER', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-23T00:00:00Z',
      modified_at: '2026-03-23T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 7, name: 'A-WALL', color: 0xff0000, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 7,
        name: 'line-colored',
        color: 0x112233,
        color_source: 'TRUECOLOR',
        color_aci: 5,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  doc.updateEntity(1, { color: '#ff0000', colorSource: 'BYLAYER', colorAci: null });
  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outLine?.color_source, 'BYLAYER');
  assert.equal(outLine?.color, 0xff0000);
  assert.equal(Object.prototype.hasOwnProperty.call(outLine || {}, 'color_aci'), false);
});

test('cadgf adapter exports in-place dimension text proxy overrides with synced dim text metadata', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-23T00:00:00Z',
      modified_at: '2026-03-23T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 1, name: 'ANNOTATION', color: 0x808080, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 24,
        type: 7,
        layer_id: 1,
        name: 'dim-text',
        color: 0x808080,
        color_source: 'BYLAYER',
        source_type: 'DIMENSION',
        edit_mode: 'proxy',
        proxy_kind: 'dimension',
        group_id: 700,
        dim_type: 0,
        dim_style: 'STANDARD',
        dim_text_pos: [0, 14],
        dim_text_rotation: 0,
        space: 1,
        layout: 'Layout-A',
        text: {
          pos: [0, 14],
          h: 2.5,
          rot: 0,
          value: '42',
        },
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const document = new DocumentState();
  document.restore(imported.docSnapshot);
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  const ctx = { document, selection, snap, viewport, commandBus: null };
  const bus = new CommandBus(ctx);
  registerCadCommands(bus, ctx);

  selection.setSelection([24], 24);
  const patch = bus.execute('selection.propertyPatch', {
    patch: {
      value: 'DIM_EDITED',
      position: { x: 3, y: 18 },
      rotation: Math.PI / 8,
    },
  });
  assert.equal(patch.ok, true);

  const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
  const outText = exported.entities.find((entity) => entity.id === 24);
  assert.equal(outText?.source_type, 'DIMENSION');
  assert.equal(outText?.edit_mode, 'proxy');
  assert.equal(outText?.proxy_kind, 'dimension');
  assert.deepEqual(outText?.dim_text_pos, [3, 18]);
  approxEqual(outText?.dim_text_rotation, Math.PI / 8);
  assert.equal(outText?.text?.value, 'DIM_EDITED');
  assert.deepEqual(outText?.text?.pos, [3, 18]);
  approxEqual(outText?.text?.rot, Math.PI / 8);
});

test('exportCadgfDocument emits explicit color provenance for editor-created entities', () => {
  const doc = new DocumentState();
  doc.addEntity({
    type: 'line',
    layerId: 0,
    color: '#abcdef',
    start: { x: 0, y: 0 },
    end: { x: 5, y: 0 },
  });

  const exported = exportCadgfDocument(doc);
  const outLine = exported.entities.find((entity) => entity.id === 1);
  assert.equal(outLine?.color_source, 'TRUECOLOR');
  assert.equal(outLine?.color, 0xabcdef);
  assert.equal(outLine?.color_aci, 0);
});

test('exportCadgfDocument preserves BYLAYER color when an entity is reassigned to another layer', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-03-22T00:00:00Z',
      modified_at: '2026-03-22T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 1, name: 'PLOT', color: 0x808080, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
      { id: 2, name: 'REDLINE', color: 0xff0000, visible: 1, locked: 0, printable: 0, frozen: 0, construction: 1 },
    ],
    entities: [
      {
        id: 7,
        type: 2,
        layer_id: 1,
        name: 'selection-summary-line',
        color: 0x808080,
        color_source: 'BYLAYER',
        color_aci: 8,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  const imported = importCadgfDocument(fixture);
  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  doc.updateEntity(7, { layerId: 2 });

  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const outLine = exported.entities.find((entity) => entity.id === 7);
  assert.equal(outLine?.layer_id, 2);
  assert.equal(outLine?.color_source, 'BYLAYER');
  assert.equal(outLine?.color, 0xff0000);
  assert.equal(outLine?.color_aci, 8);
});

test('cadgf adapter assigns display_proxy for unsupported point/ellipse/spline', () => {
  const fixture = {
    cadgf_version: '1.0',
    schema_version: 1,
    feature_flags: { earcut: true, clipper2: true },
    metadata: {
      label: 'fixture',
      author: 'test',
      company: '',
      comment: '',
      created_at: '2026-02-21T00:00:00Z',
      modified_at: '2026-02-21T00:00:00Z',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      { id: 10, type: 1, layer_id: 0, name: 'pt', point: [1, 2] },
      { id: 11, type: 5, layer_id: 0, name: 'el', ellipse: { c: [5, 6], rx: 2, ry: 1, rot: 0.2, a0: 0, a1: Math.PI * 2 } },
      { id: 12, type: 6, layer_id: 0, name: 'sp', spline: { degree: 2, control: [[0, 0], [2, 1], [4, 0]], knots: [0, 0, 0, 1, 1, 1] } },
    ],
  };

  const imported = importCadgfDocument(fixture);
  assert.equal(imported.warnings.length, 3);

  const doc = new DocumentState();
  doc.restore(imported.docSnapshot);

  const pointProxy = doc.getEntity(10);
  assert.equal(pointProxy.type, 'unsupported');
  assert.equal(pointProxy.readOnly, true);
  assert.equal(pointProxy.display_proxy?.kind, 'point');
  assert.equal(pointProxy.visible, true);

  const ellipseProxy = doc.getEntity(11);
  assert.equal(ellipseProxy.type, 'unsupported');
  assert.equal(ellipseProxy.display_proxy?.kind, 'ellipse');
  assert.equal(ellipseProxy.visible, true);

  const splineProxy = doc.getEntity(12);
  assert.equal(splineProxy.type, 'unsupported');
  assert.equal(splineProxy.display_proxy?.kind, 'polyline');
  assert.equal(splineProxy.visible, true);
  assert.equal(doc.listDisplayProxyEntities().length, 3);

  const exported = exportCadgfDocument(doc, { baseCadgfJson: imported.baseCadgfJson });
  const ids = exported.entities.map((entity) => entity.id);
  assert.deepEqual(ids, [10, 11, 12]);
  assert.equal(exported.entities.find((entity) => entity.id === 10)?.type, 1);
  assert.equal(exported.entities.find((entity) => entity.id === 11)?.type, 5);
  assert.equal(exported.entities.find((entity) => entity.id === 12)?.type, 6);
});

test('tool context picks visible unsupported display proxies', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  viewport.zoom = 1;

  document.addEntity({
    id: 1,
    type: 'unsupported',
    layerId: 0,
    readOnly: true,
    display_proxy: {
      kind: 'polyline',
      points: [{ x: 0, y: 0 }, { x: 12, y: 0 }],
    },
    cadgf: { id: 1, type: 6, spline: { control: [[0, 0], [12, 0]] } },
  });
  document.addEntity({
    id: 2,
    type: 'unsupported',
    layerId: 0,
    readOnly: true,
    display_proxy: {
      kind: 'ellipse',
      center: { x: 30, y: 10 },
      rx: 4,
      ry: 2,
      rotation: 0,
      startAngle: 0,
      endAngle: Math.PI * 2,
    },
    cadgf: { id: 2, type: 5, ellipse: { c: [30, 10], rx: 4, ry: 2, rot: 0, a0: 0, a1: Math.PI * 2 } },
  });

  const context = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
    canvasView: null,
    setStatus() {},
    readCommandInput() { return {}; },
  });

  const proxyLine = document.getEntity(1);
  const proxyEllipse = document.getEntity(2);
  assert.equal(proxyLine.visible, true);
  assert.equal(proxyEllipse.visible, true);

  const hitLine = context.pickEntityAt({ x: 6, y: 0 }, 10);
  assert.equal(hitLine?.id, 1);

  const hitEllipse = context.pickEntityAt({ x: 34, y: 10 }, 10);
  assert.equal(hitEllipse?.id, 2);

  document.updateLayer(0, { visible: false });
  const hiddenHit = context.pickEntityAt({ x: 6, y: 0 }, 10);
  assert.equal(hiddenHit, null);
});

test('selection.trim on polyline removes picked side (cad-like)', () => {
  const { document, selection, bus } = setup();

  // boundary: vertical line at x=12
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 12, y: -5 }, end: { x: 12, y: 5 }, layerId: 0 },
  });

  // target: polyline (0,0) -> (10,0) -> (20,0)
  bus.execute('entity.create', {
    entity: {
      type: 'polyline',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
      closed: false,
      layerId: 0,
    },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 18, y: 0 },
  });
  assert.equal(res.ok, true);

  const poly = document.getEntity(2);
  assert.equal(poly.type, 'polyline');
  assert.equal(poly.points.length, 3);
  approxEqual(poly.points[2].x, 12);
  approxEqual(poly.points[2].y, 0);
});

test('selection.trim on polyline can split into 2 polylines', () => {
  const { document, selection, bus } = setup();

  // boundaries: x=10 and x=20
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: -5 }, end: { x: 10, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: -5 }, end: { x: 20, y: 5 }, layerId: 0 },
  });

  // target polyline: (0,0) -> (30,0)
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], closed: false, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.trim', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 15, y: 0 },
  });
  assert.equal(res.ok, true);

  const polylines = document.listEntities().filter((e) => e.type === 'polyline');
  assert.equal(polylines.length, 2);
  const left = document.getEntity(3);
  assert.equal(left.type, 'polyline');
  assert.deepEqual(left.points, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);

  const right = polylines.find((e) => e.id !== 3);
  assert.ok(right);
  assert.deepEqual(right.points, [{ x: 20, y: 0 }, { x: 30, y: 0 }]);

  assert.ok(selection.entityIds.includes(3));
  assert.ok(selection.entityIds.includes(right.id));
});

test('selection.propertyPatch can insert polyline vertex and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, layerId: 0 },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      points: [{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }],
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  assert.equal(document.getEntity(1).points.length, 3);

  bus.execute('history.undo');
  assert.equal(document.getEntity(1).points.length, 2);

  bus.execute('history.redo');
  assert.equal(document.getEntity(1).points.length, 3);
});

test('selection.propertyPatch updates line style fields and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      lineType: 'CENTER',
      lineWeight: 0.35,
      lineWeightSource: 'EXPLICIT',
      lineTypeScale: 0.25,
      lineTypeScaleSource: 'EXPLICIT',
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      lineType: 'DASHED',
      lineWeight: 0.6,
      lineTypeScale: 1.5,
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  let line = document.getEntity(1);
  assert.equal(line.lineType, 'DASHED');
  assert.equal(line.lineWeight, 0.6);
  assert.equal(line.lineWeightSource, 'EXPLICIT');
  assert.equal(line.lineTypeScale, 1.5);
  assert.equal(line.lineTypeScaleSource, 'EXPLICIT');

  bus.execute('history.undo');
  line = document.getEntity(1);
  assert.equal(line.lineType, 'CENTER');
  assert.equal(line.lineWeight, 0.35);
  assert.equal(line.lineWeightSource, 'EXPLICIT');
  assert.equal(line.lineTypeScale, 0.25);
  assert.equal(line.lineTypeScaleSource, 'EXPLICIT');

  bus.execute('history.redo');
  line = document.getEntity(1);
  assert.equal(line.lineType, 'DASHED');
  assert.equal(line.lineWeight, 0.6);
  assert.equal(line.lineWeightSource, 'EXPLICIT');
  assert.equal(line.lineTypeScale, 1.5);
  assert.equal(line.lineTypeScaleSource, 'EXPLICIT');
});

test('selection.propertyPatch updates arc angles and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      cw: true,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      startAngle: Math.PI / 4,
      endAngle: Math.PI,
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  approxEqual(document.getEntity(1).startAngle, Math.PI / 4);
  approxEqual(document.getEntity(1).endAngle, Math.PI);

  bus.execute('history.undo');
  approxEqual(document.getEntity(1).startAngle, 0);
  approxEqual(document.getEntity(1).endAngle, Math.PI / 2);
});

test('selection.propertyPatch clamps arc radius and undo/redo', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      cw: true,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: {
      radius: 0,
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);
  approxEqual(document.getEntity(1).radius, 0.001);

  bus.execute('history.undo');
  approxEqual(document.getEntity(1).radius, 10);

  bus.execute('history.redo');
  approxEqual(document.getEntity(1).radius, 0.001);
});

test('selection.propertyPatch updates arc radius and preserves center/angles', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: {
      type: 'arc',
      center: { x: 3, y: 4 },
      radius: 10,
      startAngle: 0.1,
      endAngle: 2.2,
      cw: false,
      layerId: 0,
    },
  });
  selection.setSelection([1], 1);

  const res = bus.execute('selection.propertyPatch', {
    patch: { radius: 5 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const after = document.getEntity(1);
  approxEqual(after.radius, 5);
  approxEqual(after.center.x, 3);
  approxEqual(after.center.y, 4);
  approxEqual(after.startAngle, 0.1);
  approxEqual(after.endAngle, 2.2);
  assert.equal(after.cw, false);

  bus.execute('history.undo');
  const reverted = document.getEntity(1);
  approxEqual(reverted.radius, 10);
  approxEqual(reverted.center.x, 3);
  approxEqual(reverted.center.y, 4);
  approxEqual(reverted.startAngle, 0.1);
  approxEqual(reverted.endAngle, 2.2);

  bus.execute('history.redo');
  const redone = document.getEntity(1);
  approxEqual(redone.radius, 5);
});

test('selection.propertyPatch rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  const locked = document.addLayer('locked-prop-patch');
  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: locked.id,
    },
  });
  selection.setSelection([1], 1);
  document.updateLayer(locked.id, { locked: true });

  const res = bus.execute('selection.propertyPatch', {
    patch: { start: { x: 1, y: 1 } },
  });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');

  const after = document.getEntity(1);
  approxEqual(after.start.x, 0);
  approxEqual(after.start.y, 0);
  approxEqual(after.end.x, 10);
  approxEqual(after.end.y, 0);
});

test('selection.propertyPatch rejects moving entity off locked current layer', () => {
  const { document, selection, bus } = setup();

  const locked = document.addLayer('locked-source');
  const open = document.addLayer('open-target');
  bus.execute('entity.create', {
    entity: {
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: locked.id,
    },
  });
  selection.setSelection([1], 1);
  document.updateLayer(locked.id, { locked: true });

  const res = bus.execute('selection.propertyPatch', {
    patch: { layerId: open.id },
  });
  assert.equal(res.ok, false);
  assert.equal(res.changed, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');

  const after = document.getEntity(1);
  assert.equal(after.layerId, locked.id);
});

test('snap candidates include circle quadrants + arc endpoints', () => {
  const circle = { id: 1, type: 'circle', center: { x: 0, y: 0 }, radius: 10, visible: true };
  const arc = {
    id: 2,
    type: 'arc',
    center: { x: 0, y: 0 },
    radius: 10,
    startAngle: 0,
    endAngle: Math.PI / 2,
    cw: true,
    visible: true,
  };
  const opts = {
    endpoint: true,
    midpoint: false,
    quadrant: true,
    center: true,
    intersection: false,
  };

  const points = collectSnapCandidates([circle, arc], opts);
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const hasPoint = (kind, x, y) => points.some((p) => p.kind === kind && near(p.x, x) && near(p.y, y));
  assert.ok(hasPoint('CEN', 0, 0));

  // Circle quadrants: (10,0), (0,10), (-10,0), (0,-10)
  assert.ok(hasPoint('QUA', 10, 0));
  assert.ok(hasPoint('QUA', 0, 10));
  assert.ok(hasPoint('QUA', -10, 0));
  assert.ok(hasPoint('QUA', 0, -10));

  // Arc endpoints: (10,0) and (0,10)
  assert.ok(hasPoint('END', 10, 0));
  assert.ok(hasPoint('END', 0, 10));
});

test('intersection snap guard skips INT when too many segments', () => {
  const entities = [];
  for (let i = 0; i < 2500; i += 1) {
    entities.push({
      id: i + 1,
      type: 'line',
      start: { x: i, y: 0 },
      end: { x: i, y: 1 },
      layerId: 0,
      visible: true,
    });
  }
  const points = collectSnapCandidates(entities, {
    endpoint: false,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: true,
  });
  assert.equal(points.length, 0);
  assert.equal(points.some((p) => p.kind === 'INT'), false);
});

test('snap priority prefers END over QUA when close', () => {
  const source = { x: 0, y: 0 };
  const candidates = [
    { x: 0.02, y: 0, kind: 'QUA' },
    { x: 0.03, y: 0, kind: 'END' },
  ];
  const picked = findNearestPoint(source, candidates, 1);
  assert.equal(picked.kind, 'END');

  const far = [
    { x: 0.01, y: 0, kind: 'QUA' },
    { x: 0.6, y: 0, kind: 'END' },
  ];
  const pickedFar = findNearestPoint(source, far, 1);
  assert.equal(pickedFar.kind, 'QUA');
});

test('resolveSnappedPoint supports tangent and nearest snaps', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState({
    endpoint: false,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: false,
    nearest: true,
    tangent: true,
    grid: false,
    snapRadiusPx: 50,
  });
  const viewport = new ViewState();
  viewport.zoom = 1;

  document.addEntity({ id: 1, type: 'circle', center: { x: 0, y: 0 }, radius: 10, layerId: 0, visible: true });
  document.addEntity({ id: 2, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0, visible: true });

  const ctx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
    canvasView: { setTransientOverlay() {} },
    setStatus() {},
    readCommandInput() { return {}; },
  });

  // Tangent from (20,0) to circle r=10 yields points ~ (5, +/-8.6603).
  const tan = ctx.resolveSnappedPoint({ x: 5.05, y: 8.7 }, { tangentFrom: { x: 20, y: 0 } });
  assert.equal(tan.kind, 'TAN');
  approxEqual(tan.point.x, 5, 1e-2);
  approxEqual(tan.point.y, 8.660254, 1e-2);

  // Nearest point on the line to (3,1) is (3,0). (Circle is farther for this query point.)
  const nea = ctx.resolveSnappedPoint({ x: 3, y: 1 }, {});
  assert.equal(nea.kind, 'NEA');
  approxEqual(nea.point.x, 3, 1e-6);
  approxEqual(nea.point.y, 0, 1e-6);
});

test('selection.extend supports multiple boundaries and picks nearest valid hit', () => {
  const { document, selection, bus } = setup();

  // boundary A: x=15, boundary B: x=25
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 25, y: -5 }, end: { x: 25, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.extend', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 10.2, y: 0.1 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const line = document.getEntity(3);
  assert.equal(line.type, 'line');
  approxEqual(line.end.x, 15);
  approxEqual(line.end.y, 0);
});

test('selection.trim supports multiple boundaries and trims toward nearest pick-side hit', () => {
  const { document, selection, bus } = setup();

  // boundaries at x=3 and x=7
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 3, y: -5 }, end: { x: 3, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 7, y: -5 }, end: { x: 7, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([3], 3);
  const res = bus.execute('selection.trim', {
    boundaryIds: [1, 2],
    targetId: 3,
    pick: { x: 9, y: 0.2 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.changed, true);

  const line = document.getEntity(3);
  assert.equal(line.type, 'line');
  approxEqual(line.start.x, 0);
  approxEqual(line.end.x, 7);
});

test('selection.extend rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  const locked = document.addLayer('locked-test');
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: locked.id },
  });
  document.updateLayer(locked.id, { locked: true });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10.2, y: 0.2 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
});

test('selection.trim rejects locked target layer', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 15, y: -5 }, end: { x: 15, y: 5 }, layerId: 0 },
  });
  const locked = document.addLayer('locked-trim');
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: locked.id },
  });
  document.updateLayer(locked.id, { locked: true });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 8.5, y: 0.2 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'LAYER_LOCKED');
});

test('selection.trim rejects boundary without line segments', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'text', position: { x: 2, y: 2 }, value: 'B', height: 2, rotation: 0, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.trim', {
    boundaryId: 2,
    targetId: 1,
    pick: { x: 8, y: 0.1 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'TRIM_BOUNDARY_EMPTY');
});

test('selection.extend rejects boundary without line segments', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'text', position: { x: 2, y: 2 }, value: 'B', height: 2, rotation: 0, layerId: 0 },
  });

  selection.setSelection([1], 1);
  const res = bus.execute('selection.extend', {
    boundaryId: 2,
    targetId: 1,
    pick: { x: 9.5, y: 0.1 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'EXTEND_BOUNDARY_EMPTY');
});

test('selection.extend returns no-intersection on disjoint boundaries', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 50 }, end: { x: 10, y: 50 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 10, y: 0 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'EXTEND_NO_INTERSECTION');
});

test('selection.extend on polyline succeeds after a prior no-intersection failure', () => {
  const { document, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 20, y: -10 }, end: { x: 20, y: 10 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: 28, y: -2 }, { x: 28, y: 4 }], closed: false, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'polyline', points: [{ x: -10, y: -6 }, { x: 4, y: -6 }], closed: false, layerId: 0 },
  });

  const failRes = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 28.5, y: 1 },
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.error_code, 'EXTEND_NO_INTERSECTION');

  const okRes = bus.execute('selection.extend', {
    boundaryId: 1,
    targetId: 3,
    pick: { x: 4.5, y: -5.9 },
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.changed, true);

  const failPoly = document.getEntity(2);
  const okPoly = document.getEntity(3);
  assert.equal(failPoly.type, 'polyline');
  assert.equal(okPoly.type, 'polyline');
  approxEqual(failPoly.points[failPoly.points.length - 1].x, 28);
  approxEqual(okPoly.points[okPoly.points.length - 1].x, 20);
  approxEqual(okPoly.points[okPoly.points.length - 1].y, -6);
});

test('selection.trim returns no-intersection on disjoint boundaries', () => {
  const { document, selection, bus } = setup();

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: -10, y: 50 }, end: { x: 10, y: 50 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });

  selection.setSelection([2], 2);
  const res = bus.execute('selection.trim', {
    boundaryId: 1,
    targetId: 2,
    pick: { x: 8, y: 0 },
  });
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'TRIM_NO_INTERSECTION');
});

test('selection.box excludes hidden-layer entities and restores after layer show', () => {
  const { document, selection, bus } = setup();
  const l1 = document.addLayer('L1');

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 3 }, end: { x: 10, y: 3 }, layerId: l1.id },
  });

  const rect = { x0: -2, y0: -2, x1: 12, y1: 6 };

  document.updateLayer(0, { visible: false });
  let res = bus.execute('selection.box', { rect, crossing: false });
  assert.equal(res.ok, true);
  assert.deepEqual(selection.entityIds, [2]);
  assert.equal(selection.primaryId, 2);

  document.updateLayer(0, { visible: true });
  res = bus.execute('selection.box', { rect, crossing: false });
  assert.equal(res.ok, true);
  assert.deepEqual(selection.entityIds, [1, 2]);
  assert.equal(selection.primaryId, 1);
});

test('selection.box excludes frozen-layer entities and restores after thaw', () => {
  const { document, selection, bus } = setup();
  const l1 = document.addLayer('L1');

  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 3 }, end: { x: 10, y: 3 }, layerId: l1.id },
  });

  const rect = { x0: -2, y0: -2, x1: 12, y1: 6 };

  document.updateLayer(l1.id, { frozen: true });
  let res = bus.execute('selection.box', { rect, crossing: false });
  assert.equal(res.ok, true);
  assert.deepEqual(selection.entityIds, [1]);
  assert.equal(selection.primaryId, 1);

  document.updateLayer(l1.id, { frozen: false });
  res = bus.execute('selection.box', { rect, crossing: false });
  assert.equal(res.ok, true);
  assert.deepEqual(selection.entityIds, [1, 2]);
  assert.equal(selection.primaryId, 1);
});

function createToolHarness(toolFactory) {
  const overlays = [];
  const status = [];
  const commands = [];
  const pickQueue = [];

  const ctx = {
    canvasView: {
      setTransientOverlay(name, payload) {
        overlays.push({ name, payload });
      },
    },
    setStatus(message) {
      status.push(message);
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = (id, { shiftKey = false } = {}) => {
    pickQueue.push(id == null ? null : { id });
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x: id == null ? 0 : id, y: 0 },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { overlays, status, commands, pointer, esc };
}

function createToolHarnessWithResults(toolFactory, results = []) {
  const overlayState = {};
  const overlayCalls = [];
  const status = [];
  const commands = [];
  const pickQueue = [];
  const resultQueue = results.map((r) => ({ ...r }));

  const ctx = {
    canvasView: {
      setTransientOverlay(name, payload) {
        overlayCalls.push({ name, payload });
        if (payload == null) {
          delete overlayState[name];
        } else {
          overlayState[name] = payload;
        }
      },
    },
    setStatus(message) {
      status.push(message);
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        const next = resultQueue.length > 0 ? resultQueue.shift() : null;
        return next || { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = (id, { shiftKey = false } = {}) => {
    pickQueue.push(id == null ? null : { id });
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x: id == null ? 0 : id, y: 0 },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { overlayState, overlayCalls, status, commands, pointer, esc };
}

function createBreakToolHarness({ initialSelection = [], toolOptions = null, entityById = null } = {}) {
  const status = [];
  const commands = [];
  const pickQueue = [];

  const selection = {
    entityIds: [...initialSelection],
    primaryId: initialSelection.length > 0 ? initialSelection[0] : null,
    setSelection(ids, primaryId) {
      this.entityIds = [...(ids || [])];
      this.primaryId = primaryId ?? (this.entityIds.length > 0 ? this.entityIds[0] : null);
    },
    clear() {
      this.entityIds = [];
      this.primaryId = null;
    },
  };

  const ctx = {
    document: {
      getEntity(id) {
        if (entityById && Object.prototype.hasOwnProperty.call(entityById, id)) {
          return entityById[id];
        }
        return null;
      },
    },
    toolOptions,
    selection,
    setStatus(message) {
      status.push(message);
    },
    resolveSnappedPoint(worldPoint) {
      return { point: { x: worldPoint.x, y: worldPoint.y }, snapped: false, kind: 'NONE' };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = createBreakTool(ctx);
  tool.activate();

  const pointer = ({ hitId = null, x = 0, y = 0, shiftKey = false } = {}) => {
    if (hitId != null) {
      pickQueue.push({ id: hitId });
    }
    tool.onPointerDown({
      button: 0,
      shiftKey,
      world: { x, y },
    });
  };

  const esc = () => {
    tool.onKeyDown({ key: 'Escape' });
  };

  return { status, commands, selection, pointer, esc };
}

function createTwoLinePickToolHarness(toolFactory, {
  commandArgs = [],
  entityTypeById = null,
  entityById = null,
  initialSelection = [],
  commandResults = [],
} = {}) {
  const status = [];
  const commands = [];
  const pickQueue = [];
  const resultQueue = commandResults.map((item) => ({ ...item }));

  const selection = {
    entityIds: [...initialSelection],
    primaryId: initialSelection.length > 0 ? initialSelection[0] : null,
    setSelection(ids, primaryId) {
      this.entityIds = [...(ids || [])];
      this.primaryId = primaryId ?? (this.entityIds.length > 0 ? this.entityIds[0] : null);
    },
    clear() {
      this.entityIds = [];
      this.primaryId = null;
    },
  };

  const ctx = {
    document: {
      getEntity(id) {
        if (entityById && Object.prototype.hasOwnProperty.call(entityById, id)) {
          const entity = entityById[id];
          return entity == null ? null : { id, layerId: 0, ...entity };
        }
        const override = entityTypeById && Object.prototype.hasOwnProperty.call(entityTypeById, id)
          ? entityTypeById[id]
          : null;
        const type = typeof override === 'string' ? override : 'line';
        if (type === 'polyline') {
          return {
            id,
            type: 'polyline',
            layerId: 0,
            closed: false,
            points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          };
        }
        if (type === 'arc') {
          return {
            id,
            type: 'arc',
            layerId: 0,
            center: { x: 0, y: 0 },
            radius: 1,
            startAngle: 0,
            endAngle: Math.PI / 2,
            cw: false,
          };
        }
        if (type === 'circle') {
          return {
            id,
            type: 'circle',
            layerId: 0,
            center: { x: 0, y: 0 },
            radius: 1,
          };
        }
        return { id, type: 'line', layerId: 0, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
      },
      getLayer() {
        return { locked: false };
      },
    },
    selection,
    setStatus(message) {
      status.push(message);
    },
    readCommandInput() {
      return { verb: '', args: [...commandArgs] };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        if (resultQueue.length > 0) {
          return resultQueue.shift();
        }
        return { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = toolFactory(ctx);
  tool.activate();

  const pointer = ({ hitId = null, x = 0, y = 0 } = {}) => {
    pickQueue.push(hitId == null ? null : { id: hitId });
    tool.onPointerDown({
      button: 0,
      world: { x, y },
    });
  };

  const esc = () => tool.onKeyDown({ key: 'Escape' });

  return { status, commands, selection, pointer, esc };
}

function createJoinToolHarness({ commandInput = { verb: 'join', args: [] }, commandResults = [] } = {}) {
  const status = [];
  const commands = [];
  const pickQueue = [];
  const resultQueue = commandResults.map((item) => ({ ...item }));

  const selection = {
    entityIds: [],
    primaryId: null,
    setSelection(ids, primaryId) {
      this.entityIds = [...new Set((ids || []).filter((id) => Number.isFinite(id)).map((id) => Number(id)))];
      this.primaryId = Number.isFinite(primaryId) ? Number(primaryId) : (this.entityIds[0] ?? null);
    },
    add(id) {
      if (!Number.isFinite(id)) return;
      const numeric = Number(id);
      if (!this.entityIds.includes(numeric)) this.entityIds.push(numeric);
      this.primaryId = numeric;
    },
    toggle(id) {
      if (!Number.isFinite(id)) return;
      const numeric = Number(id);
      if (this.entityIds.includes(numeric)) {
        this.entityIds = this.entityIds.filter((value) => value !== numeric);
        if (this.primaryId === numeric) this.primaryId = this.entityIds[0] ?? null;
        return;
      }
      this.entityIds.push(numeric);
      this.primaryId = numeric;
    },
    clear() {
      this.entityIds = [];
      this.primaryId = null;
    },
  };

  const ctx = {
    selection,
    setStatus(message) {
      status.push(message);
    },
    readCommandInput() {
      return { ...commandInput, args: Array.isArray(commandInput?.args) ? [...commandInput.args] : [] };
    },
    commandBus: {
      execute(id, payload) {
        commands.push({
          id,
          payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)),
        });
        const next = resultQueue.length > 0 ? resultQueue.shift() : null;
        return next || { ok: true, changed: true, message: `${id}:ok` };
      },
    },
    pickEntityAt() {
      return pickQueue.length > 0 ? pickQueue.shift() : null;
    },
  };

  const tool = createJoinTool(ctx);
  tool.activate();

  const pointer = ({
    hitId = null,
    button = 0,
    shiftKey = false,
    ctrlKey = false,
  } = {}) => {
    if (button === 0) {
      pickQueue.push(hitId == null ? null : { id: hitId });
    }
    tool.onPointerDown({
      button,
      shiftKey,
      ctrlKey,
      altKey: false,
      world: { x: hitId == null ? 0 : hitId, y: 0 },
    });
  };

  const key = (value) => tool.onKeyDown({ key: value, preventDefault() {} });

  return { status, commands, selection, pointer, key };
}

function createOverlayHarness() {
  const overlays = {};
  const calls = [];
  return {
    overlays,
    calls,
    canvasView: {
      setTransientOverlay(name, payload) {
        calls.push({ name, payload });
        if (payload == null) {
          delete overlays[name];
        } else {
          overlays[name] = payload;
        }
      },
    },
  };
}

function createSelectGripHarness(entity) {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState({
    endpoint: false,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: false,
    nearest: false,
    tangent: false,
    grid: false,
  });
  const viewport = new ViewState();
  const commandContext = { document, selection, snap, viewport, commandBus: null };
  const bus = new CommandBus(commandContext);
  registerCadCommands(bus, commandContext);
  commandContext.commandBus = bus;

  bus.execute('entity.create', {
    entity: { ...entity, layerId: Number.isFinite(entity?.layerId) ? Number(entity.layerId) : 0 },
  });
  selection.setSelection([1], 1);

  const overlays = createOverlayHarness();
  const status = [];
  const ctx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: bus,
    canvasView: overlays.canvasView,
    setStatus(message) {
      status.push(String(message || ''));
    },
    readCommandInput() { return {}; },
  });

  const tool = createSelectTool(ctx);
  tool.activate();

  function eventAt(world, extra = {}) {
    const screen = viewport.worldToScreen(world);
    return {
      button: 0,
      world: { x: world.x, y: world.y },
      screen: { x: screen.x, y: screen.y },
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      detail: 1,
      ...extra,
    };
  }

  return { document, selection, bus, tool, status, eventAt };
}

test('select tool: grip hover coexists with snap hint and is stable with small jitter', () => {
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState({
    endpoint: true,
    midpoint: false,
    quadrant: false,
    center: false,
    intersection: false,
    nearest: false,
    tangent: false,
    grid: false,
    snapRadiusPx: 20,
  });
  const viewport = new ViewState();
  viewport.zoom = 1;

  document.addEntity({
    id: 1,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    layerId: 0,
    visible: true,
  });
  selection.setSelection([1], 1);

  const overlays = createOverlayHarness();
  const ctx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
    canvasView: overlays.canvasView,
    setStatus() {},
    readCommandInput() { return {}; },
  });

  const tool = createSelectTool(ctx);
  tool.activate();

  const gripWorld = { x: 0, y: 0 };
  const gripScreen = viewport.worldToScreen(gripWorld);

  tool.onPointerMove({
    world: { x: 0.02, y: 0.01 },
    screen: { x: gripScreen.x, y: gripScreen.y },
  });
  assert.ok(overlays.overlays.snapHint, 'expected snapHint overlay');
  assert.ok(overlays.overlays.gripHover, 'expected gripHover overlay');

  // Move slightly outside enter tolerance (10px) but within exit tolerance (14px).
  tool.onPointerMove({
    world: { x: 0.02, y: 0.01 },
    screen: { x: gripScreen.x + 12, y: gripScreen.y },
  });
  assert.ok(overlays.overlays.gripHover, 'expected gripHover to remain with hysteresis');
});

test('select tool: polyline midpoint grip inserts vertex and supports undo/redo', () => {
  const h = createSelectGripHarness({
    type: 'polyline',
    closed: false,
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  });

  const mid = { x: 5, y: 0 };
  h.tool.onPointerDown(h.eventAt(mid));
  h.tool.onPointerUp(h.eventAt(mid));

  const after = h.document.getEntity(1);
  assert.equal(after.type, 'polyline');
  assert.equal(after.points.length, 3);
  approxEqual(after.points[1].x, 5);
  approxEqual(after.points[1].y, 0);

  h.bus.execute('history.undo');
  assert.equal(h.document.getEntity(1).points.length, 2);

  h.bus.execute('history.redo');
  assert.equal(h.document.getEntity(1).points.length, 3);
});

test('select tool: double-click polyline vertex deletes vertex and supports undo/redo', () => {
  const h = createSelectGripHarness({
    type: 'polyline',
    closed: false,
    points: [{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }],
  });

  const vertex = { x: 5, y: 2 };
  h.tool.onPointerDown(h.eventAt(vertex, { detail: 2 }));

  const after = h.document.getEntity(1);
  assert.equal(after.type, 'polyline');
  assert.equal(after.points.length, 2);

  h.bus.execute('history.undo');
  assert.equal(h.document.getEntity(1).points.length, 3);

  h.bus.execute('history.redo');
  assert.equal(h.document.getEntity(1).points.length, 2);
});

test('select tool: closed polyline midpoint on closing edge inserts vertex and supports undo/redo', () => {
  const h = createSelectGripHarness({
    type: 'polyline',
    closed: true,
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  });

  const closingMid = { x: 0, y: 5 };
  h.tool.onPointerDown(h.eventAt(closingMid));
  h.tool.onPointerUp(h.eventAt(closingMid));

  const after = h.document.getEntity(1);
  assert.equal(after.type, 'polyline');
  assert.equal(after.closed, true);
  assert.equal(after.points.length, 5);
  approxEqual(after.points[4].x, 0);
  approxEqual(after.points[4].y, 5);

  h.bus.execute('history.undo');
  assert.equal(h.document.getEntity(1).points.length, 4);

  h.bus.execute('history.redo');
  assert.equal(h.document.getEntity(1).points.length, 5);
});

test('select tool: closed polyline vertex delete allowed above minimum and supports undo/redo', () => {
  const h = createSelectGripHarness({
    type: 'polyline',
    closed: true,
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  });

  h.tool.onPointerDown(h.eventAt({ x: 10, y: 0 }, { detail: 2 }));
  const after = h.document.getEntity(1);
  assert.equal(after.type, 'polyline');
  assert.equal(after.closed, true);
  assert.equal(after.points.length, 3);

  h.bus.execute('history.undo');
  assert.equal(h.document.getEntity(1).points.length, 4);

  h.bus.execute('history.redo');
  assert.equal(h.document.getEntity(1).points.length, 3);
});

test('select tool: closed polyline vertex delete is blocked at minimum vertices', () => {
  const h = createSelectGripHarness({
    type: 'polyline',
    closed: true,
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }],
  });

  h.tool.onPointerDown(h.eventAt({ x: 10, y: 0 }, { detail: 2 }));
  const after = h.document.getEntity(1);
  assert.equal(after.type, 'polyline');
  assert.equal(after.closed, true);
  assert.equal(after.points.length, 3);
  assert.ok(h.status.some((msg) => msg.includes('Vertex delete blocked')));
});

test('select tool: arc radius grip updates radius and supports undo/redo', () => {
  const startAngle = 0;
  const endAngle = Math.PI / 2;
  const baseRadius = 5;
  const targetRadius = 8;
  const midAngle = (startAngle + endAngle) * 0.5;

  const h = createSelectGripHarness({
    type: 'arc',
    center: { x: 0, y: 0 },
    radius: baseRadius,
    startAngle,
    endAngle,
    cw: true,
  });

  const gripPoint = {
    x: Math.cos(midAngle) * baseRadius,
    y: Math.sin(midAngle) * baseRadius,
  };
  const dragTarget = {
    x: Math.cos(midAngle) * targetRadius,
    y: Math.sin(midAngle) * targetRadius,
  };

  h.tool.onPointerDown(h.eventAt(gripPoint));
  h.tool.onPointerMove(h.eventAt(dragTarget));
  h.tool.onPointerUp(h.eventAt(dragTarget));

  const after = h.document.getEntity(1);
  assert.equal(after.type, 'arc');
  approxEqual(after.center.x, 0);
  approxEqual(after.center.y, 0);
  approxEqual(after.startAngle, startAngle);
  approxEqual(after.endAngle, endAngle);
  approxEqual(after.radius, targetRadius, 1e-3);

  h.bus.execute('history.undo');
  approxEqual(h.document.getEntity(1).radius, baseRadius, 1e-3);

  h.bus.execute('history.redo');
  approxEqual(h.document.getEntity(1).radius, targetRadius, 1e-3);
});

test('trim tool keeps boundaries for continuous targets and resets on Escape', () => {
  const h = createToolHarness(createTrimTool);

  // choose boundary #10
  h.pointer(10);
  // target #20
  h.pointer(20);
  // target #21 without reselecting boundary
  h.pointer(21);
  // add second boundary with shift
  h.pointer(11, { shiftKey: true });
  // target #22 should use both boundaries
  h.pointer(22);

  assert.equal(h.commands.length, 3);
  assert.deepEqual(h.commands[0], {
    id: 'selection.trim',
    payload: { boundaryIds: [10], targetId: 20, pick: { x: 20, y: 0 } },
  });
  assert.deepEqual(h.commands[1], {
    id: 'selection.trim',
    payload: { boundaryIds: [10], targetId: 21, pick: { x: 21, y: 0 } },
  });
  assert.deepEqual(h.commands[2], {
    id: 'selection.trim',
    payload: { boundaryIds: [10, 11], targetId: 22, pick: { x: 22, y: 0 } },
  });

  h.esc();
  const before = h.commands.length;
  // after reset, first click becomes boundary selection, not command execution
  h.pointer(23);
  assert.equal(h.commands.length, before);
});

test('extend tool keeps boundaries for continuous targets and resets on Escape', () => {
  const h = createToolHarness(createExtendTool);

  h.pointer(30);
  h.pointer(40);
  h.pointer(41);
  h.pointer(31, { shiftKey: true });
  h.pointer(42);

  assert.equal(h.commands.length, 3);
  assert.deepEqual(h.commands[0], {
    id: 'selection.extend',
    payload: { boundaryIds: [30], targetId: 40, pick: { x: 40, y: 0 } },
  });
  assert.deepEqual(h.commands[1], {
    id: 'selection.extend',
    payload: { boundaryIds: [30], targetId: 41, pick: { x: 41, y: 0 } },
  });
  assert.deepEqual(h.commands[2], {
    id: 'selection.extend',
    payload: { boundaryIds: [30, 31], targetId: 42, pick: { x: 42, y: 0 } },
  });

  h.esc();
  const before = h.commands.length;
  h.pointer(43);
  assert.equal(h.commands.length, before);
});

test('trim tool keeps boundaries after command failure and continues to next target', () => {
  const h = createToolHarnessWithResults(createTrimTool, [
    { ok: false, changed: false, error_code: 'LAYER_LOCKED', message: 'Layer locked' },
    { ok: true, changed: true, message: 'selection.trim:ok' },
  ]);

  h.pointer(10); // boundary
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint after boundary select');

  h.pointer(20); // target -> fail
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0].payload.boundaryIds, [10]);
  assert.ok(h.status.some((msg) => msg.includes('Layer locked')));

  // Boundaries should stay active for the next target.
  h.pointer(21); // target -> ok
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1].payload.boundaryIds, [10]);
  assert.ok(h.status.some((msg) => msg.includes('Trim applied')));
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint to remain after failure');

  h.esc();
  assert.ok(!h.overlayState.constraintHint, 'expected constraintHint cleared on Escape');
});

test('extend tool keeps boundaries after command failure and continues to next target', () => {
  const h = createToolHarnessWithResults(createExtendTool, [
    { ok: false, changed: false, error_code: 'EXTEND_NO_INTERSECTION', message: 'No extend intersection found' },
    { ok: true, changed: true, message: 'selection.extend:ok' },
  ]);

  h.pointer(30); // boundary
  assert.ok(h.overlayState.constraintHint, 'expected constraintHint after boundary select');

  h.pointer(40); // target -> fail
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0].payload.boundaryIds, [30]);
  assert.ok(h.status.some((msg) => msg.includes('No extend intersection found')));

  h.pointer(41); // target -> ok
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1].payload.boundaryIds, [30]);
  assert.ok(h.status.some((msg) => msg.includes('Extend applied')));

  h.esc();
  assert.ok(!h.overlayState.constraintHint, 'expected constraintHint cleared on Escape');
});

test('break tool supports two-point mode and Esc backs out without losing target', () => {
  const h = createBreakToolHarness();

  // pick target
  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.deepEqual(h.selection.entityIds, [10]);
  assert.equal(h.selection.primaryId, 10);

  // first break point (Shift+click enters two-point mode)
  h.pointer({ x: 3, y: 0, shiftKey: true });
  assert.equal(h.commands.length, 0);

  // Esc should cancel second-point stage but keep target selected
  h.esc();
  assert.deepEqual(h.selection.entityIds, [10]);

  // single-point break should now execute normally
  h.pointer({ x: 4, y: 0 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.break',
    payload: { targetId: 10, pick: { x: 4, y: 0 } },
  });

  // pick another target and run two-point break end-to-end
  h.pointer({ hitId: 11, x: 0, y: 0 });
  h.pointer({ x: 2, y: 0, shiftKey: true });
  h.pointer({ x: 8, y: 0 });
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1], {
    id: 'selection.break',
    payload: { targetId: 11, pick: { x: 2, y: 0 }, pick2: { x: 8, y: 0 } },
  });
});

test('break tool two-point closed polyline uses toolOptions.breakKeep override', () => {
  const h = createBreakToolHarness({
    toolOptions: { breakKeep: 'short' },
    entityById: {
      11: {
        id: 11,
        type: 'polyline',
        layerId: 0,
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    },
  });

  h.pointer({ hitId: 11, x: 0, y: 0 });
  h.pointer({ x: 2, y: 0, shiftKey: true });
  h.pointer({ x: 8, y: 0 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.break',
    payload: { targetId: 11, pick: { x: 2, y: 0 }, pick2: { x: 8, y: 0 }, keep: 'short' },
  });
});

test('join tool accumulates selection and executes selection.join with tolerance', () => {
  const h = createJoinToolHarness({ commandInput: { verb: 'join', args: ['0.25'] } });

  h.pointer({ hitId: 10 });
  h.pointer({ hitId: 11 });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
  assert.equal(h.selection.primaryId, 11);

  // Shift-click toggles selection membership.
  h.pointer({ hitId: 10, shiftKey: true });
  assert.deepEqual(h.selection.entityIds, [11]);

  h.pointer({ hitId: 10 });
  h.pointer({ button: 2 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.join',
    payload: { tolerance: 0.25 },
  });

  h.key('Escape');
  assert.deepEqual(h.selection.entityIds, []);
  assert.equal(h.selection.primaryId, null);
});

test('join tool applies default tolerance for toolbar-style runs without explicit command args', () => {
  const h = createJoinToolHarness({ commandInput: { verb: 'join', args: [] } });

  h.pointer({ hitId: 10 });
  h.pointer({ hitId: 11 });
  h.key('Enter');

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.join',
    payload: { tolerance: getDefaultJoinTolerance() },
  });
});

test('join tool surfaces fuzz guidance after NO_MATCH with default tolerance', () => {
  const h = createJoinToolHarness({
    commandInput: { verb: 'join', args: [] },
    commandResults: [
      {
        ok: false,
        changed: false,
        error_code: 'NO_MATCH',
        message: 'Join: unresolved endpoint matches (1 remaining)',
      },
    ],
  });

  h.pointer({ hitId: 10 });
  h.pointer({ hitId: 11 });
  h.key('Enter');

  assert.equal(h.commands.length, 1);
  assert.ok(h.status.some((message) => String(message).includes('[NO_MATCH]')));
  assert.ok(h.status.some((message) => String(message).includes('Increase join fuzz')));
});

test('fillet tool picks two lines and executes selection.filletByPick with radius from command input', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'] });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool allows picking two segments on the same polyline (same id)', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], entityTypeById: { 10: 'polyline' } });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  h.pointer({ hitId: 10, x: 10, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 10,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10]);
});

test('fillet tool picks line then circle and executes selection.filletByPick', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    entityTypeById: { 11: 'circle' },
  });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 3, y: 4 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 5, y: 0 },
      pick2: { x: 3, y: 4 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool picks circle then circle and executes selection.filletByPick', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    entityTypeById: { 10: 'circle', 11: 'circle' },
  });

  h.pointer({ hitId: 10, x: 3, y: 3 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 9, y: 3 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 3, y: 3 },
      pick2: { x: 9, y: 3 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool picks polyline then circle and executes selection.filletByPick', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    entityTypeById: { 10: 'polyline', 11: 'circle' },
  });

  h.pointer({ hitId: 10, x: 8, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: -3, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 8, y: 0 },
      pick2: { x: -3, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool falls back to single preselected target and keeps second-pick stage after a miss', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], initialSelection: [10] });

  // First click misses hit-test; tool remains in second-pick stage without mutating first-side pick.
  h.pointer({ hitId: null, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  // Second click also misses; tool should stay in pickSecond and not reset.
  h.pointer({ hitId: null, x: 99, y: 99 });
  assert.equal(h.commands.length, 0);
  // Third click executes using preselected entity with auto-resolved first-side pick.
  h.pointer({ hitId: 11, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool uses single preselected entity as first target when clicking second target directly', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], initialSelection: [10] });

  h.pointer({ hitId: 11, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool fast-path also applies when single selection is set after activation', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'] });
  h.selection.setSelection([10], 10);

  h.pointer({ hitId: 11, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool starts in second-pick mode with single preselection and accepts first-side click refinement', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], initialSelection: [10] });

  assert.ok(String(h.status.at(-1) || '').includes('Click second target'));
  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool uses single preselected circle as first target when clicking line directly', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    initialSelection: [10],
    entityById: {
      10: {
        type: 'circle',
        center: { x: 0, y: 0 },
        radius: 2,
      },
    },
  });

  h.pointer({ hitId: 11, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 2 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool projects curve picks in one-click mode with preselected circle-line pair', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    initialSelection: [10, 11],
    entityById: {
      10: {
        type: 'circle',
        center: { x: 0, y: 0 },
        radius: 2,
      },
      11: {
        type: 'line',
        start: { x: -5, y: 5 },
        end: { x: 5, y: 5 },
      },
    },
  });

  h.pointer({ hitId: 10, x: 0, y: 2 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 2 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool starts in one-click mode with two preselected targets', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], initialSelection: [10, 11] });

  assert.ok(String(h.status.at(-1) || '').toLowerCase().includes('either selected target'));
  h.pointer({ hitId: 10, x: 5, y: 0 });

  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0].id, 'selection.filletByPick');
  assert.equal(h.commands[0].payload.firstId, 10);
  assert.equal(h.commands[0].payload.secondId, 11);
  assert.equal(h.commands[0].payload.radius, 2);
  assert.ok(Number.isFinite(h.commands[0].payload.pick1?.x));
  assert.ok(Number.isFinite(h.commands[0].payload.pick1?.y));
  assert.ok(Number.isFinite(h.commands[0].payload.pick2?.x));
  assert.ok(Number.isFinite(h.commands[0].payload.pick2?.y));
  assert.deepEqual(h.selection.entityIds, [10, 11]);
});

test('fillet tool preselected polyline supports same-entity corner refinement in second-pick stage', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    initialSelection: [10],
    entityTypeById: { 10: 'polyline' },
  });

  assert.ok(String(h.status.at(-1) || '').includes('first side on selected polyline'));

  // First click on the same polyline refines first-side pick.
  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  assert.ok(String(h.status.at(-1) || '').includes('second side on selected polyline'));

  // Second click on another segment of the same polyline executes same-entity fillet.
  h.pointer({ hitId: 10, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 10,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      radius: 2,
    },
  });
  assert.deepEqual(h.selection.entityIds, [10]);
});

test('fillet tool preselected polyline executes same-entity corner when second hit falls back to selection', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    initialSelection: [10],
    entityTypeById: { 10: 'polyline' },
  });

  // First click refines first-side pick on the selected polyline.
  h.pointer({ hitId: 10, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);

  // Second click misses hit-test (fallback to selected id) but should still execute same-entity fillet.
  h.pointer({ hitId: null, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 10,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool preselection ignores fallback miss for first-side pick', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['2'], initialSelection: [10] });

  h.pointer({ hitId: null, x: 99, y: 99 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 11, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 11,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      radius: 2,
    },
  });
});

test('fillet tool preselected polyline resolves fallback clicks for same-entity failure and surfaces error code', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['999'],
    initialSelection: [10],
    entityTypeById: { 10: 'polyline' },
    entityById: {
      10: {
        type: 'polyline',
        closed: false,
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      },
    },
    commandResults: [
      { ok: false, changed: false, message: 'Fillet: radius too large', error_code: 'RADIUS_TOO_LARGE' },
    ],
  });

  assert.ok(String(h.status.at(-1) || '').includes('first side on selected polyline'));

  // First-side click can come from selection fallback in the real UI when hit-test is imprecise.
  h.pointer({ hitId: null, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  assert.ok(String(h.status.at(-1) || '').includes('second side on selected polyline'));

  // Second-side fallback should still execute same-entity fillet and surface the command failure.
  h.pointer({ hitId: null, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 10,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      radius: 999,
    },
  });
  assert.ok(String(h.status.at(-1) || '').includes('[RADIUS_TOO_LARGE]'));
});

test('fillet tool keeps second-pick stage after command failure and allows retry', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, {
    commandArgs: ['2'],
    commandResults: [
      { ok: false, changed: false, message: 'Fillet: pick sides must target the corner vertex', error_code: 'PICK_SIDE_MISMATCH' },
      { ok: true, changed: true, message: 'Fillet applied' },
    ],
  });

  h.pointer({ hitId: 10, x: 5, y: 0 });
  h.pointer({ hitId: 11, x: 0, y: 5 }); // fail
  assert.equal(h.commands.length, 1);
  assert.ok(h.status.at(-1).includes('[PICK_SIDE_MISMATCH]'));

  // Retry should keep the original first pick/id and only replace second pick.
  h.pointer({ hitId: 12, x: 0, y: 6 });
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 10,
      secondId: 12,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 6 },
      radius: 2,
    },
  });
});

test('chamfer tool picks two lines and executes selection.chamferByPick with d1/d2 from command input', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, { commandArgs: ['2', '3'] });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20, 21]);
});

test('chamfer tool picks line then arc and executes selection.chamferByPick', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    entityTypeById: { 21: 'arc' },
  });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 3, y: 4 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 3, y: 4 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20, 21]);
});

test('chamfer tool picks line then circle and executes selection.chamferByPick', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    entityTypeById: { 21: 'circle' },
  });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 3, y: 4 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 3, y: 4 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20, 21]);
});

test('chamfer tool allows picking two segments on the same polyline (same id)', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, { commandArgs: ['2', '3'], entityTypeById: { 20: 'polyline' } });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  h.pointer({ hitId: 20, x: 10, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 20,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20]);
});

test('chamfer tool falls back to single preselected target and keeps second-pick stage after a miss', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
    entityTypeById: { 20: 'polyline' },
    entityById: {
      20: {
        type: 'polyline',
        closed: false,
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      },
    },
  });

  // First click misses hit-test but selection fallback on a selected polyline
  // should still establish the first-side pick for a same-entity retry flow.
  h.pointer({ hitId: null, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  assert.ok(String(h.status.at(-1) || '').includes('second side on selected polyline'));

  // Second click on another target should execute using the fallback-resolved first pick.
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool uses single preselected entity as first target when clicking second target directly', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
  });

  h.pointer({ hitId: 21, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool uses single preselected line as first target when clicking circle directly', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
    entityTypeById: { 21: 'circle' },
  });

  h.pointer({ hitId: 21, x: 3, y: 4 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 1, y: 0 },
      pick2: { x: 3, y: 4 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool uses single preselected circle as first target when clicking line directly', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
    entityById: {
      20: {
        type: 'circle',
        center: { x: 0, y: 0 },
        radius: 2,
      },
    },
  });

  h.pointer({ hitId: 21, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 0, y: 2 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool fast-path also applies when single selection is set after activation', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
  });
  h.selection.setSelection([20], 20);

  h.pointer({ hitId: 21, x: 0, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool starts in second-pick mode with single preselection and accepts first-side click refinement', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
  });

  assert.ok(String(h.status.at(-1) || '').includes('Click second line/polyline'));
  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool starts in one-click mode with two preselected targets', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20, 21],
  });

  assert.ok(String(h.status.at(-1) || '').toLowerCase().includes('either selected target'));
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0].id, 'selection.chamferByPick');
  assert.equal(h.commands[0].payload.firstId, 21);
  assert.equal(h.commands[0].payload.secondId, 20);
  assert.equal(h.commands[0].payload.d1, 2);
  assert.equal(h.commands[0].payload.d2, 3);
  assert.ok(Number.isFinite(h.commands[0].payload.pick1?.x));
  assert.ok(Number.isFinite(h.commands[0].payload.pick1?.y));
  assert.ok(Number.isFinite(h.commands[0].payload.pick2?.x));
  assert.ok(Number.isFinite(h.commands[0].payload.pick2?.y));
  assert.deepEqual(h.selection.entityIds, [21, 20]);
});

test('chamfer tool projects curve picks in one-click mode with preselected circle-line pair', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20, 21],
    entityById: {
      20: {
        type: 'circle',
        center: { x: 0, y: 0 },
        radius: 2,
      },
      21: {
        type: 'line',
        start: { x: -5, y: 5 },
        end: { x: 5, y: 5 },
      },
    },
  });

  h.pointer({ hitId: 20, x: 0, y: 2 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 0, y: 2 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20, 21]);
});

test('chamfer tool preselected polyline supports same-entity corner refinement in second-pick stage', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
    entityTypeById: { 20: 'polyline' },
  });

  assert.ok(String(h.status.at(-1) || '').includes('first side on selected polyline'));

  // First click on the same polyline refines first-side pick.
  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  assert.ok(String(h.status.at(-1) || '').includes('second side on selected polyline'));

  // Second click on another segment of the same polyline executes same-entity chamfer.
  h.pointer({ hitId: 20, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 20,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
  assert.deepEqual(h.selection.entityIds, [20]);
});

test('chamfer tool preselected polyline executes same-entity corner when second hit falls back to selection', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
    entityTypeById: { 20: 'polyline' },
  });

  // First click refines first-side pick on the selected polyline.
  h.pointer({ hitId: 20, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);

  // Second click misses hit-test (fallback to selected id) but should still execute same-entity chamfer.
  h.pointer({ hitId: null, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 20,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool preselection ignores fallback miss for first-side pick', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    initialSelection: [20],
  });

  h.pointer({ hitId: null, x: 99, y: 99 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 21, x: 0, y: 5 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 21,
      pick1: { x: 0, y: 0 },
      pick2: { x: 0, y: 5 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool keeps second-pick stage after command failure and allows retry', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['2', '3'],
    commandResults: [
      { ok: false, changed: false, message: 'Chamfer: pick sides must target the corner vertex', error_code: 'PICK_SIDE_MISMATCH' },
      { ok: true, changed: true, message: 'Chamfer applied' },
    ],
  });

  h.pointer({ hitId: 20, x: 5, y: 0 });
  h.pointer({ hitId: 21, x: 0, y: 5 }); // fail
  assert.equal(h.commands.length, 1);
  assert.ok(h.status.at(-1).includes('[PICK_SIDE_MISMATCH]'));

  // Retry should keep the original first pick/id and only replace second pick.
  h.pointer({ hitId: 22, x: 0, y: 6 });
  assert.equal(h.commands.length, 2);
  assert.deepEqual(h.commands[1], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 22,
      pick1: { x: 5, y: 0 },
      pick2: { x: 0, y: 6 },
      d1: 2,
      d2: 3,
    },
  });
});

test('chamfer tool preselected polyline resolves fallback clicks for same-entity failure and surfaces error code', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, {
    commandArgs: ['999', '999'],
    initialSelection: [20],
    entityTypeById: { 20: 'polyline' },
    entityById: {
      20: {
        type: 'polyline',
        closed: false,
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      },
    },
    commandResults: [
      { ok: false, changed: false, message: 'Chamfer: distance too large', error_code: 'DISTANCE_TOO_LARGE' },
    ],
  });

  assert.ok(String(h.status.at(-1) || '').includes('first side on selected polyline'));

  h.pointer({ hitId: null, x: 5, y: 0 });
  assert.equal(h.commands.length, 0);
  assert.ok(String(h.status.at(-1) || '').includes('second side on selected polyline'));

  h.pointer({ hitId: null, x: 10, y: 5 });
  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 20,
      secondId: 20,
      pick1: { x: 5, y: 0 },
      pick2: { x: 10, y: 5 },
      d1: 999,
      d2: 999,
    },
  });
  assert.ok(String(h.status.at(-1) || '').includes('[DISTANCE_TOO_LARGE]'));
});

test('fillet tool Escape resets first pick before completing two-line operation', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['1.5'] });

  h.pointer({ hitId: 1, x: 1, y: 0 });
  h.esc();
  h.pointer({ hitId: 2, x: 2, y: 0 });
  h.pointer({ hitId: 3, x: 0, y: 3 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 2,
      secondId: 3,
      pick1: { x: 2, y: 0 },
      pick2: { x: 0, y: 3 },
      radius: 1.5,
    },
  });
  assert.deepEqual(h.selection.entityIds, [2, 3]);
});

test('fillet tool does not reuse stale preselection after Escape reset', () => {
  const h = createTwoLinePickToolHarness(createFilletTool, { commandArgs: ['1.5'], initialSelection: [10] });

  h.esc();
  h.pointer({ hitId: 11, x: 1, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 12, x: 0, y: 3 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.filletByPick',
    payload: {
      firstId: 11,
      secondId: 12,
      pick1: { x: 1, y: 0 },
      pick2: { x: 0, y: 3 },
      radius: 1.5,
    },
  });
});

test('chamfer tool does not reuse stale preselection after Escape reset', () => {
  const h = createTwoLinePickToolHarness(createChamferTool, { commandArgs: ['1', '1'], initialSelection: [20] });

  h.esc();
  h.pointer({ hitId: 21, x: 2, y: 0 });
  assert.equal(h.commands.length, 0);
  h.pointer({ hitId: 22, x: 0, y: 4 });

  assert.equal(h.commands.length, 1);
  assert.deepEqual(h.commands[0], {
    id: 'selection.chamferByPick',
    payload: {
      firstId: 21,
      secondId: 22,
      pick1: { x: 2, y: 0 },
      pick2: { x: 0, y: 4 },
      d1: 1,
      d2: 1,
    },
  });
});

// --- Constraint storage and solver bridge tests ---

test('constraint CRUD: add, get, list, remove', () => {
  const { document } = setup();

  const c1 = document.addConstraint({ id: 'c0', type: 'horizontal', refs: ['p0.y', 'p1.y'] });
  assert.equal(c1.id, 'c0');
  assert.equal(c1.type, 'horizontal');
  assert.deepEqual(c1.refs, ['p0.y', 'p1.y']);
  assert.equal(c1.value, undefined);

  const c2 = document.addConstraint({ id: 'c1', type: 'distance', refs: ['p0.x', 'p0.y', 'p1.x', 'p1.y'], value: 5.0 });
  assert.equal(c2.value, 5.0);

  assert.equal(document.listConstraints().length, 2);
  assert.deepEqual(document.getConstraint('c0'), c1);
  assert.deepEqual(document.getConstraint('c1'), c2);
  assert.equal(document.getConstraint('c99'), null);

  const removed = document.removeConstraint('c0');
  assert.equal(removed.id, 'c0');
  assert.equal(document.listConstraints().length, 1);
  assert.equal(document.removeConstraint('c0'), null);
});

test('constraint snapshot/restore roundtrip', () => {
  const { document } = setup();

  document.addConstraint({ id: 'c0', type: 'horizontal', refs: ['p0.y', 'p1.y'] });
  document.addConstraint({ id: 'c1', type: 'distance', refs: ['p0.x', 'p0.y', 'p1.x', 'p1.y'], value: 10 });

  const snap = document.snapshot();
  assert.equal(snap.constraints.length, 2);

  document.clearConstraints();
  assert.equal(document.listConstraints().length, 0);

  document.restore(snap);
  assert.equal(document.listConstraints().length, 2);
  assert.equal(document.getConstraint('c0').type, 'horizontal');
  assert.equal(document.getConstraint('c1').value, 10);
});

test('solver.export-project returns CADGF-PROJ JSON', () => {
  const { document, bus } = setup();

  // Add entities and constraints
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 10, y: 5 }, layerId: 0 },
  });
  document.addConstraint({ id: 'c0', type: 'horizontal', refs: ['e1_start.y', 'e1_end.y'] });

  const res = bus.execute('solver.export-project');
  assert.equal(res.ok, true);
  assert.ok(res.project);
  assert.equal(res.project.header.format, 'CADGF-PROJ');
  assert.equal(res.project.header.version, 1);
  assert.ok(Array.isArray(res.project.scene.entities));
  assert.ok(Array.isArray(res.project.scene.constraints));
  assert.equal(res.project.scene.constraints.length, 1);
  assert.equal(res.project.scene.constraints[0].type, 'horizontal');
});

test('solver.export-project fails with no constraints', () => {
  const { bus } = setup();
  const res = bus.execute('solver.export-project');
  assert.equal(res.ok, false);
  // canExecute returns false → CANNOT_EXECUTE
  assert.equal(res.error_code, 'CANNOT_EXECUTE');
});

test('solver.import-diagnostics accepts payload', () => {
  const { bus } = setup();
  const ctx = bus.context;

  let importedPayload = null;
  ctx.setSolverDiagnostics = (payload) => { importedPayload = payload; };

  const diagnostics = {
    ok: true,
    iterations: 3,
    final_error: 0.0001,
    analysis: { constraint_count: 1 },
  };
  const res = bus.execute('solver.import-diagnostics', diagnostics);
  assert.equal(res.ok, true);
  assert.deepEqual(importedPayload, diagnostics);
});

test('solver.import-diagnostics works without setSolverDiagnostics hook', () => {
  const { bus } = setup();
  // No setSolverDiagnostics set on context — should still succeed
  const diagnostics = { ok: true, analysis: {} };
  const res = bus.execute('solver.import-diagnostics', diagnostics);
  assert.equal(res.ok, true);
});

test('solver.export-project outputs valid CADGF-PROJ that solve_from_project can consume', async () => {
  const { execFileSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const path = await import('node:path');

  // Find the solve_from_project binary
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  const binary = path.join(repoRoot, 'build_fix/tools/solve_from_project');
  if (!existsSync(binary)) {
    // Skip if binary not built (CI may not have it)
    return;
  }

  const { document, bus } = setup();
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 10, y: 5 }, layerId: 0 },
  });
  document.addConstraint({ id: 'c0', type: 'horizontal', refs: ['e1_start.y', 'e1_end.y'] });

  const exportResult = bus.execute('solver.export-project');
  assert.equal(exportResult.ok, true);

  // Write project to temp file, run solve_from_project, check output
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const tmpPath = path.join(repoRoot, 'build_fix', '_test_solver_bridge_project.json');
  writeFileSync(tmpPath, JSON.stringify(exportResult.project, null, 2));

  try {
    const stdout = execFileSync(binary, ['--json', tmpPath], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.ok(Number.isFinite(result.iterations));
    assert.ok(result.analysis);
    assert.equal(result.analysis.constraint_count, 1);
    assert.equal(result.analysis.evaluable_constraint_count, 1);
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

test('selection-derived refs solve correctly with multiple constraint types', async () => {
  const { execFileSync } = await import('node:child_process');
  const { existsSync, writeFileSync, unlinkSync } = await import('node:fs');
  const path = await import('node:path');

  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  const binary = path.join(repoRoot, 'build_fix/tools/solve_from_project');
  if (!existsSync(binary)) return;

  const { document, bus } = setup();
  // Create two lines and a circle
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'line', start: { x: 10, y: 0 }, end: { x: 10, y: 5 }, layerId: 0 },
  });
  bus.execute('entity.create', {
    entity: { type: 'circle', center: { x: 5, y: 5 }, radius: 2, layerId: 0 },
  });

  // Add constraints using the same ref format deriveConstraintRefs would produce
  // horizontal: two start.y refs
  document.addConstraint({ id: 'c0', type: 'horizontal', refs: ['e1_start.y', 'e2_start.y'] });
  // distance: two start points (x0,y0,x1,y1)
  document.addConstraint({ id: 'c1', type: 'distance', refs: ['e1_start.x', 'e1_start.y', 'e2_start.x', 'e2_start.y'], value: 10 });
  // coincident: line1 end = line2 start
  document.addConstraint({ id: 'c2', type: 'coincident', refs: ['e1_end.x', 'e1_end.y', 'e2_start.x', 'e2_start.y'] });

  const exportResult = bus.execute('solver.export-project');
  assert.equal(exportResult.ok, true);
  assert.equal(exportResult.project.scene.constraints.length, 3);

  const tmpPath = path.join(repoRoot, 'build_fix', '_test_multi_constraint_project.json');
  writeFileSync(tmpPath, JSON.stringify(exportResult.project, null, 2));

  try {
    const stdout = execFileSync(binary, ['--json', tmpPath], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);
    assert.equal(result.analysis.constraint_count, 3);
    assert.ok(result.analysis.evaluable_constraint_count >= 2);
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});
