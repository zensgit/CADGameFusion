#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_OUTDIR = path.join(repoRoot, 'build', 'solver_action_panel_smoke');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_SOLVER_JSON = '/build/solver_action_panels_ui_ranked_probe.out.json';

function parseArgs(argv) {
  const args = {
    outdir: DEFAULT_OUTDIR,
    host: DEFAULT_HOST,
    port: 0,
    solverJson: DEFAULT_SOLVER_JSON,
    noServe: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--base-url' || token === '--base') && i + 1 < argv.length) {
      args.baseUrl = argv[i + 1];
      args.noServe = true;
      i += 1;
      continue;
    }
    if (token === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--solver-json' && i + 1 < argv.length) {
      args.solverJson = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--host' && i + 1 < argv.length) {
      args.host = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--port' && i + 1 < argv.length) {
      args.port = Number.parseInt(argv[i + 1], 10) || 0;
      i += 1;
      continue;
    }
    if (token === '--no-serve') {
      args.noServe = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/web_viewer/scripts/solver_action_panel_smoke.js [--solver-json /build/file.json] [--outdir <dir>] [--base-url http://127.0.0.1:8080/]',
    '',
    'Defaults to starting a temporary static server rooted at deps/cadgamefusion.',
  ].join('\n');
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatFocusLabel(kind, value) {
  const focusKind = String(kind || '').trim();
  const focusValue = String(value || '').trim();
  if (!focusKind || !focusValue) return '';
  switch (focusKind) {
    case 'constraint':
      return `Constraint ${focusValue}`;
    case 'basis-constraint':
      return `Basis ${focusValue}`;
    case 'redundant-constraint':
      return `Redundant ${focusValue}`;
    case 'variable':
      return `Variable ${focusValue}`;
    case 'free-variable':
      return `Free variable ${focusValue}`;
    default:
      return `${focusKind} ${focusValue}`;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function lookupMime(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function buildSafePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/');
  const suffix = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.resolve(root, `.${suffix}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return candidate;
}

function resolveInputPath(root, rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) {
    throw new Error('solver json path is empty');
  }
  if (path.isAbsolute(value) && fs.existsSync(value)) {
    return value;
  }
  return path.resolve(root, value.replace(/^\/+/, ''));
}

function startStaticServer(root, host, port) {
  const server = http.createServer((req, res) => {
    const safePath = buildSafePath(root, req.url || '/');
    if (!safePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    fs.stat(safePath, (err, stats) => {
      if (err || !stats || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': lookupMime(safePath),
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(safePath).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve static server address'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://${host}:${address.port}/`,
      });
    });
  });
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const outdirRoot = path.resolve(process.cwd(), args.outdir || DEFAULT_OUTDIR);
  ensureDir(outdirRoot);
  const runDir = path.join(outdirRoot, nowStamp());
  ensureDir(runDir);

  let serverHandle = null;
  let baseUrl = args.baseUrl || '';
  if (!args.noServe) {
    serverHandle = await startStaticServer(repoRoot, args.host, args.port);
    baseUrl = serverHandle.baseUrl;
  }
  if (!baseUrl) {
    throw new Error('base URL not available');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const solverJson = String(args.solverJson || DEFAULT_SOLVER_JSON).trim();
  const solverJsonPath = resolveInputPath(repoRoot, solverJson);
  const uploadSolverJsonPath = path.join(runDir, path.basename(solverJsonPath));
  fs.copyFileSync(solverJsonPath, uploadSolverJsonPath);
  const url = new URL('tools/web_viewer/index.html?mode=editor&debug=1', baseUrl).toString();

  const summary = {
    ok: false,
    url,
    solver_json: solverJson,
    panel_count: 0,
    flow_check_count: 0,
    request_count: 0,
    invoke_request_count: 0,
    focus_request_count: 0,
    flow_request_count: 0,
    replay_request_count: 0,
    dom_event_count: 0,
    dom_request_event_count: 0,
    dom_action_event_count: 0,
    dom_focus_event_count: 0,
    dom_flow_event_count: 0,
    dom_replay_event_count: 0,
    event_count: 0,
    invoke_event_count: 0,
    focus_event_count: 0,
    flow_event_count: 0,
    replay_event_count: 0,
    next_check_count: 0,
    jump_check_count: 0,
    rewind_check_count: 0,
    restart_check_count: 0,
    replay_check_count: 0,
    event_focus_check_count: 0,
    banner_check_count: 0,
    banner_event_focus_check_count: 0,
    banner_focus_click_check_count: 0,
    console_check_count: 0,
    console_flow_check_count: 0,
    console_event_focus_check_count: 0,
    console_replay_check_count: 0,
    console_event_click_check_count: 0,
    console_focus_click_check_count: 0,
    console_selection_check_count: 0,
    status_check_count: 0,
    status_click_check_count: 0,
    keyboard_check_count: 0,
    panel_cycle_check_count: 0,
    panel_keyboard_check_count: 0,
    panel_keyboard_invoke_check_count: 0,
    panel_keyboard_flow_check_count: 0,
    keyboard_banner_check_count: 0,
    keyboard_jump_check_count: 0,
    keyboard_event_focus_check_count: 0,
    jump_request_count: 0,
    jump_event_count: 0,
    import_check_count: 0,
    clear_check_count: 0,
    visited_panel_ids: [],
    flow_action_history: [],
    titles: [],
    initial_state: null,
    after_primary: null,
    after_primary_next: null,
    after_primary_prev: null,
    after_primary_restart: null,
    after_primary_banner_jump: null,
    after_primary_jump: null,
    after_primary_focus: null,
    after_smallest_redundancy: null,
    after_smallest_redundancy_next: null,
    after_smallest_redundancy_prev: null,
    after_smallest_redundancy_restart: null,
    after_smallest_redundancy_jump: null,
    after_smallest_redundancy_focus: null,
    after_recent_replay: null,
    after_console_recent_event_click: null,
    after_recent_event_focus: null,
    after_global_restart: null,
    after_global_next: null,
    after_global_prev: null,
    after_console_next: null,
    after_console_prev: null,
    after_console_restart: null,
    after_console_event_focus: null,
    after_console_focus_click: null,
    after_global_recent_event_focus: null,
    after_status_solver_click: null,
    after_banner_event_focus: null,
    after_banner_focus_click: null,
    recent_event_focus_target: null,
    global_recent_event_focus_target: null,
    screenshot: '',
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForFunction(
      () => {
        return !!window.__cadDebug?.getSolverActionPanels?.() &&
          !!window.__cadDebug?.getSolverActionState?.() &&
          !!document.getElementById('cad-import-solver') &&
          !!document.getElementById('cad-clear-solver');
      },
      { timeout: 25000 }
    );

    const captureState = () => page.evaluate(() => ({
      normalized: window.__cadDebug?.getSolverActionPanels?.(),
      state: window.__cadDebug?.getSolverActionState?.(),
      requestState: window.__cadDebug?.getSolverActionRequestState?.(),
      eventState: window.__cadDebug?.getSolverActionEventState?.(),
      domEventState: window.__cadDebug?.getSolverActionDomEventState?.(),
      flowState: window.__cadDebug?.getSolverActionFlowState?.(),
      bannerState: window.__cadDebug?.getSolverActionFlowBannerState?.(),
      message: document.getElementById('cad-status-message')?.textContent || '',
      solverStatus: document.getElementById('cad-status-solver')?.textContent || '',
      importButtonDisabled: !!document.getElementById('cad-import-solver')?.disabled,
      clearButtonDisabled: !!document.getElementById('cad-clear-solver')?.disabled,
      bannerText: document.getElementById('cad-solver-action-flow-banner')?.textContent || '',
      flowText: document.getElementById('cad-solver-action-flow')?.textContent || '',
      activeElementTag: document.activeElement?.tagName || '',
      activeElementPanelId: document.activeElement?.closest?.('.cad-solver-panel[data-panel-card="true"]')?.dataset?.panelId || '',
      activeElementIsPanelCard: !!document.activeElement?.matches?.('.cad-solver-panel[data-panel-card="true"]'),
    }));

    const before = await page.evaluate(() => ({
      normalized: window.__cadDebug?.getSolverActionPanels?.(),
      state: window.__cadDebug?.getSolverActionState?.(),
      requestState: window.__cadDebug?.getSolverActionRequestState?.(),
      eventState: window.__cadDebug?.getSolverActionEventState?.(),
      domEventState: window.__cadDebug?.getSolverActionDomEventState?.(),
      flowState: window.__cadDebug?.getSolverActionFlowState?.(),
      bannerState: window.__cadDebug?.getSolverActionFlowBannerState?.(),
      message: document.getElementById('cad-status-message')?.textContent || '',
      solverStatus: document.getElementById('cad-status-solver')?.textContent || '',
      importButtonDisabled: !!document.getElementById('cad-import-solver')?.disabled,
      clearButtonDisabled: !!document.getElementById('cad-clear-solver')?.disabled,
      bannerText: document.getElementById('cad-solver-action-flow-banner')?.textContent || '',
      flowText: document.getElementById('cad-solver-action-flow')?.textContent || '',
      activeElementTag: document.activeElement?.tagName || '',
      activeElementPanelId: document.activeElement?.closest?.('.cad-solver-panel[data-panel-card="true"]')?.dataset?.panelId || '',
      activeElementIsPanelCard: !!document.activeElement?.matches?.('.cad-solver-panel[data-panel-card="true"]'),
    }));
    summary.panel_count = before?.normalized?.panels?.length || 0;
    summary.titles = (before?.normalized?.panels || []).map((panel) => panel?.ui?.title || panel?.label || panel?.id || '');
    summary.initial_state = before?.state || null;
    if (!String(before?.solverStatus || '').includes('Solver: idle')) {
      throw new Error('initial solver status did not start idle');
    }
    if (!before?.clearButtonDisabled) {
      throw new Error('clear solver button should be disabled before diagnostics import');
    }
    summary.status_check_count += 1;

    const [solverJsonChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#cad-import-solver'),
    ]);
    await solverJsonChooser.setFiles(uploadSolverJsonPath);
    await page.waitForFunction(() => {
      const panels = window.__cadDebug?.getSolverActionPanels?.();
      return panels && Array.isArray(panels.panels) && panels.panels.length >= 4 &&
        !document.getElementById('cad-clear-solver')?.disabled;
    }, { timeout: 25000 });
    summary.after_import = await captureState();
    summary.import_check_count += 1;
    summary.panel_count = summary.after_import?.normalized?.panels?.length || 0;
    summary.titles = (summary.after_import?.normalized?.panels || before?.normalized?.panels || [])
      .map((panel) => panel?.ui?.title || panel?.label || panel?.id || '')
      .filter(Boolean);
    if (!String(summary.after_import?.message || '').includes('Solver diagnostics imported')) {
      throw new Error('solver diagnostics import did not update status message');
    }
    if (summary.after_import?.clearButtonDisabled) {
      throw new Error('clear solver button did not enable after diagnostics import');
    }

    await page.focus('.cad-solver-panel[data-panel-id="primary_conflict"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const active = document.activeElement;
      return state?.activePanelId === 'primary_conflict' &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.after_primary = await captureState();
    summary.visited_panel_ids.push('primary_conflict');
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_invoke_check_count += 1;
    if (!String(summary.after_primary?.solverStatus || '').includes('Relax primary conflict')
      || !String(summary.after_primary?.solverStatus || '').includes('Constraint 2')
      || !String(summary.after_primary?.solverStatus || '').includes('1/9')) {
      throw new Error('primary conflict did not update solver status');
    }
    if (!summary.after_primary?.activeElementIsPanelCard || summary.after_primary?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict invoke did not keep panel card focused');
    }
    summary.status_check_count += 1;

    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.press('Alt+Shift+ArrowDown');
    const nextGlobalPanelId = String(
      summary.after_primary?.normalized?.panels?.[1]?.id
      || summary.after_primary?.normalized?.panels?.[0]?.id
      || ''
    );
    await page.waitForFunction((panelId) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      return panelId &&
        state?.activePanelId === panelId &&
        state?.lastInvokedPanelId === panelId &&
        requestState?.lastRequest?.requestKind === 'invoke' &&
        requestState?.lastRequest?.panelId === panelId &&
        String(document.getElementById('cad-status-message')?.textContent || '').includes('Solver panel cycled:');
    }, nextGlobalPanelId, { timeout: 10000 });
    summary.after_global_panel_cycle_next = await captureState();
    if (nextGlobalPanelId) {
      summary.visited_panel_ids.push(nextGlobalPanelId);
    }
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_cycle_check_count += 1;
    summary.flow_action_history.push(`panel-cycle:next:${nextGlobalPanelId || 'unknown'}`);

    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      return state?.activePanelId === 'primary_conflict' &&
        state?.lastInvokedPanelId === 'primary_conflict' &&
        requestState?.lastRequest?.requestKind === 'invoke' &&
        requestState?.lastRequest?.panelId === 'primary_conflict' &&
        String(document.getElementById('cad-status-message')?.textContent || '').includes('Solver panel cycled:');
    }, { timeout: 10000 });
    summary.after_global_panel_cycle_prev = await captureState();
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_cycle_check_count += 1;
    summary.flow_action_history.push('panel-cycle:prev:primary_conflict');

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'variable' &&
        focus.value === 'p4.x' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 1 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.after_primary_next = await captureState();
    summary.next_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('primary_conflict:next:key-card');

    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'constraint' &&
        focus.value === '2' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 0 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.after_primary_prev = await captureState();
    summary.rewind_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('primary_conflict:prev:key-card');

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'variable' &&
        focus.value === 'p4.x' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 1 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.next_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('primary_conflict:next-revisit:key-card');

    await page.keyboard.press('Home');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'constraint' &&
        focus.value === '2' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 0 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.after_primary_restart = await captureState();
    summary.restart_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('primary_conflict:restart:key-card');

    await page.click('#cad-solver-action-flow-banner [data-banner-action="jump"][data-panel-id="primary_conflict"][data-flow-step-index="7"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      return focus && flow && banner &&
        banner.activePanelId === 'primary_conflict' &&
        banner.focusKind === 'constraint' &&
        banner.focusValue === '3' &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'constraint' &&
        focus.value === '3' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 7 &&
        requestState?.lastRequest?.requestKind === 'flow' &&
        requestState?.lastRequest?.flowAction === 'jump' &&
        eventState?.lastEvent?.eventKind === 'flow' &&
        eventState?.lastEvent?.flowAction === 'jump';
    }, { timeout: 10000 });
    summary.after_primary_banner_jump = await captureState();
    summary.banner_check_count += 1;
    summary.jump_check_count += 1;
    summary.flow_check_count += 1;
    summary.flow_action_history.push('primary_conflict:jump-7:click-banner');
    if (!String(summary.after_primary_banner_jump?.solverStatus || '').includes('Relax primary conflict')
      || !String(summary.after_primary_banner_jump?.solverStatus || '').includes('Constraint 3')
      || !String(summary.after_primary_banner_jump?.solverStatus || '').includes('8/9')) {
      throw new Error('primary conflict banner jump did not update solver status');
    }
    summary.status_check_count += 1;

    await page.focus('.cad-solver-panel[data-panel-id="primary_conflict"]');
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'constraint' &&
        focus.value === '4' &&
        flow.panelId === 'primary_conflict' &&
        flow.stepIndex === 8 &&
        requestState?.lastRequest?.requestKind === 'flow' &&
        requestState?.lastRequest?.flowAction === 'jump' &&
        eventState?.lastEvent?.eventKind === 'flow' &&
        eventState?.lastEvent?.flowAction === 'jump' &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="primary_conflict"]');
    }, { timeout: 10000 });
    summary.after_primary_jump = await captureState();
    summary.jump_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.keyboard_jump_check_count += 1;
    summary.flow_action_history.push('primary_conflict:jump-8:key-card');

    await page.click('.cad-solver-panel__chip.is-actionable[data-panel-id="primary_conflict"][data-focus-kind="variable"][data-focus-value="p5.x"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const focus = state?.activeFocus;
      const lastRequest = requestState?.lastRequest;
      return focus &&
        focus.panelId === 'primary_conflict' &&
        focus.kind === 'variable' &&
        focus.value === 'p5.x' &&
        lastRequest &&
        lastRequest.requestKind === 'focus' &&
        lastRequest.panelId === 'primary_conflict' &&
        lastRequest.focusKind === 'variable' &&
        lastRequest.focusValue === 'p5.x';
    }, { timeout: 10000 });
    summary.after_primary_focus = await captureState();

    await page.click('[data-panel-id="smallest_redundancy"] .cad-solver-panel__cta');
    await page.waitForFunction(() => window.__cadDebug?.getSolverActionState?.()?.activePanelId === 'smallest_redundancy', { timeout: 10000 });
    summary.after_smallest_redundancy = await captureState();
    summary.visited_panel_ids.push('smallest_redundancy');
    summary.flow_check_count += 1;
    if (!String(summary.after_smallest_redundancy?.solverStatus || '').includes('Trim smallest redundancy witness')
      || !String(summary.after_smallest_redundancy?.solverStatus || '').includes('Constraint 0')
      || !String(summary.after_smallest_redundancy?.solverStatus || '').includes('1/5')) {
      throw new Error('smallest redundancy did not update solver status');
    }
    summary.status_check_count += 1;

    await page.focus('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'variable' &&
        banner?.focusValue === 'p0.x' &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'variable' &&
        focus.value === 'p0.x' &&
        flow.panelId === 'smallest_redundancy' &&
        flow.stepIndex === 1 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_next = await captureState();
    summary.next_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:next:key-card');

    await page.focus('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'constraint' &&
        banner?.focusValue === '0' &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'constraint' &&
        focus.value === '0' &&
        flow.panelId === 'smallest_redundancy' &&
        flow.stepIndex === 0 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_prev = await captureState();
    summary.rewind_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:prev:key-card');

    await page.focus('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'variable' &&
        banner?.focusValue === 'p0.x' &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'variable' &&
        focus.value === 'p0.x' &&
        flow.panelId === 'smallest_redundancy' &&
        flow.stepIndex === 1 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_revisit_next = await captureState();
    summary.next_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:next-revisit:key-card');

    await page.focus('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    await page.keyboard.press('Home');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'constraint' &&
        banner?.focusValue === '0' &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'constraint' &&
        focus.value === '0' &&
        flow.panelId === 'smallest_redundancy' &&
        flow.stepIndex === 0 &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_restart = await captureState();
    summary.restart_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:restart:key-card');

    await page.focus('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const focus = state?.activeFocus;
      const flow = state?.activeFlow;
      const active = document.activeElement;
      return focus && flow &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'redundant-constraint' &&
        focus.value === '1' &&
        flow.panelId === 'smallest_redundancy' &&
        flow.stepIndex === 4 &&
        requestState?.lastRequest?.requestKind === 'flow' &&
        requestState?.lastRequest?.flowAction === 'jump' &&
        eventState?.lastEvent?.eventKind === 'flow' &&
        eventState?.lastEvent?.flowAction === 'jump' &&
        !!active?.matches?.('.cad-solver-panel[data-panel-card="true"][data-panel-id="smallest_redundancy"]');
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_jump = await captureState();
    summary.jump_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.panel_keyboard_check_count += 1;
    summary.panel_keyboard_flow_check_count += 1;
    summary.keyboard_jump_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:jump-4:key-card');

    await page.click('.cad-solver-panel__chip.is-actionable[data-panel-id="smallest_redundancy"][data-focus-kind="redundant-constraint"][data-focus-value="1"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const focus = state?.activeFocus;
      const lastRequest = requestState?.lastRequest;
      return focus &&
        focus.panelId === 'smallest_redundancy' &&
        focus.kind === 'redundant-constraint' &&
        focus.value === '1' &&
        lastRequest &&
        lastRequest.requestKind === 'focus' &&
        lastRequest.panelId === 'smallest_redundancy' &&
        lastRequest.focusKind === 'redundant-constraint' &&
        lastRequest.focusValue === '1';
    }, { timeout: 10000 });
    summary.after_smallest_redundancy_focus = await captureState();

    const replayTarget = (summary.after_smallest_redundancy_focus?.flowState?.recentRequests || []).find((request) => (
      request?.requestKind === 'flow' &&
      request?.label?.includes('smallest redundancy') &&
      request?.label?.includes('Variable p0.x') &&
      Number.isFinite(request?.historyIndex)
    ));
    if (!replayTarget) {
      throw new Error('missing replay target in solver action flow console');
    }
    await page.click(`[data-request-history-index="${replayTarget.historyIndex}"]`);
    await page.waitForFunction((historyIndex) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === 'variable' &&
        state?.activeFocus?.value === 'p0.x' &&
        requestState?.lastRequest?.requestKind === 'replay' &&
        Number(requestState?.lastRequest?.historyIndex) > Number(historyIndex) &&
        flowState?.lastRequestKind === 'replay' &&
        flowState?.lastRequestTargetLabel === 'Variable p0.x';
    }, replayTarget.historyIndex, { timeout: 10000 });
    summary.after_recent_replay = await captureState();
    const selectedReplayHistoryIndex = Number(
      summary.after_recent_replay?.flowState?.selectedRequestHistoryIndex
      ?? summary.after_recent_replay?.requestState?.lastRequest?.historyIndex
      ?? -1
    );
    if (summary.after_recent_replay?.flowState?.selectedRecentKind !== 'request'
      || selectedReplayHistoryIndex < 0
      || Number(summary.after_recent_replay?.requestState?.lastRequest?.historyIndex ?? -1) !== selectedReplayHistoryIndex) {
      throw new Error('recent replay did not mark selected request in console state');
    }
    const selectedReplay = await page.locator(`[data-request-history-index="${selectedReplayHistoryIndex}"].is-selected`).count();
    if (selectedReplay < 1) {
      throw new Error('recent replay did not mark selected request in console DOM');
    }
    summary.replay_check_count += 1;
    summary.console_replay_check_count += 1;
    summary.console_selection_check_count += 1;
    summary.flow_action_history.push(`replay:${replayTarget.historyIndex}`);

    const eventFocusTarget = summary.after_recent_replay?.bannerState?.recentEvent ||
      (summary.after_recent_replay?.flowState?.recentEvents || []).find((event) => (
        event?.panelId === 'smallest_redundancy' &&
        event?.focusKind &&
        event?.focusValue &&
        Number.isFinite(event?.historyIndex)
      ));
    if (!eventFocusTarget) {
      throw new Error('missing actionable recent event in solver action flow console');
    }
    summary.recent_event_focus_target = eventFocusTarget;
    await page.click(`[data-event-history-index="${eventFocusTarget.historyIndex}"]`);
    await page.waitForFunction((target) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === target.focusKind &&
        state?.activeFocus?.value === target.focusValue &&
        requestState?.lastRequest?.requestKind === 'focus' &&
        requestState?.lastRequest?.panelId === 'smallest_redundancy' &&
        requestState?.lastRequest?.focusKind === target.focusKind &&
        requestState?.lastRequest?.focusValue === target.focusValue &&
        flowState?.lastRequestKind === 'focus' &&
        flowState?.lastRequestTargetLabel &&
        eventState?.lastEvent?.eventKind === 'focus' &&
        eventState?.lastEvent?.focusKind === target.focusKind &&
        eventState?.lastEvent?.focusValue === target.focusValue;
    }, eventFocusTarget, { timeout: 10000 });
    summary.after_console_recent_event_click = await captureState();
    const selectedEventHistoryIndex = Number(
      summary.after_console_recent_event_click?.flowState?.selectedEventHistoryIndex
      ?? summary.after_console_recent_event_click?.eventState?.lastEvent?.historyIndex
      ?? -1
    );
    if (summary.after_console_recent_event_click?.flowState?.selectedRecentKind !== 'event'
      || selectedEventHistoryIndex < 0
      || Number(summary.after_console_recent_event_click?.eventState?.lastEvent?.historyIndex ?? -1) !== selectedEventHistoryIndex) {
      throw new Error('recent event click did not mark selected event in console state');
    }
    const selectedEvent = await page.locator(`[data-event-history-index="${selectedEventHistoryIndex}"].is-selected`).count();
    if (selectedEvent < 1) {
      throw new Error('recent event click did not mark selected event in console DOM');
    }
    summary.console_event_click_check_count += 1;
    summary.console_selection_check_count += 1;
    summary.event_focus_check_count += 1;
    summary.flow_check_count += 1;
    summary.flow_action_history.push(`event-focus:${eventFocusTarget.historyIndex}:console-list`);

    await page.focus('#cad-solver-action-flow-banner');
    await page.keyboard.press('End');
    await page.waitForFunction((target) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === target.focusKind &&
        banner?.focusValue === target.focusValue &&
        state?.activeFocus?.kind === target.focusKind &&
        state?.activeFocus?.value === target.focusValue &&
        requestState?.lastRequest?.requestKind === 'focus' &&
        requestState?.lastRequest?.panelId === 'smallest_redundancy' &&
        requestState?.lastRequest?.focusKind === target.focusKind &&
        requestState?.lastRequest?.focusValue === target.focusValue &&
        flowState?.lastRequestKind === 'focus' &&
        flowState?.lastRequestTargetLabel &&
        eventState?.lastEvent?.eventKind === 'focus' &&
        eventState?.lastEvent?.focusKind === target.focusKind &&
        eventState?.lastEvent?.focusValue === target.focusValue;
    }, eventFocusTarget, { timeout: 10000 });
    summary.after_recent_event_focus = await captureState();
    summary.banner_check_count += 1;
    summary.event_focus_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.keyboard_banner_check_count += 1;
    summary.keyboard_event_focus_check_count += 1;
    summary.flow_action_history.push(`event-focus:${eventFocusTarget.historyIndex}:key-banner`);

    await page.focus('[data-panel-id="smallest_redundancy"] .cad-solver-panel__cta');
    await page.keyboard.press('Alt+Shift+Home');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === 'constraint' &&
        state?.activeFocus?.value === '0' &&
        state?.activeFlow?.stepIndex === 0 &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'constraint' &&
        banner?.focusValue === '0';
    }, { timeout: 10000 });
    summary.after_global_restart = await captureState();
    summary.banner_check_count += 1;
    summary.restart_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:restart:key-global');

    await page.focus('[data-panel-id="smallest_redundancy"] .cad-solver-panel__cta');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === 'variable' &&
        state?.activeFocus?.value === 'p0.x' &&
        state?.activeFlow?.stepIndex === 1 &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'variable' &&
        banner?.focusValue === 'p0.x';
    }, { timeout: 10000 });
    summary.after_global_next = await captureState();
    summary.banner_check_count += 1;
    summary.next_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:next:key-global');

    await page.focus('[data-panel-id="smallest_redundancy"] .cad-solver-panel__cta');
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === 'constraint' &&
        state?.activeFocus?.value === '0' &&
        state?.activeFlow?.stepIndex === 0 &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === 'constraint' &&
        banner?.focusValue === '0';
    }, { timeout: 10000 });
    summary.after_global_prev = await captureState();
    summary.banner_check_count += 1;
    summary.rewind_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:prev:key-global');

    const globalEventFocusTarget = summary.after_global_prev?.bannerState?.recentEvent ||
      (summary.after_global_prev?.flowState?.recentEvents || []).find((event) => (
        event?.panelId === 'smallest_redundancy' &&
        event?.focusKind &&
        event?.focusValue &&
        Number.isFinite(event?.historyIndex)
      ));
    if (!globalEventFocusTarget) {
      throw new Error('missing actionable recent event after global solver flow shortcuts');
    }
    summary.global_recent_event_focus_target = globalEventFocusTarget;

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'End',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    await page.waitForFunction((target) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      return state?.activePanelId === 'smallest_redundancy' &&
        state?.activeFocus?.kind === target.focusKind &&
        state?.activeFocus?.value === target.focusValue &&
        banner?.activePanelId === 'smallest_redundancy' &&
        banner?.focusKind === target.focusKind &&
        banner?.focusValue === target.focusValue &&
        requestState?.lastRequest?.requestKind === 'focus' &&
        requestState?.lastRequest?.focusKind === target.focusKind &&
        requestState?.lastRequest?.focusValue === target.focusValue &&
        flowState?.lastRequestKind === 'focus' &&
        eventState?.lastEvent?.eventKind === 'focus' &&
        eventState?.lastEvent?.focusKind === target.focusKind &&
        eventState?.lastEvent?.focusValue === target.focusValue;
    }, globalEventFocusTarget, { timeout: 10000 });
    summary.after_global_recent_event_focus = await captureState();
    summary.banner_check_count += 1;
    summary.event_focus_check_count += 1;
    summary.flow_check_count += 1;
    summary.keyboard_check_count += 1;
    summary.keyboard_event_focus_check_count += 1;
    summary.flow_action_history.push(`event-focus:${globalEventFocusTarget.historyIndex}:key-global`);

    if (summary.panel_count < 4) {
      throw new Error(`expected >=4 action panels, got ${summary.panel_count}`);
    }
    if (!summary.titles.includes('Relax primary conflict')) {
      throw new Error('missing primary conflict action panel title');
    }
    if (!summary.after_primary?.state || summary.after_primary.state.activePanelId !== 'primary_conflict') {
      throw new Error('primary conflict action did not become active');
    }
    if (!summary.after_primary?.state?.activeFlow || summary.after_primary.state.activeFlow.stepIndex !== 0) {
      throw new Error('primary conflict action did not start flow');
    }
    if (!summary.after_primary?.state?.activeFocus || summary.after_primary.state.activeFocus.kind !== 'constraint' || summary.after_primary.state.activeFocus.value !== '2') {
      throw new Error('primary conflict action did not focus anchor constraint');
    }
    if (!String(summary.after_primary?.message || '').includes('constraint 2')) {
      throw new Error('primary conflict action did not update status message with flow step');
    }
    if (summary.after_primary?.flowState?.lastRequestKind !== 'invoke' || summary.after_primary.flowState?.lastRequestTargetLabel !== 'Constraint 2') {
      throw new Error('primary conflict action did not render invoke request in action flow console');
    }
    if (summary.after_primary?.eventState?.lastEvent?.eventKind !== 'invoke') {
      throw new Error('primary conflict action did not record invoke event');
    }
    if (!String(summary.after_primary?.flowText || '').includes('Relax primary conflict')) {
      throw new Error('primary conflict action flow console did not render panel title');
    }
    if (!summary.after_primary?.activeElementIsPanelCard || summary.after_primary?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict invoke did not preserve card focus');
    }
    if (!summary.after_primary_next?.state?.activeFocus || summary.after_primary_next.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict next step did not become active');
    }
    if (summary.after_primary_next.state.activeFocus.kind !== 'variable' || summary.after_primary_next.state.activeFocus.value !== 'p4.x') {
      throw new Error('primary conflict next step state mismatch');
    }
    if (!String(summary.after_primary_next?.message || '').includes('variable p4.x')) {
      throw new Error('primary conflict next step did not update status message');
    }
    if (summary.after_primary_next?.flowState?.lastRequestKind !== 'flow' || summary.after_primary_next.flowState?.lastRequestTargetLabel !== 'Variable p4.x') {
      throw new Error('primary conflict next step did not render flow request in action flow console');
    }
    if (summary.after_primary_next?.eventState?.lastEvent?.eventKind !== 'flow' || summary.after_primary_next?.eventState?.lastEvent?.flowAction !== 'next') {
      throw new Error('primary conflict next step did not record flow event');
    }
    if (!summary.after_primary_next?.activeElementIsPanelCard || summary.after_primary_next?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict next step did not preserve card focus');
    }
    if (!summary.after_primary_prev?.state?.activeFocus || summary.after_primary_prev.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict prev step did not become active');
    }
    if (summary.after_primary_prev.state.activeFocus.kind !== 'constraint' || summary.after_primary_prev.state.activeFocus.value !== '2') {
      throw new Error('primary conflict prev step state mismatch');
    }
    if (!String(summary.after_primary_prev?.message || '').includes('constraint 2')) {
      throw new Error('primary conflict prev step did not update status message');
    }
    if (!summary.after_primary_prev?.activeElementIsPanelCard || summary.after_primary_prev?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict prev step did not preserve card focus');
    }
    if (!summary.after_primary_restart?.state?.activeFocus || summary.after_primary_restart.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict restart step did not become active');
    }
    if (summary.after_primary_restart.state.activeFocus.kind !== 'constraint' || summary.after_primary_restart.state.activeFocus.value !== '2') {
      throw new Error('primary conflict restart state mismatch');
    }
    if (!String(summary.after_primary_restart?.message || '').includes('constraint 2')) {
      throw new Error('primary conflict restart did not update status message');
    }
    if (!summary.after_primary_restart?.activeElementIsPanelCard || summary.after_primary_restart?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict restart did not preserve card focus');
    }
    if (!summary.after_primary_banner_jump?.state?.activeFocus || summary.after_primary_banner_jump.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict banner jump did not become active');
    }
    if (summary.after_primary_banner_jump.state.activeFocus.kind !== 'constraint' || summary.after_primary_banner_jump.state.activeFocus.value !== '3') {
      throw new Error('primary conflict banner jump state mismatch');
    }
    if (!String(summary.after_primary_banner_jump?.message || '').includes('constraint 3')) {
      throw new Error('primary conflict banner jump did not update status message');
    }
    if (summary.after_primary_banner_jump?.flowState?.lastRequestKind !== 'flow' || summary.after_primary_banner_jump.flowState?.lastEventFlowAction !== 'jump') {
      throw new Error('primary conflict banner jump did not update action flow console');
    }
    if (summary.after_primary_banner_jump?.bannerState?.focusKind !== 'constraint' || summary.after_primary_banner_jump?.bannerState?.focusValue !== '3') {
      throw new Error('primary conflict banner jump did not update flow banner focus');
    }
    if (!summary.after_primary_jump?.state?.activeFocus || summary.after_primary_jump.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict jump step did not become active');
    }
    if (summary.after_primary_jump.state.activeFocus.kind !== 'constraint' || summary.after_primary_jump.state.activeFocus.value !== '4') {
      throw new Error('primary conflict jump step state mismatch');
    }
    if (!String(summary.after_primary_jump?.message || '').includes('constraint 4')) {
      throw new Error('primary conflict jump step did not update status message');
    }
    if (summary.after_primary_jump?.flowState?.lastRequestKind !== 'flow' || summary.after_primary_jump.flowState?.lastEventFlowAction !== 'jump') {
      throw new Error('primary conflict jump step did not update action flow console');
    }
    if (!summary.after_primary_jump?.activeElementIsPanelCard || summary.after_primary_jump?.activeElementPanelId !== 'primary_conflict') {
      throw new Error('primary conflict jump step did not preserve card focus');
    }
    if (!summary.after_primary_focus?.state?.activeFocus || summary.after_primary_focus.state.activeFocus.panelId !== 'primary_conflict') {
      throw new Error('primary conflict focus chip did not become active');
    }
    if (summary.after_primary_focus.state.activeFocus.kind !== 'variable' || summary.after_primary_focus.state.activeFocus.value !== 'p5.x') {
      throw new Error('primary conflict focus chip state mismatch');
    }
    if (summary.after_primary_focus?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('primary conflict focus chip did not record focus request');
    }
    if (summary.after_primary_focus.requestState.lastRequest.focusKind !== 'variable' || summary.after_primary_focus.requestState.lastRequest.focusValue !== 'p5.x') {
      throw new Error('primary conflict focus request payload mismatch');
    }
    if (summary.after_primary_focus?.flowState?.lastRequestKind !== 'focus' || summary.after_primary_focus.flowState?.lastRequestTargetLabel !== 'Variable p5.x') {
      throw new Error('primary conflict focus chip did not update action flow console');
    }
    if (summary.after_primary_focus?.eventState?.lastEvent?.eventKind !== 'focus' || summary.after_primary_focus?.eventState?.lastEvent?.focusValue !== 'p5.x') {
      throw new Error('primary conflict focus chip did not record focus event');
    }
    if (!summary.after_smallest_redundancy?.state || summary.after_smallest_redundancy.state.activePanelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy action did not become active');
    }
    if (!summary.after_smallest_redundancy?.state?.activeFlow || summary.after_smallest_redundancy.state.activeFlow.stepIndex !== 0) {
      throw new Error('smallest redundancy action did not start flow');
    }
    if (!summary.after_smallest_redundancy?.state?.activeFocus || summary.after_smallest_redundancy.state.activeFocus.kind !== 'constraint' || summary.after_smallest_redundancy.state.activeFocus.value !== '0') {
      throw new Error('smallest redundancy action did not focus anchor constraint');
    }
    if (!String(summary.after_smallest_redundancy?.message || '').includes('constraint 0')) {
      throw new Error('smallest redundancy action did not update status message with flow step');
    }
    if (summary.after_smallest_redundancy?.bannerState?.activePanelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy action did not update flow banner active panel');
    }
    if (summary.after_smallest_redundancy?.flowState?.activePanelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy action did not update action flow console active panel');
    }
    if (!summary.after_smallest_redundancy_next?.state?.activeFocus || summary.after_smallest_redundancy_next.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy next step did not become active');
    }
    if (summary.after_smallest_redundancy_next.state.activeFocus.kind !== 'variable' || summary.after_smallest_redundancy_next.state.activeFocus.value !== 'p0.x') {
      throw new Error('smallest redundancy next step state mismatch');
    }
    if (summary.after_smallest_redundancy_next?.bannerState?.focusLabel !== 'Variable p0.x') {
      throw new Error('smallest redundancy next step did not update flow banner focus');
    }
    if (!String(summary.after_smallest_redundancy_next?.message || '').includes('variable p0.x')) {
      throw new Error('smallest redundancy next step did not update status message');
    }
    if (!summary.after_smallest_redundancy_prev?.state?.activeFocus || summary.after_smallest_redundancy_prev.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy prev step did not become active');
    }
    if (summary.after_smallest_redundancy_prev.state.activeFocus.kind !== 'constraint' || summary.after_smallest_redundancy_prev.state.activeFocus.value !== '0') {
      throw new Error('smallest redundancy prev step state mismatch');
    }
    if (summary.after_smallest_redundancy_prev?.bannerState?.focusLabel !== 'Constraint 0') {
      throw new Error('smallest redundancy prev step did not update flow banner focus');
    }
    if (!String(summary.after_smallest_redundancy_prev?.message || '').includes('constraint 0')) {
      throw new Error('smallest redundancy prev step did not update status message');
    }
    if (!summary.after_smallest_redundancy_restart?.state?.activeFocus || summary.after_smallest_redundancy_restart.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy restart step did not become active');
    }
    if (summary.after_smallest_redundancy_restart.state.activeFocus.kind !== 'constraint' || summary.after_smallest_redundancy_restart.state.activeFocus.value !== '0') {
      throw new Error('smallest redundancy restart state mismatch');
    }
    if (summary.after_smallest_redundancy_restart?.bannerState?.focusLabel !== 'Constraint 0') {
      throw new Error('smallest redundancy restart did not update flow banner focus');
    }
    if (!String(summary.after_smallest_redundancy_restart?.message || '').includes('constraint 0')) {
      throw new Error('smallest redundancy restart did not update status message');
    }
    if (!summary.after_smallest_redundancy_jump?.state?.activeFocus || summary.after_smallest_redundancy_jump.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy jump step did not become active');
    }
    if (summary.after_smallest_redundancy_jump.state.activeFocus.kind !== 'redundant-constraint' || summary.after_smallest_redundancy_jump.state.activeFocus.value !== '1') {
      throw new Error('smallest redundancy jump step state mismatch');
    }
    if (!String(summary.after_smallest_redundancy_jump?.message || '').includes('redundant-constraint 1')) {
      throw new Error('smallest redundancy jump step did not update status message');
    }
    if (summary.after_smallest_redundancy_jump?.flowState?.lastRequestKind !== 'flow' || summary.after_smallest_redundancy_jump.flowState?.lastEventFlowAction !== 'jump') {
      throw new Error('smallest redundancy jump step did not update action flow console');
    }
    if (!summary.after_smallest_redundancy_focus?.state?.activeFocus || summary.after_smallest_redundancy_focus.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('smallest redundancy focus chip did not become active');
    }
    if (summary.after_smallest_redundancy_focus.state.activeFocus.kind !== 'redundant-constraint' || summary.after_smallest_redundancy_focus.state.activeFocus.value !== '1') {
      throw new Error('smallest redundancy focus chip state mismatch');
    }
    if (summary.after_smallest_redundancy_focus?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('smallest redundancy focus chip did not record focus request');
    }
    if (summary.after_smallest_redundancy_focus.requestState.lastRequest.focusKind !== 'redundant-constraint' || summary.after_smallest_redundancy_focus.requestState.lastRequest.focusValue !== '1') {
      throw new Error('smallest redundancy focus request payload mismatch');
    }
    if (summary.after_smallest_redundancy_focus?.flowState?.lastRequestKind !== 'focus' || summary.after_smallest_redundancy_focus.flowState?.lastRequestTargetLabel !== 'Redundant 1') {
      throw new Error('smallest redundancy focus chip did not update action flow console');
    }
    if (summary.after_smallest_redundancy_focus?.eventState?.lastEvent?.eventKind !== 'focus' || summary.after_smallest_redundancy_focus?.eventState?.lastEvent?.focusValue !== '1') {
      throw new Error('smallest redundancy focus chip did not record focus event');
    }
    if (!summary.after_recent_replay?.state?.activeFocus || summary.after_recent_replay.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('recent replay did not restore smallest redundancy panel focus');
    }
    if (summary.after_recent_replay.state.activeFocus.kind !== 'variable' || summary.after_recent_replay.state.activeFocus.value !== 'p0.x') {
      throw new Error('recent replay focus state mismatch');
    }
    if (summary.after_recent_replay?.requestState?.lastRequest?.requestKind !== 'replay') {
      throw new Error('recent replay did not record replay request');
    }
    if (summary.after_recent_replay?.flowState?.lastRequestKind !== 'replay' || summary.after_recent_replay.flowState?.lastRequestTargetLabel !== 'Variable p0.x') {
      throw new Error('recent replay did not update action flow console');
    }
    if (summary.after_recent_replay?.eventState?.lastEvent?.eventKind !== 'replay') {
      throw new Error('recent replay did not record replay event');
    }
    if (!String(summary.after_recent_replay?.flowText || '').includes('replay | Trim smallest redundancy witness | Variable p0.x')) {
      throw new Error('recent replay did not render replay label in action flow console');
    }
    if (!summary.after_recent_event_focus?.state?.activeFocus || summary.after_recent_event_focus.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('recent event focus did not restore smallest redundancy panel focus');
    }
    const recentEventTarget = summary.recent_event_focus_target || {};
    const recentEventFocusKind = String(recentEventTarget.focusKind || '').trim();
    const recentEventFocusValue = String(recentEventTarget.focusValue || '').trim();
    const recentEventFocusLabel = formatFocusLabel(recentEventFocusKind, recentEventFocusValue);
    if (summary.after_recent_event_focus.state.activeFocus.kind !== recentEventFocusKind || summary.after_recent_event_focus.state.activeFocus.value !== recentEventFocusValue) {
      throw new Error('recent event focus state mismatch');
    }
    if (summary.after_recent_event_focus?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('recent event focus did not record focus request');
    }
    if (summary.after_recent_event_focus?.flowState?.lastRequestKind !== 'focus' || summary.after_recent_event_focus.flowState?.lastRequestTargetLabel !== recentEventFocusLabel) {
      throw new Error('recent event focus did not update action flow console');
    }
    if (summary.after_recent_event_focus?.bannerState?.focusLabel !== recentEventFocusLabel) {
      throw new Error('recent event focus did not update flow banner focus');
    }
    if (summary.after_recent_event_focus?.eventState?.lastEvent?.eventKind !== 'focus' ||
      summary.after_recent_event_focus?.eventState?.lastEvent?.focusKind !== recentEventFocusKind ||
      summary.after_recent_event_focus?.eventState?.lastEvent?.focusValue !== recentEventFocusValue) {
      throw new Error('recent event focus did not record focus event');
    }
    if (Number(summary.after_recent_event_focus?.requestState?.requestCount || 0) <= Number(summary.after_recent_replay?.requestState?.requestCount || 0)) {
      throw new Error('recent event focus did not increase request count');
    }
    if (Number(summary.after_recent_event_focus?.eventState?.eventCount || 0) <= Number(summary.after_recent_replay?.eventState?.eventCount || 0)) {
      throw new Error('recent event focus did not increase event count');
    }
    if (!summary.after_global_restart?.state?.activeFocus || summary.after_global_restart.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('global restart did not keep smallest redundancy active');
    }
    if (summary.after_global_restart.state.activeFocus.kind !== 'constraint' || summary.after_global_restart.state.activeFocus.value !== '0') {
      throw new Error('global restart focus mismatch');
    }
    if (!summary.after_global_next?.state?.activeFocus || summary.after_global_next.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('global next did not keep smallest redundancy active');
    }
    if (summary.after_global_next.state.activeFocus.kind !== 'variable' || summary.after_global_next.state.activeFocus.value !== 'p0.x') {
      throw new Error('global next focus mismatch');
    }
    if (!summary.after_global_prev?.state?.activeFocus || summary.after_global_prev.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('global prev did not keep smallest redundancy active');
    }
    if (summary.after_global_prev.state.activeFocus.kind !== 'constraint' || summary.after_global_prev.state.activeFocus.value !== '0') {
      throw new Error('global prev focus mismatch');
    }
    if (!summary.after_global_recent_event_focus?.state?.activeFocus || summary.after_global_recent_event_focus.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('global recent-event focus did not restore smallest redundancy panel focus');
    }
    const globalRecentEventTarget = summary.global_recent_event_focus_target || {};
    const globalRecentEventFocusKind = String(globalRecentEventTarget.focusKind || '').trim();
    const globalRecentEventFocusValue = String(globalRecentEventTarget.focusValue || '').trim();
    const globalRecentEventFocusLabel = formatFocusLabel(globalRecentEventFocusKind, globalRecentEventFocusValue);
    if (summary.after_global_recent_event_focus.state.activeFocus.kind !== globalRecentEventFocusKind || summary.after_global_recent_event_focus.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('global recent-event focus mismatch');
    }
    if (!String(summary.after_global_recent_event_focus?.solverStatus || '').includes('Trim smallest redundancy witness')
      || !String(summary.after_global_recent_event_focus?.solverStatus || '').includes(globalRecentEventFocusLabel)) {
      throw new Error('global recent-event focus did not update solver status');
    }
    summary.status_check_count += 1;
    if (!String(summary.after_global_recent_event_focus?.flowText || '').includes(`focus | Trim smallest redundancy witness | ${globalRecentEventFocusLabel}`)) {
      throw new Error('global recent-event focus did not update action flow console');
    }
    if (summary.after_global_recent_event_focus?.bannerState?.focusLabel !== globalRecentEventFocusLabel) {
      throw new Error('global recent-event focus did not update flow banner focus');
    }

    await page.click('[data-console-action="next"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === 'variable'
        && state?.activeFocus?.value === 'p0.x'
        && state?.activeFlow?.stepIndex === 1
        && requestState?.lastRequest?.requestKind === 'flow'
        && requestState?.lastRequest?.flowAction === 'next'
        && flowState?.lastRequestKind === 'flow'
        && flowState?.lastRequestTargetLabel === 'Variable p0.x'
        && eventState?.lastEvent?.eventKind === 'flow'
        && eventState?.lastEvent?.flowAction === 'next';
    }, { timeout: 10000 });
    summary.after_console_next = await captureState();
    summary.console_check_count += 1;
    summary.console_flow_check_count += 1;
    summary.flow_check_count += 1;
    summary.next_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:next:console');

    await page.click('[data-console-action="prev"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      return state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === 'constraint'
        && state?.activeFocus?.value === '0'
        && state?.activeFlow?.stepIndex === 0
        && requestState?.lastRequest?.requestKind === 'flow'
        && requestState?.lastRequest?.flowAction === 'prev'
        && eventState?.lastEvent?.eventKind === 'flow'
        && eventState?.lastEvent?.flowAction === 'prev';
    }, { timeout: 10000 });
    summary.after_console_prev = await captureState();
    summary.console_check_count += 1;
    summary.console_flow_check_count += 1;
    summary.flow_check_count += 1;
    summary.rewind_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:prev:console');

    await page.click('[data-console-action="next"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      return state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === 'variable'
        && state?.activeFocus?.value === 'p0.x'
        && state?.activeFlow?.stepIndex === 1
        && requestState?.lastRequest?.requestKind === 'flow'
        && requestState?.lastRequest?.flowAction === 'next';
    }, { timeout: 10000 });

    await page.click('[data-console-action="restart"]');
    await page.waitForFunction(() => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      return state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === 'constraint'
        && state?.activeFocus?.value === '0'
        && state?.activeFlow?.stepIndex === 0
        && requestState?.lastRequest?.requestKind === 'flow'
        && requestState?.lastRequest?.flowAction === 'restart'
        && eventState?.lastEvent?.eventKind === 'flow'
        && eventState?.lastEvent?.flowAction === 'restart';
    }, { timeout: 10000 });
    summary.after_console_restart = await captureState();
    summary.console_check_count += 1;
    summary.console_flow_check_count += 1;
    summary.flow_check_count += 1;
    summary.restart_check_count += 1;
    summary.flow_action_history.push('smallest_redundancy:restart:console');

    await page.click('[data-console-action="event-focus"]');
    await page.waitForFunction(([expectedKind, expectedValue]) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === expectedKind
        && String(state?.activeFocus?.value || '') === String(expectedValue || '')
        && requestState?.lastRequest?.requestKind === 'focus'
        && requestState?.lastRequest?.focusKind === expectedKind
        && String(requestState?.lastRequest?.focusValue || '') === String(expectedValue || '')
        && flowState?.lastRequestKind === 'focus'
        && eventState?.lastEvent?.eventKind === 'focus'
        && eventState?.lastEvent?.focusKind === expectedKind
        && String(eventState?.lastEvent?.focusValue || '') === String(expectedValue || '');
    }, [globalRecentEventFocusKind, globalRecentEventFocusValue], { timeout: 10000 });
    summary.after_console_event_focus = await captureState();
    summary.console_check_count += 1;
    summary.console_event_focus_check_count += 1;
    summary.event_focus_check_count += 1;
    summary.flow_check_count += 1;
    summary.flow_action_history.push(`event-focus:${globalRecentEventTarget.historyIndex}:console`);

    await page.click('[data-console-action="focus-current"]');
    await page.waitForFunction(([beforeRequestCount, beforeEventCount, expectedKind, expectedValue]) => {
      const state = window.__cadDebug?.getSolverActionState?.();
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return Number(requestState?.requestCount || 0) > Number(beforeRequestCount || 0)
        && Number(eventState?.eventCount || 0) > Number(beforeEventCount || 0)
        && state?.activePanelId === 'smallest_redundancy'
        && state?.activeFocus?.kind === expectedKind
        && String(state?.activeFocus?.value || '') === String(expectedValue || '')
        && requestState?.lastRequest?.requestKind === 'focus'
        && requestState?.lastRequest?.focusKind === expectedKind
        && String(requestState?.lastRequest?.focusValue || '') === String(expectedValue || '')
        && flowState?.lastRequestKind === 'focus'
        && eventState?.lastEvent?.eventKind === 'focus'
        && eventState?.lastEvent?.focusKind === expectedKind
        && String(eventState?.lastEvent?.focusValue || '') === String(expectedValue || '');
    }, [
      Number(summary.after_console_event_focus?.requestState?.requestCount || 0),
      Number(summary.after_console_event_focus?.eventState?.eventCount || 0),
      globalRecentEventFocusKind,
      globalRecentEventFocusValue,
    ], { timeout: 10000 });
    summary.after_console_focus_click = await captureState();
    summary.flow_action_history.push('focus-current:console');

    await page.click('#cad-status-solver');
    await page.waitForFunction(([beforeRequestCount, beforeEventCount, expectedKind, expectedValue]) => {
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const actionState = window.__cadDebug?.getSolverActionState?.();
      return Number(requestState?.requestCount || 0) > Number(beforeRequestCount || 0)
        && Number(eventState?.eventCount || 0) > Number(beforeEventCount || 0)
        && actionState?.activeFocus?.kind === expectedKind
        && String(actionState?.activeFocus?.value || '') === String(expectedValue || '');
    }, [
      Number(summary.after_console_focus_click?.requestState?.requestCount || summary.after_global_recent_event_focus?.requestState?.requestCount || 0),
      Number(summary.after_console_focus_click?.eventState?.eventCount || summary.after_global_recent_event_focus?.eventState?.eventCount || 0),
      globalRecentEventFocusKind,
      globalRecentEventFocusValue,
    ], { timeout: 10000 });
    summary.after_status_solver_click = await captureState();
    if (!summary.after_status_solver_click?.state?.activeFocus || summary.after_status_solver_click.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('solver status click did not preserve smallest redundancy panel focus');
    }
    if (summary.after_status_solver_click.state.activeFocus.kind !== globalRecentEventFocusKind || summary.after_status_solver_click.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('solver status click focus mismatch');
    }
    if (summary.after_status_solver_click?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('solver status click did not record focus request');
    }
    if (summary.after_status_solver_click?.flowState?.lastRequestKind !== 'focus' || summary.after_status_solver_click.flowState?.lastRequestTargetLabel !== globalRecentEventFocusLabel) {
      throw new Error('solver status click did not update action flow console');
    }
    if (summary.after_status_solver_click?.bannerState?.focusLabel !== globalRecentEventFocusLabel) {
      throw new Error('solver status click did not update flow banner focus');
    }
    if (!String(summary.after_status_solver_click?.solverStatus || '').includes('Trim smallest redundancy witness')
      || !String(summary.after_status_solver_click?.solverStatus || '').includes(globalRecentEventFocusLabel)) {
      throw new Error('solver status click did not update solver status');
    }
    if (summary.after_status_solver_click?.eventState?.lastEvent?.eventKind !== 'focus'
      || summary.after_status_solver_click?.eventState?.lastEvent?.focusKind !== globalRecentEventFocusKind
      || summary.after_status_solver_click?.eventState?.lastEvent?.focusValue !== globalRecentEventFocusValue) {
      throw new Error('solver status click did not record focus event');
    }
    if (Number(summary.after_status_solver_click?.requestState?.requestCount || 0) <= Number(summary.after_global_recent_event_focus?.requestState?.requestCount || 0)) {
      throw new Error('solver status click did not increase request count');
    }
    if (Number(summary.after_status_solver_click?.eventState?.eventCount || 0) <= Number(summary.after_global_recent_event_focus?.eventState?.eventCount || 0)) {
      throw new Error('solver status click did not increase event count');
    }
    await page.click('[data-banner-action="event-focus"]');
    await page.waitForFunction(([beforeRequestCount, beforeEventCount, expectedKind, expectedValue, expectedLabel]) => {
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const actionState = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return Number(requestState?.requestCount || 0) > Number(beforeRequestCount || 0)
        && Number(eventState?.eventCount || 0) > Number(beforeEventCount || 0)
        && actionState?.activeFocus?.kind === expectedKind
        && String(actionState?.activeFocus?.value || '') === String(expectedValue || '')
        && banner?.focusKind === expectedKind
        && String(banner?.focusValue || '') === String(expectedValue || '')
        && banner?.focusLabel === expectedLabel
        && requestState?.lastRequest?.requestKind === 'focus'
        && requestState?.lastRequest?.focusKind === expectedKind
        && String(requestState?.lastRequest?.focusValue || '') === String(expectedValue || '')
        && eventState?.lastEvent?.eventKind === 'focus'
        && eventState?.lastEvent?.focusKind === expectedKind
        && String(eventState?.lastEvent?.focusValue || '') === String(expectedValue || '')
        && flowState?.lastRequestKind === 'focus'
        && flowState?.lastRequestTargetLabel === expectedLabel;
    }, [
      Number(summary.after_status_solver_click?.requestState?.requestCount || 0),
      Number(summary.after_status_solver_click?.eventState?.eventCount || 0),
      globalRecentEventFocusKind,
      globalRecentEventFocusValue,
      globalRecentEventFocusLabel,
    ], { timeout: 10000 });
    summary.after_banner_event_focus = await captureState();
    if (!summary.after_banner_event_focus?.state?.activeFocus || summary.after_banner_event_focus.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('banner recent event click did not preserve smallest redundancy panel focus');
    }
    if (summary.after_banner_event_focus.state.activeFocus.kind !== globalRecentEventFocusKind || summary.after_banner_event_focus.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('banner recent event click focus mismatch');
    }
    if (summary.after_banner_event_focus?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('banner recent event click did not record focus request');
    }
    if (summary.after_banner_event_focus?.flowState?.lastRequestKind !== 'focus' || summary.after_banner_event_focus.flowState?.lastRequestTargetLabel !== globalRecentEventFocusLabel) {
      throw new Error('banner recent event click did not update action flow console');
    }
    if (summary.after_banner_event_focus?.bannerState?.focusLabel !== globalRecentEventFocusLabel) {
      throw new Error('banner recent event click did not preserve banner focus');
    }
    if (summary.after_banner_event_focus?.eventState?.lastEvent?.eventKind !== 'focus'
      || summary.after_banner_event_focus?.eventState?.lastEvent?.focusKind !== globalRecentEventFocusKind
      || summary.after_banner_event_focus?.eventState?.lastEvent?.focusValue !== globalRecentEventFocusValue) {
      throw new Error('banner recent event click did not record focus event');
    }
    if (Number(summary.after_banner_event_focus?.requestState?.requestCount || 0) <= Number(summary.after_status_solver_click?.requestState?.requestCount || 0)) {
      throw new Error('banner recent event click did not increase request count');
    }
    if (Number(summary.after_banner_event_focus?.eventState?.eventCount || 0) <= Number(summary.after_status_solver_click?.eventState?.eventCount || 0)) {
      throw new Error('banner recent event click did not increase event count');
    }
    summary.event_focus_check_count += 1;
    summary.banner_check_count += 1;
    summary.banner_event_focus_check_count += 1;
    summary.flow_check_count += 1;
    summary.flow_action_history.push(`event-focus:${globalRecentEventTarget.historyIndex}:banner`);
    await page.click('[data-banner-action="focus-current"]');
    await page.waitForFunction(([beforeRequestCount, beforeEventCount, panelId, focusKind, focusValue]) => {
      const requestState = window.__cadDebug?.getSolverActionRequestState?.();
      const eventState = window.__cadDebug?.getSolverActionEventState?.();
      const actionState = window.__cadDebug?.getSolverActionState?.();
      const banner = window.__cadDebug?.getSolverActionFlowBannerState?.();
      const flowState = window.__cadDebug?.getSolverActionFlowState?.();
      return Number(requestState?.requestCount || 0) > Number(beforeRequestCount || 0)
        && Number(eventState?.eventCount || 0) > Number(beforeEventCount || 0)
        && actionState?.activePanelId === panelId
        && actionState?.activeFocus?.kind === focusKind
        && String(actionState?.activeFocus?.value || '') === String(focusValue || '')
        && banner?.activePanelId === panelId
        && banner?.focusKind === focusKind
        && banner?.focusValue === focusValue
        && requestState?.lastRequest?.requestKind === 'focus'
        && requestState?.lastRequest?.focusKind === focusKind
        && String(requestState?.lastRequest?.focusValue || '') === String(focusValue || '')
        && eventState?.lastEvent?.eventKind === 'focus'
        && eventState?.lastEvent?.focusKind === focusKind
        && String(eventState?.lastEvent?.focusValue || '') === String(focusValue || '')
        && flowState?.lastRequestKind === 'focus'
        && flowState?.lastRequestTargetLabel === banner?.focusLabel;
    }, [
      Number(summary.after_banner_event_focus?.requestState?.requestCount || 0),
      Number(summary.after_banner_event_focus?.eventState?.eventCount || 0),
      String(summary.after_banner_event_focus?.state?.activePanelId || ''),
      String(summary.after_banner_event_focus?.state?.activeFocus?.kind || ''),
      String(summary.after_banner_event_focus?.state?.activeFocus?.value || ''),
    ], { timeout: 10000 });
    summary.after_banner_focus_click = await captureState();
    if (!summary.after_banner_focus_click?.state?.activeFocus || summary.after_banner_focus_click.state.activeFocus.panelId !== 'smallest_redundancy') {
      throw new Error('banner current focus click did not preserve smallest redundancy panel focus');
    }
    if (summary.after_banner_focus_click.state.activeFocus.kind !== globalRecentEventFocusKind || summary.after_banner_focus_click.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('banner current focus click focus mismatch');
    }
    if (summary.after_banner_focus_click?.requestState?.lastRequest?.requestKind !== 'focus') {
      throw new Error('banner current focus click did not record focus request');
    }
    if (summary.after_banner_focus_click?.flowState?.lastRequestKind !== 'focus' || summary.after_banner_focus_click.flowState?.lastRequestTargetLabel !== globalRecentEventFocusLabel) {
      throw new Error('banner current focus click did not update action flow console');
    }
    if (summary.after_banner_focus_click?.eventState?.lastEvent?.eventKind !== 'focus'
      || summary.after_banner_focus_click?.eventState?.lastEvent?.focusKind !== globalRecentEventFocusKind
      || summary.after_banner_focus_click?.eventState?.lastEvent?.focusValue !== globalRecentEventFocusValue) {
      throw new Error('banner current focus click did not record focus event');
    }
    if (Number(summary.after_banner_focus_click?.requestState?.requestCount || 0) <= Number(summary.after_banner_event_focus?.requestState?.requestCount || 0)) {
      throw new Error('banner current focus click did not increase request count');
    }
    if (Number(summary.after_banner_focus_click?.eventState?.eventCount || 0) <= Number(summary.after_banner_event_focus?.eventState?.eventCount || 0)) {
      throw new Error('banner current focus click did not increase event count');
    }
    if (!summary.after_console_next?.state?.activeFocus
      || summary.after_console_next.state.activeFocus.kind !== 'variable'
      || summary.after_console_next.state.activeFocus.value !== 'p0.x') {
      throw new Error('console next did not advance smallest redundancy flow');
    }
    if (!summary.after_console_prev?.state?.activeFocus
      || summary.after_console_prev.state.activeFocus.kind !== 'constraint'
      || summary.after_console_prev.state.activeFocus.value !== '0') {
      throw new Error('console prev did not rewind smallest redundancy flow');
    }
    if (!summary.after_console_restart?.state?.activeFocus
      || summary.after_console_restart.state.activeFocus.kind !== 'constraint'
      || summary.after_console_restart.state.activeFocus.value !== '0') {
      throw new Error('console restart did not reset smallest redundancy flow');
    }
    if (!summary.after_console_event_focus?.state?.activeFocus
      || summary.after_console_event_focus.state.activeFocus.kind !== globalRecentEventFocusKind
      || summary.after_console_event_focus.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('console recent event did not focus the latest actionable event');
    }
    if (!summary.after_console_focus_click?.state?.activeFocus
      || summary.after_console_focus_click.state.activeFocus.kind !== globalRecentEventFocusKind
      || summary.after_console_focus_click.state.activeFocus.value !== globalRecentEventFocusValue) {
      throw new Error('console current focus click did not preserve the latest actionable event');
    }
    if (summary.after_console_focus_click?.requestState?.lastRequest?.requestKind !== 'focus'
      || summary.after_console_focus_click?.flowState?.lastRequestKind !== 'focus'
      || summary.after_console_focus_click?.eventState?.lastEvent?.eventKind !== 'focus') {
      throw new Error('console current focus click did not record a focus request/event');
    }
    summary.event_focus_check_count += 1;
    summary.console_check_count += 1;
    summary.console_focus_click_check_count += 1;
    summary.flow_check_count += 1;
    summary.banner_check_count += 1;
    summary.banner_focus_click_check_count += 1;
    summary.status_check_count += 1;
    summary.status_click_check_count += 1;
    await page.click('#cad-clear-solver');
    await page.waitForFunction(() => {
      const diagnostics = window.__cadDebug?.getSolverDiagnostics?.();
      const panels = window.__cadDebug?.getSolverActionPanels?.();
      const state = window.__cadDebug?.getSolverActionState?.();
      return !diagnostics &&
        panels && Array.isArray(panels.panels) && panels.panels.length === 0 &&
        !state?.activePanelId &&
        !!document.getElementById('cad-clear-solver')?.disabled;
    }, { timeout: 10000 });
    summary.after_clear = await captureState();
    summary.clear_check_count += 1;
    if (!String(summary.after_clear?.message || '').includes('Solver diagnostics cleared')) {
      throw new Error('solver diagnostics clear did not update status message');
    }
    if (!String(summary.after_clear?.solverStatus || '').includes('Solver: idle')) {
      throw new Error('solver diagnostics clear did not restore idle solver status');
    }
    if (summary.next_check_count !== 6) {
      throw new Error(`expected 6 next checks, got ${summary.next_check_count}`);
    }
    if (summary.jump_check_count !== 3) {
      throw new Error(`expected 3 jump checks, got ${summary.jump_check_count}`);
    }
    if (summary.rewind_check_count !== 4) {
      throw new Error(`expected 4 prev checks, got ${summary.rewind_check_count}`);
    }
    if (summary.restart_check_count !== 4) {
      throw new Error(`expected 4 restart checks, got ${summary.restart_check_count}`);
    }
    const finalMetricsState = summary.after_banner_focus_click || summary.after_status_solver_click;
    summary.request_count = Number(finalMetricsState?.requestState?.requestCount || 0);
    summary.invoke_request_count = Number(finalMetricsState?.requestState?.invokeRequestCount || 0);
    summary.focus_request_count = Number(finalMetricsState?.requestState?.focusRequestCount || 0);
    summary.flow_request_count = Number(finalMetricsState?.requestState?.flowRequestCount || 0);
    summary.replay_request_count = Number(finalMetricsState?.requestState?.replayRequestCount || 0);
    summary.jump_request_count = Number((finalMetricsState?.requestState?.history || []).filter((request) => request?.requestKind === 'flow' && request?.flowAction === 'jump').length || 0);
    summary.dom_event_count = Number(finalMetricsState?.domEventState?.eventCount || 0);
    summary.dom_request_event_count = Number(finalMetricsState?.domEventState?.requestEventCount || 0);
    summary.dom_action_event_count = Number(finalMetricsState?.domEventState?.actionEventCount || 0);
    summary.dom_focus_event_count = Number(finalMetricsState?.domEventState?.focusEventCount || 0);
    summary.dom_flow_event_count = Number(finalMetricsState?.domEventState?.flowEventCount || 0);
    summary.dom_replay_event_count = Number(finalMetricsState?.domEventState?.replayEventCount || 0);
    summary.event_count = Number(finalMetricsState?.eventState?.eventCount || 0);
    summary.invoke_event_count = Number(finalMetricsState?.eventState?.invokeEventCount || 0);
    summary.focus_event_count = Number(finalMetricsState?.eventState?.focusEventCount || 0);
    summary.flow_event_count = Number(finalMetricsState?.eventState?.flowEventCount || 0);
    summary.replay_event_count = Number(finalMetricsState?.eventState?.replayEventCount || 0);
    summary.jump_event_count = Number((finalMetricsState?.eventState?.history || []).filter((event) => event?.eventKind === 'flow' && event?.flowAction === 'jump').length || 0);
    if (summary.event_focus_check_count !== 6) {
      throw new Error(`expected 6 recent event focus checks, got ${summary.event_focus_check_count}`);
    }
    if (summary.banner_check_count !== 8) {
      throw new Error(`expected 8 banner checks, got ${summary.banner_check_count}`);
    }
    if (summary.banner_event_focus_check_count !== 1) {
      throw new Error(`expected 1 banner recent-event check, got ${summary.banner_event_focus_check_count}`);
    }
    if (summary.banner_focus_click_check_count !== 1) {
      throw new Error(`expected 1 banner focus click check, got ${summary.banner_focus_click_check_count}`);
    }
    if (summary.panel_cycle_check_count !== 2) {
      throw new Error(`expected 2 panel cycle checks, got ${summary.panel_cycle_check_count}`);
    }
    if (summary.console_check_count !== 5) {
      throw new Error(`expected 5 console checks, got ${summary.console_check_count}`);
    }
    if (summary.console_flow_check_count !== 3) {
      throw new Error(`expected 3 console flow checks, got ${summary.console_flow_check_count}`);
    }
    if (summary.console_event_focus_check_count !== 1) {
      throw new Error(`expected 1 console event-focus check, got ${summary.console_event_focus_check_count}`);
    }
    if (summary.console_replay_check_count !== 1) {
      throw new Error(`expected 1 console replay check, got ${summary.console_replay_check_count}`);
    }
    if (summary.console_event_click_check_count !== 1) {
      throw new Error(`expected 1 console event click check, got ${summary.console_event_click_check_count}`);
    }
    if (summary.console_focus_click_check_count !== 1) {
      throw new Error(`expected 1 console focus click check, got ${summary.console_focus_click_check_count}`);
    }
    if (summary.console_selection_check_count !== 2) {
      throw new Error(`expected 2 console selection checks, got ${summary.console_selection_check_count}`);
    }
    if (summary.status_check_count !== 6) {
      throw new Error(`expected 6 solver status checks, got ${summary.status_check_count}`);
    }
    if (summary.status_click_check_count !== 1) {
      throw new Error(`expected 1 solver status click check, got ${summary.status_click_check_count}`);
    }
    if (summary.request_count !== 33) {
      throw new Error(`expected 33 action requests, got ${summary.request_count}`);
    }
    if (summary.invoke_request_count !== 4) {
      throw new Error(`expected 4 invoke requests, got ${summary.invoke_request_count}`);
    }
    if (summary.focus_request_count !== 10) {
      throw new Error(`expected 10 focus requests, got ${summary.focus_request_count}`);
    }
    if (summary.flow_request_count !== 18) {
      throw new Error(`expected 18 flow requests, got ${summary.flow_request_count}`);
    }
    if (summary.replay_request_count !== 1) {
      throw new Error(`expected 1 replay request, got ${summary.replay_request_count}`);
    }
    if (summary.jump_request_count !== 3) {
      throw new Error(`expected 3 jump requests, got ${summary.jump_request_count}`);
    }
    if (summary.dom_event_count !== 64) {
      throw new Error(`expected 64 global DOM events, got ${summary.dom_event_count}`);
    }
    if (summary.dom_request_event_count !== 32) {
      throw new Error(`expected 32 global DOM request events, got ${summary.dom_request_event_count}`);
    }
    if (summary.dom_action_event_count !== 3) {
      throw new Error(`expected 3 global DOM action events, got ${summary.dom_action_event_count}`);
    }
    if (summary.dom_focus_event_count !== 10) {
      throw new Error(`expected 10 global DOM focus events, got ${summary.dom_focus_event_count}`);
    }
    if (summary.dom_flow_event_count !== 18) {
      throw new Error(`expected 18 global DOM flow events, got ${summary.dom_flow_event_count}`);
    }
    if (summary.dom_replay_event_count !== 1) {
      throw new Error(`expected 1 global DOM replay event, got ${summary.dom_replay_event_count}`);
    }
    if (summary.event_count !== 33) {
      throw new Error(`expected 33 action events, got ${summary.event_count}`);
    }
    if (summary.invoke_event_count !== 4) {
      throw new Error(`expected 4 invoke events, got ${summary.invoke_event_count}`);
    }
    if (summary.focus_event_count !== 10) {
      throw new Error(`expected 10 focus events, got ${summary.focus_event_count}`);
    }
    if (summary.flow_event_count !== 18) {
      throw new Error(`expected 18 flow events, got ${summary.flow_event_count}`);
    }
    if (summary.replay_event_count !== 1) {
      throw new Error(`expected 1 replay event, got ${summary.replay_event_count}`);
    }
    if (summary.jump_event_count !== 3) {
      throw new Error(`expected 3 jump events, got ${summary.jump_event_count}`);
    }
    if (summary.keyboard_check_count !== 18) {
      throw new Error(`expected 18 keyboard flow checks, got ${summary.keyboard_check_count}`);
    }
    if (summary.panel_keyboard_check_count !== 11) {
      throw new Error(`expected 11 panel-card keyboard checks, got ${summary.panel_keyboard_check_count}`);
    }
    if (summary.panel_keyboard_invoke_check_count !== 1) {
      throw new Error(`expected 1 panel-card keyboard invoke check, got ${summary.panel_keyboard_invoke_check_count}`);
    }
    if (summary.panel_keyboard_flow_check_count !== 10) {
      throw new Error(`expected 10 panel-card keyboard flow checks, got ${summary.panel_keyboard_flow_check_count}`);
    }
    if (summary.keyboard_banner_check_count !== 1) {
      throw new Error(`expected 1 keyboard banner check, got ${summary.keyboard_banner_check_count}`);
    }
    if (summary.keyboard_jump_check_count !== 2) {
      throw new Error(`expected 2 keyboard jump checks, got ${summary.keyboard_jump_check_count}`);
    }
    if (summary.keyboard_event_focus_check_count !== 2) {
      throw new Error(`expected 2 keyboard event-focus check, got ${summary.keyboard_event_focus_check_count}`);
    }

    const screenshotPath = path.join(runDir, 'solver_action_panel.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    summary.screenshot = screenshotPath;
    summary.ok = true;
  } finally {
    const summaryPath = path.join(runDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    if (serverHandle?.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  }

  console.log(`run_id=${path.basename(runDir)}`);
  console.log(`run_dir=${runDir}`);
  console.log(`summary_json=${path.join(runDir, 'summary.json')}`);
  console.log(JSON.stringify(summary, null, 2));
  return summary.ok ? 0 : 1;
}

run().then(
  (code) => { process.exit(code); },
  (error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
);
