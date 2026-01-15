const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require("electron");
const { spawn } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DEFAULT_ROUTER_URL = "http://127.0.0.1:9000";
const DEFAULT_ROUTER_EMIT = "json,gltf,meta";
const DEFAULT_ROUTER_TIMEOUT_MS = 60000;
const DEFAULT_DWG_TIMEOUT_MS = 60000;
const DEFAULT_ROUTER_START_TIMEOUT_MS = 15000;
const DEFAULT_ROUTER_HEALTH_TIMEOUT_MS = 1500;

let routerProcess = null;
let routerStartPromise = null;
let routerCleanupRegistered = false;
let mainWindow = null;

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv.length > index + 1) {
    return process.argv[index + 1];
  }
  return "";
}

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
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

function resolveDwg2DxfBinary(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const explicitOverride = coerceString(opts.dwg2dxfBin);
  const explicit =
    explicitOverride ||
    process.env.VEMCAD_DWG2DXF_BIN ||
    process.env.CADGF_DWG2DXF_BIN ||
    process.env.DWG2DXF_BIN ||
    "";
  if (explicit) {
    return explicit;
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

function pickFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function detectRouterPaths() {
  const roots = getCadgfRootCandidates();
  const buildDirs = ["build_vcpkg", "build", "build_novcpkg"];
  const pluginExt = process.platform === "win32" ? ".dll" : (process.platform === "darwin" ? ".dylib" : ".so");
  const pluginNames = process.platform === "win32"
    ? ["cadgf_dxf_importer_plugin.dll", "libcadgf_dxf_importer_plugin.dll"]
    : [`libcadgf_dxf_importer_plugin${pluginExt}`];
  const convertCliNames = process.platform === "win32" ? ["convert_cli.exe"] : ["convert_cli"];

  let pluginPath = "";
  let convertCliPath = "";
  let repoRoot = "";

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
  return { pluginPath, convertCliPath, repoRoot };
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
  let dwgConvertCmd =
    coerceString(opts.dwgConvertCmd) ||
    getArg("--dwg-convert-cmd") ||
    process.env.VEMCAD_DWG_CONVERT_CMD ||
    process.env.CADGF_DWG_CONVERT_CMD ||
    process.env.CADGF_ROUTER_DWG_CONVERT_CMD ||
    "";
  if (!dwgConvertCmd) {
    dwgConvertCmd = detectDwgConvertCmd(opts);
  }
  const timeoutValue =
    coerceNumber(opts.dwgTimeoutMs) ??
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
  const explicitDir =
    coerceString(opts.dwgServicePath) ||
    process.env.VEMCAD_DWG_SERVICE_PATH ||
    process.env.VEMCAD_DWG_SERVICE_DIR ||
    process.env.CADGF_DWG_SERVICE_PATH ||
    process.env.CADGF_DWG_SERVICE_DIR ||
    "";
  const repoRoot = path.resolve(__dirname, "..", "..");
  const home = getHomeDir();
  const candidates = [
    explicitDir,
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
  const startCmdOverride = coerceString(opts.routerStartCmd);
  const startCmdValue =
    startCmdOverride ||
    getArg("--router-start-cmd") ||
    process.env.VEMCAD_ROUTER_START_CMD ||
    process.env.CADGF_ROUTER_START_CMD ||
    "";
  const startCwdOverride = coerceString(opts.routerStartCwd);
  const startCwdValue =
    startCwdOverride ||
    process.env.VEMCAD_ROUTER_START_CWD ||
    process.env.CADGF_ROUTER_START_CWD ||
    "";
  const timeoutOverride = coerceNumber(opts.routerStartTimeoutMs);
  const timeoutValue =
    timeoutOverride ??
    Number.parseInt(process.env.VEMCAD_ROUTER_START_TIMEOUT_MS || process.env.CADGF_ROUTER_START_TIMEOUT_MS || "", 10);
  return {
    autoStart:
      autoStartOverride !== null
        ? autoStartOverride
        : (autoStartValue ? parseBool(autoStartValue) : !app.isPackaged),
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
  if (app.isPackaged) {
    return { cmd: [], cwd: "" };
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
  const repoRoot = path.resolve(__dirname, "..", "..");
  const routerScript = path.join(repoRoot, "tools", "plm_router_service.py");
  if (!fs.existsSync(routerScript)) {
    return { cmd: [], cwd: "" };
  }
  const pythonBin = resolvePythonExecutable();
  const cmd = [pythonBin, routerScript, "--host", parsed.hostname];
  if (parsed.port) {
    cmd.push("--port", parsed.port);
  }
  const pluginPath = config.plugin
    ? (path.isAbsolute(config.plugin) ? config.plugin : path.join(repoRoot, config.plugin))
    : "";
  const convertCliPath = config.convertCli
    ? (path.isAbsolute(config.convertCli) ? config.convertCli : path.join(repoRoot, config.convertCli))
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
  return { cmd, cwd: repoRoot };
}

function quoteArg(value) {
  if (!value) return "";
  if (/\s/.test(value)) {
    return `"${value.replace(/\"/g, "\\\"")}"`;
  }
  return value;
}

function buildRouterStartCmdSuggestion(routerUrl, pluginPath, convertCliPath, repoRoot) {
  if (!repoRoot) return "";
  let parsed;
  try {
    parsed = new URL(routerUrl);
  } catch {
    return "";
  }
  if (!isLocalHost(parsed.hostname)) {
    return "";
  }
  const scriptPath = path.join(repoRoot, "tools", "plm_router_service.py");
  if (!fs.existsSync(scriptPath)) {
    return "";
  }
  const pythonBin = resolvePythonExecutable();
  const args = [pythonBin, scriptPath, "--host", parsed.hostname];
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
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  if (!routerUrl) {
    return { ok: false, error: "Router URL not configured.", error_code: "ROUTER_NOT_CONFIGURED" };
  }
  if (await checkRouterHealth(routerUrl)) {
    return { ok: true };
  }

  const startConfig = resolveRouterStartConfig(overrides);
  if (!startConfig.autoStart) {
    return {
      ok: false,
      error: "Router not reachable. Start it or enable VEMCAD_ROUTER_AUTO_START.",
      error_code: "ROUTER_NOT_AVAILABLE"
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
        error_code: "ROUTER_START_NOT_CONFIGURED"
      };
    }
    try {
      routerProcess = spawn(cmd[0], cmd.slice(1), { cwd: cwd || undefined, stdio: "ignore" });
      registerRouterCleanup();
      routerProcess.on("exit", () => {
        routerProcess = null;
      });
    } catch (error) {
      routerProcess = null;
      return {
        ok: false,
        error: `Failed to start router: ${error?.message || "unknown error"}`,
        error_code: "ROUTER_START_FAILED"
      };
    }

    const ready = await waitForRouter(routerUrl, startConfig.timeoutMs);
    if (!ready) {
      return {
        ok: false,
        error: "Router did not become ready in time.",
        error_code: "ROUTER_START_TIMEOUT"
      };
    }
    return { ok: true, started: true };
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

async function maybeConvertDwg(filePath, settings = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".dwg") {
    return { ok: true, path: filePath, labelOverride: "" };
  }
  const config = resolveDwgConfig(settings);
  if (!config.dwgConvertCmd) {
    return {
      ok: false,
      error: "DWG converter not configured or auto-detected. Set VEMCAD_DWG_CONVERT_CMD.",
      error_code: "DWG_CONVERT_NOT_CONFIGURED"
    };
  }
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vemcad-dwg-"));
  const baseName = path.parse(filePath).name || path.basename(filePath);
  const outputPath = path.join(tmpDir, `${baseName}.dxf`);
  const cmd = buildDwgConvertCommand(config.dwgConvertCmd, filePath, outputPath);
  const result = await runDwgConvert(cmd, config.timeoutMs);
  if (!result.ok) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
    return result;
  }
  if (!fs.existsSync(outputPath)) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
    return { ok: false, error: "DWG conversion did not produce output.", error_code: "DWG_CONVERT_FAILED" };
  }
  return { ok: true, path: outputPath, cleanupDir: tmpDir, labelOverride: baseName };
}

function resolveRouterConfig(overrides = {}) {
  const opts = normalizeSettings(overrides);
  const routerUrl =
    coerceString(opts.routerUrl) ||
    getArg("--router-url") ||
    process.env.VEMCAD_ROUTER_URL ||
    process.env.CADGF_ROUTER_URL ||
    DEFAULT_ROUTER_URL;
  const plugin =
    coerceString(opts.routerPlugin) ||
    getArg("--router-plugin") ||
    process.env.VEMCAD_ROUTER_PLUGIN ||
    process.env.CADGF_ROUTER_PLUGIN ||
    "";
  const convertCli =
    coerceString(opts.routerConvertCli) ||
    getArg("--router-convert-cli") ||
    process.env.VEMCAD_ROUTER_CONVERT_CLI ||
    process.env.CADGF_ROUTER_CONVERT_CLI ||
    "";
  const emit =
    coerceString(opts.routerEmit) ||
    getArg("--router-emit") ||
    process.env.VEMCAD_ROUTER_EMIT ||
    process.env.CADGF_ROUTER_EMIT ||
    DEFAULT_ROUTER_EMIT;
  const projectId =
    coerceString(opts.projectId) || getArg("--project-id") || process.env.VEMCAD_PROJECT_ID || "";
  const authToken =
    coerceString(opts.routerAuthToken) ||
    getArg("--router-auth-token") ||
    process.env.VEMCAD_ROUTER_AUTH_TOKEN ||
    process.env.CADGF_ROUTER_AUTH_TOKEN ||
    "";
  const labelPrefix =
    coerceString(opts.documentLabelPrefix) || process.env.VEMCAD_DOCUMENT_LABEL_PREFIX || "";
  const timeoutValue =
    coerceNumber(opts.routerTimeoutMs) ??
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
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  if (!routerUrl) {
    return { ok: false, error: "Router URL not configured." };
  }
  if (!globalThis.fetch || !globalThis.FormData || !globalThis.Blob) {
    return { ok: false, error: "Fetch/FormData not available in this runtime." };
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
  if (config.plugin) {
    form.append("plugin", config.plugin);
  }
  if (config.convertCli) {
    form.append("convert_cli", config.convertCli);
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
      error: `Router request failed: ${error?.message || "network error"}`
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
      error_code: data?.error_code || `HTTP_${response.status}`
    };
  }

  const viewerUrl = data?.viewer_url || "";
  const parsed = parseViewerUrl(viewerUrl);
  return {
    ok: true,
    viewer_url: viewerUrl,
    manifest_url: parsed.manifestUrl,
    project_id: parsed.projectId || config.projectId,
    document_label: parsed.documentLabel || documentLabel,
    document_id: parsed.documentId || "",
    status_url: data?.status_url || ""
  };
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
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
      mainWindow = null;
    }
  });
}

function sendOpenSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("vemcad:open-settings");
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function installAppMenu() {
  const isMac = process.platform === "darwin";
  const settingsItem = {
    label: "Settings...",
    accelerator: "CmdOrCtrl+,",
    click: () => sendOpenSettings(),
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
        ]
      : [
          {
            label: "File",
            submenu: [settingsItem, { role: "quit" }],
          },
        ]),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("vemcad:open-cad-file", async (_event, settings) => {
  const overrides = normalizeSettings(settings);
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
  const selection = result.filePaths[0];
  const prepared = await maybeConvertDwg(selection, overrides);
  if (!prepared.ok) {
    return prepared;
  }
  try {
    return await convertWithRouter(prepared.path, prepared.labelOverride || "", overrides);
  } finally {
    if (prepared.cleanupDir) {
      await fs.promises.rm(prepared.cleanupDir, { recursive: true, force: true });
    }
  }
});

ipcMain.handle("vemcad:get-default-settings", async () => buildDefaultSettings());

ipcMain.handle("vemcad:test-router", async (_event, settings) => {
  const overrides = normalizeSettings(settings);
  const config = resolveRouterConfig(overrides);
  const routerUrl = normalizeBaseUrl(config.routerUrl);
  if (!routerUrl) {
    return { ok: false, error: "Router URL not configured.", error_code: "ROUTER_NOT_CONFIGURED" };
  }
  const result = await ensureRouterReady(overrides);
  if (!result.ok) {
    return result;
  }
  const healthResult = await fetchRouterHealth(routerUrl);
  const health = healthResult.ok ? healthResult.data : null;
  const healthError = healthResult.ok ? "" : healthResult.error;
  return {
    ok: true,
    started: !!result.started,
    router_url: routerUrl,
    health,
    health_error: healthError
  };
});

ipcMain.handle("vemcad:test-dwg", async (_event, settings) => {
  const overrides = normalizeSettings(settings);
  const config = resolveDwgConfig(overrides);
  const dwg2dxf = resolveDwg2DxfBinary(overrides);
  if (!config.dwgConvertCmd) {
    return {
      ok: false,
      error: "DWG converter not configured.",
      error_code: "DWG_CONVERT_NOT_CONFIGURED",
      dwg2dxf_bin: dwg2dxf
    };
  }
  const message = dwg2dxf
    ? `DWG converter configured. dwg2dxf: ${dwg2dxf}`
    : "DWG converter configured.";
  return {
    ok: true,
    message,
    dwg_convert_cmd: config.dwgConvertCmd,
    dwg2dxf_bin: dwg2dxf
  };
});

app.whenReady().then(() => {
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
