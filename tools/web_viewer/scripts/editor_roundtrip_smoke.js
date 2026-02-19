#!/usr/bin/env node
/*
  Editor round-trip smoke:
  - load CADGF document.json (schemas/document.schema.json)
  - import -> apply deterministic edits via CommandBus -> export CADGF
  - validate exported JSON against schema
  - run plm_convert with json importer plugin (smoke preview pipeline)
*/

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';
import { importCadgfDocument, exportCadgfDocument, isCadgfDocument } from '../adapters/cadgf_document_adapter.js';

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/editor_roundtrip_smoke.js [--mode observe|gate] [--cases <json>] [--limit N] [--outdir <dir>] [--plugin <path>] [--no-convert]',
    '',
    'If --cases is omitted, it discovers the latest build/cad_regression/<run_id>/previews/**/document.json (up to --limit).',
    'If discovery is empty, it falls back to tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json when present.',
    '',
    'cases json formats supported:',
    '- ["path/to/document.json", ...]',
    '- [{ "name": "caseA", "path": "path/to/document.json" }, ...]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    cases: '',
    limit: 5,
    outdir: '',
    plugin: '',
    convert: true,
    mode: 'observe',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--mode' && i + 1 < argv.length) {
      args.mode = String(argv[i + 1] || '').trim().toLowerCase();
      i += 1;
      continue;
    }
    if (token === '--cases' && i + 1 < argv.length) {
      args.cases = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--limit' && i + 1 < argv.length) {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--plugin' && i + 1 < argv.length) {
      args.plugin = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--no-convert') {
      args.convert = false;
      continue;
    }
    throw new Error(`Unknown arg: ${token}\n\n${usage()}`);
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 5;
  if (args.mode !== 'observe' && args.mode !== 'gate') {
    throw new Error(`Invalid --mode: ${args.mode}\n\n${usage()}`);
  }
  return args;
}

function toIsoNow() {
  return new Date().toISOString();
}

function makeRunId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad3(d.getMilliseconds());
  const nonce = crypto.randomBytes(2).toString('hex');
  return `${y}${m}${day}_${hh}${mm}${ss}_${ms}_${nonce}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function cloneJson(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function run(cmd, args, { cwd = process.cwd() } = {}) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return {
    code: Number.isFinite(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function walkFiles(dir, { maxFiles = 2000 } = {}) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        out.push(full);
        if (out.length >= maxFiles) return out;
      }
    }
  }
  return out;
}

function discoverCadgfDocuments(repoRoot, limit) {
  const base = path.join(repoRoot, 'build', 'cad_regression');
  const runs = listDirs(base).sort().reverse();
  if (runs.length === 0) {
    return [];
  }

  const out = [];
  for (const runId of runs) {
    const previews = path.join(base, runId, 'previews');
    const files = walkFiles(previews, { maxFiles: 5000 });
    const docs = files.filter((p) => path.basename(p) === 'document.json').sort();
    for (const p of docs) {
      out.push({
        name: `${runId}__${path.basename(path.dirname(p))}`,
        path: p,
        source_run_id: runId,
      });
      if (out.length >= limit) {
        return out;
      }
    }
  }
  return out;
}

function loadCases(casesPath, repoRoot, limit) {
  if (!casesPath) {
    const discovered = discoverCadgfDocuments(repoRoot, limit);
    if (discovered.length > 0) {
      return discovered;
    }
    const fixtureCases = path.join(
      repoRoot,
      'tools',
      'web_viewer',
      'tests',
      'fixtures',
      'editor_roundtrip_smoke_cases.json',
    );
    if (fs.existsSync(fixtureCases)) {
      return loadCases(fixtureCases, repoRoot, limit);
    }
    return discovered;
  }
  const absolute = path.isAbsolute(casesPath) ? casesPath : path.join(repoRoot, casesPath);
  const payload = readJson(absolute);
  const cases = [];
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (typeof entry === 'string') {
        cases.push({ name: path.basename(path.dirname(entry)), path: entry });
        continue;
      }
      if (entry && typeof entry === 'object' && typeof entry.path === 'string') {
        cases.push({ name: entry.name || path.basename(path.dirname(entry.path)), path: entry.path });
      }
    }
  } else {
    throw new Error('cases JSON must be an array.');
  }
  return cases.slice(0, limit).map((c) => ({
    ...c,
    path: path.isAbsolute(c.path) ? c.path : path.join(repoRoot, c.path),
  }));
}

function uniqueCaseNames(cases) {
  const used = new Map();
  return cases.map((entry) => {
    const base = String(entry.name || path.basename(path.dirname(entry.path)) || 'case').trim() || 'case';
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    if (count === 0) return { ...entry, name: base };
    return { ...entry, name: `${base}_${count + 1}` };
  });
}

function validateCadgfSchemaPython({ schemaPath, docPath, repoRoot }) {
  const code = [
    'import json, sys',
    'try:',
    '  from jsonschema import Draft202012Validator',
    'except Exception as e:',
    "  print(f'jsonschema import failed: {e}')",
    '  sys.exit(3)',
    'schema_path = sys.argv[1]',
    'doc_path = sys.argv[2]',
    'schema = json.load(open(schema_path, "r", encoding="utf-8"))',
    'doc = json.load(open(doc_path, "r", encoding="utf-8"))',
    'v = Draft202012Validator(schema)',
    'errors = sorted(v.iter_errors(doc), key=lambda e: list(e.path))',
    'if not errors:',
    '  sys.exit(0)',
    'print(f"errors={len(errors)}")',
    'for err in errors[:5]:',
    '  loc = "$" + ("/" + "/".join(str(p) for p in err.path) if err.path else "")',
    '  print(f"{loc}: {err.message}")',
    'sys.exit(2)',
  ].join('\n');

  const res = run('python3', ['-c', code, schemaPath, docPath], { cwd: repoRoot });
  return {
    ok: res.code === 0,
    code: res.code,
    stdout: res.stdout.trim(),
    stderr: res.stderr.trim(),
  };
}

function setupEditorFromCadgf(cadgfJson) {
  const imported = importCadgfDocument(cadgfJson);
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  const ctx = { document, selection, snap, viewport, commandBus: null };
  const bus = new CommandBus(ctx);
  registerCadCommands(bus, ctx);
  document.restore(imported.docSnapshot);
  return { document, selection, bus, imported };
}

function stableStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function sanitizeCadgfForCompare(cadgfJson) {
  const cloned = cloneJson(cadgfJson);
  if (cloned && cloned.metadata && typeof cloned.metadata === 'object') {
    if (Object.prototype.hasOwnProperty.call(cloned.metadata, 'modified_at')) {
      cloned.metadata.modified_at = '__IGNORED__';
    }
  }
  return cloned;
}

function fingerprintCadgf(cadgfJson) {
  const sanitized = sanitizeCadgfForCompare(cadgfJson);
  const text = stableStringify(sanitized);
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const typeCounts = {};
  const entities = Array.isArray(cadgfJson?.entities) ? cadgfJson.entities : [];
  for (const entity of entities) {
    const t = String(entity?.type ?? 'unknown');
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const layers = Array.isArray(cadgfJson?.layers) ? cadgfJson.layers : [];
  return {
    hash,
    layer_count: layers.length,
    entity_count: entities.length,
    type_counts: typeCounts,
  };
}

function applyDeterministicEdits({ document, selection, bus }) {
  const entities = document.listEntities();
  const byType = (type) => entities.find((e) => e && e.type === type);
  const edits = [];

  const line = byType('line');
  if (line) {
    selection.setSelection([line.id], line.id);
    const res = bus.execute('selection.move', { delta: { x: 1, y: -1 } });
    edits.push({ kind: 'move-line', ok: res.ok, changed: res.changed, message: res.message });

    // Exercise offset on a simple entity type.
    const moved = document.getEntity(line.id);
    if (moved && moved.type === 'line') {
      selection.setSelection([moved.id], moved.id);
      const sidePoint = { x: moved.start.x, y: moved.start.y + 10 };
      const res2 = bus.execute('selection.offset', { distance: 1.5, sidePoint });
      edits.push({ kind: 'offset-line', ok: res2.ok, changed: res2.changed, message: res2.message, error_code: res2.error_code });
    }
  }

  const poly = entities.find((e) => e && e.type === 'polyline' && Array.isArray(e.points) && e.points.length >= 2);
  if (poly) {
    const a = poly.points[0];
    const b = poly.points[1];
    const inserted = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 + 1.0 };
    const nextPoints = [poly.points[0], inserted, ...poly.points.slice(1)];
    selection.setSelection([poly.id], poly.id);
    const res = bus.execute('selection.propertyPatch', { patch: { points: nextPoints } });
    edits.push({ kind: 'insert-poly-vertex', ok: res.ok, changed: res.changed, message: res.message });

    // Exercise offset for polyline (Level B). Use a normal-based side point to be case-agnostic.
    const patched = document.getEntity(poly.id);
    if (patched && patched.type === 'polyline' && Array.isArray(patched.points) && patched.points.length >= 2) {
      const p0 = patched.points[0];
      const p1 = patched.points[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const sidePoint = { x: p0.x + nx * 10, y: p0.y + ny * 10 };
      selection.setSelection([patched.id], patched.id);
      const res2 = bus.execute('selection.offset', { distance: 2.0, sidePoint });
      edits.push({ kind: 'offset-polyline', ok: res2.ok, changed: res2.changed, message: res2.message, error_code: res2.error_code });
    }
  }

  const arc = byType('arc');
  if (arc) {
    selection.setSelection([arc.id], arc.id);
    const res = bus.execute('selection.propertyPatch', {
      patch: { startAngle: (arc.startAngle || 0) + Math.PI / 24, endAngle: (arc.endAngle || 0) + Math.PI / 24 },
    });
    edits.push({ kind: 'patch-arc-angles', ok: res.ok, changed: res.changed, message: res.message });
  }

  const circle = byType('circle');
  if (circle) {
    selection.setSelection([circle.id], circle.id);
    const res = bus.execute('selection.propertyPatch', { patch: { radius: Math.max(0.001, (circle.radius || 1) * 1.05) } });
    edits.push({ kind: 'patch-circle-radius', ok: res.ok, changed: res.changed, message: res.message });
  }

  const text = byType('text');
  if (text) {
    selection.setSelection([text.id], text.id);
    const value = String(text.value || 'TEXT');
    const res = bus.execute('selection.propertyPatch', { patch: { value: value.endsWith('_EDIT') ? value : `${value}_EDIT` } });
    edits.push({ kind: 'patch-text', ok: res.ok, changed: res.changed, message: res.message });
  }

  return edits;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..', '..', '..');

  const pluginPath = args.plugin
    ? (path.isAbsolute(args.plugin) ? args.plugin : path.join(repoRoot, args.plugin))
    : path.join(repoRoot, 'build', 'plugins', 'libcadgf_json_importer_plugin.dylib');

  const schemaPath = path.join(repoRoot, 'schemas', 'document.schema.json');
  const outBase = args.outdir
    ? (path.isAbsolute(args.outdir) ? args.outdir : path.join(repoRoot, args.outdir))
    : path.join(repoRoot, 'build', 'editor_roundtrip');
  const runId = makeRunId();
  const runDir = path.join(outBase, runId);
  ensureDir(runDir);
  ensureDir(path.join(runDir, 'cases'));

  const cases = loadCases(args.cases, repoRoot, args.limit);
  const normalizedCases = uniqueCaseNames(cases);

  const results = [];
  if (normalizedCases.length === 0) {
    results.push({
      name: 'DISCOVERY',
      input: '',
      started_at: toIsoNow(),
      finished_at: toIsoNow(),
      failure_codes: ['DISCOVERY_EMPTY'],
      import: { warning_count: 0, warnings: [], entity_count: 0, unsupported_count: 0 },
      edits: [],
      export: { message: 'No CADGF documents found. Generate STEP166 previews first, or pass --cases.' },
      roundtrip: { ok: false, message: 'no cases discovered' },
      schema_validation: { ok: false, code: 2, stdout: '', stderr: '' },
      convert: { ok: false, code: 2, stderr: '' },
      status: 'FAIL',
    });
  }
  for (const entry of normalizedCases) {
    const caseName = entry.name || path.basename(path.dirname(entry.path));
    const caseDir = path.join(runDir, 'cases', caseName);
    ensureDir(caseDir);

    const startedAt = toIsoNow();
    const one = {
      name: caseName,
      input: path.isAbsolute(entry.path) ? entry.path : path.join(repoRoot, entry.path),
      started_at: startedAt,
      finished_at: '',
      failure_codes: [],
      import: {},
      edits: [],
      export: {},
      roundtrip: {},
      schema_validation: {},
      convert: {},
      status: 'FAIL',
    };

    try {
      if (!fs.existsSync(one.input)) {
        one.status = 'SKIPPED';
        one.export.message = 'input missing';
        one.failure_codes.push('INPUT_MISSING');
        results.push(one);
        continue;
      }
      const cadgfJson = readJson(one.input);
      if (!isCadgfDocument(cadgfJson)) {
        one.status = 'SKIPPED';
        one.export.message = 'not a cadgf document';
        one.failure_codes.push('NOT_CADGF');
        results.push(one);
        continue;
      }

      const { document, selection, bus, imported } = setupEditorFromCadgf(cadgfJson);
      const entities = document.listEntities();
      const unsupportedCount = entities.filter((e) => e?.type === 'unsupported').length;
      one.import = {
        warnings: imported.warnings,
        warning_count: imported.warnings.length,
        entity_count: entities.length,
        unsupported_count: unsupportedCount,
      };

      one.edits = applyDeterministicEdits({ document, selection, bus });

      const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
      const exportedPath = path.join(caseDir, 'exported_document.json');
      writeJson(exportedPath, exported);
      one.export = {
        path: exportedPath,
      };

      // Export -> re-import -> export should be stable (ignoring modified_at), otherwise round-trip is unsafe.
      const roundtripExportedPath = path.join(caseDir, 'exported_document_roundtrip.json');
      let roundtrip = null;
      try {
        const { document: doc2, imported: imported2 } = setupEditorFromCadgf(exported);
        const exported2 = exportCadgfDocument(doc2, { baseCadgfJson: imported2.baseCadgfJson });
        writeJson(roundtripExportedPath, exported2);
        const fp1 = fingerprintCadgf(exported);
        const fp2 = fingerprintCadgf(exported2);
        const ok = fp1.hash === fp2.hash;
        roundtrip = {
          ok,
          exported_path: roundtripExportedPath,
          v1: fp1,
          v2: fp2,
          message: ok ? 'stable' : 'hash mismatch after re-import/export (ignoring metadata.modified_at)',
        };
      } catch (error) {
        roundtrip = {
          ok: false,
          exported_path: roundtripExportedPath,
          message: error?.message || String(error),
        };
      }
      one.roundtrip = roundtrip;

      const validation = validateCadgfSchemaPython({ schemaPath, docPath: exportedPath, repoRoot });
      one.schema_validation = validation;

      if (args.convert) {
        const convertOut = path.join(caseDir, 'preview');
        ensureDir(convertOut);
        const res = run(
          'python3',
          [
            path.join(repoRoot, 'tools', 'plm_convert.py'),
            '--plugin',
            pluginPath,
            '--input',
            exportedPath,
            '--out',
            convertOut,
            '--emit',
            'json,gltf,meta',
            '--validate-document',
          ],
          { cwd: repoRoot },
        );
        one.convert = {
          ok: res.code === 0,
          code: res.code,
          manifest: path.join(convertOut, 'manifest.json'),
          stderr: res.stderr.trim(),
        };
      }

      one.finished_at = toIsoNow();
      if (!one.schema_validation.ok) one.failure_codes.push('SCHEMA_FAIL');
      if (args.convert && !one.convert.ok) one.failure_codes.push('CONVERT_FAIL');
      if (one.roundtrip && one.roundtrip.ok === false) one.failure_codes.push('ROUNDTRIP_DRIFT');

      const ok = one.schema_validation.ok
        && (!args.convert || one.convert.ok)
        && (one.roundtrip?.ok !== false);
      one.status = ok ? 'PASS' : 'FAIL';
    } catch (error) {
      one.finished_at = toIsoNow();
      one.export.message = error?.message || String(error);
      one.failure_codes.push('UNHANDLED_EXCEPTION');
      one.status = 'FAIL';
    }

    results.push(one);
  }

  const totals = {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    skipped: results.filter((r) => r.status === 'SKIPPED').length,
  };

  const failureBuckets = {
    INPUT_INVALID: 0,
    IMPORT_FAIL: 0,
    VIEWPORT_LAYOUT_MISSING: 0,
    RENDER_DRIFT: 0,
    TEXT_METRIC_DRIFT: 0,
  };

  function classifyFailure(one) {
    const codes = new Set(Array.isArray(one?.failure_codes) ? one.failure_codes : []);
    if (codes.has('DISCOVERY_EMPTY') || codes.has('INPUT_MISSING') || codes.has('NOT_CADGF')) {
      return 'INPUT_INVALID';
    }
    if (codes.has('ROUNDTRIP_DRIFT')) {
      // We reuse the STEP166 bucket names to keep downstream reporting/gating consistent.
      return 'RENDER_DRIFT';
    }
    // Schema/convert/runtime exceptions all count as pipeline/import failures for gate purposes.
    return 'IMPORT_FAIL';
  }

  for (const one of results) {
    if (one.status !== 'FAIL') continue;
    const bucket = classifyFailure(one);
    failureBuckets[bucket] = (failureBuckets[bucket] || 0) + 1;
  }

  const gateDecision = {
    would_fail: totals.fail > 0,
    fail_reasons: [],
  };
  for (const [bucket, count] of Object.entries(failureBuckets)) {
    if (count > 0 && bucket !== 'VIEWPORT_LAYOUT_MISSING' && bucket !== 'TEXT_METRIC_DRIFT') {
      gateDecision.fail_reasons.push(`${bucket}=${count}`);
    }
  }

  const summary = {
    run_id: runId,
    started_at: toIsoNow(),
    finished_at: toIsoNow(),
    mode: args.mode,
    repo_root: repoRoot,
    plugin: pluginPath,
    schema: schemaPath,
    totals,
    failure_buckets: failureBuckets,
    gate_decision: gateDecision,
    results,
  };
  const summaryJson = path.join(runDir, 'summary.json');
  writeJson(summaryJson, summary);

  const lines = [];
  lines.push(`# Editor Round-Trip Smoke (${runId})`);
  lines.push('');
  lines.push(`- mode: \`${args.mode}\``);
  lines.push(`- repo_root: \`${repoRoot}\``);
  lines.push(`- plugin: \`${pluginPath}\``);
  lines.push(`- schema: \`${schemaPath}\``);
  lines.push(`- totals: pass=${totals.pass} fail=${totals.fail} skipped=${totals.skipped}`);
  lines.push(`- failure_buckets: INPUT_INVALID=${failureBuckets.INPUT_INVALID} IMPORT_FAIL=${failureBuckets.IMPORT_FAIL} RENDER_DRIFT=${failureBuckets.RENDER_DRIFT}`);
  lines.push('');
  lines.push('| case | status | entities | unsupported | warnings | schema | convert | roundtrip |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | --- | --- |');
  for (const r of results) {
    const schema = r.schema_validation?.ok ? 'OK' : `FAIL(${r.schema_validation?.code ?? '-'})`;
    const convert = args.convert ? (r.convert?.ok ? 'OK' : `FAIL(${r.convert?.code ?? '-'})`) : 'SKIP';
    const roundtrip = r.roundtrip?.ok === true ? 'OK' : (r.roundtrip?.ok === false ? 'FAIL' : 'SKIP');
    lines.push(
      `| ${r.name} | ${r.status} | ${r.import?.entity_count ?? 0} | ${r.import?.unsupported_count ?? 0} | ${r.import?.warning_count ?? 0} | ${schema} | ${convert} | ${roundtrip} |`,
    );
  }
  lines.push('');
  lines.push(`Artifacts: \`${runDir}\``);
  const summaryMd = path.join(runDir, 'summary.md');
  fs.writeFileSync(summaryMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`run_id=${runId}`);
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${summaryJson}`);
  console.log(`summary_md=${summaryMd}`);
  console.log(`totals pass=${totals.pass} fail=${totals.fail} skipped=${totals.skipped}`);

  if (args.mode === 'gate') {
    return totals.fail > 0 ? 2 : 0;
  }
  return 0;
}

process.exitCode = main();
