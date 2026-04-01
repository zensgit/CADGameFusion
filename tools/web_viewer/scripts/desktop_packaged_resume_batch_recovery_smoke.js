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

const DEFAULT_OUTDIR = path.join(repoRoot, "build", "desktop_packaged_resume_batch_recovery_smoke");
const READY_STATUS_PREFIX = "Desktop ready via direct-plugin from packaged-cad-resources.";
const READY_STATUS_SUFFIX = "Open CAD File or Settings.";
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
    inputDwgAlt: "",
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
    if (token === "--input-dwg-alt" && i + 1 < argv.length) {
      args.inputDwgAlt = argv[i + 1];
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
    "Usage: node tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js [--outdir <dir>] [--app <path>] [--input-dwg <path>] [--input-dwg-alt <path>] [--pack-if-needed]",
    "",
    "Launches the real packaged VemCAD app and verifies Resume Latest, macOS file-open registration, and batch retry/export recovery.",
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

function findDistinctInputDwgs(inputDwg, inputDwgAlt) {
  const candidates = [];
  for (const candidate of [inputDwg, inputDwgAlt, ...DEFAULT_SAMPLE_CANDIDATES]) {
    const resolved = firstExisting(candidate ? [candidate] : []);
    if (resolved && !candidates.includes(resolved)) {
      candidates.push(resolved);
    }
  }
  if (candidates.length < 2) {
    throw new Error(`Need two distinct sample DWGs. Checked: ${[inputDwg, inputDwgAlt, ...DEFAULT_SAMPLE_CANDIDATES].filter(Boolean).join(", ")}`);
  }
  return candidates.slice(0, 2);
}

function documentLabelForPath(filePath) {
  return path.basename(filePath, path.extname(filePath));
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

async function waitForStatusReady(page, timeoutMs = 30000) {
  await page.waitForFunction((expected) => {
    const [prefix, suffix] = expected || [];
    const text = String(document.querySelector("#status")?.textContent || "").trim();
    return text.includes(String(prefix)) && text.includes(String(suffix));
  }, [READY_STATUS_PREFIX, READY_STATUS_SUFFIX], { timeout: timeoutMs });
}

function matchesOpenedLabel(text, label) {
  const normalized = String(text || "").trim();
  const prefix = `Opened ${label} via direct-plugin`;
  return normalized === `${prefix}.`
    || normalized === `${prefix} with document fallback preview.`
    || normalized === `${prefix}, but only text annotations were renderable.`
    || normalized === `${prefix}, but no renderable preview geometry was produced.`;
}

async function waitForOpenedLabel(page, expectedLabel, timeoutMs = 60000) {
  await page.waitForFunction((label) => {
    const text = String(document.querySelector("#status")?.textContent || "").trim();
    return text === `Opened ${label} via direct-plugin.`
      || text === `Opened ${label} via direct-plugin with document fallback preview.`
      || text === `Opened ${label} via direct-plugin, but only text annotations were renderable.`
      || text === `Opened ${label} via direct-plugin, but no renderable preview geometry was produced.`;
  }, expectedLabel, { timeout: timeoutMs });
}

async function waitForStatusContains(page, expectedText, timeoutMs = 30000) {
  await page.waitForFunction((needle) => {
    const text = String(document.querySelector("#status")?.textContent || "").trim();
    return text.includes(String(needle));
  }, expectedText, { timeout: timeoutMs });
}

async function waitForBatchSummary(page, expectedText, timeoutMs = 30000) {
  await page.waitForFunction((needle) => {
    const text = String(document.querySelector("#desktop-batch-summary")?.textContent || "").trim();
    return text === String(needle);
  }, expectedText, { timeout: timeoutMs });
}

async function readMainStatus(page) {
  return page.evaluate(() => String(document.querySelector("#status")?.textContent || "").trim());
}

async function readRecentUi(page) {
  return page.evaluate(() => ({
    entries: Array.from(document.querySelectorAll(".recent-file-item")).map((item) => ({
      path: String(item.dataset.path || ""),
      label: String(item.querySelector(".recent-file-btn")?.textContent || "").trim(),
      disabled: Boolean(item.querySelector(".recent-file-btn")?.disabled),
    })),
  }));
}

async function readQuickActions(page) {
  return page.evaluate(() => {
    const readButton = (selector) => {
      const button = document.querySelector(selector);
      return {
        visible: Boolean(button) && !button.classList.contains("is-hidden"),
        disabled: Boolean(button?.disabled),
        text: String(button?.textContent || "").trim(),
      };
    };
    return {
      resume_latest: readButton("#resume-latest-cad"),
      register_file_associations: readButton("#register-file-associations"),
      batch_retry: readButton("#desktop-batch-retry"),
      batch_export: readButton("#desktop-batch-export"),
    };
  });
}

async function readBatchUi(page) {
  return page.evaluate(() => ({
    visible: !document.querySelector("#desktop-batch-panel")?.classList.contains("is-hidden"),
    summary: String(document.querySelector("#desktop-batch-summary")?.textContent || "").trim(),
    items: Array.from(document.querySelectorAll(".desktop-batch-item")).map((item) => ({
      path: String(item.dataset.path || ""),
      status: String(item.dataset.status || ""),
      label: String(item.querySelector(".desktop-batch-item__name")?.textContent || "").trim(),
      detail: String(item.querySelector(".desktop-batch-item__meta")?.textContent || "").trim(),
    })),
  }));
}

async function readAppMenuState(electronApp) {
  return electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const serialize = (item) => ({
      label: item.label || item.role || "",
      enabled: item.enabled !== false,
      submenu: item.submenu ? item.submenu.items.map(serialize) : [],
    });
    return menu ? menu.items.map(serialize) : [];
  });
}

function findFileMenuItem(menuState = [], label = "") {
  for (const item of menuState) {
    if (item.label !== "File") {
      continue;
    }
    return (item.submenu || []).find((child) => child.label === label) || null;
  }
  return null;
}

async function simulateCadMultiDrop(page, filePaths) {
  await page.evaluate((paths) => {
    const viewport = document.querySelector(".viewport");
    const files = Array.from(paths || []).map((inputPath) => ({
      path: inputPath,
      name: String(inputPath).split(/[\\/]/).pop() || "",
    }));
    const dataTransfer = {
      files,
      types: ["Files"],
      getData: () => "",
    };
    for (const type of ["dragenter", "dragover", "drop"]) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      viewport.dispatchEvent(event);
    }
  }, filePaths);
}

async function clickVisibleButton(page, selector) {
  await page.locator(selector).click();
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

async function launchPackagedWindow({
  appBinary,
  userDataDir,
  smokeHome,
  routerUrl,
  exportDir,
  consoleMessages,
  pageErrors,
  threeCdnRequests,
  fontCdnRequests,
}) {
  const launchedApp = await electron.launch({
    executablePath: appBinary,
    args: [`--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      HOME: smokeHome,
      VEMCAD_ROUTER_URL: routerUrl,
      VEMCAD_DESKTOP_EXPORT_DIR: exportDir,
    },
  });
  const page = await launchedApp.firstWindow();
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("unpkg.com/three")) {
      threeCdnRequests.push(url);
    }
    if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
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
  const summaryPath = path.join(outdir, "summary.json");
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
    const firstLabel = documentLabelForPath(inputDwg);
    const retryLabel = "resume-retry-case";
    const retryTargetPath = path.join(outdir, `${retryLabel}.dwg`);
    const unsupportedPath = path.join(outdir, "ignored-batch-item.txt");
    const routerPort = await findFreePort();
    const routerUrl = `http://127.0.0.1:${routerPort}`;
    const exportDir = path.join(outdir, "exported_diagnostics");
    const smokeHome = path.join(outdir, "smoke_home");
    const userDataDir = path.join(smokeHome, "user-data");
    ensureDir(exportDir);
    ensureDir(userDataDir);
    fs.writeFileSync(unsupportedPath, "not a CAD file\n", "utf8");
    fs.rmSync(retryTargetPath, { force: true });

    summary.app = appBinary;
    summary.input_dwg = inputDwg;
    summary.input_dwg_alt = inputDwgAlt;
    summary.retry_target_path = retryTargetPath;
    summary.unsupported_drop_path = unsupportedPath;
    summary.router_url = routerUrl;
    summary.export_dir = exportDir;
    summary.smoke_home = smokeHome;
    summary.user_data_dir = userDataDir;

    ({ app: electronApp, page } = await launchPackagedWindow({
      appBinary,
      userDataDir,
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
    summary.after_ready = {
      status: await readMainStatus(page),
      quick_actions: await readQuickActions(page),
    };

    if (process.platform === "darwin") {
      ensure(summary.after_ready.quick_actions.register_file_associations.visible, `Expected Register macOS File Open button to be visible, got ${JSON.stringify(summary.after_ready.quick_actions)}`);
      await clickVisibleButton(page, "#register-file-associations");
      await waitForStatusContains(page, "Registered macOS file-open services:");
      summary.after_register_file_associations = {
        status: await readMainStatus(page),
      };
    }

    await simulateCadMultiDrop(page, [inputDwg]);
    await waitForOpenedLabel(page, firstLabel);
    summary.after_seed_recent = {
      status: await readMainStatus(page),
      quick_actions: await readQuickActions(page),
      recent_ui: await readRecentUi(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(summary.after_seed_recent.quick_actions.resume_latest.visible, `Expected Resume Latest button after seeding recent files, got ${JSON.stringify(summary.after_seed_recent.quick_actions)}`);
    ensure(summary.after_seed_recent.quick_actions.resume_latest.text.includes(firstLabel), `Expected Resume Latest label to mention ${firstLabel}, got ${summary.after_seed_recent.quick_actions.resume_latest.text}`);
    ensure(findFileMenuItem(summary.after_seed_recent.menu_state, "Resume Latest CAD")?.enabled === true, `Expected File -> Resume Latest CAD to be enabled, got ${JSON.stringify(summary.after_seed_recent.menu_state)}`);

    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;

    ({ app: electronApp, page } = await launchPackagedWindow({
      appBinary,
      userDataDir,
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
    await page.waitForFunction((expected) => {
      const button = document.querySelector("#resume-latest-cad");
      return Boolean(button)
        && !button.classList.contains("is-hidden")
        && String(button.textContent || "").includes(String(expected));
    }, firstLabel, { timeout: 30000 });
    summary.after_relaunch = {
      status: await readMainStatus(page),
      quick_actions: await readQuickActions(page),
      recent_ui: await readRecentUi(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(summary.after_relaunch.quick_actions.resume_latest.visible, `Expected Resume Latest visible after relaunch, got ${JSON.stringify(summary.after_relaunch.quick_actions)}`);
    ensure(summary.after_relaunch.quick_actions.resume_latest.text.includes(firstLabel), `Expected Resume Latest after relaunch to mention ${firstLabel}, got ${summary.after_relaunch.quick_actions.resume_latest.text}`);
    ensure(findFileMenuItem(summary.after_relaunch.menu_state, "Resume Latest CAD")?.enabled === true, `Expected File -> Resume Latest CAD enabled after relaunch, got ${JSON.stringify(summary.after_relaunch.menu_state)}`);

    await clickVisibleButton(page, "#resume-latest-cad");
    await waitForOpenedLabel(page, firstLabel);
    summary.after_resume_latest = {
      status: await readMainStatus(page),
    };

    await simulateCadMultiDrop(page, [retryTargetPath, unsupportedPath]);
    await waitForBatchSummary(page, "Complete · 0 opened · 1 failed · 1 ignored");
    summary.after_failed_batch = {
      status: await readMainStatus(page),
      quick_actions: await readQuickActions(page),
      batch_ui: await readBatchUi(page),
    };
    ensure(summary.after_failed_batch.quick_actions.batch_retry.visible, `Expected Retry Failed button to be visible, got ${JSON.stringify(summary.after_failed_batch.quick_actions)}`);
    ensure(summary.after_failed_batch.quick_actions.batch_export.visible, `Expected Export Report button to be visible, got ${JSON.stringify(summary.after_failed_batch.quick_actions)}`);
    ensure(summary.after_failed_batch.batch_ui.items.some((item) => item.path === retryTargetPath && item.status === "failed"), `Expected failed retry target in batch UI, got ${JSON.stringify(summary.after_failed_batch.batch_ui.items)}`);
    ensure(summary.after_failed_batch.batch_ui.items.some((item) => item.path === unsupportedPath && item.status === "ignored"), `Expected ignored unsupported item in batch UI, got ${JSON.stringify(summary.after_failed_batch.batch_ui.items)}`);

    fs.copyFileSync(inputDwgAlt, retryTargetPath);
    await clickVisibleButton(page, "#desktop-batch-retry");
    await waitForOpenedLabel(page, retryLabel);
    await waitForBatchSummary(page, "Complete · 1 opened");
    summary.after_retry_failed = {
      status: await readMainStatus(page),
      quick_actions: await readQuickActions(page),
      batch_ui: await readBatchUi(page),
      recent_ui: await readRecentUi(page),
    };
    ensure(summary.after_retry_failed.batch_ui.items.some((item) => item.path === retryTargetPath && item.status === "opened"), `Expected retried batch item to open successfully, got ${JSON.stringify(summary.after_retry_failed.batch_ui.items)}`);

    await clickVisibleButton(page, "#desktop-batch-export");
    await waitForStatusContains(page, "Exported desktop batch report:");
    const batchReports = fs.readdirSync(exportDir)
      .filter((entry) => entry.startsWith("vemcad_desktop_batch_report_") && entry.endsWith(".json"))
      .sort();
    ensure(batchReports.length > 0, `Expected exported batch report in ${exportDir}`);
    const exportedBatchReportPath = path.join(exportDir, batchReports[batchReports.length - 1]);
    const exportedBatchReport = JSON.parse(fs.readFileSync(exportedBatchReportPath, "utf8"));
    summary.after_export_batch_report = {
      status: await readMainStatus(page),
      exported_report_path: exportedBatchReportPath,
      exported_report: exportedBatchReport,
    };
    ensure(exportedBatchReport.schema === "vemcad.desktop.batch_report.v1", `Expected exported batch report schema, got ${JSON.stringify(exportedBatchReport)}`);
    ensure(Array.isArray(exportedBatchReport.batch?.items) && exportedBatchReport.batch.items.some((item) => item.path === retryTargetPath && item.status === "opened"), `Expected exported batch report to include opened retry target, got ${JSON.stringify(exportedBatchReport)}`);
    ensure(threeCdnRequests.length === 0, `Expected no unpkg three requests, got ${threeCdnRequests.join(", ")}`);
    ensure(fontCdnRequests.length === 0, `Expected no Google Fonts requests, got ${fontCdnRequests.join(", ")}`);

    await closeAppInstance(electronApp);
    electronApp = null;
    page = null;
    summary.ok = true;
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.message || error);
    if (page) {
      try {
        summary.last_known_status = {
          status: await readMainStatus(page),
          quick_actions: await readQuickActions(page),
          batch_ui: await readBatchUi(page),
          recent_ui: await readRecentUi(page),
        };
      } catch (readError) {
        summary.last_known_status_error = String(readError?.message || readError);
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
