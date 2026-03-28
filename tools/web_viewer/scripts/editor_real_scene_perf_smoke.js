#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import { CommandBus } from '../commands/command_bus.js';
import { registerCadCommands } from '../commands/command_registry.js';
import { createToolContext } from '../tools/tool_context.js';
import { hydrateDocument } from '../adapters/document_json_adapter.js';
import { importCadgfDocument, isCadgfDocument } from '../adapters/cadgf_document_adapter.js';

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/editor_real_scene_perf_smoke.js [options]',
    '',
    'Options:',
    '  --mode observe|gate          default: observe',
    '  --profile <json>             default: docs/baselines/STEP174_REAL_SCENE_PERF_PROFILE.json',
    '  --doc <path>                 override input document path',
    '  --outdir <dir>               default: build/editor_real_scene_perf',
    '  --pick-samples <N>           default: 2000',
    '  --box-samples <N>            default: 800',
    '  --drag-samples <N>           default: 120',
    '  --threshold-pick-p95 <ms>    default: 0.05',
    '  --threshold-box-p95 <ms>     default: 0.08',
    '  --threshold-drag-p95 <ms>    default: 0.20',
    '  --help',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    mode: 'observe',
    profile: 'docs/baselines/STEP174_REAL_SCENE_PERF_PROFILE.json',
    doc: '',
    outdir: 'build/editor_real_scene_perf',
    pickSamples: 2000,
    boxSamples: 800,
    dragSamples: 120,
    thresholdPickP95: 0.05,
    thresholdBoxP95: 0.08,
    thresholdDragP95: 0.20,
    help: false,
  };

  const toInt = (v, fallback, min = 1) => (Number.isFinite(v) ? Math.max(min, Math.floor(v)) : fallback);
  const toFloat = (v, fallback, min = 0) => (Number.isFinite(v) ? Math.max(min, Number(v)) : fallback);

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--mode' && i + 1 < argv.length) {
      args.mode = String(argv[++i] || '').trim();
      continue;
    }
    if (token === '--profile' && i + 1 < argv.length) {
      args.profile = String(argv[++i] || '').trim();
      continue;
    }
    if (token === '--doc' && i + 1 < argv.length) {
      args.doc = String(argv[++i] || '').trim();
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = String(argv[++i] || '').trim();
      continue;
    }
    if (token === '--pick-samples' && i + 1 < argv.length) {
      args.pickSamples = toInt(Number.parseInt(argv[++i], 10), args.pickSamples, 100);
      continue;
    }
    if (token === '--box-samples' && i + 1 < argv.length) {
      args.boxSamples = toInt(Number.parseInt(argv[++i], 10), args.boxSamples, 50);
      continue;
    }
    if (token === '--drag-samples' && i + 1 < argv.length) {
      args.dragSamples = toInt(Number.parseInt(argv[++i], 10), args.dragSamples, 20);
      continue;
    }
    if (token === '--threshold-pick-p95' && i + 1 < argv.length) {
      args.thresholdPickP95 = toFloat(Number.parseFloat(argv[++i]), args.thresholdPickP95, 0);
      continue;
    }
    if (token === '--threshold-box-p95' && i + 1 < argv.length) {
      args.thresholdBoxP95 = toFloat(Number.parseFloat(argv[++i]), args.thresholdBoxP95, 0);
      continue;
    }
    if (token === '--threshold-drag-p95' && i + 1 < argv.length) {
      args.thresholdDragP95 = toFloat(Number.parseFloat(argv[++i]), args.thresholdDragP95, 0);
      continue;
    }
    throw new Error(`Unknown arg: ${token}\n\n${usage()}`);
  }

  if (args.mode !== 'observe' && args.mode !== 'gate') {
    throw new Error(`Invalid --mode: ${args.mode}\n\n${usage()}`);
  }
  return args;
}

function makeRunId() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}_${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}`;
}

function createRng(seed = 20260212) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function stats(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { count: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, max_ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, one) => acc + one, 0);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
  return {
    count: sorted.length,
    avg_ms: sum / sorted.length,
    p50_ms: pick(0.5),
    p95_ms: pick(0.95),
    max_ms: sorted[sorted.length - 1],
  };
}

function maybeLoadProfile(profilePath) {
  try {
    if (!profilePath || !fs.existsSync(profilePath)) return {};
    const payload = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

function resolveInputPath(repoRoot, profile, argDoc) {
  const chosen = argDoc || profile.doc || '';
  if (!chosen) return '';
  return path.isAbsolute(chosen) ? chosen : path.join(repoRoot, chosen);
}

function computeBounds(entities) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const addPoint = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const entity of entities) {
    if (!entity || entity.visible === false) continue;
    if (entity.type === 'line') {
      addPoint(entity.start?.x, entity.start?.y);
      addPoint(entity.end?.x, entity.end?.y);
      continue;
    }
    if (entity.type === 'polyline' && Array.isArray(entity.points)) {
      for (const p of entity.points) addPoint(p?.x, p?.y);
      continue;
    }
    if (entity.type === 'circle' || entity.type === 'arc') {
      const c = entity.center;
      const r = Number(entity.radius || 0);
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(r)) {
        addPoint(c.x - r, c.y - r);
        addPoint(c.x + r, c.y + r);
      }
      continue;
    }
    if (entity.type === 'text') {
      addPoint(entity.position?.x, entity.position?.y);
    }
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX === maxX || minY === maxY) {
    return { minX: -100, minY: -100, maxX: 100, maxY: 100, width: 200, height: 200 };
  }

  const marginX = Math.max(1, (maxX - minX) * 0.03);
  const marginY = Math.max(1, (maxY - minY) * 0.03);
  minX -= marginX;
  minY -= marginY;
  maxX += marginX;
  maxY += marginY;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function pickDragEntity(document) {
  const entities = document.listVisibleEntities();
  const score = {
    line: 0,
    polyline: 1,
    circle: 2,
    arc: 3,
    text: 4,
  };
  let best = null;
  for (const entity of entities) {
    const s = score[entity.type];
    if (!Number.isFinite(s)) continue;
    if (!best || s < best.score) {
      best = { score: s, entity };
      if (s === 0) break;
    }
  }
  return best ? best.entity : null;
}

function buildPatch(entity, shift) {
  if (!entity) return null;
  if (entity.type === 'line') {
    return {
      start: { x: entity.start.x + shift, y: entity.start.y },
      end: { x: entity.end.x + shift, y: entity.end.y },
    };
  }
  if (entity.type === 'polyline' && Array.isArray(entity.points) && entity.points.length > 0) {
    const points = entity.points.map((p, idx) => (
      idx === 0 ? { x: p.x + shift, y: p.y } : p
    ));
    return { points };
  }
  if (entity.type === 'circle') {
    return { radius: Math.max(0.001, Number(entity.radius || 0) + shift) };
  }
  if (entity.type === 'arc') {
    return { radius: Math.max(0.001, Number(entity.radius || 0) + shift) };
  }
  if (entity.type === 'text') {
    return { position: { x: entity.position.x + shift, y: entity.position.y } };
  }
  return null;
}

function writeMarkdown(filePath, payload) {
  const m = payload.metrics || {};
  const t = payload.thresholds || {};
  const d = payload.gate_decision || {};
  const lines = [];
  lines.push('# Editor Real Scene Performance Smoke');
  lines.push('');
  lines.push(`- run_id: \`${payload.run_id}\``);
  lines.push(`- mode: \`${payload.mode}\``);
  lines.push(`- status: \`${payload.status}\``);
  lines.push(`- doc: \`${payload.input_doc}\``);
  lines.push(`- profile: \`${payload.profile}\``);
  lines.push('');
  lines.push('| metric | p95_ms | threshold_ms |');
  lines.push('| --- | ---: | ---: |');
  lines.push(`| pick_entity_at | ${m.pick?.p95_ms?.toFixed(4) || ''} | ${Number(t.pick_p95_ms || 0).toFixed(4)} |`);
  lines.push(`| box_select_query | ${m.box_query?.p95_ms?.toFixed(4) || ''} | ${Number(t.box_p95_ms || 0).toFixed(4)} |`);
  lines.push(`| drag_property_patch | ${m.drag_commit?.p95_ms?.toFixed(4) || ''} | ${Number(t.drag_p95_ms || 0).toFixed(4)} |`);
  lines.push('');
  lines.push(`- gate_would_fail: \`${d.would_fail === true}\``);
  lines.push(`- fail_reasons: \`${Array.isArray(d.fail_reasons) && d.fail_reasons.length ? d.fail_reasons.join('; ') : 'none'}\``);
  lines.push('');
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function emitAndExit(runDir, payload, mode) {
  const summaryJson = path.join(runDir, 'summary.json');
  const summaryMd = path.join(runDir, 'summary.md');
  writeJson(summaryJson, payload);
  writeMarkdown(summaryMd, payload);
  console.log(`run_id=${payload.run_id}`);
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${summaryJson}`);
  console.log(`summary_md=${summaryMd}`);
  console.log(`status=${payload.status}`);
  console.log(`gate_would_fail=${payload.gate_decision?.would_fail === true}`);
  if (mode === 'gate' && payload.gate_decision?.would_fail === true) {
    return 2;
  }
  return 0;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const repoRoot = process.cwd();
  const profilePath = path.isAbsolute(args.profile) ? args.profile : path.join(repoRoot, args.profile);
  const profile = maybeLoadProfile(profilePath);

  const thresholds = {
    pick_p95_ms: Number(profile?.thresholds?.pick_p95_ms ?? args.thresholdPickP95),
    box_p95_ms: Number(profile?.thresholds?.box_p95_ms ?? args.thresholdBoxP95),
    drag_p95_ms: Number(profile?.thresholds?.drag_p95_ms ?? args.thresholdDragP95),
  };

  const inputDoc = resolveInputPath(repoRoot, profile, args.doc);
  const runId = makeRunId();
  const runDir = path.join(path.isAbsolute(args.outdir) ? args.outdir : path.join(repoRoot, args.outdir), runId);
  ensureDir(runDir);

  if (!inputDoc || !fs.existsSync(inputDoc)) {
    const missingPayload = {
      run_id: runId,
      generated_at: new Date().toISOString(),
      mode: args.mode,
      status: args.mode === 'gate' ? 'FAIL' : 'SKIPPED',
      profile: profilePath,
      input_doc: inputDoc || '(empty)',
      config: {
        pick_samples: args.pickSamples,
        box_samples: args.boxSamples,
        drag_samples: args.dragSamples,
      },
      thresholds,
      metrics: {
        pick: { count: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, max_ms: 0 },
        box_query: { count: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, max_ms: 0 },
        drag_commit: { count: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, max_ms: 0 },
      },
      gate_decision: {
        would_fail: args.mode === 'gate',
        fail_reasons: ['INPUT_DOC_MISSING'],
      },
    };
    return emitAndExit(runDir, missingPayload, args.mode);
  }

  const raw = JSON.parse(fs.readFileSync(inputDoc, 'utf8'));
  const document = new DocumentState();
  if (isCadgfDocument(raw)) {
    const imported = importCadgfDocument(raw);
    document.restore(imported.docSnapshot, { silent: true });
  } else {
    hydrateDocument(document, raw);
  }

  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  const commandContext = {
    document,
    selection,
    snap,
    viewport,
    commandBus: null,
  };
  const commandBus = new CommandBus(commandContext);
  registerCadCommands(commandBus, commandContext);

  const toolCtx = createToolContext({
    document,
    selection,
    snap,
    viewport,
    commandBus,
    canvasView: { setTransientOverlay() {} },
    setStatus() {},
    readCommandInput() { return {}; },
  });

  const bounds = computeBounds(document.listVisibleEntities());
  const rng = createRng(20260212 ^ inputDoc.length);

  const pickSamples = [];
  for (let i = 0; i < args.pickSamples; i += 1) {
    const x = bounds.minX + rng() * bounds.width;
    const y = bounds.minY + rng() * bounds.height;
    const t0 = performance.now();
    toolCtx.pickEntityAt({ x, y }, 10);
    pickSamples.push(performance.now() - t0);
  }

  const boxSamples = [];
  for (let i = 0; i < args.boxSamples; i += 1) {
    const x = bounds.minX + rng() * bounds.width;
    const y = bounds.minY + rng() * bounds.height;
    const w = Math.max(5, bounds.width * (0.01 + rng() * 0.06));
    const h = Math.max(5, bounds.height * (0.01 + rng() * 0.06));
    const t0 = performance.now();
    document.queryVisibleEntityIdsInRect(
      { x0: x, y0: y, x1: x + w, y1: y + h },
      { sortById: false },
    );
    boxSamples.push(performance.now() - t0);
  }

  const dragEntity = pickDragEntity(document);
  const dragSamples = [];
  let dragFailures = 0;
  if (dragEntity) {
    selection.setSelection([dragEntity.id], dragEntity.id);
    for (let i = 0; i < args.dragSamples; i += 1) {
      const current = document.getEntity(dragEntity.id);
      const shift = (i % 2 === 0 ? 1 : -1) * 0.01;
      const patch = buildPatch(current, shift);
      if (!patch) {
        dragFailures += 1;
        dragSamples.push(0);
        continue;
      }
      const t0 = performance.now();
      const res = commandBus.execute('selection.propertyPatch', {
        entityIds: [dragEntity.id],
        patch,
      });
      dragSamples.push(performance.now() - t0);
      if (!res?.ok) dragFailures += 1;
    }
  } else {
    dragFailures += 1;
  }

  const metrics = {
    pick: stats(pickSamples),
    box_query: stats(boxSamples),
    drag_commit: stats(dragSamples),
  };

  const failReasons = [];
  if (metrics.pick.p95_ms > thresholds.pick_p95_ms) {
    failReasons.push(`PICK_P95>${thresholds.pick_p95_ms} (${metrics.pick.p95_ms.toFixed(4)})`);
  }
  if (metrics.box_query.p95_ms > thresholds.box_p95_ms) {
    failReasons.push(`BOX_P95>${thresholds.box_p95_ms} (${metrics.box_query.p95_ms.toFixed(4)})`);
  }
  if (metrics.drag_commit.p95_ms > thresholds.drag_p95_ms) {
    failReasons.push(`DRAG_P95>${thresholds.drag_p95_ms} (${metrics.drag_commit.p95_ms.toFixed(4)})`);
  }
  if (dragFailures > 0) {
    failReasons.push(`DRAG_EXEC_FAIL=${dragFailures}`);
  }

  const payload = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    mode: args.mode,
    status: failReasons.length === 0 ? 'PASS' : 'FAIL',
    profile: profilePath,
    input_doc: inputDoc,
    config: {
      entities: document.listEntities().length,
      pick_samples: args.pickSamples,
      box_samples: args.boxSamples,
      drag_samples: args.dragSamples,
    },
    thresholds,
    metrics,
    gate_decision: {
      would_fail: failReasons.length > 0,
      fail_reasons: failReasons,
    },
  };

  return emitAndExit(runDir, payload, args.mode);
}

try {
  const code = main();
  process.exit(code);
} catch (error) {
  const message = error?.stack || error?.message || String(error);
  console.error(message);
  process.exit(1);
}
