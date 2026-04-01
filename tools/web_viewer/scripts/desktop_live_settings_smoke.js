#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { DESKTOP_SETTINGS_STORAGE_KEY } from '../desktop_settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'desktop_live_settings_smoke');
const DEFAULT_HOST = '127.0.0.1';

const MOCK_DEFAULT_SETTINGS = {
  routerUrl: 'http://127.0.0.1:9000',
  routerEmit: 'json,gltf,meta',
  routerPlugin: '/tmp/libcadgf_dxf_importer_plugin.dylib',
  routerConvertCli: '/tmp/convert_cli',
  routerAuthToken: '',
  projectId: 'dwg-desktop-smoke',
  documentLabelPrefix: 'sample_',
  routerAutoStart: 'on',
  routerTimeoutMs: 60000,
  routerStartTimeoutMs: 15000,
  routerStartCmd: 'python3 tools/plm_router_service.py --port 9000',
  dwgRouteMode: 'auto',
  dwgPluginPath: '/tmp/libcadgf_dwg_importer_plugin.dylib',
  dwgConvertCmd: 'python3 /tmp/cadgf_dwg_service.py convert',
  dwgServicePath: '/tmp/cadgf-dwg-service',
  dwg2dxfBin: '/opt/homebrew/bin/dwg2dxf',
  dwgTimeoutMs: 60000,
};

const MOCK_RUNTIME_FACTS = {
  cad_runtime_source: 'packaged-cad-resources',
  cad_runtime_root: '/tmp/vemcad/cad_resources',
  cad_runtime_ready: true,
  router_service_path: '/tmp/vemcad/cad_resources/router/plm_router_service.py',
  plm_convert_path: '/tmp/vemcad/cad_resources/tools/plm_convert.py',
  viewer_root: '/tmp/vemcad/cad_resources/tools/web_viewer',
  dwg_service_path: '/tmp/vemcad/cad_resources/dwg_service/cadgf_dwg_service.py',
};

const MOCK_APP_INFO = {
  app_name: 'VemCAD',
  app_version: '0.1.0-smoke',
  is_packaged: false,
  platform: 'darwin',
  arch: 'arm64',
  electron_version: '29.4.6',
  chrome_version: '122.0.0.0',
  node_version: '24.10.0',
  exe_path: '/tmp/vemcad/VemCAD',
  app_path: '/tmp/vemcad/app',
  user_data_path: '/tmp/vemcad/user-data',
};

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    host: DEFAULT_HOST,
    port: 0,
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
    'Usage: node tools/web_viewer/scripts/desktop_live_settings_smoke.js [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
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
    case '.gltf':
      return 'model/gltf+json; charset=utf-8';
    case '.bin':
      return 'application/octet-stream';
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

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readSettingsForm(page) {
  return page.evaluate(() => ({
    routerUrl: document.querySelector('#settings-router-url')?.value || '',
    routerPlugin: document.querySelector('#settings-router-plugin')?.value || '',
    projectId: document.querySelector('#settings-project-id')?.value || '',
    dwgRouteMode: document.querySelector('#settings-dwg-route-mode')?.value || '',
    dwgPluginPath: document.querySelector('#settings-dwg-plugin')?.value || '',
  }));
}

async function readSettingsStatus(page) {
  return page.evaluate(() => String(document.querySelector('#settings-status')?.textContent || '').trim());
}

async function isModalVisible(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('#settings-modal');
    return Boolean(modal) && !modal.classList.contains('is-hidden');
  });
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const stamp = nowStamp();
  const outdir = path.join(path.resolve(args.outdir), stamp);
  ensureDir(outdir);
  const summaryPath = path.join(outdir, 'summary.json');

  let serverInfo = null;
  let browser = null;
  let page = null;
  const consoleMessages = [];
  const pageErrors = [];
  const threeCdnRequests = [];
  const fontCdnRequests = [];

  const summary = {
    ok: false,
    outdir,
    baseUrl: args.baseUrl || '',
    console_messages: consoleMessages,
    page_errors: pageErrors,
    three_cdn_requests: threeCdnRequests,
    font_cdn_requests: fontCdnRequests,
  };

  try {
    serverInfo = args.noServe
      ? { server: null, baseUrl: args.baseUrl }
      : await startStaticServer(repoRoot, args.host, args.port);
    ensure(serverInfo.baseUrl, 'Missing base URL');
    summary.baseUrl = serverInfo.baseUrl;

    const url = new URL('tools/web_viewer/index.html', serverInfo.baseUrl);
    summary.url = url.toString();

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 980 } });
    await context.addInitScript(({ defaults, storageKey, runtimeFacts, appInfo }) => {
      const own = (settings, key) => Object.prototype.hasOwnProperty.call(settings || {}, key)
        ? settings[key]
        : defaults[key];
      const buildMockRouterStatus = (settings = {}) => {
        const routerUrl = String(own(settings, 'routerUrl') || '').trim();
        const routerPlugin = String(own(settings, 'routerPlugin') || '').trim();
        const routerConvertCli = String(own(settings, 'routerConvertCli') || '').trim();
        const routerAutoStartValue = String(own(settings, 'routerAutoStart') || 'default').trim().toLowerCase();
        const routerAutoStart = routerAutoStartValue === 'off' ? 'off' : 'on';
        const routerStartCmd = String(own(settings, 'routerStartCmd') || '').trim();
        const routerStartSource = routerStartCmd ? 'configured' : '';
        const routerStartReady = Boolean(routerStartCmd);
        if (!routerUrl) {
          return {
            ok: false,
            error: 'Router URL not configured.',
            error_code: 'ROUTER_NOT_CONFIGURED',
            router_url: '',
            router_auto_start: routerAutoStart,
            router_start_ready: routerStartReady,
            router_start_source: routerStartSource,
            router_start_cmd: routerStartCmd,
            router_start_cmd_suggested: '',
            router_plugin: routerPlugin,
            router_convert_cli: routerConvertCli,
            ...runtimeFacts,
            hint: 'Set Router URL in Settings before opening CAD files.',
          };
        }
        return {
          ok: true,
          started: false,
          router_url: routerUrl,
          router_auto_start: routerAutoStart,
          router_start_ready: routerStartReady,
          router_start_source: routerStartSource,
          router_start_cmd: routerStartCmd,
          router_start_cmd_suggested: '',
          router_plugin: routerPlugin,
          router_convert_cli: routerConvertCli,
          ...runtimeFacts,
          health: {
            ok: true,
            router_mode: 'dev',
            default_plugin: routerPlugin,
            default_convert_cli: routerConvertCli,
          },
        };
      };
      const buildMockDwgStatus = (settings = {}) => {
        const routeMode = String(own(settings, 'dwgRouteMode') || 'auto').trim() || 'auto';
        const dwgPluginPath = String(own(settings, 'dwgPluginPath') || '').trim();
        const dwgConvertCmd = String(own(settings, 'dwgConvertCmd') || '').trim();
        const dwg2dxfBin = String(own(settings, 'dwg2dxfBin') || '').trim();
        const directPluginReady = Boolean(dwgPluginPath);
        const localConvertReady = Boolean(dwgConvertCmd);
        let route = '';
        if (routeMode === 'direct-plugin') {
          route = directPluginReady ? 'direct-plugin' : '';
        } else if (routeMode === 'local-convert') {
          route = localConvertReady ? 'local-convert' : '';
        } else {
          route = directPluginReady ? 'direct-plugin' : (localConvertReady ? 'local-convert' : '');
        }
        if (!route) {
          return {
            ok: false,
            error: 'DWG open path not configured. Provide a DWG plugin path or a DWG converter command.',
            error_code: 'DWG_NOT_READY',
            route: '',
            route_mode: routeMode,
            direct_plugin_ready: directPluginReady,
            local_convert_ready: localConvertReady,
            dwg_plugin_path: dwgPluginPath,
            dwg_convert_cmd: dwgConvertCmd,
            dwg2dxf_bin: dwg2dxfBin,
            ...runtimeFacts,
            hint: routeMode === 'direct-plugin'
              ? 'DWG Route Mode is Direct Plugin. Set DWG Plugin Path, or switch route mode back to Auto or Local Convert in Settings.'
              : routeMode === 'local-convert'
                ? 'DWG Route Mode is Local Convert. Set DWG Convert Command, or switch route mode back to Auto or Direct Plugin in Settings.'
                : 'Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.',
          };
        }
        if (route === 'direct-plugin') {
          return {
            ok: true,
            message: dwgConvertCmd
              ? `DWG ready via direct plugin (${dwgPluginPath}) with local converter fallback.`
              : `DWG ready via direct plugin (${dwgPluginPath}).`,
            route: 'direct-plugin',
            route_mode: routeMode,
            direct_plugin_ready: directPluginReady,
            local_convert_ready: localConvertReady,
            dwg_plugin_path: dwgPluginPath,
            dwg_convert_cmd: dwgConvertCmd,
            dwg2dxf_bin: dwg2dxfBin,
            ...runtimeFacts,
          };
        }
        return {
          ok: true,
          message: dwg2dxfBin
            ? `DWG ready via local conversion. dwg2dxf: ${dwg2dxfBin}`
            : 'DWG ready via local conversion.',
          route: 'local-convert',
          route_mode: routeMode,
          direct_plugin_ready: directPluginReady,
          local_convert_ready: localConvertReady,
          dwg_plugin_path: '',
          dwg_convert_cmd: dwgConvertCmd,
          dwg2dxf_bin: dwg2dxfBin,
          ...runtimeFacts,
        };
      };
      window.__desktopSmoke = {
        defaults,
        lastOpenCadSettings: null,
        lastSavedDiagnostics: null,
        openSettingsHandler: null,
        emittedOpenSettingsCount: 0,
        openSettings() {
          if (typeof this.openSettingsHandler === 'function') {
            this.emittedOpenSettingsCount += 1;
            this.openSettingsHandler();
          }
        },
      };
      window.vemcadDesktop = {
        getDefaultSettings: async () => ({ ...defaults }),
        getAppInfo: async () => ({ ...appInfo }),
        testRouter: async (settings = {}) => buildMockRouterStatus(settings),
        testDwg: async (settings = {}) => buildMockDwgStatus(settings),
        openCadFile: async (settings = {}) => {
          window.__desktopSmoke.lastOpenCadSettings = JSON.parse(JSON.stringify(settings));
          const routerStatus = buildMockRouterStatus(settings);
          if (!routerStatus.ok) {
            return routerStatus;
          }
          const dwgStatus = buildMockDwgStatus(settings);
          if (!dwgStatus.ok) {
            return dwgStatus;
          }
          return {
            ok: true,
            route: dwgStatus.route,
            route_mode: dwgStatus.route_mode,
            document_label: 'desktop_live_settings_sample',
            project_id: own(settings, 'projectId') || defaults.projectId,
            dwg_plugin_path: dwgStatus.dwg_plugin_path,
            ...runtimeFacts,
            output_dir: '/tmp/desktop-live-settings-smoke-output',
          };
        },
        exportDxf: async () => ({ ok: false, error: 'not loaded' }),
        saveDiagnostics: async ({ filename = '', text = '' } = {}) => {
          const safeFilename = String(filename || 'vemcad_desktop_diagnostics.json').trim() || 'vemcad_desktop_diagnostics.json';
          const savePath = `/tmp/vemcad/support/${safeFilename}`;
          window.__desktopSmoke.lastSavedDiagnostics = {
            filename: safeFilename,
            path: savePath,
            text: String(text || ''),
          };
          return {
            ok: true,
            path: savePath,
            bytes: String(text || '').length,
            mode: 'mock-native',
          };
        },
        onOpenSettings: (handler) => {
          window.__desktopSmoke.openSettingsHandler = handler;
        },
      };
    }, { defaults: MOCK_DEFAULT_SETTINGS, storageKey: DESKTOP_SETTINGS_STORAGE_KEY, runtimeFacts: MOCK_RUNTIME_FACTS, appInfo: MOCK_APP_INFO });

    page = await context.newPage();
    try {
      await page.evaluate((storageKey) => {
        window.localStorage.removeItem(storageKey);
      }, DESKTOP_SETTINGS_STORAGE_KEY);
    } catch {
      // ignore
    }
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push(String(error?.message || error));
    });
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('unpkg.com/three')) {
        threeCdnRequests.push(url);
      }
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        fontCdnRequests.push(url);
      }
    });

    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#settings-btn:not(.is-hidden)', { timeout: 15000 });
    await page.waitForSelector('#open-cad-btn:not(.is-hidden)', { timeout: 15000 });
    await page.waitForFunction(() => {
      const status = String(document.querySelector('#status')?.textContent || '').trim();
      return status === 'Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.';
    }, null, { timeout: 15000 });

    summary.initial = await page.evaluate(() => ({
      settingsVisible: !document.querySelector('#settings-btn')?.classList.contains('is-hidden'),
      openCadVisible: !document.querySelector('#open-cad-btn')?.classList.contains('is-hidden'),
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      runtimeAssets: window.__cadgfPreviewDebug?.getRuntimeAssets?.() || null,
    }));
    ensure(summary.initial.settingsVisible, 'Expected Settings button to be visible');
    ensure(summary.initial.openCadVisible, 'Expected Open CAD File button to be visible');
    ensure(summary.initial.status === 'Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.', `Expected startup readiness status, got ${summary.initial.status}`);
    ensure(summary.initial.runtimeAssets?.source === 'vendor/three@0.160.0', `Expected local three runtime source, got ${JSON.stringify(summary.initial.runtimeAssets)}`);
    ensure(String(summary.initial.runtimeAssets?.threeModuleUrl || '').includes('/vendor/three/build/three.module.js'), `Expected local three module URL, got ${summary.initial.runtimeAssets?.threeModuleUrl}`);
    ensure(threeCdnRequests.length === 0, `Expected no unpkg three requests, got ${threeCdnRequests.join(', ')}`);
    ensure(fontCdnRequests.length === 0, `Expected no Google Fonts requests, got ${fontCdnRequests.join(', ')}`);

    await page.evaluate(({ storageKey }) => {
      window.localStorage.setItem(storageKey, JSON.stringify({
        routerUrl: '',
        routerStartCmd: '/tmp/bad-router-start.sh',
        projectId: 'stale-startup-override',
        dwgPluginPath: '/tmp/stale-libcadgf_dwg_importer_plugin.dylib',
      }));
    }, { storageKey: DESKTOP_SETTINGS_STORAGE_KEY });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => {
      const status = String(document.querySelector('#status')?.textContent || '').trim();
      return status.startsWith('Startup settings auto-repair applied recommended desktop setup.');
    }, null, { timeout: 30000 });
    await page.waitForFunction(() => {
      const status = String(document.querySelector('#status')?.textContent || '').trim();
      return status.includes('Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.');
    }, null, { timeout: 12000 });

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('[Router]') && text.includes('[DWG]') && text.includes('Route: direct-plugin');
    }, null, { timeout: 10000 });

    summary.after_startup_auto_repair = {
      status: await page.evaluate(() => String(document.querySelector('#status')?.textContent || '').trim()),
      settingsStatus: await readSettingsStatus(page),
      form: await readSettingsForm(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_startup_auto_repair.status.includes('Startup settings auto-repair applied recommended desktop setup.'), `Expected startup-repair status confirmation in main status, got ${summary.after_startup_auto_repair.status}`);
    ensure(summary.after_startup_auto_repair.status.includes('Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.'), `Expected startup status to return ready, got ${summary.after_startup_auto_repair.status}`);
    ensure(summary.after_startup_auto_repair.form.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected auto-repaired startup router URL ${MOCK_DEFAULT_SETTINGS.routerUrl}, got ${summary.after_startup_auto_repair.form.routerUrl}`);
    ensure(summary.after_startup_auto_repair.form.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected auto-repaired startup DWG plugin ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}, got ${summary.after_startup_auto_repair.form.dwgPluginPath}`);
    ensure(summary.after_startup_auto_repair.stored === null, `Expected stale startup overrides to be cleared on auto-repair, got ${summary.after_startup_auto_repair.stored}`);

    await page.click('#settings-cancel');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.click('#open-cad-btn');
    await page.waitForFunction(() => Boolean(window.__desktopSmoke?.lastOpenCadSettings), null, { timeout: 10000 });
    summary.after_startup_auto_repair_open = await page.evaluate(() => ({
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      lastOpenCadSettings: window.__desktopSmoke?.lastOpenCadSettings || null,
    }));
    ensure(summary.after_startup_auto_repair_open.status.startsWith('Opened desktop_live_settings_sample via direct-plugin'), `Expected open status to include direct-plugin after startup auto-repair, got ${summary.after_startup_auto_repair_open.status}`);
    ensure(summary.after_startup_auto_repair_open.lastOpenCadSettings?.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected startup repair to pass repaired router URL to open CAD, got ${summary.after_startup_auto_repair_open.lastOpenCadSettings?.routerUrl}`);
    ensure(summary.after_startup_auto_repair_open.lastOpenCadSettings?.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected startup repair to pass repaired DWG plugin path, got ${summary.after_startup_auto_repair_open.lastOpenCadSettings?.dwgPluginPath}`);

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('[Router]') && text.includes('[DWG]') && text.includes('Route: direct-plugin');
    }, null, { timeout: 10000 });

    summary.after_initial_modal_open = {
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_initial_modal_open.status.includes(`DWG plugin: ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}`), `Expected modal-open DWG status to include detected plugin path, got ${summary.after_initial_modal_open.status}`);
    ensure(summary.after_initial_modal_open.status.includes('CAD runtime source: packaged-cad-resources'), `Expected modal-open status to include packaged runtime source, got ${summary.after_initial_modal_open.status}`);
    ensure(summary.after_initial_modal_open.status.includes('Router service: /tmp/vemcad/cad_resources/router/plm_router_service.py'), `Expected modal-open status to include router service path, got ${summary.after_initial_modal_open.status}`);
    ensure(summary.after_initial_modal_open.status.includes('Viewer root: /tmp/vemcad/cad_resources/tools/web_viewer'), `Expected modal-open status to include viewer root, got ${summary.after_initial_modal_open.status}`);

    await page.click('#settings-export-diagnostics');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Exported desktop diagnostics:');
    }, null, { timeout: 10000 });
    summary.after_export_diagnostics = await page.evaluate(() => ({
      status: String(document.querySelector('#settings-status')?.textContent || '').trim(),
      payload: window.__cadgfPreviewDebug?.getLastDesktopDiagnostics?.() || null,
      exportResult: window.__cadgfPreviewDebug?.getLastDesktopDiagnosticsExportResult?.() || null,
      saved: window.__desktopSmoke?.lastSavedDiagnostics || null,
    }));
    ensure(summary.after_export_diagnostics.payload?.schema === 'vemcad.desktop.diagnostics.v1', `Expected diagnostics schema, got ${JSON.stringify(summary.after_export_diagnostics.payload)}`);
    ensure(summary.after_export_diagnostics.payload?.app?.app_name === 'VemCAD', `Expected app name in diagnostics, got ${JSON.stringify(summary.after_export_diagnostics.payload?.app)}`);
    ensure(summary.after_export_diagnostics.payload?.settings?.effective?.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected effective router URL in diagnostics, got ${summary.after_export_diagnostics.payload?.settings?.effective?.routerUrl}`);
    ensure(summary.after_export_diagnostics.payload?.results?.dwg_result?.route === 'direct-plugin', `Expected DWG route in diagnostics, got ${summary.after_export_diagnostics.payload?.results?.dwg_result?.route}`);
    ensure(summary.after_export_diagnostics.payload?.runtime_assets?.source === 'vendor/three@0.160.0', `Expected runtime assets in diagnostics, got ${JSON.stringify(summary.after_export_diagnostics.payload?.runtime_assets)}`);
    ensure(summary.after_export_diagnostics.exportResult?.mode === 'mock-native', `Expected mock-native export mode, got ${JSON.stringify(summary.after_export_diagnostics.exportResult)}`);
    ensure(summary.after_export_diagnostics.exportResult?.path === summary.after_export_diagnostics.saved?.path, `Expected export path to match saved path, got ${JSON.stringify(summary.after_export_diagnostics)}`);
    ensure(summary.after_export_diagnostics.status.includes(summary.after_export_diagnostics.saved?.path || ''), `Expected export status to include saved path, got ${summary.after_export_diagnostics.status}`);
    ensure(JSON.parse(summary.after_export_diagnostics.saved?.text || '{}')?.schema === 'vemcad.desktop.diagnostics.v1', `Expected saved diagnostics JSON, got ${summary.after_export_diagnostics.saved?.text}`);

    summary.defaults = await readSettingsForm(page);
    ensure(summary.defaults.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected default router URL ${MOCK_DEFAULT_SETTINGS.routerUrl}, got ${summary.defaults.routerUrl}`);
    ensure(summary.defaults.dwgRouteMode === MOCK_DEFAULT_SETTINGS.dwgRouteMode, `Expected default DWG route mode ${MOCK_DEFAULT_SETTINGS.dwgRouteMode}, got ${summary.defaults.dwgRouteMode}`);
    ensure(summary.defaults.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected default DWG plugin ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}, got ${summary.defaults.dwgPluginPath}`);

    await page.fill('#settings-router-url', 'http://127.0.0.1:9011');
    await page.fill('#settings-project-id', 'dwg-ui-smoke');
    await page.fill('#settings-dwg-plugin', '/custom/libcadgf_dwg_importer_plugin.dylib');
    await page.click('#settings-save');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('DWG plugin: /custom/libcadgf_dwg_importer_plugin.dylib');
    }, null, { timeout: 10000 });
    summary.after_save = {
      form: await readSettingsForm(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_save.form.routerUrl === 'http://127.0.0.1:9011', `Expected saved router URL override, got ${summary.after_save.form.routerUrl}`);
    ensure(summary.after_save.form.projectId === 'dwg-ui-smoke', `Expected saved project id, got ${summary.after_save.form.projectId}`);
    ensure(summary.after_save.form.dwgPluginPath === '/custom/libcadgf_dwg_importer_plugin.dylib', `Expected saved DWG plugin override, got ${summary.after_save.form.dwgPluginPath}`);
    ensure(summary.after_save.status.includes('Route: direct-plugin'), `Expected auto-refreshed DWG route after reopen, got ${summary.after_save.status}`);

    await page.click('#settings-recommended');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Applied recommended desktop setup from detected runtime.')
        && text.includes(`DWG plugin: ${window.__desktopSmoke?.defaults?.dwgPluginPath || ''}`);
    }, null, { timeout: 10000 });
    summary.after_recommended = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_recommended.form.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected recommended router URL ${MOCK_DEFAULT_SETTINGS.routerUrl}, got ${summary.after_recommended.form.routerUrl}`);
    ensure(summary.after_recommended.form.projectId === MOCK_DEFAULT_SETTINGS.projectId, `Expected recommended project id ${MOCK_DEFAULT_SETTINGS.projectId}, got ${summary.after_recommended.form.projectId}`);
    ensure(summary.after_recommended.form.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected recommended DWG plugin ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}, got ${summary.after_recommended.form.dwgPluginPath}`);
    ensure(summary.after_recommended.status.includes('Applied recommended desktop setup from detected runtime.'), `Expected recommended setup confirmation, got ${summary.after_recommended.status}`);
    ensure(summary.after_recommended.stored === null, `Expected recommended setup to clear stored overrides, got ${summary.after_recommended.stored}`);

    await page.click('#settings-cancel');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.click('#open-cad-btn');
    await page.waitForFunction(() => Boolean(window.__desktopSmoke?.lastOpenCadSettings), null, { timeout: 10000 });
    summary.after_open_cad = await page.evaluate(() => ({
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      lastOpenCadSettings: window.__desktopSmoke?.lastOpenCadSettings || null,
    }));
    ensure(summary.after_open_cad.status.startsWith('Opened desktop_live_settings_sample via direct-plugin'), `Expected open status to include route, got ${summary.after_open_cad.status}`);
    ensure(summary.after_open_cad.lastOpenCadSettings?.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected open CAD to use recommended router URL, got ${summary.after_open_cad.lastOpenCadSettings?.routerUrl}`);
    ensure(summary.after_open_cad.lastOpenCadSettings?.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected open CAD to use recommended DWG plugin, got ${summary.after_open_cad.lastOpenCadSettings?.dwgPluginPath}`);

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.fill('#settings-router-url', 'http://127.0.0.1:9011');
    await page.fill('#settings-project-id', 'dwg-ui-smoke');
    await page.fill('#settings-dwg-plugin', '/custom/libcadgf_dwg_importer_plugin.dylib');
    await page.click('#settings-test-router');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Router URL: http://127.0.0.1:9011');
    }, null, { timeout: 10000 });
    summary.after_router_test = {
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_router_test.status.includes('Default plugin: /tmp/libcadgf_dxf_importer_plugin.dylib'), `Expected router status to include plugin path, got ${summary.after_router_test.status}`);
    ensure(summary.after_router_test.status.includes('CAD runtime ready: yes'), `Expected router status to include runtime readiness, got ${summary.after_router_test.status}`);

    await page.click('#settings-test-dwg');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Route: direct-plugin');
    }, null, { timeout: 10000 });
    summary.after_dwg_test = {
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_dwg_test.status.includes('DWG plugin: /custom/libcadgf_dwg_importer_plugin.dylib'), `Expected DWG status to include overridden plugin, got ${summary.after_dwg_test.status}`);
    ensure(summary.after_dwg_test.status.includes('DWG service: /tmp/vemcad/cad_resources/dwg_service/cadgf_dwg_service.py'), `Expected DWG status to include bundled DWG service path, got ${summary.after_dwg_test.status}`);

    await page.click('#settings-reset');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes(`DWG plugin: ${window.__desktopSmoke?.defaults?.dwgPluginPath || ''}`);
    }, null, { timeout: 10000 });
    summary.after_reset = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_reset.form.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected reset router URL ${MOCK_DEFAULT_SETTINGS.routerUrl}, got ${summary.after_reset.form.routerUrl}`);
    ensure(summary.after_reset.form.dwgRouteMode === MOCK_DEFAULT_SETTINGS.dwgRouteMode, `Expected reset DWG route mode ${MOCK_DEFAULT_SETTINGS.dwgRouteMode}, got ${summary.after_reset.form.dwgRouteMode}`);
    ensure(summary.after_reset.form.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected reset DWG plugin path ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}, got ${summary.after_reset.form.dwgPluginPath}`);
    ensure(summary.after_reset.status.includes(`DWG plugin: ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}`), `Expected reset to auto-refresh DWG readiness, got ${summary.after_reset.status}`);
    ensure(summary.after_reset.stored === null, `Expected reset to clear local storage, got ${summary.after_reset.stored}`);

    await page.fill('#settings-router-url', '');
    await page.click('#settings-save');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.click('#open-cad-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      const status = String(document.querySelector('#settings-status')?.textContent || '');
      return modal && !modal.classList.contains('is-hidden') && status.includes('Hint: Set Router URL in Settings before opening CAD files.');
    }, null, { timeout: 10000 });
    summary.after_open_cad_router_not_ready = await page.evaluate(() => ({
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      settingsStatus: String(document.querySelector('#settings-status')?.textContent || '').trim(),
      modalVisible: !document.querySelector('#settings-modal')?.classList.contains('is-hidden'),
      lastOpenCadSettings: window.__desktopSmoke?.lastOpenCadSettings || null,
    }));
    ensure(summary.after_open_cad_router_not_ready.status === 'Open CAD failed: Router URL not configured.', `Expected router setup failure to surface in main status, got ${summary.after_open_cad_router_not_ready.status}`);
    ensure(summary.after_open_cad_router_not_ready.modalVisible, 'Expected settings modal to auto-open on router setup failure');
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router URL: n/a'), `Expected router URL missing state to be visible, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router auto start: on'), `Expected effective router auto-start state to be visible, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router start ready: yes'), `Expected router start readiness to remain visible, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router plugin: /tmp/libcadgf_dxf_importer_plugin.dylib'), `Expected router plugin to stay visible, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router convert CLI: /tmp/convert_cli'), `Expected router convert CLI to stay visible, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('CAD runtime source: packaged-cad-resources'), `Expected router failure status to include packaged runtime source, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Hint: Set Router URL in Settings before opening CAD files.'), `Expected router setup hint, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.lastOpenCadSettings?.routerUrl === '', `Expected failed open to use blank router URL override, got ${summary.after_open_cad_router_not_ready.lastOpenCadSettings?.routerUrl}`);

    await page.click('#settings-reset');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes(`DWG plugin: ${window.__desktopSmoke?.defaults?.dwgPluginPath || ''}`);
    }, null, { timeout: 10000 });
    summary.after_router_failure_reset = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_router_failure_reset.form.routerUrl === MOCK_DEFAULT_SETTINGS.routerUrl, `Expected router failure reset URL ${MOCK_DEFAULT_SETTINGS.routerUrl}, got ${summary.after_router_failure_reset.form.routerUrl}`);
    ensure(summary.after_router_failure_reset.stored === null, `Expected router failure reset to clear local storage, got ${summary.after_router_failure_reset.stored}`);

    await page.selectOption('#settings-dwg-route-mode', 'local-convert');
    await page.click('#settings-save');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.click('#open-cad-btn');
    await page.waitForFunction(() => {
      const status = String(document.querySelector('#status')?.textContent || '').trim();
      return status === 'Opened desktop_live_settings_sample via local-convert.';
    }, null, { timeout: 10000 });
    summary.after_open_cad_local_convert = await page.evaluate(() => ({
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      lastOpenCadSettings: window.__desktopSmoke?.lastOpenCadSettings || null,
    }));
    ensure(summary.after_open_cad_local_convert.lastOpenCadSettings?.dwgRouteMode === 'local-convert', `Expected open CAD to use forced local-convert mode, got ${summary.after_open_cad_local_convert.lastOpenCadSettings?.dwgRouteMode}`);

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      const status = String(document.querySelector('#settings-status')?.textContent || '');
      return modal && !modal.classList.contains('is-hidden') && status.includes('Route mode: local-convert');
    }, null, { timeout: 10000 });
    summary.after_route_mode_local_convert = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_route_mode_local_convert.form.dwgRouteMode === 'local-convert', `Expected reopened route mode to stay local-convert, got ${summary.after_route_mode_local_convert.form.dwgRouteMode}`);
    ensure(summary.after_route_mode_local_convert.status.includes('Route: local-convert'), `Expected local-convert route status, got ${summary.after_route_mode_local_convert.status}`);

    await page.fill('#settings-dwg-convert-cmd', '');
    await page.click('#settings-save');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    await page.click('#open-cad-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      const status = String(document.querySelector('#settings-status')?.textContent || '');
      return modal && !modal.classList.contains('is-hidden') && status.includes('Hint: DWG Route Mode is Local Convert.');
    }, null, { timeout: 10000 });
    summary.after_open_cad_not_ready = await page.evaluate(() => ({
      status: String(document.querySelector('#status')?.textContent || '').trim(),
      settingsStatus: String(document.querySelector('#settings-status')?.textContent || '').trim(),
      modalVisible: !document.querySelector('#settings-modal')?.classList.contains('is-hidden'),
      lastOpenCadSettings: window.__desktopSmoke?.lastOpenCadSettings || null,
    }));
    ensure(summary.after_open_cad_not_ready.status === 'Open CAD failed: DWG open path not configured. Provide a DWG plugin path or a DWG converter command.', `Expected route setup failure to surface in main status, got ${summary.after_open_cad_not_ready.status}`);
    ensure(summary.after_open_cad_not_ready.modalVisible, 'Expected settings modal to auto-open on DWG route setup failure');
    ensure(summary.after_open_cad_not_ready.settingsStatus.includes('Route mode: local-convert'), `Expected forced local-convert mode to stay visible, got ${summary.after_open_cad_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_not_ready.settingsStatus.includes('Direct plugin ready: yes'), `Expected direct-plugin readiness to remain visible, got ${summary.after_open_cad_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_not_ready.settingsStatus.includes('Local convert ready: no'), `Expected missing local-convert readiness to be visible, got ${summary.after_open_cad_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_not_ready.settingsStatus.includes('Hint: DWG Route Mode is Local Convert. Set DWG Convert Command, or switch route mode back to Auto or Direct Plugin in Settings.'), `Expected settings modal to show route-mode-specific setup hint, got ${summary.after_open_cad_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_not_ready.settingsStatus.includes('CAD runtime source: packaged-cad-resources'), `Expected DWG failure status to include packaged runtime source, got ${summary.after_open_cad_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_not_ready.lastOpenCadSettings?.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected failed open to keep DWG plugin override while local-convert is forced, got ${summary.after_open_cad_not_ready.lastOpenCadSettings?.dwgPluginPath}`);
    ensure(summary.after_open_cad_not_ready.lastOpenCadSettings?.dwgConvertCmd === '', `Expected failed open to use blank DWG convert override, got ${summary.after_open_cad_not_ready.lastOpenCadSettings?.dwgConvertCmd}`);

    await page.click('#settings-reset');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes(`DWG plugin: ${window.__desktopSmoke?.defaults?.dwgPluginPath || ''}`);
    }, null, { timeout: 10000 });
    summary.after_failure_reset = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_failure_reset.form.dwgRouteMode === MOCK_DEFAULT_SETTINGS.dwgRouteMode, `Expected failure reset DWG route mode ${MOCK_DEFAULT_SETTINGS.dwgRouteMode}, got ${summary.after_failure_reset.form.dwgRouteMode}`);
    ensure(summary.after_failure_reset.form.dwgPluginPath === MOCK_DEFAULT_SETTINGS.dwgPluginPath, `Expected failure reset DWG plugin path ${MOCK_DEFAULT_SETTINGS.dwgPluginPath}, got ${summary.after_failure_reset.form.dwgPluginPath}`);
    ensure(summary.after_failure_reset.stored === null, `Expected failure reset to clear local storage, got ${summary.after_failure_reset.stored}`);

    await page.click('#settings-close');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.evaluate(() => window.__desktopSmoke?.openSettings());
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    summary.after_menu_open = await page.evaluate(() => ({
      modalVisible: !document.querySelector('#settings-modal')?.classList.contains('is-hidden'),
      emittedOpenSettingsCount: window.__desktopSmoke?.emittedOpenSettingsCount || 0,
    }));
    ensure(summary.after_menu_open.modalVisible, 'Expected settings modal to reopen through onOpenSettings handler');
    ensure(summary.after_menu_open.emittedOpenSettingsCount === 1, `Expected one synthetic onOpenSettings event, got ${summary.after_menu_open.emittedOpenSettingsCount}`);

    await browser.close();
    browser = null;

    summary.ok = true;
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.message || error);
    if (error && typeof error === 'object' && 'stack' in error) {
      summary.error_stack = error.stack;
    }
    if (page) {
      try {
        summary.last_known_status = await page.evaluate(() => ({
          status: String(document.querySelector('#status')?.textContent || '').trim(),
          settingsStatus: String(document.querySelector('#settings-status')?.textContent || '').trim(),
          modalHidden: Boolean(document.querySelector('#settings-modal')?.classList.contains('is-hidden')),
          routeMode: document.querySelector('#settings-dwg-route-mode')?.value || null,
          routerUrl: document.querySelector('#settings-router-url')?.value || null,
        }));
      } catch (readError) {
        summary.last_known_status_error = String(readError?.message || readError);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
      browser = null;
    }
  } finally {
    if (serverInfo?.server) {
      await new Promise((resolve) => serverInfo.server.close(resolve));
    }
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log(`summary_json=${summaryPath}`);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
