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

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/editor_performance_smoke.js [options]',
    '',
    'Options:',
    '  --entities N         synthetic entities count (default: 5000)',
    '  --pick-samples N     pick benchmark samples (default: 2000)',
    '  --box-samples N      box benchmark samples (default: 600)',
    '  --drag-samples N     drag/propertyPatch samples (default: 120)',
    '  --outdir DIR         output root (default: build/editor_perf)',
    '  --label NAME         optional label in report',
    '  --help               show help',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    entities: 5000,
    pickSamples: 2000,
    boxSamples: 600,
    dragSamples: 120,
    outdir: 'build/editor_perf',
    label: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--entities' && i + 1 < argv.length) {
      args.entities = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--pick-samples' && i + 1 < argv.length) {
      args.pickSamples = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--box-samples' && i + 1 < argv.length) {
      args.boxSamples = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--drag-samples' && i + 1 < argv.length) {
      args.dragSamples = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[++i];
      continue;
    }
    if (token === '--label' && i + 1 < argv.length) {
      args.label = String(argv[++i] || '').trim();
      continue;
    }
    throw new Error(`Unknown arg: ${token}\n\n${usage()}`);
  }
  const clampInt = (value, fallback, min = 1) => (Number.isFinite(value) && value >= min ? Math.floor(value) : fallback);
  args.entities = clampInt(args.entities, 5000, 200);
  args.pickSamples = clampInt(args.pickSamples, 2000, 100);
  args.boxSamples = clampInt(args.boxSamples, 600, 50);
  args.dragSamples = clampInt(args.dragSamples, 120, 20);
  return args;
}

function makeRunId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function createRng(seed = 1337) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function stats(samples) {
  if (!samples.length) {
    return { count: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, max_ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
  return {
    count: sorted.length,
    avg_ms: sum / sorted.length,
    p50_ms: pick(0.5),
    p95_ms: pick(0.95),
    max_ms: sorted[sorted.length - 1],
  };
}

function sumSamples(...parts) {
  const length = parts.reduce((max, one) => Math.max(max, one.length), 0);
  const out = new Array(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    let acc = 0;
    for (const one of parts) {
      acc += Number.isFinite(one[i]) ? one[i] : 0;
    }
    out[i] = acc;
  }
  return out;
}

function addSyntheticEntities(document, count) {
  const rng = createRng(20260211);
  const spacing = 12;
  const cols = 220;
  let firstLineId = null;

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const baseX = col * spacing + (rng() - 0.5) * 2;
    const baseY = row * spacing + (rng() - 0.5) * 2;
    const mode = i % 5;

    if (mode === 0) {
      const line = document.addEntity({
        type: 'line',
        start: { x: baseX, y: baseY },
        end: { x: baseX + 8 + rng() * 4, y: baseY + (rng() - 0.5) * 5 },
        layerId: 0,
      });
      if (line && firstLineId == null) firstLineId = line.id;
      continue;
    }
    if (mode === 1) {
      document.addEntity({
        type: 'polyline',
        points: [
          { x: baseX, y: baseY },
          { x: baseX + 6 + rng() * 3, y: baseY + 3 + rng() * 3 },
          { x: baseX + 10 + rng() * 2, y: baseY + (rng() - 0.5) * 3 },
        ],
        closed: false,
        layerId: 0,
      });
      continue;
    }
    if (mode === 2) {
      document.addEntity({
        type: 'circle',
        center: { x: baseX + 4, y: baseY + 4 },
        radius: 1.2 + rng() * 3,
        layerId: 0,
      });
      continue;
    }
    if (mode === 3) {
      document.addEntity({
        type: 'arc',
        center: { x: baseX + 5, y: baseY + 4 },
        radius: 2 + rng() * 2,
        startAngle: 0,
        endAngle: Math.PI * 0.75,
        cw: true,
        layerId: 0,
      });
      continue;
    }
    document.addEntity({
      type: 'text',
      position: { x: baseX + 2, y: baseY + 2 },
      value: `T${i}`,
      height: 1.8,
      rotation: 0,
      layerId: 0,
    });
  }
  return { firstLineId };
}

function measure(iterations, task) {
  const out = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    task(i);
    out.push(performance.now() - t0);
  }
  return out;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeMarkdown(filePath, payload) {
  const m = payload.metrics || {};
  const b = m.drag_breakdown || {};
  const lines = [
    '# Editor Performance Smoke',
    '',
    `- run_id: \`${payload.run_id}\``,
    `- generated_at: \`${payload.generated_at}\``,
    `- label: \`${payload.label || ''}\``,
    `- entities: \`${payload.config.entities}\``,
    `- pick_samples: \`${payload.config.pick_samples}\``,
    `- box_samples: \`${payload.config.box_samples}\``,
    `- drag_samples: \`${payload.config.drag_samples}\``,
    '',
    '| metric | avg_ms | p50_ms | p95_ms | max_ms |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| pick_entity_at | ${m.pick?.avg_ms?.toFixed(4) || ''} | ${m.pick?.p50_ms?.toFixed(4) || ''} | ${m.pick?.p95_ms?.toFixed(4) || ''} | ${m.pick?.max_ms?.toFixed(4) || ''} |`,
    `| box_select_query | ${m.box_query?.avg_ms?.toFixed(4) || ''} | ${m.box_query?.p50_ms?.toFixed(4) || ''} | ${m.box_query?.p95_ms?.toFixed(4) || ''} | ${m.box_query?.max_ms?.toFixed(4) || ''} |`,
    `| drag_property_patch | ${m.drag_commit?.avg_ms?.toFixed(4) || ''} | ${m.drag_commit?.p50_ms?.toFixed(4) || ''} | ${m.drag_commit?.p95_ms?.toFixed(4) || ''} | ${m.drag_commit?.max_ms?.toFixed(4) || ''} |`,
    '',
    '## Drag Breakdown',
    '',
    '| metric | avg_ms | p50_ms | p95_ms | max_ms |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| snapshot_before | ${b.snapshot_before?.avg_ms?.toFixed(4) || ''} | ${b.snapshot_before?.p50_ms?.toFixed(4) || ''} | ${b.snapshot_before?.p95_ms?.toFixed(4) || ''} | ${b.snapshot_before?.max_ms?.toFixed(4) || ''} |`,
    `| patch_apply_only | ${b.patch_apply?.avg_ms?.toFixed(4) || ''} | ${b.patch_apply?.p50_ms?.toFixed(4) || ''} | ${b.patch_apply?.p95_ms?.toFixed(4) || ''} | ${b.patch_apply?.max_ms?.toFixed(4) || ''} |`,
    `| snapshot_after | ${b.snapshot_after?.avg_ms?.toFixed(4) || ''} | ${b.snapshot_after?.p50_ms?.toFixed(4) || ''} | ${b.snapshot_after?.p95_ms?.toFixed(4) || ''} | ${b.snapshot_after?.max_ms?.toFixed(4) || ''} |`,
    `| capture_total | ${b.capture_total?.avg_ms?.toFixed(4) || ''} | ${b.capture_total?.p50_ms?.toFixed(4) || ''} | ${b.capture_total?.p95_ms?.toFixed(4) || ''} | ${b.capture_total?.max_ms?.toFixed(4) || ''} |`,
    `| estimated_total | ${b.estimated_total?.avg_ms?.toFixed(4) || ''} | ${b.estimated_total?.p50_ms?.toFixed(4) || ''} | ${b.estimated_total?.p95_ms?.toFixed(4) || ''} | ${b.estimated_total?.max_ms?.toFixed(4) || ''} |`,
    '',
  ];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const viewport = new ViewState();
  viewport.zoom = 1;
  viewport.pan = { x: 0, y: 0 };

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

  const { firstLineId } = addSyntheticEntities(document, args.entities);
  if (!Number.isFinite(firstLineId)) {
    throw new Error('failed to create baseline line entity');
  }

  const rng = createRng(20260212);
  const width = 220 * 12;
  const height = Math.ceil(args.entities / 220) * 12;

  const pickSamples = measure(args.pickSamples, () => {
    const x = rng() * width;
    const y = rng() * height;
    toolCtx.pickEntityAt({ x, y }, 10);
  });

  const boxSamples = measure(args.boxSamples, () => {
    const x = rng() * width;
    const y = rng() * height;
    const w = 30 + rng() * 120;
    const h = 20 + rng() * 90;
    document.queryVisibleEntityIdsInRect(
      { x0: x, y0: y, x1: x + w, y1: y + h },
      { sortById: false },
    );
  });

  selection.setSelection([firstLineId], firstLineId);
  const dragSamples = [];
  const snapshotBeforeSamples = [];
  const patchApplySamples = [];
  const snapshotAfterSamples = [];

  let activeProfile = null;
  commandContext.__perfHooks = {
    onSnapshotProfile(profile) {
      if (!activeProfile) return;
      if (profile?.commandId !== 'selection.propertyPatch') return;
      if (!Number.isFinite(profile?.ms)) return;
      if (profile.phase === 'before') activeProfile.before += profile.ms;
      if (profile.phase === 'mutator') activeProfile.mutator += profile.ms;
      if (profile.phase === 'after') activeProfile.after += profile.ms;
    },
  };

  let offset = 0;
  for (let i = 0; i < args.dragSamples; i += 1) {
    const line = document.getEntity(firstLineId);
    if (!line || line.type !== 'line') {
      dragSamples.push(0);
      snapshotBeforeSamples.push(0);
      patchApplySamples.push(0);
      snapshotAfterSamples.push(0);
      continue;
    }

    offset += 0.05;
    const patch = {
      start: { x: line.start.x + offset, y: line.start.y },
      end: { x: line.end.x + offset, y: line.end.y },
    };

    activeProfile = { before: 0, mutator: 0, after: 0 };
    const t0 = performance.now();
    commandBus.execute('selection.propertyPatch', {
      entityIds: [firstLineId],
      patch,
    });
    dragSamples.push(performance.now() - t0);

    snapshotBeforeSamples.push(activeProfile.before);
    patchApplySamples.push(activeProfile.mutator);
    snapshotAfterSamples.push(activeProfile.after);
    activeProfile = null;
  }

  const captureTotal = sumSamples(snapshotBeforeSamples, snapshotAfterSamples);
  const estimatedTotal = sumSamples(snapshotBeforeSamples, patchApplySamples, snapshotAfterSamples);

  const runId = makeRunId();
  const runDir = path.resolve(args.outdir, runId);
  const summaryPath = path.join(runDir, 'summary.json');
  const markdownPath = path.join(runDir, 'summary.md');

  const payload = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    label: args.label,
    config: {
      entities: args.entities,
      pick_samples: args.pickSamples,
      box_samples: args.boxSamples,
      drag_samples: args.dragSamples,
    },
    metrics: {
      pick: stats(pickSamples),
      box_query: stats(boxSamples),
      drag_commit: stats(dragSamples),
      drag_breakdown: {
        snapshot_before: stats(snapshotBeforeSamples),
        patch_apply: stats(patchApplySamples),
        snapshot_after: stats(snapshotAfterSamples),
        capture_total: stats(captureTotal),
        estimated_total: stats(estimatedTotal),
      },
    },
  };

  writeJson(summaryPath, payload);
  writeMarkdown(markdownPath, payload);

  console.log(`run_id=${runId}`);
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${summaryPath}`);
  console.log(`summary_md=${markdownPath}`);
  return 0;
}

main();
