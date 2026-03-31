#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_classic_leader_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_classic_leader_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_classic_leader_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_classic_leader_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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

async function readOverlays(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.getOverlays === 'function' ? debug.getOverlays() : null;
  });
}

async function runCommand(page, commandText) {
  await page.fill('#cad-command-input', commandText);
  await page.click('#cad-command-run');
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
  const screenshotPath = path.join(runDir, 'classic_leader.png');

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
        && debug.listEntities().length >= 15;
    }, null, { timeout: 15000 });

    await setCurrentSpaceContext(page, { space: 1, layout: 'LayoutCombo' });
    await setSelection(page, [15], 15);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'true';
    }, null, { timeout: 10000 });

    summary.before = {
      selectionIds: await readSelectionIds(page),
      entity: (await readEntities(page, [15]))[0],
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.before?.selectionIds?.length === 1 && summary.before.selectionIds[0] === 15, `unexpected classic leader selection: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.sourceAnchor?.x === 188 && summary.before?.entity?.sourceAnchor?.y === 150, `unexpected classic leader sourceAnchor: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.leaderLanding?.x === 188 && summary.before?.entity?.leaderLanding?.y === 150, `unexpected classic leader leaderLanding: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.leaderElbow?.x === 204 && summary.before?.entity?.leaderElbow?.y === 162, `unexpected classic leader leaderElbow: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.sourceAnchorDriverId === 8, `unexpected classic leader sourceAnchorDriverId: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.sourceAnchorDriverType === 'polyline', `unexpected classic leader sourceAnchorDriverType: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.entity?.sourceAnchorDriverKind === 'endpoint', `unexpected classic leader sourceAnchorDriverKind: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['group-id'] === '3', `unexpected classic leader group-id: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['group-source'] === 'LEADER / leader', `unexpected classic leader group-source: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-group-members'] === '2', `unexpected classic leader group members: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['read-only-members'] === '2', `unexpected classic leader read-only members: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.space === 'Paper', `unexpected classic leader space: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-anchor'] === '188, 150', `unexpected classic leader source-anchor detail: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['leader-landing'] === '188, 150', `unexpected classic leader leader-landing detail: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['leader-elbow'] === '204, 162', `unexpected classic leader leader-elbow detail: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-anchor-driver'] === '8:polyline endpoint', `unexpected classic leader source-anchor-driver detail: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.meta?.['text-kind'] === 'text', `unexpected classic leader text-kind: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.meta?.['source-anchor'] === '188, 150', `unexpected classic leader property source-anchor: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.meta?.['leader-landing'] === '188, 150', `unexpected classic leader property leader-landing: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.meta?.['leader-elbow'] === '204, 162', `unexpected classic leader property leader-elbow: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.fields?.includes('value'), `classic leader proxy should expose value field: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('select-source-group'), `classic leader proxy missing select-source-group: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('select-source-anchor-driver'), `classic leader proxy missing select-source-anchor-driver: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('fit-source-anchor'), `classic leader proxy missing fit-source-anchor: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('fit-leader-landing'), `classic leader proxy missing fit-leader-landing: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('flip-leader-landing-side'), `classic leader proxy missing flip-leader-landing-side: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('reset-source-text-placement'), `classic leader proxy missing reset-source-text-placement: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('edit-source-text'), `classic leader proxy missing edit-source-text: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('release-source-group'), `classic leader proxy missing release-source-group: ${JSON.stringify(summary.before)}`);

    await fillPropertyInput(page, 'value', 'CLASSIC_LEADER_PROXY_EDITED');
    await fillPropertyInput(page, 'position.x', '214');
    await fillPropertyInput(page, 'position.y', '158');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(15) : null;
      return !!entity
        && entity.value === 'CLASSIC_LEADER_PROXY_EDITED'
        && entity.position?.x === 214
        && entity.position?.y === 158
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy'
        && entity.proxyKind === 'leader'
        && entity.groupId === 3;
    }, null, { timeout: 10000 });
    summary.after_proxy_edit = {
      entity: (await readEntities(page, [15]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_proxy_edit?.statusText || '').includes('updated'), `unexpected classic leader direct edit status: ${JSON.stringify(summary.after_proxy_edit)}`);

    await runCommand(page, 'srcplace');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(15) : null;
      return !!entity
        && entity.position?.x === 210
        && entity.position?.y === 154
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy'
        && entity.proxyKind === 'leader';
    }, null, { timeout: 10000 });
    summary.after_reset = {
      entity: (await readEntities(page, [15]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_reset?.statusText || '').includes('Reset source text placement (1 of 2 entities)'), `unexpected classic leader srcplace status: ${JSON.stringify(summary.after_reset)}`);

    await runCommand(page, 'srcdriver');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 8;
    }, null, { timeout: 10000 });
    summary.after_select_anchor_driver = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_select_anchor_driver?.statusText || '').includes('Selected source anchor driver'), `unexpected classic leader srcdriver status: ${JSON.stringify(summary.after_select_anchor_driver)}`);

    await setSelection(page, [15], 15);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 15;
    }, null, { timeout: 10000 });
    await runCommand(page, 'leadfit');
    const overlaysAfterLandingFit = await readOverlays(page);
    summary.after_landing_fit = {
      overlay: overlaysAfterLandingFit?.sourceTextGuide || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_landing_fit?.statusText || '').includes('Fit Leader Landing: LEADER 3'), `unexpected classic leader leadfit status: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(summary.after_landing_fit?.overlay?.anchor?.x === 188 && summary.after_landing_fit?.overlay?.anchor?.y === 150, `classic leader fit should expose importer anchor: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(summary.after_landing_fit?.overlay?.landingPoint?.x === 188 && summary.after_landing_fit?.overlay?.landingPoint?.y === 150, `classic leader fit should expose importer landing: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(summary.after_landing_fit?.overlay?.elbowPoint?.x === 204 && summary.after_landing_fit?.overlay?.elbowPoint?.y === 162, `classic leader fit should expose importer elbow: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(summary.after_landing_fit?.overlay?.anchorDriverId === 8, `classic leader fit should match imported driver id: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(summary.after_landing_fit?.overlay?.anchorDriverLabel === 'polyline endpoint', `classic leader fit should match imported driver label: ${JSON.stringify(summary.after_landing_fit)}`);
    ensure(Number.isFinite(summary.after_landing_fit?.overlay?.sourcePoint?.x), `classic leader fit should expose source point overlay: ${JSON.stringify(summary.after_landing_fit)}`);

    await runCommand(page, 'srcgrp');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 2 && ids.includes(8) && ids.includes(15);
    }, null, { timeout: 10000 });
    summary.after_select_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_select_group?.statusText || '').includes('Selected source group (2 entities)'), `unexpected classic leader srcgrp status: ${JSON.stringify(summary.after_select_group)}`);

    await runCommand(page, 'srctext');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 15;
    }, null, { timeout: 10000 });
    summary.after_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_select_text?.statusText || '').includes('Selected source text (1 of 2 entities)'), `unexpected classic leader srctext status: ${JSON.stringify(summary.after_select_text)}`);

    await runCommand(page, 'srcedit');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(15) : null;
      return !!entity
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind
        && !Number.isFinite(entity.groupId);
    }, null, { timeout: 10000 });
    summary.after_release_edit = {
      selectionIds: await readSelectionIds(page),
      entity: (await readEntities(page, [15]))[0],
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_release_edit?.statusText || '').includes('Released source group and selected source text (1 of 2 entities)'), `unexpected classic leader srcedit status: ${JSON.stringify(summary.after_release_edit)}`);
    ensure(summary.after_release_edit?.entity?.value === 'CLASSIC_LEADER_PROXY_EDITED', `released classic leader text should keep edited value: ${JSON.stringify(summary.after_release_edit)}`);

    await fillPropertyInput(page, 'value', 'CLASSIC_LEADER_RELEASED_EDIT');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(15) : null;
      return !!entity
        && entity.value === 'CLASSIC_LEADER_RELEASED_EDIT'
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind
        && !Number.isFinite(entity.groupId);
    }, null, { timeout: 10000 });
    summary.after_released_patch = {
      entity: (await readEntities(page, [15]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_released_patch?.statusText || '').includes('updated'), `unexpected released classic leader edit status: ${JSON.stringify(summary.after_released_patch)}`);

    await setSelection(page, [25], 25);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 25;
    }, null, { timeout: 10000 });
    summary.dimension_before = {
      selectionIds: await readSelectionIds(page),
      entity: (await readEntities(page, [25]))[0],
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.dimension_before?.entity?.sourceAnchor?.x === 65 && summary.dimension_before?.entity?.sourceAnchor?.y === 0, `unexpected real dimension sourceAnchor: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.entity?.sourceBundleId === 5, `unexpected real dimension sourceBundleId: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.entity?.sourceAnchorDriverId === 21, `unexpected real dimension sourceAnchorDriverId: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.entity?.sourceAnchorDriverType === 'line', `unexpected real dimension sourceAnchorDriverType: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.entity?.sourceAnchorDriverKind === 'midpoint', `unexpected real dimension sourceAnchorDriverKind: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['source-group-members'] === '9', `unexpected real dimension source-group-members: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['source-anchor'] === '65, 0', `unexpected real dimension source-anchor detail: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.details?.items?.['source-anchor-driver'] === '21:line midpoint', `unexpected real dimension source-anchor-driver detail: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('select-source-group'), `real dimension missing select-source-group: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('select-source-anchor-driver'), `real dimension missing select-source-anchor-driver: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('fit-source-anchor'), `real dimension missing fit-source-anchor: ${JSON.stringify(summary.dimension_before)}`);
    ensure(summary.dimension_before?.property?.actions?.includes('flip-dimension-text-side'), `real dimension missing flip-dimension-text-side: ${JSON.stringify(summary.dimension_before)}`);

    await setSelection(page, [26], 26);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 26;
    }, null, { timeout: 10000 });
    summary.dimension_arrowhead_before = {
      selectionIds: await readSelectionIds(page),
      entity: (await readEntities(page, [26]))[0],
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.dimension_arrowhead_before?.entity?.groupId === 6, `unexpected real dimension arrowhead groupId: ${JSON.stringify(summary.dimension_arrowhead_before)}`);
    ensure(summary.dimension_arrowhead_before?.entity?.sourceBundleId === 5, `unexpected real dimension arrowhead sourceBundleId: ${JSON.stringify(summary.dimension_arrowhead_before)}`);
    ensure(summary.dimension_arrowhead_before?.details?.items?.['source-bundle-id'] === '5', `unexpected real dimension arrowhead source-bundle-id: ${JSON.stringify(summary.dimension_arrowhead_before)}`);
    ensure(summary.dimension_arrowhead_before?.details?.items?.['source-group-members'] === '9', `unexpected real dimension arrowhead source-group-members: ${JSON.stringify(summary.dimension_arrowhead_before)}`);
    ensure(summary.dimension_arrowhead_before?.property?.actions?.includes('select-source-text'), `real dimension arrowhead missing select-source-text: ${JSON.stringify(summary.dimension_arrowhead_before)}`);
    ensure(summary.dimension_arrowhead_before?.property?.actions?.includes('select-source-anchor-driver'), `real dimension arrowhead missing select-source-anchor-driver: ${JSON.stringify(summary.dimension_arrowhead_before)}`);

    await runCommand(page, 'srctext');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 25;
    }, null, { timeout: 10000 });
    summary.dimension_after_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_select_text?.statusText || '').includes('Selected source text (1 of 9 entities)'), `unexpected real dimension srctext status: ${JSON.stringify(summary.dimension_after_select_text)}`);

    await runCommand(page, 'srcdriver');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 21;
    }, null, { timeout: 10000 });
    summary.dimension_after_select_anchor_driver = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_select_anchor_driver?.statusText || '').includes('Selected source anchor driver (line midpoint)'), `unexpected real dimension srcdriver status: ${JSON.stringify(summary.dimension_after_select_anchor_driver)}`);

    await setSelection(page, [25], 25);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 25;
    }, null, { timeout: 10000 });
    await runCommand(page, 'srcanchor');
    const overlaysAfterDimensionAnchorFit = await readOverlays(page);
    summary.dimension_after_anchor_fit = {
      overlay: overlaysAfterDimensionAnchorFit?.sourceTextGuide || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_anchor_fit?.statusText || '').includes('Fit Source Anchor: DIMENSION 5'), `unexpected real dimension srcanchor status: ${JSON.stringify(summary.dimension_after_anchor_fit)}`);
    ensure(summary.dimension_after_anchor_fit?.overlay?.anchor?.x === 65 && summary.dimension_after_anchor_fit?.overlay?.anchor?.y === 0, `unexpected real dimension anchor overlay: ${JSON.stringify(summary.dimension_after_anchor_fit)}`);
    ensure(summary.dimension_after_anchor_fit?.overlay?.anchorDriverId === 21, `unexpected real dimension driver id overlay: ${JSON.stringify(summary.dimension_after_anchor_fit)}`);
    ensure(summary.dimension_after_anchor_fit?.overlay?.anchorDriverLabel === 'line midpoint', `unexpected real dimension driver label overlay: ${JSON.stringify(summary.dimension_after_anchor_fit)}`);

    await clickPropertyAction(page, 'flip-dimension-text-side');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(25) : null;
      return !!entity
        && entity.position?.x === 65
        && entity.position?.y === -152
        && entity.sourceTextPos?.x === 65
        && entity.sourceTextPos?.y === 152
        && entity.dimTextPos?.x === 65
        && entity.dimTextPos?.y === -152;
    }, null, { timeout: 10000 });
    summary.dimension_after_flip = {
      entity: (await readEntities(page, [25]))[0],
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_flip?.statusText || '').includes('Applied opposite DIMENSION text side (1 of 9 entities)'), `unexpected real dimension dimflip status: ${JSON.stringify(summary.dimension_after_flip)}`);
    ensure(summary.dimension_after_flip?.details?.items?.['current-offset'] === '0, -152', `unexpected real dimension flipped current-offset: ${JSON.stringify(summary.dimension_after_flip)}`);

    await runCommand(page, 'srcplace');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(25) : null;
      return !!entity
        && entity.position?.x === 65
        && entity.position?.y === 152
        && entity.sourceTextPos?.x === 65
        && entity.sourceTextPos?.y === 152
        && entity.dimTextPos?.x === 65
        && entity.dimTextPos?.y === 152;
    }, null, { timeout: 10000 });
    summary.dimension_after_reset = {
      entity: (await readEntities(page, [25]))[0],
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.dimension_after_reset?.statusText || '').includes('Reset source text placement (1 of 9 entities)'), `unexpected real dimension srcplace status: ${JSON.stringify(summary.dimension_after_reset)}`);

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
