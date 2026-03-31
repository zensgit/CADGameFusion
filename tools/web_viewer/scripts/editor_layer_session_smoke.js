#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_layer_session_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_layer_session_fixture.json';

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    host: DEFAULT_HOST,
    port: 0,
    fixture: DEFAULT_FIXTURE,
    noServe: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--base-url' || token === '--base') && i + 1 < argv.length) {
      args.baseUrl = argv[i + 1];
      args.noServe = true;
      i += 1;
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--fixture' && i + 1 < argv.length) {
      args.fixture = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--host' && i + 1 < argv.length) {
      args.host = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--port' && i + 1 < argv.length) {
      args.port = Number.parseInt(argv[i + 1], 10) || 0;
      i += 1;
      continue;
    }
    if (token === '--no-serve') {
      args.noServe = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/editor_layer_session_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_layer_session_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
    '',
    'Defaults to starting a temporary static server rooted at deps/cadgamefusion.',
  ].join('\n');
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeServeRoot(root) {
  return path.resolve(root || repoRoot);
}

function lookupMime(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function buildSafePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/');
  const suffix = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.resolve(root, `.${suffix}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return candidate;
}

function createStaticServer(serveRoot) {
  return http.createServer((req, res) => {
    const safePath = buildSafePath(serveRoot, req.url || '/');
    if (!safePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    fs.stat(safePath, (err, stats) => {
      if (err || !stats || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': lookupMime(safePath),
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(safePath).pipe(res);
    });
  });
}

function tryListen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve static server address'));
        return;
      }
      resolve(address);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function startStaticServer(root, host, port) {
  const serveRoot = normalizeServeRoot(root);
  const portCandidates = Number.isFinite(port) && port > 0
    ? [port]
    : [0, 18131, 18132, 18133, 18134];
  let lastError = null;
  for (const candidate of portCandidates) {
    const server = createStaticServer(serveRoot);
    try {
      const address = await tryListen(server, host, candidate);
      return {
        server,
        baseUrl: `http://${host}:${address.port}/`,
      };
    } catch (error) {
      lastError = error;
      server.close();
      const recoverable = error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'EADDRINUSE';
      if (!recoverable) {
        throw error;
      }
    }
  }
  throw lastError || new Error('Failed to start static server');
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readCurrentLayerState(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    const status = document.querySelector('#cad-status-layer');
    return {
      statusText: status ? String(status.textContent || '').trim() : '',
      currentLayerId: debug && typeof debug.getCurrentLayerId === 'function' ? debug.getCurrentLayerId() : null,
      currentLayer: debug && typeof debug.getCurrentLayer === 'function' ? debug.getCurrentLayer() : null,
    };
  });
}

async function readLayerPanelState(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item')).map((item) => {
      const id = Number.parseInt(String(item.getAttribute('data-layer-id') || ''), 10);
      return {
        id: Number.isFinite(id) ? id : null,
        current: item.classList.contains('is-current'),
        focused: item.classList.contains('is-focused'),
        text: String(item.textContent || '').trim(),
      };
    });
    return {
      currentLayerId: items.find((item) => item.current)?.id ?? null,
      focusedLayerId: items.find((item) => item.focused)?.id ?? null,
      items,
    };
  });
}

async function readLayerState(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listLayers !== 'function') return [];
    return debug.listLayers().map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible !== false,
      locked: layer.locked === true,
      frozen: layer.frozen === true,
    }));
  });
}

async function readSelectionIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.getSelectionIds !== 'function') return [];
    return debug.getSelectionIds();
  });
}

async function readPropertyActions(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#cad-property-form [data-property-action]'))
    .map((button) => ({
      id: String(button.getAttribute('data-property-action') || '').trim(),
      label: String(button.textContent || '').trim(),
    }))
    .filter((action) => !!action.id));
}

async function listEntityIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return [];
    return debug.listEntities().map((entity) => entity.id).filter(Number.isFinite).sort((a, b) => a - b);
  });
}

async function readEntity(page, entityId) {
  return page.evaluate((id) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.getEntity !== 'function') return null;
    return debug.getEntity(id);
  }, entityId);
}

async function selectEntityById(page, entityId) {
  const point = await page.evaluate((id) => {
    const debug = window.__cadDebug;
    const canvas = document.getElementById('cad-canvas');
    if (!debug || !canvas || typeof debug.getEntity !== 'function' || typeof debug.worldToCanvas !== 'function') {
      return null;
    }
    const entity = debug.getEntity(id);
    if (!entity) return null;
    const start = entity.start || entity.position || entity.center;
    const end = entity.end || entity.position || entity.center;
    if (!start || !end) return null;
    const world = {
      x: (Number(start.x) + Number(end.x)) * 0.5,
      y: (Number(start.y) + Number(end.y)) * 0.5,
    };
    const screen = debug.worldToCanvas(world);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + screen.x,
      y: rect.top + screen.y,
    };
  }, entityId);
  ensure(point, `Failed to resolve canvas point for entity ${entityId}`);
  await page.mouse.click(point.x, point.y);
}

async function ensureEntitySelection(page, entityId) {
  await selectEntityById(page, entityId);
  const selected = await page.evaluate((id) => {
    const debug = window.__cadDebug;
    const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
    return Array.isArray(ids) && ids.includes(id);
  }, entityId);
  if (selected) return;
  await page.evaluate((id) => window.__cadDebug?.setSelection?.([id], id), entityId);
}

async function clickWorld(page, worldPoint) {
  const point = await page.evaluate((world) => {
    const debug = window.__cadDebug;
    const canvas = document.getElementById('cad-canvas');
    if (!debug || !canvas || typeof debug.worldToCanvas !== 'function') {
      return null;
    }
    const screen = debug.worldToCanvas(world);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + screen.x,
      y: rect.top + screen.y,
    };
  }, worldPoint);
  ensure(point, `Failed to project world point ${JSON.stringify(worldPoint)}`);
  await page.mouse.click(point.x, point.y);
}

async function drawLine(page, start, end) {
  await page.click('[data-tool="line"]');
  await clickWorld(page, start);
  await clickWorld(page, end);
}

async function waitForEntityCountIncrease(page, count, timeout = 1500) {
  try {
    await page.waitForFunction((expected) => {
      const debug = window.__cadDebug;
      return debug && typeof debug.listEntities === 'function' && debug.listEntities().length > expected;
    }, count, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function createDebugDraftLine(page, start, end) {
  return page.evaluate(({ rawStart, rawEnd }) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.runCommand !== 'function' || typeof debug.getCurrentLayer !== 'function') {
      return null;
    }
    const layer = debug.getCurrentLayer();
    const currentSpace = typeof debug.getCurrentSpaceContext === 'function' ? debug.getCurrentSpaceContext() : null;
    if (!layer || !Number.isFinite(layer.id)) return null;
    const color = typeof layer.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(layer.color)
      ? layer.color
      : '#1f2937';
    return debug.runCommand('entity.create', {
      entity: {
        type: 'line',
        start: rawStart,
        end: rawEnd,
        layerId: layer.id,
        visible: true,
        color,
        colorSource: 'BYLAYER',
        lineType: 'BYLAYER',
        lineWeight: 0,
        lineWeightSource: 'BYLAYER',
        lineTypeScale: 1,
        lineTypeScaleSource: 'DEFAULT',
        space: Number.isFinite(currentSpace?.space) ? currentSpace.space : 0,
        layout: typeof currentSpace?.layout === 'string' && currentSpace.layout.trim() ? currentSpace.layout.trim() : 'Model',
      },
    });
  }, { rawStart: start, rawEnd: end });
}

async function createLineEntity(page, start, end) {
  const beforeIds = await listEntityIds(page);
  await drawLine(page, start, end);
  let mode = 'ui';
  let created = await waitForEntityCountIncrease(page, beforeIds.length, 1500);
  if (!created) {
    const result = await createDebugDraftLine(page, start, end);
    ensure(result && result.ok === true, `Debug create line fallback failed: ${result?.message || 'unknown error'}`);
    mode = 'debug';
    created = await waitForEntityCountIncrease(page, beforeIds.length, 5000);
  }
  ensure(created, 'Expected line creation to increase entity count');
  const afterIds = await listEntityIds(page);
  const createdId = afterIds.find((id) => !beforeIds.includes(id));
  ensure(Number.isFinite(createdId), 'Failed to detect created line entity');
  return { createdId, mode };
}

async function runTypedCommand(page, raw) {
  await page.fill('#cad-command-input', raw);
  await page.keyboard.press('Enter');
}

async function clickLayerAction(page, layerId, action) {
  await page.click(`#cad-layer-list .cad-layer-item[data-layer-id="${layerId}"] [data-layer-action="${action}"]`);
}

async function clickPropertyAction(page, action) {
  await page.click(`#cad-property-form [data-property-action="${action}"]`);
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const stamp = nowStamp();
  const outdir = path.join(path.resolve(args.outdir), stamp);
  ensureDir(outdir);
  const summaryPath = path.join(outdir, 'summary.json');

  let serverInfo = null;
  let browser = null;
  const consoleMessages = [];
  const pageErrors = [];

  const summary = {
    ok: false,
    outdir,
    fixture: args.fixture,
    baseUrl: args.baseUrl || '',
    console_messages: consoleMessages,
    page_errors: pageErrors,
  };

  try {
    serverInfo = args.noServe
      ? { server: null, baseUrl: args.baseUrl }
      : await startStaticServer(repoRoot, args.host, args.port);
    ensure(serverInfo.baseUrl, 'Missing base URL');
    summary.baseUrl = serverInfo.baseUrl;

    const editorUrl = new URL('tools/web_viewer/index.html', serverInfo.baseUrl);
    editorUrl.searchParams.set('mode', 'editor');
    editorUrl.searchParams.set('debug', '1');
    editorUrl.searchParams.set('seed', '0');
    editorUrl.searchParams.set('cadgf', args.fixture);
    summary.url = editorUrl.toString();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push(String(error?.message || error));
    });

    await page.goto(editorUrl.toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return debug && typeof debug.getEntity === 'function' && !!debug.getEntity(7) && !!debug.getEntity(8);
    }, null, { timeout: 15000 });

    summary.initial = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
    };
    ensure(summary.initial.current.currentLayerId === 1, `Expected imported current layer 1, got ${summary.initial.current.currentLayerId}`);
    ensure(summary.initial.layer_panel.currentLayerId === 1, `Expected imported layer-panel current=1, got ${summary.initial.layer_panel.currentLayerId}`);

    await clickLayerAction(page, 2, 'current');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 2, null, { timeout: 10000 });
    summary.after_set_current = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
    };
    ensure(summary.after_set_current.current.currentLayerId === 2, 'Expected layer 2 to become current');

    await ensureEntitySelection(page, 8);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      return details && details.getAttribute('data-layer-id') === '2';
    }, null, { timeout: 10000 });
    summary.selection_on_layer2 = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      property_actions: await readPropertyActions(page),
    };
    ensure(summary.selection_on_layer2.property_actions.some((action) => action.id === 'turn-off-layer'), 'Expected Turn Off Layer action for selected layer 2');
    ensure(summary.selection_on_layer2.property_actions.some((action) => action.id === 'freeze-layer'), 'Expected Freeze Layer action for selected layer 2');

    await clickPropertyAction(page, 'turn-off-layer');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 1 && !!layer2 && layer2.visible === false;
    }, null, { timeout: 10000 });
    summary.after_turn_off = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      selection_ids: await readSelectionIds(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_turn_off.selection_ids.length === 0, 'Expected selection to clear after turning off the selected layer');
    ensure(summary.after_turn_off.layers.find((layer) => layer.id === 2)?.visible === false, 'Expected layer 2 to be hidden after turn-off');

    await runTypedCommand(page, 'layon');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 2 && !!layer2 && layer2.visible !== false;
    }, null, { timeout: 10000 });
    summary.after_layon = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_layon.status || '').includes('LAYON'), 'Expected LAYON status after restoring layer-off session');

    await ensureEntitySelection(page, 8);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      return details && details.getAttribute('data-layer-id') === '2';
    }, null, { timeout: 10000 });
    summary.selection_before_lock = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      property_actions: await readPropertyActions(page),
    };
    ensure(summary.selection_before_lock.property_actions.some((action) => action.id === 'lock-layer'), 'Expected Lock Layer action for unlocked selected layer 2');

    await clickPropertyAction(page, 'lock-layer');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      const actions = Array.from(document.querySelectorAll('#cad-property-form [data-property-action]'))
        .map((button) => String(button.getAttribute('data-property-action') || '').trim());
      return debug.getCurrentLayerId() === 1 && !!layer2 && layer2.locked === true && actions.includes('unlock-layer');
    }, null, { timeout: 10000 });
    summary.after_property_lock = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      selection_ids: await readSelectionIds(page),
      property_actions: await readPropertyActions(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_property_lock.selection_ids.includes(8), 'Expected selected locked-layer entity to remain selected after property lock');
    ensure(String(summary.after_property_lock.status || '').includes('lock: On'), 'Expected property lock status after locking layer 2');
    ensure(summary.after_property_lock.layers.find((layer) => layer.id === 2)?.locked === true, 'Expected layer 2 to be locked after property lock');
    ensure(summary.after_property_lock.property_actions.some((action) => action.id === 'unlock-layer'), 'Expected Unlock Layer action after property lock');

    await ensureEntitySelection(page, 8);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      const actions = Array.from(document.querySelectorAll('#cad-property-form [data-property-action]'))
        .map((button) => String(button.getAttribute('data-property-action') || '').trim());
      return details && details.getAttribute('data-layer-id') === '2' && actions.includes('unlock-layer');
    }, null, { timeout: 10000 });
    await runTypedCommand(page, 'layulk');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      const actions = Array.from(document.querySelectorAll('#cad-property-form [data-property-action]'))
        .map((button) => String(button.getAttribute('data-property-action') || '').trim());
      return !!layer2 && layer2.locked !== true && actions.includes('lock-layer');
    }, null, { timeout: 10000 });
    summary.after_layulk = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      selection_ids: await readSelectionIds(page),
      property_actions: await readPropertyActions(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_layulk.status || '').includes('LAYULK'), 'Expected LAYULK status after unlocking selected layer');
    ensure(summary.after_layulk.layers.find((layer) => layer.id === 2)?.locked !== true, 'Expected layer 2 to be unlocked after LAYULK');
    ensure(summary.after_layulk.property_actions.some((action) => action.id === 'lock-layer'), 'Expected Lock Layer action after LAYULK');

    await clickLayerAction(page, 2, 'current');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 2, null, { timeout: 10000 });

    await ensureEntitySelection(page, 8);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      return details && details.getAttribute('data-layer-id') === '2';
    }, null, { timeout: 10000 });
    await runTypedCommand(page, 'layfrz');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 1 && !!layer2 && layer2.frozen === true;
    }, null, { timeout: 10000 });
    summary.after_layfrz = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      selection_ids: await readSelectionIds(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_layfrz.selection_ids.length === 0, 'Expected selection to clear after freezing the selected layer');
    ensure(String(summary.after_layfrz.status || '').includes('LAYFRZ'), 'Expected LAYFRZ status after freezing selected layer');

    const fallbackCreate = await createLineEntity(page, { x: -24, y: 0 }, { x: 24, y: 0 });
    const fallbackCreatedId = fallbackCreate.createdId;
    summary.fallback_created_entity = await readEntity(page, fallbackCreatedId);
    summary.fallback_created_via = fallbackCreate.mode;
    ensure(summary.fallback_created_entity?.layerId === 1, `Expected fallback-created entity on layer 1, got ${summary.fallback_created_entity?.layerId}`);
    ensure(summary.fallback_created_entity?.color === '#808080', `Expected fallback-created entity BYLAYER color #808080, got ${summary.fallback_created_entity?.color}`);
    ensure(summary.fallback_created_entity?.colorSource === 'BYLAYER', `Expected fallback-created entity BYLAYER color source, got ${summary.fallback_created_entity?.colorSource}`);
    ensure(summary.fallback_created_entity?.lineType === 'BYLAYER', `Expected fallback-created entity lineType BYLAYER, got ${summary.fallback_created_entity?.lineType}`);
    ensure(Number(summary.fallback_created_entity?.lineWeight || 0) === 0, `Expected fallback-created entity lineWeight 0, got ${summary.fallback_created_entity?.lineWeight}`);
    ensure(summary.fallback_created_entity?.lineWeightSource === 'BYLAYER', `Expected fallback-created entity lineWeightSource BYLAYER, got ${summary.fallback_created_entity?.lineWeightSource}`);

    await ensureEntitySelection(page, 7);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      return details && details.getAttribute('data-layer-id') === '1';
    }, null, { timeout: 10000 });
    summary.visible_selection_during_freeze = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      property_actions: await readPropertyActions(page),
    };
    ensure(summary.visible_selection_during_freeze.property_actions.some((action) => action.id === 'thaw-layers' && action.label === 'Thaw Layers'), 'Expected Thaw Layers action while freeze session is active');

    await clickPropertyAction(page, 'thaw-layers');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 2 && !!layer2 && layer2.frozen !== true;
    }, null, { timeout: 10000 });
    summary.after_thaw_layers = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_thaw_layers.status || '').includes('LAYTHW'), 'Expected LAYTHW status after thawing frozen layers');

    await runTypedCommand(page, 'laythw');
    await page.waitForTimeout(100);
    summary.after_extra_laythw = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_extra_laythw.status || '').includes('no active'), 'Expected no-session status after extra LAYTHW');

    await clickLayerAction(page, 2, 'frozen');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 1 && !!layer2 && layer2.frozen === true;
    }, null, { timeout: 10000 });
    summary.after_panel_freeze = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_panel_freeze.status || '').includes('freeze: On'), 'Expected panel freeze status');

    const panelFreezeCreate = await createLineEntity(page, { x: -24, y: 8 }, { x: 24, y: 8 });
    const panelFreezeCreatedId = panelFreezeCreate.createdId;
    summary.panel_freeze_created_entity = await readEntity(page, panelFreezeCreatedId);
    summary.panel_freeze_created_via = panelFreezeCreate.mode;
    ensure(summary.panel_freeze_created_entity?.layerId === 1, `Expected panel-freeze fallback draw on layer 1, got ${summary.panel_freeze_created_entity?.layerId}`);
    ensure(summary.panel_freeze_created_entity?.color === '#808080', `Expected panel-freeze fallback entity BYLAYER color #808080, got ${summary.panel_freeze_created_entity?.color}`);
    ensure(summary.panel_freeze_created_entity?.colorSource === 'BYLAYER', `Expected panel-freeze fallback entity BYLAYER color source, got ${summary.panel_freeze_created_entity?.colorSource}`);
    ensure(summary.panel_freeze_created_entity?.lineType === 'BYLAYER', `Expected panel-freeze fallback entity lineType BYLAYER, got ${summary.panel_freeze_created_entity?.lineType}`);
    ensure(Number(summary.panel_freeze_created_entity?.lineWeight || 0) === 0, `Expected panel-freeze fallback entity lineWeight 0, got ${summary.panel_freeze_created_entity?.lineWeight}`);
    ensure(summary.panel_freeze_created_entity?.lineWeightSource === 'BYLAYER', `Expected panel-freeze fallback entity lineWeightSource BYLAYER, got ${summary.panel_freeze_created_entity?.lineWeightSource}`);

    await clickLayerAction(page, 2, 'frozen');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layer2 = debug.listLayers().find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 1 && !!layer2 && layer2.frozen !== true;
    }, null, { timeout: 10000 });
    summary.after_panel_thaw = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(String(summary.after_panel_thaw.status || '').includes('freeze: Off'), 'Expected panel thaw status');

    summary.ok = true;
  } catch (error) {
    summary.error = String(error?.stack || error?.message || error);
    summary.ok = false;
  } finally {
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    if (browser) {
      await browser.close();
    }
    if (serverInfo?.server) {
      await new Promise((resolve, reject) => serverInfo.server.close((error) => (error ? reject(error) : resolve())));
    }
  }

  if (!summary.ok) {
    console.error(`editor_layer_session_smoke: FAIL (${summaryPath})`);
    process.exit(1);
  }

  console.log(`editor_layer_session_smoke: PASS (${summaryPath})`);
}

await run();
