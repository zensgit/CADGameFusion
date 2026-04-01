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

const CASE_DEFAULT_PRIORITY = 'P1';
const CASE_PRIORITY_VALUES = new Set(['P0', 'P1', 'P2']);
const CADGF_ENTITY_TYPES = {
  POLYLINE: 0,
  POINT: 1,
  LINE: 2,
  ARC: 3,
  CIRCLE: 4,
  ELLIPSE: 5,
  SPLINE: 6,
  TEXT: 7,
};
const CASE_TAG_THRESHOLDS = {
  textHeavyMin: 60,
  textHeavyRatio: 0.15,
  arcHeavyMin: 40,
  arcHeavyRatio: 0.1,
  polylineHeavyMin: 40,
  polylineHeavyRatio: 0.12,
  importStressMin: 2000,
};
const MOVEABLE_ENTITY_TYPES = new Set(['line', 'polyline', 'circle', 'arc', 'text']);

function normalizeCaseTags(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((tag) => typeof tag === 'string');
}

function normalizeCasePriority(value) {
  const candidate = typeof value === 'string' ? value : '';
  return CASE_PRIORITY_VALUES.has(candidate) ? candidate : CASE_DEFAULT_PRIORITY;
}

function classifyCaseFromCadgf(payload) {
  const entities = Array.isArray(payload?.entities) ? payload.entities : [];
  const total = Math.max(1, entities.length);
  const counts = new Map();
  for (const entity of entities) {
    const rawType = entity?.type;
    const t = Number.isFinite(rawType) ? Number(rawType) : Number.parseInt(String(rawType ?? ''), 10);
    if (!Number.isFinite(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  const textCount = counts.get(CADGF_ENTITY_TYPES.TEXT) || 0;
  const arcCount = counts.get(CADGF_ENTITY_TYPES.ARC) || 0;
  const polylineCount = counts.get(CADGF_ENTITY_TYPES.POLYLINE) || 0;

  const tags = [];
  if (textCount >= CASE_TAG_THRESHOLDS.textHeavyMin || (textCount / total) >= CASE_TAG_THRESHOLDS.textHeavyRatio) {
    tags.push('text-heavy');
  }
  if (arcCount >= CASE_TAG_THRESHOLDS.arcHeavyMin || (arcCount / total) >= CASE_TAG_THRESHOLDS.arcHeavyRatio) {
    tags.push('arc-heavy');
  }
  if (
    polylineCount >= CASE_TAG_THRESHOLDS.polylineHeavyMin ||
    (polylineCount / total) >= CASE_TAG_THRESHOLDS.polylineHeavyRatio
  ) {
    tags.push('polyline-heavy');
  }
  if (entities.length >= CASE_TAG_THRESHOLDS.importStressMin) tags.push('import-stress');

  const priority = tags.includes('import-stress') ? 'P0' : CASE_DEFAULT_PRIORITY;
  return { tags, priority };
}

function inferCaseMetadataFromPath(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      return { tags: [], priority: CASE_DEFAULT_PRIORITY };
    }
    const payload = readJson(absPath);
    if (!isCadgfDocument(payload)) {
      return { tags: [], priority: CASE_DEFAULT_PRIORITY };
    }
    return classifyCaseFromCadgf(payload);
  } catch {
    return { tags: [], priority: CASE_DEFAULT_PRIORITY };
  }
}

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/editor_roundtrip_smoke.js [--mode observe|gate] [--cases <json>] [--limit N] [--priority-set <csv>] [--tag-any <csv>] [--outdir <dir>] [--plugin <path>] [--no-convert]',
    '',
    'If --cases is omitted, it discovers the latest build/cad_regression/<run_id>/previews/**/document.json (up to --limit).',
    'If discovery is empty, it falls back to tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json when present.',
    '',
    'cases json formats supported:',
    '- ["path/to/document.json", ...]',
    '- [{ "name": "caseA", "path": "path/to/document.json", "tags": ["text-heavy"], "priority": "P1" }, ...]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    cases: '',
    limit: 5,
    prioritySet: '',
    tagAny: '',
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
    if (token === '--priority-set' && i + 1 < argv.length) {
      args.prioritySet = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--tag-any' && i + 1 < argv.length) {
      args.tagAny = argv[i + 1];
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
  args.prioritySetList = parsePriorityFilter(args.prioritySet);
  args.tagAnyList = parseTagFilter(args.tagAny);
  return args;
}

function parseCsvList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((part) => String(part || '').trim())
    .filter((part) => part.length > 0);
}

function parsePriorityFilter(value) {
  const requested = parseCsvList(value);
  if (requested.length === 0) return [];
  const out = [];
  for (const one of requested) {
    if (CASE_PRIORITY_VALUES.has(one)) {
      out.push(one);
    }
  }
  return [...new Set(out)];
}

function parseTagFilter(value) {
  const requested = parseCsvList(value);
  if (requested.length === 0) return [];
  return [...new Set(requested)];
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

function loadCases(casesPath, repoRoot, discoverLimit) {
  const normalizeEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.path !== 'string' || entry.path.trim().length === 0) return null;
    const absolutePath = path.isAbsolute(entry.path) ? entry.path : path.join(repoRoot, entry.path);
    const explicitPriority = typeof entry.priority === 'string' && CASE_PRIORITY_VALUES.has(entry.priority);
    let tags = normalizeCaseTags(entry.tags);
    let priority = normalizeCasePriority(entry.priority);
    if (!explicitPriority || tags.length === 0) {
      const inferred = inferCaseMetadataFromPath(absolutePath);
      if (tags.length === 0 && inferred.tags.length > 0) {
        tags = inferred.tags;
      }
      if (!explicitPriority) {
        priority = normalizeCasePriority(inferred.priority);
      }
    }
    return {
      ...entry,
      name: entry.name || path.basename(path.dirname(entry.path)),
      path: absolutePath,
      tags,
      priority,
    };
  };

  if (!casesPath) {
    const discovered = discoverCadgfDocuments(repoRoot, discoverLimit);
    if (discovered.length > 0) {
      return discovered.map((entry) => ({
        ...entry,
        tags: normalizeCaseTags(entry.tags),
        priority: normalizeCasePriority(entry.priority),
      }));
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
      return loadCases(fixtureCases, repoRoot, discoverLimit);
    }
    return discovered;
  }
  const absolute = path.isAbsolute(casesPath) ? casesPath : path.join(repoRoot, casesPath);
  const payload = readJson(absolute);
  const cases = [];
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (typeof entry === 'string') {
        cases.push({
          name: path.basename(path.dirname(entry)),
          path: entry,
          tags: [],
          priority: CASE_DEFAULT_PRIORITY,
        });
        continue;
      }
      const normalized = normalizeEntry(entry);
      if (normalized) {
        cases.push(normalized);
      }
    }
  } else {
    throw new Error('cases JSON must be an array.');
  }
  return cases.map((entry) => normalizeEntry(entry)).filter(Boolean);
}

function compareCasePriority(a, b) {
  const rank = { P0: 0, P1: 1, P2: 2 };
  const pa = normalizeCasePriority(a?.priority);
  const pb = normalizeCasePriority(b?.priority);
  const da = rank[pa] ?? rank.P1;
  const db = rank[pb] ?? rank.P1;
  if (da !== db) return da - db;
  const na = String(a?.name || '');
  const nb = String(b?.name || '');
  if (na !== nb) return na.localeCompare(nb);
  return String(a?.path || '').localeCompare(String(b?.path || ''));
}

function selectCasesForRun(cases, { limit, prioritySet, tagAny }) {
  const safeLimit = Math.max(1, Number.isFinite(limit) ? Number(limit) : 1);
  const prioritySetValues = Array.isArray(prioritySet) ? prioritySet.filter((p) => CASE_PRIORITY_VALUES.has(p)) : [];
  const priorityFilter = new Set(prioritySetValues);
  const tagFilter = new Set(Array.isArray(tagAny) ? tagAny.filter((t) => typeof t === 'string' && t.length > 0) : []);

  const sorted = [...cases].sort(compareCasePriority);
  let filtered = sorted;
  if (priorityFilter.size > 0) {
    filtered = filtered.filter((entry) => priorityFilter.has(normalizeCasePriority(entry?.priority)));
  }
  if (tagFilter.size > 0) {
    filtered = filtered.filter((entry) => {
      const tags = normalizeCaseTags(entry?.tags);
      return tags.some((tag) => tagFilter.has(tag));
    });
  }
  const matchedCount = filtered.length;

  let usedFallback = false;
  if (filtered.length === 0 && sorted.length > 0 && (priorityFilter.size > 0 || tagFilter.size > 0)) {
    filtered = sorted;
    usedFallback = true;
  }

  return {
    selected: filtered.slice(0, safeLimit),
    selection: {
      total_input: sorted.length,
      filtered_count: filtered.length,
      matched_count: matchedCount,
      selected_count: Math.min(filtered.length, safeLimit),
      limit: safeLimit,
      priority_filter: [...priorityFilter],
      tag_any_filter: [...tagFilter],
      used_fallback: usedFallback,
    },
  };
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

function deepSubsetEqual(source, target) {
  if (source === null || source === undefined) {
    return source === target;
  }
  if (typeof source !== 'object') {
    return source === target;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(target) || target.length !== source.length) return false;
    for (let i = 0; i < source.length; i += 1) {
      if (!deepSubsetEqual(source[i], target[i])) return false;
    }
    return true;
  }
  if (!target || typeof target !== 'object' || Array.isArray(target)) return false;
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) return false;
    if (!deepSubsetEqual(source[key], target[key])) return false;
  }
  return true;
}

function normalizeUnsupportedPassthroughCadgf(entity) {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return entity;
  const normalized = { ...entity };
  if (typeof normalized.line_type === 'string' && normalized.line_type.trim()) {
    normalized.line_type = normalized.line_type.trim().toUpperCase();
  }
  return normalized;
}

function extractOriginSubset(entity) {
  const subset = {};
  if (!entity || typeof entity !== 'object') return subset;
  if (typeof entity.sourceType === 'string' && entity.sourceType.trim()) subset.sourceType = entity.sourceType.trim();
  if (typeof entity.editMode === 'string' && entity.editMode.trim()) subset.editMode = entity.editMode.trim();
  if (typeof entity.proxyKind === 'string' && entity.proxyKind.trim()) subset.proxyKind = entity.proxyKind.trim();
  if (typeof entity.blockName === 'string' && entity.blockName.trim()) subset.blockName = entity.blockName.trim();
  if (typeof entity.hatchPattern === 'string' && entity.hatchPattern.trim()) subset.hatchPattern = entity.hatchPattern.trim();
  if (Number.isFinite(entity.hatchId)) subset.hatchId = Math.trunc(entity.hatchId);
  if (typeof entity.textKind === 'string' && entity.textKind.trim()) subset.textKind = entity.textKind.trim();
  if (typeof entity.dimStyle === 'string' && entity.dimStyle.trim()) subset.dimStyle = entity.dimStyle.trim();
  if (Number.isFinite(entity.dimType)) subset.dimType = Math.trunc(entity.dimType);
  if (entity.dimTextPos && Number.isFinite(entity.dimTextPos.x) && Number.isFinite(entity.dimTextPos.y)) {
    subset.dimTextPos = { x: Number(entity.dimTextPos.x), y: Number(entity.dimTextPos.y) };
  }
  if (Number.isFinite(entity.dimTextRotation)) subset.dimTextRotation = Number(entity.dimTextRotation);
  return subset;
}

function extractAssemblySubset(entity) {
  const subset = extractOriginSubset(entity);
  if (!entity || typeof entity !== 'object') return subset;
  if (Number.isFinite(entity.groupId)) subset.groupId = Math.trunc(entity.groupId);
  if (Number.isFinite(entity.space)) subset.space = Math.trunc(entity.space);
  if (typeof entity.layout === 'string' && entity.layout.trim()) subset.layout = entity.layout.trim();
  return subset;
}

function captureOriginTrackedEntities(entities, predicate) {
  const out = [];
  for (const entity of Array.isArray(entities) ? entities : []) {
    if (!entity || !predicate(entity)) continue;
    const id = Number(entity.id);
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      type: String(entity.type || ''),
      metadata: extractOriginSubset(entity),
    });
  }
  return out;
}

function captureAssemblyTrackedEntities(entities) {
  const tracked = [];
  for (const entity of Array.isArray(entities) ? entities : []) {
    const id = Number(entity?.id);
    if (!Number.isFinite(id)) continue;
    const subset = extractAssemblySubset(entity);
    if (!Number.isFinite(subset.groupId)) continue;
    tracked.push({
      id,
      type: String(entity?.type || ''),
      metadata: subset,
    });
  }
  return tracked;
}

function summarizeAssemblyGroups(tracked) {
  const byGroup = new Map();
  for (const one of Array.isArray(tracked) ? tracked : []) {
    const groupId = Number(one?.metadata?.groupId);
    if (!Number.isFinite(groupId)) continue;
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, {
        entityIds: [],
        blockName: typeof one?.metadata?.blockName === 'string' ? one.metadata.blockName : '',
        sourceType: typeof one?.metadata?.sourceType === 'string' ? one.metadata.sourceType : '',
        editMode: typeof one?.metadata?.editMode === 'string' ? one.metadata.editMode : '',
        proxyKind: typeof one?.metadata?.proxyKind === 'string' ? one.metadata.proxyKind : '',
        space: Number.isFinite(one?.metadata?.space) ? Math.trunc(one.metadata.space) : null,
        layout: typeof one?.metadata?.layout === 'string' ? one.metadata.layout : '',
      });
    }
    byGroup.get(groupId).entityIds.push(one.id);
  }
  const out = [];
  for (const [groupId, group] of byGroup.entries()) {
    group.entityIds.sort((a, b) => a - b);
    out.push({ groupId, ...group });
  }
  out.sort((a, b) => a.groupId - b.groupId);
  return out;
}

function resolveAssemblyGroupLayoutLabel(group) {
  const layout = typeof group?.layout === 'string' ? group.layout.trim() : '';
  if (layout) return layout;
  if (Number.isFinite(group?.space)) {
    const space = Math.trunc(Number(group.space));
    if (space === 0) return 'Model';
    if (space === 1) return 'PaperSpace';
  }
  return 'Unspecified';
}

function summarizeAssemblyGroupLayoutSourceCounts(tracked) {
  const counts = {};
  for (const group of summarizeAssemblyGroups(tracked)) {
    const layoutLabel = resolveAssemblyGroupLayoutLabel(group);
    const sourceLabel = typeof group?.sourceType === 'string' && group.sourceType.trim()
      ? group.sourceType.trim()
      : 'unknown';
    if (!counts[layoutLabel]) counts[layoutLabel] = {};
    counts[layoutLabel][sourceLabel] = (counts[layoutLabel][sourceLabel] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, inner]) => [
        layout,
        Object.fromEntries(Object.entries(inner).sort((a, b) => a[0].localeCompare(b[0]))),
      ]),
  );
}

function summarizeAssemblyGroupSourceCounts(tracked) {
  const counts = {};
  for (const group of summarizeAssemblyGroups(tracked)) {
    const sourceLabel = typeof group?.sourceType === 'string' && group.sourceType.trim()
      ? group.sourceType.trim()
      : 'unknown';
    counts[sourceLabel] = (counts[sourceLabel] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function summarizeProxyKindCounts(tracked) {
  const counts = {};
  for (const one of Array.isArray(tracked) ? tracked : []) {
    const proxyKind = typeof one?.metadata?.proxyKind === 'string' ? one.metadata.proxyKind.trim() : '';
    if (!proxyKind) continue;
    counts[proxyKind] = (counts[proxyKind] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function summarizeTextKindCounts(entities) {
  const counts = {};
  for (const entity of Array.isArray(entities) ? entities : []) {
    const textKind = typeof entity?.textKind === 'string' ? entity.textKind.trim() : '';
    if (!textKind) continue;
    counts[textKind] = (counts[textKind] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function resolveEntityLayoutLabel(entity) {
  const layout = typeof entity?.layout === 'string' ? entity.layout.trim() : '';
  if (layout) return layout;
  if (Number.isFinite(entity?.space)) {
    const space = Math.trunc(Number(entity.space));
    if (space === 0) return 'Model';
    if (space === 1) return 'PaperSpace';
  }
  return 'Unspecified';
}

function summarizeTextKindLayoutCounts(entities) {
  const counts = {};
  for (const entity of Array.isArray(entities) ? entities : []) {
    const textKind = typeof entity?.textKind === 'string' ? entity.textKind.trim() : '';
    if (!textKind) continue;
    const layoutLabel = resolveEntityLayoutLabel(entity);
    if (!counts[layoutLabel]) counts[layoutLabel] = {};
    counts[layoutLabel][textKind] = (counts[layoutLabel][textKind] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, inner]) => [
        layout,
        Object.fromEntries(Object.entries(inner).sort((a, b) => a[0].localeCompare(b[0]))),
      ]),
  );
}

function summarizeProxyLayoutKindCounts(entities) {
  const counts = {};
  for (const entity of Array.isArray(entities) ? entities : []) {
    if (!entity || entity.editMode !== 'proxy') continue;
    const proxyKind = typeof entity?.proxyKind === 'string' ? entity.proxyKind.trim() : '';
    if (!proxyKind) continue;
    const layoutLabel = resolveEntityLayoutLabel(entity);
    if (!counts[layoutLabel]) counts[layoutLabel] = {};
    counts[layoutLabel][proxyKind] = (counts[layoutLabel][proxyKind] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, inner]) => [
        layout,
        Object.fromEntries(Object.entries(inner).sort((a, b) => a[0].localeCompare(b[0]))),
      ]),
  );
}

function summarizeExplodedLayoutSourceCounts(entities) {
  const counts = {};
  for (const entity of Array.isArray(entities) ? entities : []) {
    if (!entity || entity.editMode !== 'exploded') continue;
    if (!MOVEABLE_ENTITY_TYPES.has(String(entity?.type || ''))) continue;
    const sourceType = typeof entity?.sourceType === 'string' && entity.sourceType.trim()
      ? entity.sourceType.trim()
      : 'unknown';
    const layoutLabel = resolveEntityLayoutLabel(entity);
    if (!counts[layoutLabel]) counts[layoutLabel] = {};
    counts[layoutLabel][sourceType] = (counts[layoutLabel][sourceType] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, inner]) => [
        layout,
        Object.fromEntries(Object.entries(inner).sort((a, b) => a[0].localeCompare(b[0]))),
      ]),
  );
}

function getCadgfMetaValue(cadgfJson, key) {
  const meta = cadgfJson?.metadata?.meta;
  if (!meta || typeof meta !== 'object') return '';
  const value = meta[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getCadgfMetaInt(cadgfJson, key) {
  const value = Number.parseInt(getCadgfMetaValue(cadgfJson, key), 10);
  return Number.isFinite(value) ? value : 0;
}

function summarizeViewportMetadata(cadgfJson) {
  const viewportCount = Math.max(0, getCadgfMetaInt(cadgfJson, 'dxf.viewport.count'));
  const layouts = [];
  for (let i = 0; i < viewportCount; i += 1) {
    const layout = getCadgfMetaValue(cadgfJson, `dxf.viewport.${i}.layout`);
    if (layout) layouts.push(layout);
  }
  const uniqueLayouts = [...new Set(layouts)];
  return {
    viewport_count: viewportCount,
    viewport_layout_count: uniqueLayouts.length,
    viewport_layouts: uniqueLayouts,
  };
}

function validateDerivedProxySemantics({ sourceDerivedEntities, exportedCadgf }) {
  const tracked = Array.isArray(sourceDerivedEntities) ? sourceDerivedEntities : [];
  if (tracked.length === 0) {
    return {
      ok: true,
      checked_count: 0,
      missing_count: 0,
      metadata_drift_count: 0,
      editable_count: 0,
      missing_ids: [],
      metadata_drift_ids: [],
      editable_ids: [],
      message: 'checked=0 missing=0 metadata_drift=0 editable=0',
    };
  }

  const { document, selection, bus } = setupEditorFromCadgf(exportedCadgf);
  const missingIds = [];
  const metadataDriftIds = [];
  const editableIds = [];

  for (const one of tracked) {
    const id = Number(one?.id);
    if (!Number.isFinite(id)) continue;
    const entity = document.getEntity(id);
    if (!entity) {
      missingIds.push(id);
      continue;
    }
    if (!deepSubsetEqual(one.metadata, extractOriginSubset(entity))) {
      metadataDriftIds.push(id);
    }
    selection.setSelection([id], id);
    const res = bus.execute('selection.move', { delta: { x: 1, y: 1 } });
    if (res.ok || res.error_code !== 'UNSUPPORTED_READ_ONLY') {
      editableIds.push(id);
    }
  }

  const ok = missingIds.length === 0 && metadataDriftIds.length === 0 && editableIds.length === 0;
  return {
    ok,
    checked_count: tracked.length,
    missing_count: missingIds.length,
    metadata_drift_count: metadataDriftIds.length,
    editable_count: editableIds.length,
    missing_ids: missingIds,
    metadata_drift_ids: metadataDriftIds,
    editable_ids: editableIds,
    message: `checked=${tracked.length} missing=${missingIds.length} metadata_drift=${metadataDriftIds.length} editable=${editableIds.length}`,
  };
}

function validateExplodedEditableSemantics({ sourceExplodedEntities, exportedCadgf }) {
  const tracked = Array.isArray(sourceExplodedEntities) ? sourceExplodedEntities : [];
  if (tracked.length === 0) {
    return {
      ok: true,
      checked_count: 0,
      missing_count: 0,
      metadata_drift_count: 0,
      blocked_count: 0,
      missing_ids: [],
      metadata_drift_ids: [],
      blocked_ids: [],
      message: 'checked=0 missing=0 metadata_drift=0 blocked=0',
    };
  }

  const { document, selection, bus } = setupEditorFromCadgf(exportedCadgf);
  const missingIds = [];
  const metadataDriftIds = [];
  const blockedIds = [];

  for (const one of tracked) {
    const id = Number(one?.id);
    if (!Number.isFinite(id)) continue;
    const entity = document.getEntity(id);
    if (!entity) {
      missingIds.push(id);
      continue;
    }
    if (!deepSubsetEqual(one.metadata, extractOriginSubset(entity))) {
      metadataDriftIds.push(id);
    }
    selection.setSelection([id], id);
    const res = bus.execute('selection.move', { delta: { x: 1, y: 1 } });
    if (!res.ok || res.error_code === 'UNSUPPORTED_READ_ONLY') {
      blockedIds.push(id);
    }
  }

  const ok = missingIds.length === 0 && metadataDriftIds.length === 0 && blockedIds.length === 0;
  return {
    ok,
    checked_count: tracked.length,
    missing_count: missingIds.length,
    metadata_drift_count: metadataDriftIds.length,
    blocked_count: blockedIds.length,
    missing_ids: missingIds,
    metadata_drift_ids: metadataDriftIds,
    blocked_ids: blockedIds,
    message: `checked=${tracked.length} missing=${missingIds.length} metadata_drift=${metadataDriftIds.length} blocked=${blockedIds.length}`,
  };
}

function validateAssemblyRoundtripSemantics({ sourceAssemblyEntities, exportedCadgf }) {
  const tracked = Array.isArray(sourceAssemblyEntities) ? sourceAssemblyEntities : [];
  if (tracked.length === 0) {
    return {
      ok: true,
      checked_count: 0,
      group_count: 0,
      missing_count: 0,
      metadata_drift_count: 0,
      group_drift_count: 0,
      missing_ids: [],
      metadata_drift_ids: [],
      drifted_group_ids: [],
      message: 'checked=0 groups=0 missing=0 metadata_drift=0 group_drift=0',
    };
  }

  const { document } = setupEditorFromCadgf(exportedCadgf);
  const missingIds = [];
  const metadataDriftIds = [];

  for (const one of tracked) {
    const id = Number(one?.id);
    if (!Number.isFinite(id)) continue;
    const entity = document.getEntity(id);
    if (!entity) {
      missingIds.push(id);
      continue;
    }
    if (!deepSubsetEqual(one.metadata, extractAssemblySubset(entity))) {
      metadataDriftIds.push(id);
    }
  }

  const expectedGroups = summarizeAssemblyGroups(tracked);
  const actualGroups = summarizeAssemblyGroups(captureAssemblyTrackedEntities(document.listEntities()));
  const actualByGroupId = new Map(actualGroups.map((group) => [group.groupId, group]));
  const driftedGroupIds = [];
  for (const expected of expectedGroups) {
    const actual = actualByGroupId.get(expected.groupId);
    if (!actual || !deepSubsetEqual(expected, actual)) {
      driftedGroupIds.push(expected.groupId);
    }
  }

  const ok = missingIds.length === 0 && metadataDriftIds.length === 0 && driftedGroupIds.length === 0;
  return {
    ok,
    checked_count: tracked.length,
    group_count: expectedGroups.length,
    missing_count: missingIds.length,
    metadata_drift_count: metadataDriftIds.length,
    group_drift_count: driftedGroupIds.length,
    missing_ids: missingIds,
    metadata_drift_ids: metadataDriftIds,
    drifted_group_ids: driftedGroupIds,
    message: `checked=${tracked.length} groups=${expectedGroups.length} missing=${missingIds.length} metadata_drift=${metadataDriftIds.length} group_drift=${driftedGroupIds.length}`,
  };
}

function validateUnsupportedPassthrough({ unsupportedEntities, exportedCadgf }) {
  const exportedList = Array.isArray(exportedCadgf?.entities) ? exportedCadgf.entities : [];
  const byId = new Map();
  for (const one of exportedList) {
    const id = Number(one?.id);
    if (!Number.isFinite(id)) continue;
    byId.set(id, one);
  }

  const missingIds = [];
  const driftedIds = [];
  let checked = 0;
  for (const one of unsupportedEntities) {
    const id = Number(one?.id);
    if (!Number.isFinite(id)) continue;
    checked += 1;
    const exported = byId.get(id);
    if (!exported) {
      missingIds.push(id);
      continue;
    }
    const expectedCadgf = normalizeUnsupportedPassthroughCadgf(one.cadgf);
    const actualCadgf = normalizeUnsupportedPassthroughCadgf(exported);
    if (!deepSubsetEqual(expectedCadgf, actualCadgf)) {
      driftedIds.push(id);
    }
  }

  const ok = missingIds.length === 0 && driftedIds.length === 0;
  let message = `checked=${checked} missing=${missingIds.length} drifted=${driftedIds.length}`;
  if (!ok) {
    const missingText = missingIds.length > 0 ? ` missing_ids=${missingIds.join(',')}` : '';
    const driftText = driftedIds.length > 0 ? ` drifted_ids=${driftedIds.join(',')}` : '';
    message += `${missingText}${driftText}`;
  }
  return {
    ok,
    checked_count: checked,
    missing_count: missingIds.length,
    drifted_count: driftedIds.length,
    missing_ids: missingIds,
    drifted_ids: driftedIds,
    message,
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
  args.limit = Math.max(args.limit, 17);
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

  const loadedCases = loadCases(args.cases, repoRoot, Math.max(args.limit * 4, args.limit));
  const normalizedCases = uniqueCaseNames(loadedCases);
  const selectedCases = selectCasesForRun(normalizedCases, {
    limit: args.limit,
    prioritySet: args.prioritySetList,
    tagAny: args.tagAnyList,
  });
  const selectedRunCases = selectedCases.selected;
  if (selectedCases.selection.used_fallback) {
    console.warn('warn=case_filters_empty_fallback_to_unfiltered');
  }

  const results = [];
  if (selectedRunCases.length === 0) {
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
  for (const entry of selectedRunCases) {
    const caseName = entry.name || path.basename(path.dirname(entry.path));
    const caseDir = path.join(runDir, 'cases', caseName);
    ensureDir(caseDir);

    const startedAt = toIsoNow();
    const one = {
      name: caseName,
      tags: normalizeCaseTags(entry.tags),
      priority: normalizeCasePriority(entry.priority),
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
      const derivedProxyEntities = captureOriginTrackedEntities(
        entities,
        (entity) => entity?.editMode === 'proxy',
      );
      const explodedOriginEntities = captureOriginTrackedEntities(
        entities,
        (entity) => entity?.editMode === 'exploded' && MOVEABLE_ENTITY_TYPES.has(String(entity?.type || '')),
      );
      const assemblyTrackedEntities = captureAssemblyTrackedEntities(entities);
      one.import.derived_proxy_count = derivedProxyEntities.length;
      one.import.derived_proxy_kind_counts = summarizeProxyKindCounts(derivedProxyEntities);
      one.import.derived_proxy_layout_kind_counts = summarizeProxyLayoutKindCounts(entities);
      one.import.exploded_origin_count = explodedOriginEntities.length;
      one.import.exploded_origin_layout_source_counts = summarizeExplodedLayoutSourceCounts(entities);
      one.import.text_kind_counts = summarizeTextKindCounts(entities);
      one.import.text_kind_layout_counts = summarizeTextKindLayoutCounts(entities);
      one.import.assembly_tracked_count = assemblyTrackedEntities.length;
      one.import.assembly_group_count = summarizeAssemblyGroups(assemblyTrackedEntities).length;
      one.import.assembly_group_source_counts = summarizeAssemblyGroupSourceCounts(assemblyTrackedEntities);
      one.import.assembly_group_layout_source_counts = summarizeAssemblyGroupLayoutSourceCounts(assemblyTrackedEntities);
      Object.assign(one.import, summarizeViewportMetadata(cadgfJson));
      const unsupportedEntities = entities
        .filter((e) => e?.type === 'unsupported' && Number.isFinite(e?.id) && e?.cadgf && typeof e.cadgf === 'object')
        .map((e) => ({ id: Number(e.id), cadgf: cloneJson(e.cadgf) }));

      one.edits = applyDeterministicEdits({ document, selection, bus });

      const exported = exportCadgfDocument(document, { baseCadgfJson: imported.baseCadgfJson });
      const exportedPath = path.join(caseDir, 'exported_document.json');
      writeJson(exportedPath, exported);
      const unsupportedPassthrough = validateUnsupportedPassthrough({ unsupportedEntities, exportedCadgf: exported });
      const derivedProxySemantics = validateDerivedProxySemantics({ sourceDerivedEntities: derivedProxyEntities, exportedCadgf: exported });
      const explodedOriginEditability = validateExplodedEditableSemantics({
        sourceExplodedEntities: explodedOriginEntities,
        exportedCadgf: exported,
      });
      const assemblyRoundtripSemantics = validateAssemblyRoundtripSemantics({
        sourceAssemblyEntities: assemblyTrackedEntities,
        exportedCadgf: exported,
      });
      one.export = {
        path: exportedPath,
        unsupported_passthrough: unsupportedPassthrough,
        derived_proxy_semantics: derivedProxySemantics,
        exploded_origin_editability: explodedOriginEditability,
        assembly_roundtrip_semantics: assemblyRoundtripSemantics,
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
      if (one.export?.unsupported_passthrough?.ok === false) one.failure_codes.push('UNSUPPORTED_PASSTHROUGH_DRIFT');
      if (one.export?.derived_proxy_semantics?.ok === false) one.failure_codes.push('DERIVED_PROXY_SEMANTICS_DRIFT');
      if (one.export?.exploded_origin_editability?.ok === false) one.failure_codes.push('EXPLODED_ORIGIN_EDITABILITY_DRIFT');
      if (one.export?.assembly_roundtrip_semantics?.ok === false) one.failure_codes.push('ASSEMBLY_ROUNDTRIP_SEMANTICS_DRIFT');

      const ok = one.schema_validation.ok
        && (!args.convert || one.convert.ok)
        && (one.roundtrip?.ok !== false)
        && (one.export?.unsupported_passthrough?.ok !== false)
        && (one.export?.derived_proxy_semantics?.ok !== false)
        && (one.export?.exploded_origin_editability?.ok !== false)
        && (one.export?.assembly_roundtrip_semantics?.ok !== false);
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
  const priorityTotals = { P0: 0, P1: 0, P2: 0 };
  for (const one of results) {
    const priority = normalizeCasePriority(one?.priority);
    priorityTotals[priority] += 1;
  }

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
    filters: {
      priority_set: args.prioritySetList,
      tag_any: args.tagAnyList,
    },
    case_selection: selectedCases.selection,
    repo_root: repoRoot,
    plugin: pluginPath,
    schema: schemaPath,
    totals,
    priority_totals: priorityTotals,
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
  lines.push(`- filters.priority_set: \`${args.prioritySetList.join(',') || '-'}\``);
  lines.push(`- filters.tag_any: \`${args.tagAnyList.join(',') || '-'}\``);
  lines.push(`- case_selection: selected=${selectedCases.selection.selected_count}/${selectedCases.selection.total_input} matched=${selectedCases.selection.matched_count} candidate=${selectedCases.selection.filtered_count} fallback=${selectedCases.selection.used_fallback ? 'yes' : 'no'}`);
  lines.push(`- repo_root: \`${repoRoot}\``);
  lines.push(`- plugin: \`${pluginPath}\``);
  lines.push(`- schema: \`${schemaPath}\``);
  lines.push(`- totals: pass=${totals.pass} fail=${totals.fail} skipped=${totals.skipped}`);
  lines.push(`- priority_totals: P0=${priorityTotals.P0} P1=${priorityTotals.P1} P2=${priorityTotals.P2}`);
  lines.push(`- failure_buckets: INPUT_INVALID=${failureBuckets.INPUT_INVALID} IMPORT_FAIL=${failureBuckets.IMPORT_FAIL} RENDER_DRIFT=${failureBuckets.RENDER_DRIFT}`);
  lines.push('');
  lines.push('| case | priority | tags | status | entities | unsupported | warnings | schema | convert | roundtrip |');
  lines.push('| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |');
  for (const r of results) {
    const schema = r.schema_validation?.ok ? 'OK' : `FAIL(${r.schema_validation?.code ?? '-'})`;
    const convert = args.convert ? (r.convert?.ok ? 'OK' : `FAIL(${r.convert?.code ?? '-'})`) : 'SKIP';
    const roundtrip = r.roundtrip?.ok === true ? 'OK' : (r.roundtrip?.ok === false ? 'FAIL' : 'SKIP');
    const tagsText = Array.isArray(r.tags) && r.tags.length > 0 ? r.tags.join(',') : '-';
    lines.push(
      `| ${r.name} | ${normalizeCasePriority(r.priority)} | ${tagsText} | ${r.status} | ${r.import?.entity_count ?? 0} | ${r.import?.unsupported_count ?? 0} | ${r.import?.warning_count ?? 0} | ${schema} | ${convert} | ${roundtrip} |`,
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
  console.log(`case_selection selected=${selectedCases.selection.selected_count} matched=${selectedCases.selection.matched_count} candidate=${selectedCases.selection.filtered_count} total=${selectedCases.selection.total_input} fallback=${selectedCases.selection.used_fallback ? 1 : 0}`);
  console.log(`totals pass=${totals.pass} fail=${totals.fail} skipped=${totals.skipped}`);

  if (args.mode === 'gate') {
    return totals.fail > 0 ? 2 : 0;
  }
  return 0;
}

process.exitCode = main();
