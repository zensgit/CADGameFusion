#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DESKTOP_SETTINGS_STORAGE_KEY } from '../desktop_settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const desktopDir = path.join(repoRoot, 'tools', 'web_viewer_desktop');
const requireFromDesktop = createRequire(path.join(desktopDir, 'package.json'));
const { _electron: electron } = requireFromDesktop('playwright');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'desktop_packaged_settings_smoke');
const READY_STATUS_PREFIX = 'Desktop ready via direct-plugin from packaged-cad-resources.';
const READY_STATUS_SUFFIX = 'Open CAD File or Settings.';
const AUTO_REPAIR_MARKER = 'Startup settings auto-repair applied recommended desktop setup.';
const BAD_ROUTER_URL = 'http://127.0.0.1:1';
const BAD_ROUTER_START_CMD = '/tmp/bad-router-start.sh';
const DEFAULT_SAMPLE_CANDIDATES = [
  '/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg',
  '/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg',
];

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    packIfNeeded: false,
    app: '',
    inputDwg: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--app' && i + 1 < argv.length) {
      args.app = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--input-dwg' && i + 1 < argv.length) {
      args.inputDwg = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--pack-if-needed') {
      args.packIfNeeded = true;
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
    'Usage: node tools/web_viewer/scripts/desktop_packaged_settings_smoke.js [--outdir <dir>] [--app <path>] [--input-dwg <path>] [--pack-if-needed]',
    '',
    'Launches the real packaged VemCAD desktop app and verifies Settings and Open CAD File render packaged runtime diagnostics.',
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

function findPackagedAppBinary(baseDir) {
  const distDir = path.join(baseDir, 'dist');
  const candidates = [];
  const pushGlobMatches = (subpath) => {
    const full = path.join(distDir, subpath);
    if (fs.existsSync(full)) {
      candidates.push(full);
    }
  };
  pushGlobMatches('mac-arm64/VemCAD.app/Contents/MacOS/VemCAD');
  pushGlobMatches('VemCAD.app/Contents/MacOS/VemCAD');
  pushGlobMatches('win-unpacked/VemCAD.exe');
  pushGlobMatches('linux-unpacked/VemCAD');
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function ensurePackagedApp(appPath, packIfNeeded) {
  if (appPath && fs.existsSync(appPath)) {
    return path.resolve(appPath);
  }
  const detected = findPackagedAppBinary(desktopDir);
  if (detected) {
    return path.resolve(detected);
  }
  if (!packIfNeeded) {
    throw new Error('Packaged desktop app not found. Pass --pack-if-needed or --app.');
  }
  const result = spawnSync('npm', ['run', 'pack'], {
    cwd: desktopDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`npm run pack failed:\n${result.stdout || ''}${result.stderr || ''}`);
  }
  const packaged = findPackagedAppBinary(desktopDir);
  if (!packaged) {
    throw new Error('Packaged desktop app not found after `npm run pack`.');
  }
  return path.resolve(packaged);
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate free port')));
        return;
      }
      const { port } = address;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return '';
}

function findInputDwg(inputDwg) {
  const resolved = firstExisting(inputDwg ? [inputDwg] : DEFAULT_SAMPLE_CANDIDATES);
  if (!resolved) {
    throw new Error(`Input DWG not found. Checked: ${(inputDwg ? [inputDwg] : DEFAULT_SAMPLE_CANDIDATES).join(', ')}`);
  }
  return resolved;
}

async function readSettingsForm(page) {
  return page.evaluate(() => ({
    routerUrl: document.querySelector('#settings-router-url')?.value || '',
    routerStartCmd: document.querySelector('#settings-router-start-cmd')?.value || '',
    dwgPluginPath: document.querySelector('#settings-dwg-plugin')?.value || '',
    dwg2dxfBin: document.querySelector('#settings-dwg2dxf-bin')?.value || '',
    dwgRouteMode: document.querySelector('#settings-dwg-route-mode')?.value || '',
  }));
}

async function readSettingsStatus(page) {
  return page.evaluate(() => String(document.querySelector('#settings-status')?.textContent || '').trim());
}

async function readMainStatus(page) {
  return page.evaluate(() => String(document.querySelector('#status')?.textContent || '').trim());
}

async function waitForStatusReady(page, timeoutMs = 30000) {
  await page.waitForFunction((expected) => {
    const [prefix, suffix] = expected || [];
    const text = String(document.querySelector('#status')?.textContent || '').trim();
    return text.includes(String(prefix)) && text.includes(String(suffix));
  }, [READY_STATUS_PREFIX, READY_STATUS_SUFFIX], { timeout: timeoutMs });
}

async function waitForOpenCadSuccess(page, timeoutMs = 60000) {
  await page.waitForFunction(() => {
    const text = String(document.querySelector('#status')?.textContent || '').trim();
    return text.startsWith('Opened ') && text.includes(' via direct-plugin');
  }, null, { timeout: timeoutMs });
}

async function waitForStartupRepairOutcome(page, timeoutMs = 45000) {
  await page.waitForFunction(({ storageKey, readyPrefix, readySuffix }) => {
    const text = String(document.querySelector('#status')?.textContent || '').trim();
    const stored = window.localStorage.getItem(storageKey);
    return text.includes(String(readyPrefix))
      && text.includes(String(readySuffix))
      && stored === null;
  }, {
    storageKey: DESKTOP_SETTINGS_STORAGE_KEY,
    readyPrefix: READY_STATUS_PREFIX,
    readySuffix: READY_STATUS_SUFFIX,
  }, { timeout: timeoutMs });
}

async function waitForPackagedUi(page, timeoutMs = 30000) {
  await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const isVisible = (selector) => {
      const el = document.querySelector(selector);
      if (!el || el.classList.contains('is-hidden')) {
        return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return Boolean(window.vemcadDesktop)
      && Boolean(document.querySelector('#status'))
      && isVisible('#settings-btn')
      && isVisible('#open-cad-btn');
  }, null, { timeout: timeoutMs });
}

async function readDebugState(page) {
  return page.evaluate((storageKey) => ({
    status: String(document.querySelector('#status')?.textContent || '').trim(),
    settingsStatus: String(document.querySelector('#settings-status')?.textContent || '').trim(),
    settingsModalVisible: !document.querySelector('#settings-modal')?.classList.contains('is-hidden'),
    settingsButtonVisible: Boolean((() => {
      const button = document.querySelector('#settings-btn');
      if (!button || button.classList.contains('is-hidden')) {
        return false;
      }
      const style = window.getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    })()),
    openCadButtonVisible: Boolean((() => {
      const button = document.querySelector('#open-cad-btn');
      if (!button || button.classList.contains('is-hidden')) {
        return false;
      }
      const style = window.getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    })()),
    routerUrlField: document.querySelector('#settings-router-url')?.value || null,
    routeMode: document.querySelector('#settings-dwg-route-mode')?.value || null,
    stored: window.localStorage.getItem(storageKey),
    hasDesktopBridge: Boolean(window.vemcadDesktop),
    desktopBridgeKeys: window.vemcadDesktop ? Object.keys(window.vemcadDesktop) : [],
    location: window.location.href,
  }), DESKTOP_SETTINGS_STORAGE_KEY);
}

async function closeAppInstance(instance) {
  if (!instance) {
    return;
  }
  try {
    await instance.close();
  } catch {
    // ignore close failures and continue cleanup
  }
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const outdir = path.join(path.resolve(args.outdir), nowStamp());
  ensureDir(outdir);
  const summaryPath = path.join(outdir, 'summary.json');
  const consoleMessages = [];
  const pageErrors = [];
  const threeCdnRequests = [];
  const fontCdnRequests = [];
  const summary = {
    ok: false,
    outdir,
    console_messages: consoleMessages,
    page_errors: pageErrors,
    three_cdn_requests: threeCdnRequests,
    font_cdn_requests: fontCdnRequests,
  };

  let electronApp = null;
  let page = null;

  try {
    const appBinary = ensurePackagedApp(args.app, args.packIfNeeded);
    const inputDwg = findInputDwg(args.inputDwg);
    const routerPort = await findFreePort();
    const routerUrl = `http://127.0.0.1:${routerPort}`;
    const exportDir = path.join(outdir, 'exported_diagnostics');
    const smokeHome = path.join(outdir, 'smoke_home');
    const userDataDir = path.join(smokeHome, 'user-data');
    ensureDir(exportDir);
    ensureDir(userDataDir);
    summary.app = appBinary;
    summary.input_dwg = inputDwg;
    summary.router_url = routerUrl;
    summary.export_dir = exportDir;
    summary.smoke_home = smokeHome;
    summary.user_data_dir = userDataDir;
    const resourcesDir = path.join(path.dirname(path.dirname(appBinary)), 'Resources');
    const packagedCadRoot = path.join(resourcesDir, 'cad_resources');
    const expectedPackagedDwg2dxf = path.join(packagedCadRoot, 'dwg_service', 'bin', process.platform === 'win32' ? 'dwg2dxf.exe' : 'dwg2dxf');
    summary.packaged_cad_root = packagedCadRoot;
    summary.expected_packaged_dwg2dxf = expectedPackagedDwg2dxf;

    const launchWindow = async () => {
      const launchedApp = await electron.launch({
        executablePath: appBinary,
        args: [`--user-data-dir=${userDataDir}`],
        env: {
          ...process.env,
          HOME: smokeHome,
          VEMCAD_ROUTER_URL: routerUrl,
          VEMCAD_DESKTOP_EXPORT_DIR: exportDir,
          VEMCAD_SMOKE_OPEN_FILE_PATH: inputDwg,
        },
      });
      const launchedPage = await launchedApp.firstWindow();
      launchedPage.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      launchedPage.on('pageerror', (error) => {
        pageErrors.push(String(error?.message || error));
      });
      launchedPage.on('request', (request) => {
        const url = request.url();
        if (url.includes('unpkg.com/three')) {
          threeCdnRequests.push(url);
        }
        if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
          fontCdnRequests.push(url);
        }
      });
      return { app: launchedApp, page: launchedPage };
    };

    ({ app: electronApp, page } = await launchWindow());

    await waitForPackagedUi(page);
    await waitForStatusReady(page);
    summary.initial = {
      status: await readMainStatus(page),
      runtime_assets: await page.evaluate(() => window.__cadgfPreviewDebug?.getRuntimeAssets?.() || null),
    };
    ensure(summary.initial.runtime_assets?.source === 'vendor/three@0.160.0', `Expected local three runtime source, got ${JSON.stringify(summary.initial.runtime_assets)}`);
    ensure(String(summary.initial.runtime_assets?.threeModuleUrl || '').includes('/vendor/three/build/three.module.js'), `Expected local three module URL, got ${summary.initial.runtime_assets?.threeModuleUrl}`);
    ensure(threeCdnRequests.length === 0, `Expected no unpkg three requests, got ${threeCdnRequests.join(', ')}`);
    ensure(fontCdnRequests.length === 0, `Expected no Google Fonts requests, got ${fontCdnRequests.join(', ')}`);

    summary.injected_startup_override = await page.evaluate(({ storageKey, badRouterUrl }) => {
      const raw = JSON.stringify({
        routerUrl: badRouterUrl,
        routerAutoStart: 'off',
        dwgRouteMode: 'auto',
        projectId: 'packaged-auto-repair',
      });
      window.localStorage.setItem(storageKey, raw);
      return {
        stored: window.localStorage.getItem(storageKey),
      };
    }, {
      storageKey: DESKTOP_SETTINGS_STORAGE_KEY,
      badRouterUrl: BAD_ROUTER_URL,
    });
    ensure(summary.injected_startup_override.stored?.includes(BAD_ROUTER_URL), `Expected injected override to include bad router URL ${BAD_ROUTER_URL}, got ${summary.injected_startup_override.stored}`);
    await page.waitForTimeout(500);
    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;
    ({ app: electronApp, page } = await launchWindow());
    await waitForPackagedUi(page);
    await waitForStartupRepairOutcome(page);
    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && !modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('[Router]') && text.includes('[DWG]') && text.includes('Route: direct-plugin');
    }, null, { timeout: 30000 });
    summary.after_startup_auto_repair = {
      status: await readMainStatus(page),
      settingsStatus: await readSettingsStatus(page),
      form: await readSettingsForm(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
      sawConfirmationMarker: await page.evaluate((marker) => {
        const text = String(document.querySelector('#status')?.textContent || '').trim();
        return text.includes(String(marker));
      }, AUTO_REPAIR_MARKER),
    };
    ensure(summary.after_startup_auto_repair.status.includes('Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.'), `Expected startup status to return ready, got ${summary.after_startup_auto_repair.status}`);
    ensure(summary.after_startup_auto_repair.settingsStatus.includes('[Router]') && summary.after_startup_auto_repair.settingsStatus.includes('[DWG]'), `Expected combined settings diagnostics after startup auto-repair, got ${summary.after_startup_auto_repair.settingsStatus}`);
    ensure(summary.after_startup_auto_repair.form.routerUrl === routerUrl, `Expected startup auto-repair to restore packaged router URL ${routerUrl}, got ${summary.after_startup_auto_repair.form.routerUrl}`);
    ensure(summary.after_startup_auto_repair.form.dwgPluginPath.includes('cad_resources/router/plugins/'), `Expected startup auto-repair to restore packaged DWG plugin path, got ${summary.after_startup_auto_repair.form.dwgPluginPath}`);
    ensure(summary.after_startup_auto_repair.form.dwgRouteMode === 'auto', `Expected startup auto-repair to preserve DWG route mode auto, got ${summary.after_startup_auto_repair.form.dwgRouteMode}`);
    ensure(summary.after_startup_auto_repair.stored === null, `Expected startup auto-repair to clear stale overrides, got ${summary.after_startup_auto_repair.stored}`);
    await page.click('#settings-cancel');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      return modal && modal.classList.contains('is-hidden');
    }, null, { timeout: 10000 });

    summary.injected_bad_router_start_override = await page.evaluate(({ storageKey, badRouterStartCmd }) => {
      const raw = JSON.stringify({
        routerStartCmd: badRouterStartCmd,
        projectId: 'packaged-bad-router-start',
      });
      window.localStorage.setItem(storageKey, raw);
      return {
        stored: window.localStorage.getItem(storageKey),
      };
    }, {
      storageKey: DESKTOP_SETTINGS_STORAGE_KEY,
      badRouterStartCmd: BAD_ROUTER_START_CMD,
    });
    ensure(summary.injected_bad_router_start_override.stored?.includes(BAD_ROUTER_START_CMD), `Expected injected bad router start override to include ${BAD_ROUTER_START_CMD}, got ${summary.injected_bad_router_start_override.stored}`);
    await page.waitForTimeout(500);
    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;
    ({ app: electronApp, page } = await launchWindow());
    await waitForPackagedUi(page);
    await waitForStartupRepairOutcome(page);
    summary.after_startup_spawn_error_auto_repair = {
      status: await readMainStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
      sawConfirmationMarker: await page.evaluate((marker) => {
        const text = String(document.querySelector('#status')?.textContent || '').trim();
        return text.includes(String(marker));
      }, AUTO_REPAIR_MARKER),
    };
    ensure(summary.after_startup_spawn_error_auto_repair.status.includes('Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.'), `Expected bad-router-start auto-repair to return to ready status, got ${summary.after_startup_spawn_error_auto_repair.status}`);
    ensure(
      summary.after_startup_spawn_error_auto_repair.sawConfirmationMarker ||
      summary.after_startup_spawn_error_auto_repair.status.includes('Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.'),
      `Expected bad-router-start auto-repair confirmation marker or stable ready status, got ${summary.after_startup_spawn_error_auto_repair.status}`,
    );
    ensure(summary.after_startup_spawn_error_auto_repair.stored === null, `Expected bad-router-start auto-repair to clear stale overrides, got ${summary.after_startup_spawn_error_auto_repair.stored}`);

    await page.click('#open-cad-btn');
    await waitForOpenCadSuccess(page);
    summary.after_open_cad_success = {
      status: await readMainStatus(page),
    };
    ensure(summary.after_open_cad_success.status.startsWith('Opened '), `Expected packaged open CAD success status, got ${summary.after_open_cad_success.status}`);
    ensure(summary.after_open_cad_success.status.includes(' via direct-plugin'), `Expected packaged open CAD success route direct-plugin, got ${summary.after_open_cad_success.status}`);

    await page.click('#settings-btn');
    await page.waitForFunction(() => {
      const modal = document.querySelector('#settings-modal');
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return modal && !modal.classList.contains('is-hidden') && text.includes('[Router]') && text.includes('[DWG]');
    }, null, { timeout: 30000 });

    const initialStatus = await readSettingsStatus(page);
    const initialForm = await readSettingsForm(page);
    summary.after_initial_modal_open = {
      status: initialStatus,
      form: initialForm,
    };

    ensure(initialStatus.includes('CAD runtime source: packaged-cad-resources'), `Expected packaged runtime source, got ${initialStatus}`);
    ensure(initialStatus.includes('CAD runtime ready: yes'), `Expected packaged runtime ready=yes, got ${initialStatus}`);
    ensure(initialStatus.includes('Router start source:'), `Expected router start source in status, got ${initialStatus}`);
    ensure(initialStatus.includes('Route: direct-plugin'), `Expected direct-plugin route, got ${initialStatus}`);
    ensure(initialStatus.includes('Router service:'), `Expected router service path, got ${initialStatus}`);
    ensure(initialStatus.includes('Preview pipeline:'), `Expected preview pipeline path, got ${initialStatus}`);
    ensure(initialStatus.includes('Viewer root:'), `Expected viewer root path, got ${initialStatus}`);
    ensure(initialStatus.includes(`dwg2dxf: ${expectedPackagedDwg2dxf}`), `Expected packaged dwg2dxf path ${expectedPackagedDwg2dxf}, got ${initialStatus}`);
    ensure(initialForm.routerUrl === routerUrl, `Expected router URL ${routerUrl}, got ${initialForm.routerUrl}`);
    ensure(initialForm.routerStartCmd.includes('cad_resources/router/plm_router_service.py'), `Expected packaged router start command, got ${initialForm.routerStartCmd}`);
    ensure(initialForm.dwgPluginPath.includes('cad_resources/router/plugins/'), `Expected packaged DWG plugin path, got ${initialForm.dwgPluginPath}`);
    ensure(initialForm.dwg2dxfBin === expectedPackagedDwg2dxf, `Expected packaged dwg2dxf bin ${expectedPackagedDwg2dxf}, got ${initialForm.dwg2dxfBin}`);
    ensure(initialForm.dwgRouteMode === 'auto', `Expected default DWG route mode auto, got ${initialForm.dwgRouteMode}`);

    await page.click('#settings-export-diagnostics');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Exported desktop diagnostics:');
    }, null, { timeout: 30000 });
    summary.after_export_diagnostics = await page.evaluate(() => ({
      status: String(document.querySelector('#settings-status')?.textContent || '').trim(),
      payload: window.__cadgfPreviewDebug?.getLastDesktopDiagnostics?.() || null,
      exportResult: window.__cadgfPreviewDebug?.getLastDesktopDiagnosticsExportResult?.() || null,
    }));
    ensure(summary.after_export_diagnostics.payload?.schema === 'vemcad.desktop.diagnostics.v1', `Expected diagnostics schema, got ${JSON.stringify(summary.after_export_diagnostics.payload)}`);
    ensure(Boolean(summary.after_export_diagnostics.payload?.app?.app_version), `Expected app version in diagnostics, got ${JSON.stringify(summary.after_export_diagnostics.payload?.app)}`);
    ensure(summary.after_export_diagnostics.payload?.app?.is_packaged === true, `Expected packaged app diagnostics, got ${JSON.stringify(summary.after_export_diagnostics.payload?.app)}`);
    ensure(summary.after_export_diagnostics.payload?.settings?.effective?.routerUrl === routerUrl, `Expected effective router URL in diagnostics, got ${summary.after_export_diagnostics.payload?.settings?.effective?.routerUrl}`);
    ensure(summary.after_export_diagnostics.payload?.results?.dwg_result?.route === 'direct-plugin', `Expected DWG route in diagnostics, got ${summary.after_export_diagnostics.payload?.results?.dwg_result?.route}`);
    ensure(summary.after_export_diagnostics.payload?.results?.dwg_result?.dwg2dxf_bin === expectedPackagedDwg2dxf, `Expected packaged dwg2dxf path in diagnostics, got ${summary.after_export_diagnostics.payload?.results?.dwg_result?.dwg2dxf_bin}`);
    ensure(summary.after_export_diagnostics.payload?.runtime_assets?.source === 'vendor/three@0.160.0', `Expected runtime assets in diagnostics, got ${JSON.stringify(summary.after_export_diagnostics.payload?.runtime_assets)}`);
    ensure(summary.after_export_diagnostics.exportResult?.mode === 'auto-dir', `Expected auto-dir export mode, got ${JSON.stringify(summary.after_export_diagnostics.exportResult)}`);
    ensure(String(summary.after_export_diagnostics.exportResult?.path || '').startsWith(exportDir), `Expected diagnostics file under ${exportDir}, got ${summary.after_export_diagnostics.exportResult?.path}`);
    ensure(summary.after_export_diagnostics.status.includes(summary.after_export_diagnostics.exportResult?.path || ''), `Expected export status to include saved path, got ${summary.after_export_diagnostics.status}`);
    const exportedFiles = fs.readdirSync(exportDir).filter((entry) => entry.endsWith('.json')).sort();
    ensure(exportedFiles.length === 1, `Expected exactly one exported diagnostics JSON, got ${exportedFiles.join(', ')}`);
    summary.after_export_diagnostics.files = exportedFiles;
    summary.after_export_diagnostics.saved_payload = JSON.parse(
      fs.readFileSync(path.join(exportDir, exportedFiles[0]), 'utf8')
    );
    ensure(summary.after_export_diagnostics.saved_payload?.schema === 'vemcad.desktop.diagnostics.v1', `Expected exported diagnostics schema on disk, got ${JSON.stringify(summary.after_export_diagnostics.saved_payload)}`);
    ensure(summary.after_export_diagnostics.saved_payload?.app?.is_packaged === true, `Expected packaged app diagnostics on disk, got ${JSON.stringify(summary.after_export_diagnostics.saved_payload?.app)}`);
    ensure(summary.after_export_diagnostics.saved_payload?.results?.dwg_result?.route === 'direct-plugin', `Expected direct-plugin DWG route on disk, got ${summary.after_export_diagnostics.saved_payload?.results?.dwg_result?.route}`);
    ensure(summary.after_export_diagnostics.saved_payload?.results?.dwg_result?.dwg2dxf_bin === expectedPackagedDwg2dxf, `Expected packaged dwg2dxf path on disk, got ${summary.after_export_diagnostics.saved_payload?.results?.dwg_result?.dwg2dxf_bin}`);

    await page.fill('#settings-router-url', 'http://127.0.0.1:59999');
    await page.fill('#settings-dwg-plugin', '/tmp/override/libcadgf_dwg_importer_plugin.dylib');
    await page.click('#settings-recommended');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Applied recommended desktop setup from detected runtime.')
        && text.includes('CAD runtime source: packaged-cad-resources')
        && text.includes('Route: direct-plugin');
    }, null, { timeout: 30000 });
    summary.after_recommended = {
      status: await readSettingsStatus(page),
      form: await readSettingsForm(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_recommended.form.routerUrl === routerUrl, `Expected recommended router URL ${routerUrl}, got ${summary.after_recommended.form.routerUrl}`);
    ensure(summary.after_recommended.form.dwgPluginPath === initialForm.dwgPluginPath, `Expected recommended DWG plugin ${initialForm.dwgPluginPath}, got ${summary.after_recommended.form.dwgPluginPath}`);
    ensure(summary.after_recommended.form.dwgRouteMode === 'auto', `Expected recommended DWG route mode auto, got ${summary.after_recommended.form.dwgRouteMode}`);
    ensure(summary.after_recommended.stored === null, `Expected recommended setup to clear stored overrides, got ${summary.after_recommended.stored}`);

    await page.click('#settings-test-router');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Router URL: http://127.0.0.1:') && text.includes('CAD runtime source: packaged-cad-resources');
    }, null, { timeout: 30000 });
    summary.after_router_test = {
      status: await readSettingsStatus(page),
    };

    await page.click('#settings-test-dwg');
    await page.waitForFunction(() => {
      const text = String(document.querySelector('#settings-status')?.textContent || '');
      return text.includes('Route: direct-plugin') && text.includes('CAD runtime source: packaged-cad-resources');
    }, null, { timeout: 30000 });
    summary.after_dwg_test = {
      status: await readSettingsStatus(page),
    };
    ensure(summary.after_dwg_test.status.includes(`dwg2dxf: ${expectedPackagedDwg2dxf}`), `Expected packaged dwg2dxf path after DWG test, got ${summary.after_dwg_test.status}`);

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
    }, null, { timeout: 30000 });
    summary.after_open_cad_router_not_ready = {
      status: await readMainStatus(page),
      settingsStatus: await readSettingsStatus(page),
      form: await readSettingsForm(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_open_cad_router_not_ready.status === 'Open CAD failed via direct-plugin: Router URL not configured.', `Expected packaged router setup failure status, got ${summary.after_open_cad_router_not_ready.status}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router URL: n/a'), `Expected missing router URL in packaged settings failure, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router auto start: off'), `Expected effective router auto-start state after packaged failure, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Router start ready: yes'), `Expected router start readiness after packaged failure, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.settingsStatus.includes('Hint: Set Router URL in Settings before opening CAD files.'), `Expected packaged router recovery hint, got ${summary.after_open_cad_router_not_ready.settingsStatus}`);
    ensure(summary.after_open_cad_router_not_ready.stored?.includes('"routerUrl":""'), `Expected blank router URL override to persist after packaged failure, got ${summary.after_open_cad_router_not_ready.stored}`);

    await page.click('#settings-reset');
    await page.waitForFunction(({ expectedRouterUrl, expectedDwg2dxf }) => {
      const status = String(document.querySelector('#settings-status')?.textContent || '');
      const routerUrl = document.querySelector('#settings-router-url')?.value || '';
      const dwg2dxfBin = document.querySelector('#settings-dwg2dxf-bin')?.value || '';
      return routerUrl === expectedRouterUrl
        && dwg2dxfBin === expectedDwg2dxf
        && status.includes(`dwg2dxf: ${expectedDwg2dxf}`);
    }, {
      expectedRouterUrl: routerUrl,
      expectedDwg2dxf: expectedPackagedDwg2dxf,
    }, { timeout: 30000 });
    summary.after_router_failure_reset = {
      form: await readSettingsForm(page),
      status: await readSettingsStatus(page),
      stored: await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DESKTOP_SETTINGS_STORAGE_KEY),
    };
    ensure(summary.after_router_failure_reset.form.routerUrl === routerUrl, `Expected packaged reset router URL ${routerUrl}, got ${summary.after_router_failure_reset.form.routerUrl}`);
    ensure(summary.after_router_failure_reset.form.dwg2dxfBin === expectedPackagedDwg2dxf, `Expected packaged reset dwg2dxf ${expectedPackagedDwg2dxf}, got ${summary.after_router_failure_reset.form.dwg2dxfBin}`);
    ensure(summary.after_router_failure_reset.stored === null, `Expected packaged router failure reset to clear overrides, got ${summary.after_router_failure_reset.stored}`);

    await electronApp.close();
    electronApp = null;
    summary.ok = true;
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.message || error);
    if (page) {
      try {
        summary.last_known_status = await readDebugState(page);
      } catch (readError) {
        summary.last_known_status_error = String(readError?.message || readError);
      }
    }
    if (electronApp) {
      await closeAppInstance(electronApp);
      electronApp = null;
    }
  } finally {
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
