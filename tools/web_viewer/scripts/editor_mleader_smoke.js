#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_mleader_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_mleader_fixture.json';

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
    'Usage: node tools/web_viewer/scripts/editor_mleader_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_mleader_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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
  const screenshotPath = path.join(runDir, 'mleader.png');

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
        && debug.listEntities().length >= 1;
    }, null, { timeout: 15000 });

    await setCurrentSpaceContext(page, { space: 0, layout: 'Model' });
    await setSelection(page, [1], 1);
    await page.waitForFunction(() => {
      const root = document.querySelector('#cad-selection-details');
      return root
        && String(root.getAttribute('data-mode') || '') === 'single'
        && String(root.getAttribute('data-primary-type') || '') === 'text'
        && String(root.getAttribute('data-read-only') || '') === 'true';
    }, null, { timeout: 10000 });

    summary.before = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };

    ensure(summary.before?.selectionIds?.length === 1 && summary.before.selectionIds[0] === 1, `unexpected initial selection: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['group-id'] === '1', `unexpected mleader group-id: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['group-source'] === 'LEADER / mleader', `unexpected mleader group-source: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-group-members'] === '1', `unexpected mleader source-group-members: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['editable-members'] === '0', `unexpected mleader editable-members: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['read-only-members'] === '1', `unexpected mleader read-only-members: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-text-pos'] === '12, 18', `unexpected mleader source-text-pos: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-text-rotation'] === '0', `unexpected mleader source-text-rotation: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-anchor'] === '12, 18', `unexpected mleader source-anchor: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['leader-landing'] === '12, 18', `unexpected mleader leader-landing: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['source-offset'] === '0, 0', `unexpected mleader source-offset: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.['current-offset'] === '0, 0', `unexpected mleader current-offset: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.details?.items?.space === 'Model', `unexpected mleader space: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.meta?.['text-kind'] === 'mleader', `unexpected mleader property text-kind: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.fields?.includes('value'), `mleader proxy should expose value field: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.fields?.includes('position.x'), `mleader proxy should expose position.x: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('reset-source-text-placement'), `mleader proxy missing reset-source-text-placement: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('fit-source-anchor'), `mleader proxy missing fit-source-anchor: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('fit-source-group'), `mleader proxy missing fit-source-group: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('edit-source-text'), `mleader proxy missing edit-source-text: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.actions?.includes('release-source-group'), `mleader proxy missing release-source-group: ${JSON.stringify(summary.before)}`);
    ensure(!summary.before?.property?.actions?.includes('select-source-group'), `single mleader proxy should not expose select-source-group: ${JSON.stringify(summary.before)}`);
    ensure(!summary.before?.property?.actions?.includes('select-source-text'), `single mleader proxy should not expose select-source-text: ${JSON.stringify(summary.before)}`);
    ensure(!summary.before?.property?.actions?.includes('select-source-anchor-driver'), `mleader proxy should not expose select-source-anchor-driver without anchor guide: ${JSON.stringify(summary.before)}`);
    ensure(!summary.before?.property?.actions?.includes('fit-leader-landing'), `mleader proxy should not expose fit-leader-landing without guide: ${JSON.stringify(summary.before)}`);
    ensure(!summary.before?.property?.actions?.includes('flip-leader-landing-side'), `mleader proxy should not expose flip-leader-landing-side without guide: ${JSON.stringify(summary.before)}`);
    ensure(summary.before?.property?.notes?.some((note) => note.includes('text overrides stay editable')), `mleader proxy should explain in-place text overrides: ${JSON.stringify(summary.before)}`);

    await fillPropertyInput(page, 'value', 'MLEADER_PROXY_EDITED');
    await fillPropertyInput(page, 'position.x', '16');
    await fillPropertyInput(page, 'position.y', '20');
    await fillPropertyInput(page, 'rotation', '0.5');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(1) : null;
      return !!entity
        && entity.value === 'MLEADER_PROXY_EDITED'
        && entity.position?.x === 16
        && entity.position?.y === 20
        && Math.abs((entity.rotation || 0) - 0.5) < 1e-9
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy'
        && entity.proxyKind === 'mleader'
        && entity.groupId === 1;
    }, null, { timeout: 10000 });
    summary.after_proxy_edit = {
      entity: (await readEntities(page, [1]))[0],
      details: await readSelectionDetails(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_proxy_edit?.statusText || '').includes('updated'), `unexpected mleader direct edit status: ${JSON.stringify(summary.after_proxy_edit)}`);

    await runCommand(page, 'srcplace');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(1) : null;
      return !!entity
        && entity.position?.x === 12
        && entity.position?.y === 18
        && Math.abs((entity.rotation || 0) - 0) < 1e-9
        && entity.sourceType === 'LEADER'
        && entity.editMode === 'proxy'
        && entity.proxyKind === 'mleader';
    }, null, { timeout: 10000 });
    summary.after_reset = {
      entity: (await readEntities(page, [1]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_reset?.statusText || '').includes('Reset source text placement (1 of 1 entities)'), `unexpected mleader srcplace status: ${JSON.stringify(summary.after_reset)}`);

    await clickPropertyAction(page, 'fit-source-group');
    const overlaysAfterFit = await readOverlays(page);
    summary.after_fit = {
      overlay: overlaysAfterFit?.sourceGroupFrame || null,
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_fit?.statusText || '').includes('Fit Source Group: LEADER 1'), `unexpected mleader fit-source-group status: ${JSON.stringify(summary.after_fit)}`);
    ensureApprox(summary.after_fit?.overlay?.minX, 12, 'mleader overlay minX');
    ensureApprox(summary.after_fit?.overlay?.minY, 18, 'mleader overlay minY');
    ensureApprox(summary.after_fit?.overlay?.maxX, 12, 'mleader overlay maxX');
    ensureApprox(summary.after_fit?.overlay?.maxY, 18, 'mleader overlay maxY');
    ensure(summary.after_fit?.overlay?.sourceType === 'LEADER', `unexpected mleader overlay sourceType: ${JSON.stringify(summary.after_fit)}`);
    ensure(summary.after_fit?.overlay?.groupId === 1, `unexpected mleader overlay groupId: ${JSON.stringify(summary.after_fit)}`);

    await runCommand(page, 'srcedit');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const root = document.querySelector('#cad-selection-details');
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(1) : null;
      const ids = debug && typeof debug.getSelectionIds === 'function' ? debug.getSelectionIds() : [];
      return !!entity
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 1
        && root
        && String(root.getAttribute('data-read-only') || '') === 'false'
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind
        && !Number.isFinite(entity.groupId);
    }, null, { timeout: 10000 });
    summary.after_release_edit = {
      selectionIds: await readSelectionIds(page),
      entity: (await readEntities(page, [1]))[0],
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_release_edit?.statusText || '').includes('Released source group and selected source text (1 of 1 entities)'), `unexpected mleader srcedit status: ${JSON.stringify(summary.after_release_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.after_release_edit?.details?.items || {}, 'group-source'), `released mleader should not keep group-source: ${JSON.stringify(summary.after_release_edit)}`);
    ensure(!summary.after_release_edit?.property?.actions?.includes('release-source-group'), `released mleader should not keep release-source-group: ${JSON.stringify(summary.after_release_edit)}`);
    ensure(summary.after_release_edit?.entity?.textKind === 'mleader', `released mleader should keep textKind: ${JSON.stringify(summary.after_release_edit)}`);

    await fillPropertyInput(page, 'value', 'MLEADER_RELEASED_EDIT');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(1) : null;
      return !!entity
        && entity.value === 'MLEADER_RELEASED_EDIT'
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind
        && !Number.isFinite(entity.groupId);
    }, null, { timeout: 10000 });
    summary.after_released_patch = {
      entity: (await readEntities(page, [1]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_released_patch?.statusText || '').includes('updated'), `unexpected released mleader edit status: ${JSON.stringify(summary.after_released_patch)}`);

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
