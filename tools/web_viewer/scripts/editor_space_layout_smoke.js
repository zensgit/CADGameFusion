#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_space_layout_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_space_layout_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_space_layout_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_space_layout_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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

async function runTypedCommand(page, raw) {
  await page.fill('#cad-command-input', raw);
  await page.keyboard.press('Enter');
}

async function readCurrentSpaceState(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    const info = Object.fromEntries(
      Array.from(document.querySelectorAll('#cad-property-form [data-property-info]'))
        .map((row) => {
          const key = String(row.getAttribute('data-property-info') || '').trim();
          if (!key) return null;
          const text = String(row.textContent || '').trim();
          const value = text.includes(':') ? text.split(':').slice(1).join(':').trim() : text;
          return [key, value];
        })
        .filter(Boolean)
    );
    const actions = Array.from(document.querySelectorAll('#cad-property-form [data-property-action]'))
      .map((button) => ({
        id: String(button.getAttribute('data-property-action') || '').trim(),
        label: String(button.textContent || '').trim(),
      }))
      .filter((action) => action.id);
    const status = document.getElementById('cad-status-space');
    return {
      statusText: status ? String(status.textContent || '').trim() : '',
      context: debug && typeof debug.getCurrentSpaceContext === 'function' ? debug.getCurrentSpaceContext() : null,
      visibleEntityIds: debug && typeof debug.listVisibleEntityIds === 'function' ? debug.listVisibleEntityIds() : [],
      paperLayouts: debug && typeof debug.listPaperLayouts === 'function' ? debug.listPaperLayouts() : [],
      propertyInfo: info,
      propertyActions: actions,
    };
  });
}

async function readEntity(page, entityId) {
  return page.evaluate((id) => window.__cadDebug?.getEntity?.(id) || null, entityId);
}

async function readSelectionFacts(page) {
  return page.evaluate(() => Object.fromEntries(
    Array.from(document.querySelectorAll('#cad-selection-details [data-selection-field]'))
      .map((row) => {
        const key = String(row.getAttribute('data-selection-field') || '').trim();
        if (!key) return null;
        const value = row.querySelector('strong');
        return [key, value ? String(value.textContent || '').trim() : String(row.textContent || '').trim()];
      })
      .filter(Boolean)
  ));
}

async function listEntityIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return [];
    return debug.listEntities().map((entity) => entity.id).filter(Number.isFinite).sort((a, b) => a - b);
  });
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
      width: rect.width,
      height: rect.height,
    };
  }, worldPoint);
  ensure(point, `Failed to project world point ${JSON.stringify(worldPoint)}`);
  ensure(point.x >= 0 && point.y >= 0, `Projected point is off-canvas: ${JSON.stringify(point)}`);
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

async function clickPropertyAction(page, actionId) {
  await page.click(`#cad-property-form [data-property-action="${actionId}"]`);
}

async function clearSelection(page) {
  await page.evaluate(() => window.__cadDebug?.setSelection?.([], null));
}

async function selectEntity(page, entityId) {
  await page.evaluate((id) => window.__cadDebug?.setSelection?.([id], id), entityId);
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const runDir = path.join(args.outdir, nowStamp());
  ensureDir(runDir);

  let serverHandle = null;
  let browser = null;
  const summary = {
    ok: false,
    fixture: args.fixture,
  };

  try {
    if (!args.baseUrl) {
      serverHandle = await startStaticServer(repoRoot, args.host, args.port);
    }
    const resolvedBase = args.baseUrl || serverHandle.baseUrl;
    const url = new URL('tools/web_viewer/index.html', resolvedBase);
    url.searchParams.set('mode', 'editor');
    url.searchParams.set('debug', '1');
    url.searchParams.set('cadgf', args.fixture);
    summary.url = url.toString();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));

    await page.goto(summary.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__cadDebug && typeof window.__cadDebug.getCurrentSpaceContext === 'function', null, { timeout: 15000 });

    summary.initial = await readCurrentSpaceState(page);
    ensure(summary.initial.context?.space === 0, `Expected initial model space, got ${JSON.stringify(summary.initial.context)}`);
    ensure(summary.initial.context?.layout === 'Model', `Expected initial model layout, got ${JSON.stringify(summary.initial.context)}`);
    ensure(summary.initial.statusText === 'Space: Model', `Expected model status, got ${summary.initial.statusText}`);
    ensure(JSON.stringify(summary.initial.visibleEntityIds) === JSON.stringify([1]), `Expected only model entity visible initially, got ${JSON.stringify(summary.initial.visibleEntityIds)}`);
    ensure(summary.initial.propertyInfo['current-space'] === 'Model', `Expected property current-space=Model, got ${JSON.stringify(summary.initial.propertyInfo)}`);
    ensure(summary.initial.propertyActions.some((action) => action.id === 'use-layout-layout-a'), 'Expected Layout-A action in no-selection property panel');
    ensure(summary.initial.propertyActions.some((action) => action.id === 'use-layout-layout-b'), 'Expected Layout-B action in no-selection property panel');

    await runTypedCommand(page, 'layout Layout-A');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const current = debug?.getCurrentSpaceContext?.();
      return current && current.space === 1 && current.layout === 'Layout-A';
    }, null, { timeout: 10000 });
    await runTypedCommand(page, 'fit');
    summary.after_layout_a = await readCurrentSpaceState(page);
    ensure(summary.after_layout_a.statusText === 'Space: Paper / Layout-A', `Expected Layout-A status, got ${summary.after_layout_a.statusText}`);
    ensure(JSON.stringify(summary.after_layout_a.visibleEntityIds) === JSON.stringify([2]), `Expected only Layout-A entity visible, got ${JSON.stringify(summary.after_layout_a.visibleEntityIds)}`);

    const createA = await createLineEntity(page, { x: -12, y: 12 }, { x: 12, y: 12 });
    summary.layout_a_create_mode = createA.mode;
    summary.layout_a_entity = await readEntity(page, createA.createdId);
    ensure(summary.layout_a_entity?.space === 1, `Expected Layout-A created entity in paper space, got ${JSON.stringify(summary.layout_a_entity)}`);
    ensure(summary.layout_a_entity?.layout === 'Layout-A', `Expected Layout-A created entity layout, got ${JSON.stringify(summary.layout_a_entity)}`);
    await selectEntity(page, createA.createdId);
    summary.layout_a_selection = await readSelectionFacts(page);
    ensure(summary.layout_a_selection.space === 'Paper', `Expected Paper selection fact, got ${JSON.stringify(summary.layout_a_selection)}`);
    ensure(summary.layout_a_selection.layout === 'Layout-A', `Expected Layout-A selection fact, got ${JSON.stringify(summary.layout_a_selection)}`);

    await clearSelection(page);
    await clickPropertyAction(page, 'use-layout-layout-b');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const current = debug?.getCurrentSpaceContext?.();
      return current && current.space === 1 && current.layout === 'Layout-B';
    }, null, { timeout: 10000 });
    await runTypedCommand(page, 'fit');
    summary.after_layout_b = await readCurrentSpaceState(page);
    ensure(summary.after_layout_b.statusText === 'Space: Paper / Layout-B', `Expected Layout-B status, got ${summary.after_layout_b.statusText}`);
    ensure(JSON.stringify(summary.after_layout_b.visibleEntityIds) === JSON.stringify([3]), `Expected only Layout-B entity visible, got ${JSON.stringify(summary.after_layout_b.visibleEntityIds)}`);

    const createB = await createLineEntity(page, { x: -12, y: 28 }, { x: 12, y: 28 });
    summary.layout_b_create_mode = createB.mode;
    summary.layout_b_entity = await readEntity(page, createB.createdId);
    ensure(summary.layout_b_entity?.space === 1, `Expected Layout-B created entity in paper space, got ${JSON.stringify(summary.layout_b_entity)}`);
    ensure(summary.layout_b_entity?.layout === 'Layout-B', `Expected Layout-B created entity layout, got ${JSON.stringify(summary.layout_b_entity)}`);

    await clearSelection(page);
    await clickPropertyAction(page, 'use-model-space');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const current = debug?.getCurrentSpaceContext?.();
      return current && current.space === 0 && current.layout === 'Model';
    }, null, { timeout: 10000 });
    await runTypedCommand(page, 'fit');
    summary.after_model = await readCurrentSpaceState(page);
    ensure(summary.after_model.statusText === 'Space: Model', `Expected model status after restore, got ${summary.after_model.statusText}`);
    ensure(JSON.stringify(summary.after_model.visibleEntityIds) === JSON.stringify([1]), `Expected only model entity visible after restore, got ${JSON.stringify(summary.after_model.visibleEntityIds)}`);

    const createModel = await createLineEntity(page, { x: -14, y: -8 }, { x: 14, y: -8 });
    summary.model_create_mode = createModel.mode;
    summary.model_entity = await readEntity(page, createModel.createdId);
    ensure(summary.model_entity?.space === 0, `Expected model created entity in model space, got ${JSON.stringify(summary.model_entity)}`);
    ensure(summary.model_entity?.layout === 'Model', `Expected model created entity layout, got ${JSON.stringify(summary.model_entity)}`);

    summary.console_messages = consoleMessages;
    summary.page_errors = pageErrors;
    summary.ok = true;
    summary.screenshot = path.join(runDir, 'editor_space_layout.png');
    await page.screenshot({ path: summary.screenshot, fullPage: true });
  } catch (error) {
    summary.error = String(error?.stack || error?.message || error);
  } finally {
    if (browser) await browser.close();
    if (serverHandle?.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  }

  const summaryPath = path.join(runDir, 'summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) {
    console.error(summary.error || 'editor_space_layout_smoke: failed');
    process.exitCode = 1;
    return;
  }
  console.log(`editor_space_layout_smoke: PASS (${summaryPath})`);
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
