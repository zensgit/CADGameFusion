#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const desktopDir = path.join(repoRoot, 'tools', 'web_viewer_desktop');
const requireFromDesktop = createRequire(path.join(desktopDir, 'package.json'));
const { _electron: electron } = requireFromDesktop('playwright');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'desktop_packaged_open_handoff_smoke');
const READY_STATUS_PREFIX = 'Desktop ready via direct-plugin from packaged-cad-resources.';
const READY_STATUS_SUFFIX = 'Open CAD File or Settings.';
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
    inputDwgAlt: '',
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
    if (token === '--input-dwg-alt' && i + 1 < argv.length) {
      args.inputDwgAlt = argv[i + 1];
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
    'Usage: node tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js [--outdir <dir>] [--app <path>] [--input-dwg <path>] [--input-dwg-alt <path>] [--pack-if-needed]',
    '',
    'Launches the real packaged VemCAD app and verifies native CAD open handoff via second-instance, LaunchServices open -a, and startup arg forwarding.',
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

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
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

function findDistinctInputDwgs(inputDwg, inputDwgAlt) {
  const candidates = [];
  for (const candidate of [inputDwg, inputDwgAlt, ...DEFAULT_SAMPLE_CANDIDATES]) {
    const resolved = firstExisting(candidate ? [candidate] : []);
    if (resolved && !candidates.includes(resolved)) {
      candidates.push(resolved);
    }
  }
  if (candidates.length < 2) {
    throw new Error(`Need two distinct sample DWGs. Checked: ${[inputDwg, inputDwgAlt, ...DEFAULT_SAMPLE_CANDIDATES].filter(Boolean).join(', ')}`);
  }
  return candidates.slice(0, 2);
}

function findPackagedAppBinary(baseDir) {
  const distDir = path.join(baseDir, 'dist');
  const candidates = [
    path.join(distDir, 'mac-arm64', 'VemCAD.app', 'Contents', 'MacOS', 'VemCAD'),
    path.join(distDir, 'VemCAD.app', 'Contents', 'MacOS', 'VemCAD'),
    path.join(distDir, 'win-unpacked', 'VemCAD.exe'),
    path.join(distDir, 'linux-unpacked', 'VemCAD'),
  ];
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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
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

function matchesOpenedLabel(text, label) {
  const normalized = String(text || '').trim();
  const prefix = `Opened ${label} via direct-plugin`;
  return normalized === `${prefix}.`
    || normalized === `${prefix} with document fallback preview.`
    || normalized === `${prefix}, but only text annotations were renderable.`
    || normalized === `${prefix}, but no renderable preview geometry was produced.`;
}

async function waitForOpenedLabel(page, expectedLabel, timeoutMs = 60000) {
  await page.waitForFunction((label) => {
    const text = String(document.querySelector('#status')?.textContent || '').trim();
    return text === `Opened ${label} via direct-plugin.`
      || text === `Opened ${label} via direct-plugin with document fallback preview.`
      || text === `Opened ${label} via direct-plugin, but only text annotations were renderable.`
      || text === `Opened ${label} via direct-plugin, but no renderable preview geometry was produced.`;
  }, expectedLabel, { timeout: timeoutMs });
}

async function readDebugState(page) {
  return page.evaluate(() => ({
    status: String(document.querySelector('#status')?.textContent || '').trim(),
    settingsStatus: String(document.querySelector('#settings-status')?.textContent || '').trim(),
    settingsModalVisible: !document.querySelector('#settings-modal')?.classList.contains('is-hidden'),
    location: window.location.href,
    hasDesktopBridge: Boolean(window.vemcadDesktop),
    desktopBridgeKeys: window.vemcadDesktop ? Object.keys(window.vemcadDesktop) : [],
  }));
}

async function closeAppInstance(instance) {
  if (!instance) {
    return;
  }
  try {
    await instance.close();
  } catch {
    // ignore cleanup failures
  }
}

function appBundlePathFromBinary(appBinary) {
  if (process.platform !== 'darwin') {
    return '';
  }
  return path.resolve(path.dirname(appBinary), '..', '..');
}

function runLaunchServicesOpen(appBundlePath, filePath, {
  userDataDir = '',
  smokeHome = '',
  routerUrl = '',
  exportDir = '',
} = {}) {
  const args = ['-a', appBundlePath];
  if (smokeHome) {
    args.push('--env', `HOME=${smokeHome}`);
  }
  if (routerUrl) {
    args.push('--env', `VEMCAD_ROUTER_URL=${routerUrl}`);
  }
  if (exportDir) {
    args.push('--env', `VEMCAD_DESKTOP_EXPORT_DIR=${exportDir}`);
  }
  args.push(filePath);
  if (userDataDir) {
    args.push('--args', `--user-data-dir=${userDataDir}`);
  }
  return spawnSync('open', args, {
    cwd: desktopDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function waitForChildExit(child, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`Timed out waiting for second instance to exit after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        signal: signal || '',
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      });
    });
  });
}

async function launchPackagedWindow({
  appBinary,
  userDataDir = '',
  smokeHome,
  routerUrl,
  exportDir,
  extraArgs = [],
  consoleMessages,
  pageErrors,
  threeCdnRequests,
  fontCdnRequests,
}) {
  const launchArgs = userDataDir ? [`--user-data-dir=${userDataDir}`] : [];
  const launchedApp = await electron.launch({
    executablePath: appBinary,
    args: [...launchArgs, ...extraArgs],
    env: {
      ...process.env,
      HOME: smokeHome,
      VEMCAD_ROUTER_URL: routerUrl,
      VEMCAD_DESKTOP_EXPORT_DIR: exportDir,
    },
  });
  const page = await launchedApp.firstWindow();
  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
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
  return { app: launchedApp, page };
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
    const [inputDwg, inputDwgAlt] = findDistinctInputDwgs(args.inputDwg, args.inputDwgAlt);
    const secondLabel = path.basename(inputDwg, path.extname(inputDwg));
    const launchServicesLabel = path.basename(inputDwgAlt, path.extname(inputDwgAlt));
    const routerPort = await findFreePort();
    const routerUrl = `http://127.0.0.1:${routerPort}`;
    const exportDir = path.join(outdir, 'exported_diagnostics');
    const smokeHome = path.join(outdir, 'smoke_home');
    const initialUserDataDir = path.join(smokeHome, 'user-data-initial');
    const startupUserDataDir = path.join(smokeHome, 'user-data-startup-arg');
    ensureDir(exportDir);
    ensureDir(initialUserDataDir);
    ensureDir(startupUserDataDir);

    summary.app = appBinary;
    summary.input_dwg = inputDwg;
    summary.input_dwg_alt = inputDwgAlt;
    summary.router_url = routerUrl;
    summary.export_dir = exportDir;
    summary.smoke_home = smokeHome;
    summary.initial_user_data_dir = initialUserDataDir;
    summary.startup_user_data_dir = startupUserDataDir;

    ({ app: electronApp, page } = await launchPackagedWindow({
      appBinary,
      userDataDir: initialUserDataDir,
      smokeHome,
      routerUrl,
      exportDir,
      consoleMessages,
      pageErrors,
      threeCdnRequests,
      fontCdnRequests,
    }));
    await waitForPackagedUi(page);
    await waitForStatusReady(page);
    summary.after_primary_ready = {
      status: await readMainStatus(page),
    };

    const secondInstance = spawn(appBinary, [`--user-data-dir=${initialUserDataDir}`, inputDwg], {
      cwd: desktopDir,
      env: {
        ...process.env,
        HOME: smokeHome,
        VEMCAD_ROUTER_URL: routerUrl,
        VEMCAD_DESKTOP_EXPORT_DIR: exportDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const secondInstanceExit = waitForChildExit(secondInstance, 15000);
    await waitForOpenedLabel(page, secondLabel);
    summary.after_second_instance_open = {
      status: await readMainStatus(page),
    };
    ensure(summary.after_second_instance_open.status.includes(' via direct-plugin'), `Expected second-instance open to use direct-plugin, got ${summary.after_second_instance_open.status}`);
    summary.second_instance = await secondInstanceExit;
    ensure(summary.second_instance.signal === '' || summary.second_instance.signal === 'SIGTERM', `Expected second instance to exit cleanly, got signal=${summary.second_instance.signal}`);

    if (process.platform === 'darwin') {
      const appBundle = appBundlePathFromBinary(appBinary);
      ensure(appBundle && fs.existsSync(appBundle), `App bundle not found for LaunchServices smoke: ${appBundle}`);
      const launchServicesOpen = runLaunchServicesOpen(appBundle, inputDwgAlt, {
        userDataDir: initialUserDataDir,
        smokeHome,
        routerUrl,
        exportDir,
      });
      summary.launchservices_open = {
        app_bundle: appBundle,
        file: inputDwgAlt,
        code: launchServicesOpen.status,
        signal: launchServicesOpen.signal || '',
        stdout: launchServicesOpen.stdout || '',
        stderr: launchServicesOpen.stderr || '',
      };
      ensure(summary.launchservices_open.code === 0, `Expected open -a to succeed, got code=${summary.launchservices_open.code} stderr=${summary.launchservices_open.stderr}`);
      await waitForOpenedLabel(page, launchServicesLabel);
      summary.after_launchservices_open = {
        status: await readMainStatus(page),
      };
      ensure(matchesOpenedLabel(summary.after_launchservices_open.status, launchServicesLabel), `Expected LaunchServices open to reach ${launchServicesLabel}, got ${summary.after_launchservices_open.status}`);
    } else {
      summary.launchservices_open = {
        skipped: true,
        reason: `platform ${process.platform} is not darwin`,
      };
    }

    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;

    ({ app: electronApp, page } = await launchPackagedWindow({
      appBinary,
      userDataDir: startupUserDataDir,
      smokeHome,
      routerUrl,
      exportDir,
      extraArgs: [inputDwg],
      consoleMessages,
      pageErrors,
      threeCdnRequests,
      fontCdnRequests,
    }));
    await waitForPackagedUi(page);
    await waitForOpenedLabel(page, secondLabel);
    summary.after_startup_arg_open = {
      status: await readMainStatus(page),
    };
    ensure(summary.after_startup_arg_open.status.includes(' via direct-plugin'), `Expected startup-arg open to use direct-plugin, got ${summary.after_startup_arg_open.status}`);
    ensure(threeCdnRequests.length === 0, `Expected no unpkg three requests, got ${threeCdnRequests.join(', ')}`);
    ensure(fontCdnRequests.length === 0, `Expected no Google Fonts requests, got ${fontCdnRequests.join(', ')}`);

    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;
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
