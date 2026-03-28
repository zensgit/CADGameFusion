import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { serializeDocument, hydrateDocument } from '../adapters/document_json_adapter.js';
import { isCadgfDocument, importCadgfDocument, exportCadgfDocument } from '../adapters/cadgf_document_adapter.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';
import { createToolContext } from '../tools/tool_context.js';
import { createToolRegistry } from '../tools/tool_registry.js';
import { CanvasView } from './canvas_view.js';
import { createToolbar } from './toolbar.js';
import { createStatusBar } from './statusbar.js';
import { createLayerPanel } from './layer_panel.js';
import { createPropertyPanel } from './property_panel.js';
import { createSnapPanel } from './snap_panel.js';
import { createSolverActionPanel } from './solver_action_panel.js';
import { createSolverActionFlowBanner } from './solver_action_flow_banner.js';
import { createSolverActionFlowConsole } from './solver_action_flow_console.js';
import {
  activateLayerOff,
  activateLayerFreeze,
  activateLayerIsolation,
  activateLayerLock,
  activateLayerUnlock,
  formatLayerRef,
  isEditableLayer,
  resolveCurrentLayerId,
  resolveSelectionCurrentLayer,
  resolveSelectionLayerFreezeLayers,
  resolveSelectionLayerLockLayers,
  resolveSelectionLayerOffLayers,
  resolveSelectionLayerUnlockLayers,
  resolveSelectionIsolationLayers,
  restoreLayerFreeze,
  restoreLayerOff,
  restoreLayerIsolation,
} from './layer_session_policy.js';
import { formatSelectionStatus } from './selection_presenter.js';
import { formatSpaceLayoutLabel, normalizeLayoutName, resolveCurrentSpaceLayoutContext } from '../space_layout.js';
import {
  classifyInsertSelectionScope,
  computeSourceGroupBounds,
  computeSourceTextGuideExtents,
  computeInsertGroupBounds,
  isInsertGroupEntity,
  isInsertTextProxyEntity,
  isSourceGroupEntity,
  resolveInsertPeerSelection,
  resolveReleasedInsertPeerSelection,
  summarizeReleasedInsertGroupMembers,
  resolveSourceTextGuide,
  resolveInsertPeerMember,
  summarizeInsertGroupMembers,
  summarizeInsertPeerInstances,
  summarizeReleasedInsertPeerInstances,
} from '../insert_group.js';

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function createImporter(onLoad, { id = '', accept = '.json,application/json', onError = null } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  if (id) {
    input.id = id;
  }
  input.style.display = 'none';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      onLoad(payload);
    } catch (error) {
      console.error('Failed to import JSON', error);
      if (typeof onError === 'function') {
        onError(error);
      }
    } finally {
      input.value = '';
    }
  });
  document.body.appendChild(input);
  return {
    open() {
      input.click();
    },
    destroy() {
      document.body.removeChild(input);
    },
  };
}

function computeDocumentExtents(documentState) {
  const entities = documentState.listVisibleEntities();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (point) => {
    if (!point) return;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };

  for (const entity of entities) {
    if (!entity || entity.visible === false) continue;
    if (entity.type === 'line') {
      include(entity.start);
      include(entity.end);
      continue;
    }
    if (entity.type === 'polyline' && Array.isArray(entity.points)) {
      for (const point of entity.points) include(point);
      continue;
    }
    if (entity.type === 'circle' || entity.type === 'arc') {
      const center = entity.center;
      const radius = Math.max(0.001, Number(entity.radius || 0));
      if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
        include({ x: center.x - radius, y: center.y - radius });
        include({ x: center.x + radius, y: center.y + radius });
      }
      continue;
    }
    if (entity.type === 'text') {
      include(entity.position);
      continue;
    }
    if (entity.type === 'unsupported' && entity.display_proxy) {
      const proxy = entity.display_proxy;
      if (proxy.kind === 'point') {
        include(proxy.point);
      } else if (proxy.kind === 'polyline' && Array.isArray(proxy.points)) {
        for (const point of proxy.points) include(point);
      } else if (proxy.kind === 'ellipse' && proxy.center) {
        const r = Math.max(
          Math.max(0.001, Number(proxy.rx || 0)),
          Math.max(0.001, Number(proxy.ry || 0)),
        );
        include({ x: proxy.center.x - r, y: proxy.center.y - r });
        include({ x: proxy.center.x + r, y: proxy.center.y + r });
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function fitViewToExtents({ viewState, canvas, extents, paddingPx = 56 }) {
  if (!extents) return false;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const docW = Math.max(1e-6, extents.maxX - extents.minX);
  const docH = Math.max(1e-6, extents.maxY - extents.minY);
  const zoomX = (width - paddingPx * 2) / docW;
  const zoomY = (height - paddingPx * 2) / docH;
  const zoom = Math.min(zoomX, zoomY);

  const centerX = (extents.minX + extents.maxX) * 0.5;
  const centerY = (extents.minY + extents.maxY) * 0.5;
  const clampedZoom = Math.min(viewState.maxZoom, Math.max(viewState.minZoom, zoom));
  const pan = {
    x: width * 0.5 - centerX * clampedZoom,
    y: height * 0.5 - centerY * clampedZoom,
  };

  viewState.restore({ zoom: clampedZoom, pan });
  return true;
}

function resolveSourceTextGuideForSelection(documentState, selectionState) {
  const primary = documentState.getEntity(selectionState.primaryId)
    || documentState.getEntity((selectionState.entityIds || [])[0]);
  if (!primary || !isSourceGroupEntity(primary) || isInsertGroupEntity(primary)) {
    return { primary: primary || null, guide: null };
  }
  return {
    primary,
    guide: resolveSourceTextGuide(documentState.listEntities(), primary),
  };
}

function fitViewToDocument({ documentState, viewState, canvas, paddingPx = 56 }) {
  const extents = computeDocumentExtents(documentState);
  fitViewToExtents({ viewState, canvas, extents, paddingPx });
}

function idsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function resolveInsertPeerTargetIndex(peerSummary, {
  peerIndex = null,
  targetLayout = '',
} = {}) {
  if (!peerSummary || !Array.isArray(peerSummary.peers) || peerSummary.peers.length === 0) {
    return -1;
  }
  if (Number.isFinite(peerIndex)) {
    const normalized = Math.trunc(Number(peerIndex));
    return normalized >= 0 && normalized < peerSummary.peers.length ? normalized : -1;
  }
  const layoutToken = normalizeLayoutName(targetLayout).toLowerCase();
  if (!layoutToken) {
    return -1;
  }
  return peerSummary.peers.findIndex((peer) => {
    const layout = normalizeLayoutName(peer.layout).toLowerCase();
    const full = formatSpaceLayoutLabel({ space: peer.space, layout: peer.layout }).toLowerCase();
    if (layoutToken === full) return true;
    if (layout && layoutToken === layout) return true;
    if (layoutToken === 'model' && peer.space === 0) return true;
    if (layoutToken === 'paper' && peer.space === 1 && !layout) return true;
    return false;
  });
}

function seedDocument(documentState) {
  const hasContent = documentState.listEntities().length > 0;
  if (hasContent) {
    return;
  }

  documentState.addEntity({ type: 'line', start: { x: -40, y: 0 }, end: { x: 40, y: 0 }, color: '#64748b' });
  documentState.addEntity({ type: 'line', start: { x: 0, y: -30 }, end: { x: 0, y: 30 }, color: '#64748b' });
  documentState.addEntity({ type: 'circle', center: { x: 0, y: 0 }, radius: 12, color: '#0f766e' });
  documentState.addEntity({ type: 'text', position: { x: 14, y: -10 }, value: 'VemCAD', height: 2.2, color: '#111827' });
}

function parseCommandInput(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return { verb: '', args: [] };
  }
  const tokens = text.split(/\s+/g);
  const [verb, ...args] = tokens;
  return { verb: verb.toLowerCase(), args };
}

function findLayerByToken(documentState, rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) return null;
  const numericId = Number.parseInt(token, 10);
  if (Number.isFinite(numericId)) {
    return documentState.getLayer(numericId);
  }
  const normalized = token.toLowerCase();
  return documentState.listLayers().find((layer) => String(layer?.name || '').trim().toLowerCase() === normalized) || null;
}

function formatSourceGroupLabel(entity) {
  const sourceType = String(entity?.sourceType || '').trim().toUpperCase();
  if (!sourceType) return String(entity?.groupId || entity?.id || 'GROUP');
  return Number.isFinite(entity?.groupId) ? `${sourceType} ${Math.trunc(Number(entity.groupId))}` : sourceType;
}

export function bootstrapCadWorkspace({ params = new URLSearchParams(window.location.search) } = {}) {
  const canvas = document.getElementById('cad-canvas');
  const solverImportButton = document.getElementById('cad-import-solver');
  const solverClearButton = document.getElementById('cad-clear-solver');
  if (!canvas) {
    throw new Error('CAD canvas not found');
  }

  const debugEnabled = params.get('debug') === '1';
  let cadgfBaseDocument = null;
  let layerIsolationSession = null;
  let layerOffSession = null;
  let layerFreezeSession = null;
  let solverDiagnostics = null;
  let solverActionState = {
    activePanelId: '',
    lastInvokedPanelId: '',
    invocationCount: 0,
    activePanel: null,
    lastInvokedPanel: null,
    availablePanelIds: [],
    activeFocus: null,
  };
  let solverActionRequestState = {
    requestCount: 0,
    invokeRequestCount: 0,
    focusRequestCount: 0,
    flowRequestCount: 0,
    replayRequestCount: 0,
    lastRequest: null,
    history: [],
  };
  let solverActionEventState = {
    eventCount: 0,
    invokeEventCount: 0,
    focusEventCount: 0,
    flowEventCount: 0,
    replayEventCount: 0,
    lastEvent: null,
    history: [],
  };
  let solverActionDomEventState = {
    eventCount: 0,
    requestEventCount: 0,
    actionEventCount: 0,
    focusEventCount: 0,
    flowEventCount: 0,
    replayEventCount: 0,
    lastEvent: null,
    history: [],
  };

  const recordSolverActionDomEvent = (type, detail = {}) => {
    const eventType = String(type || '').trim();
    if (!eventType) return;
    let eventKind = '';
    if (eventType === 'cad:solver-action-request') eventKind = 'request';
    else if (eventType === 'cad:solver-action') eventKind = 'action';
    else if (eventType === 'cad:solver-action-focus') eventKind = 'focus';
    else if (eventType === 'cad:solver-action-flow-step') eventKind = 'flow';
    else if (eventType === 'cad:solver-action-replay') eventKind = 'replay';
    else return;
    const event = {
      historyIndex: Array.isArray(solverActionDomEventState.history) ? solverActionDomEventState.history.length : 0,
      eventType,
      eventKind,
      panelId: typeof detail?.panelId === 'string' ? detail.panelId : '',
      flowAction: typeof detail?.flowAction === 'string' ? detail.flowAction : '',
      focusKind: typeof detail?.focusKind === 'string' ? detail.focusKind : '',
      focusValue: detail?.focusValue === undefined || detail?.focusValue === null ? '' : String(detail.focusValue),
      invocationCount: Number.isFinite(detail?.invocationCount) ? Math.trunc(Number(detail.invocationCount)) : 0,
    };
    const nextHistory = [
      ...(Array.isArray(solverActionDomEventState.history) ? solverActionDomEventState.history : []),
      event,
    ].slice(-64);
    solverActionDomEventState = {
      eventCount: nextHistory.length,
      requestEventCount: nextHistory.filter((one) => one?.eventKind === 'request').length,
      actionEventCount: nextHistory.filter((one) => one?.eventKind === 'action').length,
      focusEventCount: nextHistory.filter((one) => one?.eventKind === 'focus').length,
      flowEventCount: nextHistory.filter((one) => one?.eventKind === 'flow').length,
      replayEventCount: nextHistory.filter((one) => one?.eventKind === 'replay').length,
      lastEvent: nextHistory.length > 0 ? cloneJson(nextHistory[nextHistory.length - 1]) : null,
      history: nextHistory,
    };
  };

  const solverActionDomEventTypes = [
    'cad:solver-action-request',
    'cad:solver-action',
    'cad:solver-action-focus',
    'cad:solver-action-flow-step',
    'cad:solver-action-replay',
  ];
  for (const eventType of solverActionDomEventTypes) {
    window.addEventListener(eventType, (event) => {
      recordSolverActionDomEvent(eventType, event?.detail);
    });
  }

  const documentState = new DocumentState();
  const selectionState = new SelectionState();
  const snapState = new SnapState();
  const viewState = new ViewState();
  viewState.pan = {
    x: canvas.clientWidth * 0.5,
    y: canvas.clientHeight * 0.5,
  };
  viewState.zoom = 9;

  const toolOptions = {
    // UI-level override for closed polyline two-point break.
    // - auto: follow modifier keys (Ctrl/Cmd=short, Alt=long)
    // - short/long: override modifiers
    breakKeep: 'auto',
  };
  let currentLayerId = resolveCurrentLayerId(documentState, null);

  const commandContext = {
    document: documentState,
    selection: selectionState,
    snap: snapState,
    viewport: viewState,
    commandBus: null,
  };
  const commandBus = new CommandBus(commandContext);
  registerCadCommands(commandBus, commandContext);

  const canvasView = new CanvasView({
    canvas,
    document: documentState,
    selection: selectionState,
    snap: snapState,
    viewport: viewState,
  });

  if (debugEnabled) {
    // UI-flow smoke (Playwright) inspects overlays via this hook to assert gripHover and snapHint can coexist.
    // Only enabled with ?debug=1 to avoid exposing internals by default.
    window.__cadDebug = {
      getOverlays: () => ({ ...canvasView.overlays }),
      getState: () => ({
        entityCount: documentState.listEntities().length,
        selectionCount: Array.isArray(selectionState.entityIds) ? selectionState.entityIds.length : 0,
        primaryId: selectionState.primaryId,
      }),
      getView: () => ({
        zoom: Number(viewState.zoom),
        pan: { ...viewState.pan },
      }),
      getCurrentLayerId: () => currentLayerId,
      getCurrentLayer: () => {
        const layer = documentState.getLayer(currentLayerId);
        return layer ? cloneJson(layer) : null;
      },
      getCurrentSpaceContext: () => cloneJson(documentState.getCurrentSpaceContext()),
      listPaperLayouts: () => cloneJson(documentState.listPaperLayouts()),
      setCurrentSpaceContext: (context) => setCurrentSpaceContext(context, { announce: false }) === true,
      worldToCanvas: (point) => {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
        return viewState.worldToScreen(point);
      },
      runCommand: (id, payload) => {
        if (typeof id !== 'string' || id.length === 0) return null;
        const result = commandBus.execute(id, payload ?? undefined);
        return cloneJson(result);
      },
      setLayerVisibility: (id, visible) => {
        const layerId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(layerId)) return false;
        return documentState.updateLayer(layerId, { visible: visible !== false });
      },
      updateLayer: (id, patch) => {
        const layerId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(layerId) || !patch || typeof patch !== 'object') return false;
        return documentState.updateLayer(layerId, patch);
      },
      getLayer: (id) => {
        const layerId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(layerId)) return null;
        const layer = documentState.getLayer(layerId);
        return layer ? cloneJson(layer) : null;
      },
      setCurrentLayer: (id) => {
        const layerId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(layerId)) return false;
        return setCurrentLayer(layerId, { announce: false }) === true;
      },
      listLayers: () => cloneJson(documentState.listLayers()),
      listEntities: () => cloneJson(documentState.listEntities()),
      listVisibleEntityIds: () => cloneJson(documentState.listVisibleEntities().map((entity) => entity.id)),
      getSelectionIds: () => cloneJson(Array.isArray(selectionState.entityIds) ? selectionState.entityIds : []),
      setSelection: (ids, primaryId = null) => {
        const nextIds = Array.isArray(ids)
          ? ids.filter((id) => Number.isFinite(Number(id))).map((id) => Number(id))
          : [];
        const nextPrimary = Number.isFinite(Number(primaryId)) ? Number(primaryId) : null;
        selectionState.setSelection(nextIds, nextPrimary);
        return cloneJson(selectionState.toJSON());
      },
      getEntity: (id) => {
        const entityId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(entityId)) return null;
        const entity = documentState.getEntity(entityId);
        return entity ? cloneJson(entity) : null;
      },
      getSolverActionState: () => cloneJson(solverActionState),
      getSolverActionRequestState: () => cloneJson(solverActionRequestState),
      getSolverActionEventState: () => cloneJson(solverActionEventState),
      getSolverActionDomEventState: () => cloneJson(solverActionDomEventState),
    };
  }

  let statusApi = null;
  let toolbar = null;
  let solverActionPanel = null;
  let solverActionFlowBanner = null;
  let solverActionFlowConsole = null;

  const formatSolverFocusLabel = (focus) => {
    if (!focus || typeof focus !== 'object') return '';
    const kind = String(focus.kind || '').trim();
    const value = String(focus.value || '').trim();
    if (!kind || !value) return '';
    switch (kind) {
      case 'constraint':
        return `Constraint ${value}`;
      case 'basis-constraint':
        return `Basis ${value}`;
      case 'redundant-constraint':
        return `Redundant ${value}`;
      case 'variable':
        return `Variable ${value}`;
      case 'free-variable':
        return `Free variable ${value}`;
      default:
        return `${kind} ${value}`;
    }
  };

  const buildSolverStatusText = ({ actionState, requestState, eventState } = {}) => {
    const activePanelId = String(actionState?.activePanelId || '').trim();
    const activePanel = actionState?.activePanel && typeof actionState.activePanel === 'object'
      ? actionState.activePanel
      : null;
    const activeFlow = actionState?.activeFlow && typeof actionState.activeFlow === 'object'
      ? actionState.activeFlow
      : null;
    const activeFocus = actionState?.activeFocus && typeof actionState.activeFocus === 'object'
      ? actionState.activeFocus
      : null;
    const requestCount = Number.isFinite(requestState?.requestCount) ? Math.trunc(Number(requestState.requestCount)) : 0;
    const eventCount = Number.isFinite(eventState?.eventCount) ? Math.trunc(Number(eventState.eventCount)) : 0;

    if (!activePanelId) {
      if (requestCount > 0 || eventCount > 0) {
        return `Solver: idle | requests ${requestCount} | events ${eventCount}`;
      }
      return 'Solver: idle';
    }

    const title = String(activePanel?.ui?.title || activePanel?.label || activePanel?.id || activePanelId).trim();
    const focusLabel = formatSolverFocusLabel(activeFocus);
    const stepIndex = Number.isFinite(activeFlow?.stepIndex) ? Math.trunc(Number(activeFlow.stepIndex)) : -1;
    const stepCount = Number.isFinite(activeFlow?.stepCount) ? Math.trunc(Number(activeFlow.stepCount)) : 0;
    const progressLabel = stepIndex >= 0 && stepCount > 0 ? `${stepIndex + 1}/${stepCount}` : '';
    const parts = ['Solver:', title];
    if (focusLabel) parts.push('|', focusLabel);
    if (progressLabel) parts.push('|', progressLabel);
    return parts.join(' ');
  };

  const syncSolverActionViews = () => {
    solverActionState = cloneJson(solverActionPanel?.getState?.() || solverActionState) || solverActionState;
    solverActionRequestState = cloneJson(solverActionPanel?.getRequestState?.() || solverActionRequestState) || solverActionRequestState;
    solverActionEventState = cloneJson(solverActionPanel?.getEventState?.() || solverActionEventState) || solverActionEventState;
    solverActionFlowBanner?.setState({
      actionState: solverActionState,
      requestState: solverActionRequestState,
      eventState: solverActionEventState,
      normalized: cloneJson(solverActionPanel?.getNormalized?.() || null),
    });
    solverActionFlowConsole?.setState({
      actionState: solverActionState,
      requestState: solverActionRequestState,
      eventState: solverActionEventState,
      normalized: cloneJson(solverActionPanel?.getNormalized?.() || null),
    });
    statusApi?.setSolver(buildSolverStatusText({
      actionState: solverActionState,
      requestState: solverActionRequestState,
      eventState: solverActionEventState,
    }));
  };

  const focusRecentSolverEvent = () => {
    const recentEvent = solverActionFlowBanner?.getState?.()?.recentEvent || null;
    const panelId = String(recentEvent?.panelId || '').trim();
    if (!panelId) return false;
    const focusKind = String(recentEvent?.focusKind || '').trim();
    const focusValue = String(recentEvent?.focusValue || '').trim();
    return focusKind && focusValue
      ? !!solverActionPanel?.invokeFocus?.(panelId, focusKind, focusValue)
      : !!solverActionPanel?.invoke?.(panelId);
  };

  const activateSolverStatusFlow = () => {
    if (focusRecentSolverEvent()) {
      syncSolverActionViews();
      statusApi?.setMessage('Solver recent event focused');
      return true;
    }
    const activePanelId = String(solverActionState?.activePanelId || '').trim();
    if (!activePanelId) {
      return false;
    }
    const ok = !!solverActionPanel?.invoke?.(activePanelId);
    if (ok) {
      syncSolverActionViews();
      statusApi?.setMessage('Solver panel refocused');
    }
    return ok;
  };

  const cycleSolverActionPanel = (direction = 1) => {
    if (!solverActionPanel) return false;
    const normalized = solverActionPanel?.getNormalized?.() || null;
    const panelIds = Array.isArray(normalized?.panels)
      ? normalized.panels
        .filter((panel) => panel && panel.enabled === true)
        .map((panel) => String(panel.id || '').trim())
        .filter((id) => id.length > 0)
      : [];
    if (panelIds.length === 0) {
      return false;
    }
    const activePanelId = String(solverActionState?.activePanelId || '').trim();
    let index = panelIds.indexOf(activePanelId);
    if (index < 0) {
      index = direction >= 0 ? -1 : 0;
    }
    const nextIndex = (index + (direction >= 0 ? 1 : -1) + panelIds.length) % panelIds.length;
    const nextPanelId = panelIds[nextIndex];
    if (!nextPanelId) {
      return false;
    }
    const ok = !!solverActionPanel?.invoke?.(nextPanelId);
    if (ok) {
      solverActionPanel?.focusPanelCard?.(nextPanelId);
      syncSolverActionViews();
      const nextPanel = normalized?.panels?.find((panel) => String(panel?.id || '').trim() === nextPanelId) || null;
      const label = nextPanel?.ui?.title || nextPanel?.label || nextPanelId;
      statusApi?.setMessage(`Solver panel cycled: ${label}`);
    }
    return ok;
  };

  const runGlobalSolverFlowShortcut = (event) => {
    if (!solverActionPanel) return false;
    if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) {
      return false;
    }
    let ok = false;
    switch (event.key) {
      case 'ArrowUp':
        ok = cycleSolverActionPanel(-1);
        break;
      case 'ArrowDown':
        ok = cycleSolverActionPanel(1);
        break;
      case 'ArrowLeft':
        ok = !!solverActionPanel?.rewindFlow?.();
        break;
      case 'ArrowRight':
        ok = !!solverActionPanel?.advanceFlow?.();
        break;
      case 'Home':
        ok = !!solverActionPanel?.restartFlow?.();
        break;
      case 'End':
        ok = focusRecentSolverEvent();
        break;
      default:
        return false;
    }
    if (!ok) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    syncSolverActionViews();
    return true;
  };

  const setSolverDiagnostics = (payload, message = '') => {
    solverDiagnostics = payload && typeof payload === 'object' ? cloneJson(payload) : null;
    solverActionPanel?.setDiagnostics(solverDiagnostics);
    syncSolverActionViews();
    if (solverClearButton) {
      solverClearButton.disabled = !solverDiagnostics;
    }
    if (solverImportButton) {
      solverImportButton.setAttribute('aria-pressed', solverDiagnostics ? 'true' : 'false');
    }
    if (message && statusApi) {
      statusApi.setMessage(message);
    }
  };
  commandContext.setSolverDiagnostics = setSolverDiagnostics;

  const toolContext = createToolContext({
    document: documentState,
    selection: selectionState,
    snap: snapState,
    viewport: viewState,
    toolOptions,
    commandBus,
    canvasView,
    setStatus: (text) => statusApi?.setMessage(text),
    readCommandInput: () => {
      const text = toolbar ? toolbar.getCommandInput() : '';
      const parsed = parseCommandInput(text);
      const height = parsed.args.length > 1 ? Number.parseFloat(parsed.args[1]) : undefined;
      return {
        raw: text,
        verb: parsed.verb,
        args: parsed.args,
        text: parsed.verb === 'text' ? parsed.args[0] : text,
        height,
      };
    },
    getCurrentLayerId: () => currentLayerId,
    getCurrentLayer: () => documentState.getLayer(currentLayerId),
    getCurrentSpaceContext: () => documentState.getCurrentSpaceContext(),
  });

  const toolRegistry = createToolRegistry(toolContext);
  const toolIds = new Set(toolRegistry.tools.map((tool) => tool.id));

  function setActiveTool(toolId) {
    const tool = toolRegistry.get(toolId);
    if (!tool) {
      statusApi?.setMessage(`Tool not found: ${toolId}`);
      return false;
    }
    canvasView.setTool(tool);
    toolbar.setActiveTool(toolId);
    return true;
  }

  function runTypedCommand(rawText) {
    const parsed = parseCommandInput(rawText);
    if (!parsed.verb) {
      return;
    }
    const args = parsed.args;
    const alias = {
      l: 'line',
      pl: 'polyline',
      c: 'circle',
      a: 'arc',
      t: 'text',
      s: 'select',
      m: 'move',
      co: 'copy',
      o: 'offset',
      of: 'offset',
      ro: 'rotate',
      br: 'break',
      tr: 'trim',
      ex: 'extend',
      del: 'delete',
      ze: 'fit',
      ms: 'mspace',
      ps: 'pspace',
      j: 'join',
      jo: 'join',
      f: 'fillet',
      ch: 'chamfer',
      cha: 'chamfer',
      lay: 'layer',
    };
    const verb = alias[parsed.verb] || parsed.verb;

    if (verb === 'join' && args.length > 0) {
      const tolerance = Number.parseFloat(args[0]);
      const payload = Number.isFinite(tolerance) ? { tolerance } : undefined;
      const result = commandBus.execute('selection.join', payload);
      statusApi?.setMessage(result.message || 'Join');
      return;
    }

    if (verb === 'scale' && args.length > 0) {
      const factor = Number.parseFloat(args[0]);
      const centerX = args.length > 1 ? Number.parseFloat(args[1]) : NaN;
      const centerY = args.length > 2 ? Number.parseFloat(args[2]) : NaN;
      if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(centerX) || !Number.isFinite(centerY)) {
        statusApi?.setMessage('Usage: scale <factor> <centerX> <centerY>');
        return;
      }
      const result = commandBus.execute('selection.scale', {
        center: { x: centerX, y: centerY },
        factor,
      });
      statusApi?.setMessage(result.message || 'Scale');
      return;
    }

    if (toolIds.has(verb)) {
      setActiveTool(verb);
      return;
    }

    if (verb === 'undo') {
      const result = commandBus.execute('history.undo');
      statusApi?.setMessage(result.message || 'Undo');
      return;
    }

    if (verb === 'redo') {
      const result = commandBus.execute('history.redo');
      statusApi?.setMessage(result.message || 'Redo');
      return;
    }

    if (verb === 'delete') {
      const result = commandBus.execute('selection.delete');
      statusApi?.setMessage(result.message || 'Delete');
      return;
    }

    if (verb === 'move' || verb === 'copy' || verb === 'rotate' || verb === 'scale' || verb === 'trim' || verb === 'extend') {
      setActiveTool(verb);
      return;
    }

    if (verb === 'snap') {
      const options = snapState.toJSON();
      const next = !(options.endpoint || options.midpoint || options.quadrant || options.center || options.intersection || options.nearest || options.tangent);
      snapState.setOption('endpoint', next);
      snapState.setOption('midpoint', next);
      snapState.setOption('quadrant', next);
      snapState.setOption('center', next);
      snapState.setOption('intersection', next);
      snapState.setOption('nearest', next);
      snapState.setOption('tangent', next);
      statusApi?.setMessage(`Snap ${next ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'nea' || verb === 'nearest') {
      snapState.toggle('nearest');
      statusApi?.setMessage(`Nearest snap ${snapState.toJSON().nearest ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'tan' || verb === 'tangent') {
      snapState.toggle('tangent');
      statusApi?.setMessage(`Tangent snap ${snapState.toJSON().tangent ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'quad' || verb === 'quadrant') {
      snapState.toggle('quadrant');
      statusApi?.setMessage(`Quadrant snap ${snapState.toJSON().quadrant ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'grid') {
      snapState.toggle('grid');
      viewState.setShowGrid(snapState.toJSON().grid);
      statusApi?.setMessage(`Grid ${snapState.toJSON().grid ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'ortho') {
      snapState.toggle('ortho');
      statusApi?.setMessage(`Ortho ${snapState.toJSON().ortho ? 'enabled' : 'disabled'}`);
      return;
    }

    if (verb === 'zoom' && args.length > 0) {
      const value = Number.parseFloat(args[0]);
      if (Number.isFinite(value) && value > 0) {
        viewState.setZoom(value);
        statusApi?.setMessage(`Zoom set to ${value.toFixed(2)}`);
      }
      return;
    }

    if (verb === 'fit' || verb === 'extents') {
      fitViewToDocument({ documentState, viewState, canvas });
      statusApi?.setMessage('Fit view');
      return;
    }

    if (verb === 'layer' || verb === 'clayer') {
      if (args.length === 0) {
        const currentLayer = documentState.getLayer(currentLayerId);
        statusApi?.setMessage(`Current layer: ${formatLayerRef(currentLayer)}`);
        return;
      }
      const token = args.join(' ').trim();
      const layer = findLayerByToken(documentState, token);
      if (!layer) {
        statusApi?.setMessage(`Layer not found: ${token}`);
        return;
      }
      setCurrentLayer(layer.id);
      return;
    }

    if (verb === 'space') {
      if (args.length === 0) {
        statusApi?.setMessage(`Current space: ${formatSpaceLayoutLabel(getCurrentSpaceContext())}`);
        return;
      }
      const token = String(args[0] || '').trim().toLowerCase();
      if (token === 'model' || token === 'mspace' || token === '0') {
        setCurrentSpaceContext({ space: 0, layout: 'Model' });
        return;
      }
      if (token === 'paper' || token === 'pspace' || token === '1') {
        const layout = args.length > 1
          ? args.slice(1).join(' ').trim()
          : (documentState.listPaperLayouts()[0] || getCurrentSpaceContext().layout || '');
        setCurrentSpaceContext({ space: 1, layout });
        return;
      }
      statusApi?.setMessage('Usage: space [model|paper <layout>]');
      return;
    }

    if (verb === 'mspace') {
      setCurrentSpaceContext({ space: 0, layout: 'Model' });
      return;
    }

    if (verb === 'pspace') {
      const layout = args.length > 0
        ? args.join(' ').trim()
        : (documentState.listPaperLayouts()[0] || getCurrentSpaceContext().layout || '');
      setCurrentSpaceContext({ space: 1, layout });
      return;
    }

    if (verb === 'layout') {
      if (args.length === 0) {
        statusApi?.setMessage(`Current layout: ${formatSpaceLayoutLabel(getCurrentSpaceContext())}`);
        return;
      }
      const layout = args.join(' ').trim();
      if (!normalizeLayoutName(layout)) {
        statusApi?.setMessage('Usage: layout <name>');
        return;
      }
      setCurrentSpaceContext({ space: 1, layout });
      return;
    }

    if (verb === 'laymcur') {
      const resolved = resolveSelectionCurrentLayer(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYMCUR failed');
        return;
      }
      setCurrentLayer(resolved.layerId);
      return;
    }

    if (verb === 'layiso') {
      const resolved = resolveSelectionIsolationLayers(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYISO failed');
        return;
      }
      applyLayerIsolationByIds(resolved.layerIds);
      return;
    }

    if (verb === 'layuniso') {
      restoreLayerIsolationSession();
      return;
    }

    if (verb === 'layoff') {
      const resolved = resolveSelectionLayerOffLayers(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYOFF failed');
        return;
      }
      applyLayerOffByIds(resolved.layerIds);
      return;
    }

    if (verb === 'layon') {
      restoreLayerOffSession();
      return;
    }

    if (verb === 'layfrz') {
      const resolved = resolveSelectionLayerFreezeLayers(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYFRZ failed');
        return;
      }
      applyLayerFreezeByIds(resolved.layerIds);
      return;
    }

    if (verb === 'laythw') {
      restoreLayerFreezeSession();
      return;
    }

    if (verb === 'laylck' || verb === 'laylock') {
      const resolved = resolveSelectionLayerLockLayers(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYLCK failed');
        return;
      }
      applyLayerLockByIds(resolved.layerIds);
      return;
    }

    if (verb === 'layulk' || verb === 'layunlock') {
      const resolved = resolveSelectionLayerUnlockLayers(documentState, selectionState);
      if (!resolved?.ok) {
        statusApi?.setMessage(resolved?.message || 'LAYULK failed');
        return;
      }
      applyLayerUnlockByIds(resolved.layerIds);
      return;
    }

    if (verb === 'lineweight') {
      const value = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
      if (!Number.isFinite(value) || value < 0) {
        statusApi?.setMessage('Usage: lineweight <number>=0');
        return;
      }
      const result = commandBus.execute('selection.propertyPatch', { patch: { lineWeight: value, lineWeightSource: 'EXPLICIT' } });
      statusApi?.setMessage(result.message || 'Line weight updated');
      return;
    }

    if (verb === 'linetype') {
      const lineType = args.join(' ').trim().toUpperCase();
      if (!lineType) {
        statusApi?.setMessage('Usage: linetype <name>');
        return;
      }
      const result = commandBus.execute('selection.propertyPatch', { patch: { lineType } });
      statusApi?.setMessage(result.message || 'Line type updated');
      return;
    }

    if (verb === 'ltscale' || verb === 'linetypescale') {
      const value = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
      if (!Number.isFinite(value) || value < 0) {
        statusApi?.setMessage('Usage: ltscale <number>=0');
        return;
      }
      const result = commandBus.execute('selection.propertyPatch', { patch: { lineTypeScale: value, lineTypeScaleSource: 'EXPLICIT' } });
      statusApi?.setMessage(result.message || 'Line type scale updated');
      return;
    }

    if (verb === 'insgrp' || verb === 'insertgroup') {
      const result = commandBus.execute('selection.insertGroup');
      statusApi?.setMessage(result.message || 'Insert group selected');
      return;
    }

    if (verb === 'instext' || verb === 'inserttext') {
      const result = commandBus.execute('selection.insertSelectText');
      statusApi?.setMessage(result.message || 'Insert text selected');
      return;
    }

    if (verb === 'instextedit' || verb === 'inserteditabletext') {
      const result = commandBus.execute('selection.insertSelectEditableText');
      statusApi?.setMessage(result.message || 'Editable insert text selected');
      return;
    }

    if (verb === 'srcgrp' || verb === 'sourcegroup') {
      const result = commandBus.execute('selection.sourceGroup');
      statusApi?.setMessage(result.message || 'Source group selected');
      return;
    }

    if (verb === 'insedit' || verb === 'inserteditable') {
      const result = commandBus.execute('selection.insertEditableGroup');
      statusApi?.setMessage(result.message || 'Editable insert members selected');
      return;
    }

    if (verb === 'insrel' || verb === 'insertrelease') {
      const result = commandBus.execute('selection.insertReleaseGroup');
      statusApi?.setMessage(result.message || 'Insert group released');
      return;
    }

    if (verb === 'insreledit' || verb === 'insertedittext') {
      const result = commandBus.execute('selection.insertEditText');
      statusApi?.setMessage(result.message || 'Insert text released');
      return;
    }

    if (verb === 'srcrel' || verb === 'sourcerelease') {
      const result = commandBus.execute('selection.sourceReleaseGroup');
      statusApi?.setMessage(result.message || 'Source group released');
      return;
    }

    if (verb === 'srcedit' || verb === 'sourceedit') {
      const result = commandBus.execute('selection.sourceEditGroupText');
      statusApi?.setMessage(result.message || 'Source text selected');
      return;
    }

    if (verb === 'srctext' || verb === 'sourcetext') {
      const result = commandBus.execute('selection.sourceSelectText');
      statusApi?.setMessage(result.message || 'Source text selected');
      return;
    }

    if (verb === 'srcplace' || verb === 'sourceplace') {
      const result = commandBus.execute('selection.sourceResetTextPlacement');
      statusApi?.setMessage(result.message || 'Source text placement reset');
      return;
    }

    if (verb === 'dimflip' || verb === 'dimensionflip' || verb === 'srcflip' || verb === 'sourceflip') {
      const result = commandBus.execute('selection.dimensionFlipTextSide');
      statusApi?.setMessage(result.message || 'Applied opposite DIMENSION text side');
      return;
    }

    if (verb === 'leadflip' || verb === 'leaderflip') {
      const result = commandBus.execute('selection.leaderFlipLandingSide');
      statusApi?.setMessage(result.message || 'Applied opposite LEADER landing side');
      return;
    }

    if (verb === 'srcanchor' || verb === 'sourceanchor') {
      const { primary, guide } = resolveSourceTextGuideForSelection(documentState, selectionState);
      if (!primary || !guide) {
        statusApi?.setMessage('Fit Source Anchor requires an imported DIMENSION/LEADER source text selection');
        return;
      }
      const extents = computeSourceTextGuideExtents(guide);
      if (!extents) {
        statusApi?.setMessage('Fit Source Anchor failed');
        return;
      }
      fitViewToExtents({ viewState, canvas, extents, paddingPx: 88 });
      statusApi?.setMessage(`Fit Source Anchor: ${formatSourceGroupLabel(primary)}`);
      return;
    }

    if (verb === 'leadfit' || verb === 'leaderfit') {
      const { primary, guide } = resolveSourceTextGuideForSelection(documentState, selectionState);
      if (!primary || !guide || String(guide.sourceType || '').trim().toUpperCase() !== 'LEADER' || !guide.elbowPoint) {
        statusApi?.setMessage('Fit Leader Landing requires an imported LEADER source text selection');
        return;
      }
      const extents = computeSourceTextGuideExtents(guide);
      if (!extents) {
        statusApi?.setMessage('Fit Leader Landing failed');
        return;
      }
      fitViewToExtents({ viewState, canvas, extents, paddingPx: 88 });
      statusApi?.setMessage(`Fit Leader Landing: ${formatSourceGroupLabel(primary)}`);
      return;
    }

    if (verb === 'srcdriver' || verb === 'sourceanchordriver') {
      const result = commandBus.execute('selection.sourceSelectAnchorDriver');
      statusApi?.setMessage(result.message || 'Source anchor driver selected');
      return;
    }

    if (verb === 'insfit' || verb === 'insertfit') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      if (!primary || !isInsertGroupEntity(primary)) {
        statusApi?.setMessage('Fit Insert Group requires an imported insert selection');
        return;
      }
      const bounds = computeInsertGroupBounds(documentState.listEntities(), primary);
      if (!bounds) {
        statusApi?.setMessage('Fit Insert Group failed');
        return;
      }
      fitViewToExtents({ viewState, canvas, extents: bounds, paddingPx: 72 });
      statusApi?.setMessage(`Fit Insert Group: ${primary.blockName || primary.groupId || primary.id}`);
      return;
    }

    if (verb === 'srcfit' || verb === 'sourcefit') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      if (!primary || !isSourceGroupEntity(primary)) {
        statusApi?.setMessage('Fit Source Group requires a grouped source selection');
        return;
      }
      const bounds = computeSourceGroupBounds(documentState.listEntities(), primary);
      if (!bounds) {
        statusApi?.setMessage('Fit Source Group failed');
        return;
      }
      fitViewToExtents({ viewState, canvas, extents: bounds, paddingPx: 72 });
      statusApi?.setMessage(`Fit Source Group: ${formatSourceGroupLabel(primary)}`);
      return;
    }

    if (verb === 'inspeer' || verb === 'insertpeer') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      const rawTarget = args.join(' ').trim();
      const normalizedTarget = rawTarget.toLowerCase();
      const numericTarget = rawTarget ? Number.parseInt(rawTarget, 10) : NaN;
      const options = normalizedTarget === 'prev' || normalizedTarget === 'previous'
        ? { direction: -1 }
        : (rawTarget && Number.isFinite(numericTarget) && String(numericTarget) === rawTarget
            ? { peerIndex: numericTarget - 1 }
            : (rawTarget ? { targetLayout: rawTarget } : { direction: 1 }));
      if (openInsertPeer(primary?.id, options) === false) {
        statusApi?.setMessage(rawTarget ? `Peer Insert unavailable: ${rawTarget}` : 'Peer Insert unavailable');
      }
      return;
    }

    if (verb === 'insprev' || verb === 'insertpeerprev') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      if (openInsertPeer(primary?.id, { direction: -1 }) === false) {
        statusApi?.setMessage('Previous Peer Insert unavailable');
      }
      return;
    }

    if (verb === 'relinsgrp' || verb === 'releasedinsertgroup') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      const payload = Number.isFinite(primary?.id) ? { targetId: primary.id } : undefined;
      const result = commandBus.execute('selection.releasedInsertGroup', payload);
      statusApi?.setMessage(result.message || 'Released insert group selected');
      return;
    }

    if (verb === 'relinsfit' || verb === 'releasedinsertfit') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      if (fitReleasedInsertGroup(primary?.id) === false) {
        statusApi?.setMessage('Fit Released Insert Group unavailable');
      }
      return;
    }

    if (verb === 'relinspeer' || verb === 'releasedinsertpeer') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      const rawTarget = args.join(' ').trim();
      const normalizedTarget = rawTarget.toLowerCase();
      const numericTarget = rawTarget ? Number.parseInt(rawTarget, 10) : NaN;
      const options = normalizedTarget === 'prev' || normalizedTarget === 'previous'
        ? { direction: -1 }
        : (rawTarget && Number.isFinite(numericTarget) && String(numericTarget) === rawTarget
            ? { peerIndex: numericTarget - 1 }
            : (rawTarget ? { targetLayout: rawTarget } : { direction: 1 }));
      if (openReleasedInsertPeer(primary?.id, options) === false) {
        statusApi?.setMessage(rawTarget ? `Released Peer Insert unavailable: ${rawTarget}` : 'Released Peer Insert unavailable');
      }
      return;
    }

    if (verb === 'relinsprev' || verb === 'releasedinsertpeerprev') {
      const primary = documentState.getEntity(selectionState.primaryId)
        || documentState.getEntity((selectionState.entityIds || [])[0]);
      if (openReleasedInsertPeer(primary?.id, { direction: -1 }) === false) {
        statusApi?.setMessage('Previous Released Peer Insert unavailable');
      }
      return;
    }

    if (verb === 'exportcadgf') {
      exportCadgf();
      return;
    }

    if (verb === 'fillet') {
      const radius = args.length > 0 ? Number.parseFloat(args[0]) : 1.0;
      const result = commandBus.execute('selection.fillet', { radius });
      statusApi?.setMessage(result.message || 'Fillet');
      return;
    }

    if (verb === 'chamfer') {
      const d1 = args.length > 0 ? Number.parseFloat(args[0]) : 1.0;
      const d2 = args.length > 1 ? Number.parseFloat(args[1]) : d1;
      const result = commandBus.execute('selection.chamfer', { d1, d2 });
      statusApi?.setMessage(result.message || 'Chamfer');
      return;
    }

    statusApi?.setMessage(`Unknown command: ${verb}`);
  }

  function importPayload(payload, { fitView = false } = {}) {
    layerIsolationSession = null;
    if (isCadgfDocument(payload)) {
      const imported = importCadgfDocument(payload);
      documentState.restore(imported.docSnapshot);
      selectionState.clear();
      syncCurrentLayer({ preferredId: null, preferPopulated: true });
      syncCurrentSpaceContext({ preferred: documentState.getCurrentSpaceContext() });
      cadgfBaseDocument = imported.baseCadgfJson;
      // Auto-enable dark mode for DXF/DWG imports (white entities on white bg are invisible)
      if (canvasView) canvasView.darkMode = true;
      if (fitView) {
        // Defer fit to next frame to ensure canvas layout is complete
        requestAnimationFrame(() => {
          canvasView?.resize?.();
          fitViewToDocument({ documentState, viewState, canvas });
          canvasView?.render?.();
        });
      }
      statusApi?.setMessage(imported.warnings.length > 0
        ? `CADGF imported with ${imported.warnings.length} warnings`
        : 'CADGF document imported');
      return;
    }

    cadgfBaseDocument = null;
    hydrateDocument(documentState, payload, selectionState, snapState, viewState);
    syncCurrentLayer({ preferredId: null, preferPopulated: true });
    syncCurrentSpaceContext({ preferred: documentState.getCurrentSpaceContext() });
    statusApi?.setMessage('Document imported');
    if (fitView) {
      fitViewToDocument({ documentState, viewState, canvas });
    }
  }

  const importer = createImporter((payload) => {
    try {
      importPayload(payload, { fitView: false });
    } catch (error) {
      statusApi?.setMessage(`Import failed: ${error?.message || String(error)}`);
    }
  }, { accept: '.json,application/json,.dxf' });
  const solverImporter = createImporter((payload) => {
    setSolverDiagnostics(payload, 'Solver diagnostics imported');
  }, {
    id: 'cad-solver-json-input',
    onError: (error) => {
      statusApi?.setMessage(`Solver diagnostics import failed: ${error?.message || String(error)}`);
    },
  });

  if (solverImportButton) {
    solverImportButton.addEventListener('click', () => solverImporter.open());
  }
  if (solverClearButton) {
    solverClearButton.disabled = true;
    solverClearButton.addEventListener('click', () => {
      if (!solverDiagnostics) {
        statusApi?.setMessage('Solver diagnostics already cleared');
        return;
      }
      setSolverDiagnostics(null, 'Solver diagnostics cleared');
    });
  }

  // --- Constraint panel wiring ---
  const constraintTypeSelect = document.getElementById('cad-constraint-type');
  const constraintRefsInput = document.getElementById('cad-constraint-refs');
  const constraintValueInput = document.getElementById('cad-constraint-value');
  const addConstraintButton = document.getElementById('cad-add-constraint');
  const constraintListEl = document.getElementById('cad-constraint-list');
  const constraintCountBadge = document.getElementById('cad-constraint-count');
  const exportSolverProjectButton = document.getElementById('cad-export-solver-project');
  const clearConstraintsButton = document.getElementById('cad-clear-constraints');

  function renderConstraintList() {
    if (!constraintListEl) return;
    const constraints = documentState.listConstraints();
    constraintListEl.innerHTML = '';
    for (const c of constraints) {
      const item = document.createElement('div');
      item.className = 'cad-constraint-item';
      const label = document.createElement('span');
      label.className = 'cad-constraint-item__label';
      label.textContent = c.type;
      const refs = document.createElement('span');
      refs.className = 'cad-constraint-item__refs';
      refs.textContent = c.refs.join(', ') + (c.value !== undefined ? ` = ${c.value}` : '');
      const removeBtn = document.createElement('button');
      removeBtn.className = 'cad-constraint-item__remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => {
        documentState.removeConstraint(c.id);
        renderConstraintList();
      });
      item.appendChild(label);
      item.appendChild(refs);
      item.appendChild(removeBtn);
      constraintListEl.appendChild(item);
    }
    if (constraintCountBadge) constraintCountBadge.textContent = String(constraints.length);
    if (clearConstraintsButton) clearConstraintsButton.disabled = constraints.length === 0;
  }

  function deriveConstraintRefs(type, ids) {
    if (!ids || ids.length === 0) return '';
    const entities = ids.map((id) => documentState.getEntity(id)).filter(Boolean);
    if (entities.length === 0) return '';

    if (type === 'horizontal' && entities.length >= 2) {
      // Two y-coords from two entities' start points
      return entities.slice(0, 2).map((e) => {
        if (e.type === 'line') return `e${e.id}_start.y`;
        if (e.type === 'circle' || e.type === 'arc') return `e${e.id}_center.y`;
        return '';
      }).filter(Boolean).join(', ');
    }
    if (type === 'vertical' && entities.length >= 2) {
      return entities.slice(0, 2).map((e) => {
        if (e.type === 'line') return `e${e.id}_start.x`;
        if (e.type === 'circle' || e.type === 'arc') return `e${e.id}_center.x`;
        return '';
      }).filter(Boolean).join(', ');
    }
    if ((type === 'distance' || type === 'coincident' || type === 'concentric') && entities.length >= 2) {
      // Two points: x0,y0,x1,y1
      const pts = entities.slice(0, 2).map((e) => {
        if (e.type === 'line') return [`e${e.id}_start.x`, `e${e.id}_start.y`];
        if (e.type === 'circle' || e.type === 'arc') return [`e${e.id}_center.x`, `e${e.id}_center.y`];
        return [];
      });
      return pts.flat().join(', ');
    }
    if (type === 'angle' && entities.length >= 2) {
      // Two line segments: 8 vars
      const lines = entities.filter((e) => e.type === 'line').slice(0, 2);
      if (lines.length < 2) return '';
      return [
        `e${lines[0].id}_start.x`, `e${lines[0].id}_start.y`,
        `e${lines[0].id}_end.x`, `e${lines[0].id}_end.y`,
        `e${lines[1].id}_start.x`, `e${lines[1].id}_start.y`,
        `e${lines[1].id}_end.x`, `e${lines[1].id}_end.y`,
      ].join(', ');
    }
    return '';
  }

  function syncConstraintRefsFromSelection() {
    if (!constraintRefsInput || !constraintTypeSelect) return;
    const type = constraintTypeSelect.value;
    const ids = selectionState.entityIds;
    const derived = deriveConstraintRefs(type, ids);
    if (derived) {
      constraintRefsInput.value = derived;
      constraintRefsInput.placeholder = 'Auto-filled from selection';
    }
  }

  if (constraintTypeSelect && constraintValueInput) {
    const valueTypes = new Set(['distance', 'angle']);
    constraintTypeSelect.addEventListener('change', () => {
      constraintValueInput.style.display = valueTypes.has(constraintTypeSelect.value) ? '' : 'none';
      syncConstraintRefsFromSelection();
    });
  }

  selectionState.addEventListener('change', () => {
    syncConstraintRefsFromSelection();
  });

  if (addConstraintButton) {
    addConstraintButton.addEventListener('click', () => {
      const type = constraintTypeSelect?.value || 'horizontal';
      const refsRaw = (constraintRefsInput?.value || '').trim();
      if (!refsRaw) {
        statusApi?.setMessage('Select 2 entities or enter refs manually');
        return;
      }
      const refs = refsRaw.split(',').map((r) => r.trim()).filter(Boolean);
      const raw = { type, refs };
      if (constraintValueInput && constraintValueInput.style.display !== 'none') {
        const v = parseFloat(constraintValueInput.value);
        if (Number.isFinite(v)) raw.value = v;
      }
      documentState.addConstraint(raw);
      if (constraintRefsInput) constraintRefsInput.value = '';
      if (constraintValueInput) constraintValueInput.value = '';
      renderConstraintList();
      statusApi?.setMessage(`Added ${type} constraint`);
    });
  }

  if (exportSolverProjectButton) {
    exportSolverProjectButton.addEventListener('click', () => {
      const result = commandBus.execute('solver.export-project');
      if (!result.ok) {
        statusApi?.setMessage(result.message || 'Export failed');
        return;
      }
      downloadJson('solver_project.json', result.project);
      statusApi?.setMessage('Solver project exported');
    });
  }

  if (clearConstraintsButton) {
    clearConstraintsButton.addEventListener('click', () => {
      documentState.clearConstraints();
      renderConstraintList();
      statusApi?.setMessage('All constraints cleared');
    });
  }

  renderConstraintList();

  function exportCadgf() {
    const payload = exportCadgfDocument(documentState, { baseCadgfJson: cadgfBaseDocument });
    downloadJson('document.json', payload);
    statusApi?.setMessage('CADGF document exported');
  }

  toolbar = createToolbar({
    onToolChange: (toolId) => setActiveTool(toolId),
    onCommandRun: (text) => runTypedCommand(text),
    onImport: () => importer.open(),
    onExport: () => {
      const payload = serializeDocument(documentState, selectionState, snapState, viewState);
      downloadJson(`vemcad-web-${Date.now()}.json`, payload);
      statusApi?.setMessage('Document exported');
    },
    onExportCadgf: () => exportCadgf(),
    onFitView: () => {
      fitViewToDocument({ documentState, viewState, canvas });
      statusApi?.setMessage('Fit view');
    },
    onClear: () => {
      documentState.clearEntities();
      selectionState.clear();
      syncCurrentLayer({ preferredId: currentLayerId });
      statusApi?.setMessage('Document cleared');
    },
    onUndo: () => {
      const result = commandBus.execute('history.undo');
      statusApi?.setMessage(result.message || 'Undo');
    },
    onRedo: () => {
      const result = commandBus.execute('history.redo');
      statusApi?.setMessage(result.message || 'Redo');
    },
  });

  function toggleOrtho() {
    snapState.toggle('ortho');
    statusApi.setMessage(`Ortho ${snapState.toJSON().ortho ? 'On' : 'Off'}`);
  }

  function toggleSnap() {
    const options = snapState.toJSON();
    const enabled = options.endpoint || options.midpoint || options.quadrant || options.center || options.intersection || options.nearest || options.tangent;
    const next = !enabled;
    snapState.setOption('endpoint', next);
    snapState.setOption('midpoint', next);
    snapState.setOption('quadrant', next);
    snapState.setOption('center', next);
    snapState.setOption('intersection', next);
    snapState.setOption('nearest', next);
    snapState.setOption('tangent', next);
    statusApi.setMessage(`Snap ${next ? 'On' : 'Off'}`);
  }

  function toggleGrid() {
    snapState.toggle('grid');
    viewState.setShowGrid(snapState.toJSON().grid);
    statusApi.setMessage(`Grid ${snapState.toJSON().grid ? 'On' : 'Off'}`);
  }

  statusApi = createStatusBar({
    snapState,
    toolOptions,
    onToggleOrtho: () => toggleOrtho(),
    onToggleSnap: () => toggleSnap(),
    onToggleGrid: () => toggleGrid(),
    onToggleBreakKeep: () => {
      const order = ['auto', 'short', 'long'];
      const current = typeof toolOptions.breakKeep === 'string' ? toolOptions.breakKeep : 'auto';
      const idx = Math.max(0, order.indexOf(current));
      toolOptions.breakKeep = order[(idx + 1) % order.length];
      statusApi.refreshToggleLabels();
      statusApi.setMessage(`Break keep: ${toolOptions.breakKeep}`);
    },
    onActivateSolver: () => activateSolverStatusFlow(),
  });

  // Keep the canvas grid renderer in sync with snapState.grid regardless of which UI toggles it.
  snapState.addEventListener('change', (event) => {
    const options = event?.detail?.options;
    if (options && typeof options.grid === 'boolean') {
      viewState.setShowGrid(options.grid);
    }
  });

  function pruneSelectionToRenderable() {
    if (!Array.isArray(selectionState.entityIds) || selectionState.entityIds.length === 0) {
      return;
    }
    const nextIds = selectionState.entityIds.filter((id) => {
      if (documentState.isEntityRenderable(id)) {
        return true;
      }
      const entity = documentState.getEntity(id);
      return isInsertTextProxyEntity(entity);
    });
    if (nextIds.length === selectionState.entityIds.length) {
      return;
    }
    const nextPrimary = Number.isFinite(selectionState.primaryId) && nextIds.includes(selectionState.primaryId)
      ? selectionState.primaryId
      : (nextIds[0] ?? null);
    selectionState.setSelection(nextIds, nextPrimary);
  }

  const layerStatusLabel = (state, onLabel, offLabel) => (state ? onLabel : offLabel);
  let propertyPanel = null;

  function getCurrentLayer() {
    return documentState.getLayer(currentLayerId) || null;
  }

  function hasLayerIsolation() {
    return !!layerIsolationSession
      && Array.isArray(layerIsolationSession.restore)
      && layerIsolationSession.restore.length > 0;
  }

  function hasLayerOff() {
    return !!layerOffSession
      && Array.isArray(layerOffSession.restore)
      && layerOffSession.restore.length > 0;
  }

  function hasLayerFreeze() {
    return !!layerFreezeSession
      && Array.isArray(layerFreezeSession.restore)
      && layerFreezeSession.restore.length > 0;
  }

  function refreshCurrentLayerStatus() {
    statusApi?.setLayer(`Current: ${formatLayerRef(getCurrentLayer())}`);
  }

  function getCurrentSpaceContext() {
    return documentState.getCurrentSpaceContext();
  }

  function refreshCurrentSpaceStatus() {
    statusApi?.setSpace(`Space: ${formatSpaceLayoutLabel(getCurrentSpaceContext())}`);
  }

  function syncCurrentSpaceContext({ preferred = getCurrentSpaceContext() } = {}) {
    const next = resolveCurrentSpaceLayoutContext(documentState.listEntities(), preferred);
    const current = getCurrentSpaceContext();
    const changed = current.space !== next.space || current.layout !== next.layout;
    if (changed) {
      documentState.setCurrentSpaceContext(next);
    } else {
      refreshCurrentSpaceStatus();
    }
    pruneSelectionToRenderable();
    propertyPanel?.render?.();
    return { changed, context: getCurrentSpaceContext() };
  }

  function setCurrentSpaceContext(context, { announce = true } = {}) {
    const next = resolveCurrentSpaceLayoutContext(documentState.listEntities(), context);
    const current = getCurrentSpaceContext();
    const changed = current.space !== next.space || current.layout !== next.layout;
    if (!changed) {
      refreshCurrentSpaceStatus();
      if (announce) {
        statusApi?.setMessage(`Current space: ${formatSpaceLayoutLabel(next)}`);
      }
      return false;
    }
    documentState.setCurrentSpaceContext(next);
    pruneSelectionToRenderable();
    propertyPanel?.render?.();
    if (announce) {
      statusApi?.setMessage(`Current space: ${formatSpaceLayoutLabel(next)}`);
    }
    return true;
  }

  function openInsertPeer(entityId, {
    direction = 1,
    peerIndex = null,
    targetLayout = '',
  } = {}) {
    const entity = documentState.getEntity(entityId);
    if (!entity || !isInsertGroupEntity(entity)) {
      return false;
    }
    const entities = documentState.listEntities();
    const peerSummary = summarizeInsertPeerInstances(entities, entity);
    if (!peerSummary || peerSummary.peerCount <= 1) {
      return false;
    }
    const currentSummary = summarizeInsertGroupMembers(entities, entity);
    const currentIndex = peerSummary.currentIndex >= 0 ? peerSummary.currentIndex : 0;
    let nextIndex = resolveInsertPeerTargetIndex(peerSummary, { peerIndex, targetLayout });
    if (nextIndex < 0) {
      const step = direction < 0 ? -1 : 1;
      nextIndex = (currentIndex + step + peerSummary.peerCount) % peerSummary.peerCount;
    }
    const nextPeer = peerSummary.peers[nextIndex];
    if (!nextPeer) {
      return false;
    }

    const currentSelectionIds = Array.isArray(selectionState.entityIds)
      ? selectionState.entityIds.filter((id) => Number.isFinite(id))
      : [];
    const peerSelection = resolveInsertPeerSelection(nextPeer, entity, currentSelectionIds, currentSummary);
    const primaryId = Number.isFinite(peerSelection?.primaryId) ? peerSelection.primaryId : null;
    const nextSelectionIds = Array.isArray(peerSelection?.selectionIds) ? peerSelection.selectionIds : [];

    setCurrentSpaceContext({ space: nextPeer.space, layout: nextPeer.layout }, { announce: false });
    selectionState.setSelection(nextSelectionIds, primaryId);
    if (nextPeer.bounds) {
      fitViewToExtents({ viewState, canvas, extents: nextPeer.bounds, paddingPx: 72 });
    }
    statusApi?.setMessage(
      `Peer Insert ${nextIndex + 1}/${peerSummary.peerCount}: ${entity.blockName || entity.groupId || entity.id} | ${formatSpaceLayoutLabel({ space: nextPeer.space, layout: nextPeer.layout })}`
    );
    return {
      ok: true,
      peerIndex: nextIndex,
      peerCount: peerSummary.peerCount,
      scope: peerSelection?.scope || classifyInsertSelectionScope(entity, currentSelectionIds, currentSummary),
      selectionIds: [...nextSelectionIds],
      context: {
        space: nextPeer.space,
        layout: nextPeer.layout,
      },
    };
  }

  function fitReleasedInsertGroup(entityId) {
    const entity = documentState.getEntity(entityId);
    if (!entity) return false;
    const summary = summarizeReleasedInsertGroupMembers(documentState.listEntities(), entity);
    if (!summary || summary.memberIds.length === 0) {
      return false;
    }
    const anchor = summary.members[0];
    const bounds = anchor ? computeInsertGroupBounds(documentState.listEntities(), anchor) : null;
    if (!bounds) {
      return false;
    }
    fitViewToExtents({ viewState, canvas, extents: bounds, paddingPx: 72 });
    statusApi?.setMessage(`Fit Released Insert Group: ${summary.blockName || summary.groupId || entity.id}`);
    return true;
  }

  function openReleasedInsertPeer(entityId, {
    direction = 1,
    peerIndex = null,
    targetLayout = '',
  } = {}) {
    const entity = documentState.getEntity(entityId);
    if (!entity) {
      return false;
    }
    const entities = documentState.listEntities();
    const peerSummary = summarizeReleasedInsertPeerInstances(entities, entity);
    if (!peerSummary || peerSummary.peerCount <= 1) {
      return false;
    }
    const currentIndex = peerSummary.currentIndex;
    let nextIndex = resolveInsertPeerTargetIndex(peerSummary, { peerIndex, targetLayout });
    if (nextIndex < 0) {
      if (currentIndex < 0) {
        nextIndex = direction < 0 ? peerSummary.peerCount - 1 : 0;
      } else {
        const step = direction < 0 ? -1 : 1;
        nextIndex = (currentIndex + step + peerSummary.peerCount) % peerSummary.peerCount;
      }
    }
    const nextPeer = peerSummary.peers[nextIndex];
    if (!nextPeer) {
      return false;
    }
    const currentSelectionIds = Array.isArray(selectionState.entityIds)
      ? selectionState.entityIds.filter((id) => Number.isFinite(id))
      : [];
    const peerSelection = resolveReleasedInsertPeerSelection(nextPeer, entity, currentSelectionIds, entities);
    const primaryId = Number.isFinite(peerSelection?.primaryId) ? peerSelection.primaryId : null;
    const nextSelectionIds = Array.isArray(peerSelection?.selectionIds) ? peerSelection.selectionIds : [];
    setCurrentSpaceContext({ space: nextPeer.space, layout: nextPeer.layout }, { announce: false });
    selectionState.setSelection(nextSelectionIds, primaryId);
    if (nextPeer.bounds) {
      fitViewToExtents({ viewState, canvas, extents: nextPeer.bounds, paddingPx: 72 });
    }
    statusApi?.setMessage(
      `Released Insert Peer ${nextIndex + 1}/${peerSummary.peerCount}: ${peerSummary.blockName || peerSummary.groupId || entity.id} | ${formatSpaceLayoutLabel({ space: nextPeer.space, layout: nextPeer.layout })}`
    );
    return {
      ok: true,
      peerIndex: nextIndex,
      peerCount: peerSummary.peerCount,
      scope: peerSelection?.scope || 'released-single',
      selectionIds: [...nextSelectionIds],
      context: {
        space: nextPeer.space,
        layout: nextPeer.layout,
      },
    };
  }

  function syncCurrentLayer({ preferredId = currentLayerId, preferPopulated = false } = {}) {
    const nextLayerId = resolveCurrentLayerId(documentState, preferredId, { preferPopulated });
    const changed = currentLayerId !== nextLayerId;
    currentLayerId = nextLayerId;
    refreshCurrentLayerStatus();
    layerPanel?.render?.();
    propertyPanel?.render?.();
    return { changed, layer: getCurrentLayer() };
  }

  function setCurrentLayer(layerId, { announce = true } = {}) {
    if (!Number.isFinite(layerId)) return false;
    const normalized = Math.trunc(Number(layerId));
    const layer = documentState.getLayer(normalized);
    if (!layer || !isEditableLayer(layer)) {
      refreshCurrentLayerStatus();
      if (announce) {
        statusApi?.setMessage(`Layer unavailable for drawing: ${layer?.name || normalized}`);
      }
      return false;
    }
    currentLayerId = normalized;
    refreshCurrentLayerStatus();
    layerPanel?.render?.();
    propertyPanel?.render?.();
    if (announce) {
      statusApi?.setMessage(`Current layer: ${formatLayerRef(layer)}`);
    }
    return true;
  }

  function applyLayerIsolationByIds(layerIds, { announce = true } = {}) {
    if (hasLayerFreeze()) {
      restoreLayerFreeze(documentState, layerFreezeSession);
      layerFreezeSession = null;
    }
    if (hasLayerOff()) {
      restoreLayerOff(documentState, layerOffSession);
      layerOffSession = null;
    }
    if (hasLayerIsolation()) {
      restoreLayerIsolation(documentState, layerIsolationSession);
      layerIsolationSession = null;
    }
    const isolated = activateLayerIsolation(documentState, layerIds);
    if (!isolated?.ok) {
      if (announce) {
        statusApi?.setMessage(isolated?.message || 'LAYISO failed');
      }
      return false;
    }
    layerIsolationSession = isolated.session;
    const sync = syncCurrentLayer({ preferredId: currentLayerId });
    const labels = isolated.keepLayerIds
      .map((layerId) => formatLayerRef(documentState.getLayer(layerId)))
      .filter(Boolean)
      .join(', ');
    if (announce) {
      statusApi?.setMessage(`LAYISO: ${labels || isolated.keepLayerIds.join(', ')} | hid ${isolated.hiddenCount} layer${isolated.hiddenCount === 1 ? '' : 's'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function applyLayerOffByIds(layerIds, { announce = true } = {}) {
    if (hasLayerFreeze()) {
      restoreLayerFreeze(documentState, layerFreezeSession);
      layerFreezeSession = null;
    }
    if (hasLayerIsolation()) {
      restoreLayerIsolation(documentState, layerIsolationSession);
      layerIsolationSession = null;
    }
    if (hasLayerOff()) {
      restoreLayerOff(documentState, layerOffSession);
      layerOffSession = null;
    }
    const turnedOff = activateLayerOff(documentState, layerIds, { currentLayerId });
    if (!turnedOff?.ok) {
      if (announce) {
        statusApi?.setMessage(turnedOff?.message || 'LAYOFF failed');
      }
      return false;
    }
    layerOffSession = turnedOff.session;
    const preferredId = Number.isFinite(turnedOff.nextCurrentLayerId)
      ? turnedOff.nextCurrentLayerId
      : currentLayerId;
    const sync = syncCurrentLayer({ preferredId });
    const labels = turnedOff.offLayerIds
      .map((layerId) => formatLayerRef(documentState.getLayer(layerId)))
      .filter(Boolean)
      .join(', ');
    if (announce) {
      statusApi?.setMessage(`LAYOFF: ${labels || turnedOff.offLayerIds.join(', ')} | hid ${turnedOff.hiddenCount} layer${turnedOff.hiddenCount === 1 ? '' : 's'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function applyLayerFreezeByIds(layerIds, { announce = true } = {}) {
    if (hasLayerIsolation()) {
      restoreLayerIsolation(documentState, layerIsolationSession);
      layerIsolationSession = null;
    }
    if (hasLayerOff()) {
      restoreLayerOff(documentState, layerOffSession);
      layerOffSession = null;
    }
    if (hasLayerFreeze()) {
      restoreLayerFreeze(documentState, layerFreezeSession);
      layerFreezeSession = null;
    }
    const frozen = activateLayerFreeze(documentState, layerIds, { currentLayerId });
    if (!frozen?.ok) {
      if (announce) {
        statusApi?.setMessage(frozen?.message || 'LAYFRZ failed');
      }
      return false;
    }
    layerFreezeSession = frozen.session;
    const preferredId = Number.isFinite(frozen.nextCurrentLayerId)
      ? frozen.nextCurrentLayerId
      : currentLayerId;
    const sync = syncCurrentLayer({ preferredId });
    const labels = frozen.freezeLayerIds
      .map((layerId) => formatLayerRef(documentState.getLayer(layerId)))
      .filter(Boolean)
      .join(', ');
    if (announce) {
      const targetCount = Array.isArray(frozen.freezeLayerIds) ? frozen.freezeLayerIds.length : 0;
      statusApi?.setMessage(`LAYFRZ: ${labels || frozen.freezeLayerIds.join(', ')} | froze ${targetCount} layer${targetCount === 1 ? '' : 's'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function restoreLayerIsolationSession({ announce = true } = {}) {
    if (!hasLayerIsolation()) {
      if (announce) {
        statusApi?.setMessage('LAYUNISO: no active isolation session');
      }
      return false;
    }
    const restored = restoreLayerIsolation(documentState, layerIsolationSession);
    layerIsolationSession = null;
    const sync = syncCurrentLayer({ preferredId: currentLayerId });
    if (announce) {
      statusApi?.setMessage(`LAYUNISO: restored ${restored.restoredCount} layer visibility states${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function restoreLayerOffSession({ announce = true } = {}) {
    if (!hasLayerOff()) {
      if (announce) {
        statusApi?.setMessage('LAYON: no active layer-off session');
      }
      return false;
    }
    const restored = restoreLayerOff(documentState, layerOffSession);
    layerOffSession = null;
    const preferredId = Number.isFinite(restored?.restoreCurrentLayerId)
      ? restored.restoreCurrentLayerId
      : currentLayerId;
    const sync = syncCurrentLayer({ preferredId });
    if (announce) {
      statusApi?.setMessage(`LAYON: restored ${restored.restoredCount} layer visibility states${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function restoreLayerFreezeSession({ announce = true } = {}) {
    if (!hasLayerFreeze()) {
      if (announce) {
        statusApi?.setMessage('LAYTHW: no active frozen-layer session');
      }
      return false;
    }
    const restored = restoreLayerFreeze(documentState, layerFreezeSession);
    layerFreezeSession = null;
    const preferredId = Number.isFinite(restored?.restoreCurrentLayerId)
      ? restored.restoreCurrentLayerId
      : currentLayerId;
    const sync = syncCurrentLayer({ preferredId });
    if (announce) {
      statusApi?.setMessage(`LAYTHW: restored ${restored.restoredCount} layer freeze states${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function setLayerFrozenState(layerId, frozen, { announce = true } = {}) {
    if (!Number.isFinite(layerId)) return false;
    const normalized = Math.trunc(Number(layerId));
    const layer = documentState.getLayer(normalized);
    if (!layer) return false;
    const next = frozen === true;
    if (layer.frozen === next) {
      if (announce) {
        statusApi?.setMessage(`Layer ${layer.name} freeze: ${layerStatusLabel(next, 'On', 'Off')}`);
      }
      return true;
    }

    layerFreezeSession = null;

    if (next) {
      let preferredId = currentLayerId;
      if (currentLayerId === normalized) {
        const preview = activateLayerFreeze(documentState, [normalized], { currentLayerId });
        if (!preview?.ok) {
          if (announce) {
            statusApi?.setMessage(preview?.message || 'Layer freeze failed');
          }
          return false;
        }
        preferredId = Number.isFinite(preview.nextCurrentLayerId)
          ? preview.nextCurrentLayerId
          : currentLayerId;
      } else {
        documentState.updateLayer(normalized, { frozen: true });
      }
      const sync = syncCurrentLayer({ preferredId });
      if (announce) {
        statusApi?.setMessage(`Layer ${layer.name} freeze: On${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
      }
      return true;
    }

    documentState.updateLayer(normalized, { frozen: false });
    const sync = syncCurrentLayer({ preferredId: currentLayerId });
    if (announce) {
      statusApi?.setMessage(`Layer ${layer.name} freeze: Off${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function applyLayerLockByIds(layerIds, { announce = true } = {}) {
    const locked = activateLayerLock(documentState, layerIds, { currentLayerId });
    if (!locked?.ok) {
      if (announce) {
        statusApi?.setMessage(locked?.message || 'LAYLCK failed');
      }
      return false;
    }
    const preferredId = Number.isFinite(locked.nextCurrentLayerId)
      ? locked.nextCurrentLayerId
      : currentLayerId;
    const sync = syncCurrentLayer({ preferredId });
    const labels = locked.lockedLayerIds
      .map((layerId) => formatLayerRef(documentState.getLayer(layerId)))
      .filter(Boolean)
      .join(', ');
    if (announce) {
      const targetCount = Array.isArray(locked.lockedLayerIds) ? locked.lockedLayerIds.length : 0;
      statusApi?.setMessage(`LAYLCK: ${labels || locked.lockedLayerIds.join(', ')} | locked ${targetCount} layer${targetCount === 1 ? '' : 's'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function applyLayerUnlockByIds(layerIds, { announce = true } = {}) {
    const unlocked = activateLayerUnlock(documentState, layerIds);
    if (!unlocked?.ok) {
      if (announce) {
        statusApi?.setMessage(unlocked?.message || 'LAYULK failed');
      }
      return false;
    }
    const sync = syncCurrentLayer({ preferredId: currentLayerId });
    const labels = unlocked.unlockedLayerIds
      .map((layerId) => formatLayerRef(documentState.getLayer(layerId)))
      .filter(Boolean)
      .join(', ');
    if (announce) {
      const targetCount = Array.isArray(unlocked.unlockedLayerIds) ? unlocked.unlockedLayerIds.length : 0;
      statusApi?.setMessage(`LAYULK: ${labels || unlocked.unlockedLayerIds.join(', ')} | unlocked ${targetCount} layer${targetCount === 1 ? '' : 's'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  function setLayerLockedState(layerId, locked, { announce = true } = {}) {
    if (!Number.isFinite(layerId)) return false;
    const normalized = Math.trunc(Number(layerId));
    const layer = documentState.getLayer(normalized);
    if (!layer) return false;
    const next = locked === true;
    if (layer.locked === next) {
      if (announce) {
        statusApi?.setMessage(`Layer ${layer.name} lock: ${layerStatusLabel(next, 'On', 'Off')}`);
      }
      return true;
    }

    if (next) {
      const lockedResult = activateLayerLock(documentState, [normalized], { currentLayerId });
      if (!lockedResult?.ok) {
        if (announce) {
          statusApi?.setMessage(lockedResult?.message || 'Layer lock failed');
        }
        return false;
      }
      const preferredId = Number.isFinite(lockedResult.nextCurrentLayerId)
        ? lockedResult.nextCurrentLayerId
        : currentLayerId;
      const sync = syncCurrentLayer({ preferredId });
      if (announce) {
        statusApi?.setMessage(`Layer ${layer.name} lock: On${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
      }
      return true;
    }

    documentState.updateLayer(normalized, { locked: false });
    const sync = syncCurrentLayer({ preferredId: currentLayerId });
    if (announce) {
      statusApi?.setMessage(`Layer ${layer.name} lock: Off${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    }
    return true;
  }

  const getFocusedLayerId = () => {
    const ids = Array.isArray(selectionState.entityIds) ? selectionState.entityIds : [];
    if (ids.length === 0) return null;
    const primary = documentState.getEntity(selectionState.primaryId) || ids
      .map((id) => documentState.getEntity(id))
      .find((entity) => !!entity);
    return Number.isFinite(primary?.layerId) ? Number(primary.layerId) : null;
  };

  let layerPanel = null;

  const focusLayer = (layerId) => {
    if (!Number.isFinite(layerId)) return false;
    return layerPanel?.focusLayer?.(layerId, { scroll: true }) === true;
  };

  const unlockLayer = (layerId) => {
    if (!Number.isFinite(layerId)) return false;
    const layer = documentState.getLayer(layerId);
    if (!layer) return false;
    if (layer.locked !== true) {
      layerPanel?.focusLayer?.(layerId, { scroll: true });
      return true;
    }
    const ok = setLayerLockedState(layerId, false);
    if (!ok) {
      return false;
    }
    layerPanel?.focusLayer?.(layerId, { scroll: true });
    return true;
  };

  const lockLayer = (layerId) => {
    if (!Number.isFinite(layerId)) return false;
    const layer = documentState.getLayer(layerId);
    if (!layer) return false;
    if (layer.locked === true) {
      layerPanel?.focusLayer?.(layerId, { scroll: true });
      return true;
    }
    const ok = setLayerLockedState(layerId, true);
    if (!ok) {
      return false;
    }
    layerPanel?.focusLayer?.(layerId, { scroll: true });
    return true;
  };

  layerPanel = createLayerPanel({
    documentState,
    getFocusedLayerId,
    getCurrentLayerId: () => currentLayerId,
    onAddLayer: (name) => {
      const layer = documentState.addLayer(name || 'Layer');
      setCurrentLayer(layer.id, { announce: false });
      layerPanel?.focusLayer?.(layer.id, { scroll: true });
      statusApi.setMessage(`Layer added: ${formatLayerRef(layer)} (current)`);
    },
    onSetCurrentLayer: (layer) => {
      setCurrentLayer(layer.id);
    },
    onToggleVisibility: (layer) => {
      documentState.updateLayer(layer.id, { visible: !layer.visible });
      const sync = syncCurrentLayer({ preferredId: currentLayerId });
      statusApi.setMessage(`Layer ${layer.name} visibility: ${!layer.visible ? 'On' : 'Off'}${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
    },
    onTurnOffLayer: (layer) => applyLayerOffByIds([layer.id]),
    onTurnOnLayer: (layer) => {
      if (hasLayerOff()) {
        return restoreLayerOffSession();
      }
      documentState.updateLayer(layer.id, { visible: true });
      const sync = syncCurrentLayer({ preferredId: currentLayerId });
      statusApi.setMessage(`Layer ${layer.name} visibility: On${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
      return true;
    },
    onToggleLocked: (layer) => {
      return setLayerLockedState(layer.id, layer.locked !== true);
    },
    onToggleFrozen: (layer) => {
      return setLayerFrozenState(layer.id, layer.frozen !== true);
    },
    onTogglePrintable: (layer) => {
      const next = layer.printable === false;
      documentState.updateLayer(layer.id, { printable: next });
      statusApi.setMessage(`Layer ${layer.name} print: ${layerStatusLabel(next, 'On', 'Off')}`);
    },
    onToggleConstruction: (layer) => {
      const next = !layer.construction;
      documentState.updateLayer(layer.id, { construction: next });
      statusApi.setMessage(`Layer ${layer.name} construction: ${layerStatusLabel(next, 'On', 'Off')}`);
    },
  });

  propertyPanel = createPropertyPanel({
    documentState,
    selectionState,
    commandBus,
    focusLayer,
    getCurrentLayerId: () => currentLayerId,
    getCurrentLayer,
    getCurrentSpaceContext,
    setCurrentSpaceContext: (context) => setCurrentSpaceContext(context),
    listPaperLayouts: () => documentState.listPaperLayouts(),
    selectSourceGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceGroup', payload);
      statusApi.setMessage(result.message || 'Source group selected');
      return result;
    },
    selectSourceText: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceSelectText', payload);
      statusApi.setMessage(result.message || 'Source text selected');
      return result;
    },
    selectSourceAnchorDriver: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceSelectAnchorDriver', payload);
      statusApi.setMessage(result.message || 'Source anchor driver selected');
      return result;
    },
    resetSourceTextPlacement: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceResetTextPlacement', payload);
      statusApi.setMessage(result.message || 'Source text placement reset');
      return result;
    },
    flipDimensionTextSide: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.dimensionFlipTextSide', payload);
      statusApi.setMessage(result.message || 'Applied opposite DIMENSION text side');
      return result;
    },
    flipLeaderLandingSide: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.leaderFlipLandingSide', payload);
      statusApi.setMessage(result.message || 'Applied opposite LEADER landing side');
      return result;
    },
    fitSourceAnchor: (entityId) => {
      const entity = documentState.getEntity(entityId);
      if (!entity || !isSourceGroupEntity(entity) || isInsertGroupEntity(entity)) return false;
      const guide = resolveSourceTextGuide(documentState.listEntities(), entity);
      if (!guide) return false;
      const extents = computeSourceTextGuideExtents(guide);
      if (!extents) return false;
      fitViewToExtents({ viewState, canvas, extents, paddingPx: 88 });
      statusApi.setMessage(`Fit Source Anchor: ${formatSourceGroupLabel(entity)}`);
      return true;
    },
    fitLeaderLanding: (entityId) => {
      const entity = documentState.getEntity(entityId);
      if (!entity || !isSourceGroupEntity(entity) || isInsertGroupEntity(entity)) return false;
      const guide = resolveSourceTextGuide(documentState.listEntities(), entity);
      if (!guide || String(guide.sourceType || '').trim().toUpperCase() !== 'LEADER' || !guide.elbowPoint) return false;
      const extents = computeSourceTextGuideExtents(guide);
      if (!extents) return false;
      fitViewToExtents({ viewState, canvas, extents, paddingPx: 88 });
      statusApi.setMessage(`Fit Leader Landing: ${formatSourceGroupLabel(entity)}`);
      return true;
    },
    selectInsertGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertGroup', payload);
      statusApi.setMessage(result.message || 'Insert group selected');
      return result;
    },
    selectReleasedInsertGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.releasedInsertGroup', payload);
      statusApi.setMessage(result.message || 'Released insert group selected');
      return result;
    },
    selectInsertText: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertSelectText', payload);
      statusApi.setMessage(result.message || 'Insert text selected');
      return result;
    },
    selectEditableInsertText: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertSelectEditableText', payload);
      statusApi.setMessage(result.message || 'Editable insert text selected');
      return result;
    },
    selectEditableInsertGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertEditableGroup', payload);
      statusApi.setMessage(result.message || 'Editable insert members selected');
      return result;
    },
    editInsertText: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertEditText', payload);
      statusApi.setMessage(result.message || 'Insert text released');
      return result;
    },
    fitInsertGroup: (entityId) => {
      const entity = documentState.getEntity(entityId);
      if (!entity || !isInsertGroupEntity(entity)) return false;
      const bounds = computeInsertGroupBounds(documentState.listEntities(), entity);
      if (!bounds) return false;
      fitViewToExtents({ viewState, canvas, extents: bounds, paddingPx: 72 });
      statusApi.setMessage(`Fit Insert Group: ${entity.blockName || entity.groupId || entity.id}`);
      return true;
    },
    fitReleasedInsertGroup: (entityId) => fitReleasedInsertGroup(entityId),
    openReleasedInsertPeer: (entityId, options = {}) => openReleasedInsertPeer(entityId, options),
    fitSourceGroup: (entityId) => {
      const entity = documentState.getEntity(entityId);
      if (!entity || !isSourceGroupEntity(entity)) return false;
      const bounds = computeSourceGroupBounds(documentState.listEntities(), entity);
      if (!bounds) return false;
      fitViewToExtents({ viewState, canvas, extents: bounds, paddingPx: 72 });
      statusApi.setMessage(`Fit Source Group: ${formatSourceGroupLabel(entity)}`);
      return true;
    },
    openInsertPeer: (entityId, options = {}) => openInsertPeer(entityId, options),
    editSourceGroupText: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceEditGroupText', payload);
      statusApi.setMessage(result.message || 'Source text selected');
      return result;
    },
    releaseSourceGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.sourceReleaseGroup', payload);
      statusApi.setMessage(result.message || 'Source group released');
      return result;
    },
    releaseInsertGroup: (entityId) => {
      const payload = Number.isFinite(entityId) ? { targetId: entityId } : undefined;
      const result = commandBus.execute('selection.insertReleaseGroup', payload);
      statusApi.setMessage(result.message || 'Insert group released');
      return result;
    },
    updateCurrentLayer: (layerId, patch) => {
      if (!Number.isFinite(layerId) || !patch || typeof patch !== 'object') return false;
      const normalized = Math.trunc(Number(layerId));
      const layer = documentState.getLayer(normalized);
      if (!layer) return false;
      return documentState.updateLayer(normalized, patch) === true;
    },
    setStatus: (message) => statusApi.setMessage(message),
    useLayer: (layerId) => setCurrentLayer(layerId),
    lockLayer,
    unlockLayer,
    isolateLayer: (layerId) => applyLayerIsolationByIds([layerId]),
    hasLayerIsolation,
    restoreLayerIsolation: () => restoreLayerIsolationSession(),
    turnOffLayer: (layerId) => applyLayerOffByIds([layerId]),
    turnOnLayer: (layerId) => {
      const layer = documentState.getLayer(layerId);
      if (!layer) return false;
      if (hasLayerOff()) {
        return restoreLayerOffSession();
      }
      documentState.updateLayer(layer.id, { visible: true });
      const sync = syncCurrentLayer({ preferredId: currentLayerId });
      statusApi.setMessage(`Layer ${layer.name} visibility: On${sync.changed ? ` | current -> ${formatLayerRef(sync.layer)}` : ''}`);
      return true;
    },
    freezeLayer: (layerId) => applyLayerFreezeByIds([layerId]),
    thawLayer: (layerId) => {
      const layer = documentState.getLayer(layerId);
      if (!layer) return false;
      if (hasLayerFreeze()) {
        return restoreLayerFreezeSession();
      }
      return setLayerFrozenState(layer.id, false);
    },
    hasLayerFreeze,
    restoreLayerFreeze: () => restoreLayerFreezeSession(),
  });
  propertyPanel.render();
  refreshCurrentLayerStatus();
  refreshCurrentSpaceStatus();

  solverActionFlowBanner = createSolverActionFlowBanner({
    onPrev: () => {
      const ok = !!solverActionPanel?.rewindFlow?.();
      if (ok) syncSolverActionViews();
      return ok;
    },
    onNext: () => {
      const ok = !!solverActionPanel?.advanceFlow?.();
      if (ok) syncSolverActionViews();
      return ok;
    },
    onRestart: () => {
      const ok = !!solverActionPanel?.restartFlow?.();
      if (ok) syncSolverActionViews();
      return ok;
    },
    onJump: (panelId, stepIndex) => {
      if (String(panelId || '').trim() !== String(solverActionState?.activePanelId || '').trim()) {
        return false;
      }
      const ok = !!solverActionPanel?.jumpFlow?.(stepIndex);
      if (ok) syncSolverActionViews();
      return ok;
    },
    onEventFocus: (event) => {
      const panelId = String(event?.panelId || '').trim();
      if (!panelId) return false;
      const focusKind = String(event?.focusKind || '').trim();
      const focusValue = String(event?.focusValue || '').trim();
      const ok = focusKind && focusValue
        ? !!solverActionPanel?.invokeFocus?.(panelId, focusKind, focusValue)
        : !!solverActionPanel?.invoke?.(panelId);
      if (ok) syncSolverActionViews();
      return ok;
    },
    onFocusCurrent: (focus) => {
      const panelId = String(focus?.panelId || '').trim();
      const focusKind = String(focus?.focusKind || '').trim();
      const focusValue = String(focus?.focusValue || '').trim();
      if (!panelId || !focusKind || !focusValue) return false;
      const ok = !!solverActionPanel?.invokeFocus?.(panelId, focusKind, focusValue);
      if (ok) syncSolverActionViews();
      return ok;
    },
  });

  solverActionFlowConsole = createSolverActionFlowConsole({
    onPrev: () => {
      const ok = !!solverActionPanel?.rewindFlow?.();
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
    onNext: () => {
      const ok = !!solverActionPanel?.advanceFlow?.();
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
    onRestart: () => {
      const ok = !!solverActionPanel?.restartFlow?.();
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
    onReplayRequest: (historyIndex) => {
      const ok = !!solverActionPanel?.replayRequestHistoryIndex?.(historyIndex);
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
    onFocusEvent: (event) => {
      const panelId = String(event?.panelId || '').trim();
      if (!panelId) return false;
      const focusKind = String(event?.focusKind || '').trim();
      const focusValue = String(event?.focusValue || '').trim();
      const ok = focusKind && focusValue
        ? !!solverActionPanel?.invokeFocus?.(panelId, focusKind, focusValue)
        : !!solverActionPanel?.invoke?.(panelId);
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
    onFocusCurrent: (focus) => {
      const panelId = String(focus?.panelId || '').trim();
      const focusKind = String(focus?.focusKind || '').trim();
      const focusValue = String(focus?.focusValue || '').trim();
      if (!panelId || !focusKind || !focusValue) return false;
      const ok = !!solverActionPanel?.invokeFocus?.(panelId, focusKind, focusValue);
      if (ok) {
        syncSolverActionViews();
      }
      return ok;
    },
  });

  solverActionPanel = createSolverActionPanel({
    getDiagnostics: () => solverDiagnostics,
    onAction: (panel, context = {}) => {
      solverActionState = cloneJson(solverActionPanel?.getState?.() || {
        activePanelId: panel?.id || '',
        lastInvokedPanelId: panel?.id || '',
        invocationCount: Number(context?.invocationCount || 0),
        activePanel: panel || null,
        lastInvokedPanel: panel || null,
        availablePanelIds: context?.normalized?.panels?.map((one) => one.id) || [],
        activeFocus: context?.focusKind ? {
          panelId: panel?.id || '',
          kind: String(context.focusKind || ''),
          value: String(context.focusValue || ''),
        } : null,
      }) || solverActionState;
      solverActionRequestState = cloneJson(context?.requestState || solverActionPanel?.getRequestState?.() || solverActionRequestState) || solverActionRequestState;
      solverActionEventState = cloneJson(context?.eventState || solverActionPanel?.getEventState?.() || solverActionEventState) || solverActionEventState;
      solverActionFlowBanner?.setState({
        actionState: solverActionState,
        requestState: solverActionRequestState,
        eventState: solverActionEventState,
        normalized: cloneJson(context?.normalized || solverActionPanel?.getNormalized?.() || null),
      });
      solverActionFlowConsole?.setState({
        actionState: solverActionState,
        requestState: solverActionRequestState,
        eventState: solverActionEventState,
        normalized: cloneJson(context?.normalized || solverActionPanel?.getNormalized?.() || null),
      });
      const label = panel?.ui?.ctaLabel || panel?.label || panel?.id || 'Solver action';
      if (context?.focusKind && context?.focusValue) {
        const flowSuffix = Number.isFinite(context?.flowStepIndex) && Number.isFinite(context?.flowStepCount) && context.flowStepIndex >= 0 && context.flowStepCount > 0
          ? ` (${context.flowStepIndex + 1}/${context.flowStepCount})`
          : '';
        statusApi?.setMessage(`${label}${flowSuffix}: ${context.focusKind} ${context.focusValue}`);
        statusApi?.setSolver(buildSolverStatusText({
          actionState: solverActionState,
          requestState: solverActionRequestState,
          eventState: solverActionEventState,
        }));
        return;
      }
      const summary = panel?.selectionExplanation || panel?.summary || panel?.tag || '';
      statusApi?.setMessage(summary ? `${label}: ${summary}` : label);
      statusApi?.setSolver(buildSolverStatusText({
        actionState: solverActionState,
        requestState: solverActionRequestState,
        eventState: solverActionEventState,
      }));
    },
  });
  solverActionPanel.render();
  syncSolverActionViews();

  createSnapPanel({
    snapState,
  });

  if (debugEnabled && window.__cadDebug) {
    window.__cadDebug.getSolverDiagnostics = () => cloneJson(solverDiagnostics);
    window.__cadDebug.getSolverActionPanels = () => cloneJson(solverActionPanel?.getNormalized() || null);
    window.__cadDebug.getSolverActionState = () => cloneJson(solverActionState);
    window.__cadDebug.getSolverActionFlowBannerState = () => cloneJson(solverActionFlowBanner?.getState?.() || null);
    window.__cadDebug.getSolverActionRequestState = () => cloneJson(solverActionRequestState);
    window.__cadDebug.getSolverActionEventState = () => cloneJson(solverActionEventState);
    window.__cadDebug.getSolverActionDomEventState = () => cloneJson(solverActionDomEventState);
    window.__cadDebug.getSolverActionFlowState = () => cloneJson(solverActionFlowConsole?.getState?.() || null);
    window.__cadDebug.screenToWorld = (point) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      return cloneJson(viewState.screenToWorld(point));
    };
    window.__cadDebug.resolveSnappedPoint = (point, opts = {}) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      return cloneJson(toolContext.resolveSnappedPoint(point, opts && typeof opts === 'object' ? opts : {}));
    };
    window.__cadDebug.setSolverDiagnostics = (payload) => {
      setSolverDiagnostics(payload, 'Solver diagnostics loaded');
      return true;
    };
    window.__cadDebug.clearSolverDiagnostics = () => {
      setSolverDiagnostics(null, 'Solver diagnostics cleared');
      return true;
    };
    window.__cadDebug.invokeSolverActionPanel = (id) => {
      const ok = !!solverActionPanel?.invoke?.(String(id || '').trim());
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.invokeSolverActionFocus = (panelId, kind, value) => {
      const ok = !!solverActionPanel?.invokeFocus?.(
        String(panelId || '').trim(),
        String(kind || '').trim(),
        value
      );
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.advanceSolverActionFlow = () => {
      const ok = !!solverActionPanel?.advanceFlow?.();
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.jumpSolverActionFlow = (stepIndex) => {
      const ok = !!solverActionPanel?.jumpFlow?.(stepIndex);
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.rewindSolverActionFlow = () => {
      const ok = !!solverActionPanel?.rewindFlow?.();
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.replaySolverActionRequest = (historyIndex) => {
      const ok = !!solverActionPanel?.replayRequestHistoryIndex?.(historyIndex);
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.restartSolverActionFlow = () => {
      const ok = !!solverActionPanel?.restartFlow?.();
      syncSolverActionViews();
      return ok;
    };
    window.__cadDebug.clearSolverActionSelection = () => {
      solverActionPanel?.clearActiveAction?.();
      syncSolverActionViews();
      statusApi?.setMessage('Solver action selection cleared');
      return true;
    };
    window.__cadDebug.clearSolverActionFocus = () => {
      solverActionPanel?.clearActiveFocus?.();
      syncSolverActionViews();
      statusApi?.setMessage('Solver action focus cleared');
      return true;
    };
    window.__cadDebug.clearSolverActionRequests = () => {
      solverActionRequestState = cloneJson(solverActionPanel?.clearRequestHistory?.() || solverActionRequestState) || solverActionRequestState;
      syncSolverActionViews();
      statusApi?.setMessage('Solver action requests cleared');
      return true;
    };
    window.__cadDebug.clearSolverActionEvents = () => {
      solverActionEventState = cloneJson(solverActionPanel?.clearEventHistory?.() || solverActionEventState) || solverActionEventState;
      syncSolverActionViews();
      statusApi?.setMessage('Solver action events cleared');
      return true;
    };
  }

  const solverJsonParam = (params.get('solver') || params.get('solver_json') || '').trim();
  if (solverJsonParam) {
    const resolvedSolverUrl = new URL(solverJsonParam, window.location.href);
    fetch(resolvedSolverUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setSolverDiagnostics(payload, 'Solver diagnostics loaded');
      })
      .catch((error) => {
        console.error('Failed to load solver diagnostics', error);
        statusApi?.setMessage(`Solver diagnostics load failed: ${error?.message || String(error)}`);
      });
  }

  canvasView.onCursorMove((worldPoint) => {
    statusApi.setCursor(worldPoint);
  });

  const refreshSelectionStatus = () => {
    const entities = (selectionState.entityIds || [])
      .map((id) => documentState.getEntity(id))
      .filter((entity) => !!entity);
    statusApi?.setSelection(formatSelectionStatus(entities, selectionState.primaryId));
  };
  const refreshPropertyPanel = () => {
    propertyPanel?.render?.();
  };
  const refreshLayerPanel = () => {
    layerPanel?.render?.();
  };
  const refreshSourceGroupFrame = () => {
    const primary = documentState.getEntity(selectionState.primaryId)
      || documentState.getEntity((selectionState.entityIds || [])[0]);
    if (!primary) {
      canvasView.setTransientOverlay('sourceGroupFrame', null);
      canvasView.setTransientOverlay('insertGroupFrame', null);
      canvasView.setTransientOverlay('sourceTextGuide', null);
      return;
    }
    if (!documentState.isEntityRenderable(primary) && !isSourceGroupEntity(primary)) {
      canvasView.setTransientOverlay('sourceGroupFrame', null);
      canvasView.setTransientOverlay('insertGroupFrame', null);
      canvasView.setTransientOverlay('sourceTextGuide', null);
      return;
    }
    if (isInsertGroupEntity(primary)) {
      const bounds = computeInsertGroupBounds(documentState.listEntities(), primary);
      canvasView.setTransientOverlay('sourceGroupFrame', null);
      canvasView.setTransientOverlay('sourceTextGuide', null);
      if (!bounds) {
        canvasView.setTransientOverlay('insertGroupFrame', null);
        return;
      }
      canvasView.setTransientOverlay('insertGroupFrame', {
        ...bounds,
        groupId: Number.isFinite(primary.groupId) ? Math.trunc(primary.groupId) : null,
        blockName: typeof primary.blockName === 'string' ? primary.blockName : '',
      });
      return;
    }
    if (!isSourceGroupEntity(primary)) {
      canvasView.setTransientOverlay('sourceGroupFrame', null);
      canvasView.setTransientOverlay('insertGroupFrame', null);
      canvasView.setTransientOverlay('sourceTextGuide', null);
      return;
    }
    const bounds = computeSourceGroupBounds(documentState.listEntities(), primary);
    const sourceTextGuide = resolveSourceTextGuide(documentState.listEntities(), primary);
    canvasView.setTransientOverlay('insertGroupFrame', null);
    if (!bounds) {
      canvasView.setTransientOverlay('sourceGroupFrame', null);
    } else {
      canvasView.setTransientOverlay('sourceGroupFrame', {
        ...bounds,
        groupId: Number.isFinite(primary.groupId) ? Math.trunc(primary.groupId) : null,
        sourceType: typeof primary.sourceType === 'string' ? primary.sourceType : '',
        proxyKind: typeof primary.proxyKind === 'string' ? primary.proxyKind : '',
      });
    }
    if (!sourceTextGuide) {
      canvasView.setTransientOverlay('sourceTextGuide', null);
      return;
    }
    canvasView.setTransientOverlay('sourceTextGuide', sourceTextGuide);
  };
  selectionState.addEventListener('change', refreshSelectionStatus);
  selectionState.addEventListener('change', refreshPropertyPanel);
  selectionState.addEventListener('change', refreshLayerPanel);
  selectionState.addEventListener('change', refreshSourceGroupFrame);
  documentState.addEventListener('change', refreshSelectionStatus);
  documentState.addEventListener('change', refreshPropertyPanel);
  documentState.addEventListener('change', refreshSourceGroupFrame);
  documentState.addEventListener('change', (event) => {
    const reason = String(event?.detail?.reason || '');
    if (reason === 'restore') {
      layerIsolationSession = null;
      layerOffSession = null;
      layerFreezeSession = null;
    }
    if (
      reason === 'layer-add'
      || reason === 'layer-update'
      || reason === 'layer-upsert'
      || reason === 'restore'
    ) {
      syncCurrentLayer({ preferredId: currentLayerId, preferPopulated: reason === 'restore' });
    }
    if (
      reason === 'entity-add'
      || reason === 'entity-remove'
      || reason === 'entity-clear'
      || reason === 'restore'
      || reason === 'space-layout-context'
    ) {
      syncCurrentSpaceContext({ preferred: getCurrentSpaceContext() });
    }
  });
  documentState.addEventListener('change', (event) => {
    const reason = String(event?.detail?.reason || '');
    if (
      reason === 'layer-update'
      || reason === 'entity-update'
      || reason === 'entity-remove'
      || reason === 'entity-clear'
      || reason === 'restore'
      || reason === 'space-layout-context'
    ) {
      pruneSelectionToRenderable();
    }
  });

  commandBus.addEventListener('executed', (event) => {
    const detail = event.detail;
    if (detail?.result?.ok && detail.result.message) {
      statusApi.setMessage(detail.result.message);
    }
  });

  const keyHandler = (event) => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    if (!typing) {
      if (runGlobalSolverFlowShortcut(event)) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          commandBus.execute('history.redo');
        } else {
          commandBus.execute('history.undo');
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        commandBus.execute('history.redo');
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        toolbar.focusCommandInput();
        return;
      }
    }

    if (!typing) {
      if (event.key === 'F8') {
        event.preventDefault();
        if (!event.repeat) toggleOrtho();
        return;
      }
      if (event.key === 'F3') {
        event.preventDefault();
        if (!event.repeat) toggleSnap();
        return;
      }
      if (event.key === 'F7') {
        event.preventDefault();
        if (!event.repeat) toggleGrid();
        return;
      }
      canvasView.dispatchKeyDown(event);
    }
  };
  window.addEventListener('keydown', keyHandler);

  seedDocument(documentState);
  syncCurrentLayer({ preferredId: currentLayerId, preferPopulated: true });
  syncCurrentSpaceContext({ preferred: documentState.getCurrentSpaceContext() });

  if (params.get('seed') === '0') {
    documentState.clearEntities();
    syncCurrentLayer({ preferredId: currentLayerId });
    syncCurrentSpaceContext({ preferred: documentState.getCurrentSpaceContext() });
  }

  setActiveTool('select');
  refreshSelectionStatus();
  refreshSourceGroupFrame();
  statusApi.setMessage('VemCAD Web editor ready');

  const cadgfUrl = params.get('cadgf');
  if (cadgfUrl) {
    (async () => {
      try {
        statusApi.setMessage(`Loading CADGF: ${cadgfUrl}`);
        const resolved = new URL(cadgfUrl, window.location.href);
        const response = await fetch(resolved);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        importPayload(payload, { fitView: true });
      } catch (error) {
        statusApi.setMessage(`Failed to load CADGF: ${error?.message || String(error)}`);
      }
    })();
  }

  return {
    destroy() {
      window.removeEventListener('keydown', keyHandler);
      importer.destroy();
    },
    state: {
      document: documentState,
      selection: selectionState,
      snap: snapState,
      view: viewState,
    },
    commands: commandBus,
    /** Load a document JSON payload into the editor (used by the desktop DXF/DWG bridge). */
    importPayload,
  };
}
