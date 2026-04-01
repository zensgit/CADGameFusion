#!/usr/bin/env node

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const desktopDir = path.join(repoRoot, "tools", "web_viewer_desktop");
const requireFromDesktop = createRequire(path.join(desktopDir, "package.json"));
const { _electron: electron } = requireFromDesktop("playwright");

const DEFAULT_OUTDIR = path.join(repoRoot, "build", "desktop_packaged_document_fallback_smoke");
const DEFAULT_SAMPLE_CANDIDATES = [
  "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg",
  "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg",
];

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    packIfNeeded: false,
    app: "",
    inputDwg: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--outdir" && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--app" && i + 1 < argv.length) {
      args.app = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--input-dwg" && i + 1 < argv.length) {
      args.inputDwg = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--pack-if-needed") {
      args.packIfNeeded = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function usage() {
  return [
    "Usage: node tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js [--outdir <dir>] [--app <path>] [--input-dwg <path>] [--pack-if-needed]",
    "",
    "Launches the real packaged VemCAD app with a DWG that only yields document.json output and verifies fallback line preview rendering.",
  ].join("\n");
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
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
    if (!candidate) {
      continue;
    }
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return "";
}

function findInputDwg(inputDwg) {
  const resolved = firstExisting(inputDwg ? [inputDwg] : DEFAULT_SAMPLE_CANDIDATES);
  if (!resolved) {
    throw new Error(`Input DWG not found. Checked: ${(inputDwg ? [inputDwg] : DEFAULT_SAMPLE_CANDIDATES).join(", ")}`);
  }
  return resolved;
}

function findPackagedAppBinary(baseDir) {
  const distDir = path.join(baseDir, "dist");
  const candidates = [
    path.join(distDir, "mac-arm64", "VemCAD.app", "Contents", "MacOS", "VemCAD"),
    path.join(distDir, "VemCAD.app", "Contents", "MacOS", "VemCAD"),
    path.join(distDir, "win-unpacked", "VemCAD.exe"),
    path.join(distDir, "linux-unpacked", "VemCAD"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
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
    throw new Error("Packaged desktop app not found. Pass --pack-if-needed or --app.");
  }
  const result = spawnSync("npm", ["run", "pack"], {
    cwd: desktopDir,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`npm run pack failed:\n${result.stdout || ""}${result.stderr || ""}`);
  }
  const packaged = findPackagedAppBinary(desktopDir);
  if (!packaged) {
    throw new Error("Packaged desktop app not found after `npm run pack`.");
  }
  return path.resolve(packaged);
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate free port")));
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
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const isVisible = (selector) => {
      const el = document.querySelector(selector);
      if (!el || el.classList.contains("is-hidden")) {
        return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return Boolean(window.vemcadDesktop)
      && Boolean(document.querySelector("#status"))
      && isVisible("#settings-btn")
      && isVisible("#open-cad-btn");
  }, null, { timeout: timeoutMs });
}

async function waitForFallbackPreview(page, timeoutMs = 120000) {
  await page.waitForFunction(() => {
    const previewState = window.__cadgfPreviewDebug?.getLastManifestPreviewState?.() || null;
    const lineOverlayState = window.__cadgfPreviewDebug?.getLineOverlayState?.() || [];
    return previewState?.kind === "document-fallback" && Array.isArray(lineOverlayState) && lineOverlayState.length > 0;
  }, null, { timeout: timeoutMs });
}

async function readDebugState(page) {
  return page.evaluate(() => ({
    status: String(document.querySelector("#status")?.textContent || "").trim(),
    previewState: window.__cadgfPreviewDebug?.getLastManifestPreviewState?.() || null,
    lineOverlayState: window.__cadgfPreviewDebug?.getLineOverlayState?.() || [],
    visibleTextEntries: window.__cadgfPreviewDebug?.getVisibleTextEntries?.() || [],
    runtimeAssets: window.__cadgfPreviewDebug?.getRuntimeAssets?.() || null,
    viewportPresentation: window.__cadgfPreviewDebug?.getViewportPresentationState?.() || null,
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

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const outdir = path.join(path.resolve(args.outdir), nowStamp());
  ensureDir(outdir);
  const summaryPath = path.join(outdir, "summary.json");
  const screenshotPath = path.join(outdir, "fallback_preview.png");
  const consoleMessages = [];
  const pageErrors = [];
  const summary = {
    ok: false,
    outdir,
    screenshot: screenshotPath,
    console_messages: consoleMessages,
    page_errors: pageErrors,
  };

  let electronApp = null;
  let page = null;

  try {
    const appBinary = ensurePackagedApp(args.app, args.packIfNeeded);
    const inputDwg = findInputDwg(args.inputDwg);
    const routerPort = await findFreePort();
    const routerUrl = `http://127.0.0.1:${routerPort}`;
    const exportDir = path.join(outdir, "exported_diagnostics");
    const smokeHome = path.join(outdir, "smoke_home");
    const userDataDir = path.join(smokeHome, "user-data");
    ensureDir(exportDir);
    ensureDir(userDataDir);

    summary.app = appBinary;
    summary.input_dwg = inputDwg;
    summary.router_url = routerUrl;
    summary.export_dir = exportDir;
    summary.smoke_home = smokeHome;
    summary.user_data_dir = userDataDir;

    electronApp = await electron.launch({
      executablePath: appBinary,
      args: [`--user-data-dir=${userDataDir}`, inputDwg],
      env: {
        ...process.env,
        HOME: smokeHome,
        VEMCAD_ROUTER_URL: routerUrl,
        VEMCAD_DESKTOP_EXPORT_DIR: exportDir,
      },
    });
    page = await electronApp.firstWindow();
    page.on("console", (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.message || error));
    });

    await waitForPackagedUi(page);
    await waitForFallbackPreview(page);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
    summary.after_fallback_open = await readDebugState(page);
    ensure(summary.after_fallback_open.previewState?.kind === "document-fallback", `Expected document-fallback preview, got ${JSON.stringify(summary.after_fallback_open.previewState)}`);
    ensure(summary.after_fallback_open.status.includes("document fallback preview"), `Expected status to mention document fallback preview, got ${summary.after_fallback_open.status}`);
    ensure(summary.after_fallback_open.lineOverlayState.length > 0, `Expected non-empty line overlay state, got ${JSON.stringify(summary.after_fallback_open.lineOverlayState)}`);
    ensure((summary.after_fallback_open.previewState?.renderableEntityCount || 0) > 0, `Expected renderable entities in fallback preview, got ${JSON.stringify(summary.after_fallback_open.previewState)}`);
    ensure((summary.after_fallback_open.previewState?.segmentCount || 0) > 0, `Expected line segments in fallback preview, got ${JSON.stringify(summary.after_fallback_open.previewState)}`);
    ensure(summary.after_fallback_open.previewState?.focusRegion?.strategy === "density-cluster", `Expected density-cluster focus region, got ${JSON.stringify(summary.after_fallback_open.previewState?.focusRegion)}`);
    ensure(
      Number.isFinite(summary.after_fallback_open.previewState?.focusRegion?.coverageRatio)
        && summary.after_fallback_open.previewState.focusRegion.coverageRatio < 0.6,
      `Expected focused fallback coverage ratio below 0.6, got ${JSON.stringify(summary.after_fallback_open.previewState?.focusRegion)}`,
    );
    ensure(summary.after_fallback_open.viewportPresentation?.mode === "document-fallback", `Expected document fallback viewport presentation, got ${JSON.stringify(summary.after_fallback_open.viewportPresentation)}`);
    ensure(summary.after_fallback_open.viewportPresentation?.controlsRotateEnabled === false, `Expected document fallback view to disable rotate, got ${JSON.stringify(summary.after_fallback_open.viewportPresentation)}`);

    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;
    summary.ok = true;
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.message || error);
    if (page) {
      try {
        summary.last_known_state = await readDebugState(page);
      } catch (readError) {
        summary.last_known_state_error = String(readError?.message || readError);
      }
      try {
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
        });
      } catch {
        // ignore screenshot failures during cleanup
      }
    }
    if (electronApp) {
      await closeAppInstance(electronApp);
      electronApp = null;
    }
  } finally {
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
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
