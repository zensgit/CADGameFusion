const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require("electron");
const { spawn, execFile } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");
const {
  extractCadOpenPathsFromCommandLine,
  normalizeCadOpenPath,
} = require("./open_file_handoff");
const {
  canRegisterMacFileAssociations,
  resolveLaunchServicesRegisterTool,
  resolveMacAppBundlePath,
} = require("./launch_services_registration");

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DEFAULT_ROUTER_URL = "http://127.0.0.1:9000";
const DEFAULT_PACKAGED_ROUTER_URL = "http://127.0.0.1:19100";
const DEFAULT_ROUTER_EMIT = "json,gltf,meta";
const DEFAULT_ROUTER_TIMEOUT_MS = 60000;
const DEFAULT_DWG_TIMEOUT_MS = 60000;
const DEFAULT_ROUTER_START_TIMEOUT_MS = 15000;
const DEFAULT_ROUTER_HEALTH_TIMEOUT_MS = 1500;
const DEFAULT_SMOKE_VIEWER_TIMEOUT_MS = 30000;
const MAX_RECENT_CAD_FILES = 8;
const RECENT_CAD_FILES_STORE = "recent_cad_files.json";

let routerProcess = null;
let routerStartPromise = null;
let routerCleanupRegistered = false;
let mainWindow = null;
let rendererCadOpenReady = false;
let pendingCadOpenPaths = [];
let recentCadFiles = [];
let recentCadFilesLoaded = false;

function getDefaultRouterUrl() {
  return app.isPackaged ? DEFAULT_PACKAGED_ROUTER_URL : DEFAULT_ROUTER_URL;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv.length > index + 1) {
    return process.argv[index + 1];
  }
  return "";
}

const HEADLESS_SMOKE_DWG_MODE = Boolean(getArg("--smoke-dwg"));
const HAS_SINGLE_INSTANCE_LOCK = HEADLESS_SMOKE_DWG_MODE ? true : app.requestSingleInstanceLock();
if (!HAS_SINGLE_INSTANCE_LOCK) {
  app.quit();
}

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

function queueCadOpenPath(candidate, cwd = process.cwd()) {
  const resolved = normalizeCadOpenPath(candidate, cwd);
  if (!resolved || pendingCadOpenPaths.includes(resolved)) {
    return "";
  }
  pendingCadOpenPaths.push(resolved);
  return resolved;
}

function queueCadOpenPathsFromArgv(argv = [], cwd = process.cwd()) {
  const queued = [];
  for (const candidate of extractCadOpenPathsFromCommandLine(argv, cwd)) {
    const resolved = queueCadOpenPath(candidate, cwd);
    if (resolved) {
      queued.push(resolved);
    }
  }
  return queued;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function flushPendingCadOpenPaths() {
  if (!rendererCadOpenReady || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  while (pendingCadOpenPaths.length > 0) {
    const filePath = pendingCadOpenPaths.shift();
    sendOpenCadRequest({ path: filePath });
  }
  focusMainWindow();
}

function ensureCadOpenWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  focusMainWindow();
  flushPendingCadOpenPaths();
}

function getRecentCadFilesStorePath() {
  return path.join(app.getPath("userData"), RECENT_CAD_FILES_STORE);
}

function normalizeRecentCadFileEntry(entry = {}) {
  const resolvedPath = normalizeCadOpenPath(entry.path);
  if (!resolvedPath) {
    return null;
  }
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  const fallbackLabel = path.basename(resolvedPath, path.extname(resolvedPath)) || path.basename(resolvedPath);
  const lastOpenedAt = typeof entry.lastOpenedAt === "string" && entry.lastOpenedAt.trim()
    ? entry.lastOpenedAt.trim()
    : new Date(0).toISOString();
  return {
    path: resolvedPath,
    label: label || fallbackLabel,
    lastOpenedAt,
  };
}

function loadRecentCadFiles() {
  if (recentCadFilesLoaded) {
    return recentCadFiles;
  }
  recentCadFilesLoaded = true;
  try {
    const storePath = getRecentCadFilesStorePath();
    if (!fs.existsSync(storePath)) {
      recentCadFiles = [];
      return recentCadFiles;
    }
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw);
    recentCadFiles = Array.isArray(parsed)
      ? parsed
          .map((entry) => normalizeRecentCadFileEntry(entry))
          .filter(Boolean)
          .slice(0, MAX_RECENT_CAD_FILES)
      : [];
  } catch {
    recentCadFiles = [];
  }
  return recentCadFiles;
}

function persistRecentCadFiles() {
  const storePath = getRecentCadFilesStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(recentCadFiles, null, 2)}\n`, "utf8");
}

function listRecentCadFiles() {
  return loadRecentCadFiles().map((entry) => ({
    ...entry,
    fileName: path.basename(entry.path),
    directory: path.dirname(entry.path),
    extension: path.extname(entry.path).replace(/^\./, "").toLowerCase(),
    exists: fs.existsSync(entry.path),
  }));
}

function broadcastRecentCadFilesChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("vemcad:recent-cad-files-changed", {
    entries: listRecentCadFiles(),
  });
}

function syncRecentCadFilesUi() {
  if (app.isReady()) {
    installAppMenu();
  }
  broadcastRecentCadFilesChanged();
}

function rememberRecentCadFile(filePath, label = "") {
  const normalizedEntry = normalizeRecentCadFileEntry({
    path: filePath,
    label,
    lastOpenedAt: new Date().toISOString(),
  });
  if (!normalizedEntry) {
    return listRecentCadFiles();
  }
  const nextEntries = [
    normalizedEntry,
    ...loadRecentCadFiles().filter((entry) => entry.path !== normalizedEntry.path),
  ].slice(0, MAX_RECENT_CAD_FILES);
  recentCadFiles = nextEntries;
  persistRecentCadFiles();
  try {
    app.addRecentDocument(normalizedEntry.path);
  } catch {
    // Optional OS integration only.
  }
  syncRecentCadFilesUi();
  return listRecentCadFiles();
}

function clearRecentCadFiles() {
  loadRecentCadFiles();
  recentCadFiles = [];
  persistRecentCadFiles();
  try {
    app.clearRecentDocuments();
  } catch {
    // Optional OS integration only.
  }
  syncRecentCadFilesUi();
  return listRecentCadFiles();
}

function registerDesktopFileAssociations() {
  if (process.platform !== "darwin") {
    return Promise.resolve({
      ok: false,
      error: "File-association registration is only available on macOS.",
      error_code: "FILE_ASSOCIATIONS_UNSUPPORTED_PLATFORM",
    });
  }
  const appBundlePath = resolveMacAppBundlePath(process.execPath);
  if (!appBundlePath || !fs.existsSync(appBundlePath)) {
    return Promise.resolve({
      ok: false,
      error: "Packaged app bundle path not available for registration.",
      error_code: "FILE_ASSOCIATIONS_APP_BUNDLE_NOT_FOUND",
    });
  }
  const toolPath = resolveLaunchServicesRegisterTool();
  if (!canRegisterMacFileAssociations(process.execPath, toolPath)) {
    return Promise.resolve({
      ok: false,
      error: "macOS LaunchServices registration tool not available.",
      error_code: "FILE_ASSOCIATIONS_TOOL_NOT_FOUND",
    });
  }
  return new Promise((resolve) => {
    execFile(toolPath, ["-f", appBundlePath], { encoding: "utf8" }, (error, stdout = "", stderr = "") => {
      if (error) {
        resolve({
          ok: false,
          error: error.message || "LaunchServices registration failed.",
          error_code: "FILE_ASSOCIATIONS_REGISTER_FAILED",
          app_bundle: appBundlePath,
          tool: toolPath,
          stdout,
          stderr,
        });
        return;
      }
      resolve({
        ok: true,
        app_bundle: appBundlePath,
        tool: toolPath,
        stdout,
        stderr,
      });
    });
  });
}

function resolveSmokeOpenFileSelection() {
  const explicit =
    getArg("--smoke-open-file") ||
    process.env.VEMCAD_SMOKE_OPEN_FILE_PATH ||
    process.env.CADGF_SMOKE_OPEN_FILE_PATH ||
    "";
  if (!explicit) {
    return { configured: false, path: "" };
  }
  return {
    configured: true,
    path: path.resolve(explicit),
  };
}

function resolvePythonExecutable() {
  return (
    process.env.VEMCAD_PYTHON_BIN ||
    process.env.CADGF_PYTHON_BIN ||
    (process.platform === "win32" ? "python" : "python3")
  );
}

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || "";
}

function sanitizeSuggestedFilename(value, fallback = "vemcad_export.json") {
  const base = path.basename(String(value || fallback).trim() || fallback);
  const sanitized = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return sanitized || fallback;
}

function resolveDesktopExportDir() {
  return (
    process.env.VEMCAD_DESKTOP_EXPORT_DIR ||
    process.env.CADGF_DESKTOP_EXPORT_DIR ||
    ""
  );
}

function resolveDwg2DxfBinary(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const explicitOverride = getExplicitStringSetting(opts, "dwg2dxfBin");
  if (explicitOverride !== null) {
    return explicitOverride;
  }
  const explicit =
    process.env.VEMCAD_DWG2DXF_BIN ||
    process.env.CADGF_DWG2DXF_BIN ||
    process.env.DWG2DXF_BIN ||
    "";
  if (explicit) {
    return explicit;
  }
  const bundledBinaryNames = process.platform === "win32" ? ["dwg2dxf.exe"] : ["dwg2dxf"];
  const bundledCandidates = getBundledCadResourceRoots().flatMap((root) =>
    bundledBinaryNames.flatMap((name) => [
      path.join(root, "dwg_service", "bin", name),
      path.join(root, "tools", name),
      path.join(root, "bin", name),
    ])
  );
  const bundledBinary = pickFirstExistingPath(bundledCandidates);
  if (bundledBinary) {
    return bundledBinary;
  }
  const candidates = [
    "/usr/local/bin/dwg2dxf",
    "/opt/homebrew/bin/dwg2dxf",
    "/opt/local/bin/dwg2dxf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function resolveDwgPluginPath(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const explicitOverride = getExplicitStringSetting(opts, "dwgPluginPath");
  if (explicitOverride !== null) {
    return explicitOverride;
  }
  const explicit =
    getArg("--dwg-plugin") ||
    process.env.VEMCAD_DWG_PLUGIN ||
    process.env.CADGF_DWG_PLUGIN ||
    "";
  if (explicit) {
    return explicit;
  }
  return detectRouterPaths().dwgPluginPath || "";
}

function normalizeDwgRouteMode(value) {
  const normalized = coerceString(value).toLowerCase();
  if (normalized === "direct-plugin" || normalized === "local-convert") {
    return normalized;
  }
  return "auto";
}

function resolveDwgRouteMode(overrides = {}) {
  const opts = normalizeSettings(overrides);
  return normalizeDwgRouteMode(
    opts.dwgRouteMode ||
    getArg("--dwg-route") ||
    process.env.VEMCAD_DWG_ROUTE_MODE ||
    process.env.CADGF_DWG_ROUTE_MODE ||
    "auto"
  );
}

function resolveDwgReadiness(overrides = {}) {
  const normalized = normalizeSettings(overrides);
  const config = resolveDwgConfig(normalized);
  const dwg2dxf = resolveDwg2DxfBinary(normalized);
  const dwgPluginPath = resolveDwgPluginPath(normalized);
  const cadRuntime = detectCadRuntime();
  const dwgServicePath = detectDwgServicePath(normalized);
  const directPluginReady = !!dwgPluginPath;
  const localConvertReady = !!config.dwgConvertCmd;
  const routeMode = resolveDwgRouteMode(normalized);
  let route = "";
  if (routeMode === "direct-plugin") {
    route = directPluginReady ? "direct-plugin" : "";
  } else if (routeMode === "local-convert") {
    route = localConvertReady ? "local-convert" : "";
  } else {
    route = directPluginReady ? "direct-plugin" : (localConvertReady ? "local-convert" : "");
  }
  return {
    route,
    route_mode: routeMode,
    direct_plugin_ready: directPluginReady,
    local_convert_ready: localConvertReady,
    dwg_plugin_path: dwgPluginPath,
    dwg_convert_cmd: config.dwgConvertCmd,
    dwg2dxf_bin: dwg2dxf,
    dwg_service_path: dwgServicePath,
    cad_runtime_root: cadRuntime.cadRuntimeRoot,
    cad_runtime_source: cadRuntime.cadRuntimeSource,
    cad_runtime_ready: cadRuntime.cadRuntimeReady,
    router_service_path: cadRuntime.routerServicePath,
    plm_convert_path: cadRuntime.plmConvertPath,
    viewer_root: cadRuntime.viewerRoot,
  };
}

function buildDwgNotReadyHint(readiness = {}) {
  if (readiness.route) {
    return "";
  }
  if (readiness.route_mode === "direct-plugin") {
    return "DWG Route Mode is Direct Plugin. Set DWG Plugin Path, or switch route mode back to Auto or Local Convert in Settings.";
  }
  if (readiness.route_mode === "local-convert") {
    return "DWG Route Mode is Local Convert. Set DWG Convert Command, or switch route mode back to Auto or Direct Plugin in Settings.";
  }
  return "Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.";
}

function buildOpenFailureHint(result = {}, prepared = {}, overrides = {}) {
  const errorCode = coerceString(result.error_code || prepared.error_code).toUpperCase();
  if (errorCode === "DWG_NOT_READY") {
    return buildDwgNotReadyHint({
      ...resolveDwgReadiness(overrides),
      ...prepared,
      ...result,
    });
  }
  if (
    errorCode === "ROUTER_NOT_CONFIGURED" ||
    errorCode === "ROUTER_NOT_AVAILABLE" ||
    errorCode === "ROUTER_START_NOT_CONFIGURED" ||
    errorCode === "ROUTER_START_FAILED" ||
    errorCode === "ROUTER_START_TIMEOUT"
  ) {
    return buildRouterRecoveryHint({
      ...resolveRouterReadiness(overrides),
      ...prepared,
      ...result,
    }, errorCode);
  }
  return "";
}

function getCadgfRootCandidates() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const home = getHomeDir();
  const candidates = [repoRoot];
  if (home) {
    candidates.push(
      path.join(home, "Downloads", "Github", "CADGameFusion"),
      path.join(home, "Downloads", "GitHub", "CADGameFusion"),
      path.join(home, "Github", "CADGameFusion"),
      path.join(home, "GitHub", "CADGameFusion")
    );
  }
  return candidates;
}

function getBundledCadResourceRoots() {
  const explicit =
    process.env.VEMCAD_DESKTOP_RESOURCE_ROOT ||
    process.env.CADGF_DESKTOP_RESOURCE_ROOT ||
    "";
  const packagedCandidates = [
    path.join(process.resourcesPath || "", "cad_resources"),
    path.join(process.resourcesPath || "", "bundled_resources"),
  ];
  const devCandidates = [
    path.join(__dirname, "bundled_resources"),
    ...packagedCandidates,
  ];
  const candidates = [
    explicit,
    ...(app.isPackaged ? packagedCandidates : devCandidates),
  ];
  const roots = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (!roots.includes(resolved)) {
      roots.push(resolved);
    }
  }
  return roots;
}

function getCadRuntimeCandidates() {
  const explicit =
    process.env.VEMCAD_DESKTOP_RESOURCE_ROOT ||
    process.env.CADGF_DESKTOP_RESOURCE_ROOT ||
    "";
  const packagedCandidates = [
    { root: path.join(process.resourcesPath || "", "cad_resources"), source: "packaged-cad-resources" },
    { root: path.join(process.resourcesPath || "", "bundled_resources"), source: "packaged-bundled-resources" },
  ];
  const devCandidates = [
    { root: path.join(__dirname, "bundled_resources"), source: "dev-bundled-resources" },
    ...packagedCandidates,
  ];
  const repoCandidates = getCadgfRootCandidates().map((root) => ({
    root,
    source: "repo-root",
  }));
  const ordered = [
    ...(explicit ? [{ root: explicit, source: "explicit-resource-root" }] : []),
    ...(app.isPackaged ? packagedCandidates : devCandidates),
    ...repoCandidates,
  ];
  const candidates = [];
  for (const entry of ordered) {
    if (!entry.root) continue;
    const resolved = path.resolve(entry.root);
    if (!candidates.some((candidate) => candidate.root === resolved)) {
      candidates.push({ root: resolved, source: entry.source });
    }
  }
  return candidates;
}

function detectCadRuntime() {
  for (const candidate of getCadRuntimeCandidates()) {
    const root = candidate.root;
    if (!root || !fs.existsSync(root)) {
      continue;
    }
    const routerServicePath = pickFirstExistingPath([
      path.join(root, "router", "plm_router_service.py"),
      path.join(root, "tools", "plm_router_service.py"),
      path.join(root, "plm_router_service.py"),
    ]) || "";
    const plmConvertPath = pickFirstExistingPath([
      path.join(root, "tools", "plm_convert.py"),
      path.join(root, "plm_convert.py"),
    ]) || "";
    const viewerIndexPath = pickFirstExistingPath([
      path.join(root, "tools", "web_viewer", "index.html"),
      path.join(root, "web_viewer", "index.html"),
    ]) || "";
    const documentSchemaPath = pickFirstExistingPath([
      path.join(root, "schemas", "document.schema.json"),
    ]) || "";
    const manifestSchemaPath = pickFirstExistingPath([
      path.join(root, "schemas", "plm_manifest.schema.json"),
    ]) || "";
    if (!(routerServicePath || plmConvertPath || viewerIndexPath || documentSchemaPath || manifestSchemaPath)) {
      continue;
    }
    return {
      cadRuntimeRoot: root,
      cadRuntimeSource: candidate.source,
      cadRuntimeReady: Boolean(
        routerServicePath &&
        plmConvertPath &&
        viewerIndexPath &&
        documentSchemaPath &&
        manifestSchemaPath
      ),
      routerServicePath,
      plmConvertPath,
      viewerRoot: viewerIndexPath ? path.dirname(viewerIndexPath) : "",
      documentSchemaPath,
      manifestSchemaPath,
    };
  }
  return {
    cadRuntimeRoot: "",
    cadRuntimeSource: "",
    cadRuntimeReady: false,
    routerServicePath: "",
    plmConvertPath: "",
    viewerRoot: "",
    documentSchemaPath: "",
    manifestSchemaPath: "",
  };
}

function detectRouterServiceScriptPath() {
  return detectCadRuntime().routerServicePath || "";
}

function pickFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function detectRouterPaths() {
  const bundledRoots = getBundledCadResourceRoots();
  const roots = getCadgfRootCandidates();
  const buildDirs = ["build_vcpkg", "build", "build_novcpkg"];
  const pluginExt = process.platform === "win32" ? ".dll" : (process.platform === "darwin" ? ".dylib" : ".so");
  const pluginNames = process.platform === "win32"
    ? ["cadgf_dxf_importer_plugin.dll", "libcadgf_dxf_importer_plugin.dll"]
    : [`libcadgf_dxf_importer_plugin${pluginExt}`];
  const dwgPluginNames = process.platform === "win32"
    ? ["cadgf_dwg_importer_plugin.dll", "libcadgf_dwg_importer_plugin.dll"]
    : [`libcadgf_dwg_importer_plugin${pluginExt}`];
  const convertCliNames = process.platform === "win32" ? ["convert_cli.exe"] : ["convert_cli"];

  let pluginPath = "";
  let dwgPluginPath = "";
  let convertCliPath = "";
  let repoRoot = "";

  for (const bundledRoot of bundledRoots) {
    if (!bundledRoot || !fs.existsSync(bundledRoot)) {
      continue;
    }
    if (!pluginPath) {
      const pluginCandidates = pluginNames.flatMap((name) => [
        path.join(bundledRoot, "router", "plugins", name),
        path.join(bundledRoot, "plugins", name),
      ]);
      pluginPath = pickFirstExistingPath(pluginCandidates) || pluginPath;
    }
    if (!dwgPluginPath) {
      const dwgCandidates = dwgPluginNames.flatMap((name) => [
        path.join(bundledRoot, "router", "plugins", name),
        path.join(bundledRoot, "plugins", name),
      ]);
      dwgPluginPath = pickFirstExistingPath(dwgCandidates) || dwgPluginPath;
    }
    if (!convertCliPath) {
      const convertCandidates = convertCliNames.flatMap((name) => [
        path.join(bundledRoot, "router", "tools", name),
        path.join(bundledRoot, "tools", name),
      ]);
      convertCliPath = pickFirstExistingPath(convertCandidates) || convertCliPath;
    }
    if ((pluginPath || convertCliPath || dwgPluginPath) && !repoRoot) {
      repoRoot = bundledRoot;
    }
    if (pluginPath && dwgPluginPath && convertCliPath) {
      break;
    }
  }

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) {
      continue;
    }
    for (const buildDir of buildDirs) {
      if (!pluginPath) {
        const pluginCandidates = pluginNames.map((name) =>
          path.join(root, buildDir, "plugins", name)
        );
        pluginPath = pickFirstExistingPath(pluginCandidates) || pluginPath;
      }
      if (!dwgPluginPath) {
        const dwgCandidates = dwgPluginNames.map((name) =>
          path.join(root, buildDir, "plugins", name)
        );
        dwgPluginPath = pickFirstExistingPath(dwgCandidates) || dwgPluginPath;
      }
      if (!convertCliPath) {
        const convertCandidates = convertCliNames.map((name) =>
          path.join(root, buildDir, "tools", name)
        );
        convertCliPath = pickFirstExistingPath(convertCandidates) || convertCliPath;
      }
      if (pluginPath || convertCliPath) {
        repoRoot = root;
      }
      if (pluginPath && convertCliPath) {
        break;
      }
    }
    if (pluginPath && convertCliPath) {
      break;
    }
  }
  return { pluginPath, dwgPluginPath, convertCliPath, repoRoot };
}

function parseBool(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSettings(settings) {
  if (settings && typeof settings === "object") {
    return settings;
  }
  return {};
}

function coerceString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasOwnSetting(settings, key) {
  return Boolean(settings && typeof settings === "object" && Object.prototype.hasOwnProperty.call(settings, key));
}

function getExplicitStringSetting(settings, key) {
  if (!hasOwnSetting(settings, key)) {
    return null;
  }
  return coerceString(settings[key]);
}

function getExplicitNumberSetting(settings, key) {
  if (!hasOwnSetting(settings, key)) {
    return null;
  }
  return coerceNumber(settings[key]);
}

function parseAutoStartOverride(value) {
  if (value === undefined || value === null || value === "" || value === "default") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "on") return true;
    if (normalized === "off") return false;
  }
  return parseBool(value);
}

function splitCommand(command) {
  if (!command) return [];
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function resolveDwgConfig(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const explicitDwgConvertCmd = getExplicitStringSetting(opts, "dwgConvertCmd");
  let dwgConvertCmd = explicitDwgConvertCmd !== null
    ? explicitDwgConvertCmd
    : (
      getArg("--dwg-convert-cmd") ||
      process.env.VEMCAD_DWG_CONVERT_CMD ||
      process.env.CADGF_DWG_CONVERT_CMD ||
      process.env.CADGF_ROUTER_DWG_CONVERT_CMD ||
      ""
    );
  if (!dwgConvertCmd && explicitDwgConvertCmd === null) {
    dwgConvertCmd = detectDwgConvertCmd(opts);
  }
  const timeoutValue =
    getExplicitNumberSetting(opts, "dwgTimeoutMs") ??
    Number.parseInt(
      process.env.VEMCAD_DWG_CONVERT_TIMEOUT_MS || process.env.CADGF_DWG_CONVERT_TIMEOUT_MS || "",
      10
    );
  return {
    dwgConvertCmd,
    timeoutMs: Number.isFinite(timeoutValue) ? timeoutValue : DEFAULT_DWG_TIMEOUT_MS
  };
}

function detectDwgConvertCmd(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const serviceDir = detectDwgServicePath(opts);
  if (!serviceDir) {
    return "";
  }
  const scriptPath = path.join(serviceDir, "cadgf_dwg_service.py");
  const pythonBin = resolvePythonExecutable();
  const dwg2dxf = resolveDwg2DxfBinary(opts);
  if (dwg2dxf) {
    return `${pythonBin} "${scriptPath}" convert --dwg2dxf "${dwg2dxf}"`;
  }
  return `${pythonBin} "${scriptPath}" convert`;
}

function detectDwgServicePath(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const explicitDir = getExplicitStringSetting(opts, "dwgServicePath");
  if (explicitDir !== null) {
    return explicitDir;
  }
  const configuredDir =
    process.env.VEMCAD_DWG_SERVICE_PATH ||
    process.env.VEMCAD_DWG_SERVICE_DIR ||
    process.env.CADGF_DWG_SERVICE_PATH ||
    process.env.CADGF_DWG_SERVICE_DIR ||
    "";
  const repoRoot = path.resolve(__dirname, "..", "..");
  const home = getHomeDir();
  const candidates = [
    configuredDir,
    ...getBundledCadResourceRoots().flatMap((root) => [
      path.join(root, "dwg_service"),
      path.join(root, "cadgf-dwg-service"),
    ]),
    path.join(repoRoot, "cadgf-dwg-service"),
    path.join(repoRoot, "..", "cadgf-dwg-service"),
  ];
  if (home) {
    candidates.push(
      path.join(home, "Downloads", "Github", "cadgf-dwg-service"),
      path.join(home, "Downloads", "GitHub", "cadgf-dwg-service"),
      path.join(home, "Github", "cadgf-dwg-service"),
      path.join(home, "GitHub", "cadgf-dwg-service")
    );
  }
  for (const dir of candidates) {
    if (!dir) continue;
    const scriptPath = path.join(dir, "cadgf_dwg_service.py");
    if (fs.existsSync(scriptPath)) {
      return dir;
    }
  }
  return "";
}

function resolveRouterStartConfig(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const autoStartOverride = parseAutoStartOverride(opts.routerAutoStart);
  const autoStartValue =
    autoStartOverride !== null
      ? autoStartOverride
      : getArg("--router-auto-start") || process.env.VEMCAD_ROUTER_AUTO_START || "";
  const startCmdOverride = getExplicitStringSetting(opts, "routerStartCmd");
  const startCmdValue =
    startCmdOverride !== null
      ? startCmdOverride
      : (
        getArg("--router-start-cmd") ||
        process.env.VEMCAD_ROUTER_START_CMD ||
        process.env.CADGF_ROUTER_START_CMD ||
        ""
      );
  const startCwdOverride = getExplicitStringSetting(opts, "routerStartCwd");
  const startCwdValue =
    startCwdOverride !== null
      ? startCwdOverride
      : (
        process.env.VEMCAD_ROUTER_START_CWD ||
        process.env.CADGF_ROUTER_START_CWD ||
        ""
      );
  const timeoutOverride = getExplicitNumberSetting(opts, "routerStartTimeoutMs");
  const routerUrlOverride = getExplicitStringSetting(opts, "routerUrl");
  const timeoutValue =
    timeoutOverride ??
    Number.parseInt(process.env.VEMCAD_ROUTER_START_TIMEOUT_MS || process.env.CADGF_ROUTER_START_TIMEOUT_MS || "", 10);
  const routerUrl =
    routerUrlOverride !== null
      ? routerUrlOverride
      : (
        getArg("--router-url") ||
        process.env.VEMCAD_ROUTER_URL ||
        process.env.CADGF_ROUTER_URL ||
        getDefaultRouterUrl()
      );
  const canAutostartByDefault = isLocalHost((() => {
    try {
      return new URL(routerUrl).hostname;
    } catch {
      return "";
    }
  })()) && Boolean(startCmdValue || detectRouterServiceScriptPath());
  return {
    autoStart:
      autoStartOverride !== null
        ? autoStartOverride
        : (autoStartValue ? parseBool(autoStartValue) : canAutostartByDefault),
    startCmd: startCmdValue,
    startCwd: startCwdValue,
    timeoutMs: Number.isFinite(timeoutValue) ? timeoutValue : DEFAULT_ROUTER_START_TIMEOUT_MS
  };
}

function isLocalHost(host) {
  return ["127.0.0.1", "localhost", "::1"].includes(host);
}

function resolveStartCommand(config, routerUrl, overrides = {}) {
  const startConfig = resolveRouterStartConfig(overrides);
  if (startConfig.startCmd) {
    return {
      cmd: splitCommand(startConfig.startCmd),
      cwd: startConfig.startCwd
    };
  }
  let parsed;
  try {
    parsed = new URL(routerUrl);
  } catch {
    return { cmd: [], cwd: "" };
  }
  if (!isLocalHost(parsed.hostname)) {
    return { cmd: [], cwd: "" };
  }
  const routerScript = detectRouterServiceScriptPath();
  if (!routerScript) {
    return { cmd: [], cwd: "" };
  }
  const pythonBin = resolvePythonExecutable();
  const cmd = [pythonBin, routerScript, "--host", parsed.hostname];
  if (parsed.port) {
    cmd.push("--port", parsed.port);
  }
  const detectedRouter = detectRouterPaths();
  const routerPlugin = config.plugin || detectedRouter.pluginPath || "";
  const routerConvertCli = config.convertCli || detectedRouter.convertCliPath || "";
  const pluginPath = routerPlugin
    ? (path.isAbsolute(routerPlugin) ? routerPlugin : path.join(repoRoot, routerPlugin))
    : "";
  const convertCliPath = routerConvertCli
    ? (path.isAbsolute(routerConvertCli) ? routerConvertCli : path.join(repoRoot, routerConvertCli))
    : "";
  if (pluginPath) {
    cmd.push("--default-plugin", pluginPath);
  }
  if (convertCliPath) {
    cmd.push("--default-convert-cli", convertCliPath);
  }
  if (config.authToken) {
    cmd.push("--auth-token", config.authToken);
  }
  return { cmd, cwd: path.dirname(routerScript) };
}

function quoteArg(value) {
  if (!value) return "";
  if (/\s/.test(value)) {
    return `"${value.replace(/\"/g, "\\\"")}"`;
  }
  return value;
}

function buildRouterStartCmdSuggestion(routerUrl, pluginPath, convertCliPath, repoRoot) {
  const routerScript = detectRouterServiceScriptPath();
  if (!routerScript) return "";
  let parsed;
  try {
    parsed = new URL(routerUrl);
  } catch {
    return "";
  }
  if (!isLocalHost(parsed.hostname)) {
    return "";
  }
  const pythonBin = resolvePythonExecutable();
  const args = [pythonBin, routerScript, "--host", parsed.hostname];
  if (parsed.port) {
    args.push("--port", parsed.port);
  }
  if (pluginPath) {
    args.push("--default-plugin", pluginPath);
  }
  if (convertCliPath) {
    args.push("--default-convert-cli", convertCliPath);
  }
  return args.map(quoteArg).join(" ");
}

function resolveRouterReadiness(overrides = {}) {
  const normalized = normalizeSettings(overrides);
  const config = resolveRouterConfig(normalized);
  const detectedRouter = detectRouterPaths();
  const cadRuntime = detectCadRuntime();
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  const routerPlugin = config.plugin || detectedRouter.pluginPath || "";
  const routerConvertCli = config.convertCli || detectedRouter.convertCliPath || "";
  const startConfig = resolveRouterStartConfig(normalized);
  const startSuggestion = buildRouterStartCmdSuggestion(
    routerUrl,
    routerPlugin,
    routerConvertCli,
    detectedRouter.repoRoot
  );
  const configuredStartCmd = startConfig.startCmd;
  const effectiveStartCmd = configuredStartCmd || startSuggestion;
  return {
    router_url: routerUrl,
    router_plugin: routerPlugin,
    router_convert_cli: routerConvertCli,
    router_auto_start: startConfig.autoStart ? "on" : "off",
    router_start_ready: !!effectiveStartCmd,
    router_start_source: configuredStartCmd ? "configured" : (effectiveStartCmd ? "auto-detected" : ""),
    router_start_cmd: effectiveStartCmd,
    router_start_cmd_suggested: configuredStartCmd ? startSuggestion : "",
    cad_runtime_root: cadRuntime.cadRuntimeRoot,
    cad_runtime_source: cadRuntime.cadRuntimeSource,
    cad_runtime_ready: cadRuntime.cadRuntimeReady,
    router_service_path: cadRuntime.routerServicePath,
    plm_convert_path: cadRuntime.plmConvertPath,
    viewer_root: cadRuntime.viewerRoot,
  };
}

function buildRouterRecoveryHint(readiness = {}, errorCode = "") {
  const code = coerceString(errorCode).toUpperCase();
  if (code === "ROUTER_NOT_CONFIGURED") {
    return "Set Router URL in Settings before opening CAD files.";
  }
  if (code === "ROUTER_NOT_AVAILABLE") {
    if (readiness.router_auto_start === "off") {
      return "Router Auto Start is Off. Start the router manually, or switch Router Auto Start back to Default/On in Settings.";
    }
    if (!readiness.router_start_ready) {
      return "Router is not reachable and no Router Start Command is ready. Set Router Start Command, or restore a local router URL so the desktop can auto-detect one in Settings.";
    }
    return "Router is not reachable. Review Router URL, Router Start Command, and local router dependencies in Settings.";
  }
  if (code === "ROUTER_START_NOT_CONFIGURED") {
    return "Router Auto Start is enabled, but no Router Start Command is ready. Set Router Start Command, or switch Router Auto Start Off and start the router manually.";
  }
  if (code === "ROUTER_START_FAILED") {
    if (readiness.router_start_source === "configured" && readiness.router_start_cmd_suggested) {
      return "Configured Router Start Command failed. Fix Router Start Command in Settings, or click Use Recommended to restore the detected local router start command.";
    }
    return "Check Router Start Command, Router Plugin, and Router Convert CLI in Settings.";
  }
  if (code === "ROUTER_START_TIMEOUT") {
    return "Check Router Start Command, Router Plugin, and Router Convert CLI in Settings.";
  }
  return "";
}

async function checkRouterHealth(routerUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_ROUTER_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${routerUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRouterHealth(routerUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_ROUTER_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${routerUrl}/health`, { signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        error: (data && data.error) ? data.error : text || `HTTP_${response.status}`
      };
    }
    if (data && typeof data === "object") {
      return { ok: true, data };
    }
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: error?.message || "health check failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForRouter(routerUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkRouterHealth(routerUrl)) {
      return true;
    }
    await delay(500);
  }
  return false;
}

function registerRouterCleanup() {
  if (routerCleanupRegistered) return;
  routerCleanupRegistered = true;
  app.on("before-quit", () => {
    if (routerProcess) {
      routerProcess.kill();
    }
  });
}

async function ensureRouterReady(overrides = {}) {
  const config = resolveRouterConfig(overrides);
  const readiness = resolveRouterReadiness(overrides);
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  if (!routerUrl) {
    return {
      ok: false,
      error: "Router URL not configured.",
      error_code: "ROUTER_NOT_CONFIGURED",
      hint: buildRouterRecoveryHint(readiness, "ROUTER_NOT_CONFIGURED"),
      ...readiness,
    };
  }
  if (await checkRouterHealth(routerUrl)) {
    return { ok: true, ...readiness };
  }

  const startConfig = resolveRouterStartConfig(overrides);
  if (!startConfig.autoStart) {
    return {
      ok: false,
      error: "Router not reachable. Start it or enable VEMCAD_ROUTER_AUTO_START.",
      error_code: "ROUTER_NOT_AVAILABLE",
      hint: buildRouterRecoveryHint(readiness, "ROUTER_NOT_AVAILABLE"),
      ...readiness,
    };
  }

  if (routerStartPromise) {
    return routerStartPromise;
  }

  routerStartPromise = (async () => {
    const { cmd, cwd } = resolveStartCommand(config, routerUrl, overrides);
    if (!cmd.length) {
      return {
        ok: false,
        error: "Router start command not configured. Set VEMCAD_ROUTER_START_CMD.",
        error_code: "ROUTER_START_NOT_CONFIGURED",
        hint: buildRouterRecoveryHint(readiness, "ROUTER_START_NOT_CONFIGURED"),
        ...readiness,
      };
    }
    let spawnErrorPromise = null;
    try {
      routerProcess = spawn(cmd[0], cmd.slice(1), { cwd: cwd || undefined, stdio: "ignore" });
      registerRouterCleanup();
      const startedProcess = routerProcess;
      spawnErrorPromise = new Promise((resolve) => {
        startedProcess.once("error", (error) => {
          if (routerProcess === startedProcess) {
            routerProcess = null;
          }
          resolve(error);
        });
      });
      startedProcess.on("exit", () => {
        if (routerProcess === startedProcess) {
          routerProcess = null;
        }
      });
    } catch (error) {
      routerProcess = null;
      return {
        ok: false,
        error: `Failed to start router: ${error?.message || "unknown error"}`,
        error_code: "ROUTER_START_FAILED",
        hint: buildRouterRecoveryHint(readiness, "ROUTER_START_FAILED"),
        ...readiness,
      };
    }

    const readyState = await Promise.race([
      waitForRouter(routerUrl, startConfig.timeoutMs).then((ready) => ({ type: "ready", ready })),
      spawnErrorPromise.then((error) => ({ type: "error", error })),
    ]);
    if (readyState.type === "error") {
      return {
        ok: false,
        error: `Failed to start router: ${readyState.error?.message || "unknown error"}`,
        error_code: "ROUTER_START_FAILED",
        hint: buildRouterRecoveryHint(readiness, "ROUTER_START_FAILED"),
        ...readiness,
      };
    }
    const ready = readyState.ready;
    if (!ready) {
      return {
        ok: false,
        error: "Router did not become ready in time.",
        error_code: "ROUTER_START_TIMEOUT",
        hint: buildRouterRecoveryHint(readiness, "ROUTER_START_TIMEOUT"),
        ...readiness,
      };
    }
    return { ok: true, started: true, ...readiness };
  })();

  const result = await routerStartPromise;
  routerStartPromise = null;
  return result;
}

function buildDwgConvertCommand(template, inputPath, outputPath) {
  if (!template) return [];
  if (template.includes("{input}") || template.includes("{output}")) {
    const rendered = template
      .replaceAll("{input}", inputPath)
      .replaceAll("{output}", outputPath);
    return splitCommand(rendered);
  }
  const tokens = splitCommand(template);
  return tokens.concat([inputPath, outputPath]);
}

async function runDwgConvert(command, timeoutMs) {
  if (!command.length) {
    return { ok: false, error: "DWG converter command missing.", error_code: "DWG_CONVERT_NOT_CONFIGURED" };
  }
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    const killSignal = process.platform === "win32" ? "SIGTERM" : "SIGKILL";
    const timer = setTimeout(() => {
      child.kill(killSignal);
      resolve({ ok: false, error: "DWG conversion timed out.", error_code: "DWG_CONVERT_TIMEOUT" });
    }, timeoutMs);

    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, error_code: "DWG_CONVERT_FAILED" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const message = stderr.trim() || stdout.trim() || `DWG conversion failed (${code}).`;
        resolve({ ok: false, error: message, error_code: "DWG_CONVERT_FAILED" });
        return;
      }
      resolve({ ok: true });
    });
  });
}

// P2.5: tryConvertDwg — attempt a single converter cmd and return { ok, dxfPath, converter }.
// outputDir must already exist. On success the caller owns the produced file.
async function tryConvertDwg(inputPath, outputDir, converterCmd, timeoutMs, converterLabel) {
  const baseName = path.parse(inputPath).name || path.basename(inputPath);
  const outputPath = path.join(outputDir, `${baseName}.dxf`);
  const cmd = buildDwgConvertCommand(converterCmd, inputPath, outputPath);
  const result = await runDwgConvert(cmd, timeoutMs);
  if (!result.ok) {
    return { ok: false, converter: converterLabel, error: result.error, error_code: result.error_code };
  }
  if (!fs.existsSync(outputPath)) {
    return { ok: false, converter: converterLabel, error: "DWG conversion did not produce output.", error_code: "DWG_CONVERT_FAILED" };
  }
  return { ok: true, dxfPath: outputPath, converter: converterLabel };
}

// P2.5: Build ODA File Converter command template (outputs DXF in outputDir).
function buildOdaConverterCmd(inputPath, outputDir) {
  // ODAFileConverter <input_folder> <output_folder> <version> <format> <recurse> <audit>
  // We pass the file's parent dir as input folder; ODA converts all DWGs found there.
  // The caller passes the same tmpDir as outputDir so ODA writes <basename>.dxf there.
  // No {input}/{output} tokens — buildDwgConvertCommand will treat this as a full command.
  const inputDir = path.dirname(inputPath);
  return `ODAFileConverter "${inputDir}" "${outputDir}" ACAD2018 DXF 0 1`;
}

// P2.5: Build QCAD command template.
function buildQcadConverterCmd() {
  // qcad -allow-multiple-instances -no-gui -autorun scripts/Convert/Convert.js -src {input} -dst {output}
  return `qcad -allow-multiple-instances -no-gui -autorun scripts/Convert/Convert.js -src {input} -dst {output}`;
}

async function maybeConvertDwg(filePath, settings = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".dwg") {
    return { ok: true, path: filePath, labelOverride: "" };
  }
  const config = resolveDwgConfig(settings);

  // P2.5: DWG converter cascade — LibreDWG → ODA → QCAD.
  // Build the candidate list; each entry has { label, cmd }.
  const candidates = [];

  // 1. LibreDWG (dwg2dxf) — the primary converter, driven by existing config.
  if (config.dwgConvertCmd) {
    candidates.push({ label: "LibreDWG", cmd: config.dwgConvertCmd });
  }

  // 2. ODA File Converter — separate CLI shape; use a fixed template.
  candidates.push({ label: "ODA", cmd: buildOdaConverterCmd(filePath, "PLACEHOLDER_OUTPUT_DIR") });

  // 3. QCAD — {input}/{output} template.
  candidates.push({ label: "QCAD", cmd: buildQcadConverterCmd() });

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "DWG converter not configured or auto-detected. Set VEMCAD_DWG_CONVERT_CMD.",
      error_code: "DWG_CONVERT_NOT_CONFIGURED"
    };
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vemcad-dwg-"));
  const baseName = path.parse(filePath).name || path.basename(filePath);
  let lastError = null;

  for (const candidate of candidates) {
    // For ODA the output dir is the tmpDir we already created; rebuild its cmd with the real dir.
    const effectiveCmd = candidate.label === "ODA"
      ? buildOdaConverterCmd(filePath, tmpDir)
      : candidate.cmd;

    const attempt = await tryConvertDwg(filePath, tmpDir, effectiveCmd, config.timeoutMs, candidate.label);
    if (attempt.ok) {
      console.log(`[DWG] converter cascade: ${candidate.label} succeeded for ${path.basename(filePath)}`);
      return { ok: true, path: attempt.dxfPath, cleanupDir: tmpDir, labelOverride: baseName };
    }
    console.log(`[DWG] converter cascade: ${candidate.label} failed — ${attempt.error}`);
    lastError = attempt;
  }

  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  return {
    ok: false,
    error: lastError?.error || "All DWG converters failed.",
    error_code: lastError?.error_code || "DWG_CONVERT_FAILED"
  };
}

async function resolveDwgOpenPlan(filePath, settings = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const readiness = resolveDwgReadiness(settings);
  if (ext !== ".dwg") {
    return {
      ok: true,
      route: "passthrough",
      route_mode: readiness.route_mode,
      path: filePath,
      labelOverride: "",
      cleanupDir: "",
      routerPlugin: coerceString(normalizeSettings(settings).routerPlugin),
      dwgPluginPath: "",
    };
  }

  if (readiness.direct_plugin_ready) {
    if (readiness.route === "direct-plugin") {
      return {
        ok: true,
        route: "direct-plugin",
        route_mode: readiness.route_mode,
        path: filePath,
        labelOverride: "",
        cleanupDir: "",
        routerPlugin: readiness.dwg_plugin_path,
        dwgPluginPath: readiness.dwg_plugin_path,
      };
    }
  }

  if (!readiness.route) {
    return {
      ok: false,
      error: "DWG open path not configured. Provide a DWG plugin path or a DWG converter command.",
      error_code: "DWG_NOT_READY",
      hint: buildDwgNotReadyHint(readiness),
      ...readiness,
    };
  }

  const prepared = await maybeConvertDwg(filePath, settings);
  return {
    ...prepared,
    route: prepared.ok ? "local-convert" : "unavailable",
    route_mode: readiness.route_mode,
    routerPlugin: coerceString(normalizeSettings(settings).routerPlugin),
    dwgPluginPath: "",
  };
}

function attachDwgOpenFacts(result = {}, prepared = {}) {
  return {
    ...result,
    route: result.route || prepared.route || "",
    route_mode: result.route_mode || prepared.route_mode || "",
    dwg_plugin_path: result.dwg_plugin_path || prepared.dwgPluginPath || "",
    router_plugin: result.router_plugin || prepared.routerPlugin || "",
  };
}

function attachOpenResultDiagnostics(result = {}, prepared = {}, overrides = {}) {
  const merged = attachDwgOpenFacts(result, prepared);
  if (merged.ok || merged.canceled || merged.hint) {
    return merged;
  }
  const hint = buildOpenFailureHint(merged, prepared, overrides);
  return hint ? { ...merged, hint } : merged;
}

function resolveRouterConfig(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const detectedRouter = detectRouterPaths();
  const routerUrlOverride = getExplicitStringSetting(opts, "routerUrl");
  const routerPluginOverride = getExplicitStringSetting(opts, "routerPlugin");
  const routerConvertCliOverride = getExplicitStringSetting(opts, "routerConvertCli");
  const routerEmitOverride = getExplicitStringSetting(opts, "routerEmit");
  const projectIdOverride = getExplicitStringSetting(opts, "projectId");
  const routerAuthTokenOverride = getExplicitStringSetting(opts, "routerAuthToken");
  const documentLabelPrefixOverride = getExplicitStringSetting(opts, "documentLabelPrefix");
  const routerUrl =
    routerUrlOverride !== null
      ? routerUrlOverride
      : (
        getArg("--router-url") ||
        process.env.VEMCAD_ROUTER_URL ||
        process.env.CADGF_ROUTER_URL ||
        getDefaultRouterUrl()
      );
  const plugin =
    routerPluginOverride !== null
      ? routerPluginOverride
      : (
        getArg("--router-plugin") ||
        process.env.VEMCAD_ROUTER_PLUGIN ||
        process.env.CADGF_ROUTER_PLUGIN ||
        detectedRouter.pluginPath ||
        ""
      );
  const convertCli =
    routerConvertCliOverride !== null
      ? routerConvertCliOverride
      : (
        getArg("--router-convert-cli") ||
        process.env.VEMCAD_ROUTER_CONVERT_CLI ||
        process.env.CADGF_ROUTER_CONVERT_CLI ||
        detectedRouter.convertCliPath ||
        ""
      );
  const emit =
    routerEmitOverride !== null
      ? routerEmitOverride
      : (
        getArg("--router-emit") ||
        process.env.VEMCAD_ROUTER_EMIT ||
        process.env.CADGF_ROUTER_EMIT ||
        DEFAULT_ROUTER_EMIT
      );
  const projectId =
    projectIdOverride !== null
      ? projectIdOverride
      : (getArg("--project-id") || process.env.VEMCAD_PROJECT_ID || "");
  const authToken =
    routerAuthTokenOverride !== null
      ? routerAuthTokenOverride
      : (
        getArg("--router-auth-token") ||
        process.env.VEMCAD_ROUTER_AUTH_TOKEN ||
        process.env.CADGF_ROUTER_AUTH_TOKEN ||
        ""
      );
  const labelPrefix =
    documentLabelPrefixOverride !== null
      ? documentLabelPrefixOverride
      : (process.env.VEMCAD_DOCUMENT_LABEL_PREFIX || "");
  const timeoutValue =
    getExplicitNumberSetting(opts, "routerTimeoutMs") ??
    Number.parseInt(process.env.VEMCAD_ROUTER_TIMEOUT_MS || process.env.CADGF_ROUTER_TIMEOUT_MS || "", 10);
  return {
    routerUrl,
    plugin,
    convertCli,
    emit,
    projectId,
    authToken,
    labelPrefix,
    timeoutMs: Number.isFinite(timeoutValue) ? timeoutValue : DEFAULT_ROUTER_TIMEOUT_MS,
  };
}

function buildDefaultSettings() {
  const routerConfig = resolveRouterConfig();
  const routerStartConfig = resolveRouterStartConfig();
  const dwgConfig = resolveDwgConfig();
  const detectedRouter = detectRouterPaths();

  const pluginPath = routerConfig.plugin || detectedRouter.pluginPath;
  const convertCliPath = routerConfig.convertCli || detectedRouter.convertCliPath;
  const explicitAutoStart = parseAutoStartOverride(
    getArg("--router-auto-start") || process.env.VEMCAD_ROUTER_AUTO_START || process.env.CADGF_ROUTER_AUTO_START || ""
  );
  const routerAutoStart =
    explicitAutoStart === null ? "default" : (explicitAutoStart ? "on" : "off");

  const dwgServicePath = detectDwgServicePath();
  const dwg2dxfBin = resolveDwg2DxfBinary();
  const dwgPluginPath = resolveDwgPluginPath();
  const dwgRouteMode = resolveDwgRouteMode();

  return {
    routerUrl: routerConfig.routerUrl || "",
    routerEmit: routerConfig.emit || "",
    routerPlugin: pluginPath || "",
    routerConvertCli: convertCliPath || "",
    routerAuthToken: routerConfig.authToken || "",
    projectId: routerConfig.projectId || "",
    documentLabelPrefix: routerConfig.labelPrefix || "",
    routerAutoStart,
    routerStartTimeoutMs: routerStartConfig.timeoutMs,
    routerStartCmd:
      routerStartConfig.startCmd ||
      buildRouterStartCmdSuggestion(
        routerConfig.routerUrl,
        pluginPath,
        convertCliPath,
        detectedRouter.repoRoot
      ),
    dwgConvertCmd: dwgConfig.dwgConvertCmd || "",
    dwgServicePath: dwgServicePath || "",
    dwg2dxfBin: dwg2dxfBin || "",
    dwgTimeoutMs: dwgConfig.timeoutMs,
    dwgRouteMode,
    dwgPluginPath: dwgPluginPath || "",
  };
}

function parseViewerUrl(viewerUrl) {
  if (!viewerUrl) {
    return { manifestUrl: "", projectId: "", documentLabel: "", documentId: "" };
  }
  try {
    const parsed = new URL(viewerUrl);
    const manifestParam = parsed.searchParams.get("manifest") || "";
    const manifestUrl = manifestParam
      ? new URL(manifestParam, parsed.origin).toString()
      : "";
    return {
      manifestUrl,
      projectId: parsed.searchParams.get("project_id") || "",
      documentLabel: parsed.searchParams.get("document_label") || "",
      documentId: parsed.searchParams.get("document_id") || "",
    };
  } catch {
    return { manifestUrl: "", projectId: "", documentLabel: "", documentId: "" };
  }
}

async function convertWithRouter(filePath, labelOverride = "", settings = {}) {
  const routerReady = await ensureRouterReady(settings);
  if (!routerReady.ok) {
    return routerReady;
  }
  const config = resolveRouterConfig(settings);
  const detectedRouter = detectRouterPaths();
  const effectivePlugin = config.plugin || detectedRouter.pluginPath || "";
  const effectiveConvertCli = config.convertCli || detectedRouter.convertCliPath || "";
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  if (!routerUrl) {
    return {
      ok: false,
      error: "Router URL not configured.",
      cad_runtime_root: routerReady.cad_runtime_root || "",
      cad_runtime_source: routerReady.cad_runtime_source || "",
      cad_runtime_ready: !!routerReady.cad_runtime_ready,
      router_service_path: routerReady.router_service_path || "",
      plm_convert_path: routerReady.plm_convert_path || "",
      viewer_root: routerReady.viewer_root || "",
    };
  }
  if (!globalThis.fetch || !globalThis.FormData || !globalThis.Blob) {
    return {
      ok: false,
      error: "Fetch/FormData not available in this runtime.",
      cad_runtime_root: routerReady.cad_runtime_root || "",
      cad_runtime_source: routerReady.cad_runtime_source || "",
      cad_runtime_ready: !!routerReady.cad_runtime_ready,
      router_service_path: routerReady.router_service_path || "",
      plm_convert_path: routerReady.plm_convert_path || "",
      viewer_root: routerReady.viewer_root || "",
    };
  }
  const endpoint = `${routerUrl}/convert`;
  const baseName = path.basename(filePath);
  const labelBase = labelOverride || path.parse(baseName).name || baseName;
  const documentLabel = config.labelPrefix
    ? `${config.labelPrefix}${labelBase}`
    : labelBase;

  const form = new FormData();
  const fileBuffer = await fs.promises.readFile(filePath);
  form.append("file", new Blob([fileBuffer]), baseName);
  if (effectivePlugin) {
    form.append("plugin", effectivePlugin);
  }
  if (effectiveConvertCli) {
    form.append("convert_cli", effectiveConvertCli);
  }
  if (config.emit) {
    form.append("emit", config.emit);
  }
  if (config.projectId) {
    form.append("project_id", config.projectId);
  }
  if (documentLabel) {
    form.append("document_label", documentLabel);
  }

  const headers = {};
  if (config.authToken) {
    headers.Authorization = `Bearer ${config.authToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: `Router request failed: ${error?.message || "network error"}`,
      cad_runtime_root: routerReady.cad_runtime_root || "",
      cad_runtime_source: routerReady.cad_runtime_source || "",
      cad_runtime_ready: !!routerReady.cad_runtime_ready,
      router_service_path: routerReady.router_service_path || "",
      plm_convert_path: routerReady.plm_convert_path || "",
      viewer_root: routerReady.viewer_root || "",
    };
  }
  clearTimeout(timeoutId);

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error || text || `Router error (${response.status})`,
      error_code: data?.error_code || `HTTP_${response.status}`,
      cad_runtime_root: routerReady.cad_runtime_root || "",
      cad_runtime_source: routerReady.cad_runtime_source || "",
      cad_runtime_ready: !!routerReady.cad_runtime_ready,
      router_service_path: routerReady.router_service_path || "",
      plm_convert_path: routerReady.plm_convert_path || "",
      viewer_root: routerReady.viewer_root || "",
    };
  }

  const viewerUrl = data?.viewer_url || "";
  const parsed = parseViewerUrl(viewerUrl);
  return {
    ok: true,
    cad_runtime_root: routerReady.cad_runtime_root || "",
    cad_runtime_source: routerReady.cad_runtime_source || "",
    cad_runtime_ready: !!routerReady.cad_runtime_ready,
    router_service_path: routerReady.router_service_path || "",
    plm_convert_path: routerReady.plm_convert_path || "",
    viewer_root: routerReady.viewer_root || "",
    viewer_url: viewerUrl,
    manifest_url: parsed.manifestUrl,
    manifest_path: data?.manifest_path || "",
    output_dir: data?.output_dir || "",
    project_id: parsed.projectId || config.projectId,
    document_label: parsed.documentLabel || documentLabel,
    document_id: parsed.documentId || "",
    status_url: data?.status_url || ""
  };
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: "",
      error: error?.message || "request failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function writeSmokeSummary(summary, targetPath) {
  if (!targetPath) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
  } catch (error) {
    summary.summary_write_error = error?.message || "failed to write summary";
  }
}

async function maybeRunSmokeDwgMode() {
  const smokeDwg = getArg("--smoke-dwg");
  if (!smokeDwg) {
    return false;
  }

  const smokeSummaryPath = getArg("--smoke-summary") || "";
  const smokeViewerTimeout =
    coerceNumber(getArg("--smoke-viewer-timeout-ms")) || DEFAULT_SMOKE_VIEWER_TIMEOUT_MS;
  const selection = path.resolve(smokeDwg);
  const overrides = {};
  const routerConfig = resolveRouterConfig(overrides);
  const dwgConfig = resolveDwgConfig(overrides);
  const detectedRouter = detectRouterPaths();

  const summary = {
    ok: false,
    smoke_mode: "desktop-open-cad-file",
    input_dwg: selection,
    dwg_route_mode: resolveDwgRouteMode(overrides),
    router_url: normalizeBaseUrl(routerConfig.routerUrl),
    router_plugin: routerConfig.plugin || detectedRouter.pluginPath || "",
    router_convert_cli: routerConfig.convertCli || detectedRouter.convertCliPath || "",
    router_emit: routerConfig.emit || "",
    project_id: routerConfig.projectId || "",
    dwg_convert_cmd: dwgConfig.dwgConvertCmd || "",
    dwg2dxf_bin: resolveDwg2DxfBinary(overrides) || "",
    convert: {},
    viewer: {},
  };

  let prepared = null;
  let exitCode = 1;
  try {
    if (!fs.existsSync(selection)) {
      throw new Error(`DWG file not found: ${selection}`);
    }
    prepared = await resolveDwgOpenPlan(selection, overrides);
    summary.prepared = {
      ok: !!prepared.ok,
      route: prepared.route || "",
      route_mode: prepared.route_mode || "",
      path: prepared.path || "",
      cleanup_dir: prepared.cleanupDir || "",
      label_override: prepared.labelOverride || "",
      router_plugin: prepared.routerPlugin || "",
      dwg_plugin_path: prepared.dwgPluginPath || "",
      error: prepared.error || "",
      error_code: prepared.error_code || "",
    };
    if (!prepared.ok) {
      throw new Error(prepared.error || "DWG prepare failed");
    }

    const converted = await convertWithRouter(
      prepared.path,
      prepared.labelOverride || "",
      prepared.routerPlugin ? { ...overrides, routerPlugin: prepared.routerPlugin } : overrides
    );
    summary.convert = attachOpenResultDiagnostics(converted, prepared, overrides);
    if (!summary.convert.ok) {
      throw new Error(summary.convert.error || "router convert failed");
    }

    const viewer = await fetchTextWithTimeout(summary.convert.viewer_url, smokeViewerTimeout);
    summary.viewer = {
      url: summary.convert.viewer_url || "",
      status_code: viewer.status,
      ok: viewer.ok,
      contains_statusbar: viewer.text.includes('id="cad-status-message"'),
      contains_solver_panel: viewer.text.includes('id="cad-solver-actions"'),
      error: viewer.error || "",
    };
    if (!viewer.ok) {
      throw new Error(summary.viewer.error || `viewer URL returned ${viewer.status}`);
    }
    if (!summary.viewer.contains_statusbar) {
      throw new Error("viewer page missing expected statusbar marker");
    }

    summary.ok = true;
    exitCode = 0;
  } catch (error) {
    summary.ok = false;
    summary.error = error?.message || "desktop DWG smoke failed";
  } finally {
    if (prepared?.cleanupDir) {
      try {
        await fs.promises.rm(prepared.cleanupDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  writeSmokeSummary(summary, smokeSummaryPath);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  setImmediate(() => app.exit(exitCode));
  return true;
}

function resolveLocalViewerPath() {
  const override =
    getArg("--viewer-path") ||
    process.env.VEMCAD_VIEWER_PATH ||
    process.env.CADGF_VIEWER_PATH;
  const candidate = override
    ? path.resolve(override)
    : path.resolve(__dirname, "..", "web_viewer", "index.html");
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return "";
}

function buildStartUrl() {
  const urlOverride =
    getArg("--url") || process.env.VEMCAD_VIEWER_URL || process.env.CADGF_VIEWER_URL;
  let baseUrl = urlOverride;
  if (!baseUrl) {
    const localPath = app.isPackaged
      ? path.join(process.resourcesPath, "web_viewer", "index.html")
      : resolveLocalViewerPath();
    if (localPath && fs.existsSync(localPath)) {
      baseUrl = `file://${localPath}`;
    }
  }
  if (!baseUrl) {
    return "";
  }
  const manifestArg =
    getArg("--manifest") ||
    process.env.VEMCAD_VIEWER_MANIFEST ||
    process.env.CADGF_VIEWER_MANIFEST;
  if (manifestArg && !baseUrl.includes("manifest=")) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    baseUrl = `${baseUrl}${separator}manifest=${encodeURIComponent(manifestArg)}`;
  }
  return baseUrl;
}

function createWindow() {
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    backgroundColor: "#0f1218",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow = win;
  rendererCadOpenReady = false;

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.webContents.on("did-start-loading", () => {
    if (mainWindow === win) {
      rendererCadOpenReady = false;
    }
  });
  win.webContents.on("did-finish-load", () => {
    if (mainWindow === win) {
      rendererCadOpenReady = false;
    }
  });

  const startUrl = buildStartUrl();
  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadURL(
      "data:text/html," +
        encodeURIComponent("<h2>Viewer not found.</h2><p>Set VEMCAD_VIEWER_PATH (or CADGF_VIEWER_PATH) or use --url.</p>")
    );
  }

  win.on("closed", () => {
    if (mainWindow === win) {
      rendererCadOpenReady = false;
      mainWindow = null;
    }
  });
}

function sendOpenSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("vemcad:open-settings");
  focusMainWindow();
}

function sendOpenCadRequest(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("vemcad:open-cad-request", payload);
  focusMainWindow();
}

function buildRecentCadMenuItems() {
  const recentEntries = listRecentCadFiles();
  if (!recentEntries.length) {
    return [{ label: "No Recent CAD Files", enabled: false }];
  }
  return [
    ...recentEntries.map((entry) => ({
      label: entry.label || path.basename(entry.path),
      enabled: !!entry.exists,
      click: () => {
        queueCadOpenPath(entry.path);
        ensureCadOpenWindow();
      },
    })),
    { type: "separator" },
    {
      label: "Clear Recent CAD Files",
      click: () => clearRecentCadFiles(),
    },
  ];
}

function buildResumeLatestCadMenuItem() {
  const latestEntry = listRecentCadFiles()[0] || null;
  return {
    label: "Resume Latest CAD",
    enabled: Boolean(latestEntry?.exists),
    click: () => {
      if (!latestEntry?.path) {
        return;
      }
      queueCadOpenPath(latestEntry.path);
      ensureCadOpenWindow();
    },
  };
}

function installAppMenu() {
  const isMac = process.platform === "darwin";
  const openCadItem = {
    label: "Open CAD File...",
    accelerator: "CmdOrCtrl+O",
    click: () => {
      ensureCadOpenWindow();
      if (rendererCadOpenReady) {
        sendOpenCadRequest({ path: "" });
      }
    },
  };
  const settingsItem = {
    label: "Settings...",
    accelerator: "CmdOrCtrl+,",
    click: () => sendOpenSettings(),
  };
  const fileMenu = {
    label: "File",
    submenu: [
      openCadItem,
      buildResumeLatestCadMenuItem(),
      {
        label: "Open Recent CAD",
        submenu: buildRecentCadMenuItems(),
      },
      { type: "separator" },
      settingsItem,
      ...(isMac ? [] : [{ type: "separator" }, { role: "quit" }]),
    ],
  };
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              settingsItem,
              { type: "separator" },
              { role: "quit" },
            ],
          },
          fileMenu,
        ]
      : [
          fileMenu,
        ]),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openCadSelection(selection, overrides = {}) {
  const normalizedSelection = typeof selection === "string" ? selection.trim() : "";
  if (!normalizedSelection) {
    return {
      ok: false,
      error: "CAD file not specified.",
      error_code: "CAD_FILE_NOT_SPECIFIED",
    };
  }
  const resolvedSelection = path.resolve(normalizedSelection);
  if (!fs.existsSync(resolvedSelection)) {
    return {
      ok: false,
      error: `CAD file not found: ${resolvedSelection}`,
      error_code: "CAD_FILE_NOT_FOUND",
    };
  }
  const prepared = await resolveDwgOpenPlan(resolvedSelection, overrides);
  if (!prepared.ok) {
    return attachOpenResultDiagnostics(prepared, prepared, overrides);
  }
  try {
    const converted = await convertWithRouter(
      prepared.path,
      prepared.labelOverride || "",
      prepared.routerPlugin ? { ...overrides, routerPlugin: prepared.routerPlugin } : overrides
    );
    const result = attachOpenResultDiagnostics(converted, prepared, overrides);
    if (result.ok) {
      rememberRecentCadFile(
        resolvedSelection,
        result.document_label || prepared.labelOverride || path.basename(resolvedSelection, path.extname(resolvedSelection))
      );
      // P1.5: Desktop DXF/DWG → editor bridge.
      // When the conversion produces a document.json, push it to the renderer
      // so preview_app.js can switch to editor mode and load the document.
      if (result.output_dir) {
        const docJsonPath = path.join(result.output_dir, "document.json");
        if (fs.existsSync(docJsonPath)) {
          try {
            const docJsonText = fs.readFileSync(docJsonPath, "utf-8");
            const documentJson = JSON.parse(docJsonText);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("vemcad:load-document-into-editor", {
                documentJson,
                documentLabel: result.document_label || "",
                outputDir: result.output_dir,
              });
            }
          } catch {
            // Non-fatal: preview mode will still work via manifest_url.
          }
        }
      }
    }
    return result;
  } finally {
    if (prepared.cleanupDir) {
      await fs.promises.rm(prepared.cleanupDir, { recursive: true, force: true });
    }
  }
}

ipcMain.handle("vemcad:open-cad-file", async (_event, settings) => {
  const overrides = normalizeSettings(settings);
  const smokeSelection = resolveSmokeOpenFileSelection();
  let selection = "";
  if (smokeSelection.configured) {
    if (!smokeSelection.path || !fs.existsSync(smokeSelection.path)) {
      return {
        ok: false,
        error: `Smoke open file not found: ${smokeSelection.path || "<empty>"}`,
        error_code: "SMOKE_OPEN_FILE_NOT_FOUND",
      };
    }
    selection = smokeSelection.path;
  } else {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "CAD Files", extensions: ["dxf", "dwg", "json", "cad"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths.length) {
      return { ok: false, canceled: true };
    }
    selection = result.filePaths[0];
  }
  return openCadSelection(selection, overrides);
});

ipcMain.handle("vemcad:open-cad-path", async (_event, payload = {}) => {
  const requestedPath = typeof payload?.path === "string" ? payload.path : "";
  const overrides = normalizeSettings(payload?.settings);
  return openCadSelection(requestedPath, overrides);
});

ipcMain.on("vemcad:renderer-ready", (event) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (event.sender !== mainWindow.webContents) {
    return;
  }
  rendererCadOpenReady = true;
  broadcastRecentCadFilesChanged();
  flushPendingCadOpenPaths();
});

ipcMain.handle("vemcad:get-default-settings", async () => buildDefaultSettings());

ipcMain.handle("vemcad:get-app-info", async () => ({
  app_name: app.name,
  app_version: app.getVersion(),
  is_packaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
  electron_version: process.versions.electron || "",
  chrome_version: process.versions.chrome || "",
  node_version: process.versions.node || "",
  exe_path: process.execPath,
  app_path: app.getAppPath(),
  app_bundle_path: resolveMacAppBundlePath(process.execPath),
  can_register_file_associations: process.platform === "darwin" && canRegisterMacFileAssociations(process.execPath),
  user_data_path: app.getPath("userData"),
}));

ipcMain.handle("vemcad:get-recent-cad-files", async () => ({
  entries: listRecentCadFiles(),
}));

ipcMain.handle("vemcad:clear-recent-cad-files", async () => ({
  ok: true,
  entries: clearRecentCadFiles(),
}));

ipcMain.handle("vemcad:register-file-associations", async () => registerDesktopFileAssociations());

ipcMain.handle("vemcad:save-diagnostics", async (_event, { filename, text } = {}) => {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "No diagnostics payload provided.", error_code: "NO_DIAGNOSTICS_PAYLOAD" };
  }

  const safeFilename = sanitizeSuggestedFilename(filename, "vemcad_desktop_diagnostics.json");
  const payloadBytes = Buffer.byteLength(text, "utf8");
  const autoExportDir = resolveDesktopExportDir();

  if (autoExportDir) {
    const exportDir = path.resolve(autoExportDir);
    fs.mkdirSync(exportDir, { recursive: true });
    const outputPath = path.join(exportDir, safeFilename);
    fs.writeFileSync(outputPath, text, "utf8");
    return {
      ok: true,
      path: outputPath,
      bytes: payloadBytes,
      mode: "auto-dir",
    };
  }

  const downloadsDir = app.getPath("downloads") || app.getPath("documents");
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(downloadsDir, safeFilename),
    filters: [
      { name: "JSON Files", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  fs.writeFileSync(result.filePath, text, "utf8");
  return {
    ok: true,
    path: result.filePath,
    bytes: payloadBytes,
    mode: "dialog",
  };
});

ipcMain.handle("vemcad:test-router", async (_event, settings) => {
  const overrides = normalizeSettings(settings);
  const result = await ensureRouterReady(overrides);
  if (!result.ok) {
    return result;
  }
  const routerUrl = result.router_url || "";
  const healthResult = await fetchRouterHealth(routerUrl);
  const health = healthResult.ok ? healthResult.data : null;
  const healthError = healthResult.ok ? "" : healthResult.error;
  return {
    ok: true,
    started: !!result.started,
    router_auto_start: result.router_auto_start || "",
    router_start_ready: !!result.router_start_ready,
    router_start_source: result.router_start_source || "",
    router_start_cmd: result.router_start_cmd || "",
    router_start_cmd_suggested: result.router_start_cmd_suggested || "",
    router_url: routerUrl,
    router_plugin: result.router_plugin || "",
    router_convert_cli: result.router_convert_cli || "",
    cad_runtime_root: result.cad_runtime_root || "",
    cad_runtime_source: result.cad_runtime_source || "",
    cad_runtime_ready: !!result.cad_runtime_ready,
    router_service_path: result.router_service_path || "",
    plm_convert_path: result.plm_convert_path || "",
    viewer_root: result.viewer_root || "",
    health,
    health_error: healthError
  };
});

ipcMain.handle("vemcad:export-dxf", async (_event, { outputDir } = {}) => {
  if (!outputDir) {
    return { ok: false, error: "No document loaded (output_dir missing).", error_code: "NO_DOCUMENT" };
  }

  // Find document.json in the output directory
  const docJsonPath = path.join(outputDir, "document.json");
  if (!fs.existsSync(docJsonPath)) {
    return { ok: false, error: `document.json not found in ${outputDir}`, error_code: "DOC_NOT_FOUND" };
  }

  // Find json2dxf binary
  const detected = detectRouterPaths();
  const buildDirs = ["build_vcpkg", "build", "build_novcpkg"];
  const json2dxfNames = process.platform === "win32" ? ["json2dxf.exe"] : ["json2dxf"];
  let json2dxfPath = "";
  for (const root of getCadgfRootCandidates()) {
    if (!root || !fs.existsSync(root)) continue;
    for (const bd of buildDirs) {
      if (json2dxfPath) break;
      const candidates = json2dxfNames.map((n) => path.join(root, bd, "tools", n));
      json2dxfPath = pickFirstExistingPath(candidates) || "";
    }
    if (json2dxfPath) break;
  }
  if (!json2dxfPath) {
    return { ok: false, error: "json2dxf binary not found.", error_code: "JSON2DXF_NOT_FOUND" };
  }

  // Show Save dialog
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("documents"), "export.dxf"),
    filters: [
      { name: "DXF Files", extensions: ["dxf"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  const outputPath = result.filePath;

  // Run json2dxf
  return new Promise((resolve) => {
    execFile(json2dxfPath, [docJsonPath, outputPath], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          ok: false,
          error: `json2dxf failed: ${error.message}${stderr ? " — " + stderr.trim() : ""}`,
          error_code: "JSON2DXF_FAILED"
        });
      } else if (!fs.existsSync(outputPath)) {
        resolve({ ok: false, error: "json2dxf did not produce output.", error_code: "JSON2DXF_NO_OUTPUT" });
      } else {
        const size = fs.statSync(outputPath).size;
        resolve({ ok: true, path: outputPath, size });
      }
    });
  });
});

ipcMain.handle("vemcad:test-dwg", async (_event, settings) => {
  const readiness = resolveDwgReadiness(settings);
  if (!readiness.route) {
    return {
      ok: false,
      error: "DWG open path not configured. Provide a DWG plugin path or a DWG converter command.",
      error_code: "DWG_NOT_READY",
      hint: buildDwgNotReadyHint(readiness),
      ...readiness,
    };
  }
  const message = readiness.direct_plugin_ready
    ? (readiness.local_convert_ready
      ? `DWG ready via direct plugin (${readiness.dwg_plugin_path}) with local converter fallback.`
      : `DWG ready via direct plugin (${readiness.dwg_plugin_path}).`)
    : (readiness.dwg2dxf_bin
      ? `DWG ready via local conversion. dwg2dxf: ${readiness.dwg2dxf_bin}`
      : "DWG ready via local conversion.");
  return {
    ok: true,
    message,
    ...readiness,
  };
});

queueCadOpenPathsFromArgv(process.argv.slice(1), process.cwd());

if (!HEADLESS_SMOKE_DWG_MODE) {
  app.on("second-instance", (_event, commandLine, workingDirectory) => {
    queueCadOpenPathsFromArgv(commandLine, workingDirectory || process.cwd());
    if (app.isReady()) {
      ensureCadOpenWindow();
    }
  });
}

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  queueCadOpenPath(filePath);
  if (app.isReady()) {
    ensureCadOpenWindow();
  }
});

app.whenReady().then(async () => {
  if (await maybeRunSmokeDwgMode()) {
    return;
  }
  loadRecentCadFiles();
  createWindow();
  installAppMenu();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
