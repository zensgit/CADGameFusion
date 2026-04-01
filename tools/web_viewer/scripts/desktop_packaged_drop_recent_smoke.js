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

const DEFAULT_OUTDIR = path.join(repoRoot, "build", "desktop_packaged_drop_recent_smoke");
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
    "Usage: node tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js [--outdir <dir>] [--app <path>] [--input-dwg <path>] [--input-dwg-alt <path>] [--pack-if-needed]",
    "",
    "Launches the real packaged VemCAD app and verifies drag-drop CAD open plus recent-files UI/menu sync.",
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

async function readMainStatus(page) {
  return page.evaluate(() => String(document.querySelector("#status")?.textContent || "").trim());
}

async function readRecentUi(page) {
  return page.evaluate(() => ({
    sectionVisible: !document.querySelector("#recent-files-section")?.classList.contains("is-hidden"),
    clearVisible: !document.querySelector("#recent-files-clear")?.classList.contains("is-hidden"),
    emptyVisible: !document.querySelector("#recent-files-empty")?.classList.contains("is-hidden"),
    entries: Array.from(document.querySelectorAll(".recent-file-btn")).map((button) => ({
      label: String(button.textContent || "").trim(),
      path: String(button.dataset.path || ""),
      disabled: !!button.disabled,
    })),
  }));
}

async function readRecentBridgeState(page) {
  return page.evaluate(async () => {
    if (!window.vemcadDesktop || typeof window.vemcadDesktop.getRecentCadFiles !== "function") {
      return { entries: [] };
    }
    return await window.vemcadDesktop.getRecentCadFiles();
  });
}

async function readDropOverlayVisible(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector("#cad-drop-overlay");
    return Boolean(overlay && !overlay.classList.contains("is-hidden"));
  });
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

async function simulateCadDragEnter(page, filePath) {
  await page.evaluate((inputPath) => {
    const viewport = document.querySelector(".viewport");
    const dataTransfer = {
      files: [{ path: inputPath, name: String(inputPath).split(/[\\/]/).pop() || "" }],
      types: ["Files"],
      getData: () => "",
    };
    const event = new Event("dragenter", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    viewport.dispatchEvent(event);
  }, filePath);
}

async function simulateCadDrop(page, filePath) {
  await page.evaluate((inputPath) => {
    const viewport = document.querySelector(".viewport");
    const dataTransfer = {
      files: [{ path: inputPath, name: String(inputPath).split(/[\\/]/).pop() || "" }],
      types: ["Files"],
      getData: (type) => (type === "text/plain" ? inputPath : ""),
    };
    for (const type of ["dragenter", "dragover", "drop"]) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      viewport.dispatchEvent(event);
    }
  }, filePath);
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

function findRecentMenuLabels(menuState = []) {
  for (const item of menuState) {
    if (item.label !== "File") {
      continue;
    }
    const openRecent = (item.submenu || []).find((child) => child.label === "Open Recent CAD");
    if (!openRecent) {
      return [];
    }
    return (openRecent.submenu || [])
      .filter((child) => child.label && child.label !== "Clear Recent CAD Files")
      .map((child) => child.label);
  }
  return [];
}

function documentLabelForPath(filePath) {
  return path.basename(filePath, path.extname(filePath));
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
    const secondLabel = documentLabelForPath(inputDwgAlt);
    const routerPort = await findFreePort();
    const routerUrl = `http://127.0.0.1:${routerPort}`;
    const exportDir = path.join(outdir, "exported_diagnostics");
    const smokeHome = path.join(outdir, "smoke_home");
    const userDataDir = path.join(smokeHome, "user-data");
    ensureDir(exportDir);
    ensureDir(userDataDir);

    summary.app = appBinary;
    summary.input_dwg = inputDwg;
    summary.input_dwg_alt = inputDwgAlt;
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
      bridge_recent: await readRecentBridgeState(page),
      recent_ui: await readRecentUi(page),
    };
    ensure(summary.after_ready.recent_ui.entries.length === 0, `Expected empty recent UI on clean profile, got ${JSON.stringify(summary.after_ready.recent_ui)}`);

    await simulateCadDragEnter(page, inputDwg);
    summary.after_drag_enter = {
      overlay_visible: await readDropOverlayVisible(page),
    };
    ensure(summary.after_drag_enter.overlay_visible, "Expected dragenter to reveal CAD drop overlay");

    await simulateCadDrop(page, inputDwg);
    await waitForOpenedLabel(page, firstLabel);
    await page.waitForFunction((expectedPath) => {
      return Array.from(document.querySelectorAll(".recent-file-btn")).some((button) => String(button.dataset.path || "") === expectedPath);
    }, inputDwg, { timeout: 30000 });
    summary.after_first_drop = {
      status: await readMainStatus(page),
      overlay_visible: await readDropOverlayVisible(page),
      recent_ui: await readRecentUi(page),
      bridge_recent: await readRecentBridgeState(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(matchesOpenedLabel(summary.after_first_drop.status, firstLabel), `Expected first drop to open ${firstLabel}, got ${summary.after_first_drop.status}`);
    ensure(summary.after_first_drop.recent_ui.entries[0]?.path === inputDwg, `Expected first recent UI entry to be ${inputDwg}, got ${JSON.stringify(summary.after_first_drop.recent_ui.entries)}`);
    ensure(findRecentMenuLabels(summary.after_first_drop.menu_state)[0] === firstLabel, `Expected recent menu to list ${firstLabel}, got ${JSON.stringify(findRecentMenuLabels(summary.after_first_drop.menu_state))}`);
    ensure(summary.after_first_drop.overlay_visible === false, "Expected drop overlay to hide after first drop");

    await simulateCadDrop(page, inputDwgAlt);
    await waitForOpenedLabel(page, secondLabel);
    await page.waitForFunction((expectedPath) => {
      return document.querySelector(".recent-file-btn")?.dataset.path === expectedPath;
    }, inputDwgAlt, { timeout: 30000 });
    summary.after_second_drop = {
      status: await readMainStatus(page),
      recent_ui: await readRecentUi(page),
      bridge_recent: await readRecentBridgeState(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(matchesOpenedLabel(summary.after_second_drop.status, secondLabel), `Expected second drop to open ${secondLabel}, got ${summary.after_second_drop.status}`);
    ensure(summary.after_second_drop.recent_ui.entries[0]?.path === inputDwgAlt, `Expected top recent UI entry to be ${inputDwgAlt}, got ${JSON.stringify(summary.after_second_drop.recent_ui.entries)}`);
    ensure(summary.after_second_drop.recent_ui.entries[1]?.path === inputDwg, `Expected second recent UI entry to be ${inputDwg}, got ${JSON.stringify(summary.after_second_drop.recent_ui.entries)}`);
    ensure(findRecentMenuLabels(summary.after_second_drop.menu_state).slice(0, 2).join("|") === [secondLabel, firstLabel].join("|"), `Expected recent menu order ${secondLabel}, ${firstLabel}; got ${JSON.stringify(findRecentMenuLabels(summary.after_second_drop.menu_state))}`);

    await page.click(`.recent-file-btn[data-path="${inputDwg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`);
    await waitForOpenedLabel(page, firstLabel);
    await page.waitForFunction((expectedPath) => {
      return document.querySelector(".recent-file-btn")?.dataset.path === expectedPath;
    }, inputDwg, { timeout: 30000 });
    summary.after_recent_replay = {
      status: await readMainStatus(page),
      recent_ui: await readRecentUi(page),
      bridge_recent: await readRecentBridgeState(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(matchesOpenedLabel(summary.after_recent_replay.status, firstLabel), `Expected recent replay to reopen ${firstLabel}, got ${summary.after_recent_replay.status}`);
    ensure(summary.after_recent_replay.recent_ui.entries[0]?.path === inputDwg, `Expected replayed file to move to top of UI recents, got ${JSON.stringify(summary.after_recent_replay.recent_ui.entries)}`);
    ensure(findRecentMenuLabels(summary.after_recent_replay.menu_state).slice(0, 2).join("|") === [firstLabel, secondLabel].join("|"), `Expected recent menu order ${firstLabel}, ${secondLabel}; got ${JSON.stringify(findRecentMenuLabels(summary.after_recent_replay.menu_state))}`);

    await page.click("#recent-files-clear");
    await page.waitForFunction(() => document.querySelectorAll(".recent-file-btn").length === 0, null, { timeout: 30000 });
    summary.after_recent_clear = {
      status: await readMainStatus(page),
      recent_ui: await readRecentUi(page),
      bridge_recent: await readRecentBridgeState(page),
      menu_state: await readAppMenuState(electronApp),
    };
    ensure(summary.after_recent_clear.recent_ui.entries.length === 0, `Expected recent UI to clear, got ${JSON.stringify(summary.after_recent_clear.recent_ui.entries)}`);
    ensure((summary.after_recent_clear.bridge_recent.entries || []).length === 0, `Expected recent bridge state to clear, got ${JSON.stringify(summary.after_recent_clear.bridge_recent)}`);
    ensure(findRecentMenuLabels(summary.after_recent_clear.menu_state)[0] === "No Recent CAD Files", `Expected empty recent menu placeholder, got ${JSON.stringify(findRecentMenuLabels(summary.after_recent_clear.menu_state))}`);
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
          recent_ui: await readRecentUi(page),
          bridge_recent: await readRecentBridgeState(page),
          overlay_visible: await readDropOverlayVisible(page),
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
