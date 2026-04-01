#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const desktopDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(desktopDir, "..", "..");
const bundledRoot = path.join(desktopDir, "bundled_resources");
const summaryPath = path.join(bundledRoot, "stage_summary.json");

const pluginExt = process.platform === "win32" ? ".dll" : (process.platform === "darwin" ? ".dylib" : ".so");
const buildDirs = ["build_vcpkg", "build", "build_novcpkg"];
const dxfPluginNames = process.platform === "win32"
  ? ["cadgf_dxf_importer_plugin.dll", "libcadgf_dxf_importer_plugin.dll"]
  : [`libcadgf_dxf_importer_plugin${pluginExt}`];
const dwgPluginNames = process.platform === "win32"
  ? ["cadgf_dwg_importer_plugin.dll", "libcadgf_dwg_importer_plugin.dll"]
  : [`libcadgf_dwg_importer_plugin${pluginExt}`];
const convertCliNames = process.platform === "win32" ? ["convert_cli.exe"] : ["convert_cli"];
const dwg2dxfNames = process.platform === "win32" ? ["dwg2dxf.exe"] : ["dwg2dxf"];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function copyIfPresent(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return "";
  }
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  if (process.platform !== "win32") {
    fs.chmodSync(targetPath, 0o755);
  }
  return targetPath;
}

function copyTreeIfPresent(sourceDir, targetDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return "";
  }
  ensureDir(path.dirname(targetDir));
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
  return targetDir;
}

function findBuildArtifact(names, subdir) {
  const candidates = [];
  for (const buildDir of buildDirs) {
    for (const name of names) {
      candidates.push(path.join(repoRoot, buildDir, subdir, name));
    }
  }
  return firstExisting(candidates);
}

function copyDwgService(sourceDir, targetDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return "";
  }
  const scriptSource = path.join(sourceDir, "cadgf_dwg_service.py");
  if (!fs.existsSync(scriptSource)) {
    return "";
  }
  ensureDir(targetDir);
  const scriptTarget = path.join(targetDir, "cadgf_dwg_service.py");
  fs.copyFileSync(scriptSource, scriptTarget);
  if (process.platform !== "win32") {
    fs.chmodSync(scriptTarget, 0o755);
  }
  for (const name of ["README.md", "LICENSE"]) {
    const from = path.join(sourceDir, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(targetDir, name));
    }
  }
  return targetDir;
}

function main() {
  ensureDir(bundledRoot);
  ensureDir(path.join(bundledRoot, "router", "plugins"));
  ensureDir(path.join(bundledRoot, "router", "tools"));
  ensureDir(path.join(bundledRoot, "dwg_service"));
  ensureDir(path.join(bundledRoot, "dwg_service", "bin"));
  ensureDir(path.join(bundledRoot, "tools"));
  ensureDir(path.join(bundledRoot, "schemas"));

  const dxfPlugin = findBuildArtifact(dxfPluginNames, "plugins");
  const dwgPlugin = findBuildArtifact(dwgPluginNames, "plugins");
  const convertCli = findBuildArtifact(convertCliNames, "tools");
  const dwg2dxfBinary = firstExisting([
    process.env.VEMCAD_DWG2DXF_BIN || "",
    process.env.CADGF_DWG2DXF_BIN || "",
    process.env.DWG2DXF_BIN || "",
    ...dwg2dxfNames.flatMap((name) => [
      path.join("/opt/homebrew/bin", name),
      path.join("/usr/local/bin", name),
      path.join("/opt/local/bin", name),
    ]),
  ]);
  const routerServiceSource = firstExisting([
    path.join(repoRoot, "tools", "plm_router_service.py"),
  ]);
  const plmConvertSource = firstExisting([
    path.join(repoRoot, "tools", "plm_convert.py"),
  ]);
  const webViewerSource = firstExisting([
    path.join(repoRoot, "tools", "web_viewer"),
  ]);
  const documentSchemaSource = firstExisting([
    path.join(repoRoot, "schemas", "document.schema.json"),
  ]);
  const manifestSchemaSource = firstExisting([
    path.join(repoRoot, "schemas", "plm_manifest.schema.json"),
  ]);
  const serviceSource = firstExisting([
    process.env.VEMCAD_DWG_SERVICE_PATH || "",
    process.env.CADGF_DWG_SERVICE_PATH || "",
    path.join(repoRoot, "..", "cadgf-dwg-service"),
    path.join(path.dirname(repoRoot), "cadgf-dwg-service"),
    path.join(process.env.HOME || "", "Downloads", "Github", "cadgf-dwg-service"),
    path.join(process.env.HOME || "", "Downloads", "GitHub", "cadgf-dwg-service"),
    path.join(process.env.HOME || "", "Github", "cadgf-dwg-service"),
    path.join(process.env.HOME || "", "GitHub", "cadgf-dwg-service"),
  ]);

  const summary = {
    ok: true,
    repo_root: repoRoot,
    bundled_root: bundledRoot,
    router_service_source: routerServiceSource,
    router_service_target: copyIfPresent(
      routerServiceSource,
      path.join(bundledRoot, "router", "plm_router_service.py")
    ),
    plm_convert_source: plmConvertSource,
    plm_convert_target: copyIfPresent(
      plmConvertSource,
      path.join(bundledRoot, "tools", "plm_convert.py")
    ),
    web_viewer_source: webViewerSource,
    web_viewer_target: copyTreeIfPresent(
      webViewerSource,
      path.join(bundledRoot, "tools", "web_viewer")
    ),
    dxf_plugin_source: dxfPlugin,
    dxf_plugin_target: copyIfPresent(
      dxfPlugin,
      path.join(bundledRoot, "router", "plugins", path.basename(dxfPlugin || ""))
    ),
    dwg_plugin_source: dwgPlugin,
    dwg_plugin_target: copyIfPresent(
      dwgPlugin,
      path.join(bundledRoot, "router", "plugins", path.basename(dwgPlugin || ""))
    ),
    convert_cli_source: convertCli,
    convert_cli_target: copyIfPresent(
      convertCli,
      path.join(bundledRoot, "router", "tools", path.basename(convertCli || ""))
    ),
    dwg2dxf_source: dwg2dxfBinary,
    dwg2dxf_target: copyIfPresent(
      dwg2dxfBinary,
      path.join(bundledRoot, "dwg_service", "bin", path.basename(dwg2dxfBinary || ""))
    ),
    dwg_service_source: serviceSource,
    dwg_service_target: copyDwgService(
      serviceSource,
      path.join(bundledRoot, "dwg_service")
    ),
    document_schema_source: documentSchemaSource,
    document_schema_target: copyIfPresent(
      documentSchemaSource,
      path.join(bundledRoot, "schemas", "document.schema.json")
    ),
    manifest_schema_source: manifestSchemaSource,
    manifest_schema_target: copyIfPresent(
      manifestSchemaSource,
      path.join(bundledRoot, "schemas", "plm_manifest.schema.json")
    ),
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`summary_json=${summaryPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
