#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'editor_insert_attribute_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FIXTURE = '/tools/web_viewer/tests/fixtures/editor_insert_attribute_fixture.json';
const GENERATED_HIDDEN_EDITABLE_TAG = 'HIDDEN_EDITABLE_TAG';
const GENERATED_MIXED_EDITABLE_TAG = 'MIXED_EDITABLE_TAG';
const GENERATED_MIXED_CONSTANT_TAG = 'MIXED_CONST_TAG';

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
    'Usage: node tools/web_viewer/scripts/editor_insert_attribute_smoke.js [--fixture /tools/web_viewer/tests/fixtures/editor_insert_attribute_fixture.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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

function resolveFixtureFilePath(fixture) {
  const value = String(fixture || '').trim();
  if (!value) {
    throw new Error('Missing fixture path');
  }
  if (path.isAbsolute(value) && fs.existsSync(value)) {
    return value;
  }
  if (value.startsWith('/')) {
    return path.join(repoRoot, value.slice(1));
  }
  return path.resolve(repoRoot, value);
}

function toFixtureUrlPath(filePath) {
  const relative = path.relative(repoRoot, filePath);
  if (!relative || relative.startsWith('..')) {
    throw new Error(`Fixture must stay under repo root: ${filePath}`);
  }
  return `/${relative.split(path.sep).join('/')}`;
}

function augmentInsertAttributeFixture(sourcePath, outdir) {
  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const entities = Array.isArray(payload?.entities) ? payload.entities : [];
  const meta = payload?.metadata?.meta && typeof payload.metadata.meta === 'object'
    ? payload.metadata.meta
    : {};
  const existingHiddenText = entities.find((entity) => String(entity?.attribute_tag || '').trim() === GENERATED_HIDDEN_EDITABLE_TAG) || null;
  const existingMixedEditableText = entities.find((entity) => String(entity?.attribute_tag || '').trim() === GENERATED_MIXED_EDITABLE_TAG) || null;
  const existingMixedConstantText = entities.find((entity) => String(entity?.attribute_tag || '').trim() === GENERATED_MIXED_CONSTANT_TAG) || null;
  if ((existingMixedEditableText && !existingMixedConstantText) || (!existingMixedEditableText && existingMixedConstantText)) {
    throw new Error('Fixture has partial mixed insert-attribute group state');
  }
  const maxEntityId = entities.reduce((max, entity) => (
    Number.isFinite(entity?.id) ? Math.max(max, Math.trunc(Number(entity.id))) : max
  ), 0);
  const maxGroupId = entities.reduce((max, entity) => (
    Number.isFinite(entity?.group_id) ? Math.max(max, Math.trunc(Number(entity.group_id))) : max
  ), 0);
  let nextEntityId = maxEntityId;
  let nextGroupId = maxGroupId;
  let addedTextEntityCount = 0;
  const nextId = () => {
    nextEntityId += 1;
    return nextEntityId;
  };
  const nextGroup = () => {
    nextGroupId += 1;
    return nextGroupId;
  };
  const generated = {
    hiddenEditable: null,
    mixedInsertAttribute: null,
  };

  if (!existingHiddenText) {
    const textId = nextId();
    const lineId = nextId();
    const groupId = nextGroup();
    entities.push(
      {
        id: textId,
        type: 7,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: groupId,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenEditableBlock',
        text: { pos: [146, 22], h: 2.5, rot: 0, value: 'HIDDEN_EDITABLE_OVERRIDE' },
        text_kind: 'attrib',
        attribute_tag: GENERATED_HIDDEN_EDITABLE_TAG,
        attribute_flags: 1,
        attribute_invisible: true,
        attribute_constant: false,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: false,
      },
      {
        id: lineId,
        type: 2,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: groupId,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'HiddenEditableBlock',
        line: [[136, 18], [156, 18]],
      },
    );
    meta[`dxf.entity.${textId}.attribute_constant`] = '0';
    meta[`dxf.entity.${textId}.attribute_flags`] = '1';
    meta[`dxf.entity.${textId}.attribute_invisible`] = '1';
    meta[`dxf.entity.${textId}.attribute_lock_position`] = '0';
    meta[`dxf.entity.${textId}.attribute_preset`] = '0';
    meta[`dxf.entity.${textId}.attribute_tag`] = GENERATED_HIDDEN_EDITABLE_TAG;
    meta[`dxf.entity.${textId}.attribute_verify`] = '0';
    meta[`dxf.entity.${textId}.block_name`] = 'HiddenEditableBlock';
    meta[`dxf.entity.${textId}.color_source`] = 'BYLAYER';
    meta[`dxf.entity.${textId}.edit_mode`] = 'exploded';
    meta[`dxf.entity.${textId}.proxy_kind`] = 'insert';
    meta[`dxf.entity.${textId}.source_type`] = 'INSERT';
    meta[`dxf.entity.${textId}.space`] = '0';
    meta[`dxf.entity.${textId}.text_kind`] = 'attrib';
    meta[`dxf.entity.${lineId}.block_name`] = 'HiddenEditableBlock';
    meta[`dxf.entity.${lineId}.color_source`] = 'BYLAYER';
    meta[`dxf.entity.${lineId}.edit_mode`] = 'exploded';
    meta[`dxf.entity.${lineId}.proxy_kind`] = 'insert';
    meta[`dxf.entity.${lineId}.source_type`] = 'INSERT';
    meta[`dxf.entity.${lineId}.space`] = '0';
    addedTextEntityCount += 1;
    generated.hiddenEditable = { textId, lineId, groupId };
  } else {
    const groupId = Number.isFinite(existingHiddenText?.group_id) ? Math.trunc(Number(existingHiddenText.group_id)) : null;
    const lineId = entities.find((entity) => entity?.id !== existingHiddenText.id && Number.isFinite(entity?.group_id) && Math.trunc(Number(entity.group_id)) === groupId)?.id ?? null;
    generated.hiddenEditable = {
      textId: existingHiddenText.id,
      lineId,
      groupId,
    };
  }

  if (!existingMixedEditableText && !existingMixedConstantText) {
    const editableTextId = nextId();
    const constantTextId = nextId();
    const lineId = nextId();
    const groupId = nextGroup();
    entities.push(
      {
        id: editableTextId,
        type: 7,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: groupId,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'MixedAttributeBlock',
        text: { pos: [206, 22], h: 2.5, rot: 0, value: 'MIXED_EDITABLE_VALUE' },
        text_kind: 'attrib',
        attribute_tag: GENERATED_MIXED_EDITABLE_TAG,
        attribute_flags: 0,
        attribute_invisible: false,
        attribute_constant: false,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: false,
      },
      {
        id: constantTextId,
        type: 7,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: groupId,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'MixedAttributeBlock',
        text: { pos: [214, 22], h: 2.5, rot: 0, value: 'MIXED_CONST' },
        text_kind: 'attdef',
        attribute_tag: GENERATED_MIXED_CONSTANT_TAG,
        attribute_default: 'MIXED_CONST',
        attribute_prompt: 'MIXED_CONST_PROMPT',
        attribute_flags: 2,
        attribute_invisible: false,
        attribute_constant: true,
        attribute_verify: false,
        attribute_preset: false,
        attribute_lock_position: false,
      },
      {
        id: lineId,
        type: 2,
        layer_id: 0,
        name: '',
        line_type_scale: 1,
        group_id: groupId,
        color_source: 'BYLAYER',
        space: 0,
        source_type: 'INSERT',
        edit_mode: 'exploded',
        proxy_kind: 'insert',
        block_name: 'MixedAttributeBlock',
        line: [[196, 18], [224, 18]],
      },
    );
    meta[`dxf.entity.${editableTextId}.attribute_constant`] = '0';
    meta[`dxf.entity.${editableTextId}.attribute_flags`] = '0';
    meta[`dxf.entity.${editableTextId}.attribute_invisible`] = '0';
    meta[`dxf.entity.${editableTextId}.attribute_lock_position`] = '0';
    meta[`dxf.entity.${editableTextId}.attribute_preset`] = '0';
    meta[`dxf.entity.${editableTextId}.attribute_tag`] = GENERATED_MIXED_EDITABLE_TAG;
    meta[`dxf.entity.${editableTextId}.attribute_verify`] = '0';
    meta[`dxf.entity.${editableTextId}.block_name`] = 'MixedAttributeBlock';
    meta[`dxf.entity.${editableTextId}.color_source`] = 'BYLAYER';
    meta[`dxf.entity.${editableTextId}.edit_mode`] = 'exploded';
    meta[`dxf.entity.${editableTextId}.proxy_kind`] = 'insert';
    meta[`dxf.entity.${editableTextId}.source_type`] = 'INSERT';
    meta[`dxf.entity.${editableTextId}.space`] = '0';
    meta[`dxf.entity.${editableTextId}.text_kind`] = 'attrib';
    meta[`dxf.entity.${constantTextId}.attribute_constant`] = '1';
    meta[`dxf.entity.${constantTextId}.attribute_flags`] = '2';
    meta[`dxf.entity.${constantTextId}.attribute_invisible`] = '0';
    meta[`dxf.entity.${constantTextId}.attribute_lock_position`] = '0';
    meta[`dxf.entity.${constantTextId}.attribute_preset`] = '0';
    meta[`dxf.entity.${constantTextId}.attribute_tag`] = GENERATED_MIXED_CONSTANT_TAG;
    meta[`dxf.entity.${constantTextId}.attribute_verify`] = '0';
    meta[`dxf.entity.${constantTextId}.attribute_prompt`] = 'MIXED_CONST_PROMPT';
    meta[`dxf.entity.${constantTextId}.attribute_default`] = 'MIXED_CONST';
    meta[`dxf.entity.${constantTextId}.block_name`] = 'MixedAttributeBlock';
    meta[`dxf.entity.${constantTextId}.color_source`] = 'BYLAYER';
    meta[`dxf.entity.${constantTextId}.edit_mode`] = 'exploded';
    meta[`dxf.entity.${constantTextId}.proxy_kind`] = 'insert';
    meta[`dxf.entity.${constantTextId}.source_type`] = 'INSERT';
    meta[`dxf.entity.${constantTextId}.space`] = '0';
    meta[`dxf.entity.${constantTextId}.text_kind`] = 'attdef';
    meta[`dxf.entity.${lineId}.block_name`] = 'MixedAttributeBlock';
    meta[`dxf.entity.${lineId}.color_source`] = 'BYLAYER';
    meta[`dxf.entity.${lineId}.edit_mode`] = 'exploded';
    meta[`dxf.entity.${lineId}.proxy_kind`] = 'insert';
    meta[`dxf.entity.${lineId}.source_type`] = 'INSERT';
    meta[`dxf.entity.${lineId}.space`] = '0';
    addedTextEntityCount += 2;
    generated.mixedInsertAttribute = { editableTextId, constantTextId, lineId, groupId };
  } else {
    const groupId = Number.isFinite(existingMixedEditableText?.group_id)
      ? Math.trunc(Number(existingMixedEditableText.group_id))
      : (Number.isFinite(existingMixedConstantText?.group_id) ? Math.trunc(Number(existingMixedConstantText.group_id)) : null);
    const lineId = entities.find((entity) => (
      Number.isFinite(entity?.group_id)
      && Math.trunc(Number(entity.group_id)) === groupId
      && entity?.id !== existingMixedEditableText?.id
      && entity?.id !== existingMixedConstantText?.id
    ))?.id ?? null;
    generated.mixedInsertAttribute = {
      editableTextId: existingMixedEditableText?.id ?? null,
      constantTextId: existingMixedConstantText?.id ?? null,
      lineId,
      groupId,
    };
  }

  payload.entities = entities;
  if (addedTextEntityCount > 0) {
    const emitted = Number.parseInt(String(meta['dxf.text.entities_emitted'] || '0'), 10);
    const seen = Number.parseInt(String(meta['dxf.text.entities_seen'] || '0'), 10);
    meta['dxf.text.entities_emitted'] = String(Number.isFinite(emitted) ? emitted + addedTextEntityCount : addedTextEntityCount);
    meta['dxf.text.entities_seen'] = String(Number.isFinite(seen) ? seen + addedTextEntityCount : addedTextEntityCount);
  }
  if (!payload.metadata || typeof payload.metadata !== 'object') payload.metadata = {};
  payload.metadata.meta = meta;

  const fixturePath = path.join(outdir, 'editor_insert_attribute_fixture.generated.json');
  fs.writeFileSync(fixturePath, `${JSON.stringify(payload, null, 2)}\n`);
  return { fixturePath, fixtureUrlPath: toFixtureUrlPath(fixturePath), generated };
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
  if (!condition) throw new Error(message);
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

async function readVisibleEntityIds(page) {
  return page.evaluate(() => {
    const debug = window.__cadDebug;
    return debug && typeof debug.listVisibleEntityIds === 'function' ? debug.listVisibleEntityIds() : [];
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
        .filter(Boolean),
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
        .filter(Boolean),
    );
    const actions = Array.from(form.querySelectorAll('[data-property-action]'))
      .map((button) => String(button.getAttribute('data-property-action') || '').trim())
      .filter(Boolean);
    const fields = Object.fromEntries(
      Array.from(form.querySelectorAll('input[name]'))
        .map((input) => [String(input.getAttribute('name') || '').trim(), String(input.value || '')])
        .filter(([name]) => !!name),
    );
    const notes = Array.from(form.querySelectorAll('.cad-readonly-note'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
    return { meta, actions, fields, notes };
  });
}

async function clickPropertyAction(page, actionId) {
  const button = page.locator(`#cad-property-form [data-property-action="${actionId}"]`).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
}

async function captureProxyState(page, id) {
  await page.waitForFunction((entityId) => {
    const debug = window.__cadDebug;
    return !!debug
      && typeof debug.getEntity === 'function'
      && !!debug.getEntity(entityId);
  }, id, { timeout: 10000 });
  await setSelection(page, [id], id);
  await page.waitForFunction((entityId) => {
    const debug = window.__cadDebug;
    const root = document.querySelector('#cad-selection-details');
    if (!debug || typeof debug.getEntity !== 'function' || typeof debug.getSelectionIds !== 'function' || !root) return false;
    const entity = debug.getEntity(entityId);
    const ids = debug.getSelectionIds();
    return entity
      && Array.isArray(ids)
      && ids.length === 1
      && ids[0] === entityId
      && String(root.getAttribute('data-mode') || '') === 'single'
      && Number.parseInt(String(root.getAttribute('data-entity-count') || '0'), 10) === 1
      && root.querySelectorAll('[data-selection-field]').length > 0;
  }, id, { timeout: 10000 });
  return {
    selectionIds: await readSelectionIds(page),
    details: await readSelectionDetails(page),
    property: await readPropertyFormState(page),
    entity: (await readEntities(page, [id]))[0],
  };
}

async function waitForAugmentedInsertAttributeFixture(page, {
  hiddenEditableIds,
  mixedInsertAttributeIds,
}) {
  await page.waitForFunction(({
    hiddenEditableTextId,
    mixedEditableTextId,
    mixedConstantTextId,
    hiddenEditableTag,
    mixedEditableTag,
    mixedConstantTag,
  }) => {
    const debug = window.__cadDebug;
    if (!debug || typeof debug.getEntity !== 'function') return false;
    const attrib = debug.getEntity(1);
    const attdef = debug.getEntity(3);
    const hiddenEditable = debug.getEntity(hiddenEditableTextId);
    const mixedEditable = debug.getEntity(mixedEditableTextId);
    const mixedConstant = debug.getEntity(mixedConstantTextId);
    return String(attrib?.value || '') === 'ATTRIB_INSERT_OVERRIDE'
      && String(attrib?.textKind || '') === 'attrib'
      && String(attdef?.value || '') === 'ATTDEF_INSERT_DEFAULT'
      && String(attdef?.textKind || '') === 'attdef'
      && String(hiddenEditable?.attributeTag || '') === hiddenEditableTag
      && String(hiddenEditable?.textKind || '') === 'attrib'
      && String(mixedEditable?.attributeTag || '') === mixedEditableTag
      && String(mixedEditable?.textKind || '') === 'attrib'
      && String(mixedConstant?.attributeTag || '') === mixedConstantTag
      && String(mixedConstant?.textKind || '') === 'attdef';
  }, {
    hiddenEditableTextId: hiddenEditableIds.textId,
    mixedEditableTextId: mixedInsertAttributeIds.editableTextId,
    mixedConstantTextId: mixedInsertAttributeIds.constantTextId,
    hiddenEditableTag: GENERATED_HIDDEN_EDITABLE_TAG,
    mixedEditableTag: GENERATED_MIXED_EDITABLE_TAG,
    mixedConstantTag: GENERATED_MIXED_CONSTANT_TAG,
  }, { timeout: 15000 });
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
  const screenshotPath = path.join(runDir, 'insert_attribute.png');
  const sourceFixturePath = resolveFixtureFilePath(args.fixture || DEFAULT_FIXTURE);
  const generatedFixture = augmentInsertAttributeFixture(sourceFixturePath, runDir);
  const hiddenEditableIds = generatedFixture.generated?.hiddenEditable || {};
  const mixedInsertAttributeIds = generatedFixture.generated?.mixedInsertAttribute || {};

  let serverHandle = null;
  let browser = null;
  let page = null;
  const summary = {
    ok: false,
    fixture: generatedFixture.fixtureUrlPath,
    sourceFixture: args.fixture || DEFAULT_FIXTURE,
  };

  try {
    if (!args.baseUrl) {
      serverHandle = await startStaticServer(repoRoot, args.host, args.port);
    }
    const resolvedBaseUrl = args.baseUrl || serverHandle?.baseUrl;
    ensure(resolvedBaseUrl, 'missing base URL');
    const pageUrl = new URL('tools/web_viewer/index.html', resolvedBaseUrl);
    pageUrl.searchParams.set('mode', 'editor');
    pageUrl.searchParams.set('debug', '1');
    pageUrl.searchParams.set('cadgf', generatedFixture.fixtureUrlPath);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    await page.goto(pageUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.waitForFunction(() => !!window.__cadDebug, null, { timeout: 10000 });
    ensure(Number.isFinite(hiddenEditableIds.textId) && Number.isFinite(hiddenEditableIds.lineId), `missing generated hidden-editable ids: ${JSON.stringify(hiddenEditableIds)}`);
    ensure(
      Number.isFinite(mixedInsertAttributeIds.editableTextId)
        && Number.isFinite(mixedInsertAttributeIds.constantTextId)
        && Number.isFinite(mixedInsertAttributeIds.lineId),
      `missing generated mixed insert-attribute ids: ${JSON.stringify(mixedInsertAttributeIds)}`,
    );
    await waitForAugmentedInsertAttributeFixture(page, {
      hiddenEditableIds,
      mixedInsertAttributeIds,
    });

    summary.before_attrib_edit = await captureProxyState(page, 1);
    ensure(summary.before_attrib_edit?.details?.items?.origin === 'INSERT / text / proxy', `unexpected ATTRIB origin: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.details?.items?.['group-id'] === '1', `unexpected ATTRIB group id: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.details?.items?.['block-name'] === 'AttribBlock', `unexpected ATTRIB block name: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.details?.items?.['attribute-tag'] === 'ATTRIB_TAG', `unexpected ATTRIB tag: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.details?.items?.['attribute-flags'] === '16', `unexpected ATTRIB flags: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.details?.items?.['attribute-modes'] === 'Lock Position', `unexpected ATTRIB modes: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.meta?.['text-kind'] === 'attrib', `unexpected ATTRIB text kind: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.meta?.['attribute-tag'] === 'ATTRIB_TAG', `unexpected ATTRIB property tag: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.meta?.['attribute-flags'] === '16', `unexpected ATTRIB property flags: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.meta?.['attribute-modes'] === 'Lock Position', `unexpected ATTRIB property modes: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.fields?.value === 'ATTRIB_INSERT_OVERRIDE', `missing ATTRIB value field: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_attrib_edit?.property?.fields || {}, 'position.x'), `ATTRIB proxy should not expose position.x: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_attrib_edit?.property?.fields || {}, 'height'), `ATTRIB proxy should not expose height: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(summary.before_attrib_edit?.property?.actions?.includes('select-insert-group'), `ATTRIB proxy missing insert-group action: ${JSON.stringify(summary.before_attrib_edit)}`);
    ensure(
      summary.before_attrib_edit?.property?.notes?.some((note) => note.includes('position stays lock-positioned until release')),
      `missing ATTRIB editability note: ${JSON.stringify(summary.before_attrib_edit)}`,
    );

    const attribValueField = page.locator('#cad-property-form input[name="value"]').first();
    await attribValueField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'ATTRIB_PROXY_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getEntity === 'function'
        && String(debug.getEntity(1)?.value || '') === 'ATTRIB_PROXY_EDITED'
        && String(debug.getEntity(1)?.sourceType || '') === 'INSERT'
        && String(debug.getEntity(1)?.editMode || '') === 'proxy'
        && String(debug.getEntity(1)?.proxyKind || '') === 'text';
    }, null, { timeout: 10000 });
    summary.after_attrib_edit = {
      ...(await captureProxyState(page, 1)),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_attrib_edit?.entity?.value === 'ATTRIB_PROXY_EDITED', `ATTRIB proxy edit did not persist: ${JSON.stringify(summary.after_attrib_edit)}`);

    await clickPropertyAction(page, 'select-insert-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = [...debug.getSelectionIds()].sort((a, b) => a - b);
      return ids.length === 2 && ids[0] === 1 && ids[1] === 4;
    }, null, { timeout: 10000 });
    summary.after_attrib_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      entities: await readEntities(page, [1, 4]),
    };

    summary.before_attdef_edit = await captureProxyState(page, 3);
    ensure(summary.before_attdef_edit?.details?.items?.origin === 'INSERT / text / proxy', `unexpected ATTDEF origin: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['group-id'] === '2', `unexpected ATTDEF group id: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['block-name'] === 'AttdefBlock', `unexpected ATTDEF block name: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['attribute-tag'] === 'ATTDEF_TAG', `unexpected ATTDEF tag: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['attribute-default'] === 'ATTDEF_INSERT_DEFAULT', `unexpected ATTDEF default: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['attribute-prompt'] === 'ATTDEF_PROMPT', `unexpected ATTDEF prompt: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['attribute-flags'] === '12', `unexpected ATTDEF flags: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.details?.items?.['attribute-modes'] === 'Verify / Preset', `unexpected ATTDEF modes: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['text-kind'] === 'attdef', `unexpected ATTDEF text kind: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['attribute-tag'] === 'ATTDEF_TAG', `unexpected ATTDEF property tag: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['attribute-default'] === 'ATTDEF_INSERT_DEFAULT', `unexpected ATTDEF property default: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['attribute-prompt'] === 'ATTDEF_PROMPT', `unexpected ATTDEF property prompt: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['attribute-flags'] === '12', `unexpected ATTDEF property flags: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.meta?.['attribute-modes'] === 'Verify / Preset', `unexpected ATTDEF property modes: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.fields?.value === 'ATTDEF_INSERT_DEFAULT', `unexpected ATTDEF default field: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.fields?.['position.x'] === '26', `ATTDEF proxy should expose position.x when not lock-positioned: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(summary.before_attdef_edit?.property?.fields?.['position.y'] === '12', `ATTDEF proxy should expose position.y when not lock-positioned: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.before_attdef_edit?.property?.fields || {}, 'rotation'), `ATTDEF proxy should not expose rotation: ${JSON.stringify(summary.before_attdef_edit)}`);
    ensure(
      summary.before_attdef_edit?.property?.notes?.some((note) => note.includes('text position stays editable while instance geometry remains proxy-only')),
      `missing ATTDEF position editability note: ${JSON.stringify(summary.before_attdef_edit)}`,
    );

    const attdefValueField = page.locator('#cad-property-form input[name="value"]').first();
    await attdefValueField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'ATTDEF_PROXY_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getEntity === 'function'
        && String(debug.getEntity(3)?.value || '') === 'ATTDEF_PROXY_EDITED'
        && String(debug.getEntity(3)?.sourceType || '') === 'INSERT'
        && String(debug.getEntity(3)?.editMode || '') === 'proxy'
        && String(debug.getEntity(3)?.proxyKind || '') === 'text';
    }, null, { timeout: 10000 });
    summary.after_attdef_edit = {
      ...(await captureProxyState(page, 3)),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_attdef_edit?.entity?.value === 'ATTDEF_PROXY_EDITED', `ATTDEF proxy edit did not persist: ${JSON.stringify(summary.after_attdef_edit)}`);
    ensure(summary.after_attdef_edit?.entity?.attributeDefault === 'ATTDEF_PROXY_EDITED', `ATTDEF default metadata did not sync: ${JSON.stringify(summary.after_attdef_edit)}`);

    const attdefPositionXField = page.locator('#cad-property-form input[name="position.x"]').first();
    await attdefPositionXField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, '29');
    const attdefPositionYField = page.locator('#cad-property-form input[name="position.y"]').first();
    await attdefPositionYField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, '15');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(3) : null;
      return entity
        && Number(entity.position?.x) === 29
        && Number(entity.position?.y) === 15
        && String(entity.sourceType || '') === 'INSERT'
        && String(entity.editMode || '') === 'proxy';
    }, null, { timeout: 10000 });
    summary.after_attdef_position_edit = {
      ...(await captureProxyState(page, 3)),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_attdef_position_edit?.entity?.position?.x === 29, `ATTDEF position.x edit did not persist: ${JSON.stringify(summary.after_attdef_position_edit)}`);
    ensure(summary.after_attdef_position_edit?.entity?.position?.y === 15, `ATTDEF position.y edit did not persist: ${JSON.stringify(summary.after_attdef_position_edit)}`);

    await clickPropertyAction(page, 'select-insert-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = [...debug.getSelectionIds()].sort((a, b) => a - b);
      return ids.length === 2 && ids[0] === 2 && ids[1] === 3;
    }, null, { timeout: 10000 });
    summary.after_attdef_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      entities: await readEntities(page, [2, 3]),
    };

    await setSelection(page, [2], 2);
    await page.fill('#cad-command-input', 'insreledit');
    await page.click('#cad-command-run');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getEntity !== 'function') return false;
      const ids = debug.getSelectionIds();
      const entity = debug.getEntity(3);
      return Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 3
        && entity
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind;
    }, null, { timeout: 10000 });
    summary.after_attdef_release_edit = {
      ...(await captureProxyState(page, 3)),
      statusText: await page.locator('#cad-status-message').textContent(),
      lineEntity: (await readEntities(page, [2]))[0],
    };
    ensure(summary.after_attdef_release_edit?.entity?.sourceType == null, `ATTDEF text should be detached after insreledit: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.position?.x === 29, `ATTDEF released text should keep edited position.x: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.position?.y === 15, `ATTDEF released text should keep edited position.y: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.releasedInsertArchive?.sourceType === 'INSERT', `released ATTDEF text should keep archived insert provenance: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.releasedInsertArchive?.textKind === 'attdef', `released ATTDEF text should keep archived text kind: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.releasedInsertArchive?.attributeTag === 'ATTDEF_TAG', `released ATTDEF text should keep archived attribute tag: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.entity?.releasedInsertArchive?.attributeDefault === 'ATTDEF_PROXY_EDITED', `released ATTDEF text should keep archived edited default text: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-from'] === 'INSERT / text / proxy', `released ATTDEF detail origin mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-block-name'] === 'AttdefBlock', `released ATTDEF detail block mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-text-kind'] === 'attdef', `released ATTDEF detail text kind mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-attribute-tag'] === 'ATTDEF_TAG', `released ATTDEF detail tag mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-attribute-default'] === 'ATTDEF_PROXY_EDITED', `released ATTDEF detail default mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-attribute-prompt'] === 'ATTDEF_PROMPT', `released ATTDEF detail prompt mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.details?.items?.['released-attribute-modes'] === 'Verify / Preset', `released ATTDEF detail modes mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.after_attdef_release_edit?.details?.items || {}, 'attribute-tag'), `released ATTDEF detail should not expose live attribute tag: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.lineEntity?.sourceType === 'INSERT', `ATTDEF companion geometry should stay in insert group: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.fields?.rotation === '0', `released ATTDEF text should expose full text editing fields: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-from'] === 'INSERT / text / proxy', `released ATTDEF property origin mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-block-name'] === 'AttdefBlock', `released ATTDEF property block mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-text-kind'] === 'attdef', `released ATTDEF property text kind mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-attribute-tag'] === 'ATTDEF_TAG', `released ATTDEF property tag mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-attribute-default'] === 'ATTDEF_PROXY_EDITED', `released ATTDEF property default mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-attribute-prompt'] === 'ATTDEF_PROMPT', `released ATTDEF property prompt mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-attribute-modes'] === 'Verify / Preset', `released ATTDEF property modes mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.after_attdef_release_edit?.property?.meta || {}, 'attribute-tag'), `released ATTDEF property should not expose live attribute tag: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.after_attdef_release_edit?.property?.meta || {}, 'text-kind'), `released ATTDEF property should not expose live text kind: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.meta?.['released-group-id'] === '2', `released ATTDEF property group mismatch: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.actions?.includes('select-released-insert-group'), `released ATTDEF text should expose select released insert group: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(summary.after_attdef_release_edit?.property?.actions?.includes('fit-released-insert-group'), `released ATTDEF text should expose fit released insert group: ${JSON.stringify(summary.after_attdef_release_edit)}`);
    ensure(
      summary.after_attdef_release_edit?.property?.notes?.some((note) => note.includes('archived ATTDEF provenance remains visible as read-only context')),
      `released ATTDEF note should explain archived provenance: ${JSON.stringify(summary.after_attdef_release_edit)}`,
    );
    ensure(String(summary.after_attdef_release_edit?.statusText || '').includes('Released insert text to editable geometry'), `unexpected ATTDEF insreledit status: ${JSON.stringify(summary.after_attdef_release_edit)}`);

    const attdefReleasedViewBeforeFit = await readView(page);
    await clickPropertyAction(page, 'fit-released-insert-group');
    summary.after_attdef_fit_released_group = {
      beforeView: attdefReleasedViewBeforeFit,
      view: await readView(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(String(summary.after_attdef_fit_released_group?.statusText || '').includes('Fit Released Insert Group'), `unexpected released ATTDEF fit status: ${JSON.stringify(summary.after_attdef_fit_released_group)}`);
    ensure(!!summary.after_attdef_fit_released_group?.beforeView && !!summary.after_attdef_fit_released_group?.view, `released ATTDEF fit should expose debug view state: ${JSON.stringify(summary.after_attdef_fit_released_group)}`);

    await setSelection(page, [3], 3);
    await clickPropertyAction(page, 'select-released-insert-group');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 2;
    }, null, { timeout: 10000 });
    summary.after_attdef_select_released_group = {
      ...(await captureProxyState(page, 2)),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.after_attdef_select_released_group?.entity?.sourceType === 'INSERT', `released ATTDEF relinsgrp should reselect surviving insert member: ${JSON.stringify(summary.after_attdef_select_released_group)}`);
    ensure(summary.after_attdef_select_released_group?.details?.items?.['block-name'] === 'AttdefBlock', `released ATTDEF relinsgrp block mismatch: ${JSON.stringify(summary.after_attdef_select_released_group)}`);
    ensure(String(summary.after_attdef_select_released_group?.statusText || '').includes('Selected released insert group'), `unexpected released ATTDEF relinsgrp status: ${JSON.stringify(summary.after_attdef_select_released_group)}`);

    summary.visible_ids_before_hidden = await readVisibleEntityIds(page);
    ensure(!summary.visible_ids_before_hidden.includes(5), `hidden constant attribute should not be visible: ${JSON.stringify(summary.visible_ids_before_hidden)}`);
    ensure(summary.visible_ids_before_hidden.includes(6), `driver line should stay visible: ${JSON.stringify(summary.visible_ids_before_hidden)}`);

    await setSelection(page, [6], 6);
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getSelectionIds === 'function'
        && JSON.stringify(debug.getSelectionIds()) === JSON.stringify([6]);
    }, null, { timeout: 10000 });
    summary.before_hidden_const_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.before_hidden_const_group?.property?.actions?.includes('select-insert-text'), `missing Select Insert Text action: ${JSON.stringify(summary.before_hidden_const_group)}`);

    await clickPropertyAction(page, 'select-insert-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === 5;
    }, null, { timeout: 10000 });
    summary.hidden_const_text = {
      ...(await captureProxyState(page, 5)),
      visibleIds: await readVisibleEntityIds(page),
      overlays: await readOverlays(page),
    };
    ensure(summary.hidden_const_text?.details?.items?.['entity-visibility'] === 'Hidden', `hidden const visibility fact mismatch: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(summary.hidden_const_text?.details?.items?.['attribute-modes'] === 'Invisible / Constant', `hidden const modes mismatch: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(summary.hidden_const_text?.property?.meta?.['entity-visibility'] === 'Hidden', `hidden const property visibility mismatch: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(summary.hidden_const_text?.property?.meta?.['attribute-modes'] === 'Invisible / Constant', `hidden const property modes mismatch: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.hidden_const_text?.property?.fields || {}, 'value'), `constant hidden attribute should not expose value field: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(
      summary.hidden_const_text?.property?.notes?.some((note) => note.includes('constant INSERT text proxy')),
      `missing constant hidden note: ${JSON.stringify(summary.hidden_const_text)}`,
    );
    ensure(summary.hidden_const_text?.property?.actions?.includes('edit-insert-text'), `hidden const insert text should expose release-and-edit action: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(!summary.hidden_const_text?.visibleIds?.includes(5), `hidden constant attribute should remain absent from visible ids: ${JSON.stringify(summary.hidden_const_text)}`);
    ensure(summary.hidden_const_text?.overlays?.insertGroupFrame?.groupId === 3, `hidden constant attribute should keep insert-group overlay: ${JSON.stringify(summary.hidden_const_text)}`);

    summary.hidden_const_patch = await page.evaluate(() => {
      const debug = window.__cadDebug;
      return debug && typeof debug.runCommand === 'function'
        ? debug.runCommand('selection.propertyPatch', { patch: { value: 'SHOULD_NOT_EDIT' } })
        : null;
    });
    ensure(summary.hidden_const_patch?.ok === false && summary.hidden_const_patch?.error_code === 'UNSUPPORTED_READ_ONLY', `hidden const patch should fail: ${JSON.stringify(summary.hidden_const_patch)}`);
    summary.hidden_const_after_patch = (await readEntities(page, [5]))[0];
    ensure(summary.hidden_const_after_patch?.value === 'HIDDEN_CONST_DEFAULT', `hidden const value should stay unchanged: ${JSON.stringify(summary.hidden_const_after_patch)}`);

    await clickPropertyAction(page, 'edit-insert-text');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function' || typeof debug.getEntity !== 'function') return false;
      const ids = debug.getSelectionIds();
      const entity = debug.getEntity(5);
      return Array.isArray(ids)
        && ids.length === 1
        && ids[0] === 5
        && entity
        && !entity.sourceType
        && !entity.editMode
        && !entity.proxyKind;
    }, null, { timeout: 10000 });
    summary.hidden_const_after_release_edit = {
      ...(await captureProxyState(page, 5)),
      visibleIds: await readVisibleEntityIds(page),
      overlays: await readOverlays(page),
      lineEntity: (await readEntities(page, [6]))[0],
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.hidden_const_after_release_edit?.entity?.sourceType == null, `hidden const text should be detached after release-edit: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.entity?.releasedInsertArchive?.attributeTag === 'HIDDEN_CONST_TAG', `released hidden const text should keep archived attribute tag: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.entity?.releasedInsertArchive?.attributeConstant === true, `released hidden const text should keep archived constant mode: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.property?.fields?.value === 'HIDDEN_CONST_DEFAULT', `released hidden const text should expose value field: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.property?.fields?.['position.x'] === '106', `released hidden const text should expose position.x: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.property?.fields?.rotation === '0', `released hidden const text should expose rotation: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.details?.items?.['released-from'] === 'INSERT / text / proxy', `released hidden const detail origin mismatch: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.details?.items?.['released-attribute-tag'] === 'HIDDEN_CONST_TAG', `released hidden const detail tag mismatch: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.details?.items?.['released-attribute-modes'] === 'Invisible / Constant', `released hidden const detail modes mismatch: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.property?.meta?.['released-attribute-tag'] === 'HIDDEN_CONST_TAG', `released hidden const property tag mismatch: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.property?.meta?.['released-attribute-modes'] === 'Invisible / Constant', `released hidden const property modes mismatch: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(!Object.prototype.hasOwnProperty.call(summary.hidden_const_after_release_edit?.property?.meta || {}, 'attribute-tag'), `released hidden const property should not expose live attribute tag: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.lineEntity?.sourceType === 'INSERT', `hidden const companion geometry should stay in insert group: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(summary.hidden_const_after_release_edit?.overlays?.insertGroupFrame == null, `released hidden const text should no longer keep insert overlay: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);
    ensure(String(summary.hidden_const_after_release_edit?.statusText || '').includes('Released insert text to editable geometry'), `unexpected hidden const release-edit status: ${JSON.stringify(summary.hidden_const_after_release_edit)}`);

    const hiddenConstReleasedValueField = page.locator('#cad-property-form input[name="value"]').first();
    await hiddenConstReleasedValueField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'HIDDEN_CONST_RELEASED_EDITED');
    await page.waitForFunction(() => {
      const debug = window.__cadDebug;
      const entity = debug && typeof debug.getEntity === 'function' ? debug.getEntity(5) : null;
      return entity
        && String(entity.value || '') === 'HIDDEN_CONST_RELEASED_EDITED'
        && !entity.sourceType;
    }, null, { timeout: 10000 });
    summary.hidden_const_after_detached_edit = {
      ...(await captureProxyState(page, 5)),
      visibleIds: await readVisibleEntityIds(page),
    };
    ensure(summary.hidden_const_after_detached_edit?.entity?.value === 'HIDDEN_CONST_RELEASED_EDITED', `released hidden const text edit did not persist: ${JSON.stringify(summary.hidden_const_after_detached_edit)}`);
    ensure(summary.hidden_const_after_detached_edit?.entity?.releasedInsertArchive?.attributeTag === 'HIDDEN_CONST_TAG', `released hidden const archive should survive detached edits: ${JSON.stringify(summary.hidden_const_after_detached_edit)}`);
    ensure(summary.hidden_const_after_detached_edit?.property?.meta?.['released-attribute-tag'] === 'HIDDEN_CONST_TAG', `released hidden const property archive should survive detached edits: ${JSON.stringify(summary.hidden_const_after_detached_edit)}`);

    summary.visible_ids_before_hidden_editable = await readVisibleEntityIds(page);
    ensure(!summary.visible_ids_before_hidden_editable.includes(hiddenEditableIds.textId), `hidden editable attribute should not be visible: ${JSON.stringify(summary.visible_ids_before_hidden_editable)}`);
    ensure(summary.visible_ids_before_hidden_editable.includes(hiddenEditableIds.lineId), `hidden editable driver should stay visible: ${JSON.stringify(summary.visible_ids_before_hidden_editable)}`);

    await setSelection(page, [hiddenEditableIds.lineId], hiddenEditableIds.lineId);
    await page.waitForFunction((expectedIds) => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getSelectionIds === 'function'
        && JSON.stringify(debug.getSelectionIds()) === JSON.stringify(expectedIds);
    }, [hiddenEditableIds.lineId], { timeout: 10000 });
    summary.before_hidden_editable_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.before_hidden_editable_group?.property?.actions?.includes('select-insert-text'), `missing Select Insert Text action for hidden editable attribute: ${JSON.stringify(summary.before_hidden_editable_group)}`);

    await clickPropertyAction(page, 'select-insert-text');
    await page.waitForFunction((textId) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === textId;
    }, hiddenEditableIds.textId, { timeout: 10000 });
    summary.hidden_editable_text = {
      ...(await captureProxyState(page, hiddenEditableIds.textId)),
      visibleIds: await readVisibleEntityIds(page),
      overlays: await readOverlays(page),
    };
    ensure(summary.hidden_editable_text?.details?.items?.['entity-visibility'] === 'Hidden', `hidden editable visibility fact mismatch: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.details?.items?.['attribute-modes'] === 'Invisible', `hidden editable modes mismatch: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.property?.meta?.['entity-visibility'] === 'Hidden', `hidden editable property visibility mismatch: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.property?.meta?.['attribute-modes'] === 'Invisible', `hidden editable property modes mismatch: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.property?.fields?.value === 'HIDDEN_EDITABLE_OVERRIDE', `hidden editable attribute should expose value: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.property?.fields?.['position.x'] === '146', `hidden editable attribute should expose position.x when not lock-positioned: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.property?.fields?.['position.y'] === '22', `hidden editable attribute should expose position.y when not lock-positioned: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(
      summary.hidden_editable_text?.property?.notes?.some((note) => note.includes('text position stays editable while instance geometry remains proxy-only')),
      `missing hidden editable note: ${JSON.stringify(summary.hidden_editable_text)}`,
    );
    ensure(!summary.hidden_editable_text?.visibleIds?.includes(hiddenEditableIds.textId), `hidden editable attribute should remain absent from visible ids: ${JSON.stringify(summary.hidden_editable_text)}`);
    ensure(summary.hidden_editable_text?.overlays?.insertGroupFrame?.groupId === hiddenEditableIds.groupId, `hidden editable attribute should keep insert-group overlay: ${JSON.stringify(summary.hidden_editable_text)}`);

    const hiddenEditableValueField = page.locator('#cad-property-form input[name="value"]').first();
    await hiddenEditableValueField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'HIDDEN_EDITABLE_PROXY_EDITED');
    await page.waitForFunction((textId) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getEntity !== 'function' || typeof debug.getSelectionIds !== 'function') return false;
      const entity = debug.getEntity(textId);
      const ids = debug.getSelectionIds();
      return entity
        && String(entity.value || '') === 'HIDDEN_EDITABLE_PROXY_EDITED'
        && String(entity.sourceType || '') === 'INSERT'
        && String(entity.editMode || '') === 'proxy'
        && String(entity.proxyKind || '') === 'text'
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === textId;
    }, hiddenEditableIds.textId, { timeout: 10000 });

    const hiddenEditablePositionXField = page.locator('#cad-property-form input[name="position.x"]').first();
    await hiddenEditablePositionXField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, '149');
    const hiddenEditablePositionYField = page.locator('#cad-property-form input[name="position.y"]').first();
    await hiddenEditablePositionYField.evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, '24');
    await page.waitForFunction((textId) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getEntity !== 'function' || typeof debug.getSelectionIds !== 'function') return false;
      const entity = debug.getEntity(textId);
      const ids = debug.getSelectionIds();
      return entity
        && Number(entity.position?.x) === 149
        && Number(entity.position?.y) === 24
        && String(entity.value || '') === 'HIDDEN_EDITABLE_PROXY_EDITED'
        && Array.isArray(ids)
        && ids.length === 1
        && ids[0] === textId;
    }, hiddenEditableIds.textId, { timeout: 10000 });
    summary.hidden_editable_after_edit = {
      ...(await captureProxyState(page, hiddenEditableIds.textId)),
      visibleIds: await readVisibleEntityIds(page),
      overlays: await readOverlays(page),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.hidden_editable_after_edit?.entity?.value === 'HIDDEN_EDITABLE_PROXY_EDITED', `hidden editable proxy edit did not persist: ${JSON.stringify(summary.hidden_editable_after_edit)}`);
    ensure(summary.hidden_editable_after_edit?.entity?.position?.x === 149, `hidden editable proxy position.x did not persist: ${JSON.stringify(summary.hidden_editable_after_edit)}`);
    ensure(summary.hidden_editable_after_edit?.entity?.position?.y === 24, `hidden editable proxy position.y did not persist: ${JSON.stringify(summary.hidden_editable_after_edit)}`);
    ensure(JSON.stringify(summary.hidden_editable_after_edit?.selectionIds || []) === JSON.stringify([hiddenEditableIds.textId]), `hidden editable selection should stay focused after edit: ${JSON.stringify(summary.hidden_editable_after_edit)}`);
    ensure(!summary.hidden_editable_after_edit?.visibleIds?.includes(hiddenEditableIds.textId), `hidden editable attribute should stay hidden after edit: ${JSON.stringify(summary.hidden_editable_after_edit)}`);
    ensure(summary.hidden_editable_after_edit?.overlays?.insertGroupFrame?.groupId === hiddenEditableIds.groupId, `hidden editable attribute should keep insert-group overlay after edit: ${JSON.stringify(summary.hidden_editable_after_edit)}`);

    await setSelection(page, [mixedInsertAttributeIds.lineId], mixedInsertAttributeIds.lineId);
    await page.waitForFunction((expectedIds) => {
      const debug = window.__cadDebug;
      return !!debug
        && typeof debug.getSelectionIds === 'function'
        && JSON.stringify(debug.getSelectionIds()) === JSON.stringify(expectedIds);
    }, [mixedInsertAttributeIds.lineId], { timeout: 10000 });
    summary.before_mixed_editable_group = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(summary.before_mixed_editable_group?.property?.actions?.includes('select-insert-text'), `mixed insert attribute group should expose Select Insert Text: ${JSON.stringify(summary.before_mixed_editable_group)}`);
    ensure(summary.before_mixed_editable_group?.property?.actions?.includes('select-editable-insert-text'), `mixed insert attribute group should expose Select Editable Insert Text: ${JSON.stringify(summary.before_mixed_editable_group)}`);

    await clickPropertyAction(page, 'select-insert-text');
    await page.waitForFunction((expectedIds) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = [...debug.getSelectionIds()].sort((left, right) => left - right);
      const sortedExpectedIds = [...expectedIds].sort((left, right) => left - right);
      return JSON.stringify(ids) === JSON.stringify(sortedExpectedIds);
    }, [mixedInsertAttributeIds.editableTextId, mixedInsertAttributeIds.constantTextId], { timeout: 10000 });
    summary.mixed_after_select_text = {
      selectionIds: await readSelectionIds(page),
      details: await readSelectionDetails(page),
      property: await readPropertyFormState(page),
    };
    ensure(
      JSON.stringify((summary.mixed_after_select_text?.selectionIds || []).sort((left, right) => left - right))
        === JSON.stringify([mixedInsertAttributeIds.editableTextId, mixedInsertAttributeIds.constantTextId].sort((left, right) => left - right)),
      `Select Insert Text should include both mixed text members: ${JSON.stringify(summary.mixed_after_select_text)}`,
    );

    await setSelection(page, [mixedInsertAttributeIds.lineId], mixedInsertAttributeIds.lineId);
    await clickPropertyAction(page, 'select-editable-insert-text');
    await page.waitForFunction((textId) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === textId;
    }, mixedInsertAttributeIds.editableTextId, { timeout: 10000 });
    summary.mixed_after_select_editable_action = {
      ...(await captureProxyState(page, mixedInsertAttributeIds.editableTextId)),
      visibleIds: await readVisibleEntityIds(page),
      overlays: await readOverlays(page),
    };
    ensure(summary.mixed_after_select_editable_action?.details?.items?.['attribute-tag'] === GENERATED_MIXED_EDITABLE_TAG, `mixed editable action should focus editable attribute text: ${JSON.stringify(summary.mixed_after_select_editable_action)}`);
    ensure(summary.mixed_after_select_editable_action?.property?.fields?.value === 'MIXED_EDITABLE_VALUE', `mixed editable action should expose editable value field: ${JSON.stringify(summary.mixed_after_select_editable_action)}`);
    ensure(!summary.mixed_after_select_editable_action?.selectionIds?.includes(mixedInsertAttributeIds.constantTextId), `mixed editable action should skip constant text: ${JSON.stringify(summary.mixed_after_select_editable_action)}`);
    ensure(summary.mixed_after_select_editable_action?.overlays?.insertGroupFrame?.groupId === mixedInsertAttributeIds.groupId, `mixed editable action should keep insert-group overlay: ${JSON.stringify(summary.mixed_after_select_editable_action)}`);

    await setSelection(page, [mixedInsertAttributeIds.lineId], mixedInsertAttributeIds.lineId);
    await page.fill('#cad-command-input', 'instextedit');
    await page.click('#cad-command-run');
    await page.waitForFunction((textId) => {
      const debug = window.__cadDebug;
      if (!debug || typeof debug.getSelectionIds !== 'function') return false;
      const ids = debug.getSelectionIds();
      return Array.isArray(ids) && ids.length === 1 && ids[0] === textId;
    }, mixedInsertAttributeIds.editableTextId, { timeout: 10000 });
    summary.mixed_after_select_editable_command = {
      ...(await captureProxyState(page, mixedInsertAttributeIds.editableTextId)),
      statusText: await page.locator('#cad-status-message').textContent(),
    };
    ensure(summary.mixed_after_select_editable_command?.details?.items?.['attribute-tag'] === GENERATED_MIXED_EDITABLE_TAG, `instextedit should focus editable insert text: ${JSON.stringify(summary.mixed_after_select_editable_command)}`);
    ensure(String(summary.mixed_after_select_editable_command?.statusText || '').includes('Selected editable insert text'), `unexpected instextedit status: ${JSON.stringify(summary.mixed_after_select_editable_command)}`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    summary.screenshot = screenshotPath;
    summary.ok = true;
  } finally {
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (serverHandle?.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  }

  console.log(JSON.stringify({ ok: summary.ok, summaryPath }, null, 2));
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
