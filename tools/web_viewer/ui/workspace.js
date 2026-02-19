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

function createImporter(onLoad) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
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

export function bootstrapCadWorkspace({ params = new URLSearchParams(window.location.search) } = {}) {
  const canvas = document.getElementById('cad-canvas');
  if (!canvas) {
    throw new Error('CAD canvas not found');
  }

  const debugEnabled = params.get('debug') === '1';
  let cadgfBaseDocument = null;

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
    const cloneJson = (value) => {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return null;
      }
    };
    window.__cadDebug = {
      getOverlays: () => ({ ...canvasView.overlays }),
      getState: () => ({
        entityCount: documentState.listEntities().length,
        selectionCount: Array.isArray(selectionState.entityIds) ? selectionState.entityIds.length : 0,
        primaryId: selectionState.primaryId,
      }),
      getSelectionIds: () => cloneJson(Array.isArray(selectionState.entityIds) ? selectionState.entityIds : []),
      getEntity: (id) => {
        const entityId = Number.parseInt(String(id), 10);
        if (!Number.isFinite(entityId)) return null;
        const entity = documentState.getEntity(entityId);
        return entity ? cloneJson(entity) : null;
      },
    };
  }

  let statusApi = null;
  let toolbar = null;

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

    if (verb === 'join') {
      const tolerance = args.length > 0 ? Number.parseFloat(args[0]) : undefined;
      const payload = Number.isFinite(tolerance) ? { tolerance } : undefined;
      const result = commandBus.execute('selection.join', payload);
      statusApi?.setMessage(result.message || 'Join');
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

  statusApi = createStatusBar({
    snapState,
    toolOptions,
    onToggleOrtho: () => {
      snapState.toggle('ortho');
      statusApi.setMessage(`Ortho ${snapState.toJSON().ortho ? 'On' : 'Off'}`);
    },
    onToggleSnap: () => {
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
    },
    onToggleGrid: () => {
      snapState.toggle('grid');
      viewState.setShowGrid(snapState.toJSON().grid);
      statusApi.setMessage(`Grid ${snapState.toJSON().grid ? 'On' : 'Off'}`);
    },
    onToggleBreakKeep: () => {
      const order = ['auto', 'short', 'long'];
      const current = typeof toolOptions.breakKeep === 'string' ? toolOptions.breakKeep : 'auto';
      const idx = Math.max(0, order.indexOf(current));
      toolOptions.breakKeep = order[(idx + 1) % order.length];
      statusApi.refreshToggleLabels();
      statusApi.setMessage(`Break keep: ${toolOptions.breakKeep}`);
    },
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

  createSnapPanel({
    snapState,
  });

  canvasView.onCursorMove((worldPoint) => {
    statusApi.setCursor(worldPoint);
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
      canvasView.dispatchKeyDown(event);
    }
  };
  window.addEventListener('keydown', keyHandler);

  seedDocument(documentState);

  if (params.get('seed') === '0') {
    documentState.clearEntities();
  }

  setActiveTool('select');
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
