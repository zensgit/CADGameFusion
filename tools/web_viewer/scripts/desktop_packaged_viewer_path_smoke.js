#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { _electron as electron } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const desktopDir = path.join(repoRoot, 'tools', 'web_viewer_desktop');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'desktop_packaged_viewer_path_smoke');

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    app: '',
    packIfNeeded: false,
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
    'Usage: node tools/web_viewer/scripts/desktop_packaged_viewer_path_smoke.js [--outdir <dir>] [--app <path>] [--pack-if-needed]',
    '',
    'Launches the packaged VemCAD app and verifies the first viewer window is loaded from packaged cad_resources.',
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

  const outdirRoot = path.resolve(args.outdir);
  const runDir = path.join(outdirRoot, nowStamp());
  ensureDir(runDir);
  const appBinary = ensurePackagedApp(args.app, args.packIfNeeded);
  const userDataDir = path.join(runDir, 'user-data');
  ensureDir(userDataDir);

  const summary = {
    ok: false,
    app: appBinary,
    run_dir: runDir,
    user_data_dir: userDataDir,
    location: '',
    has_desktop_bridge: false,
    bootstrap: null,
    status: '',
    error: '',
  };

  let electronApp = null;
  try {
    electronApp = await electron.launch({
      executablePath: appBinary,
      args: [`--user-data-dir=${userDataDir}`],
    });
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.vemcadDesktop), null, { timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.__vemcadBootstrap), null, { timeout: 30000 });

    Object.assign(summary, await page.evaluate(() => ({
      location: window.location.href,
      has_desktop_bridge: Boolean(window.vemcadDesktop),
      bootstrap: window.__vemcadBootstrap || null,
      status: String(document.querySelector('#status')?.textContent || '').trim(),
    })));

    assert(summary.location.includes('/Resources/cad_resources/tools/web_viewer/index.html'), `Expected cad_resources viewer URL, got ${summary.location}`);
    assert(summary.has_desktop_bridge, 'Expected desktop bridge to be exposed');
    assert(summary.bootstrap?.source === 'legacy-fallback', `Expected legacy fallback bootstrap in packaged desktop, got ${JSON.stringify(summary.bootstrap)}`);
    assert(
      summary.bootstrap?.fallbackReason === 'desktop-runtime-product-bootstrap-disabled',
      `Expected desktop fallback reason, got ${summary.bootstrap?.fallbackReason || ''}`
    );
    summary.ok = true;
  } catch (error) {
    summary.error = String(error?.stack || error?.message || error);
    throw error;
  } finally {
    if (electronApp) {
      await electronApp.close().catch(() => {});
    }
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
