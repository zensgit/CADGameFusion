#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_current_layer_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_current_layer_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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

function startStaticServer(root, host, port) {
  const serveRoot = normalizeServeRoot(root);
  const server = http.createServer((req, res) => {
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
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve static server address'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://${host}:${address.port}/`,
      });
    });
  });
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
        text: String(item.textContent || '').trim(),
        current: item.classList.contains('is-current'),
        focused: item.classList.contains('is-focused'),
      };
    });
    return {
      currentLayerId: items.find((item) => item.current)?.id ?? null,
      focusedLayerId: items.find((item) => item.focused)?.id ?? null,
      items,
    };
  });
}

async function readLayerVisibilityState(page) {
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

async function readPropertyInfo(page) {
  return page.evaluate(() => {
    const out = {};
    for (const row of document.querySelectorAll('#cad-property-form [data-property-info]')) {
      const key = String(row.getAttribute('data-property-info') || '').trim();
      if (!key) continue;
      out[key] = String(row.textContent || '').trim();
    }
    return out;
  });
}

async function readSelectionDetailFacts(page) {
  return page.evaluate(() => {
    const out = {};
    for (const row of document.querySelectorAll('#cad-selection-details [data-selection-field]')) {
      const key = String(row.getAttribute('data-selection-field') || '').trim();
      if (!key) continue;
      if (key === 'effective-color-swatch') {
        const color = String(row.getAttribute('data-selection-color') || row.style.background || '').trim().toLowerCase();
        out[key] = color;
        continue;
      }
      const strong = row.querySelector('strong');
      out[key] = String((strong ? strong.textContent : row.textContent) || '').trim();
    }
    return out;
  });
}

async function setPropertyField(page, name, value) {
  const selector = `#cad-property-form [name="${name}"]`;
  await page.fill(selector, value);
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (!input) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
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
      return debug && typeof debug.getEntity === 'function' && !!debug.getEntity(7);
    }, null, { timeout: 15000 });

    summary.initial = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
    };
    ensure(summary.initial.current.currentLayerId === 1, `Expected imported current layer 1, got ${summary.initial.current.currentLayerId}`);
    ensure(summary.initial.layer_panel.currentLayerId === 1, `Expected layer panel current=1, got ${summary.initial.layer_panel.currentLayerId}`);

    await clickLayerAction(page, 2, 'current');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 2, null, { timeout: 10000 });
    summary.after_set_current = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      property_info: await readPropertyInfo(page),
    };
    ensure(summary.after_set_current.layer_panel.currentLayerId === 2, 'Expected layer 2 to become current');
    ensure(String(summary.after_set_current.property_info['current-layer'] || '').includes('2:REDLINE'), 'Expected no-selection property panel to expose current layer defaults');

    await setPropertyField(page, 'currentLayerColor', '#00AAFF');
    await page.waitForFunction(() => {
      const layer = window.__cadDebug?.getCurrentLayer?.();
      return layer && layer.id === 2 && String(layer.color || '').toLowerCase() === '#00aaff';
    }, null, { timeout: 10000 });
    await setPropertyField(page, 'currentLayerLineType', 'CENTER');
    await page.waitForFunction(() => {
      const layer = window.__cadDebug?.getCurrentLayer?.();
      return layer && layer.id === 2 && layer.lineType === 'CENTER';
    }, null, { timeout: 10000 });
    await setPropertyField(page, 'currentLayerLineWeight', '0.35');
    await page.waitForFunction(() => {
      const layer = window.__cadDebug?.getCurrentLayer?.();
      return layer && layer.id === 2 && Math.abs(Number(layer.lineWeight || 0) - 0.35) < 1e-9;
    }, null, { timeout: 10000 });
    summary.after_current_layer_style = {
      current: await readCurrentLayerState(page),
      property_info: await readPropertyInfo(page),
    };
    ensure(String(summary.after_current_layer_style.property_info['current-layer-color'] || '').toLowerCase().includes('#00aaff'), `Expected current-layer color info #00aaff, got ${summary.after_current_layer_style.property_info['current-layer-color']}`);

    const currentStyleCreate = await createLineEntity(page, { x: -24, y: -20 }, { x: 24, y: -20 });
    const currentStyleCreatedId = currentStyleCreate.createdId;
    await ensureEntitySelection(page, currentStyleCreatedId);
    await page.waitForFunction((id) => {
      const debug = window.__cadDebug;
      const details = document.querySelector('#cad-selection-details');
      return debug?.getSelectionIds?.()?.includes(id)
        && details
        && details.getAttribute('data-layer-id') === '2';
    }, currentStyleCreatedId, { timeout: 10000 });
    summary.current_layer_style_created_entity = await readEntity(page, currentStyleCreatedId);
    summary.current_layer_style_created_via = currentStyleCreate.mode;
    summary.current_layer_style_selection = await readSelectionDetailFacts(page);
    ensure(summary.current_layer_style_created_entity?.layerId === 2, `Expected current-style entity on layer 2, got ${summary.current_layer_style_created_entity?.layerId}`);
    ensure(summary.current_layer_style_created_entity?.color === '#00aaff', `Expected current-style entity color #00aaff, got ${summary.current_layer_style_created_entity?.color}`);
    ensure(summary.current_layer_style_created_entity?.lineType === 'BYLAYER', `Expected current-style entity lineType BYLAYER, got ${summary.current_layer_style_created_entity?.lineType}`);
    ensure(Number(summary.current_layer_style_created_entity?.lineWeight || 0) === 0, `Expected current-style entity lineWeight 0, got ${summary.current_layer_style_created_entity?.lineWeight}`);
    ensure(summary.current_layer_style_created_entity?.lineWeightSource === 'BYLAYER', `Expected current-style entity lineWeightSource BYLAYER, got ${summary.current_layer_style_created_entity?.lineWeightSource}`);
    ensure(summary.current_layer_style_created_entity?.lineTypeScaleSource === 'DEFAULT', `Expected current-style entity lineTypeScaleSource DEFAULT, got ${summary.current_layer_style_created_entity?.lineTypeScaleSource}`);
    ensure(summary.current_layer_style_created_entity?.colorSource === 'BYLAYER', `Expected current-style entity colorSource BYLAYER, got ${summary.current_layer_style_created_entity?.colorSource}`);
    ensure(summary.current_layer_style_selection['layer-color'] === '#00aaff', `Expected layer color #00aaff, got ${summary.current_layer_style_selection['layer-color']}`);
    ensure(summary.current_layer_style_selection['effective-color'] === '#00aaff', `Expected effective color #00aaff, got ${summary.current_layer_style_selection['effective-color']}`);
    ensure(summary.current_layer_style_selection['effective-color-swatch'] === '#00aaff', `Expected effective swatch #00aaff, got ${summary.current_layer_style_selection['effective-color-swatch']}`);
    ensure(summary.current_layer_style_selection['line-type'] === 'CENTER', `Expected effective line type CENTER, got ${summary.current_layer_style_selection['line-type']}`);
    ensure(summary.current_layer_style_selection['line-weight'] === '0.35', `Expected effective line weight 0.35, got ${summary.current_layer_style_selection['line-weight']}`);
    ensure(summary.current_layer_style_selection['line-type-scale-source'] === 'DEFAULT', `Expected line type scale source DEFAULT, got ${summary.current_layer_style_selection['line-type-scale-source']}`);
    await page.evaluate(() => window.__cadDebug?.setSelection?.([], null));
    await page.waitForFunction(() => (window.__cadDebug?.getSelectionIds?.() || []).length === 0, null, { timeout: 10000 });

    await ensureEntitySelection(page, 7);
    await page.waitForFunction(() => {
      const details = document.querySelector('#cad-selection-details');
      return details && details.getAttribute('data-layer-id') === '1';
    }, null, { timeout: 10000 });
    summary.selection_on_layer1 = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      property_actions: await readPropertyActions(page),
    };
    ensure(summary.selection_on_layer1.layer_panel.currentLayerId === 2, 'Expected current layer to stay on 2 after selecting layer-1 entity');
    ensure(summary.selection_on_layer1.layer_panel.focusedLayerId === 1, 'Expected focused layer to follow selected entity layer 1');
    ensure(summary.selection_on_layer1.property_actions.some((action) => action.id === 'use-layer'), 'Expected Make Current action when focused layer differs from current layer');
    ensure(summary.selection_on_layer1.property_actions.some((action) => action.id === 'use-layer' && action.label === 'Make Current'), 'Expected Make Current label in property panel');
    ensure(summary.selection_on_layer1.property_actions.some((action) => action.id === 'isolate-layer' && action.label === 'Isolate Layer'), 'Expected Isolate Layer action on selected layer');

    await runTypedCommand(page, 'layiso');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function' || typeof debug.getCurrentLayerId !== 'function') return false;
      const layers = debug.listLayers();
      const layer0 = layers.find((layer) => layer.id === 0);
      const layer1 = layers.find((layer) => layer.id === 1);
      const layer2 = layers.find((layer) => layer.id === 2);
      return debug.getCurrentLayerId() === 1
        && layer0 && layer0.visible === false
        && layer1 && layer1.visible !== false
        && layer2 && layer2.visible === false;
    }, null, { timeout: 10000 });
    summary.after_layiso = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerVisibilityState(page),
      property_actions: await readPropertyActions(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_layiso.current.currentLayerId === 1, 'Expected layiso to fall current layer back onto isolated layer 1');
    ensure(summary.after_layiso.layers.find((layer) => layer.id === 0)?.visible === false, 'Expected layiso to hide layer 0');
    ensure(summary.after_layiso.layers.find((layer) => layer.id === 1)?.visible === true, 'Expected layiso to keep layer 1 visible');
    ensure(summary.after_layiso.layers.find((layer) => layer.id === 2)?.visible === false, 'Expected layiso to hide layer 2');
    ensure(summary.after_layiso.property_actions.some((action) => action.id === 'restore-layers' && action.label === 'Restore Layers'), 'Expected Restore Layers action while isolation session is active');

    await runTypedCommand(page, 'layuniso');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listLayers !== 'function') return false;
      const layers = debug.listLayers();
      return layers.every((layer) => layer.id === 2 ? layer.visible !== false : layer.visible !== false);
    }, null, { timeout: 10000 });
    summary.after_layuniso = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      layers: await readLayerVisibilityState(page),
      property_actions: await readPropertyActions(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_layuniso.layers.find((layer) => layer.id === 0)?.visible === true, 'Expected layuniso to restore layer 0 visibility');
    ensure(summary.after_layuniso.layers.find((layer) => layer.id === 2)?.visible === true, 'Expected layuniso to restore layer 2 visibility');

    await clickLayerAction(page, 2, 'current');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 2, null, { timeout: 10000 });
    summary.after_layuniso_reset_current = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
    };

    await runTypedCommand(page, 'laymcur');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 1, null, { timeout: 10000 });
    summary.after_laymcur = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.after_laymcur.layer_panel.currentLayerId === 1, 'Expected laymcur to promote selected entity layer to current');

    const laymcurCreate = await createLineEntity(page, { x: -24, y: -10 }, { x: 24, y: -10 });
    const laymcurCreatedId = laymcurCreate.createdId;
    summary.laymcur_created_entity = await readEntity(page, laymcurCreatedId);
    summary.laymcur_created_via = laymcurCreate.mode;
    ensure(summary.laymcur_created_entity?.layerId === 1, `Expected laymcur-created entity on layer 1, got ${summary.laymcur_created_entity?.layerId}`);
    ensure(summary.laymcur_created_entity?.color === '#808080', `Expected laymcur-created entity BYLAYER color #808080, got ${summary.laymcur_created_entity?.color}`);
    ensure(summary.laymcur_created_entity?.colorSource === 'BYLAYER', `Expected laymcur-created entity BYLAYER color source, got ${summary.laymcur_created_entity?.colorSource}`);

    await clickLayerAction(page, 2, 'current');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 2, null, { timeout: 10000 });
    summary.after_reset_current = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
    };

    await clickLayerAction(page, 1, 'locked');
    await page.waitForFunction(() => {
      const layer = window.__cadDebug?.getCurrentLayer?.();
      return window.__cadDebug?.getCurrentLayerId?.() === 2 && layer && layer.id === 2;
    }, null, { timeout: 10000 });
    await ensureEntitySelection(page, 7);
    await runTypedCommand(page, 'laymcur');
    await page.waitForTimeout(80);
    summary.locked_laymcur = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
      status: await page.textContent('#cad-status-message'),
    };
    ensure(summary.locked_laymcur.current.currentLayerId === 2, 'Expected laymcur on locked layer to keep current layer unchanged');
    ensure(String(summary.locked_laymcur.status || '').includes('Layer unavailable for drawing'), 'Expected locked laymcur failure status');

    const firstCreate = await createLineEntity(page, { x: -24, y: -16 }, { x: 24, y: -16 });
    const firstNewId = firstCreate.createdId;
    summary.first_created_entity = await readEntity(page, firstNewId);
    summary.first_created_via = firstCreate.mode;
    ensure(summary.first_created_entity?.layerId === 2, `Expected first post-lock entity on current layer 2, got ${summary.first_created_entity?.layerId}`);
    ensure(summary.first_created_entity?.color === '#00aaff', `Expected first post-lock entity BYLAYER color #00aaff, got ${summary.first_created_entity?.color}`);
    ensure(summary.first_created_entity?.colorSource === 'BYLAYER', `Expected first post-lock entity BYLAYER color source, got ${summary.first_created_entity?.colorSource}`);
    ensure(summary.first_created_entity?.lineType === 'BYLAYER', `Expected first post-lock entity lineType BYLAYER, got ${summary.first_created_entity?.lineType}`);
    ensure(Number(summary.first_created_entity?.lineWeight || 0) === 0, `Expected first post-lock entity lineWeight 0, got ${summary.first_created_entity?.lineWeight}`);
    ensure(summary.first_created_entity?.lineWeightSource === 'BYLAYER', `Expected first post-lock entity lineWeightSource BYLAYER, got ${summary.first_created_entity?.lineWeightSource}`);

    await clickLayerAction(page, 1, 'locked');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const layer = debug && typeof debug.getCurrentLayer === 'function' ? debug.getCurrentLayer() : null;
      return debug?.getCurrentLayerId?.() === 2 && layer && layer.id === 2;
    }, null, { timeout: 10000 });

    await clickLayerAction(page, 2, 'locked');
    await page.waitForFunction(() => window.__cadDebug?.getCurrentLayerId?.() === 1, null, { timeout: 10000 });
    summary.after_lock_fallback = {
      current: await readCurrentLayerState(page),
      layer_panel: await readLayerPanelState(page),
    };
    ensure(summary.after_lock_fallback.layer_panel.currentLayerId === 1, 'Expected current layer fallback to 1 after locking layer 2');

    const secondCreate = await createLineEntity(page, { x: -24, y: -16 }, { x: 24, y: -16 });
    const secondNewId = secondCreate.createdId;
    summary.second_created_entity = await readEntity(page, secondNewId);
    summary.second_created_via = secondCreate.mode;
    ensure(summary.second_created_entity?.layerId === 1, `Expected second created entity on fallback layer 1, got ${summary.second_created_entity?.layerId}`);
    ensure(summary.second_created_entity?.color === '#808080', `Expected second created entity BYLAYER color #808080, got ${summary.second_created_entity?.color}`);
    ensure(summary.second_created_entity?.colorSource === 'BYLAYER', `Expected second created entity BYLAYER color source, got ${summary.second_created_entity?.colorSource}`);
    ensure(summary.second_created_entity?.lineType === 'BYLAYER', `Expected second created entity lineType BYLAYER, got ${summary.second_created_entity?.lineType}`);
    ensure(Number(summary.second_created_entity?.lineWeight || 0) === 0, `Expected second created entity lineWeight 0, got ${summary.second_created_entity?.lineWeight}`);
    ensure(summary.second_created_entity?.lineWeightSource === 'BYLAYER', `Expected second created entity lineWeightSource BYLAYER, got ${summary.second_created_entity?.lineWeightSource}`);

    summary.final_status = await page.textContent('#cad-status-message');
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
    console.error(`editor_current_layer_smoke: FAIL (${summaryPath})`);
    process.exit(1);
  }

  console.log(`editor_current_layer_smoke: PASS (${summaryPath})`);
}

await run();
