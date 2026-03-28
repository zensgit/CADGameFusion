#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'preview_provenance_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_CASES_PATH = path.join(
  repoRoot,
  'tools',
  'web_viewer',
  'tests',
  'fixtures',
  'preview_provenance_smoke_cases.json'
);

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    host: DEFAULT_HOST,
    port: 0,
    serveRoot: repoRoot,
    noServe: false,
    casesPath: DEFAULT_CASES_PATH,
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
    if (token === '--cases' && i + 1 < argv.length) {
      args.casesPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--serve-root' && i + 1 < argv.length) {
      args.serveRoot = argv[i + 1];
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
    'Usage: node tools/web_viewer/scripts/preview_provenance_smoke.js [--cases <json>] [--outdir <dir>] [--base-url <http://127.0.0.1:8080/> | --serve-root <dir> --port <0>]',
    '',
    'Defaults to starting a temporary static file server rooted at deps/cadgamefusion.',
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

function incrementCounter(map, key) {
  const normalized = key && String(key).trim() ? String(key) : 'unknown';
  map[normalized] = (map[normalized] || 0) + 1;
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
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.bin':
      return 'application/octet-stream';
    case '.gltf':
      return 'model/gltf+json';
    case '.wasm':
      return 'application/wasm';
    case '.txt':
    case '.log':
    case '.md':
      return 'text/plain; charset=utf-8';
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
    fs.stat(safePath, (statErr, stats) => {
      if (statErr || !stats || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': lookupMime(safePath),
        'Cache-Control': 'no-store',
      });
      const stream = fs.createReadStream(safePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Read error');
      });
      stream.pipe(res);
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
        port: address.port,
        serveRoot,
      });
    });
  });
}

function buildCaseUrl(baseUrl, query) {
  return new URL(query, baseUrl).toString();
}

function resolveCasesPath(casesPath) {
  if (!casesPath) return DEFAULT_CASES_PATH;
  return path.isAbsolute(casesPath) ? casesPath : path.resolve(process.cwd(), casesPath);
}

function normalizeCase(rawCase, index) {
  const item = rawCase && typeof rawCase === 'object' ? rawCase : {};
  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `case_${index + 1}`;
  const query = typeof item.query === 'string' ? item.query.trim() : '';
  const expectStatus = typeof item.expectStatus === 'string' ? item.expectStatus.trim() : '';
  const expectSelection = Array.isArray(item.expectSelection)
    ? item.expectSelection.map((one) => String(one || '')).filter((one) => one.trim())
    : [];
  const expectError = item.expectError === true;
  if (!query) {
    throw new Error(`Case ${id} is missing query`);
  }
  if (!expectStatus) {
    throw new Error(`Case ${id} is missing expectStatus`);
  }
  const gridCols = Number.isInteger(item.gridCols) && item.gridCols > 1 ? item.gridCols : 12;
  const gridRows = Number.isInteger(item.gridRows) && item.gridRows > 1 ? item.gridRows : 10;
  const initialEntityId = Number.parseInt(String(item.initialEntityId ?? ''), 10);
  const initialGroupId = Number.parseInt(String(item.initialGroupId ?? ''), 10);
  const initialNavKind = typeof item.initialNavKind === 'string' ? item.initialNavKind.trim() : '';
  const rawFocusChecks = Array.isArray(item.focusChecks)
    ? item.focusChecks
    : (item.focusCheck && typeof item.focusCheck === 'object' ? [item.focusCheck] : []);
  const focusChecks = rawFocusChecks.map((rawFocusCheck, focusIndex) => {
    const clickEntityId = Number.parseInt(String(rawFocusCheck.clickEntityId ?? ''), 10);
    const clickGroupId = Number.parseInt(String(rawFocusCheck.clickGroupId ?? ''), 10);
    if (!Number.isFinite(clickEntityId) && !Number.isFinite(clickGroupId)) {
      throw new Error(`Case ${id} must set focusCheck.clickEntityId or focusCheck.clickGroupId at index ${focusIndex}`);
    }
    return {
      clickEntityId: Number.isFinite(clickEntityId) ? clickEntityId : null,
      clickGroupId: Number.isFinite(clickGroupId) ? clickGroupId : null,
      clickNavKind: typeof rawFocusCheck.clickNavKind === 'string' ? rawFocusCheck.clickNavKind.trim() : '',
      expectNavKind: typeof rawFocusCheck.expectNavKind === 'string' ? rawFocusCheck.expectNavKind.trim() : '',
      expectEntityId: Number.isFinite(Number(rawFocusCheck.expectEntityId))
        ? Number.parseInt(String(rawFocusCheck.expectEntityId), 10)
        : (Number.isFinite(clickEntityId) ? clickEntityId : null),
      expectGroupId: Number.isFinite(Number(rawFocusCheck.expectGroupId))
        ? Number.parseInt(String(rawFocusCheck.expectGroupId), 10)
        : null,
      expectTargetType: typeof rawFocusCheck.expectTargetType === 'string' ? rawFocusCheck.expectTargetType.trim() : '',
      expectGroupMemberIds: Array.isArray(rawFocusCheck.expectGroupMemberIds)
        ? rawFocusCheck.expectGroupMemberIds
          .map((one) => Number.parseInt(String(one ?? ''), 10))
          .filter((one) => Number.isFinite(one))
        : [],
      expectSelection: Array.isArray(rawFocusCheck.expectSelection)
        ? rawFocusCheck.expectSelection.map((one) => String(one || '')).filter((one) => one.trim())
        : [],
      requireTargetChange: rawFocusCheck.requireTargetChange === true,
    };
  });
  return {
    id,
    query,
    expectStatus,
    expectSelection,
    expectError,
    gridCols,
    gridRows,
    initialEntityId: Number.isFinite(initialEntityId) ? initialEntityId : null,
    initialGroupId: Number.isFinite(initialGroupId) ? initialGroupId : null,
    initialNavKind,
    focusChecks,
  };
}

function loadCases(casesPath) {
  const resolved = resolveCasesPath(casesPath);
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  const items = Array.isArray(raw) ? raw : (Array.isArray(raw?.cases) ? raw.cases : []);
  if (items.length === 0) {
    throw new Error(`No cases found in ${resolved}`);
  }
  return {
    path: resolved,
    cases: items.map((one, index) => normalizeCase(one, index)),
  };
}

async function waitForLoaded(page, expectedStatus) {
  await page.waitForFunction(
    (statusText) => {
      const value = document.getElementById('status')?.innerText || '';
      return value.includes(statusText);
    },
    expectedStatus,
    { timeout: 25000 }
  );
  await page.waitForTimeout(300);
}

async function getCanvasRect(page) {
  return page.evaluate(() => {
    const rect = document.getElementById('viewport')?.getBoundingClientRect();
    if (!rect) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function getSelectionText(page) {
  return page.evaluate(() => document.getElementById('selection-info')?.innerText || '');
}

async function getStatusText(page) {
  return page.evaluate(() => document.getElementById('status')?.innerText || '');
}

function extractExpectedValue(expectedParts) {
  if (!Array.isArray(expectedParts)) return '';
  for (const part of expectedParts) {
    if (typeof part !== 'string') continue;
    const lines = part.split('\n');
    if (lines.length >= 2 && lines[0].trim() === 'Value' && lines[1].trim()) {
      return lines.slice(1).join('\n').trim();
    }
  }
  return '';
}

async function findSelectionByGrid(page, rect, expectedParts, gridCols = 12, gridRows = 10) {
  if (!rect || !rect.width || !rect.height) return null;
  const cols = Math.max(2, gridCols);
  const rows = Math.max(2, gridRows);
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const x = rect.left + (rect.width * col) / cols;
      const y = rect.top + (rect.height * row) / rows;
      await page.mouse.click(x, y);
      await page.waitForTimeout(80);
      const selection = await getSelectionText(page);
      if (expectedParts.every((part) => selection.includes(part))) {
        return { x, y, selection };
      }
    }
  }
  return null;
}

async function findSelectionByTextLabel(page, rect, expectedParts) {
  const expectedValue = extractExpectedValue(expectedParts);
  if (!expectedValue || !rect) return null;
  await page.waitForFunction(
    (targetValue) => {
      const entries = window.__cadgfPreviewDebug?.getVisibleTextEntries?.() || [];
      return entries.some((entry) => {
        const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
        return value && value.includes(targetValue);
      });
    },
    expectedValue,
    { timeout: 3000 }
  ).catch(() => null);
  const hit = await page.evaluate((targetValue) => {
    const entries = window.__cadgfPreviewDebug?.getVisibleTextEntries?.() || [];
    for (const entry of entries) {
      const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
      if (!value || !value.includes(targetValue)) continue;
      if (![entry.minX, entry.minY, entry.maxX, entry.maxY].every(Number.isFinite)) continue;
      const width = entry.maxX - entry.minX;
      const height = entry.maxY - entry.minY;
      if (!(width > 0) || !(height > 0)) continue;
      return {
        x: entry.minX + width / 2,
        y: entry.minY + height / 2,
        value,
      };
    }
    return null;
  }, expectedValue);
  if (!hit) return null;
  const clickX = rect.left + hit.x;
  const clickY = rect.top + hit.y;
  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(120);
  const selection = await getSelectionText(page);
  if (expectedParts.every((part) => selection.includes(part))) {
    return { x: clickX, y: clickY, selection };
  }
  return null;
}

async function findSelectionByInitialTarget(page, testCase) {
  if (!Number.isFinite(testCase.initialEntityId) && !Number.isFinite(testCase.initialGroupId)) {
    return null;
  }
  const navKind = testCase.initialNavKind
    || (Number.isFinite(testCase.initialGroupId) ? 'initial-group' : 'initial-entity');
  await page.waitForFunction(
    ({ entityId, groupId }) => {
      const debug = window.__cadgfPreviewDebug;
      if (!debug) return false;
      if (Number.isFinite(entityId)) {
        return Boolean(debug.hasEntityId?.(entityId));
      }
      if (Number.isFinite(groupId)) {
        return Boolean(debug.hasGroupId?.(groupId));
      }
      return false;
    },
    {
      entityId: testCase.initialEntityId,
      groupId: testCase.initialGroupId,
    },
    { timeout: 5000 }
  ).catch(() => null);
  const payload = await page.evaluate(({ entityId, groupId, navKind: oneNavKind }) => {
    const debug = window.__cadgfPreviewDebug;
    if (!debug) {
      return { ok: false, reason: 'missing_debug_api', selection: '', focus: null };
    }
    let ok = false;
    if (Number.isFinite(entityId)) {
      ok = Boolean(debug.selectEntityById?.(entityId, oneNavKind));
    } else if (Number.isFinite(groupId)) {
      ok = Boolean(debug.focusGroupById?.(groupId, oneNavKind));
    }
    return {
      ok,
      selection: document.getElementById('selection-info')?.innerText || '',
      focus: debug.getLastFocusState?.() || null,
    };
  }, {
    entityId: testCase.initialEntityId,
    groupId: testCase.initialGroupId,
    navKind,
  });
  await page.waitForTimeout(150);
  const selection = await getSelectionText(page);
  if (!payload?.ok) {
    return {
      kind: 'initial',
      entityId: testCase.initialEntityId,
      groupId: testCase.initialGroupId,
      navKind,
      selection,
      focus: payload?.focus || null,
      reason: payload?.reason || 'initial_selection_failed',
      matched: false,
    };
  }
  const matched = testCase.expectSelection.every((part) => selection.includes(part));
  return {
    kind: 'initial',
    entityId: testCase.initialEntityId,
    groupId: testCase.initialGroupId,
    navKind,
    selection,
    focus: payload?.focus || null,
    matched,
  };
}

function samePoint(a, b) {
  if (!a || !b) return false;
  return ['x', 'y', 'z'].every((key) => Math.abs(Number(a[key] || 0) - Number(b[key] || 0)) < 1e-6);
}

async function runFocusCheck(page, focusCheck) {
  const selector = Number.isFinite(focusCheck.clickGroupId)
    ? (focusCheck.clickNavKind
      ? `#selection-info [data-nav-kind="${focusCheck.clickNavKind}"][data-group-id="${focusCheck.clickGroupId}"]`
      : `#selection-info [data-group-id="${focusCheck.clickGroupId}"]`)
    : (focusCheck.clickNavKind
      ? `#selection-info [data-nav-kind="${focusCheck.clickNavKind}"][data-entity-id="${focusCheck.clickEntityId}"]`
      : `#selection-info [data-entity-id="${focusCheck.clickEntityId}"]`);
  const chip = page.locator(selector).first();
  await chip.click();
  await page.waitForTimeout(150);
  const payload = await page.evaluate(() => ({
    selection: document.getElementById('selection-info')?.innerText || '',
    focus: window.__cadgfPreviewDebug?.getLastFocusState?.() || null,
  }));
  const reasons = [];
  if (!payload.focus || typeof payload.focus !== 'object') {
    reasons.push('missing_focus_state');
  } else {
    if (focusCheck.expectNavKind && payload.focus.navKind !== focusCheck.expectNavKind) {
      reasons.push(`nav_kind:${payload.focus.navKind}`);
    }
    if (focusCheck.expectTargetType && payload.focus.targetType !== focusCheck.expectTargetType) {
      reasons.push(`target_type:${payload.focus.targetType}`);
    }
    if (Number.isFinite(focusCheck.expectEntityId) && Number(payload.focus.entityId) !== focusCheck.expectEntityId) {
      reasons.push(`entity_id:${payload.focus.entityId}`);
    }
    if (Number.isFinite(focusCheck.expectGroupId) && Number(payload.focus.groupId) !== focusCheck.expectGroupId) {
      reasons.push(`group_id:${payload.focus.groupId}`);
    }
    if (focusCheck.expectGroupMemberIds.length > 0) {
      const actualIds = Array.isArray(payload.focus.groupMemberIds)
        ? payload.focus.groupMemberIds.map((one) => Number.parseInt(String(one ?? ''), 10)).filter((one) => Number.isFinite(one))
        : [];
      const expectedIds = [...focusCheck.expectGroupMemberIds].sort((a, b) => a - b);
      const normalizedActualIds = [...actualIds].sort((a, b) => a - b);
      if (expectedIds.length !== normalizedActualIds.length
          || expectedIds.some((value, index) => value !== normalizedActualIds[index])) {
        reasons.push(`group_member_ids:${normalizedActualIds.join(',')}`);
      }
    }
    if (focusCheck.requireTargetChange && samePoint(payload.focus.cameraBefore?.target, payload.focus.cameraAfter?.target)) {
      reasons.push('camera_target_not_changed');
    }
  }
  for (const part of focusCheck.expectSelection) {
    if (!payload.selection.includes(part)) {
      reasons.push(`selection_missing:${part}`);
    }
  }
  return {
    ok: reasons.length === 0,
    clickedEntityId: focusCheck.clickEntityId,
    clickedGroupId: focusCheck.clickGroupId,
    selection: payload.selection,
    focus: payload.focus,
    reasons,
  };
}

async function runCase(page, baseUrl, outdir, testCase) {
  const url = buildCaseUrl(baseUrl, testCase.query);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForLoaded(page, testCase.expectStatus);
  const statusText = await getStatusText(page);
  let hit = null;
  const focusResults = [];
  if (Array.isArray(testCase.expectSelection) && testCase.expectSelection.length > 0) {
    hit = await findSelectionByInitialTarget(page, testCase);
    if (!hit || !hit.matched) {
      const rect = await getCanvasRect(page);
      if (!hit) {
        hit = await findSelectionByGrid(page, rect, testCase.expectSelection, testCase.gridCols, testCase.gridRows);
      }
      if (!hit || !hit.selection || !testCase.expectSelection.every((part) => hit.selection.includes(part))) {
        hit = await findSelectionByTextLabel(page, rect, testCase.expectSelection);
      }
    }
  }
  if (hit && Array.isArray(testCase.focusChecks) && testCase.focusChecks.length > 0) {
    for (const focusCheck of testCase.focusChecks) {
      focusResults.push(await runFocusCheck(page, focusCheck));
    }
  }
  const screenshotPath = path.join(outdir, `${testCase.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const baseOk = testCase.expectSelection.length > 0 ? Boolean(hit) : statusText.includes(testCase.expectStatus);
  const ok = baseOk && focusResults.every((one) => one.ok);
  return {
    id: testCase.id,
    url,
    status: ok ? 'ok' : 'failed',
    expectError: testCase.expectError,
    statusText,
    click: hit
      ? (Number.isFinite(hit.x) && Number.isFinite(hit.y)
        ? { x: Number(hit.x.toFixed(1)), y: Number(hit.y.toFixed(1)) }
        : {
            kind: hit.kind || 'selection',
            entityId: Number.isFinite(hit.entityId) ? hit.entityId : null,
            groupId: Number.isFinite(hit.groupId) ? hit.groupId : null,
            navKind: hit.navKind || '',
          })
      : null,
    selection: hit?.selection || (await getSelectionText(page)),
    expectSelection: testCase.expectSelection,
    focusCheck: focusResults.length === 1 ? focusResults[0] : null,
    focusChecks: focusResults,
    screenshot: screenshotPath,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const outdir = args.outdir && String(args.outdir).trim() ? path.resolve(args.outdir) : DEFAULT_OUTDIR;
  const casesPath = args.casesPath && String(args.casesPath).trim() ? args.casesPath : DEFAULT_CASES_PATH;
  const serveRoot = args.serveRoot && String(args.serveRoot).trim() ? args.serveRoot : repoRoot;
  const runDir = path.join(outdir, nowStamp());
  ensureDir(runDir);
  const loadedCases = loadCases(casesPath);

  let serverHandle = null;
  let baseUrl = args.baseUrl;
  if (!args.noServe) {
    serverHandle = await startStaticServer(serveRoot, args.host, args.port);
    baseUrl = serverHandle.baseUrl;
  }
  if (!baseUrl) {
    throw new Error('Either provide --base-url or allow the built-in static server');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const results = [];
  try {
    for (const testCase of loadedCases.cases) {
      results.push(await runCase(page, baseUrl, runDir, testCase));
    }
  } finally {
    await browser.close();
    if (serverHandle) {
      await new Promise((resolve, reject) => {
        serverHandle.server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    host: args.host,
    port: serverHandle?.port || null,
    serve_root: serverHandle?.serveRoot || null,
    cases_path: loadedCases.path,
    outdir: runDir,
    run_id: path.basename(runDir),
    passed: results.filter((result) => result.status === 'ok').length,
    failed: results.filter((result) => result.status !== 'ok').length,
    entry_kind_counts: results.reduce((acc, result) => {
      incrementCounter(acc, result.click?.kind || 'none');
      return acc;
    }, {}),
    nav_kind_counts: results.reduce((acc, result) => {
      incrementCounter(acc, result.click?.navKind || 'none');
      return acc;
    }, {}),
    initial_entry_case_count: results.filter((result) => result.click?.kind === 'initial').length,
    deterministic_entry_case_count: results.filter((result) => result.click?.kind === 'initial').length,
    focus_check_case_count: results.filter((result) => Array.isArray(result.focusChecks) && result.focusChecks.length > 0).length,
    results,
  };
  const summaryPath = path.join(runDir, 'summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`run_id=${summary.run_id}`);
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${summaryPath}`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
