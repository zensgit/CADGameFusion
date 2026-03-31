const path = require("path");
const { fileURLToPath } = require("url");

const CAD_OPEN_EXTENSIONS = new Set([".dwg", ".dxf", ".json", ".cad"]);
const VALUE_FLAGS = new Set([
  "--dwg-convert-cmd",
  "--dwg-plugin",
  "--dwg-route",
  "--manifest",
  "--project-id",
  "--router-auth-token",
  "--router-auto-start",
  "--router-convert-cli",
  "--router-emit",
  "--router-plugin",
  "--router-start-cmd",
  "--router-url",
  "--smoke-dwg",
  "--smoke-open-file",
  "--smoke-summary",
  "--smoke-viewer-timeout-ms",
  "--url",
  "--user-data-dir",
  "--viewer-path",
]);

function normalizeCadOpenPath(candidate, cwd = process.cwd()) {
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (!raw) {
    return "";
  }
  try {
    if (raw.startsWith("file://")) {
      return fileURLToPath(raw);
    }
  } catch {
    return "";
  }
  if (raw.startsWith("-")) {
    return "";
  }
  return path.resolve(cwd, raw);
}

function isCadOpenablePath(candidate, cwd = process.cwd()) {
  const normalized = normalizeCadOpenPath(candidate, cwd);
  if (!normalized) {
    return false;
  }
  return CAD_OPEN_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function extractCadOpenPathsFromCommandLine(argv = [], cwd = process.cwd()) {
  const results = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = typeof argv[i] === "string" ? argv[i] : "";
    if (!token) {
      continue;
    }
    if (token.startsWith("--")) {
      const [flag] = token.split("=", 1);
      if (VALUE_FLAGS.has(flag) && !token.includes("=")) {
        i += 1;
      }
      continue;
    }
    if (!isCadOpenablePath(token, cwd)) {
      continue;
    }
    const resolved = normalizeCadOpenPath(token, cwd);
    if (resolved && !results.includes(resolved)) {
      results.push(resolved);
    }
  }
  return results;
}

module.exports = {
  CAD_OPEN_EXTENSIONS,
  extractCadOpenPathsFromCommandLine,
  isCadOpenablePath,
  normalizeCadOpenPath,
};
