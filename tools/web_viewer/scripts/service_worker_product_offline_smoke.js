#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cadgfRoot = path.resolve(__dirname, '..', '..', '..');
const defaultRepoRoot = path.resolve(cadgfRoot, '..', '..');
const DEFAULT_OUTDIR = path.join(cadgfRoot, 'build', 'service_worker_product_offline_smoke');
const DEFAULT_HOST = '127.0.0.1';
const PRODUCT_OFFLINE_MESSAGE_TYPE = 'VEMCAD_CACHE_PRODUCT_OFFLINE_ASSETS';

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
    'Usage: node tools/web_viewer/scripts/service_worker_product_offline_smoke.js [--repo-root <path>] [--outdir <dir>] [--port <0>]',
    '',
    'Generates the product bootstrap import graph, asks the service worker to cache those assets in the product offline cache, then verifies offline fetches.',
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

function startStaticServer({ repoRoot, host, port }) {
  const root = path.resolve(repoRoot);
  const server = http.createServer((req, res) => {
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
      fs.stat(filePath, (fileError, fileStats) => {
        if (fileError || !fileStats?.isFile()) {
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

function readConstantFromServiceWorker(repoRoot, constantName) {
  const swPath = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');
  const match = content.match(new RegExp(`const\\s+${constantName}\\s*=\\s*["']([^"']+)["']`));
  if (!match) {
    throw new Error(`Failed to read ${constantName} from service-worker.js`);
  }
  return match[1];
}

function runImportGraph(repoRoot, outdir) {
  const graphOutdir = path.join(outdir, 'product_bootstrap_import_graph');
  ensureDir(graphOutdir);
  const graphScript = path.join(repoRoot, 'deps', 'cadgamefusion', 'tools', 'web_viewer', 'scripts', 'product_bootstrap_import_graph.js');
  const result = spawnSync(process.execPath, [
    graphScript,
    '--repo-root',
    repoRoot,
    '--outdir',
    graphOutdir,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`product_bootstrap_import_graph.js failed:\n${result.stdout}\n${result.stderr}`);
  }
  const match = String(result.stdout || '').match(/^summary_json=(.+)$/m);
  if (!match) {
    throw new Error(`Failed to read summary_json from product_bootstrap_import_graph.js output:\n${result.stdout}`);
  }
  const summaryPath = match[1].trim();
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  if (!summary.ok || summary.missing?.length) {
    throw new Error(`Product import graph has missing entries: ${summaryPath}`);
  }
  return {
    summaryPath,
    summary,
    stdout: result.stdout,
  };
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

async function waitForController(page) {
  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('service worker controller timeout')), 10000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  });
}

async function postProductOfflineAssets(page, assets) {
  return page.evaluate(async ({ messageType, assetPaths }) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) {
      throw new Error('missing active service worker');
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('product offline cache message timeout')), 30000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type: messageType, assets: assetPaths }, [channel.port2]);
    });
  }, {
    messageType: PRODUCT_OFFLINE_MESSAGE_TYPE,
    assetPaths: assets,
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

  const shellCacheName = readConstantFromServiceWorker(repoRoot, 'CACHE_NAME');
  const productOfflineCacheName = readConstantFromServiceWorker(repoRoot, 'PRODUCT_OFFLINE_CACHE_NAME');
  const graph = runImportGraph(repoRoot, runDir);
  const assetPaths = graph.summary.asset_paths || [];
  const serverHandle = await startStaticServer({
    repoRoot,
    host: args.host,
    port: args.port,
  });

  const summary = {
    ok: false,
    repo_root: repoRoot,
    base_url: serverHandle.baseUrl,
    run_dir: runDir,
    shell_cache_name: shellCacheName,
    product_offline_cache_name: productOfflineCacheName,
    graph_summary_json: graph.summaryPath,
    graph_asset_count: assetPaths.length,
    graph_manifest_version: graph.summary.offline_manifest_version || '',
    graph_asset_manifest_hash: graph.summary.asset_manifest_hash || '',
    cache_reply: null,
    cache_snapshot: null,
    offline_product_fetch_ok: false,
    offline_workspace_fetch_ok: false,
    offline_shell_fetch_ok: false,
    error: '',
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    assert(assetPaths.includes('/apps/web/app.js'), 'graph asset list missing /apps/web/app.js');
    assert(assetPaths.includes('/apps/web/workbench/bootstrap/workspace_bootstrap.js'), 'graph asset list missing workspace bootstrap');
    assert(graph.summary.offline_manifest_version === 'product-offline-manifest-v1', 'graph manifest version mismatch');
    assert(/^[a-f0-9]{64}$/.test(graph.summary.asset_manifest_hash || ''), 'graph asset manifest hash is missing or invalid');

    const viewerUrl = new URL('deps/cadgamefusion/tools/web_viewer/index.html', serverHandle.baseUrl).toString();
    await page.goto(viewerUrl, { waitUntil: 'domcontentloaded' });
    await waitForWorkerReady(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForController(page);

    summary.cache_reply = await postProductOfflineAssets(page, assetPaths);
    assert(summary.cache_reply?.ok, `service worker product offline cache failed: ${summary.cache_reply?.error || 'unknown error'}`);
    assert(summary.cache_reply.cachedCount === assetPaths.length, 'cached product asset count mismatch');

    summary.cache_snapshot = await readCacheSnapshot(page);
    assert(summary.cache_snapshot.keys.includes(shellCacheName), `${shellCacheName} cache was not installed`);
    assert(summary.cache_snapshot.keys.includes(productOfflineCacheName), `${productOfflineCacheName} cache was not installed`);
    const productEntries = summary.cache_snapshot.entries[productOfflineCacheName] || [];
    assert(productEntries.some((url) => url.endsWith('/apps/web/app.js')), 'product cache missing /apps/web/app.js');
    assert(productEntries.some((url) => url.endsWith('/apps/web/workbench/bootstrap/workspace_bootstrap.js')), 'product cache missing workspace bootstrap');
    assert(productEntries.length === assetPaths.length, 'product cache entry count mismatch');

    await context.setOffline(true);
    summary.offline_product_fetch_ok = await page.evaluate(async () => {
      const response = await fetch(new URL('/apps/web/app.js', location.origin).toString(), { cache: 'no-store' });
      return response.ok;
    });
    assert(summary.offline_product_fetch_ok, 'offline fetch for /apps/web/app.js failed');

    summary.offline_workspace_fetch_ok = await page.evaluate(async () => {
      const response = await fetch(new URL('/apps/web/workbench/bootstrap/workspace_bootstrap.js', location.origin).toString(), { cache: 'no-store' });
      return response.ok;
    });
    assert(summary.offline_workspace_fetch_ok, 'offline fetch for workspace bootstrap failed');

    summary.offline_shell_fetch_ok = await page.evaluate(async () => {
      const response = await fetch(new URL('./app.js', location.href).toString(), { cache: 'no-store' });
      return response.ok;
    });
    assert(summary.offline_shell_fetch_ok, 'offline fetch for shell app.js failed');

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
