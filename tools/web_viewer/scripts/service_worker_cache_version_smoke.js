#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cadgfRoot = path.resolve(__dirname, '..', '..', '..');
const defaultRepoRoot = path.resolve(cadgfRoot, '..', '..');
const DEFAULT_OUTDIR = path.join(cadgfRoot, 'build', 'service_worker_cache_version_smoke');
const DEFAULT_HOST = '127.0.0.1';

function parseArgs(argv) {
  const args = {
    repoRoot: defaultRepoRoot,
    outdir: DEFAULT_OUTDIR,
    host: DEFAULT_HOST,
    port: 0,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--repo-root' && i + 1 < argv.length) {
      args.repoRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
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
    'Usage: node tools/web_viewer/scripts/service_worker_cache_version_smoke.js [--repo-root <path>] [--outdir <dir>] [--port <0>]',
    '',
    'Starts a repo-root static server and simulates service-worker cache upgrade from the previous app shell cache to the current one.',
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

function lookupMime(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
    case '.webmanifest':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.ttf':
      return 'font/ttf';
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

function makeServiceWorkerContent(repoRoot, mode) {
  const swPath = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');
  if (mode === 'v1') {
    return content.replace(/cadgf-web-viewer-v\d+/g, 'cadgf-web-viewer-v2');
  }
  return content;
}

function readCurrentCacheName(repoRoot) {
  const swPath = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');
  const match = content.match(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']/);
  if (!match) {
    throw new Error('Failed to read CACHE_NAME from service-worker.js');
  }
  return match[1];
}

function readProductOfflineCacheName(repoRoot) {
  const swPath = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');
  const match = content.match(/const\s+PRODUCT_OFFLINE_CACHE_NAME\s*=\s*["']([^"']+)["']/);
  if (!match) {
    throw new Error('Failed to read PRODUCT_OFFLINE_CACHE_NAME from service-worker.js');
  }
  return match[1];
}

function startStaticServer({ repoRoot, host, port, state }) {
  const root = path.resolve(repoRoot);
  const serviceWorkerRequestPath = '/deps/cadgamefusion/tools/web_viewer/service-worker.js';
  const server = http.createServer((req, res) => {
    const requestPath = (req.url || '/').split('?')[0] || '/';
    if (requestPath === serviceWorkerRequestPath) {
      const body = makeServiceWorkerContent(root, state.mode);
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    const safePath = buildSafePath(root, req.url || '/');
    if (!safePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    fs.stat(safePath, (error, stats) => {
      if (error || !stats) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const filePath = stats.isDirectory() ? path.join(safePath, 'index.html') : safePath;
      if (!stats.isFile() && !stats.isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': lookupMime(filePath),
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve server address'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://${host}:${address.port}/`,
        port: address.port,
      });
    });
  });
}

async function waitForWorkerReady(page) {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('serviceWorker unavailable');
    }
    await navigator.serviceWorker.register('./service-worker.js');
    await navigator.serviceWorker.ready;
  });
}

async function waitForCache(page, expectedName) {
  await page.waitForFunction(
    async (cacheName) => {
      const keys = await caches.keys();
      return keys.includes(cacheName);
    },
    expectedName,
    { timeout: 10000 }
  );
}

async function updateServiceWorker(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('./');
    if (!registration) {
      throw new Error('missing service worker registration');
    }
    const update = registration.update();
    const controllerChange = new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      setTimeout(resolve, 5000);
    });
    await update;
    await controllerChange;
  });
}

async function readCacheSnapshot(page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = {};
    for (const key of keys) {
      const cache = await caches.open(key);
      entries[key] = (await cache.keys()).map((request) => request.url).sort();
    }
    return {
      keys,
      entries,
      controller: navigator.serviceWorker.controller?.scriptURL || '',
    };
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const repoRoot = path.resolve(args.repoRoot);
  const outdir = path.resolve(args.outdir);
  const runDir = path.join(outdir, nowStamp());
  ensureDir(runDir);
  const currentCacheName = readCurrentCacheName(repoRoot);
  const productOfflineCacheName = readProductOfflineCacheName(repoRoot);
  const previousCacheName = 'cadgf-web-viewer-v2';

  const state = { mode: 'v1' };
  const serverHandle = await startStaticServer({
    repoRoot,
    host: args.host,
    port: args.port,
    state,
  });

  const summary = {
    ok: false,
    repo_root: repoRoot,
    base_url: serverHandle.baseUrl,
    run_dir: runDir,
    previous_cache_name: previousCacheName,
    current_cache_name: currentCacheName,
    product_offline_cache_name: productOfflineCacheName,
    first_snapshot: null,
    second_snapshot: null,
    offline_shell_fetch_ok: false,
    offline_product_fetch_failed: false,
    default_product_cache_not_installed: false,
    error: '',
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    const viewerUrl = new URL('deps/cadgamefusion/tools/web_viewer/index.html', serverHandle.baseUrl).toString();
    await page.goto(viewerUrl, { waitUntil: 'domcontentloaded' });
    await waitForWorkerReady(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForCache(page, previousCacheName);
    summary.first_snapshot = await readCacheSnapshot(page);
    assert(summary.first_snapshot.keys.includes(previousCacheName), `${previousCacheName} cache was not installed`);

    state.mode = 'v2';
    await updateServiceWorker(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForCache(page, currentCacheName);
    summary.second_snapshot = await readCacheSnapshot(page);
    assert(!summary.second_snapshot.keys.includes(previousCacheName), `${previousCacheName} cache was not deleted`);
    assert(summary.second_snapshot.keys.includes(currentCacheName), `${currentCacheName} cache was not installed`);
    summary.default_product_cache_not_installed = !summary.second_snapshot.keys.includes(productOfflineCacheName);
    assert(summary.default_product_cache_not_installed, `${productOfflineCacheName} should not be installed by default`);

    const v2Entries = summary.second_snapshot.entries[currentCacheName] || [];
    for (const suffix of [
      '/deps/cadgamefusion/tools/web_viewer/app.js',
      '/deps/cadgamefusion/tools/web_viewer/legacy_app_bootstrap.js',
      '/deps/cadgamefusion/tools/web_viewer/index.html',
      '/deps/cadgamefusion/tools/web_viewer/style.css',
      '/deps/cadgamefusion/tools/web_viewer/manifest.webmanifest',
      '/deps/cadgamefusion/tools/web_viewer/assets/icon.svg',
    ]) {
      assert(v2Entries.some((url) => url.endsWith(suffix)), `v2 cache missing ${suffix}`);
    }
    assert(!v2Entries.some((url) => url.endsWith('/apps/web/app.js')), 'product app was unexpectedly precached by web_viewer service worker');

    await context.setOffline(true);
    summary.offline_shell_fetch_ok = await page.evaluate(async () => {
      const response = await fetch(new URL('./app.js', location.href).toString());
      return response.ok;
    });
    assert(summary.offline_shell_fetch_ok, 'offline fetch for ./app.js failed');

    summary.offline_product_fetch_failed = await page.evaluate(async () => {
      try {
        await fetch(new URL('/apps/web/app.js', location.origin).toString(), { cache: 'no-store' });
        return false;
      } catch {
        return true;
      }
    });
    assert(summary.offline_product_fetch_failed, 'offline product app fetch unexpectedly succeeded');

    summary.ok = true;
  } catch (error) {
    summary.error = String(error?.stack || error?.message || error);
    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await new Promise((resolve) => serverHandle.server.close(resolve));
    const summaryPath = path.join(runDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
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
