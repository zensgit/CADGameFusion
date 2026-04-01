#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_source_group_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_source_group_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_source_group_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_source_group_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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
  const decoded = decodeURIComponent((requestPath || '/').split('?')[0] || '/');
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

function ensureApprox(actual, expected, label, epsilon = 1e-6) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function setCurrentSpaceContext(page, context) {
  return page.evaluate((next) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.setCurrentSpaceContext !== 'function') return false;
    return debug.setCurrentSpaceContext(next);
  }, context);
}

async function setSelection(page, ids, primaryId) {
  return page.evaluate(({ nextIds, nextPrimaryId }) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.setSelection !== 'function') return null;
    return debug.setSelection(nextIds, nextPrimaryId);
  }, {
    nextIds: ids,
    nextPrimaryId: primaryId,
  });
}

async function readSelectionIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
  });
}

async function readEntities(page, ids) {
  return page.evaluate((nextIds) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.getEntity !== 'function') return [];
    return nextIds.map((id) => debug.getEntity(id));
  }, ids);
}

async function runDebugCommand(page, id, payload = undefined) {
  return page.evaluate(({ commandId, commandPayload }) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.runCommand !== 'function') return null;
    return debug.runCommand(commandId, commandPayload);
  }, {
    commandId: id,
    commandPayload: payload,
  });
}

async function readSelectionDetails(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#cad-selection-details');
    if (!root) return null;
    const items = Object.fromEntries(
      Array.from(root.querySelectorAll('[data-selection-field]'))
        .map((row) => {
          const key = String(row.getAttribute('data-selection-field') || '').trim();
          if (!key) return null;
          const valueEl = row.querySelector('strong');
          return [key, valueEl ? String(valueEl.textContent || '').trim() : String(row.textContent || '').trim()];
        })
        .filter(Boolean)
    );
    return {
      mode: String(root.getAttribute('data-mode') || ''),
      entityCount: Number.parseInt(String(root.getAttribute('data-entity-count') || '0'), 10),
      items,
    };
  });
}

async function readPropertyFormState(page) {
  return page.evaluate(() => {
    const form = document.querySelector('#cad-property-form');
    if (!form) return null;
    const meta = Object.fromEntries(
      Array.from(form.querySelectorAll('[data-property-info]'))
        .map((row) => {
          const key = String(row.getAttribute('data-property-info') || '').trim();
          if (!key) return null;
          const text = String(row.textContent || '').trim();
          const value = text.includes(':') ? text.split(':').slice(1).join(':').trim() : text;
          return [key, value];
        })
        .filter(Boolean)
    );
    const actions = Array.from(form.querySelectorAll('[data-property-action]'))
      .map((button) => String(button.getAttribute('data-property-action') || '').trim())
      .filter(Boolean);
    const notes = Array.from(form.querySelectorAll('.cad-readonly-note'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
    const fields = Array.from(form.querySelectorAll('input[name], textarea[name], select[name]'))
      .map((node) => String(node.getAttribute('name') || '').trim())
      .filter(Boolean);
    return { meta, actions, notes, fields };
  });
}

async function readOverlays(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getOverlays === 'function' ? debug.getOverlays() : null;
  });
}

async function readView(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getView === 'function' ? debug.getView() : null;
  });
}

async function clickPropertyAction(page, actionId) {
  const button = page.locator(`#cad-property-form [data-property-action="${actionId}"]`).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
}

async function fillPropertyInput(page, name, value) {
  const input = page.locator(`#cad-property-form [name="${name}"]`).first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(value);
  await input.press('Tab');
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const runDir = path.join(args.outdir, nowStamp());
  ensureDir(runDir);
  const summaryPath = path.join(runDir, 'summary.json');
  const screenshotPath = path.join(runDir, 'source_group.png');

  let serverHandle = null;
  let browser = null;
  let page = null;
  const summary = {
    ok: false,
    fixture: args.fixture,
  };

  try {
    if (args.noServe) {
      summary.baseUrl = args.baseUrl;
    } else {
      serverHandle = await startStaticServer(repoRoot, args.host, args.port);
      summary.baseUrl = serverHandle.baseUrl;
    }

    const pageUrl = new URL('tools/web_viewer/index.html', summary.baseUrl);
    pageUrl.searchParams.set('mode', 'editor');
    pageUrl.searchParams.set('debug', '1');
    pageUrl.searchParams.set('cadgf', String(args.fixture || DEFAULT_FIXTURE).trim());
    summary.url = pageUrl.toString();

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    await page.goto(summary.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.listEntities === 'function'
        && debug.listEntities().length >= 9;
    }, null, { timeout: 15000 });

    await setCurrentSpaceContext(page, { space: 1, layout: 'Layout-A' });

    await setSelection(page, [24], 24);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-entity-count') || '') === '1';
    }, null, { timeout: 10000 });

    summary.dimension_before = {
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.dimension_before?.details?.items?.['group-id'] === '700', `unexpected dimension group id: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['group-source'] === 'DIMENSION / dimension', `unexpected dimension group source: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['source-group-members'] === '4', `unexpected dimension source-group-members: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['editable-members'] === '0', `unexpected dimension editable-members: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['read-only-members'] === '4', `unexpected dimension read-only-members: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['group-center'] === '0, 7', `unexpected dimension group-center: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['group-size'] === '40 x 14', `unexpected dimension group-size: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['group-bounds'] === '-20, 0 -> 20, 14', `unexpected dimension group-bounds: ${JSON.stringify(summary.dimension_before)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.dimension_before?.details?.items || {}, 'insert-group-members'), `dimension should not expose insert-group-members: ${JSON.stringify(summary.dimension_before)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.dimension_before?.details?.items || {}, 'peer-targets'), `dimension should not expose peer-targets: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.meta?.['group-source'] === 'DIMENSION / dimension', `unexpected dimension property group-source: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('select-source-group'), `missing select-source-group action: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('fit-source-group'), `missing fit-source-group action: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('release-source-group'), `missing release-source-group action: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.fields?.includes('value'), `dimension text proxy should expose direct text field: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.notes?.some((note) => note.includes('text overrides stay editable')), `dimension text proxy should explain direct text edits: ${JSON.stringify(summary.dimension_before)}`);
    ensure(!summary.dimension_before?.property?.actions?.includes('select-insert-group'), `dimension should not expose select-insert-group: ${JSON.stringify(summary.dimension_before)}`);
    ensure(!summary.dimension_before?.property?.actions?.includes('release-insert-group'), `dimension should not expose release-insert-group: ${JSON.stringify(summary.dimension_before)}`);
    await fillPropertyInput(page, 'value', 'DIM_PROXY_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.value === 'DIM_PROXY_EDITED'
        && entity.sourceType === 'DIMENSION'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.dimension_proxy_text_edit = {
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_proxy_text_edit?.statusText || '').includes('Text updated'), `unexpected dimension direct text edit status: ${JSON.stringify(summary.dimension_proxy_text_edit)}`);

    await clickPropertyAction(page, 'select-source-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 4 && ids[0] === 21 && ids[1] === 22 && ids[2] === 23 && ids[3] === 24;
    }, null, { timeout: 10000 });
    summary.dimension_after_select = {
      selectionIds: await readSelectionIds(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.dimension_after_select?.property?.notes?.some((note) => note.includes('read-only')), `missing read-only note after dimension group select: ${JSON.stringify(summary.dimension_after_select)}`);
    ensure(summary.dimension_after_select?.property?.notes?.some((note) => note.includes('move/rotate/scale/copy/delete')), `missing transform note after dimension group select: ${JSON.stringify(summary.dimension_after_select)}`);
    ensure(!summary.dimension_after_select?.property?.actions?.includes('select-source-group'), `full dimension group should not expose select-source-group: ${JSON.stringify(summary.dimension_after_select)}`);
    ensure(summary.dimension_after_select?.property?.actions?.includes('select-source-text'), `full dimension group missing select-source-text: ${JSON.stringify(summary.dimension_after_select)}`);
    ensure(summary.dimension_after_select?.property?.actions?.includes('fit-source-group'), `full dimension group missing fit-source-group: ${JSON.stringify(summary.dimension_after_select)}`);
    ensure(summary.dimension_after_select?.property?.actions?.includes('release-source-group'), `full dimension group missing release-source-group: ${JSON.stringify(summary.dimension_after_select)}`);

    await clickPropertyAction(page, 'select-source-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return root
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 24
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'true';
    }, null, { timeout: 10000 });
    summary.dimension_after_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_select_text?.statusText || '').includes('Selected source text (1 of 4 entities)'), `unexpected dimension select-source-text status: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.property?.fields?.includes('value'), `dimension selected source text should expose value field: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.property?.actions?.includes('reset-source-text-placement'), `dimension selected source text missing reset-source-text-placement: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.property?.actions?.includes('fit-source-anchor'), `dimension selected source text missing fit-source-anchor: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.property?.actions?.includes('select-source-anchor-driver'), `dimension selected source text missing select-source-anchor-driver: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.property?.actions?.includes('flip-dimension-text-side'), `dimension selected source text missing flip-dimension-text-side: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['source-text-pos'] === '0, 14', `unexpected dimension source-text-pos: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['source-text-rotation'] === '0', `unexpected dimension source-text-rotation: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['source-anchor'] === '0, 0', `unexpected dimension source-anchor: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['source-anchor-driver'] === '21:line midpoint', `unexpected dimension source-anchor-driver: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['source-offset'] === '0, 14', `unexpected dimension source-offset: ${JSON.stringify(summary.dimension_after_select_text)}`);
    ensure(summary.dimension_after_select_text?.details?.items?.['current-offset'] === '0, 14', `unexpected dimension current-offset: ${JSON.stringify(summary.dimension_after_select_text)}`);
    await clickPropertyAction(page, 'flip-dimension-text-side');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 0
        && entity.position?.y === -14
        && entity.sourceTextPos?.x === 0
        && entity.sourceTextPos?.y === 14
        && entity.dimTextPos?.x === 0
        && entity.dimTextPos?.y === -14
        && Math.abs((entity.rotation || 0) - 0) < 1e-9;
    }, null, { timeout: 10000 });
    summary.dimension_after_flip_side = {
      details: await readSelectionDetails(page),
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_flip_side?.statusText || '').includes('Applied opposite DIMENSION text side (1 of 4 entities)'), `unexpected dimension flip-side status: ${JSON.stringify(summary.dimension_after_flip_side)}`);
    ensure(summary.dimension_after_flip_side?.details?.items?.['current-offset'] === '0, -14', `unexpected dimension flipped current-offset: ${JSON.stringify(summary.dimension_after_flip_side)}`);
    await clickPropertyAction(page, 'reset-source-text-placement');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 0
        && entity.position?.y === 14
        && entity.sourceTextPos?.x === 0
        && entity.sourceTextPos?.y === 14
        && entity.dimTextPos?.x === 0
        && entity.dimTextPos?.y === 14;
    }, null, { timeout: 10000 });
    await clickPropertyAction(page, 'select-source-anchor-driver');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return root
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 21
        && String(root.getAttribute('data-primary-type') || '') === 'line';
    }, null, { timeout: 10000 });
    summary.dimension_after_select_anchor_driver = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_select_anchor_driver?.statusText || '').includes('Selected source anchor driver (line midpoint)'), `unexpected dimension select-source-anchor-driver status: ${JSON.stringify(summary.dimension_after_select_anchor_driver)}`);
    ensure(summary.dimension_after_select_anchor_driver?.selectionIds?.length === 1 && summary.dimension_after_select_anchor_driver.selectionIds[0] === 21, `unexpected dimension anchor-driver selection: ${JSON.stringify(summary.dimension_after_select_anchor_driver)}`);
    ensure(summary.dimension_after_select_anchor_driver?.details?.items?.['group-id'] === '700', `dimension anchor driver should stay in source group: ${JSON.stringify(summary.dimension_after_select_anchor_driver)}`);
    await setSelection(page, [24], 24);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 24;
    }, null, { timeout: 10000 });
    await clickPropertyAction(page, 'fit-source-anchor');
    const overlaysAfterDimensionAnchorFit = await readOverlays(page);
    summary.dimension_after_anchor_fit = {
      overlay: overlaysAfterDimensionAnchorFit?.sourceTextGuide || null,
      statusText: await page.locator('#cad-status-message').textContent(),
      view: await readView(page),
    };
    ensure(String(summary.dimension_after_anchor_fit?.statusText || '').includes('Fit Source Anchor: DIMENSION 700'), `unexpected dimension fit-source-anchor status: ${JSON.stringify(summary.dimension_after_anchor_fit)}`);
    ensureApprox(summary.dimension_after_anchor_fit?.overlay?.anchor?.x, 0, 'dimension anchor overlay x');
    ensureApprox(summary.dimension_after_anchor_fit?.overlay?.anchor?.y, 0, 'dimension anchor overlay y');
    ensureApprox(summary.dimension_after_anchor_fit?.overlay?.sourcePoint?.x, 0, 'dimension source overlay x');
    ensureApprox(summary.dimension_after_anchor_fit?.overlay?.sourcePoint?.y, 14, 'dimension source overlay y');
    await fillPropertyInput(page, 'value', 'DIM_GROUP_PROXY_EDITED');
    await fillPropertyInput(page, 'position.x', '4');
    await fillPropertyInput(page, 'position.y', '18');
    await fillPropertyInput(page, 'rotation', '0.5');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.value === 'DIM_GROUP_PROXY_EDITED'
        && entity.position?.x === 4
        && entity.position?.y === 18
        && Math.abs((entity.rotation || 0) - 0.5) < 1e-9
        && entity.sourceType === 'DIMENSION'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.dimension_group_proxy_text_edit = {
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_group_proxy_text_edit?.statusText || '').includes('updated'), `unexpected dimension group proxy text edit status: ${JSON.stringify(summary.dimension_group_proxy_text_edit)}`);
    await clickPropertyAction(page, 'reset-source-text-placement');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 0
        && entity.position?.y === 14
        && Math.abs((entity.rotation || 0) - 0) < 1e-9
        && entity.sourceType === 'DIMENSION'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.dimension_after_reset_placement = {
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_reset_placement?.statusText || '').includes('Reset source text placement (1 of 4 entities)'), `unexpected dimension reset placement status: ${JSON.stringify(summary.dimension_after_reset_placement)}`);

    await clickPropertyAction(page, 'select-source-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 4 && ids[0] === 21 && ids[1] === 22 && ids[2] === 23 && ids[3] === 24;
    }, null, { timeout: 10000 });

    const moveResult = await runDebugCommand(page, 'selection.move', { delta: { x: 5, y: -3 } });
    const movedEntities = await readEntities(page, [21, 22, 23, 24]);
    ensure(moveResult?.ok === true, `dimension source-group move failed: ${JSON.stringify(moveResult)}`);
    ensure(moveResult?.message === 'Moved source group (4 entities, including 4 read-only)', `unexpected dimension move message: ${JSON.stringify(moveResult)}`);
    ensureApprox(movedEntities[0]?.start?.x, -15, 'dimension move line start.x');
    ensureApprox(movedEntities[0]?.start?.y, -3, 'dimension move line start.y');
    ensureApprox(movedEntities[3]?.position?.x, 5, 'dimension move text position.x');
    ensureApprox(movedEntities[3]?.position?.y, 11, 'dimension move text position.y');
    summary.dimension_after_move = {
      result: moveResult,
      entities: movedEntities,
    };

    const undoMove = await runDebugCommand(page, 'history.undo');
    ensure(undoMove?.ok === true, `undo after dimension move failed: ${JSON.stringify(undoMove)}`);

    const rotateResult = await runDebugCommand(page, 'selection.rotate', {
      center: { x: 0, y: 0 },
      angle: Math.PI / 2,
    });
    const rotatedEntities = await readEntities(page, [21, 24]);
    ensure(rotateResult?.ok === true, `dimension source-group rotate failed: ${JSON.stringify(rotateResult)}`);
    ensure(rotateResult?.message === 'Rotated source group (4 entities, including 4 read-only)', `unexpected dimension rotate message: ${JSON.stringify(rotateResult)}`);
    ensureApprox(rotatedEntities[0]?.start?.x, 0, 'dimension rotate line start.x');
    ensureApprox(rotatedEntities[0]?.start?.y, -20, 'dimension rotate line start.y');
    ensureApprox(rotatedEntities[1]?.position?.x, -14, 'dimension rotate text position.x');
    ensureApprox(rotatedEntities[1]?.position?.y, 0, 'dimension rotate text position.y');
    ensureApprox(rotatedEntities[1]?.rotation, Math.PI / 2, 'dimension rotate text rotation');
    summary.dimension_after_rotate = {
      result: rotateResult,
      entities: rotatedEntities,
    };

    const undoRotate = await runDebugCommand(page, 'history.undo');
    ensure(undoRotate?.ok === true, `undo after dimension rotate failed: ${JSON.stringify(undoRotate)}`);

    const scaleResult = await runDebugCommand(page, 'selection.scale', {
      center: { x: 0, y: 0 },
      factor: 0.5,
    });
    const scaledEntities = await readEntities(page, [21, 24]);
    ensure(scaleResult?.ok === true, `dimension source-group scale failed: ${JSON.stringify(scaleResult)}`);
    ensure(scaleResult?.message === 'Scaled source group (4 entities, including 4 read-only)', `unexpected dimension scale message: ${JSON.stringify(scaleResult)}`);
    ensureApprox(scaledEntities[0]?.start?.x, -10, 'dimension scale line start.x');
    ensureApprox(scaledEntities[0]?.end?.x, 10, 'dimension scale line end.x');
    ensureApprox(scaledEntities[1]?.position?.x, 0, 'dimension scale text position.x');
    ensureApprox(scaledEntities[1]?.position?.y, 7, 'dimension scale text position.y');
    ensureApprox(scaledEntities[1]?.height, 1.25, 'dimension scale text height');
    summary.dimension_after_scale = {
      result: scaleResult,
      entities: scaledEntities,
    };

    const undoScale = await runDebugCommand(page, 'history.undo');
    ensure(undoScale?.ok === true, `undo after dimension scale failed: ${JSON.stringify(undoScale)}`);

    const copyResult = await runDebugCommand(page, 'selection.copy', { delta: { x: 50, y: 0 } });
    const copiedSelectionIds = await readSelectionIds(page);
    const copiedEntities = await readEntities(page, copiedSelectionIds);
    ensure(copyResult?.ok === true, `dimension source-group copy failed: ${JSON.stringify(copyResult)}`);
    ensure(copyResult?.message === 'Copied source group as detached geometry (4 entities)', `unexpected dimension copy message: ${JSON.stringify(copyResult)}`);
    ensure(Array.isArray(copiedSelectionIds) && copiedSelectionIds.length === 4, `unexpected copied selection ids: ${JSON.stringify(copiedSelectionIds)}`);
    ensure(copiedEntities.every((entity) => !Number.isFinite(entity?.groupId) && !entity?.sourceType && !entity?.editMode && !entity?.proxyKind), `copied dimension entities should be detached: ${JSON.stringify(copiedEntities)}`);
    summary.dimension_after_copy = {
      result: copyResult,
      selectionIds: copiedSelectionIds,
      entities: copiedEntities,
    };

    await setSelection(page, [21, 22, 23, 24], 21);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 4 && ids[0] === 21 && ids[1] === 22 && ids[2] === 23 && ids[3] === 24;
    }, null, { timeout: 10000 });

    const viewBeforeDimensionFit = await readView(page);
    await clickPropertyAction(page, 'fit-source-group');
    const overlaysAfterDimensionFit = await readOverlays(page);
    const viewAfterDimensionFit = await readView(page);
    summary.dimension_after_fit = {
      beforeView: viewBeforeDimensionFit,
      afterView: viewAfterDimensionFit,
      overlay: overlaysAfterDimensionFit?.sourceGroupFrame || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_fit?.statusText || '').includes('Fit Source Group: DIMENSION 700'), `unexpected dimension fit status: ${JSON.stringify(summary.dimension_after_fit)}`);
    ensureApprox(summary.dimension_after_fit?.overlay?.minX, -20, 'dimension overlay minX');
    ensureApprox(summary.dimension_after_fit?.overlay?.minY, 0, 'dimension overlay minY');
    ensureApprox(summary.dimension_after_fit?.overlay?.maxX, 20, 'dimension overlay maxX');
    ensureApprox(summary.dimension_after_fit?.overlay?.maxY, 14, 'dimension overlay maxY');

    const moveForResetResult = await runDebugCommand(page, 'selection.move', { delta: { x: 3, y: -2 } });
    ensure(moveForResetResult?.ok === true, `dimension transform-aware source reset move failed: ${JSON.stringify(moveForResetResult)}`);
    ensure(moveForResetResult?.message === 'Moved source group (4 entities, including 4 read-only)', `unexpected dimension transform-aware move message: ${JSON.stringify(moveForResetResult)}`);
    await clickPropertyAction(page, 'select-source-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      const root = document.querySelector('#cad-selection-details');
      return !!entity
        && entity.position?.x === 3
        && entity.position?.y === 12
        && entity.sourceTextPos?.x === 3
        && entity.sourceTextPos?.y === 12
        && entity.dimTextPos?.x === 3
        && entity.dimTextPos?.y === 12
        && root
        && String(root.getAttribute('data-primary-type') || '') === 'text';
    }, null, { timeout: 10000 });
    summary.dimension_after_transform_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_transform_select_text?.statusText || '').includes('Selected source text (1 of 4 entities)'), `unexpected dimension transform-aware select-source-text status: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    ensure(summary.dimension_after_transform_select_text?.details?.items?.['source-text-pos'] === '3, 12', `unexpected moved dimension source-text-pos: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    ensure(summary.dimension_after_transform_select_text?.details?.items?.['source-text-rotation'] === '0', `unexpected moved dimension source-text-rotation: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    ensure(summary.dimension_after_transform_select_text?.details?.items?.['source-anchor'] === '3, -2', `unexpected moved dimension source-anchor: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    ensure(summary.dimension_after_transform_select_text?.details?.items?.['source-offset'] === '0, 14', `unexpected moved dimension source-offset: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    ensure(summary.dimension_after_transform_select_text?.details?.items?.['current-offset'] === '0, 14', `unexpected moved dimension current-offset: ${JSON.stringify(summary.dimension_after_transform_select_text)}`);
    await page.fill('#cad-command-input', 'srcflip');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 3
        && entity.position?.y === -16
        && entity.sourceTextPos?.x === 3
        && entity.sourceTextPos?.y === 12
        && entity.dimTextPos?.x === 3
        && entity.dimTextPos?.y === -16
        && Math.abs((entity.rotation || 0) - 0) < 1e-9;
    }, null, { timeout: 10000 });
    summary.dimension_after_transform_flip = {
      details: await readSelectionDetails(page),
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_transform_flip?.statusText || '').includes('Applied opposite DIMENSION text side (1 of 4 entities)'), `unexpected moved dimension dimflip status: ${JSON.stringify(summary.dimension_after_transform_flip)}`);
    ensure(summary.dimension_after_transform_flip?.details?.items?.['current-offset'] === '0, -14', `unexpected moved dimension flipped current-offset: ${JSON.stringify(summary.dimension_after_transform_flip)}`);
    await clickPropertyAction(page, 'reset-source-text-placement');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 3
        && entity.position?.y === 12
        && entity.sourceTextPos?.x === 3
        && entity.sourceTextPos?.y === 12
        && entity.dimTextPos?.x === 3
        && entity.dimTextPos?.y === 12;
    }, null, { timeout: 10000 });
    await fillPropertyInput(page, 'position.x', '6');
    await fillPropertyInput(page, 'position.y', '15');
    await fillPropertyInput(page, 'rotation', '0.25');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 6
        && entity.position?.y === 15
        && Math.abs((entity.rotation || 0) - 0.25) < 1e-9
        && entity.sourceTextPos?.x === 3
        && entity.sourceTextPos?.y === 12
        && entity.dimTextPos?.x === 6
        && entity.dimTextPos?.y === 15;
    }, null, { timeout: 10000 });
    await clickPropertyAction(page, 'reset-source-text-placement');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(24) : null;
      return !!entity
        && entity.position?.x === 3
        && entity.position?.y === 12
        && Math.abs((entity.rotation || 0) - 0) < 1e-9
        && entity.sourceTextPos?.x === 3
        && entity.sourceTextPos?.y === 12
        && entity.dimTextPos?.x === 3
        && entity.dimTextPos?.y === 12
        && Math.abs((entity.dimTextRotation || 0) - 0) < 1e-9;
    }, null, { timeout: 10000 });
    summary.dimension_after_transform_reset = {
      entity: (await readEntities(page, [24]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_transform_reset?.statusText || '').includes('Reset source text placement (1 of 4 entities)'), `unexpected dimension transform-aware reset status: ${JSON.stringify(summary.dimension_after_transform_reset)}`);

    await setSelection(page, [21, 22, 23, 24], 21);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 4 && ids[0] === 21 && ids[1] === 22 && ids[2] === 23 && ids[3] === 24;
    }, null, { timeout: 10000 });

    await page.fill('#cad-command-input', 'srcedit');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return root
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 24
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-read-only') || '') === 'false';
    }, null, { timeout: 10000 });
    const releasedDimensionText = (await readEntities(page, [24]))[0];
    summary.dimension_after_release = {
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      entity: releasedDimensionText,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_release?.statusText || '').includes('Released source group and selected source text (1 of 4 entities)'), `unexpected dimension release status: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.dimension_after_release?.details?.items || {}, 'group-source'), `released dimension should not keep group-source: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(!summary.dimension_after_release?.property?.actions?.includes('select-source-group'), `released dimension should not keep select-source-group: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(!summary.dimension_after_release?.property?.actions?.includes('release-source-group'), `released dimension should not keep release-source-group: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(summary.dimension_after_release?.property?.notes?.length === 0, `released dimension should not keep read-only note: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(summary.dimension_after_release?.property?.fields?.includes('value'), `released dimension text should expose editable value field: ${JSON.stringify(summary.dimension_after_release)}`);
    ensure(!Number.isFinite(releasedDimensionText?.groupId) && !releasedDimensionText?.sourceType && !releasedDimensionText?.editMode && !releasedDimensionText?.proxyKind, `released dimension text should be detached: ${JSON.stringify(releasedDimensionText)}`);

    await setSelection(page, [42], 42);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'true';
    }, null, { timeout: 10000 });
    summary.leader_text_before = {
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.leader_text_before?.property?.fields?.includes('value'), `leader text proxy should expose direct text field: ${JSON.stringify(summary.leader_text_before)}`);
    ensure(summary.leader_text_before?.property?.notes?.some((note) => note.includes('text overrides stay editable')), `leader text proxy should explain direct text edits: ${JSON.stringify(summary.leader_text_before)}`);
    await fillPropertyInput(page, 'value', 'LEADER_PROXY_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(42) : null;
      return !!entity
        && entity.value === 'LEADER_PROXY_EDITED'
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.leader_proxy_text_edit = {
      entity: (await readEntities(page, [42]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_proxy_text_edit?.statusText || '').includes('Text updated'), `unexpected leader direct text edit status: ${JSON.stringify(summary.leader_proxy_text_edit)}`);

    await setSelection(page, [41], 41);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'line';
    }, null, { timeout: 10000 });
    summary.leader_before = {
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.leader_before?.details?.items?.['group-id'] === '702', `unexpected leader group id: ${JSON.stringify(summary.leader_before)}`);
    ensure(summary.leader_before?.details?.items?.['group-source'] === 'LEADER / leader', `unexpected leader group source: ${JSON.stringify(summary.leader_before)}`);
    ensure(summary.leader_before?.details?.items?.['source-group-members'] === '2', `unexpected leader source-group-members: ${JSON.stringify(summary.leader_before)}`);
    ensure(summary.leader_before?.property?.actions?.includes('select-source-text'), `missing leader select-source-text action: ${JSON.stringify(summary.leader_before)}`);
    ensure(summary.leader_before?.property?.actions?.includes('edit-source-text'), `missing leader edit-source-text action: ${JSON.stringify(summary.leader_before)}`);
    ensure(summary.leader_before?.property?.actions?.includes('release-source-group'), `missing leader release-source-group action: ${JSON.stringify(summary.leader_before)}`);

    await page.fill('#cad-command-input', 'srctext');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return root
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 42
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'true';
    }, null, { timeout: 10000 });
    summary.leader_after_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_after_select_text?.statusText || '').includes('Selected source text (1 of 2 entities)'), `unexpected leader srctext status: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.fields?.includes('value'), `leader selected source text should expose value field: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.actions?.includes('reset-source-text-placement'), `leader selected source text missing reset-source-text-placement: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.actions?.includes('fit-source-anchor'), `leader selected source text missing fit-source-anchor: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.actions?.includes('fit-leader-landing'), `leader selected source text missing fit-leader-landing: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.actions?.includes('flip-leader-landing-side'), `leader selected source text missing flip-leader-landing-side: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.property?.actions?.includes('select-source-anchor-driver'), `leader selected source text missing select-source-anchor-driver: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['source-text-pos'] === '58, 7', `unexpected leader source-text-pos: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['source-text-rotation'] === '0', `unexpected leader source-text-rotation: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['source-anchor'] === '56, 6', `unexpected leader source-anchor: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['leader-landing'] === '56, 6', `unexpected leader landing: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['leader-elbow'] === '50, 0', `unexpected leader elbow: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['leader-landing-length'] === '8.485', `unexpected leader landing length: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['source-anchor-driver'] === '41:line endpoint', `unexpected leader source-anchor-driver: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['source-offset'] === '2, 1', `unexpected leader source-offset: ${JSON.stringify(summary.leader_after_select_text)}`);
    ensure(summary.leader_after_select_text?.details?.items?.['current-offset'] === '2, 1', `unexpected leader current-offset: ${JSON.stringify(summary.leader_after_select_text)}`);
    await clickPropertyAction(page, 'flip-leader-landing-side');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(42) : null;
      return !!entity
        && entity.position?.x === 57
        && entity.position?.y === 8
        && entity.sourceTextPos?.x === 58
        && entity.sourceTextPos?.y === 7
        && Math.abs((entity.rotation || 0) - 0) < 1e-9;
    }, null, { timeout: 10000 });
    summary.leader_after_flip_landing_side = {
      details: await readSelectionDetails(page),
      entity: (await readEntities(page, [42]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_after_flip_landing_side?.statusText || '').includes('Applied opposite LEADER landing side (1 of 2 entities)'), `unexpected leader flip-landing status: ${JSON.stringify(summary.leader_after_flip_landing_side)}`);
    ensure(summary.leader_after_flip_landing_side?.details?.items?.['current-offset'] === '1, 2', `unexpected leader flipped current-offset: ${JSON.stringify(summary.leader_after_flip_landing_side)}`);
    await page.fill('#cad-command-input', 'srcdriver');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return root
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 41
        && String(root.getAttribute('data-primary-type') || '') === 'line';
    }, null, { timeout: 10000 });
    summary.leader_after_select_anchor_driver = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_after_select_anchor_driver?.statusText || '').includes('Selected source anchor driver (line endpoint)'), `unexpected leader srcdriver status: ${JSON.stringify(summary.leader_after_select_anchor_driver)}`);
    ensure(summary.leader_after_select_anchor_driver?.selectionIds?.length === 1 && summary.leader_after_select_anchor_driver.selectionIds[0] === 41, `unexpected leader anchor-driver selection: ${JSON.stringify(summary.leader_after_select_anchor_driver)}`);
    await setSelection(page, [42], 42);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 42;
    }, null, { timeout: 10000 });
    await page.fill('#cad-command-input', 'leadfit');
    await page.click('#cad-command-run');
    const overlaysAfterLeaderAnchorFit = await readOverlays(page);
    summary.leader_after_landing_fit = {
      overlay: overlaysAfterLeaderAnchorFit?.sourceTextGuide || null,
      statusText: await page.locator('#cad-status-message').textContent(),
      view: await readView(page),
    };
    ensure(String(summary.leader_after_landing_fit?.statusText || '').includes('Fit Leader Landing: LEADER 702'), `unexpected leader leadfit status: ${JSON.stringify(summary.leader_after_landing_fit)}`);
    ensureApprox(summary.leader_after_landing_fit?.overlay?.anchor?.x, 56, 'leader anchor overlay x');
    ensureApprox(summary.leader_after_landing_fit?.overlay?.anchor?.y, 6, 'leader anchor overlay y');
    ensureApprox(summary.leader_after_landing_fit?.overlay?.elbowPoint?.x, 50, 'leader elbow overlay x');
    ensureApprox(summary.leader_after_landing_fit?.overlay?.elbowPoint?.y, 0, 'leader elbow overlay y');
    ensureApprox(summary.leader_after_landing_fit?.overlay?.sourcePoint?.x, 58, 'leader source overlay x');
    ensureApprox(summary.leader_after_landing_fit?.overlay?.sourcePoint?.y, 7, 'leader source overlay y');
    await fillPropertyInput(page, 'value', 'LEADER_GROUP_PROXY_EDITED');
    await fillPropertyInput(page, 'position.x', '63');
    await fillPropertyInput(page, 'position.y', '9');
    await fillPropertyInput(page, 'rotation', '0.3926990817');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(42) : null;
      return !!entity
        && entity.value === 'LEADER_GROUP_PROXY_EDITED'
        && entity.position?.x === 63
        && entity.position?.y === 9
        && Math.abs((entity.rotation || 0) - 0.3926990817) < 1e-9
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.leader_group_proxy_text_edit = {
      entity: (await readEntities(page, [42]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_group_proxy_text_edit?.statusText || '').includes('updated'), `unexpected leader group proxy text edit status: ${JSON.stringify(summary.leader_group_proxy_text_edit)}`);
    await page.fill('#cad-command-input', 'srcplace');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(42) : null;
      return !!entity
        && entity.position?.x === 58
        && entity.position?.y === 7
        && Math.abs((entity.rotation || 0) - 0) < 1e-9
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy';
    }, null, { timeout: 10000 });
    summary.leader_after_reset_placement = {
      entity: (await readEntities(page, [42]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_after_reset_placement?.statusText || '').includes('Reset source text placement (1 of 2 entities)'), `unexpected leader reset placement status: ${JSON.stringify(summary.leader_after_reset_placement)}`);

    await setSelection(page, [41], 41);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'line';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'edit-source-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 42
        && root
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'false';
    }, null, { timeout: 10000 });
    const leaderReleaseStatusText = await page.locator('#cad-status-message').textContent();
    await fillPropertyInput(page, 'value', 'LEADER_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(42) : null;
      return !!entity && entity.value === 'LEADER_EDITED';
    }, null, { timeout: 10000 });
    const releasedLeaderText = (await readEntities(page, [42]))[0];
    summary.leader_after_edit = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      entity: releasedLeaderText,
      releaseStatusText: leaderReleaseStatusText,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.leader_after_edit?.releaseStatusText || '').includes('Released source group and selected source text (1 of 2 entities)'), `unexpected leader edit status: ${JSON.stringify(summary.leader_after_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.leader_after_edit?.details?.items || {}, 'group-source'), `released leader text should not keep group-source: ${JSON.stringify(summary.leader_after_edit)}`);
    ensure(summary.leader_after_edit?.property?.fields?.includes('value'), `released leader text should expose value field: ${JSON.stringify(summary.leader_after_edit)}`);
    ensure(releasedLeaderText?.value === 'LEADER_EDITED', `released leader text should be editable: ${JSON.stringify(summary.leader_after_edit)}`);
    ensure(!Number.isFinite(releasedLeaderText?.groupId) && !releasedLeaderText?.sourceType && !releasedLeaderText?.editMode && !releasedLeaderText?.proxyKind, `released leader text should be detached: ${JSON.stringify(releasedLeaderText)}`);

    await setSelection(page, [31], 31);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'polyline';
    }, null, { timeout: 10000 });
    summary.hatch_before = {
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.hatch_before?.details?.items?.['group-id'] === '701', `unexpected hatch group id: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.details?.items?.['group-source'] === 'HATCH / hatch', `unexpected hatch group source: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.details?.items?.['source-group-members'] === '3', `unexpected hatch source-group-members: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.details?.items?.['group-center'] === '34, 3', `unexpected hatch group-center: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.details?.items?.['group-size'] === '8 x 6', `unexpected hatch group-size: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.details?.items?.['group-bounds'] === '30, 0 -> 38, 6', `unexpected hatch group-bounds: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.property?.actions?.includes('select-source-group'), `missing hatch select-source-group action: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.property?.actions?.includes('fit-source-group'), `missing hatch fit-source-group action: ${JSON.stringify(summary.hatch_before)}`);
    ensure(summary.hatch_before?.property?.actions?.includes('release-source-group'), `missing hatch release-source-group action: ${JSON.stringify(summary.hatch_before)}`);

    await page.fill('#cad-command-input', 'srcgrp');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 3 && ids[0] === 31 && ids[1] === 32 && ids[2] === 33;
    }, null, { timeout: 10000 });
    summary.hatch_after_select = {
      selectionIds: await readSelectionIds(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.hatch_after_select?.statusText || '').includes('Selected source group (3 entities)'), `unexpected hatch select status: ${JSON.stringify(summary.hatch_after_select)}`);
    ensure(!summary.hatch_after_select?.selectionIds?.includes(34), `hatch group should not pull Layout-B peer: ${JSON.stringify(summary.hatch_after_select)}`);

    await page.fill('#cad-command-input', 'srcfit');
    await page.click('#cad-command-run');
    const overlaysAfterHatchFit = await readOverlays(page);
    summary.hatch_after_fit = {
      overlay: overlaysAfterHatchFit?.sourceGroupFrame || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.hatch_after_fit?.statusText || '').includes('Fit Source Group: HATCH 701'), `unexpected hatch fit status: ${JSON.stringify(summary.hatch_after_fit)}`);
    ensureApprox(summary.hatch_after_fit?.overlay?.minX, 30, 'hatch overlay minX');
    ensureApprox(summary.hatch_after_fit?.overlay?.minY, 0, 'hatch overlay minY');
    ensureApprox(summary.hatch_after_fit?.overlay?.maxX, 38, 'hatch overlay maxX');
    ensureApprox(summary.hatch_after_fit?.overlay?.maxY, 6, 'hatch overlay maxY');
    ensure(!overlaysAfterHatchFit?.insertGroupFrame, `hatch fit should not expose insertGroupFrame: ${JSON.stringify(overlaysAfterHatchFit)}`);

    const hatchDelete = await runDebugCommand(page, 'selection.delete');
    const hatchEntitiesAfterDelete = await readEntities(page, [31, 32, 33]);
    summary.hatch_after_delete = {
      result: hatchDelete,
      entities: hatchEntitiesAfterDelete,
      selectionIds: await readSelectionIds(page),
    };
    ensure(hatchDelete?.ok === true, `hatch source-group delete failed: ${JSON.stringify(hatchDelete)}`);
    ensure(hatchDelete?.message === 'Deleted source group (3 entities, including 3 read-only)', `unexpected hatch delete message: ${JSON.stringify(hatchDelete)}`);
    ensure(summary.hatch_after_delete?.selectionIds?.length === 0, `hatch delete should clear selection: ${JSON.stringify(summary.hatch_after_delete)}`);
    ensure(hatchEntitiesAfterDelete.every((entity) => entity == null), `hatch delete should remove all source-group entities: ${JSON.stringify(summary.hatch_after_delete)}`);

    summary.ok = true;
  } catch (error) {
    summary.error = error?.stack || error?.message || String(error);
  } finally {
    if (page) {
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        summary.screenshot = screenshotPath;
      } catch {}
    }
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (serverHandle?.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`run_dir=${runDir}`);
    console.log(`summary_json=${summaryPath}`);
    if (!summary.ok) {
      process.exitCode = 1;
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
