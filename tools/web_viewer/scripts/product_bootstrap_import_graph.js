#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cadgfRoot = path.resolve(__dirname, '..', '..', '..');
const defaultRepoRoot = path.resolve(cadgfRoot, '..', '..');
const DEFAULT_OUTDIR = path.join(cadgfRoot, 'build', 'product_bootstrap_import_graph');
const DEFAULT_ENTRIES = [
  'apps/web/app.js',
  'apps/web/preview/runtime/preview_bootstrap.js',
  'apps/web/workbench/bootstrap/workspace_bootstrap.js',
];
const OFFLINE_MANIFEST_SCHEMA_VERSION = 1;
const OFFLINE_MANIFEST_VERSION = 'product-offline-manifest-v1';

const IMPORT_RE = /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+[^'"()]*?\s+from\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
const CONST_STRING_RE = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"]+)['"]\s*;/g;
const CONST_IMPORT_META_URL_RE = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)\.toString\s*\(\s*\)\s*;/g;

function parseArgs(argv) {
  const args = {
    repoRoot: defaultRepoRoot,
    outdir: DEFAULT_OUTDIR,
    entries: [],
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--repo-root' && i + 1 < argv.length) {
      args.repoRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--entry' && i + 1 < argv.length) {
      args.entries.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === '--ignore-vendor-missing') {
      args.ignoreVendorMissing = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  if (args.entries.length === 0) {
    args.entries = [...DEFAULT_ENTRIES];
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/product_bootstrap_import_graph.js [--repo-root <path>] [--outdir <dir>] [--entry <relative-file> ...] [--ignore-vendor-missing]',
    '',
    'Walks literal relative import/export edges from product bootstrap entries and writes an import graph summary.',
    '--ignore-vendor-missing: exit 0 when the only missing assets are vendored (path under .../vendor/), e.g. the',
    '  gitignored three.module.js absent in a clean checkout; still exit 1 on any missing FIRST-PARTY asset.',
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

function toPosixPath(value) {
  return String(value || '').split(path.sep).join('/');
}

function relativeToRoot(repoRoot, filePath) {
  return toPosixPath(path.relative(repoRoot, filePath));
}

function resolveEntry(repoRoot, entry) {
  const candidate = path.isAbsolute(entry)
    ? path.resolve(entry)
    : path.resolve(repoRoot, entry);
  if (!fs.existsSync(candidate)) {
    throw new Error(`Entry does not exist: ${entry}`);
  }
  if (!candidate.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Entry is outside repo root: ${entry}`);
  }
  return candidate;
}

function resolveImportSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const candidate = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    candidate,
    `${candidate}.js`,
    path.join(candidate, 'index.js'),
  ];
  for (const resolved of candidates) {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return candidate;
}

function readLiteralConstants(source) {
  const constants = new Map();
  CONST_STRING_RE.lastIndex = 0;
  let match = null;
  while ((match = CONST_STRING_RE.exec(source))) {
    constants.set(match[1], match[2]);
  }
  CONST_IMPORT_META_URL_RE.lastIndex = 0;
  while ((match = CONST_IMPORT_META_URL_RE.exec(source))) {
    constants.set(match[1], match[2]);
  }
  return constants;
}

function readImportEdges(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const literalConstants = readLiteralConstants(source);
  const edges = [];
  IMPORT_RE.lastIndex = 0;
  let match = null;
  while ((match = IMPORT_RE.exec(source))) {
    const identifier = match[4] || '';
    const specifier = match[1] || match[2] || match[3] || literalConstants.get(identifier) || identifier;
    const unresolvedDynamicIdentifier = Boolean(identifier && !literalConstants.has(identifier));
    if (unresolvedDynamicIdentifier) {
      edges.push({
        specifier,
        relative: false,
        resolved: null,
        missing: false,
        unresolvedDynamicIdentifier,
      });
      continue;
    }
    const resolved = resolveImportSpecifier(filePath, specifier);
    edges.push({
      specifier,
      relative: specifier.startsWith('.'),
      resolved,
      missing: Boolean(resolved && !fs.existsSync(resolved)),
    });
  }
  return edges;
}

function walkGraph(repoRoot, entryFiles) {
  const stack = [...entryFiles];
  const visited = new Set();
  const graph = {};
  const missing = [];
  const external = new Set();

  while (stack.length > 0) {
    const filePath = stack.pop();
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    const edges = readImportEdges(filePath);
    graph[relativeToRoot(repoRoot, filePath)] = edges.map((edge) => {
      if (edge.unresolvedDynamicIdentifier) {
        external.add(`dynamic:${edge.specifier}`);
        return {
          specifier: edge.specifier,
          kind: 'dynamic-unresolved',
        };
      }
      if (!edge.relative) {
        external.add(edge.specifier);
        return {
          specifier: edge.specifier,
          kind: 'external',
        };
      }
      if (edge.missing) {
        missing.push({
          from: relativeToRoot(repoRoot, filePath),
          specifier: edge.specifier,
          resolved: relativeToRoot(repoRoot, edge.resolved),
        });
      } else if (edge.resolved.startsWith(`${repoRoot}${path.sep}`)) {
        stack.push(edge.resolved);
      }
      return {
        specifier: edge.specifier,
        kind: 'relative',
        target: relativeToRoot(repoRoot, edge.resolved),
        missing: edge.missing,
      };
    });
  }

  return {
    files: [...visited].sort().map((filePath) => relativeToRoot(repoRoot, filePath)),
    graph,
    external_specifiers: [...external].sort(),
    missing,
  };
}

function classifyFiles(files) {
  const counts = {
    apps_web: 0,
    web_viewer: 0,
    vendor: 0,
    other: 0,
  };
  for (const filePath of files) {
    if (filePath.startsWith('apps/web/')) {
      counts.apps_web += 1;
    } else if (filePath.startsWith('deps/cadgamefusion/tools/web_viewer/vendor/')) {
      counts.vendor += 1;
    } else if (filePath.startsWith('deps/cadgamefusion/tools/web_viewer/')) {
      counts.web_viewer += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

function toRootAbsoluteAssetPath(filePath) {
  return `/${toPosixPath(filePath).replace(/^\/+/, '')}`;
}

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function digestAssetFiles(repoRoot, files) {
  return Object.fromEntries(files.map((filePath) => [
    toRootAbsoluteAssetPath(filePath),
    hashFile(path.join(repoRoot, filePath)),
  ]));
}

function hashProductOfflineManifest({ entries, assetPaths, assetDigests, externalSpecifiers }) {
  const payload = {
    schema_version: OFFLINE_MANIFEST_SCHEMA_VERSION,
    manifest_version: OFFLINE_MANIFEST_VERSION,
    entries,
    asset_paths: assetPaths,
    asset_digests: assetDigests,
    external_specifiers: externalSpecifiers,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function formatAssetsModule(summary) {
  const manifest = {
    schemaVersion: summary.offline_manifest_schema_version,
    manifestVersion: summary.offline_manifest_version,
    assetManifestHash: summary.asset_manifest_hash,
    assetManifestHashAlgorithm: summary.asset_manifest_hash_algorithm,
    assetCount: summary.asset_count,
    assetDigests: summary.asset_digests,
    assets: summary.asset_paths,
  };
  return [
    '// Generated by tools/web_viewer/scripts/product_bootstrap_import_graph.js',
    `const manifest = ${JSON.stringify(manifest, null, 2)};`,
    'manifest.assets = Object.freeze(manifest.assets);',
    'self.__VEMCAD_PRODUCT_OFFLINE_MANIFEST = Object.freeze(manifest);',
    'self.__VEMCAD_PRODUCT_OFFLINE_ASSETS = self.__VEMCAD_PRODUCT_OFFLINE_MANIFEST.assets;',
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const repoRoot = path.resolve(args.repoRoot);
  const outdir = path.resolve(args.outdir);
  const runDir = path.join(outdir, nowStamp());
  ensureDir(runDir);

  const entries = args.entries.map((entry) => resolveEntry(repoRoot, entry));
  const result = walkGraph(repoRoot, entries);
  const entryPaths = entries.map((entry) => relativeToRoot(repoRoot, entry));
  const assetPaths = result.files.map(toRootAbsoluteAssetPath);
  const assetDigests = digestAssetFiles(repoRoot, result.files);
  const externalSpecifiers = result.external_specifiers;
  const assetManifestHash = hashProductOfflineManifest({
    entries: entryPaths,
    assetPaths,
    assetDigests,
    externalSpecifiers,
  });
  const summary = {
    schema_version: 1,
    offline_manifest_schema_version: OFFLINE_MANIFEST_SCHEMA_VERSION,
    offline_manifest_version: OFFLINE_MANIFEST_VERSION,
    asset_manifest_hash_algorithm: 'sha256',
    asset_manifest_hash: assetManifestHash,
    ok: result.missing.length === 0,
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    run_dir: runDir,
    entries: entryPaths,
    file_count: result.files.length,
    file_counts: classifyFiles(result.files),
    asset_count: result.files.length,
    asset_paths: assetPaths,
    asset_digests: assetDigests,
    external_specifiers: externalSpecifiers,
    missing: result.missing,
    files: result.files,
    graph: result.graph,
  };

  const summaryPath = path.join(runDir, 'summary.json');
  const graphPath = path.join(runDir, 'product-offline-import-graph.json');
  const assetsModulePath = path.join(runDir, 'product-offline-assets.js');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(graphPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(assetsModulePath, formatAssetsModule(summary), 'utf8');
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${summaryPath}`);
  console.log(`graph_json=${graphPath}`);
  console.log(`assets_js=${assetsModulePath}`);
  const firstPartyMissing = summary.missing.filter((m) => !/(^|\/)vendor\//.test(m.resolved));
  const vendorMissingCount = summary.missing.length - firstPartyMissing.length;
  const gateOk = args.ignoreVendorMissing ? firstPartyMissing.length === 0 : summary.missing.length === 0;
  console.log(JSON.stringify({
    ok: summary.ok,
    gate_ok: gateOk,
    ignore_vendor_missing: Boolean(args.ignoreVendorMissing),
    file_count: summary.file_count,
    asset_count: summary.asset_count,
    asset_manifest_hash: summary.asset_manifest_hash,
    file_counts: summary.file_counts,
    missing_count: summary.missing.length,
    first_party_missing_count: firstPartyMissing.length,
    vendor_missing_count: vendorMissingCount,
  }, null, 2));
  if (args.ignoreVendorMissing && vendorMissingCount > 0 && firstPartyMissing.length === 0) {
    console.log(`[import-graph] tolerated ${vendorMissingCount} vendored-missing asset(s) (e.g. gitignored three.module.js); first-party graph complete.`);
  }
  return gateOk ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
}
