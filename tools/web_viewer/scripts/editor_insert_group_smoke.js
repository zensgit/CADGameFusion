#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_insert_group_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_insert_group_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_insert_group_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_insert_group_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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

async function readSelectionIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getSelectionIds === 'function'
      ? debug.getSelectionIds()
      : [];
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
    const fields = Object.fromEntries(
      Array.from(form.querySelectorAll('input[name]'))
        .map((input) => [String(input.getAttribute('name') || '').trim(), String(input.value || '')])
        .filter(([name]) => !!name)
    );
    const notes = Array.from(form.querySelectorAll('.cad-readonly-note'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
    return { meta, actions, fields, notes };
  });
}

async function readView(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getView === 'function'
      ? debug.getView()
      : null;
  });
}

async function readOverlays(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getOverlays === 'function'
      ? debug.getOverlays()
      : null;
  });
}

async function readSpaceState(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    const status = document.querySelector('#cad-status-space');
    return {
      statusText: status ? String(status.textContent || '').trim() : '',
      currentSpaceContext: debug && typeof debug.getCurrentSpaceContext === 'function'
        ? debug.getCurrentSpaceContext()
        : null,
    };
  });
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

async function clickPropertyAction(page, actionId) {
  const button = page.locator(`#cad-property-form [data-property-action="${actionId}"]`).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
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
  const screenshotPath = path.join(runDir, 'insert_group.png');

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

    const baseUrl = summary.baseUrl;
    const relativeFixture = String(args.fixture || DEFAULT_FIXTURE).trim();
    const pageUrl = new URL('tools/web_viewer/index.html', baseUrl);
    pageUrl.searchParams.set('mode', 'editor');
    pageUrl.searchParams.set('debug', '1');
    pageUrl.searchParams.set('cadgf', relativeFixture);
    summary.url = pageUrl.toString();

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    await page.goto(summary.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.listEntities === 'function'
        && debug.listEntities().length >= 5;
    }, null, { timeout: 15000 });

    const switched = await setCurrentSpaceContext(page, { space: 1, layout: 'Layout-A' });
    ensure(switched !== null, 'failed to access debug current-space hook');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getCurrentSpaceContext === 'function'
        && debug.getCurrentSpaceContext()?.space === 1
        && String(debug.getCurrentSpaceContext()?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });
    summary.space_before = await readSpaceState(page);

    await setSelection(page, [7], 7);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-entity-count') || '') === '1';
    }, null, { timeout: 10000 });

    summary.before = await readSelectionDetails(page);
    summary.property_before = await readPropertyFormState(page);
    ensure(summary.before?.items?.['group-id'] === '500', `unexpected group id before action: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['block-name'] === 'DoorTag', `unexpected block name before action: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['insert-group-members'] === '3', `unexpected quicklook member count before action: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['editable-members'] === '2', `unexpected quicklook editable member count before action: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['read-only-members'] === '1', `unexpected quicklook read-only member count before action: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['group-center'] === '0, 7', `unexpected quicklook group center: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['group-size'] === '36 x 14', `unexpected quicklook group size: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['group-bounds'] === '-18, 0 -> 18, 14', `unexpected quicklook group bounds: ${JSON.stringify(summary.before)}`);
    ensure(summary.property_before?.meta?.['insert-group-members'] === '3', `unexpected insert group member count: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['editable-members'] === '2', `unexpected editable member count: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['read-only-members'] === '1', `unexpected read-only member count: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['group-center'] === '0, 7', `unexpected property group center: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['group-size'] === '36 x 14', `unexpected property group size: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['group-bounds'] === '-18, 0 -> 18, 14', `unexpected property group bounds: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.before?.items?.['peer-instance'] === '1 / 3', `unexpected quicklook peer instance: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['peer-instances'] === '3', `unexpected quicklook peer instance count: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['peer-layouts'] === 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C', `unexpected quicklook peer layouts: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.items?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected quicklook peer targets: ${JSON.stringify(summary.before)}`);
    ensure(summary.property_before?.meta?.['peer-instance'] === '1 / 3', `unexpected property peer instance: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['peer-instances'] === '3', `unexpected property peer instance count: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['peer-layouts'] === 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C', `unexpected property peer layouts: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.meta?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected property peer targets: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('select-insert-group'), `missing select-insert-group action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('select-insert-editable'), `missing select-insert-editable action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('open-insert-peer-2'), `missing open-insert-peer-2 action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('open-insert-peer-3'), `missing open-insert-peer-3 action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('previous-insert-peer'), `missing previous-insert-peer action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('next-insert-peer'), `missing next-insert-peer action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('fit-insert-group'), `missing fit-insert-group action: ${JSON.stringify(summary.property_before)}`);
    ensure(summary.property_before?.actions?.includes('release-insert-group'), `missing release-insert-group action: ${JSON.stringify(summary.property_before)}`);

    await clickPropertyAction(page, 'open-insert-peer-3');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 12
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    const overlaysAfterPeerDirect = await readOverlays(page);
    summary.after_peer_direct = {
      selectionIds: await readSelectionIds(page),
      space: await readSpaceState(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      overlay: overlaysAfterPeerDirect?.insertGroupFrame || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_peer_direct?.details?.items?.['group-id'] === '500', `unexpected direct-peer group id: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['block-name'] === 'DoorTag', `unexpected direct-peer block name: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['insert-group-members'] === '3', `unexpected direct-peer member count: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['group-center'] === '0, 25.5', `unexpected direct-peer group center: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['group-size'] === '28 x 11', `unexpected direct-peer group size: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['group-bounds'] === '-14, 20 -> 14, 31', `unexpected direct-peer group bounds: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['peer-instance'] === '3 / 3', `unexpected direct-peer peer instance: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.details?.items?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected direct-peer targets: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.property?.meta?.['peer-instance'] === '3 / 3', `unexpected direct-peer property peer instance: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.property?.actions?.includes('open-insert-peer-1'), `missing open-insert-peer-1 after direct switch: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.property?.actions?.includes('open-insert-peer-2'), `missing open-insert-peer-2 after direct switch: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(summary.after_peer_direct?.property?.actions?.includes('select-insert-group'), `missing select-insert-group after direct switch: ${JSON.stringify(summary.after_peer_direct)}`);
    ensure(String(summary.after_peer_direct?.statusText || '').includes('Peer Insert 3/3'), `unexpected direct-peer status: ${JSON.stringify(summary.after_peer_direct)}`);
    ensureApprox(summary.after_peer_direct?.overlay?.minX, -14, 'direct-peer overlay minX');
    ensureApprox(summary.after_peer_direct?.overlay?.minY, 20, 'direct-peer overlay minY');
    ensureApprox(summary.after_peer_direct?.overlay?.maxX, 14, 'direct-peer overlay maxX');
    ensureApprox(summary.after_peer_direct?.overlay?.maxY, 31, 'direct-peer overlay maxY');

    await page.fill('#cad-command-input', 'inspeer 2');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 10
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-B';
    }, null, { timeout: 10000 });
    const overlaysAfterPeerIndex = await readOverlays(page);
    summary.after_peer_index = {
      selectionIds: await readSelectionIds(page),
      space: await readSpaceState(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      overlay: overlaysAfterPeerIndex?.insertGroupFrame || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_peer_index?.details?.items?.['group-id'] === '500', `unexpected indexed-peer group id: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['block-name'] === 'DoorTag', `unexpected indexed-peer block name: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['insert-group-members'] === '1', `unexpected indexed-peer member count: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['group-center'] === '0, -12', `unexpected indexed-peer group center: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['group-size'] === '32 x 0', `unexpected indexed-peer group size: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['group-bounds'] === '-16, -12 -> 16, -12', `unexpected indexed-peer group bounds: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['peer-instance'] === '2 / 3', `unexpected indexed-peer peer instance: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['peer-layouts'] === 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C', `unexpected indexed-peer layouts: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.details?.items?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected indexed-peer targets: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.meta?.['peer-instance'] === '2 / 3', `unexpected indexed-peer property peer instance: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.meta?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected indexed-peer property peer targets: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.actions?.includes('previous-insert-peer'), `missing previous peer action after index switch: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.actions?.includes('next-insert-peer'), `missing next peer action after index switch: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.actions?.includes('open-insert-peer-1'), `missing open-insert-peer-1 after index switch: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(summary.after_peer_index?.property?.actions?.includes('open-insert-peer-3'), `missing open-insert-peer-3 after index switch: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(!summary.after_peer_index?.property?.actions?.includes('select-insert-group'), `peer singleton should not expose select-insert-group: ${JSON.stringify(summary.after_peer_index)}`);
    ensure(String(summary.after_peer_index?.statusText || '').includes('Peer Insert 2/3'), `unexpected indexed-peer status: ${JSON.stringify(summary.after_peer_index)}`);
    ensureApprox(summary.after_peer_index?.overlay?.minX, -16, 'indexed-peer overlay minX');
    ensureApprox(summary.after_peer_index?.overlay?.minY, -12, 'indexed-peer overlay minY');
    ensureApprox(summary.after_peer_index?.overlay?.maxX, 16, 'indexed-peer overlay maxX');
    ensureApprox(summary.after_peer_index?.overlay?.maxY, -12, 'indexed-peer overlay maxY');

    await page.fill('#cad-command-input', 'insprev');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 7
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });
    summary.after_peer_prev = {
      selectionIds: await readSelectionIds(page),
      space: await readSpaceState(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_peer_prev?.statusText || '').includes('Peer Insert 1/3'), `unexpected previous-peer status: ${JSON.stringify(summary.after_peer_prev)}`);
    ensure(summary.after_peer_prev?.details?.items?.['peer-instance'] === '1 / 3', `unexpected previous-peer quicklook: ${JSON.stringify(summary.after_peer_prev)}`);
    ensure(summary.after_peer_prev?.details?.items?.['peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `unexpected previous-peer targets: ${JSON.stringify(summary.after_peer_prev)}`);

    await setSelection(page, [9], 9);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-entity-count') || '') === '1'
        && String(root.getAttribute('data-primary-type') || '') === 'text';
    }, null, { timeout: 10000 });
    summary.before_proxy_edit = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.before_proxy_edit?.details?.items?.['group-id'] === '500', `unexpected insert text group id: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(summary.before_proxy_edit?.details?.items?.origin === 'INSERT / text / proxy', `unexpected insert text origin: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(summary.before_proxy_edit?.property?.fields?.value === 'TAG-A', `missing insert proxy value field: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_proxy_edit?.property?.fields || {}, 'position.x'), `insert proxy should not expose position.x: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_proxy_edit?.property?.fields || {}, 'position.y'), `insert proxy should not expose position.y: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_proxy_edit?.property?.fields || {}, 'height'), `insert proxy should not expose height: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_proxy_edit?.property?.fields || {}, 'rotation'), `insert proxy should not expose rotation: ${JSON.stringify(summary.before_proxy_edit)}`);
    ensure(
      summary.before_proxy_edit?.property?.notes?.some((note) => note.includes('text value') && note.includes('proxy-only')),
      `missing insert proxy editability note: ${JSON.stringify(summary.before_proxy_edit)}`,
    );

    const proxyTextField = page.locator('#cad-property-form input[name="value"]').first();
    await proxyTextField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'TAG-PROXY-EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getEntity === 'function'
        && String(debug.getEntity(9)?.value || '') === 'TAG-PROXY-EDITED'
        && String(debug.getEntity(9)?.sourceType || '') === 'INSERT'
        && String(debug.getEntity(9)?.editMode || '') === 'proxy'
        && String(debug.getEntity(9)?.proxyKind || '') === 'text';
    }, null, { timeout: 10000 });
    summary.after_proxy_edit = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      entity: (await readEntities(page, [9]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_proxy_edit?.entity?.value === 'TAG-PROXY-EDITED', `insert proxy text edit did not persist: ${JSON.stringify(summary.after_proxy_edit)}`);
    ensure(summary.after_proxy_edit?.entity?.sourceType === 'INSERT', `insert proxy sourceType drifted: ${JSON.stringify(summary.after_proxy_edit)}`);
    ensure(summary.after_proxy_edit?.entity?.editMode === 'proxy', `insert proxy editMode drifted: ${JSON.stringify(summary.after_proxy_edit)}`);
    ensure(summary.after_proxy_edit?.entity?.proxyKind === 'text', `insert proxy kind drifted: ${JSON.stringify(summary.after_proxy_edit)}`);
    ensureApprox(summary.after_proxy_edit?.entity?.position?.x, 12, 'insert proxy position.x after value edit');
    ensureApprox(summary.after_proxy_edit?.entity?.position?.y, 11, 'insert proxy position.y after value edit');
    ensure(String(summary.after_proxy_edit?.statusText || '').includes('Text updated'), `unexpected insert proxy edit status: ${JSON.stringify(summary.after_proxy_edit)}`);

    await clickPropertyAction(page, 'select-insert-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 3
        && ids[0] === 7
        && ids[1] === 8
        && ids[2] === 9;
    }, null, { timeout: 10000 });
    summary.after_property_action = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.after_property_action?.property?.actions?.includes('select-insert-editable'), `missing select-insert-editable after group expansion: ${JSON.stringify(summary.after_property_action)}`);
    ensure(
      summary.after_property_action?.property?.notes?.some((note) => note.includes('full-group move/rotate/scale/copy/delete stay instance-level')),
      `missing full-group transform note: ${JSON.stringify(summary.after_property_action)}`,
    );

    const viewBeforeFit = await readView(page);
    const overlaysBeforeFit = await readOverlays(page);
    ensure(overlaysBeforeFit?.insertGroupFrame, `missing insertGroupFrame overlay before fit: ${JSON.stringify(overlaysBeforeFit)}`);
    ensureApprox(overlaysBeforeFit.insertGroupFrame.minX, -18, 'overlay before fit minX');
    ensureApprox(overlaysBeforeFit.insertGroupFrame.minY, 0, 'overlay before fit minY');
    ensureApprox(overlaysBeforeFit.insertGroupFrame.maxX, 18, 'overlay before fit maxX');
    ensureApprox(overlaysBeforeFit.insertGroupFrame.maxY, 14, 'overlay before fit maxY');
    await clickPropertyAction(page, 'fit-insert-group');
    const viewAfterFit = await readView(page);
    const overlaysAfterFit = await readOverlays(page);
    ensure(viewAfterFit && viewBeforeFit, `missing view payload around fit: before=${JSON.stringify(viewBeforeFit)} after=${JSON.stringify(viewAfterFit)}`);
    const zoomChanged = Math.abs(Number(viewAfterFit.zoom) - Number(viewBeforeFit.zoom)) > 1e-6;
    const panChanged = Math.abs(Number(viewAfterFit.pan?.x || 0) - Number(viewBeforeFit.pan?.x || 0)) > 1e-6
      || Math.abs(Number(viewAfterFit.pan?.y || 0) - Number(viewBeforeFit.pan?.y || 0)) > 1e-6;
    ensure(overlaysAfterFit?.insertGroupFrame, `missing insertGroupFrame overlay after fit: ${JSON.stringify(overlaysAfterFit)}`);
    summary.after_fit = {
      beforeView: viewBeforeFit,
      afterView: viewAfterFit,
      viewChanged: zoomChanged || panChanged,
      overlay: overlaysAfterFit.insertGroupFrame,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_fit?.statusText || '').includes('Fit Insert Group'), `unexpected fit status: ${JSON.stringify(summary.after_fit)}`);

    await page.fill('#cad-command-input', 'inspeer Layout-C');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 3
        && ids[0] === 12
        && ids[1] === 13
        && ids[2] === 14
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    summary.after_full_group_peer_target = {
      selectionIds: await readSelectionIds(page),
      space: await readSpaceState(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_full_group_peer_target?.property?.notes?.some((note) => note.includes('full-group move/rotate/scale/copy/delete stay instance-level')), `missing full-group note after peer target: ${JSON.stringify(summary.after_full_group_peer_target)}`);

    await page.fill('#cad-command-input', 'inspeer Layout-A');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 3
        && ids[0] === 7
        && ids[1] === 8
        && ids[2] === 9
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });

    const moveResult = await runDebugCommand(page, 'selection.move', { delta: { x: 5, y: -3 } });
    const movedEntities = await readEntities(page, [7, 8, 9]);
    ensure(moveResult?.ok === true, `full-group move failed: ${JSON.stringify(moveResult)}`);
    ensure(moveResult?.message === 'Moved insert group (3 entities, including 1 proxy)', `unexpected full-group move message: ${JSON.stringify(moveResult)}`);
    ensureApprox(movedEntities[0]?.start?.x, -13, 'moved line start.x');
    ensureApprox(movedEntities[0]?.start?.y, -3, 'moved line start.y');
    ensureApprox(movedEntities[1]?.center?.x, 5, 'moved circle center.x');
    ensureApprox(movedEntities[1]?.center?.y, 7, 'moved circle center.y');
    ensureApprox(movedEntities[2]?.position?.x, 17, 'moved proxy text position.x');
    ensureApprox(movedEntities[2]?.position?.y, 8, 'moved proxy text position.y');
    summary.after_move = {
      result: moveResult,
      entities: movedEntities,
    };

    const undoMove = await runDebugCommand(page, 'history.undo');
    const restoredAfterMove = await readEntities(page, [7, 8, 9]);
    ensure(undoMove?.ok === true, `undo after full-group move failed: ${JSON.stringify(undoMove)}`);
    ensureApprox(restoredAfterMove[0]?.start?.x, -18, 'restored line start.x');
    ensureApprox(restoredAfterMove[0]?.start?.y, 0, 'restored line start.y');
    ensureApprox(restoredAfterMove[2]?.position?.x, 12, 'restored proxy text position.x');
    ensureApprox(restoredAfterMove[2]?.position?.y, 11, 'restored proxy text position.y');

    const rotateResult = await runDebugCommand(page, 'selection.rotate', { center: { x: 0, y: 0 }, angle: Math.PI / 2 });
    const rotatedEntities = await readEntities(page, [7, 9]);
    ensure(rotateResult?.ok === true, `full-group rotate failed: ${JSON.stringify(rotateResult)}`);
    ensure(rotateResult?.message === 'Rotated insert group (3 entities, including 1 proxy)', `unexpected full-group rotate message: ${JSON.stringify(rotateResult)}`);
    ensureApprox(rotatedEntities[0]?.start?.x, 0, 'rotated line start.x');
    ensureApprox(rotatedEntities[0]?.start?.y, -18, 'rotated line start.y');
    ensureApprox(rotatedEntities[1]?.position?.x, -11, 'rotated proxy text position.x');
    ensureApprox(rotatedEntities[1]?.position?.y, 12, 'rotated proxy text position.y');
    ensureApprox(rotatedEntities[1]?.rotation, Math.PI / 2, 'rotated proxy text rotation');
    summary.after_rotate = {
      result: rotateResult,
      entities: rotatedEntities,
    };

    const undoRotate = await runDebugCommand(page, 'history.undo');
    const restoredAfterRotate = await readEntities(page, [7, 9]);
    ensure(undoRotate?.ok === true, `undo after full-group rotate failed: ${JSON.stringify(undoRotate)}`);
    ensureApprox(restoredAfterRotate[0]?.start?.x, -18, 'restored-after-rotate line start.x');
    ensureApprox(restoredAfterRotate[0]?.start?.y, 0, 'restored-after-rotate line start.y');
    ensureApprox(restoredAfterRotate[1]?.position?.x, 12, 'restored-after-rotate proxy text position.x');
    ensureApprox(restoredAfterRotate[1]?.position?.y, 11, 'restored-after-rotate proxy text position.y');

    await page.fill('#cad-command-input', 'scale 0.5 0 0');
    await page.click('#cad-command-run');
    const scaledEntities = await readEntities(page, [7, 8, 9]);
    const scaledStatus = await page.locator('#cad-status-message').textContent();
    ensure(String(scaledStatus || '').includes('Scaled insert group (3 entities, including 1 proxy)'), `unexpected full-group scale status: ${scaledStatus}`);
    ensureApprox(scaledEntities[0]?.start?.x, -9, 'scaled line start.x');
    ensureApprox(scaledEntities[0]?.start?.y, 0, 'scaled line start.y');
    ensureApprox(scaledEntities[0]?.end?.x, 9, 'scaled line end.x');
    ensureApprox(scaledEntities[0]?.end?.y, 0, 'scaled line end.y');
    ensureApprox(scaledEntities[1]?.center?.x, 0, 'scaled circle center.x');
    ensureApprox(scaledEntities[1]?.center?.y, 5, 'scaled circle center.y');
    ensureApprox(scaledEntities[1]?.radius, 2, 'scaled circle radius');
    ensureApprox(scaledEntities[2]?.position?.x, 6, 'scaled proxy text position.x');
    ensureApprox(scaledEntities[2]?.position?.y, 5.5, 'scaled proxy text position.y');
    ensureApprox(scaledEntities[2]?.height, 1.25, 'scaled proxy text height');
    summary.after_scale = {
      statusText: scaledStatus,
      entities: scaledEntities,
    };

    const undoScale = await runDebugCommand(page, 'history.undo');
    const restoredAfterScale = await readEntities(page, [7, 8, 9]);
    ensure(undoScale?.ok === true, `undo after full-group scale failed: ${JSON.stringify(undoScale)}`);
    ensureApprox(restoredAfterScale[0]?.start?.x, -18, 'restored-after-scale line start.x');
    ensureApprox(restoredAfterScale[0]?.start?.y, 0, 'restored-after-scale line start.y');
    ensureApprox(restoredAfterScale[2]?.position?.x, 12, 'restored-after-scale proxy text position.x');
    ensureApprox(restoredAfterScale[2]?.position?.y, 11, 'restored-after-scale proxy text position.y');

    const copyResult = await runDebugCommand(page, 'selection.copy', { delta: { x: 30, y: 0 } });
    const copiedIds = await readSelectionIds(page);
    ensure(copyResult?.ok === true, `full-group copy failed: ${JSON.stringify(copyResult)}`);
    ensure(copyResult?.message === 'Copied insert group as detached geometry (3 entities)', `unexpected full-group copy message: ${JSON.stringify(copyResult)}`);
    ensure(Array.isArray(copiedIds) && copiedIds.length === 3, `unexpected copied selection ids: ${JSON.stringify(copiedIds)}`);
    const copiedEntities = await readEntities(page, copiedIds);
    ensureApprox(copiedEntities[0]?.start?.x, 12, 'copied line start.x');
    ensureApprox(copiedEntities[0]?.start?.y, 0, 'copied line start.y');
    ensureApprox(copiedEntities[1]?.center?.x, 30, 'copied circle center.x');
    ensureApprox(copiedEntities[1]?.center?.y, 10, 'copied circle center.y');
    ensureApprox(copiedEntities[2]?.position?.x, 42, 'copied text position.x');
    ensureApprox(copiedEntities[2]?.position?.y, 11, 'copied text position.y');
    ensure(!copiedEntities[2]?.sourceType, `copied text should be detached from insert provenance: ${JSON.stringify(copiedEntities)}`);
    ensure(!copiedEntities[2]?.editMode, `copied text should not keep editMode: ${JSON.stringify(copiedEntities)}`);
    ensure(!copiedEntities[2]?.proxyKind, `copied text should not keep proxyKind: ${JSON.stringify(copiedEntities)}`);
    ensure(!Number.isFinite(copiedEntities[2]?.groupId), `copied text should not keep groupId: ${JSON.stringify(copiedEntities)}`);
    summary.after_copy = {
      result: copyResult,
      selectionIds: copiedIds,
      entities: copiedEntities,
    };

    const undoCopy = await runDebugCommand(page, 'history.undo');
    const restoredAfterCopy = await readEntities(page, [7, 8, 9]);
    ensure(undoCopy?.ok === true, `undo after full-group copy failed: ${JSON.stringify(undoCopy)}`);
    ensureApprox(restoredAfterCopy[0]?.start?.x, -18, 'restored-after-copy line start.x');
    ensureApprox(restoredAfterCopy[1]?.center?.x, 0, 'restored-after-copy circle center.x');
    ensureApprox(restoredAfterCopy[2]?.position?.x, 12, 'restored-after-copy text position.x');

    const deleteResult = await runDebugCommand(page, 'selection.delete');
    ensure(deleteResult?.ok === true, `full-group delete failed: ${JSON.stringify(deleteResult)}`);
    ensure(deleteResult?.message === 'Deleted insert group (3 entities, including 1 proxy)', `unexpected full-group delete message: ${JSON.stringify(deleteResult)}`);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getEntity === 'function'
        && !debug.getEntity(7)
        && !debug.getEntity(8)
        && !debug.getEntity(9)
        && typeof debug.getSelectionIds === 'function'
        && debug.getSelectionIds().length === 0;
    }, null, { timeout: 10000 });
    summary.after_delete = {
      result: deleteResult,
      selectionIds: await readSelectionIds(page),
    };

    const undoDelete = await runDebugCommand(page, 'history.undo');
    const restoredAfterDelete = await readEntities(page, [7, 8, 9]);
    ensure(undoDelete?.ok === true, `undo after full-group delete failed: ${JSON.stringify(undoDelete)}`);
    ensureApprox(restoredAfterDelete[0]?.start?.x, -18, 'restored-after-delete line start.x');
    ensureApprox(restoredAfterDelete[1]?.center?.x, 0, 'restored-after-delete circle center.x');
    ensureApprox(restoredAfterDelete[2]?.position?.x, 12, 'restored-after-delete text position.x');

    await clickPropertyAction(page, 'select-insert-editable');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 7
        && ids[1] === 8;
    }, null, { timeout: 10000 });
    summary.after_editable_action = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.after_editable_action?.property?.actions?.includes('open-insert-peer-3'), `editable-only selection should keep peer actions: ${JSON.stringify(summary.after_editable_action)}`);
    ensure(summary.after_editable_action?.property?.actions?.includes('next-insert-peer'), `editable-only selection missing next peer action: ${JSON.stringify(summary.after_editable_action)}`);

    await page.fill('#cad-command-input', 'inspeer Layout-C');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 12
        && ids[1] === 13
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    summary.after_editable_peer_target = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_editable_peer_target?.statusText || '').includes('Peer Insert 3/3'), `unexpected editable peer-target status: ${JSON.stringify(summary.after_editable_peer_target)}`);

    await page.fill('#cad-command-input', 'inspeer Layout-A');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 7
        && ids[1] === 8
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });

    await setSelection(page, [21, 22], 22);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 2 && ids[0] === 21 && ids[1] === 22;
    }, null, { timeout: 10000 });
    summary.text_scope_before = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
    };
    ensure(summary.text_scope_before?.details?.mode === 'multiple', `unexpected text-scope detail mode: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.details?.entityCount === 2, `unexpected text-scope entity count: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.meta?.['block-name'] === 'DoorNotes', `unexpected text-scope block name: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.meta?.['insert-group-members'] === '3', `unexpected text-scope member count: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.meta?.['peer-instance'] === '1 / 3', `unexpected text-scope peer instance: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.actions?.includes('open-insert-peer-2'), `text-only selection missing direct peer action: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.actions?.includes('open-insert-peer-3'), `text-only selection missing direct peer action 3: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.actions?.includes('previous-insert-peer'), `text-only selection missing previous peer action: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.actions?.includes('next-insert-peer'), `text-only selection missing next peer action: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(summary.text_scope_before?.property?.actions?.includes('select-insert-group'), `text-only selection should still offer group expansion: ${JSON.stringify(summary.text_scope_before)}`);
    ensure(!summary.text_scope_before?.property?.actions?.includes('select-insert-text'), `text-only selection should not offer redundant text narrowing: ${JSON.stringify(summary.text_scope_before)}`);

    await clickPropertyAction(page, 'open-insert-peer-3');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 27
        && ids[1] === 28
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    summary.text_scope_after_direct_peer = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
      overlay: (await readOverlays(page))?.insertGroupFrame || null,
    };
    ensure(summary.text_scope_after_direct_peer?.details?.mode === 'multiple', `unexpected text peer detail mode after direct peer: ${JSON.stringify(summary.text_scope_after_direct_peer)}`);
    ensure(summary.text_scope_after_direct_peer?.details?.entityCount === 2, `unexpected text peer entity count after direct peer: ${JSON.stringify(summary.text_scope_after_direct_peer)}`);
    ensure(summary.text_scope_after_direct_peer?.property?.meta?.['block-name'] === 'DoorNotes', `unexpected text peer block name after direct peer: ${JSON.stringify(summary.text_scope_after_direct_peer)}`);
    ensure(summary.text_scope_after_direct_peer?.property?.meta?.['peer-instance'] === '3 / 3', `unexpected text peer instance after direct peer: ${JSON.stringify(summary.text_scope_after_direct_peer)}`);
    ensure(String(summary.text_scope_after_direct_peer?.statusText || '').includes('Peer Insert 3/3'), `unexpected text peer status after direct peer: ${JSON.stringify(summary.text_scope_after_direct_peer)}`);
    ensureApprox(summary.text_scope_after_direct_peer?.overlay?.minX, 44, 'text peer overlay minX after direct peer');
    ensureApprox(summary.text_scope_after_direct_peer?.overlay?.maxX, 68, 'text peer overlay maxX after direct peer');

    await page.fill('#cad-command-input', 'inspeer Layout-B');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 24
        && ids[1] === 25
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-B';
    }, null, { timeout: 10000 });
    summary.text_scope_after_command_peer = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.text_scope_after_command_peer?.details?.mode === 'multiple', `unexpected text peer detail mode after command peer: ${JSON.stringify(summary.text_scope_after_command_peer)}`);
    ensure(summary.text_scope_after_command_peer?.details?.entityCount === 2, `unexpected text peer entity count after command peer: ${JSON.stringify(summary.text_scope_after_command_peer)}`);
    ensure(summary.text_scope_after_command_peer?.property?.meta?.['peer-instance'] === '2 / 3', `unexpected text peer instance after command peer: ${JSON.stringify(summary.text_scope_after_command_peer)}`);
    ensure(summary.text_scope_after_command_peer?.property?.actions?.includes('open-insert-peer-1'), `text-only peer selection should keep direct peer actions after command hop: ${JSON.stringify(summary.text_scope_after_command_peer)}`);
    ensure(String(summary.text_scope_after_command_peer?.statusText || '').includes('Peer Insert 2/3'), `unexpected text peer status after command hop: ${JSON.stringify(summary.text_scope_after_command_peer)}`);

    await page.fill('#cad-command-input', 'insprev');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 21
        && ids[1] === 22
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });
    summary.text_scope_after_prev = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.text_scope_after_prev?.details?.mode === 'multiple', `unexpected text peer detail mode after prev: ${JSON.stringify(summary.text_scope_after_prev)}`);
    ensure(summary.text_scope_after_prev?.details?.entityCount === 2, `unexpected text peer entity count after prev: ${JSON.stringify(summary.text_scope_after_prev)}`);
    ensure(summary.text_scope_after_prev?.property?.meta?.['peer-instance'] === '1 / 3', `unexpected text peer instance after prev: ${JSON.stringify(summary.text_scope_after_prev)}`);
    ensure(String(summary.text_scope_after_prev?.statusText || '').includes('Peer Insert 1/3'), `unexpected text peer status after prev: ${JSON.stringify(summary.text_scope_after_prev)}`);

    await clickPropertyAction(page, 'edit-insert-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getEntity !== 'function') return false;
      const ids = debug.getSelectionIds();
      const first = debug.getEntity(21);
      const second = debug.getEntity(22);
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 21
        && ids[1] === 22
        && !first?.sourceType
        && !first?.editMode
        && !first?.proxyKind
        && !!first?.releasedInsertArchive
        && !second?.sourceType
        && !second?.editMode
        && !second?.proxyKind
        && !!second?.releasedInsertArchive;
    }, null, { timeout: 10000 });
    summary.released_text_scope_before = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
      entities: await readEntities(page, [21, 22]),
    };
    ensure(summary.released_text_scope_before?.details?.items?.['released-from'] === 'INSERT / text / proxy', `released text scope missing quicklook released-from: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.details?.items?.['released-group-id'] === '700', `released text scope missing quicklook released-group-id: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.details?.items?.['released-block-name'] === 'DoorNotes', `released text scope missing quicklook released-block-name: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.details?.items?.['released-selection-members'] === '2', `released text scope missing quicklook member count: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.details?.items?.['released-peer-instance'] === '1 / 3', `released text scope missing quicklook peer instance: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-from'] === 'INSERT / text / proxy', `released text scope missing property released-from: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-group-id'] === '700', `released text scope missing property released-group-id: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-block-name'] === 'DoorNotes', `released text scope missing property released-block-name: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-selection-members'] === '2', `released text scope missing property member count: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-peer-instance'] === '1 / 3', `released text scope missing property peer instance: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.meta?.['released-peer-targets'] === '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C', `released text scope missing property peer targets: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.actions?.includes('open-released-insert-peer-2'), `released text scope missing Layout-B peer action: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.actions?.includes('open-released-insert-peer-3'), `released text scope missing Layout-C peer action: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.actions?.includes('previous-released-insert-peer'), `released text scope missing previous released peer action: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.property?.actions?.includes('next-released-insert-peer'), `released text scope missing next released peer action: ${JSON.stringify(summary.released_text_scope_before)}`);
    ensure(summary.released_text_scope_before?.entities?.every((entity) => !!entity?.releasedInsertArchive), `released text scope lost archive metadata: ${JSON.stringify(summary.released_text_scope_before)}`);

    await page.fill('#cad-command-input', 'relinspeer Layout-C');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 27
        && ids[1] === 28
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    summary.released_text_scope_after_command_peer = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.released_text_scope_after_command_peer?.property?.meta?.['peer-instance'] === '3 / 3', `unexpected released text peer command instance: ${JSON.stringify(summary.released_text_scope_after_command_peer)}`);
    ensure(String(summary.released_text_scope_after_command_peer?.statusText || '').includes('Released Insert Peer 3/3'), `unexpected released text peer command status: ${JSON.stringify(summary.released_text_scope_after_command_peer)}`);

    const restoredReleasedTextScope = await setCurrentSpaceContext(page, { space: 1, layout: 'Layout-A' });
    ensure(restoredReleasedTextScope, 'failed to restore Layout-A for released text scope');
    await setSelection(page, [21, 22], 22);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 21
        && ids[1] === 22
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'open-released-insert-peer-2');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 24
        && ids[1] === 25
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-B';
    }, null, { timeout: 10000 });
    summary.released_text_scope_after_action_peer = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.released_text_scope_after_action_peer?.property?.meta?.['peer-instance'] === '2 / 3', `unexpected released text peer action instance: ${JSON.stringify(summary.released_text_scope_after_action_peer)}`);
    ensure(String(summary.released_text_scope_after_action_peer?.statusText || '').includes('Released Insert Peer 2/3'), `unexpected released text peer action status: ${JSON.stringify(summary.released_text_scope_after_action_peer)}`);

    await setSelection(page, [7], 7);
    await page.fill('#cad-command-input', 'insedit');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 2
        && ids[0] === 7
        && ids[1] === 8;
    }, null, { timeout: 10000 });
    summary.after_command = {
      selectionIds: await readSelectionIds(page),
      statusText: await page.locator('#cad-status-message').textContent(),
      property: await readPropertyFormState(page),
    };

    await setSelection(page, [7], 7);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-entity-count') || '') === '1';
    }, null, { timeout: 10000 });
    await clickPropertyAction(page, 'release-insert-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 3
        && ids[0] === 7
        && ids[1] === 8
        && ids[2] === 9
        && typeof debug.getEntity === 'function'
        && !debug.getEntity(9)?.sourceType
        && !debug.getEntity(9)?.editMode
        && !debug.getEntity(9)?.proxyKind
        && !Number.isFinite(debug.getEntity(9)?.groupId);
    }, null, { timeout: 10000 });
    summary.after_release = {
      selectionIds: await readSelectionIds(page),
      statusText: await page.locator('#cad-status-message').textContent(),
      entities: await readEntities(page, [7, 8, 9]),
      property: await readPropertyFormState(page),
    };
    ensure(
      String(summary.after_release?.statusText || '').includes('Released insert group to editable geometry (3 entities)'),
      `unexpected release status: ${JSON.stringify(summary.after_release)}`,
    );
    ensure(!summary.after_release?.property?.actions?.includes('release-insert-group'), `release action should disappear on detached multi-selection: ${JSON.stringify(summary.after_release)}`);
    ensure(!summary.after_release?.entities?.[2]?.sourceType, `released proxy text still has sourceType: ${JSON.stringify(summary.after_release)}`);
    ensure(!summary.after_release?.entities?.[2]?.editMode, `released proxy text still has editMode: ${JSON.stringify(summary.after_release)}`);
    ensure(!summary.after_release?.entities?.[2]?.proxyKind, `released proxy text still has proxyKind: ${JSON.stringify(summary.after_release)}`);
    ensure(!Number.isFinite(summary.after_release?.entities?.[2]?.groupId), `released proxy text still has groupId: ${JSON.stringify(summary.after_release)}`);
    ensure(summary.after_release?.entities?.[2]?.value === 'TAG-PROXY-EDITED', `released proxy text lost pre-release value override: ${JSON.stringify(summary.after_release)}`);

    await setSelection(page, [9], 9);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-entity-count') || '') === '1'
        && String(root.getAttribute('data-primary-type') || '') === 'text';
    }, null, { timeout: 10000 });
    const releasedSingleDetails = await readSelectionDetails(page);
    const releasedSingleProperty = await readPropertyFormState(page);
    ensure(!Object.prototype.hasOwnProperty.call(releasedSingleDetails?.items || {}, 'group-id'), `released text should not expose group-id: ${JSON.stringify(releasedSingleDetails)}`);
    ensure(!Object.prototype.hasOwnProperty.call(releasedSingleDetails?.items || {}, 'block-name'), `released text should not expose block-name: ${JSON.stringify(releasedSingleDetails)}`);
    ensure(
      !String(releasedSingleDetails?.items?.['origin-caption'] || releasedSingleDetails?.items?.origin || '').includes('INSERT'),
      `released text should not keep INSERT origin caption: ${JSON.stringify(releasedSingleDetails)}`,
    );
    ensure(!releasedSingleProperty?.actions?.includes('select-insert-group'), `released text should not expose insert-group actions: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(!releasedSingleProperty?.actions?.includes('release-insert-group'), `released text should not expose release action: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(releasedSingleProperty?.actions?.includes('open-released-insert-peer-1'), `released text missing Layout-B peer action: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(releasedSingleProperty?.actions?.includes('open-released-insert-peer-2'), `released text missing Layout-C peer action: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(releasedSingleProperty?.actions?.includes('previous-released-insert-peer'), `released text missing previous released peer action: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(releasedSingleProperty?.actions?.includes('next-released-insert-peer'), `released text missing next released peer action: ${JSON.stringify(releasedSingleProperty)}`);
    ensure(releasedSingleProperty?.meta?.['released-peer-instance'] === 'Archived / 2', `released text missing peer instance meta: ${JSON.stringify(releasedSingleProperty)}`);

    await page.fill('#cad-command-input', 'relinspeer Layout-B');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1
        && ids[0] === 10
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-B';
    }, null, { timeout: 10000 });
    summary.after_release_peer_fallback = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_release_peer_fallback?.details?.items?.['group-id'] === '500', `unexpected released peer fallback group-id: ${JSON.stringify(summary.after_release_peer_fallback)}`);
    ensure(summary.after_release_peer_fallback?.details?.items?.['block-name'] === 'DoorTag', `unexpected released peer fallback block-name: ${JSON.stringify(summary.after_release_peer_fallback)}`);
    ensure(summary.after_release_peer_fallback?.property?.meta?.['peer-instance'] === '1 / 2', `unexpected released peer fallback instance: ${JSON.stringify(summary.after_release_peer_fallback)}`);
    ensure(String(summary.after_release_peer_fallback?.statusText || '').includes('Released Insert Peer 1/2'), `unexpected released peer fallback status: ${JSON.stringify(summary.after_release_peer_fallback)}`);

    const restoredAfterFallback = await setCurrentSpaceContext(page, { space: 1, layout: 'Layout-A' });
    ensure(restoredAfterFallback, 'failed to restore Layout-A after released peer fallback');
    await setSelection(page, [9], 9);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1
        && ids[0] === 9
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'open-released-insert-peer-2');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1
        && ids[0] === 14
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-C';
    }, null, { timeout: 10000 });
    summary.after_release_peer_target = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      space: await readSpaceState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_release_peer_target?.details?.items?.['group-id'] === '500', `unexpected released peer target group-id: ${JSON.stringify(summary.after_release_peer_target)}`);
    ensure(summary.after_release_peer_target?.details?.items?.['block-name'] === 'DoorTag', `unexpected released peer target block-name: ${JSON.stringify(summary.after_release_peer_target)}`);
    ensure(summary.after_release_peer_target?.property?.meta?.['peer-instance'] === '2 / 2', `unexpected released peer target instance: ${JSON.stringify(summary.after_release_peer_target)}`);
    ensure(String(summary.after_release_peer_target?.statusText || '').includes('Released Insert Peer 2/2'), `unexpected released peer target status: ${JSON.stringify(summary.after_release_peer_target)}`);

    const restoredAfterTarget = await setCurrentSpaceContext(page, { space: 1, layout: 'Layout-A' });
    ensure(restoredAfterTarget, 'failed to restore Layout-A after released peer target');
    await setSelection(page, [9], 9);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getCurrentSpaceContext !== 'function') return false;
      const ids = debug.getSelectionIds();
      const context = debug.getCurrentSpaceContext();
      return Array.isArray(ids) && ids.length === 1
        && ids[0] === 9
        && context?.space === 1
        && String(context?.layout || '') === 'Layout-A';
    }, null, { timeout: 10000 });

    const textField = page.locator('#cad-property-form input[name="value"]').first();
    await textField.fill('TAG-EDITABLE');
    await textField.press('Tab');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getEntity === 'function'
        && String(debug.getEntity(9)?.value || '') === 'TAG-EDITABLE';
    }, null, { timeout: 10000 });
    summary.after_release_edit = {
      details: releasedSingleDetails,
      property: releasedSingleProperty,
      entity: (await readEntities(page, [9]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_release_edit?.entity?.value === 'TAG-EDITABLE', `released text edit did not persist: ${JSON.stringify(summary.after_release_edit)}`);

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
