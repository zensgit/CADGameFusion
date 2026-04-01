#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_selection_summary_smoke');
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
    'Usage: node tools/web_viewer/scripts/editor_selection_summary_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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
    const badges = Object.fromEntries(
      Array.from(root.querySelectorAll('[data-selection-badge]'))
        .map((chip) => {
          const key = String(chip.getAttribute('data-selection-badge') || '').trim();
          if (!key) return null;
          return [key, String(chip.textContent || '').trim()];
        })
        .filter(Boolean)
    );
    const noteEl = root.querySelector('.cad-selection-empty');
    const entityCount = Number.parseInt(String(root.getAttribute('data-entity-count') || '0'), 10);
    return {
      mode: String(root.getAttribute('data-mode') || ''),
      entityCount: Number.isFinite(entityCount) ? entityCount : 0,
      primaryType: String(root.getAttribute('data-primary-type') || ''),
      readOnly: String(root.getAttribute('data-read-only') || ''),
      note: noteEl ? String(noteEl.textContent || '').trim() : '',
      items,
      badges,
    };
  });
}

async function readPropertyFormState(page) {
  return page.evaluate(() => {
    const form = document.querySelector('#cad-property-form');
    if (!form) return null;
    const notes = Array.from(form.querySelectorAll('.cad-readonly-note'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
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
    const inputs = Array.from(form.querySelectorAll('input[name]'))
      .map((input) => String(input.getAttribute('name') || '').trim())
      .filter(Boolean);
    const values = Object.fromEntries(
      Array.from(form.querySelectorAll('input[name]'))
        .map((input) => {
          const key = String(input.getAttribute('name') || '').trim();
          if (!key) return null;
          return [key, String(input.value || '').trim()];
        })
        .filter(Boolean)
    );
    const actions = Array.from(form.querySelectorAll('[data-property-action]'))
      .map((button) => String(button.getAttribute('data-property-action') || '').trim())
      .filter(Boolean);
    return { notes, meta, inputs, values, actions };
  });
}

async function readLayerPanelState(page) {
  return page.evaluate(() => {
    const list = document.querySelector('#cad-layer-list');
    if (!list) return null;
    const listRect = list.getBoundingClientRect();
    const items = Array.from(list.querySelectorAll('.cad-layer-item')).map((item) => {
      const rect = item.getBoundingClientRect();
      const id = Number.parseInt(String(item.getAttribute('data-layer-id') || ''), 10);
      return {
        id: Number.isFinite(id) ? id : null,
        text: String(item.textContent || '').trim(),
        focused: item.classList.contains('is-focused'),
        inView: rect.top >= listRect.top - 1 && rect.bottom <= listRect.bottom + 1,
      };
    });
    const focused = items.find((item) => item.focused) || null;
    return {
      focusedLayerId: focused?.id ?? null,
      items,
    };
  });
}

async function readSelectionDebug(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#cad-selection-details');
    const summary = document.querySelector('#cad-selection-summary');
    const d = window.__cadDebug;
    return {
      selectionIds: d && typeof d.getSelectionIds === 'function' ? d.getSelectionIds() : [],
      summaryText: summary ? String(summary.textContent || '').trim() : '',
      detailsHtml: root ? String(root.outerHTML || '') : '',
    };
  });
}

async function readEntityById(page, entityId) {
  return page.evaluate((id) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return null;
    return d.getEntity(id);
  }, entityId);
}

async function updateLayer(page, layerId, patch) {
  return page.evaluate(({ layerId: nextLayerId, patch: nextPatch }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.updateLayer !== 'function') return false;
    return !!d.updateLayer(nextLayerId, nextPatch);
  }, { layerId, patch });
}

async function clickPropertyAction(page, actionId) {
  await page.click(`#cad-property-form [data-property-action="${actionId}"]`);
}

async function selectEntityById(page, entityId) {
  const point = await page.evaluate((id) => {
    const d = window.__cadDebug;
    const canvas = document.getElementById('cad-canvas');
    if (!d || !canvas || typeof d.getEntity !== 'function' || typeof d.worldToCanvas !== 'function') return null;
    const entity = d.getEntity(id);
    if (!entity) return null;
    let world = null;
    if (entity.type === 'line' && entity.start && entity.end) {
      world = {
        x: (Number(entity.start.x) + Number(entity.end.x)) * 0.5,
        y: (Number(entity.start.y) + Number(entity.end.y)) * 0.5,
      };
    } else if ((entity.type === 'circle' || entity.type === 'arc') && entity.center) {
      world = { x: Number(entity.center.x), y: Number(entity.center.y) };
    } else if (entity.type === 'text' && entity.position) {
      world = { x: Number(entity.position.x), y: Number(entity.position.y) };
    }
    if (!world) return null;
    const screen = d.worldToCanvas(world);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + screen.x,
      y: rect.top + screen.y,
    };
  }, entityId);
  if (!point) {
    throw new Error(`Failed to resolve click point for entity ${entityId}`);
  }
  await page.mouse.click(point.x, point.y);
}

function assertSelectionContract(contract, expected, label) {
  if (!contract) {
    throw new Error(`${label}: missing selection contract`);
  }
  if (contract.mode !== expected.mode) {
    throw new Error(`${label}: expected mode=${expected.mode}, got ${contract.mode}`);
  }
  if (contract.entityCount !== expected.entityCount) {
    throw new Error(`${label}: expected entityCount=${expected.entityCount}, got ${contract.entityCount}`);
  }
  if (contract.primaryType !== expected.primaryType) {
    throw new Error(`${label}: expected primaryType=${expected.primaryType}, got ${contract.primaryType}`);
  }
  for (const [key, value] of Object.entries(expected.items || {})) {
    if (contract.items?.[key] !== value) {
      throw new Error(`${label}: expected ${key}=${value}, got ${contract.items?.[key]}`);
    }
  }
  for (const [key, value] of Object.entries(expected.badges || {})) {
    if (contract.badges?.[key] !== value) {
      throw new Error(`${label}: expected badge ${key}=${value}, got ${contract.badges?.[key]}`);
    }
  }
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const outdirRoot = path.resolve(process.cwd(), args.outdir || DEFAULT_OUTDIR);
  ensureDir(outdirRoot);
  const runDir = path.join(outdirRoot, nowStamp());
  ensureDir(runDir);

  let serverHandle = null;
  let baseUrl = args.baseUrl || '';
  if (!args.noServe) {
    serverHandle = await startStaticServer(repoRoot, args.host, args.port);
    baseUrl = serverHandle.baseUrl;
  }
  if (!baseUrl) {
    throw new Error('base URL not available');
  }

  const fixturePath = String(args.fixture || DEFAULT_FIXTURE).trim();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'warning' || type === 'error') {
      const text = String(msg.text() || '');
      if (!text.includes('favicon.ico')) {
        consoleMessages.push({ type, text });
      }
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.stack || error?.message || error));
  });

  const summary = {
    ok: false,
    fixture: fixturePath,
    url: '',
    before: null,
    after: null,
    locked: null,
    unlocked: null,
    layer_panel_before: null,
    layer_panel_after: null,
    layer_panel_locked: null,
    layer_panel_unlocked: null,
    entity: null,
    property_before: null,
    property_after: null,
    property_locked: null,
    property_unlocked: null,
    debug_before: null,
    debug_after: null,
    status: '',
    console_messages: [],
    page_errors: [],
    screenshot: path.join(runDir, 'selection_summary.png'),
  };

  try {
    const url = new URL('tools/web_viewer/index.html', baseUrl);
    url.searchParams.set('mode', 'editor');
    url.searchParams.set('debug', '1');
    url.searchParams.set('cadgf', fixturePath);
    summary.url = url.toString();

    await page.goto(summary.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      return !!d.getEntity(7);
    }, null, { timeout: 15000 });

    await selectEntityById(page, 7);
    await page.waitForSelector('#cad-selection-details[data-mode="single"]', { timeout: 10000 });
    summary.before = await readSelectionDetails(page);
    summary.debug_before = await readSelectionDebug(page);
    assertSelectionContract(summary.before, {
      mode: 'single',
      entityCount: 1,
      primaryType: 'line',
      items: {
        'origin-caption': 'INSERT / fragment',
        origin: 'INSERT / fragment',
        layer: '1:PLOT',
        'layer-color': '#808080',
        'layer-state': 'Shown / Open / Live / Print / Normal',
        'effective-color': '#808080',
        'color-source': 'BYLAYER',
        'color-aci': '8',
        space: 'Paper',
        layout: 'Layout-A',
        'line-type': 'HIDDEN2',
        'line-type-source': 'EXPLICIT',
        'line-weight': '0.55',
        'line-weight-source': 'EXPLICIT',
        'line-type-scale': '1.7',
        'line-type-scale-source': 'EXPLICIT',
      },
      badges: {
        type: 'line',
        layer: '1:PLOT',
        space: 'Paper',
        layout: 'Layout-A',
        'color-source': 'BYLAYER',
      },
    }, 'before');
    summary.property_before = await readPropertyFormState(page);
    summary.layer_panel_before = await readLayerPanelState(page);
    if (
      !summary.property_before?.meta
      || summary.property_before.meta.layer !== '1:PLOT'
      || summary.property_before.meta['layer-color'] !== '#808080'
      || summary.property_before.meta['layer-state'] !== 'Shown / Open / Live / Print / Normal'
    ) {
      throw new Error(`unexpected property metadata before layer edit: ${JSON.stringify(summary.property_before)}`);
    }
    if (summary.layer_panel_before?.focusedLayerId !== 1) {
      throw new Error(`expected layer panel focus on layer 1 before edit: ${JSON.stringify(summary.layer_panel_before)}`);
    }

    await page.fill('#cad-property-form input[name="layerId"]', '2');
    await page.locator('#cad-property-form input[name="layerId"]').blur();
    await page.waitForFunction(() => {
      const source = document.querySelector('#cad-selection-details [data-selection-field="color-source"] strong');
      const color = document.querySelector('#cad-selection-details [data-selection-field="effective-color"] strong');
      return source && String(source.textContent || '').trim() === 'BYLAYER'
        && color && String(color.textContent || '').trim() === '#ff0000';
    }, null, { timeout: 10000 });

    summary.after = await readSelectionDetails(page);
    summary.entity = await readEntityById(page, 7);
    summary.property_after = await readPropertyFormState(page);
    summary.layer_panel_after = await readLayerPanelState(page);
    summary.debug_after = await readSelectionDebug(page);
    assertSelectionContract(summary.after, {
      mode: 'single',
      entityCount: 1,
      primaryType: 'line',
      items: {
        'origin-caption': 'INSERT / fragment',
        origin: 'INSERT / fragment',
        layer: '2:REDLINE',
        'layer-color': '#ff0000',
        'layer-state': 'Shown / Open / Live / NoPrint / Construction',
        'effective-color': '#ff0000',
        'color-source': 'BYLAYER',
        space: 'Paper',
        layout: 'Layout-A',
        'line-type': 'HIDDEN2',
        'line-type-source': 'EXPLICIT',
        'line-weight': '0.55',
        'line-weight-source': 'EXPLICIT',
        'line-type-scale': '1.7',
        'line-type-scale-source': 'EXPLICIT',
      },
      badges: {
        type: 'line',
        layer: '2:REDLINE',
        space: 'Paper',
        layout: 'Layout-A',
        'color-source': 'BYLAYER',
        'layer-noprint': 'NoPrint',
        'layer-construction': 'Construction',
      },
    }, 'after');
    if (!summary.entity || summary.entity.layerId !== 2 || summary.entity.colorSource !== 'BYLAYER') {
      throw new Error(`unexpected entity after layer reassignment: ${JSON.stringify(summary.entity)}`);
    }
    if (
      !summary.property_after?.meta
      || summary.property_after.meta.layer !== '2:REDLINE'
      || summary.property_after.meta['layer-color'] !== '#ff0000'
      || summary.property_after.meta['layer-state'] !== 'Shown / Open / Live / NoPrint / Construction'
    ) {
      throw new Error(`unexpected property metadata after layer edit: ${JSON.stringify(summary.property_after)}`);
    }
    if (String(summary.property_after?.values?.color || '').toLowerCase() !== '#ff0000') {
      throw new Error(`expected effective color input after layer edit: ${JSON.stringify(summary.property_after)}`);
    }
    if (summary.layer_panel_after?.focusedLayerId !== 2) {
      throw new Error(`expected layer panel focus on layer 2 after edit: ${JSON.stringify(summary.layer_panel_after)}`);
    }
    if (!Array.isArray(summary.property_after?.actions) || !summary.property_after.actions.includes('locate-layer')) {
      throw new Error(`expected locate-layer action after edit: ${JSON.stringify(summary.property_after)}`);
    }
    if (
      !summary.property_after.actions.includes('use-layer-line-type')
      || !summary.property_after.actions.includes('use-layer-line-weight')
      || !summary.property_after.actions.includes('use-default-line-type-scale')
    ) {
      throw new Error(`expected line-style restore actions after layer edit: ${JSON.stringify(summary.property_after)}`);
    }
    if (summary.property_after.actions.includes('use-layer-color')) {
      throw new Error(`did not expect use-layer-color while color is already BYLAYER: ${JSON.stringify(summary.property_after)}`);
    }

    await page.fill('#cad-property-form input[name="color"]', '#112233');
    await page.locator('#cad-property-form input[name="color"]').blur();
    await page.waitForFunction(() => {
      const source = document.querySelector('#cad-selection-details [data-selection-field="color-source"] strong');
      const color = document.querySelector('#cad-selection-details [data-selection-field="effective-color"] strong');
      return source && String(source.textContent || '').trim() === 'TRUECOLOR'
        && color && String(color.textContent || '').trim() === '#112233';
    }, null, { timeout: 10000 });
    summary.after_color_override = await readSelectionDetails(page);
    summary.property_after_color_override = await readPropertyFormState(page);
    if (!summary.property_after_color_override.actions.includes('use-layer-color')) {
      throw new Error(`expected use-layer-color after explicit color override: ${JSON.stringify(summary.property_after_color_override)}`);
    }

    await clickPropertyAction(page, 'use-layer-color');
    await page.waitForFunction(() => {
      const source = document.querySelector('#cad-selection-details [data-selection-field="color-source"] strong');
      const color = document.querySelector('#cad-selection-details [data-selection-field="effective-color"] strong');
      return source && String(source.textContent || '').trim() === 'BYLAYER'
        && color && String(color.textContent || '').trim() === '#ff0000';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'use-layer-line-type');
    await page.waitForFunction(() => {
      const lineType = document.querySelector('#cad-selection-details [data-selection-field="line-type"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-type-source"] strong');
      return lineType && String(lineType.textContent || '').trim() === 'CENTER'
        && source && String(source.textContent || '').trim() === 'BYLAYER';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'use-layer-line-weight');
    await page.waitForFunction(() => {
      const lineWeight = document.querySelector('#cad-selection-details [data-selection-field="line-weight"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-weight-source"] strong');
      return lineWeight && String(lineWeight.textContent || '').trim() === '0.35'
        && source && String(source.textContent || '').trim() === 'BYLAYER';
    }, null, { timeout: 10000 });

    await clickPropertyAction(page, 'use-default-line-type-scale');
    await page.waitForFunction(() => {
      const lineTypeScale = document.querySelector('#cad-selection-details [data-selection-field="line-type-scale"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-type-scale-source"] strong');
      return lineTypeScale && String(lineTypeScale.textContent || '').trim() === '1'
        && source && String(source.textContent || '').trim() === 'DEFAULT';
    }, null, { timeout: 10000 });

    summary.after_use_layer_style = await readSelectionDetails(page);
    summary.entity_after_use_layer_style = await readEntityById(page, 7);
    summary.property_after_use_layer_style = await readPropertyFormState(page);
    assertSelectionContract(summary.after_use_layer_style, {
      mode: 'single',
      entityCount: 1,
      primaryType: 'line',
      items: {
        'origin-caption': 'INSERT / fragment',
        origin: 'INSERT / fragment',
        layer: '2:REDLINE',
        'layer-color': '#ff0000',
        'layer-state': 'Shown / Open / Live / NoPrint / Construction',
        'effective-color': '#ff0000',
        'color-source': 'BYLAYER',
        space: 'Paper',
        layout: 'Layout-A',
        'line-type': 'CENTER',
        'line-type-source': 'BYLAYER',
        'line-weight': '0.35',
        'line-weight-source': 'BYLAYER',
        'line-type-scale': '1',
        'line-type-scale-source': 'DEFAULT',
      },
      badges: {
        type: 'line',
        layer: '2:REDLINE',
        space: 'Paper',
        layout: 'Layout-A',
        'color-source': 'BYLAYER',
        'layer-noprint': 'NoPrint',
        'layer-construction': 'Construction',
      },
    }, 'after_use_layer_style');
    if (
      !summary.entity_after_use_layer_style
      || summary.entity_after_use_layer_style.layerId !== 2
      || summary.entity_after_use_layer_style.colorSource !== 'BYLAYER'
      || summary.entity_after_use_layer_style.color !== '#ff0000'
      || summary.entity_after_use_layer_style.lineType !== 'BYLAYER'
      || Number(summary.entity_after_use_layer_style.lineWeight || 0) !== 0
      || summary.entity_after_use_layer_style.lineWeightSource !== 'BYLAYER'
      || Number(summary.entity_after_use_layer_style.lineTypeScale || 1) !== 1
      || summary.entity_after_use_layer_style.lineTypeScaleSource !== 'DEFAULT'
    ) {
      throw new Error(`unexpected entity after restoring layer style: ${JSON.stringify(summary.entity_after_use_layer_style)}`);
    }
    if (
      !summary.property_after_use_layer_style?.meta
      || summary.property_after_use_layer_style.meta['color-source'] !== 'BYLAYER'
      || summary.property_after_use_layer_style.meta['line-type-source'] !== 'BYLAYER'
      || summary.property_after_use_layer_style.meta['line-weight-source'] !== 'BYLAYER'
      || summary.property_after_use_layer_style.meta['line-type-scale-source'] !== 'DEFAULT'
    ) {
      throw new Error(`unexpected property metadata after restoring layer style: ${JSON.stringify(summary.property_after_use_layer_style)}`);
    }
    if (
      summary.property_after_use_layer_style.actions.includes('use-layer-color')
      || summary.property_after_use_layer_style.actions.includes('use-layer-line-type')
      || summary.property_after_use_layer_style.actions.includes('use-layer-line-weight')
      || summary.property_after_use_layer_style.actions.includes('use-default-line-type-scale')
    ) {
      throw new Error(`expected layer-style restore actions to disappear after reset: ${JSON.stringify(summary.property_after_use_layer_style)}`);
    }

    await page.fill('#cad-property-form input[name="lineWeight"]', '0.1');
    await page.locator('#cad-property-form input[name="lineWeight"]').blur();
    await page.waitForFunction(() => {
      const lineWeight = document.querySelector('#cad-selection-details [data-selection-field="line-weight"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-weight-source"] strong');
      return lineWeight && String(lineWeight.textContent || '').trim() === '0.1'
        && source && String(source.textContent || '').trim() === 'EXPLICIT';
    }, null, { timeout: 10000 });
    await page.fill('#cad-property-form input[name="lineWeight"]', '0');
    await page.locator('#cad-property-form input[name="lineWeight"]').blur();
    await page.waitForFunction(() => {
      const lineWeight = document.querySelector('#cad-selection-details [data-selection-field="line-weight"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-weight-source"] strong');
      return lineWeight && String(lineWeight.textContent || '').trim() === '0'
        && source && String(source.textContent || '').trim() === 'EXPLICIT';
    }, null, { timeout: 10000 });
    summary.after_explicit_zero_weight = await readSelectionDetails(page);
    summary.entity_after_explicit_zero_weight = await readEntityById(page, 7);
    summary.property_after_explicit_zero_weight = await readPropertyFormState(page);
    if (
      !summary.entity_after_explicit_zero_weight
      || Number(summary.entity_after_explicit_zero_weight.lineWeight || 0) !== 0
      || summary.entity_after_explicit_zero_weight.lineWeightSource !== 'EXPLICIT'
    ) {
      throw new Error(`unexpected entity after explicit zero line weight: ${JSON.stringify(summary.entity_after_explicit_zero_weight)}`);
    }
    if (
      !summary.property_after_explicit_zero_weight?.meta
      || summary.property_after_explicit_zero_weight.meta['line-weight'] !== '0'
      || summary.property_after_explicit_zero_weight.meta['line-weight-source'] !== 'EXPLICIT'
      || !summary.property_after_explicit_zero_weight.actions.includes('use-layer-line-weight')
    ) {
      throw new Error(`unexpected property state after explicit zero line weight: ${JSON.stringify(summary.property_after_explicit_zero_weight)}`);
    }

    await clickPropertyAction(page, 'use-layer-line-weight');
    await page.waitForFunction(() => {
      const lineWeight = document.querySelector('#cad-selection-details [data-selection-field="line-weight"] strong');
      const source = document.querySelector('#cad-selection-details [data-selection-field="line-weight-source"] strong');
      return lineWeight && String(lineWeight.textContent || '').trim() === '0.35'
        && source && String(source.textContent || '').trim() === 'BYLAYER';
    }, null, { timeout: 10000 });
    summary.after_restore_zero_weight = await readSelectionDetails(page);
    summary.entity_after_restore_zero_weight = await readEntityById(page, 7);
    summary.property_after_restore_zero_weight = await readPropertyFormState(page);
    if (
      !summary.entity_after_restore_zero_weight
      || Number(summary.entity_after_restore_zero_weight.lineWeight || 0) !== 0
      || summary.entity_after_restore_zero_weight.lineWeightSource !== 'BYLAYER'
    ) {
      throw new Error(`unexpected entity after restoring BYLAYER line weight: ${JSON.stringify(summary.entity_after_restore_zero_weight)}`);
    }
    if (
      !summary.property_after_restore_zero_weight?.meta
      || summary.property_after_restore_zero_weight.meta['line-weight'] !== '0.35'
      || summary.property_after_restore_zero_weight.meta['line-weight-source'] !== 'BYLAYER'
      || summary.property_after_restore_zero_weight.actions.includes('use-layer-line-weight')
    ) {
      throw new Error(`unexpected property state after restoring BYLAYER line weight: ${JSON.stringify(summary.property_after_restore_zero_weight)}`);
    }

    const lockedOk = await updateLayer(page, 2, { locked: true });
    if (!lockedOk) {
      throw new Error('failed to lock target layer via debug API');
    }
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-details [data-selection-badge="layer-locked"]');
      return el && String(el.textContent || '').trim() === 'Locked';
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const note = document.querySelector('#cad-property-form .cad-readonly-note');
      const color = document.querySelector('#cad-property-form input[name="color"]');
      return note && String(note.textContent || '').includes('locked layer 2:REDLINE') && !color;
    }, null, { timeout: 10000 });
    summary.locked = await readSelectionDetails(page);
    summary.property_locked = await readPropertyFormState(page);
    summary.layer_panel_locked = await readLayerPanelState(page);
    assertSelectionContract(summary.locked, {
      mode: 'single',
      entityCount: 1,
      primaryType: 'line',
      items: {
        layer: '2:REDLINE',
        'layer-color': '#ff0000',
        'layer-state': 'Shown / Locked / Live / NoPrint / Construction',
      },
      badges: {
        layer: '2:REDLINE',
        'layer-locked': 'Locked',
        'layer-noprint': 'NoPrint',
        'layer-construction': 'Construction',
      },
    }, 'locked');
    if (!Array.isArray(summary.property_locked?.notes) || !summary.property_locked.notes.some((text) => text.includes('locked layer 2:REDLINE'))) {
      throw new Error(`locked layer note missing: ${JSON.stringify(summary.property_locked)}`);
    }
    if (summary.property_locked.inputs.length !== 0) {
      throw new Error(`property inputs should be blocked while locked: ${JSON.stringify(summary.property_locked.inputs)}`);
    }
    if (!Array.isArray(summary.property_locked?.actions)
      || !summary.property_locked.actions.includes('locate-layer')
      || !summary.property_locked.actions.includes('unlock-layer')) {
      throw new Error(`expected locate/unlock actions while locked: ${JSON.stringify(summary.property_locked)}`);
    }
    if (summary.layer_panel_locked?.focusedLayerId !== 2) {
      throw new Error(`expected layer panel focus on layer 2 while locked: ${JSON.stringify(summary.layer_panel_locked)}`);
    }

    await clickPropertyAction(page, 'locate-layer');
    summary.layer_panel_locked = await readLayerPanelState(page);
    if (summary.layer_panel_locked?.focusedLayerId !== 2) {
      throw new Error(`locate-layer did not keep focus on layer 2: ${JSON.stringify(summary.layer_panel_locked)}`);
    }

    await clickPropertyAction(page, 'unlock-layer');
    await page.waitForFunction(() => {
      const note = document.querySelector('#cad-property-form .cad-readonly-note');
      const color = document.querySelector('#cad-property-form input[name="color"]');
      const unlock = document.querySelector('#cad-property-form [data-property-action="unlock-layer"]');
      return !note && !!color && !unlock;
    }, null, { timeout: 10000 });
    summary.unlocked = await readSelectionDetails(page);
    summary.property_unlocked = await readPropertyFormState(page);
    summary.layer_panel_unlocked = await readLayerPanelState(page);
    if (!summary.property_unlocked?.inputs.includes('color') || !summary.property_unlocked?.inputs.includes('layerId')) {
      throw new Error(`property inputs did not return after unlock: ${JSON.stringify(summary.property_unlocked)}`);
    }
    if (summary.layer_panel_unlocked?.focusedLayerId !== 2) {
      throw new Error(`expected layer panel focus on layer 2 after unlock: ${JSON.stringify(summary.layer_panel_unlocked)}`);
    }

    summary.status = String((await page.textContent('#cad-status-message')) || '').trim();
    await page.screenshot({ path: summary.screenshot, fullPage: true });
    summary.console_messages = consoleMessages;
    summary.page_errors = pageErrors;
    summary.ok = consoleMessages.length === 0 && pageErrors.length === 0;
    if (!summary.ok && consoleMessages.length > 0) {
      throw new Error(`browser console reported ${consoleMessages.length} warning/error messages`);
    }
    if (!summary.ok && pageErrors.length > 0) {
      throw new Error(`browser page reported ${pageErrors.length} errors`);
    }
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.stack || error?.message || error);
    summary.console_messages = consoleMessages;
    summary.page_errors = pageErrors;
    if (!fs.existsSync(summary.screenshot)) {
      try {
        await page.screenshot({ path: summary.screenshot, fullPage: true });
      } catch {}
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    if (serverHandle?.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
    console.log(`run_dir=${runDir}`);
    console.log(`summary_json=${path.join(runDir, 'summary.json')}`);
  }

  return 0;
}

run().then(
  (code) => { process.exitCode = code; },
  (error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  }
);
