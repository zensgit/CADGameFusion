const fs = require("fs");
const path = require("path");

const DEFAULT_LSREGISTER_PATH = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

function resolveMacAppBundlePath(execPath = "") {
  const normalized = typeof execPath === "string" ? execPath.trim() : "";
  if (!normalized) {
    return "";
  }
  const marker = `.app${path.sep}Contents${path.sep}MacOS${path.sep}`;
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }
  return normalized.slice(0, markerIndex + 4);
}

function resolveLaunchServicesRegisterTool(candidate = DEFAULT_LSREGISTER_PATH) {
  const normalized = typeof candidate === "string" ? candidate.trim() : "";
  if (!normalized) {
    return "";
  }
  return fs.existsSync(normalized) ? normalized : "";
}

function canRegisterMacFileAssociations(execPath = "", toolPath = DEFAULT_LSREGISTER_PATH) {
  const appBundlePath = resolveMacAppBundlePath(execPath);
  const resolvedTool = resolveLaunchServicesRegisterTool(toolPath);
  return Boolean(appBundlePath && resolvedTool);
}

module.exports = {
  DEFAULT_LSREGISTER_PATH,
  canRegisterMacFileAssociations,
  resolveLaunchServicesRegisterTool,
  resolveMacAppBundlePath,
};
