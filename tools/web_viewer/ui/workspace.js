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

function fitViewToDocument({ documentState, viewState, canvas, paddingPx = 56 }) {
  const extents = computeDocumentExtents(documentState);
  if (!extents) {
    return;
  }

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

function isReadOnlySelectionEntity(entity) {
  return !!entity && (entity.readOnly === true || entity.type === 'unsupported' || entity.editMode === 'proxy');
}

function describeSelectionOrigin(entity) {
  if (!entity) return '';
  const sourceType = typeof entity.sourceType === 'string' ? entity.sourceType.trim() : '';
  const proxyKind = typeof entity.proxyKind === 'string' ? entity.proxyKind.trim() : '';
  const editMode = typeof entity.editMode === 'string' ? entity.editMode.trim() : '';
  const parts = [];
  if (sourceType && proxyKind) {
    parts.push(`${sourceType}/${proxyKind}`);
  } else if (sourceType) {
    parts.push(sourceType);
  }
  if (editMode) {
    parts.push(editMode);
  }
  if (isReadOnlySelectionEntity(entity) && editMode !== 'proxy') {
    parts.push('read-only');
  }
  return parts.join(' | ');
}

function formatSelectionStatus(entities, primaryId) {
  if (!Array.isArray(entities) || entities.length === 0) {
    return 'Selection: none';
  }
  const primary = entities.find((entity) => entity && entity.id === primaryId) || entities[0];
  if (!primary) {
    return 'Selection: none';
  }
  if (entities.length === 1) {
    const detail = describeSelectionOrigin(primary);
    return detail
      ? `Selection: ${primary.type} | ${detail}`
      : `Selection: ${primary.type}`;
  }
  const typeSummary = [...new Set(entities.map((entity) => entity?.type).filter(Boolean))].slice(0, 3).join(',');
  const readOnlyCount = entities.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  let summary = `Selection: ${entities.length} entities`;
  if (typeSummary) {
    summary += ` | ${typeSummary}`;
  }
  if (readOnlyCount > 0) {
    summary += ` | ${readOnlyCount} read-only`;
  }
  return summary;
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
      getLayer: (id) => {
        const layerId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(layerId)) return null;
        const layer = documentState.getLayer(layerId);
        return layer ? cloneJson(layer) : null;
      },
      listLayers: () => cloneJson(documentState.listLayers()),
      listEntities: () => cloneJson(documentState.listEntities()),
      getSelectionIds: () => cloneJson(Array.isArray(selectionState.entityIds) ? selectionState.entityIds : []),
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
      j: 'join',
      jo: 'join',
      f: 'fillet',
      ch: 'chamfer',
      cha: 'chamfer',
    };
    const verb = alias[parsed.verb] || parsed.verb;

    if (verb === 'join' && args.length > 0) {
      const tolerance = Number.parseFloat(args[0]);
      const payload = Number.isFinite(tolerance) ? { tolerance } : undefined;
      const result = commandBus.execute('selection.join', payload);
      statusApi?.setMessage(result.message || 'Join');
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

    if (verb === 'move' || verb === 'copy' || verb === 'rotate' || verb === 'trim' || verb === 'extend') {
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

    if (verb === 'lineweight') {
      statusApi?.setMessage('Lineweight command is reserved for future renderer tuning.');
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
    if (isCadgfDocument(payload)) {
      const imported = importCadgfDocument(payload);
      documentState.restore(imported.docSnapshot);
      selectionState.clear();
      cadgfBaseDocument = imported.baseCadgfJson;
      if (fitView) {
        fitViewToDocument({ documentState, viewState, canvas });
      }
      statusApi?.setMessage(imported.warnings.length > 0
        ? `CADGF imported with ${imported.warnings.length} warnings`
        : 'CADGF document imported');
      return;
    }

    cadgfBaseDocument = null;
    hydrateDocument(documentState, payload, selectionState, snapState, viewState);
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
  });
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

  createLayerPanel({
    documentState,
    onAddLayer: (name) => {
      const layer = documentState.addLayer(name || 'Layer');
      statusApi.setMessage(`Layer added: ${layer.name}`);
    },
    onToggleVisibility: (layer) => {
      documentState.updateLayer(layer.id, { visible: !layer.visible });
      statusApi.setMessage(`Layer ${layer.name} visibility: ${!layer.visible ? 'On' : 'Off'}`);
    },
    onToggleLocked: (layer) => {
      documentState.updateLayer(layer.id, { locked: !layer.locked });
      statusApi.setMessage(`Layer ${layer.name} lock: ${!layer.locked ? 'On' : 'Off'}`);
    },
  });

  createPropertyPanel({
    documentState,
    selectionState,
    commandBus,
    setStatus: (message) => statusApi.setMessage(message),
  });

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
  selectionState.addEventListener('change', refreshSelectionStatus);
  documentState.addEventListener('change', refreshSelectionStatus);

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

  if (params.get('seed') === '0') {
    documentState.clearEntities();
  }

  setActiveTool('select');
  refreshSelectionStatus();
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
  };
}
