#!/usr/bin/env node

// Real-path product-offline smoke.
//
// Unlike service_worker_product_offline_smoke.js -- which manually posts the asset list to the SW via
// page.evaluate() (a bypass that never exercises the HTML-load-of-manifest path) -- this smoke loads
// index.html and lets the REAL bootstrap chain run:
//   committed product-offline-assets.js (a classic <script>) -> sets self.__VEMCAD_PRODUCT_OFFLINE_*
//   -> app.js dual-mode bootstrap -> apps/web bootstrapVemcadWebApp() -> scheduleProductOfflineCaching()
//   -> product_offline_cache.js reads the globals -> postMessage to the service worker -> SW precaches.
// It then asserts the SW product-offline cache is populated WITHOUT any manual post, closing the gap that
// the original smoke left open.
//
// Requires the committed tools/web_viewer/product-offline-assets.js to be present and the assets it lists
// (incl. the vendored three.module.js) to be served, so this is a Playwright smoke that runs where
// playwright + chromium + the vendored assets exist (wired playwright-gated in ci_editor_light.sh).

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cadgfRoot = path.resolve(__dirname, '..', '..', '..');
const defaultRepoRoot = path.resolve(cadgfRoot, '..', '..');
const DEFAULT_OUTDIR = path.join(cadgfRoot, 'build', 'service_worker_product_offline_realpath_smoke');
const DEFAULT_HOST = '127.0.0.1';

function parseArgs(argv) {
  const args = { repoRoot: defaultRepoRoot, outdir: DEFAULT_OUTDIR, host: DEFAULT_HOST, port: 0 };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--repo-root' && i + 1 < argv.length) { args.repoRoot = argv[i + 1]; i += 1; continue; }
    if (token === '--outdir' && i + 1 < argv.length) { args.outdir = argv[i + 1]; i += 1; continue; }
    if (token === '--host' && i + 1 < argv.length) { args.host = argv[i + 1]; i += 1; continue; }
    if (token === '--port' && i + 1 < argv.length) { args.port = Number.parseInt(argv[i + 1], 10) || 0; i += 1; continue; }
    if (token === '--help' || token === '-h') { args.help = true; continue; }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/service_worker_product_offline_realpath_smoke.js [--repo-root <path>] [--outdir <dir>] [--port <0>]',
    '',
    'Loads index.html and verifies the REAL bootstrap chain (committed product-offline-assets.js ->',
    'globals -> product_offline_cache -> service worker) populates the product offline cache with no manual post.',
  ].join('\n');
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function lookupMime(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json':
    case '.webmanifest': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.ttf': return 'font/ttf';
    default: return 'application/octet-stream';
  }
}

function buildSafePath(root, requestPath) {
  const decoded = decodeURIComponent((requestPath || '/').split('?')[0] || '/');
  const suffix = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.resolve(root, `.${suffix}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

function startStaticServer({ repoRoot, host, port }) {
  const root = path.resolve(repoRoot);
  const server = http.createServer((req, res) => {
    const safePath = buildSafePath(root, req.url || '/');
    if (!safePath) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(safePath, (error, stats) => {
      if (error || !stats) { res.writeHead(404); res.end('Not found'); return; }
      const filePath = stats.isDirectory() ? path.join(safePath, 'index.html') : safePath;
      fs.stat(filePath, (fileError, fileStats) => {
        if (fileError || !fileStats?.isFile()) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': lookupMime(filePath), 'Cache-Control': 'no-store' });
        fs.createReadStream(filePath).pipe(res);
      });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') { reject(new Error('Failed to resolve server address')); return; }
      resolve({ server, baseUrl: `http://${host}:${address.port}/`, port: address.port });
    });
  });
}

function readConstantFromServiceWorker(repoRoot, constantName) {
  const swPath = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');
  const match = content.match(new RegExp(`const\\s+${constantName}\\s*=\\s*["']([^"']+)["']`));
  if (!match) throw new Error(`Failed to read ${constantName} from service-worker.js`);
  return match[1];
}

function readCommittedManifestAssetCount(repoRoot) {
  const p = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'product-offline-assets.js');
  if (!fs.existsSync(p)) throw new Error(`committed manifest missing: ${p} (regenerate with product_bootstrap_import_graph.js --assets-out ...)`);
  const content = fs.readFileSync(p, 'utf8');
  const m = content.match(/"assetCount":\s*(\d+)/);
  return m ? Number.parseInt(m[1], 10) : null;
}

async function readCacheSnapshot(page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = {};
    for (const key of keys) {
      const cache = await caches.open(key);
      entries[key] = (await cache.keys()).map((request) => request.url).sort();
    }
    return { keys, entries, controller: navigator.serviceWorker.controller?.scriptURL || '' };
  });
}

function assert(condition, message) { if (!condition) throw new Error(message); }

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(usage()); return 0; }

  const repoRoot = path.resolve(args.repoRoot);
  const outdir = path.resolve(args.outdir);
  const runDir = path.join(outdir, nowStamp());
  ensureDir(runDir);

  const productOfflineCacheName = readConstantFromServiceWorker(repoRoot, 'PRODUCT_OFFLINE_CACHE_NAME');
  const committedAssetCount = readCommittedManifestAssetCount(repoRoot);
  const serverHandle = await startStaticServer({ repoRoot, host: args.host, port: args.port });

  const summary = {
    ok: false,
    repo_root: repoRoot,
    base_url: serverHandle.baseUrl,
    run_dir: runDir,
    product_offline_cache_name: productOfflineCacheName,
    committed_asset_count: committedAssetCount,
    manifest_loaded: false,
    product_offline_state: null,
    cached_count: 0,
    offline_product_fetch_ok: false,
    error: '',
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    const viewerUrl = new URL('deps/cadgamefusion/tools/web_viewer/index.html', serverHandle.baseUrl).toString();

    // First load: the REAL bootstrap chain sets the globals and schedules product offline caching.
    await page.goto(viewerUrl, { waitUntil: 'domcontentloaded' });

    // The committed product-offline-assets.js must have set the manifest global BEFORE app.js ran.
    summary.manifest_loaded = await page.evaluate(() => Boolean(window.__VEMCAD_PRODUCT_OFFLINE_MANIFEST?.assets?.length));
    assert(summary.manifest_loaded, 'product-offline-assets.js did not set __VEMCAD_PRODUCT_OFFLINE_MANIFEST (injection missing?)');

    // Wait for product_offline_cache.js to reach a TERMINAL state (it writes window.__vemcadProductOffline:
    // first {scheduled:true}, then the final {ok, skipped?, assetCount?} once the SW reply settles).
    // Poll from Node rather than page.waitForFunction: the live WebGL preview pegs the page's main thread
    // (GPU-stall warnings), which can starve in-page polling. Up to 90s for the SW to precache all assets.
    for (let i = 0; i < 90; i += 1) {
      const s = await page.evaluate(() => window.__vemcadProductOffline || null);
      if (s && s.scheduled !== true) { summary.product_offline_state = s; break; }
      await page.waitForTimeout(1000);
    }
    assert(summary.product_offline_state,
      'product offline caching never reached a terminal state — the real bootstrap did not run scheduleProductOfflineCaching');

    // The crux: the real path actually cached -- it did NOT no-op with 'no-product-offline-assets',
    // and the SW reply was ok. No manual post was made anywhere in this smoke.
    assert(summary.product_offline_state?.skipped !== true,
      `real bootstrap skipped product offline caching: ${summary.product_offline_state?.reason || 'unknown'}`);
    assert(summary.product_offline_state?.ok === true,
      `real bootstrap product offline caching not ok: ${JSON.stringify(summary.product_offline_state)}`);

    const snapshot = await readCacheSnapshot(page);
    assert(snapshot.keys.includes(productOfflineCacheName), `${productOfflineCacheName} cache was not installed by the real path`);
    const productEntries = snapshot.entries[productOfflineCacheName] || [];
    summary.cached_count = productEntries.length;
    assert(productEntries.some((url) => url.endsWith('/apps/web/app.js')), 'product cache (real path) missing /apps/web/app.js');
    if (typeof committedAssetCount === 'number') {
      assert(productEntries.length === committedAssetCount,
        `product cache entry count ${productEntries.length} != committed manifest assetCount ${committedAssetCount}`);
    }

    // Reload so the SW controls the page, then verify an offline fetch is served from the product cache.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    summary.offline_product_fetch_ok = await page.evaluate(async () => {
      const response = await fetch(new URL('/apps/web/app.js', location.origin).toString(), { cache: 'no-store' });
      return response.ok;
    });
    assert(summary.offline_product_fetch_ok, 'offline fetch for /apps/web/app.js failed (SW not serving real-path cache)');

    summary.ok = true;
  } catch (error) {
    summary.error = String(error?.stack || error?.message || error);
    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await new Promise((resolve) => serverHandle.server.close(resolve));
    const summaryPath = path.join(runDir, 'summary.json');
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(`run_dir=${runDir}`);
    console.log(`summary_json=${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  }

  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  }
);
