#!/usr/bin/env bash
set -euo pipefail

MODE="observe" # observe | gate
PORT="18081"
OUTDIR=""
VIEWPORT="1400,900" # window size for playwright-cli resize
TIMEOUT_MS="15000"
HEADED="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"; shift 2;;
    --port)
      PORT="$2"; shift 2;;
    --outdir)
      OUTDIR="$2"; shift 2;;
    --viewport)
      VIEWPORT="$2"; shift 2;;
    --timeout-ms)
      TIMEOUT_MS="$2"; shift 2;;
    --headed)
      HEADED="1"; shift 1;;
    -h|--help)
      echo "Usage: $0 [--mode observe|gate] [--port N] [--outdir dir] [--viewport W,H] [--timeout-ms MS] [--headed]"
      exit 0;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ "$MODE" != "observe" && "$MODE" != "gate" ]]; then
  echo "Invalid --mode: $MODE (expected observe|gate)" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Missing dependency: npx" >&2
  exit 1
fi

W="${VIEWPORT%,*}"
H="${VIEWPORT#*,}"
if ! [[ "$W" =~ ^[0-9]+$ && "$H" =~ ^[0-9]+$ ]]; then
  echo "Invalid --viewport: $VIEWPORT (expected W,H)" >&2
  exit 1
fi

RUN_ID="$(date +%Y%m%d_%H%M%S)_ui_flow"
if [[ -z "$OUTDIR" ]]; then
  OUTDIR="$ROOT_DIR/build/editor_ui_flow_smoke/$RUN_ID"
fi
mkdir -p "$OUTDIR"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
    _codex_home="${CODEX_HOME:-$HOME/.codex}"
    _pwcli="${PWCLI:-$_codex_home/skills/playwright/scripts/playwright_cli.sh}"
    if [[ -x "$_pwcli" ]]; then
      "$_pwcli" session-stop "${PLAYWRIGHT_CLI_SESSION}" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 -m http.server "$PORT" --directory "$ROOT_DIR" >"$OUTDIR/http.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

URL="http://127.0.0.1:$PORT/tools/web_viewer/index.html?mode=editor&seed=0&debug=1"
SCREENSHOT="$OUTDIR/editor_ui_flow.png"
SUMMARY="$OUTDIR/summary.json"
PLAYWRIGHT_LOG="$OUTDIR/playwright.log"
FLOW_RESULT="$OUTDIR/flow_result.json"
CONSOLE_LOG="$OUTDIR/console.log"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
# Keep session names short; macOS has tight UNIX domain socket path limits.
export PLAYWRIGHT_CLI_SESSION="${PLAYWRIGHT_CLI_SESSION:-uif_${PORT}}"

OPEN_ARGS=()
if [[ "$HEADED" == "1" ]]; then
  OPEN_ARGS+=(--headed)
fi

cd "$ROOT_DIR"

set +e
{
  echo "[OPEN] $URL"
  "$PWCLI" open "$URL" "${OPEN_ARGS[@]}"
  echo "[RESIZE] ${W}x${H}"
  "$PWCLI" resize "$W" "$H"
  echo "[FLOW] start"
} >>"$PLAYWRIGHT_LOG" 2>&1

"$PWCLI" run-code "(async (page) => {
  const timeoutMs = ${TIMEOUT_MS};
  await page.waitForSelector('#cad-canvas', { timeout: timeoutMs });
  await page.waitForSelector('[data-tool=\"line\"]', { timeout: timeoutMs });

  const canvas = page.locator('#cad-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('cad-canvas has no bounding box');
  const point = (rx, ry) => ({
    x: box.x + Math.max(20, box.width * rx),
    y: box.y + Math.max(20, box.height * ry),
  });

  const parseTypes = (text) => {
    const m = String(text || '').match(/\\(([^)]*)\\)/);
    if (!m) return [];
    return m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  async function blurActive() {
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active && typeof active.blur === 'function') active.blur();
    });
  }

  async function clearDoc() {
    await page.click('#cad-clear-doc');
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent.toLowerCase() : '';
      return t.includes('no selection');
    }, null, { timeout: timeoutMs });
  }

  async function waitForTypesInclude(type) {
    await page.waitForFunction((t) => {
      const el = document.querySelector('#cad-selection-summary');
      const text = (el && el.textContent) ? el.textContent : '';
      const m = text.match(/\\(([^)]*)\\)/);
      if (!m) return false;
      const types = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      return types.includes(t);
    }, type, { timeout: timeoutMs });
  }

  async function waitForTypesExact(types) {
    await page.waitForFunction((expected) => {
      const el = document.querySelector('#cad-selection-summary');
      const text = (el && el.textContent) ? el.textContent : '';
      const m = text.match(/\\(([^)]*)\\)/);
      if (!m) return false;
      const types = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      if (types.length !== expected.length) return false;
      for (let i = 0; i < types.length; i += 1) {
        if (types[i] !== expected[i]) return false;
      }
      return true;
    }, types, { timeout: timeoutMs });
  }

  async function readDebugState() {
    return page.evaluate(() => {
      const d = window.__cadDebug;
      return d && typeof d.getState === 'function' ? d.getState() : null;
    });
  }

  async function readSelectionIds() {
    return page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getSelectionIds !== 'function') return [];
      const ids = d.getSelectionIds();
      return Array.isArray(ids) ? ids.filter((id) => Number.isFinite(Number(id))).map((id) => Number(id)) : [];
    });
  }

  async function readEntityById(entityId) {
    return page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      const entity = d.getEntity(id);
      return entity || null;
    }, entityId);
  }

  const results = {
    // Keep a stable top-level key so the bash-side JSON validation can
    // distinguish flow returned JSON vs playwright-cli printed an error.
    line: null,
    __step: 'init',
    __error: null,
  };
  const setStep = (step) => { results.__step = String(step || ''); };

  try {
  setStep('line');

  // 1) Line draw + undo/redo
  await clearDoc();
  await page.click('[data-tool=\"line\"]');
  const lineP1 = point(0.25, 0.25);
  const lineP2 = point(0.65, 0.55);
  await page.mouse.click(lineP1.x, lineP1.y);
  await page.mouse.click(lineP2.x, lineP2.y);
  await waitForTypesInclude('line');
  const lineAfterDraw = (await page.textContent('#cad-selection-summary')) || '';
  results.line = {
    afterDraw: lineAfterDraw,
    types: parseTypes(lineAfterDraw),
  };
  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });
  results.line.afterUndo = (await page.textContent('#cad-selection-summary')) || '';
  await page.keyboard.press('Control+Y');
  await waitForTypesInclude('line');
  results.line.afterRedo = (await page.textContent('#cad-selection-summary')) || '';

  setStep('fillet_polyline');
  // 2) Fillet on polyline corner (same polyline, adjacent segments)
  await clearDoc();
  await page.click('[data-tool=\"polyline\"]');
  const polyA = point(0.25, 0.30);
  const polyB = point(0.55, 0.30);
  const polyC = point(0.55, 0.55);
  await page.mouse.click(polyA.x, polyA.y);
  await page.mouse.click(polyB.x, polyB.y);
  await page.mouse.click(polyC.x, polyC.y);
  await page.mouse.click(polyC.x, polyC.y, { button: 'right' });
  await waitForTypesInclude('polyline');

  await page.click('[data-tool=\"fillet\"]');
  const segH = { x: (polyA.x + polyB.x) * 0.5, y: (polyA.y + polyB.y) * 0.5 };
  const segV = { x: (polyB.x + polyC.x) * 0.5, y: (polyB.y + polyC.y) * 0.5 };
  await page.mouse.click(segH.x, segH.y);
  await page.mouse.click(segV.x, segV.y);
  await waitForTypesInclude('arc');
  const filletAfter = (await page.textContent('#cad-selection-summary')) || '';
  results.fillet_polyline = {
    afterFillet: filletAfter,
    types: parseTypes(filletAfter),
    status: (await page.textContent('#cad-status-message')) || '',
  };
  await blurActive();
  await page.keyboard.press('Control+Z');
  await waitForTypesExact(['polyline']);
  results.fillet_polyline.afterUndo = (await page.textContent('#cad-selection-summary')) || '';

  setStep('chamfer_polyline');
  // 3) Chamfer on polyline corner (same polyline, adjacent segments)
  await clearDoc();
  await page.click('[data-tool=\"polyline\"]');
  await page.mouse.click(polyA.x, polyA.y);
  await page.mouse.click(polyB.x, polyB.y);
  await page.mouse.click(polyC.x, polyC.y);
  await page.mouse.click(polyC.x, polyC.y, { button: 'right' });
  await waitForTypesInclude('polyline');

  await page.click('[data-tool=\"chamfer\"]');
  await page.mouse.click(segH.x, segH.y);
  await page.mouse.click(segV.x, segV.y);
  await waitForTypesInclude('line');
  const chamferAfter = (await page.textContent('#cad-selection-summary')) || '';
  results.chamfer_polyline = {
    afterChamfer: chamferAfter,
    types: parseTypes(chamferAfter),
    status: (await page.textContent('#cad-status-message')) || '',
  };
  await blurActive();
  await page.keyboard.press('Control+Z');
  await waitForTypesExact(['polyline']);
  results.chamfer_polyline.afterUndo = (await page.textContent('#cad-selection-summary')) || '';

  setStep('break_keep');
  // 4) Break Keep UI toggle + closed polyline two-point break
  await clearDoc();
  await page.click('[data-tool=\"polyline\"]');
  const r1 = point(0.30, 0.30);
  const r2 = point(0.65, 0.30);
  const r3 = point(0.65, 0.60);
  const r4 = point(0.30, 0.60);
  await page.mouse.click(r1.x, r1.y);
  await page.mouse.click(r2.x, r2.y);
  await page.mouse.click(r3.x, r3.y);
  await page.mouse.click(r4.x, r4.y);
  await page.mouse.click(r4.x, r4.y, { button: 'right' });
  await waitForTypesInclude('polyline');

  // Close the polyline via property panel toggle.
  await page.waitForSelector('label:has-text(\"Closed\") input[type=checkbox]', { timeout: timeoutMs });
  const closedToggle = page.locator('label:has-text(\"Closed\") input[type=checkbox]');
  await closedToggle.check();
  if (!(await closedToggle.isChecked())) {
    throw new Error('Failed to check Closed property');
  }

  // Toggle Break Keep until it reads "Short" (retry: click can be dropped under load).
  await blurActive();
  await page.waitForTimeout(30);
  const breakKeepBefore = (await page.textContent('#cad-toggle-break-keep')) || '';
  let breakKeepAfter = breakKeepBefore;
  const breakKeepBtn = page.locator('#cad-toggle-break-keep');
  await breakKeepBtn.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await breakKeepBtn.click({ force: true });
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector('#cad-toggle-break-keep');
        const t = el && el.textContent ? String(el.textContent) : '';
        return t.toLowerCase().includes('short');
      }, null, { timeout: Math.max(1000, Math.floor(timeoutMs / 3)) });
      breakKeepAfter = (await page.textContent('#cad-toggle-break-keep')) || '';
      break;
    } catch {
      // keep trying
      await page.waitForTimeout(60);
    }
  }
  if (!String(breakKeepAfter).toLowerCase().includes('short')) {
    throw new Error('Break Keep did not switch to Short: ' + breakKeepAfter);
  }

  // Clear selection so Break does not preselect and interpret the first click as a break point.
  await page.click('[data-tool="select"]');
  const empty = point(0.12, 0.15);
  await page.mouse.click(empty.x, empty.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });

  await page.click('[data-tool=\"break\"]');
  // Pick target.
  const targetPick = { x: (r1.x + r2.x) * 0.5, y: r1.y };
  await page.mouse.click(targetPick.x, targetPick.y);
  // Shift+click first break point, then click second point.
  const b1 = { x: r2.x, y: (r2.y + r3.y) * 0.5 };
  const b2 = { x: (r3.x + r4.x) * 0.5, y: r3.y };
  await page.keyboard.down('Shift');
  await page.mouse.click(b1.x, b1.y);
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('break(two-point)');
  }, null, { timeout: timeoutMs });
  await page.mouse.click(b2.x, b2.y);

  await page.waitForFunction(() => {
    const form = document.querySelector('#cad-property-form');
    if (!form) return false;
    const labels = Array.from(form.querySelectorAll('label'));
    const label = labels.find((el) => String(el.textContent || '').trim().startsWith('Closed'));
    if (!label) return false;
    const input = label.querySelector('input[type=checkbox]');
    return input && input.checked === false;
  }, null, { timeout: timeoutMs });

  results.break_keep = {
    breakKeepBefore,
    breakKeepAfter,
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('break_continue_after_escape');
  // 4.5) Break tool: in two-point mode, Esc backs out without losing target (then single-point break succeeds without re-picking target)
  {
    await clearDoc();

    await page.click('[data-tool=\"polyline\"]');
    await page.mouse.click(r1.x, r1.y);
    await page.mouse.click(r2.x, r2.y);
    await page.mouse.click(r3.x, r3.y);
    await page.mouse.click(r4.x, r4.y);
    await page.mouse.click(r4.x, r4.y, { button: 'right' });
    await waitForTypesInclude('polyline');

    await page.waitForSelector('label:has-text(\"Closed\") input[type=checkbox]', { timeout: timeoutMs });
    const closedToggle2 = page.locator('label:has-text(\"Closed\") input[type=checkbox]');
    await closedToggle2.check();

    // Clear selection so Break does not preselect and interpret the first click as a break point.
    await page.click('[data-tool=\"select\"]');
    const empty2 = point(0.12, 0.15);
    await page.mouse.click(empty2.x, empty2.y);
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent.toLowerCase() : '';
      return t.includes('no selection');
    }, null, { timeout: timeoutMs });

    await page.click('[data-tool=\"break\"]');
    const targetPick2 = { x: (r1.x + r2.x) * 0.5, y: r1.y };
    await page.mouse.click(targetPick2.x, targetPick2.y);

    const bb1 = { x: r2.x, y: (r2.y + r3.y) * 0.5 };
    const bb2 = { x: (r3.x + r4.x) * 0.5, y: r3.y };
    await page.keyboard.down('Shift');
    await page.mouse.click(bb1.x, bb1.y);
    await page.keyboard.up('Shift');
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-status-message');
      const t = el && el.textContent ? el.textContent.toLowerCase() : '';
      return t.includes('break(two-point)');
    }, null, { timeout: timeoutMs });

    // Escape should back out of two-point pick2 without losing the target.
    await blurActive();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-status-message');
      const t = el && el.textContent ? el.textContent.toLowerCase() : '';
      return t.includes('break') && !t.includes('canceled');
    }, null, { timeout: timeoutMs });

    // Single-point break should work without re-picking target.
    await page.mouse.click(bb2.x, bb2.y);
    await page.waitForFunction(() => {
      const form = document.querySelector('#cad-property-form');
      if (!form) return false;
      const labels = Array.from(form.querySelectorAll('label'));
      const label = labels.find((el) => String(el.textContent || '').trim().startsWith('Closed'));
      if (!label) return false;
      const input = label.querySelector('input[type=checkbox]');
      return input && input.checked === false;
    }, null, { timeout: timeoutMs });

    results.break_continue_after_escape = {
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };
  }

  setStep('arc_radius_grip');
  // 5) Arc radius grip drag + undo/redo (grips should commit as a single selection.propertyPatch)
  await clearDoc();

  // Disable snap for deterministic handle hit-testing.
  const snapToggle = page.locator('#cad-toggle-snap');
  const snapLabel = ((await snapToggle.textContent()) || '').toLowerCase();
  if (snapLabel.includes('on')) {
    await snapToggle.click();
  }

  await page.click('[data-tool=\"arc\"]');
  const arcC = point(0.35, 0.35);
  const arcS = point(0.55, 0.35);
  const arcE = point(0.35, 0.55);
  await page.mouse.click(arcC.x, arcC.y);
  await page.mouse.click(arcS.x, arcS.y);
  await page.mouse.click(arcE.x, arcE.y);
  await waitForTypesExact(['arc']);

  // Switch to select tool so grips are active.
  await page.click('[data-tool=\"select\"]');

  await page.waitForSelector('#cad-property-form input[name=\"radius\"]', { timeout: timeoutMs });
  const radiusSelector = '#cad-property-form input[name=\"radius\"]';
  const readArcNumber = async (name) => page.evaluate((n) => {
    const el = document.querySelector('#cad-property-form input[name=\"' + n + '\"]');
    return el ? Number.parseFloat(el.value) : NaN;
  }, name);

  const arcMetaBefore = {
    centerX: await readArcNumber('center.x'),
    centerY: await readArcNumber('center.y'),
    startAngle: await readArcNumber('startAngle'),
    endAngle: await readArcNumber('endAngle'),
  };
  if (![arcMetaBefore.centerX, arcMetaBefore.centerY, arcMetaBefore.startAngle, arcMetaBefore.endAngle].every(Number.isFinite)) {
    throw new Error('Arc meta invalid before drag');
  }
  const radiusBefore = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Number.parseFloat(el.value) : NaN;
  }, radiusSelector);
  if (!Number.isFinite(radiusBefore) || radiusBefore <= 0) {
    throw new Error('Arc radius invalid before drag: ' + radiusBefore);
  }

  const normalizeAngle = (a) => {
    let v = a;
    while (v < 0) v += Math.PI * 2;
    while (v >= Math.PI * 2) v -= Math.PI * 2;
    return v;
  };
  const startAngle = normalizeAngle(Math.atan2(arcS.y - arcC.y, arcS.x - arcC.x));
  const endAngle = normalizeAngle(Math.atan2(arcE.y - arcC.y, arcE.x - arcC.x));
  let delta = endAngle - startAngle;
  if (delta < 0) delta += Math.PI * 2;
  const midAngle = normalizeAngle(startAngle + delta * 0.5);
  const r = Math.hypot(arcS.x - arcC.x, arcS.y - arcC.y);
  const grip = { x: arcC.x + r * Math.cos(midAngle), y: arcC.y + r * Math.sin(midAngle) };
  const target = { x: arcC.x + r * 1.5 * Math.cos(midAngle), y: arcC.y + r * 1.5 * Math.sin(midAngle) };

  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();

  await page.waitForFunction(({ sel, before }) => {
    const el = document.querySelector(sel);
    const v = el ? Number.parseFloat(el.value) : NaN;
    return Number.isFinite(v) && v > before * 1.2;
  }, { sel: radiusSelector, before: radiusBefore }, { timeout: timeoutMs });

  const radiusAfter = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Number.parseFloat(el.value) : NaN;
  }, radiusSelector);
  const arcMetaAfter = {
    centerX: await readArcNumber('center.x'),
    centerY: await readArcNumber('center.y'),
    startAngle: await readArcNumber('startAngle'),
    endAngle: await readArcNumber('endAngle'),
  };
  const metaTol = 1e-4;
  if (
    Math.abs(arcMetaAfter.centerX - arcMetaBefore.centerX) > metaTol
    || Math.abs(arcMetaAfter.centerY - arcMetaBefore.centerY) > metaTol
    || Math.abs(arcMetaAfter.startAngle - arcMetaBefore.startAngle) > metaTol
    || Math.abs(arcMetaAfter.endAngle - arcMetaBefore.endAngle) > metaTol
  ) {
    throw new Error('Arc meta drifted during radius grip drag');
  }

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction(({ sel, before }) => {
    const el = document.querySelector(sel);
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(before) * 0.08);
    return Math.abs(v - before) <= tol;
  }, { sel: radiusSelector, before: radiusBefore }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ sel, after }) => {
    const el = document.querySelector(sel);
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(after) * 0.08);
    return Math.abs(v - after) <= tol;
  }, { sel: radiusSelector, after: radiusAfter }, { timeout: timeoutMs });

  results.arc_radius_grip = {
    radiusBefore,
    radiusAfter,
    meta: { before: arcMetaBefore, after: arcMetaAfter },
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('offset_line');
  // 6) Offset tool: create offset line + undo/redo (verify geometry changes via property panel)
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const offA = point(0.25, 0.35);
  const offB = point(0.65, 0.35);
  await page.mouse.click(offA.x, offA.y);
  await page.mouse.click(offB.x, offB.y);
  await waitForTypesExact(['line']);

  const readNumberInput = async (name) => page.evaluate((n) => {
    const el = document.querySelector('#cad-property-form input[name=\"' + n + '\"]');
    return el ? Number.parseFloat(el.value) : NaN;
  }, name);

  const offBefore = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (![offBefore.startX, offBefore.startY, offBefore.endX, offBefore.endY].every(Number.isFinite)) {
    throw new Error('Offset(line) failed to read start/end inputs');
  }
  const offBeforeState = await readDebugState();
  const offBeforeId = offBeforeState && Number.isFinite(offBeforeState.primaryId)
    ? Number(offBeforeState.primaryId)
    : NaN;
  const offBeforeEntity = Number.isFinite(offBeforeId) ? await readEntityById(offBeforeId) : null;
  if (!offBeforeEntity || offBeforeEntity.type !== 'line' || !offBeforeEntity.start || !offBeforeEntity.end) {
    throw new Error('Offset(line) failed to read primary line before offset');
  }

  // Set distance via command input so the flow stays stable if defaults change.
  await page.fill('#cad-command-input', 'offset 5');
  await page.click('[data-tool=\"offset\"]');

  const offMid = { x: (offA.x + offB.x) * 0.5, y: offA.y };
  await page.mouse.click(offMid.x, offMid.y); // pickTargets -> pickSide
  const offSide = point(0.45, 0.45);
  await page.mouse.click(offSide.x, offSide.y); // commit
  await waitForTypesExact(['line']);

  await page.waitForFunction((beforeY) => {
    const el = document.querySelector('#cad-property-form input[name=\"start.y\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    return Number.isFinite(v) && Math.abs(v - beforeY) > 1.0;
  }, offBefore.startY, { timeout: timeoutMs });

  const offAfter = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  const offAfterState = await readDebugState();
  const offAfterId = offAfterState && Number.isFinite(offAfterState.primaryId)
    ? Number(offAfterState.primaryId)
    : NaN;
  const offAfterEntity = Number.isFinite(offAfterId) ? await readEntityById(offAfterId) : null;
  if (!offAfterEntity || offAfterEntity.type !== 'line' || !offAfterEntity.start || !offAfterEntity.end) {
    throw new Error('Offset(line) failed to read primary line after offset');
  }
  if (!offAfterState || offAfterState.entityCount !== 2) {
    throw new Error('Offset(line) expected 2 line entities after commit');
  }
  const lineLength = (line) => {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    return Math.hypot(dx, dy);
  };
  const pointLineDistance = (p, a, b) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const denom = Math.hypot(vx, vy);
    if (!(denom > 1e-6)) return NaN;
    return Math.abs((p.x - a.x) * vy - (p.y - a.y) * vx) / denom;
  };
  const beforeLen = lineLength(offBeforeEntity);
  const afterLen = lineLength(offAfterEntity);
  if (!(beforeLen > 1e-6 && afterLen > 1e-6)) {
    throw new Error('Offset(line) encountered degenerate line length');
  }
  const lenTol = Math.max(0.1, beforeLen * 0.05);
  if (Math.abs(afterLen - beforeLen) > lenTol) {
    throw new Error('Offset(line) changed line length unexpectedly');
  }
  const expectedOffset = 5.0;
  const distTol = Math.max(0.35, expectedOffset * 0.25);
  const offDist1 = pointLineDistance(offAfterEntity.start, offBeforeEntity.start, offBeforeEntity.end);
  const offDist2 = pointLineDistance(offAfterEntity.end, offBeforeEntity.start, offBeforeEntity.end);
  if (!Number.isFinite(offDist1) || !Number.isFinite(offDist2)) {
    throw new Error('Offset(line) could not compute perpendicular distances');
  }
  if (Math.abs(offDist1 - expectedOffset) > distTol || Math.abs(offDist2 - expectedOffset) > distTol) {
    throw new Error('Offset(line) distance drifted from command distance');
  }

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-property-form input[name=\"start.y\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(before) * 0.08);
    return Math.abs(v - before) <= tol;
  }, offBefore.startY, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction((after) => {
    const el = document.querySelector('#cad-property-form input[name=\"start.y\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(after) * 0.08);
    return Math.abs(v - after) <= tol;
  }, offAfter.startY, { timeout: timeoutMs });

  results.offset_line = {
    before: offBefore,
    after: offAfter,
    geometry: {
      before: offBeforeEntity,
      after: offAfterEntity,
      distanceToBaseStart: offDist1,
      distanceToBaseEnd: offDist2,
    },
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('join');
  // 7) Join command: multi-select two connected lines -> join -> undo/redo
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const jA = point(0.25, 0.55);
  const jB = point(0.55, 0.55);
  const jC = point(0.75, 0.65);
  await page.mouse.click(jA.x, jA.y);
  await page.mouse.click(jB.x, jB.y);
  await page.mouse.click(jB.x, jB.y);
  await page.mouse.click(jC.x, jC.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"select\"]');
  const jM1 = { x: (jA.x + jB.x) * 0.5, y: jA.y };
  const jM2 = { x: (jB.x + jC.x) * 0.5, y: (jB.y + jC.y) * 0.5 };
  await page.mouse.click(jM1.x, jM1.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(jM2.x, jM2.y);
  await page.keyboard.up('Shift');

  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const joinSelectedIds = await readSelectionIds();
  if (!Array.isArray(joinSelectedIds) || joinSelectedIds.length !== 2) {
    throw new Error('Join expected exactly two selected lines before command');
  }
  const joinLineA = await readEntityById(joinSelectedIds[0]);
  const joinLineB = await readEntityById(joinSelectedIds[1]);
  if (!joinLineA || !joinLineB || joinLineA.type !== 'line' || joinLineB.type !== 'line') {
    throw new Error('Join precondition failed: selected entities are not both lines');
  }
  const dist = (a, b) => Math.hypot((a.x - b.x), (a.y - b.y));
  const lineAPoints = [joinLineA.start, joinLineA.end];
  const lineBPoints = [joinLineB.start, joinLineB.end];
  let bestShared = { i: 0, j: 0, d: Number.POSITIVE_INFINITY };
  for (let i = 0; i < lineAPoints.length; i += 1) {
    for (let j = 0; j < lineBPoints.length; j += 1) {
      const d = dist(lineAPoints[i], lineBPoints[j]);
      if (d < bestShared.d) {
        bestShared = { i, j, d };
      }
    }
  }
  const joinShared = {
    x: (lineAPoints[bestShared.i].x + lineBPoints[bestShared.j].x) * 0.5,
    y: (lineAPoints[bestShared.i].y + lineBPoints[bestShared.j].y) * 0.5,
  };
  const joinEndA = lineAPoints[1 - bestShared.i];
  const joinEndB = lineBPoints[1 - bestShared.j];

  await page.fill('#cad-command-input', 'join');
  await page.keyboard.press('Enter');
  await waitForTypesExact(['polyline']);
  const joinAfterState = await readDebugState();
  const joinAfterId = joinAfterState && Number.isFinite(joinAfterState.primaryId)
    ? Number(joinAfterState.primaryId)
    : NaN;
  const joinPolyline = Number.isFinite(joinAfterId) ? await readEntityById(joinAfterId) : null;
  if (!joinAfterState || joinAfterState.entityCount !== 1) {
    throw new Error('Join expected 1 entity after merge');
  }
  if (!joinPolyline || joinPolyline.type !== 'polyline' || !Array.isArray(joinPolyline.points)) {
    throw new Error('Join failed to produce selected polyline');
  }
  if (joinPolyline.points.length !== 3) {
    throw new Error('Join expected 3 polyline points after merging two connected lines');
  }
  const joinPtTol = 0.35;
  const joinMid = joinPolyline.points[1];
  if (dist(joinMid, joinShared) > joinPtTol) {
    throw new Error('Join midpoint drifted from shared endpoint');
  }
  const joinFirst = joinPolyline.points[0];
  const joinLast = joinPolyline.points[2];
  const mapAB = dist(joinFirst, joinEndA) + dist(joinLast, joinEndB);
  const mapBA = dist(joinFirst, joinEndB) + dist(joinLast, joinEndA);
  if (Math.min(mapAB, mapBA) > joinPtTol * 2.0) {
    throw new Error('Join endpoints do not match source line endpoints');
  }

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const joinUndoState = await readDebugState();
  if (!joinUndoState || joinUndoState.entityCount !== 2) {
    throw new Error('Join undo did not restore 2 source lines');
  }

  await page.keyboard.press('Control+Y');
  await waitForTypesExact(['polyline']);
  const joinRedoState = await readDebugState();
  if (!joinRedoState || joinRedoState.entityCount !== 1) {
    throw new Error('Join redo did not restore merged polyline');
  }

  results.join = {
    source: {
      ids: joinSelectedIds,
      lineA: joinLineA,
      lineB: joinLineB,
      shared: joinShared,
    },
    merged: joinPolyline,
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('text_edit');
  // 8) Text create + property panel edit + undo/redo
  await clearDoc();

  await page.fill('#cad-command-input', 'text HELLO 3');
  await page.click('[data-tool=\"text\"]');
  const txtPos = point(0.35, 0.45);
  await page.mouse.click(txtPos.x, txtPos.y);
  await waitForTypesExact(['text']);

  await page.waitForSelector('#cad-property-form input[name=\"value\"]', { timeout: timeoutMs });
  const textValueBefore = await page.evaluate(() => {
    const el = document.querySelector('#cad-property-form input[name=\"value\"]');
    return el ? String(el.value || '') : '';
  });
  if (!textValueBefore.toUpperCase().includes('HELLO')) {
    throw new Error('Text value not applied from command input: ' + textValueBefore);
  }

  await page.fill('#cad-property-form input[name=\"value\"]', 'WORLD');
  await blurActive(); // triggers change event -> selection.propertyPatch
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-property-form input[name=\"value\"]');
    return el && String(el.value || '') === 'WORLD';
  }, null, { timeout: timeoutMs });

  await page.keyboard.press('Control+Z');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-property-form input[name=\"value\"]');
    const v = el ? String(el.value || '') : '';
    return v.toUpperCase().includes('HELLO');
  }, null, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-property-form input[name=\"value\"]');
    return el && String(el.value || '') === 'WORLD';
  }, null, { timeout: timeoutMs });

  results.text_edit = {
    before: textValueBefore,
    after: (await page.evaluate(() => {
      const el = document.querySelector('#cad-property-form input[name=\"value\"]');
      return el ? String(el.value || '') : '';
    })) || '',
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('trim_line');
  // 9) Trim tool: boundary + 2 target lines -> trim twice without re-picking boundary (continuous) -> undo/redo last
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const trimB1 = point(0.55, 0.22);
  const trimB2 = point(0.55, 0.72);
  await page.mouse.click(trimB1.x, trimB1.y);
  await page.mouse.click(trimB2.x, trimB2.y);
  await waitForTypesExact(['line']);

  // Two targets crossing the boundary.
  await page.click('[data-tool=\"line\"]');
  const trim1A = point(0.20, 0.50);
  const trim1B = point(0.80, 0.50);
  await page.mouse.click(trim1A.x, trim1A.y);
  await page.mouse.click(trim1B.x, trim1B.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"line\"]');
  const trim2A = point(0.20, 0.62);
  const trim2B = point(0.80, 0.62);
  await page.mouse.click(trim2A.x, trim2A.y);
  await page.mouse.click(trim2B.x, trim2B.y);
  await waitForTypesExact(['line']);

  // Deterministic pick points:
  // - boundary is near x=0.55
  // - click trim target near the RIGHT side to trim away the right segment and keep the left segment
  const trim1Select = point(0.30, 0.50);
  const trim2Select = point(0.30, 0.62);
  const trim1TrimPick = point(0.74, 0.50);
  const trim2TrimPick = point(0.74, 0.62);

  // Record baselines per-target by selecting them before trimming.
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(trim1Select.x, trim1Select.y);
  await waitForTypesExact(['line']);
  const trim1Before = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  await page.mouse.click(trim2Select.x, trim2Select.y);
  await waitForTypesExact(['line']);
  const trim2Before = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };

  await page.click('[data-tool=\"trim\"]');
  const trimBoundaryPick = { x: trimB1.x, y: (trimB1.y + trimB2.y) * 0.5 - 80 };
  await page.mouse.click(trimBoundaryPick.x, trimBoundaryPick.y);
  // Trim target #1.
  await page.mouse.click(trim1TrimPick.x, trim1TrimPick.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('trim applied') && t.includes('boundaries=1');
  }, null, { timeout: timeoutMs });
  const trimStatus1 = (await page.textContent('#cad-status-message')) || '';

  // Trim target #2 without re-picking the boundary (continuous behavior).
  await page.mouse.click(trim2TrimPick.x, trim2TrimPick.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('trim applied') && t.includes('boundaries=1');
  }, null, { timeout: timeoutMs });
  const trimStatus2 = (await page.textContent('#cad-status-message')) || '';

  await blurActive();
  await page.keyboard.press('Escape');

  // After leaving the trim tool, verify both targets actually changed by selecting them and comparing properties.
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(trim1Select.x, trim1Select.y);
  await waitForTypesExact(['line']);
  const trim1After = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (Math.abs(trim1After.startX - trim1Before.startX) < 0.1 && Math.abs(trim1After.endX - trim1Before.endX) < 0.1) {
    throw new Error('Trim target1 did not change');
  }
  await page.mouse.click(trim2Select.x, trim2Select.y);
  await waitForTypesExact(['line']);
  const trim2After = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (Math.abs(trim2After.startX - trim2Before.startX) < 0.1 && Math.abs(trim2After.endX - trim2Before.endX) < 0.1) {
    throw new Error('Trim target2 did not change');
  }

  // Undo/redo last trim should affect target2.
  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction((before) => {
    const sx = document.querySelector('#cad-property-form input[name=\"start.x\"]');
    const ex = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const sv = sx ? Number.parseFloat(sx.value) : NaN;
    const ev = ex ? Number.parseFloat(ex.value) : NaN;
    if (!Number.isFinite(sv) || !Number.isFinite(ev)) return false;
    const tolS = Math.max(0.05, Math.abs(before.startX) * 0.08);
    const tolE = Math.max(0.05, Math.abs(before.endX) * 0.08);
    return Math.abs(sv - before.startX) <= tolS && Math.abs(ev - before.endX) <= tolE;
  }, trim2Before, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction((after) => {
    const sx = document.querySelector('#cad-property-form input[name=\"start.x\"]');
    const ex = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const sv = sx ? Number.parseFloat(sx.value) : NaN;
    const ev = ex ? Number.parseFloat(ex.value) : NaN;
    if (!Number.isFinite(sv) || !Number.isFinite(ev)) return false;
    const tolS = Math.max(0.05, Math.abs(after.startX) * 0.08);
    const tolE = Math.max(0.05, Math.abs(after.endX) * 0.08);
    return Math.abs(sv - after.startX) <= tolS && Math.abs(ev - after.endX) <= tolE;
  }, trim2After, { timeout: timeoutMs });

  results.trim_line = {
    target1: { before: trim1Before, after: trim1After },
    target2: { before: trim2Before, after: trim2After },
    status1: trimStatus1,
    status2: trimStatus2,
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  await blurActive();
  await page.keyboard.press('Escape');

  setStep('trim_continue_after_failure');
  // 10) Trim tool: after a NO_INTERSECTION failure, keep boundaries and allow next target to succeed (continuous)
  {
    await clearDoc();

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const id = s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
      return id;
    });
    const readLineEnds = async (entityId) => page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line') return null;
      const s = e.start;
      const t = e.end;
      if (!s || !t) return null;
      if (![s.x, s.y, t.x, t.y].every(Number.isFinite)) return null;
      return { startX: s.x, startY: s.y, endX: t.x, endY: t.y };
    }, entityId);

    // Boundary: vertical line near the middle.
    await page.click('[data-tool=\"line\"]');
    const tfB1 = point(0.58, 0.22);
    const tfB2 = point(0.58, 0.78);
    await page.mouse.click(tfB1.x, tfB1.y);
    await page.mouse.click(tfB2.x, tfB2.y);
    await waitForTypesExact(['line']);
    const tfBoundaryId = await readPrimaryId();
    const tfBoundary = await readLineEnds(tfBoundaryId);
    if (!tfBoundary) throw new Error('Trim(failure) failed to read boundary entity');
    const tfBoundaryX = tfBoundary.startX;

    // Target #1: line entirely left of boundary (no intersection) -> should remain unchanged after trim attempt.
    await page.click('[data-tool=\"line\"]');
    const tf1A = point(0.18, 0.54);
    const tf1B = point(0.44, 0.54);
    const tf1Mid = { x: (tf1A.x + tf1B.x) * 0.5, y: (tf1A.y + tf1B.y) * 0.5 };
    await page.mouse.click(tf1A.x, tf1A.y);
    await page.mouse.click(tf1B.x, tf1B.y);
    await waitForTypesExact(['line']);
    const tf1Id = await readPrimaryId();
    const tf1Before = await readLineEnds(tf1Id);
    if (!tf1Before) throw new Error('Trim(failure) failed to read target1 entity');

    // Target #2: line crossing boundary -> should trim successfully without re-picking boundary.
    await page.click('[data-tool=\"line\"]');
    const tf2A = point(0.20, 0.66);
    const tf2B = point(0.82, 0.66);
    const tf2Mid = { x: (tf2A.x + tf2B.x) * 0.5, y: (tf2A.y + tf2B.y) * 0.5 };
    await page.mouse.click(tf2A.x, tf2A.y);
    await page.mouse.click(tf2B.x, tf2B.y);
    await waitForTypesExact(['line']);
    const tf2Id = await readPrimaryId();
    const tf2Before = await readLineEnds(tf2Id);
    if (!tf2Before) throw new Error('Trim(failure) failed to read target2 entity');

    // Trim: pick boundary, then attempt target#1 (expect no change), then target#2 (expect success) without re-picking boundary.
    await page.click('[data-tool=\"trim\"]');
    const tfBoundaryPick = { x: tfB1.x, y: (tfB1.y + tfB2.y) * 0.5 - 60 };
    await page.mouse.click(tfBoundaryPick.x, tfBoundaryPick.y);

    // Failure attempt: no intersection.
    await page.mouse.click(tf1Mid.x, tf1Mid.y);
    await page.waitForTimeout(60);

    // Success attempt: should trim to boundary.
    await page.mouse.click(tf2Mid.x, tf2Mid.y);
    await page.waitForTimeout(60);

    await blurActive();
    await page.keyboard.press('Escape');

    const tf1After = await readLineEnds(tf1Id);
    const tf2After = await readLineEnds(tf2Id);
    if (!tf1After || !tf2After) throw new Error('Trim(failure) failed to read targets after');

    // Verify geometry outcomes via entity geometry (avoids flaky hit-test in extreme zoom levels).
    if (
      Math.abs(tf1After.startX - tf1Before.startX) > 0.05 ||
      Math.abs(tf1After.startY - tf1Before.startY) > 0.05 ||
      Math.abs(tf1After.endX - tf1Before.endX) > 0.05 ||
      Math.abs(tf1After.endY - tf1Before.endY) > 0.05
    ) {
      throw new Error('Trim(no-intersection) unexpectedly changed target1');
    }

    const tf2Dx = Math.min(Math.abs(tf2After.startX - tfBoundaryX), Math.abs(tf2After.endX - tfBoundaryX));
    if (tf2Dx > 0.05) {
      throw new Error('Trim(after failure) did not reach boundary (dx=' + tf2Dx + ')');
    }
    if (Math.abs(tf2After.startX - tf2Before.startX) < 0.05 && Math.abs(tf2After.endX - tf2Before.endX) < 0.05) {
      throw new Error('Trim(after failure) did not change target2');
    }

    // Undo/redo last trim should affect only target2 (target1 was a no-op).
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(({ id, before }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line' || !e.start || !e.end) return false;
      const sx = e.start.x;
      const sy = e.start.y;
      const ex = e.end.x;
      const ey = e.end.y;
      if (![sx, sy, ex, ey].every(Number.isFinite)) return false;
      const tol = 0.08;
      return (
        Math.abs(sx - before.startX) <= tol &&
        Math.abs(sy - before.startY) <= tol &&
        Math.abs(ex - before.endX) <= tol &&
        Math.abs(ey - before.endY) <= tol
      );
    }, { id: tf2Id, before: tf2Before }, { timeout: timeoutMs });

    await page.keyboard.press('Control+Y');
    await page.waitForFunction(({ id, after }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line' || !e.start || !e.end) return false;
      const sx = e.start.x;
      const sy = e.start.y;
      const ex = e.end.x;
      const ey = e.end.y;
      if (![sx, sy, ex, ey].every(Number.isFinite)) return false;
      const tol = 0.08;
      return (
        Math.abs(sx - after.startX) <= tol &&
        Math.abs(sy - after.startY) <= tol &&
        Math.abs(ex - after.endX) <= tol &&
        Math.abs(ey - after.endY) <= tol
      );
    }, { id: tf2Id, after: tf2After }, { timeout: timeoutMs });

    results.trim_continue_after_failure = {
      boundaryX: tfBoundaryX,
      ids: { boundary: tfBoundaryId, target1: tf1Id, target2: tf2Id },
      target1: { before: tf1Before, after: tf1After },
      target2: { before: tf2Before, after: tf2After, dxToBoundary: tf2Dx },
      status: (await page.textContent('#cad-status-message')) || '',
    };
  }

  setStep('extend_line');
  // 10) Extend tool: boundary + 2 target lines -> extend twice without re-picking boundary (continuous) -> verify by selecting targets -> undo/redo last
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const extB1 = point(0.65, 0.20);
  const extB2 = point(0.65, 0.78);
  await page.mouse.click(extB1.x, extB1.y);
  await page.mouse.click(extB2.x, extB2.y);
  await waitForTypesExact(['line']);
  const boundaryExtX = await readNumberInput('start.x');

  // Two targets ending before the boundary.
  await page.click('[data-tool=\"line\"]');
  const ext1A = point(0.20, 0.60);
  const ext1B = point(0.45, 0.60);
  await page.mouse.click(ext1A.x, ext1A.y);
  await page.mouse.click(ext1B.x, ext1B.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"line\"]');
  const ext2A = point(0.20, 0.72);
  const ext2B = point(0.42, 0.72);
  await page.mouse.click(ext2A.x, ext2A.y);
  await page.mouse.click(ext2B.x, ext2B.y);
  await waitForTypesExact(['line']);

  // Record baselines per-target by selecting them before extending.
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(ext1B.x - 4, ext1B.y);
  await waitForTypesExact(['line']);
  const ext1BeforeEndX = await readNumberInput('end.x');
  await page.mouse.click(ext2B.x - 4, ext2B.y);
  await waitForTypesExact(['line']);
  const ext2BeforeEndX = await readNumberInput('end.x');

  await page.click('[data-tool=\"extend\"]');
  const extBoundaryPick = { x: extB1.x, y: (extB1.y + extB2.y) * 0.5 - 80 };
  await page.mouse.click(extBoundaryPick.x, extBoundaryPick.y);
  // Extend target #1.
  await page.mouse.click(ext1B.x - 2, ext1B.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('extend applied to') && t.includes('boundaries=1');
  }, null, { timeout: timeoutMs });

  // Extend target #2 without re-picking boundary (continuous behavior).
  await page.mouse.click(ext2B.x - 2, ext2B.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('extend applied to') && t.includes('boundaries=1');
  }, null, { timeout: timeoutMs });

  await blurActive();
  await page.keyboard.press('Escape');

  // Verify both targets changed by selecting them and comparing end.x to boundary.
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(ext1B.x - 6, ext1B.y);
  await waitForTypesExact(['line']);
  const ext1AfterEndX = await readNumberInput('end.x');
  if (Math.abs(ext1AfterEndX - boundaryExtX) > 0.05) {
    throw new Error('Extend target1 did not reach boundary (dx=' + Math.abs(ext1AfterEndX - boundaryExtX) + ')');
  }
  await page.mouse.click(ext2B.x - 6, ext2B.y);
  await waitForTypesExact(['line']);
  const ext2AfterEndX = await readNumberInput('end.x');
  if (Math.abs(ext2AfterEndX - boundaryExtX) > 0.05) {
    throw new Error('Extend target2 did not reach boundary (dx=' + Math.abs(ext2AfterEndX - boundaryExtX) + ')');
  }

  // Undo/redo last extend should affect target2.
  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction((beforeX) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(beforeX) * 0.08);
    return Math.abs(v - beforeX) <= tol;
  }, ext2BeforeEndX, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction((afterX) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(afterX) * 0.08);
    return Math.abs(v - afterX) <= tol;
  }, ext2AfterEndX, { timeout: timeoutMs });

  results.extend_line = {
    boundaryX: boundaryExtX,
    target1: { beforeEndX: ext1BeforeEndX, afterEndX: ext1AfterEndX },
    target2: { beforeEndX: ext2BeforeEndX, afterEndX: ext2AfterEndX },
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  await blurActive();
  await page.keyboard.press('Escape');

  setStep('extend_continue_after_failure');
  // 11) Extend tool: after a NO_INTERSECTION failure, keep boundaries and allow next target to succeed (continuous)
  {
    await clearDoc();

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const id = s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
      return id;
    });
    const readLineEnds = async (entityId) => page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line') return null;
      const s = e.start;
      const t = e.end;
      if (!s || !t) return null;
      if (![s.x, s.y, t.x, t.y].every(Number.isFinite)) return null;
      return { startX: s.x, startY: s.y, endX: t.x, endY: t.y };
    }, entityId);

    // Boundary: vertical line near the middle.
    await page.click('[data-tool=\"line\"]');
    const efB1 = point(0.62, 0.22);
    const efB2 = point(0.62, 0.80);
    await page.mouse.click(efB1.x, efB1.y);
    await page.mouse.click(efB2.x, efB2.y);
    await waitForTypesExact(['line']);
    const efBoundaryId = await readPrimaryId();
    const efBoundary = await readLineEnds(efBoundaryId);
    if (!efBoundary) throw new Error('Extend(failure) failed to read boundary entity');
    const efBoundaryX = efBoundary.startX;

    // Target #1: vertical line parallel to boundary (no intersection). Extend should do nothing.
    await page.click('[data-tool=\"line\"]');
    const ef1A = point(0.80, 0.50);
    const ef1B = point(0.80, 0.68);
    const ef1Mid = { x: (ef1A.x + ef1B.x) * 0.5, y: (ef1A.y + ef1B.y) * 0.5 };
    await page.mouse.click(ef1A.x, ef1A.y);
    await page.mouse.click(ef1B.x, ef1B.y);
    await waitForTypesExact(['line']);
    const ef1Id = await readPrimaryId();
    const ef1Before = await readLineEnds(ef1Id);
    if (!ef1Before) throw new Error('Extend(failure) failed to read target1 entity');

    // Target #2: line ending before boundary. Extend should bring end.x to boundary.
    await page.click('[data-tool=\"line\"]');
    const ef2A = point(0.20, 0.66);
    const ef2B = point(0.48, 0.66);
    // For extend, pick near the endpoint you expect to extend (right end), not the midpoint.
    const ef2Pick = { x: ef2B.x - 2, y: ef2B.y };
    await page.mouse.click(ef2A.x, ef2A.y);
    await page.mouse.click(ef2B.x, ef2B.y);
    await waitForTypesExact(['line']);
    const ef2Id = await readPrimaryId();
    const ef2Before = await readLineEnds(ef2Id);
    if (!ef2Before) throw new Error('Extend(failure) failed to read target2 entity');

    await page.click('[data-tool=\"extend\"]');
    const efBoundaryPick = { x: efB1.x, y: (efB1.y + efB2.y) * 0.5 - 60 };
    await page.mouse.click(efBoundaryPick.x, efBoundaryPick.y);

    // Failure attempt (no intersection).
    await page.mouse.click(ef1Mid.x, ef1Mid.y);
    await page.waitForTimeout(60);

    // Success attempt without re-picking boundary.
    await page.mouse.click(ef2Pick.x, ef2Pick.y);
    await page.waitForTimeout(60);

    await blurActive();
    await page.keyboard.press('Escape');

    const ef1After = await readLineEnds(ef1Id);
    const ef2After = await readLineEnds(ef2Id);
    if (!ef1After || !ef2After) throw new Error('Extend(failure) failed to read targets after');

    // Target1 unchanged.
    if (
      Math.abs(ef1After.startX - ef1Before.startX) > 0.05 ||
      Math.abs(ef1After.startY - ef1Before.startY) > 0.05 ||
      Math.abs(ef1After.endX - ef1Before.endX) > 0.05 ||
      Math.abs(ef1After.endY - ef1Before.endY) > 0.05
    ) {
      throw new Error('Extend(no-intersection) unexpectedly changed target1');
    }

    // Target2 reaches boundary and changes.
    const ef2Dx = Math.abs(ef2After.endX - efBoundaryX);
    if (ef2Dx > 0.05) {
      throw new Error('Extend(after failure) did not reach boundary (dx=' + ef2Dx + ')');
    }
    if (Math.abs(ef2After.endX - ef2Before.endX) < 0.05 && Math.abs(ef2After.startX - ef2Before.startX) < 0.05) {
      throw new Error('Extend(after failure) did not change target2');
    }

    // Undo/redo last extend should affect only target2 (target1 was a no-op).
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(({ id, before }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line' || !e.start || !e.end) return false;
      const sx = e.start.x;
      const sy = e.start.y;
      const ex = e.end.x;
      const ey = e.end.y;
      if (![sx, sy, ex, ey].every(Number.isFinite)) return false;
      const tol = 0.08;
      return (
        Math.abs(sx - before.startX) <= tol &&
        Math.abs(sy - before.startY) <= tol &&
        Math.abs(ex - before.endX) <= tol &&
        Math.abs(ey - before.endY) <= tol
      );
    }, { id: ef2Id, before: ef2Before }, { timeout: timeoutMs });

    await page.keyboard.press('Control+Y');
    await page.waitForFunction(({ id, after }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line' || !e.start || !e.end) return false;
      const sx = e.start.x;
      const sy = e.start.y;
      const ex = e.end.x;
      const ey = e.end.y;
      if (![sx, sy, ex, ey].every(Number.isFinite)) return false;
      const tol = 0.08;
      return (
        Math.abs(sx - after.startX) <= tol &&
        Math.abs(sy - after.startY) <= tol &&
        Math.abs(ex - after.endX) <= tol &&
        Math.abs(ey - after.endY) <= tol
      );
    }, { id: ef2Id, after: ef2After }, { timeout: timeoutMs });

    results.extend_continue_after_failure = {
      boundaryX: efBoundaryX,
      ids: { boundary: efBoundaryId, target1: ef1Id, target2: ef2Id },
      target1: { before: ef1Before, after: ef1After },
      target2: { before: ef2Before, after: ef2After, dxToBoundary: ef2Dx },
      status: (await page.textContent('#cad-status-message')) || '',
    };
  }

  setStep('trim_polyline_split');
  // 11) Trim tool: split 2 polylines continuously with the same boundaries, validate split geometry via debug entities,
  // and validate undo/redo via debug state entityCount.
  {
    await clearDoc();

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

    const readEntity = async (id) => page.evaluate((entityId) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      return d.getEntity(entityId);
    }, id);

    const readSelectionIds = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getSelectionIds !== 'function') return [];
      const ids = d.getSelectionIds();
      return Array.isArray(ids) ? ids : [];
    });

    const segFromPolyline = (e) => {
      const pts = e && e.type === 'polyline' && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 2) return null;
      const a = pts[0];
      const b = pts[pts.length - 1];
      return {
        minX: Math.min(Number(a.x), Number(b.x)),
        maxX: Math.max(Number(a.x), Number(b.x)),
        y0: Number(a.y),
        y1: Number(b.y),
      };
    };

    const assertSplitMatchesBoundaries = ({ selIds, base, boundary }) => {
      if (!Array.isArray(selIds) || selIds.length !== 2) {
        throw new Error('Trim(polyline split) expected 2 selected polylines (ids=' + JSON.stringify(selIds) + ')');
      }
      const tolX = 0.15;
      const tolY = 0.15;
      const s0 = segFromPolyline(selIds[0]);
      const s1 = segFromPolyline(selIds[1]);
      if (!s0 || !s1) {
        throw new Error('Trim(polyline split) expected polyline entities for selection ids');
      }
      if (
        Math.abs(s0.y0 - base.y) > tolY ||
        Math.abs(s0.y1 - base.y) > tolY ||
        Math.abs(s1.y0 - base.y) > tolY ||
        Math.abs(s1.y1 - base.y) > tolY
      ) {
        throw new Error('Trim(polyline split) y drift after split (expected y~' + base.y + ')');
      }
      const left = s0.maxX < s1.maxX ? s0 : s1;
      const right = left === s0 ? s1 : s0;
      if (Math.abs(left.minX - base.minX) > tolX || Math.abs(left.maxX - boundary.x1) > tolX) {
        throw new Error('Trim(polyline split) left endpoints unexpected: ' + JSON.stringify(left));
      }
      if (Math.abs(right.minX - boundary.x2) > tolX || Math.abs(right.maxX - base.maxX) > tolX) {
        throw new Error('Trim(polyline split) right endpoints unexpected: ' + JSON.stringify(right));
      }
      return { left, right };
    };

    // Setup: two boundary lines crossing one open polyline segment.
    await page.click('[data-tool=\"line\"]');
    const tpB1A = point(0.40, 0.30);
    const tpB1B = point(0.40, 0.80);
    await page.mouse.click(tpB1A.x, tpB1A.y);
    await page.mouse.click(tpB1B.x, tpB1B.y);
    await waitForTypesExact(['line']);
    const tpB1x0 = await readNumberInput('start.x');
    const tpB1x1 = await readNumberInput('end.x');
    if (!Number.isFinite(tpB1x0) || !Number.isFinite(tpB1x1) || Math.abs(tpB1x0 - tpB1x1) > 1e-6) {
      throw new Error('Trim(polyline split) setup failed: expected vertical boundary #1');
    }
    const tpBoundaryX1 = tpB1x0;

    await page.click('[data-tool=\"line\"]');
    const tpB2A = point(0.60, 0.30);
    const tpB2B = point(0.60, 0.80);
    await page.mouse.click(tpB2A.x, tpB2A.y);
    await page.mouse.click(tpB2B.x, tpB2B.y);
    await waitForTypesExact(['line']);
    const tpB2x0 = await readNumberInput('start.x');
    const tpB2x1 = await readNumberInput('end.x');
    if (!Number.isFinite(tpB2x0) || !Number.isFinite(tpB2x1) || Math.abs(tpB2x0 - tpB2x1) > 1e-6) {
      throw new Error('Trim(polyline split) setup failed: expected vertical boundary #2');
    }
    const tpBoundaryX2 = tpB2x0;
    if (!(tpBoundaryX2 > tpBoundaryX1)) {
      throw new Error('Trim(polyline split) setup failed: expected boundaryX2 > boundaryX1');
    }

    // Two polylines to split (different y to avoid picking ambiguity).
    await page.click('[data-tool=\"polyline\"]');
    const tpP0 = point(0.22, 0.56);
    const tpP1 = point(0.78, 0.56);
    await page.mouse.click(tpP0.x, tpP0.y);
    await page.mouse.click(tpP1.x, tpP1.y);
    await page.mouse.click(tpP1.x, tpP1.y, { button: 'right' });
    await waitForTypesInclude('polyline');
    const tpPolyPId = await readPrimaryId();
    const tpPolyP = Number.isFinite(tpPolyPId) ? await readEntity(tpPolyPId) : null;
    const tpSegP = segFromPolyline(tpPolyP);
    if (!tpSegP || !Number.isFinite(tpSegP.minX) || !Number.isFinite(tpSegP.maxX)) {
      throw new Error('Trim(polyline split) setup failed: missing baseline geometry for polyline P');
    }
    const tpBaseP = { minX: tpSegP.minX, maxX: tpSegP.maxX, y: Number(tpSegP.y0) };
    if (![tpBaseP.minX, tpBaseP.maxX, tpBaseP.y].every(Number.isFinite)) {
      throw new Error('Trim(polyline split) setup failed: invalid baseline coords for polyline P');
    }

    await page.click('[data-tool=\"polyline\"]');
    const tpQ0 = point(0.22, 0.64);
    const tpQ1 = point(0.78, 0.64);
    await page.mouse.click(tpQ0.x, tpQ0.y);
    await page.mouse.click(tpQ1.x, tpQ1.y);
    await page.mouse.click(tpQ1.x, tpQ1.y, { button: 'right' });
    await waitForTypesInclude('polyline');
    const tpPolyQId = await readPrimaryId();
    const tpPolyQ = Number.isFinite(tpPolyQId) ? await readEntity(tpPolyQId) : null;
    const tpSegQ = segFromPolyline(tpPolyQ);
    if (!tpSegQ || !Number.isFinite(tpSegQ.minX) || !Number.isFinite(tpSegQ.maxX)) {
      throw new Error('Trim(polyline split) setup failed: missing baseline geometry for polyline Q');
    }
    const tpBaseQ = { minX: tpSegQ.minX, maxX: tpSegQ.maxX, y: Number(tpSegQ.y0) };
    if (![tpBaseQ.minX, tpBaseQ.maxX, tpBaseQ.y].every(Number.isFinite)) {
      throw new Error('Trim(polyline split) setup failed: invalid baseline coords for polyline Q');
    }

    const readSelectionCount = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return c;
    });

    await page.click('[data-tool=\"trim\"]');
    // Pick boundaries above the target segment to avoid ambiguity.
    const b1Pick = { x: tpB1A.x, y: tpB1A.y + 20 };
    const b2Pick = { x: tpB2A.x, y: tpB2A.y + 20 };
    await page.mouse.click(b1Pick.x, b1Pick.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b2Pick.x, b2Pick.y);
    await page.keyboard.up('Shift');

    // Pick between the two intersections so trim splits into 2 polylines.
    const targetPick = { x: point(0.50, 0.56).x, y: tpP0.y };
    await page.mouse.click(targetPick.x, targetPick.y);
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent : '';
      return t.startsWith('2 selected');
    }, null, { timeout: timeoutMs });
    await waitForTypesExact(['polyline', 'polyline']);
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return Number.isFinite(c) && c === 2;
    }, null, { timeout: timeoutMs });

    const split1Ids = await readSelectionIds();
    const split1Entities = [await readEntity(split1Ids[0]), await readEntity(split1Ids[1])];
    const split1 = assertSplitMatchesBoundaries({
      selIds: split1Entities,
      base: tpBaseP,
      boundary: { x1: tpBoundaryX1, x2: tpBoundaryX2 },
    });

    // Split the second polyline without re-picking boundaries (continuous).
    const targetPick2 = { x: point(0.50, 0.64).x, y: tpQ0.y };
    await page.mouse.click(targetPick2.x, targetPick2.y);
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent : '';
      return t.startsWith('2 selected');
    }, null, { timeout: timeoutMs });
    await waitForTypesExact(['polyline', 'polyline']);
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return Number.isFinite(c) && c === 2;
    }, null, { timeout: timeoutMs });

    const split2Ids = await readSelectionIds();
    const split2Entities = [await readEntity(split2Ids[0]), await readEntity(split2Ids[1])];
    const split2 = assertSplitMatchesBoundaries({
      selIds: split2Entities,
      base: tpBaseQ,
      boundary: { x1: tpBoundaryX1, x2: tpBoundaryX2 },
    });

    // Undo/redo last split should restore/split geometry (avoid relying on entityCount).
    const tolX = 0.15;
    const tolY = 0.15;
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(80);

    // After undo, selection may not be the restored polyline (it can fall back to the previous split selection),
    // so explicitly pick the Q row to validate geometry rollback.
    await page.click('[data-tool=\"select\"]');
    const qPick = { x: point(0.50, 0.64).x, y: tpQ0.y };
    await page.mouse.click(qPick.x, qPick.y);
    await waitForTypesInclude('polyline');
    const undoQId = await readPrimaryId();
    if (!Number.isFinite(undoQId)) throw new Error('Trim(polyline split) undo failed to read primaryId');
    const undoEntity = await readEntity(undoQId);
    const undoSeg = segFromPolyline(undoEntity);
    if (!undoSeg) throw new Error('Trim(polyline split) undo expected polyline entity');
    if (Math.abs(undoSeg.y0 - tpBaseQ.y) > tolY || Math.abs(undoSeg.y1 - tpBaseQ.y) > tolY) {
      throw new Error('Trim(polyline split) undo y drift (expected y~' + tpBaseQ.y + ')');
    }
    if (Math.abs(undoSeg.minX - tpBaseQ.minX) > tolX || Math.abs(undoSeg.maxX - tpBaseQ.maxX) > tolX) {
      throw new Error('Trim(polyline split) undo endpoints unexpected: ' + JSON.stringify(undoSeg));
    }

    await blurActive();
    await page.keyboard.press('Control+Y');
    await page.waitForTimeout(80);

    // After redo, box-select around the Q row to capture both split pieces and validate pinned endpoints.
    const qBox0 = point(0.20, 0.62);
    const qBox1 = point(0.80, 0.66);
    await page.mouse.move(qBox0.x, qBox0.y);
    await page.mouse.down();
    await page.mouse.move(qBox1.x, qBox1.y);
    await page.mouse.up();
    await waitForTypesExact(['polyline', 'polyline']);
    const redoIds = await readSelectionIds();
    const redoEntities = [await readEntity(redoIds[0]), await readEntity(redoIds[1])];
    const redo = assertSplitMatchesBoundaries({
      selIds: redoEntities,
      base: tpBaseQ,
      boundary: { x1: tpBoundaryX1, x2: tpBoundaryX2 },
    });

    results.trim_polyline_split = {
      geometry: {
        boundary: { x1: tpBoundaryX1, x2: tpBoundaryX2 },
        split1: { base: tpBaseP, left: split1.left, right: split1.right },
        split2: { base: tpBaseQ, left: split2.left, right: split2.right, undo: undoSeg, redo },
      },
      summary: (await page.textContent('#cad-selection-summary')) || '',
      status: (await page.textContent('#cad-status-message')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

  setStep('trim_polyline_continue_after_failure');
  // 11.5) Trim tool: after a NO_INTERSECTION failure on a polyline, keep boundaries and allow next target to split (with undo/redo)
  {
    await clearDoc();

    const readSelectionCount = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return c;
    });

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

    const readEntity = async (id) => page.evaluate((entityId) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      return d.getEntity(entityId);
    }, id);

    const readSelectionIds = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getSelectionIds !== 'function') return [];
      const ids = d.getSelectionIds();
      return Array.isArray(ids) ? ids : [];
    });

    // Boundaries: two vertical lines.
    await page.click('[data-tool=\"line\"]');
    const pb1A = point(0.40, 0.30);
    const pb1B = point(0.40, 0.80);
    await page.mouse.click(pb1A.x, pb1A.y);
    await page.mouse.click(pb1B.x, pb1B.y);
    await waitForTypesExact(['line']);
    const b1x0 = await readNumberInput('start.x');
    const b1x1 = await readNumberInput('end.x');
    if (!Number.isFinite(b1x0) || !Number.isFinite(b1x1) || Math.abs(b1x0 - b1x1) > 1e-6) {
      throw new Error('Trim(polyline failure) setup failed: expected vertical boundary #1');
    }
    const boundaryX1 = b1x0;

    await page.click('[data-tool=\"line\"]');
    const pb2A = point(0.60, 0.30);
    const pb2B = point(0.60, 0.80);
    await page.mouse.click(pb2A.x, pb2A.y);
    await page.mouse.click(pb2B.x, pb2B.y);
    await waitForTypesExact(['line']);
    const b2x0 = await readNumberInput('start.x');
    const b2x1 = await readNumberInput('end.x');
    if (!Number.isFinite(b2x0) || !Number.isFinite(b2x1) || Math.abs(b2x0 - b2x1) > 1e-6) {
      throw new Error('Trim(polyline failure) setup failed: expected vertical boundary #2');
    }
    const boundaryX2 = b2x0;
    if (!(boundaryX2 > boundaryX1)) {
      throw new Error('Trim(polyline failure) setup failed: expected boundaryX2 > boundaryX1');
    }

    // Failure target: polyline above boundaries (no intersection).
    await page.click('[data-tool=\"polyline\"]');
    const pf0 = point(0.22, 0.24);
    const pf1 = point(0.78, 0.24);
    await page.mouse.click(pf0.x, pf0.y);
    await page.mouse.click(pf1.x, pf1.y);
    await page.mouse.click(pf1.x, pf1.y, { button: 'right' });
    await waitForTypesInclude('polyline');

    // Success target: polyline across boundaries (will split).
    await page.click('[data-tool=\"polyline\"]');
    const ps0 = point(0.22, 0.56);
    const ps1 = point(0.78, 0.56);
    await page.mouse.click(ps0.x, ps0.y);
    await page.mouse.click(ps1.x, ps1.y);
    await page.mouse.click(ps1.x, ps1.y, { button: 'right' });
    await waitForTypesInclude('polyline');
    const successId = await readPrimaryId();
    if (!Number.isFinite(successId)) {
      throw new Error('Trim(polyline failure) setup failed: missing success polyline primaryId');
    }
    const successEntity = await readEntity(successId);
    const successPts = successEntity && Array.isArray(successEntity.points) ? successEntity.points : null;
    if (!successPts || successPts.length < 2) {
      throw new Error('Trim(polyline failure) setup failed: expected success polyline points');
    }
    const baseY = Number(successPts[0].y);
    const baseMinX = Math.min(Number(successPts[0].x), Number(successPts[successPts.length - 1].x));
    const baseMaxX = Math.max(Number(successPts[0].x), Number(successPts[successPts.length - 1].x));
    if (![baseY, baseMinX, baseMaxX].every(Number.isFinite)) {
      throw new Error('Trim(polyline failure) setup failed: baseline polyline coords invalid');
    }

    await page.click('[data-tool=\"trim\"]');
    const b1Pick = { x: pb1A.x, y: pb1A.y + 20 };
    const b2Pick = { x: pb2A.x, y: pb2A.y + 20 };
    await page.mouse.click(b1Pick.x, b1Pick.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b2Pick.x, b2Pick.y);
    await page.keyboard.up('Shift');

    // Failure attempt: click the failure polyline (no intersection).
    const failPick = { x: point(0.50, 0.22).x, y: pf0.y };
    await page.mouse.click(failPick.x, failPick.y);
    await page.waitForTimeout(60);

    // Success attempt: click between boundaries to split.
    const okPick = { x: point(0.50, 0.56).x, y: ps0.y };
    await page.mouse.click(okPick.x, okPick.y);
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return Number.isFinite(c) && c === 2;
    }, null, { timeout: timeoutMs });
    await waitForTypesExact(['polyline', 'polyline']);

    // Geometry assert: two polylines remain, with endpoints pinned to original endpoints and boundary intersections.
    const selIds = await readSelectionIds();
    if (!Array.isArray(selIds) || selIds.length !== 2) {
      throw new Error('Trim(polyline failure) expected 2 selected polylines (ids=' + JSON.stringify(selIds) + ')');
    }
    const e0 = await readEntity(selIds[0]);
    const e1 = await readEntity(selIds[1]);
    const toSeg = (e) => {
      const pts = e && e.type === 'polyline' && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 2) return null;
      const a = pts[0];
      const b = pts[pts.length - 1];
      return {
        minX: Math.min(Number(a.x), Number(b.x)),
        maxX: Math.max(Number(a.x), Number(b.x)),
        y0: Number(a.y),
        y1: Number(b.y),
      };
    };
    const s0 = toSeg(e0);
    const s1 = toSeg(e1);
    if (!s0 || !s1) {
      throw new Error('Trim(polyline failure) expected polyline entities for selection ids');
    }
    const tolX = 0.15;
    const tolY = 0.15;
    if (Math.abs(s0.y0 - baseY) > tolY || Math.abs(s0.y1 - baseY) > tolY || Math.abs(s1.y0 - baseY) > tolY || Math.abs(s1.y1 - baseY) > tolY) {
      throw new Error('Trim(polyline failure) y drift after split (expected y~' + baseY + ')');
    }
    const left = s0.maxX < s1.maxX ? s0 : s1;
    const right = left === s0 ? s1 : s0;
    if (Math.abs(left.minX - baseMinX) > tolX || Math.abs(left.maxX - boundaryX1) > tolX) {
      throw new Error('Trim(polyline failure) left segment endpoints unexpected: ' + JSON.stringify(left));
    }
    if (Math.abs(right.minX - boundaryX2) > tolX || Math.abs(right.maxX - baseMaxX) > tolX) {
      throw new Error('Trim(polyline failure) right segment endpoints unexpected: ' + JSON.stringify(right));
    }

    // Undo/redo last split should restore/split geometry (avoid relying on entityCount).
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return Number.isFinite(c) && c === 1;
    }, null, { timeout: timeoutMs });
    await waitForTypesExact(['polyline']);
    const undoIds = await readSelectionIds();
    if (!Array.isArray(undoIds) || undoIds.length !== 1) {
      throw new Error('Trim(polyline failure) undo expected 1 selected polyline (ids=' + JSON.stringify(undoIds) + ')');
    }
    const undoEntity = await readEntity(undoIds[0]);
    const undoSeg = toSeg(undoEntity);
    if (!undoSeg) throw new Error('Trim(polyline failure) undo expected polyline entity');
    if (Math.abs(undoSeg.y0 - baseY) > tolY || Math.abs(undoSeg.y1 - baseY) > tolY) {
      throw new Error('Trim(polyline failure) undo y drift (expected y~' + baseY + ')');
    }
    if (Math.abs(undoSeg.minX - baseMinX) > tolX || Math.abs(undoSeg.maxX - baseMaxX) > tolX) {
      throw new Error('Trim(polyline failure) undo endpoints unexpected: ' + JSON.stringify(undoSeg));
    }

    await page.keyboard.press('Control+Y');
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const c = s && Number.isFinite(s.selectionCount) ? s.selectionCount : NaN;
      return Number.isFinite(c) && c === 2;
    }, null, { timeout: timeoutMs });
    await waitForTypesExact(['polyline', 'polyline']);
    const redoIds = await readSelectionIds();
    if (!Array.isArray(redoIds) || redoIds.length !== 2) {
      throw new Error('Trim(polyline failure) redo expected 2 selected polylines (ids=' + JSON.stringify(redoIds) + ')');
    }
    const re0 = await readEntity(redoIds[0]);
    const re1 = await readEntity(redoIds[1]);
    const rs0 = toSeg(re0);
    const rs1 = toSeg(re1);
    if (!rs0 || !rs1) throw new Error('Trim(polyline failure) redo expected polyline entities');
    const redoLeft = rs0.maxX < rs1.maxX ? rs0 : rs1;
    const redoRight = redoLeft === rs0 ? rs1 : rs0;
    if (Math.abs(redoLeft.minX - baseMinX) > tolX || Math.abs(redoLeft.maxX - boundaryX1) > tolX) {
      throw new Error('Trim(polyline failure) redo left endpoints unexpected: ' + JSON.stringify(redoLeft));
    }
    if (Math.abs(redoRight.minX - boundaryX2) > tolX || Math.abs(redoRight.maxX - baseMaxX) > tolX) {
      throw new Error('Trim(polyline failure) redo right endpoints unexpected: ' + JSON.stringify(redoRight));
    }

    results.trim_polyline_continue_after_failure = {
      geometry: {
        base: { minX: baseMinX, maxX: baseMaxX, y: baseY },
        boundary: { x1: boundaryX1, x2: boundaryX2 },
        left,
        right,
        undo: undoSeg,
        redo: { left: redoLeft, right: redoRight },
      },
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

  setStep('extend_polyline_endpoint');
  // 12) Extend tool: extend 2 polyline endpoints to boundary (continuous), verify via debug entity geometry + undo/redo last
  {
    await clearDoc();

    const snapTogglePoly = page.locator('#cad-toggle-snap');
    const snapLabelPoly = ((await snapTogglePoly.textContent()) || '').toLowerCase();
    if (snapLabelPoly.includes('on')) {
      await snapTogglePoly.click();
    }

    // Boundary: vertical line on the right.
    await page.click('[data-tool=\"line\"]');
    const epB1 = point(0.70, 0.26);
    const epB2 = point(0.70, 0.82);
    await page.mouse.click(epB1.x, epB1.y);
    await page.mouse.click(epB2.x, epB2.y);
    await waitForTypesExact(['line']);
    const boundaryX = await readNumberInput('start.x');
    const boundaryX2 = await readNumberInput('end.x');
    if (!Number.isFinite(boundaryX) || !Number.isFinite(boundaryX2) || Math.abs(boundaryX - boundaryX2) > 1e-6) {
      throw new Error('Extend(polyline) setup failed: expected vertical boundary line');
    }

    // Targets: two short open polylines ending left of the boundary.
    await page.click('[data-tool=\"polyline\"]');
    const epP0 = point(0.22, 0.58);
    const epP1 = point(0.52, 0.58);
    await page.mouse.click(epP0.x, epP0.y);
    await page.mouse.click(epP1.x, epP1.y);
    await page.mouse.click(epP1.x, epP1.y, { button: 'right' });
    await waitForTypesInclude('polyline');

    await page.click('[data-tool=\"polyline\"]');
    const epQ0 = point(0.22, 0.68);
    const epQ1 = point(0.48, 0.68);
    await page.mouse.click(epQ0.x, epQ0.y);
    await page.mouse.click(epQ1.x, epQ1.y);
    await page.mouse.click(epQ1.x, epQ1.y, { button: 'right' });
    await waitForTypesInclude('polyline');

    const selectPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

    const readPolylineEndX = async (entityId) => page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return NaN;
      const e = d.getEntity(id);
      const pts = e && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 1) return NaN;
      const last = pts[pts.length - 1];
      return last && Number.isFinite(last.x) ? last.x : NaN;
    }, entityId);

    // Capture ids + baseline endpoint x before extending.
    await page.click('[data-tool=\"select\"]');
    await page.mouse.click(epP1.x - 10, epP1.y);
    await waitForTypesInclude('polyline');
    const poly1Id = await selectPrimaryId();
    if (!Number.isFinite(poly1Id)) throw new Error('Extend(polyline): failed to read primaryId for poly1');
    const poly1BeforeX = await readPolylineEndX(poly1Id);

    await page.mouse.click(epQ1.x - 10, epQ1.y);
    await waitForTypesInclude('polyline');
    const poly2Id = await selectPrimaryId();
    if (!Number.isFinite(poly2Id)) throw new Error('Extend(polyline): failed to read primaryId for poly2');
    const poly2BeforeX = await readPolylineEndX(poly2Id);
    if (![poly1BeforeX, poly2BeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline): failed to read polyline endpoint x before extend');
    }

    // Apply extend: pick boundary, then pick two targets near their endpoints (continuous).
    await page.click('[data-tool=\"extend\"]');
    const boundaryPick = { x: epB1.x, y: (epB1.y + epB2.y) * 0.5 };
    await page.mouse.click(boundaryPick.x, boundaryPick.y);
    await page.mouse.click(epP1.x, epP1.y);
    await page.mouse.click(epQ1.x, epQ1.y);

    // Verify: both endpoints now land on the boundary x.
    await page.click('[data-tool=\"select\"]');
    await page.mouse.click(epP1.x - 10, epP1.y);
    await waitForTypesInclude('polyline');
    const poly1AfterX = await readPolylineEndX(poly1Id);
    await page.mouse.click(epQ1.x - 10, epQ1.y);
    await waitForTypesInclude('polyline');
    const poly2AfterX = await readPolylineEndX(poly2Id);
    if (Math.abs(poly1AfterX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline)#1 did not reach boundary (dx=' + Math.abs(poly1AfterX - boundaryX) + ')');
    }
    if (Math.abs(poly2AfterX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline)#2 did not reach boundary (dx=' + Math.abs(poly2AfterX - boundaryX) + ')');
    }

    // Undo/redo last extend should affect only poly2 endpoint.
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction((expected) => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) && s.primaryId === expected;
    }, poly2Id, { timeout: timeoutMs }).catch(() => {});
    // Ensure poly2 is selected for reading.
    await page.click('[data-tool=\"select\"]');
    await page.mouse.click(epQ1.x - 10, epQ1.y);
    await waitForTypesInclude('polyline');
    const poly2UndoX = await readPolylineEndX(poly2Id);
    if (Math.abs(poly2UndoX - poly2BeforeX) > 0.1) {
      throw new Error('Extend(polyline) undo did not restore poly2 endpoint');
    }

    // Poly1 should remain extended.
    await page.mouse.click(epP1.x - 10, epP1.y);
    await waitForTypesInclude('polyline');
    const poly1StillX = await readPolylineEndX(poly1Id);
    if (Math.abs(poly1StillX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline) undo unexpectedly reverted poly1');
    }

    await blurActive();
    await page.keyboard.press('Control+Y');
    await page.mouse.click(epQ1.x - 10, epQ1.y);
    await waitForTypesInclude('polyline');
    const poly2RedoX = await readPolylineEndX(poly2Id);
    if (Math.abs(poly2RedoX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline) redo did not re-apply poly2 extend');
    }

    results.extend_polyline_endpoint = {
      boundaryX,
      poly1: { id: poly1Id, beforeX: poly1BeforeX, afterX: poly1AfterX },
      poly2: { id: poly2Id, beforeX: poly2BeforeX, afterX: poly2AfterX, undoX: poly2UndoX, redoX: poly2RedoX },
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

  setStep('extend_polyline_continue_after_failure');
  // 12.5) Extend tool: after a NO_INTERSECTION failure on a polyline, keep boundary and allow next target to succeed (with undo/redo)
  {
    await clearDoc();

    const snapTogglePoly = page.locator('#cad-toggle-snap');
    const snapLabelPoly = ((await snapTogglePoly.textContent()) || '').toLowerCase();
    if (snapLabelPoly.includes('on')) {
      await snapTogglePoly.click();
    }

    const selectPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

    const readPolylineEndX = async (entityId) => page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return NaN;
      const e = d.getEntity(id);
      const pts = e && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 1) return NaN;
      const last = pts[pts.length - 1];
      return last && Number.isFinite(last.x) ? last.x : NaN;
    }, entityId);

    // Boundary: vertical line on the right.
    await page.click('[data-tool=\"line\"]');
    const eppB1 = point(0.70, 0.26);
    const eppB2 = point(0.70, 0.82);
    await page.mouse.click(eppB1.x, eppB1.y);
    await page.mouse.click(eppB2.x, eppB2.y);
    await waitForTypesExact(['line']);
    const boundaryX = await readNumberInput('start.x');
    const boundaryX2 = await readNumberInput('end.x');
    if (!Number.isFinite(boundaryX) || !Number.isFinite(boundaryX2) || Math.abs(boundaryX - boundaryX2) > 1e-6) {
      throw new Error('Extend(polyline failure) setup failed: expected vertical boundary line');
    }

    // Failure target: vertical polyline far to the right, parallel to boundary => no intersection.
    await page.click('[data-tool=\"polyline\"]');
    const failA = point(0.86, 0.46);
    const failB = point(0.86, 0.62);
    await page.mouse.click(failA.x, failA.y);
    await page.mouse.click(failB.x, failB.y);
    await page.mouse.click(failB.x, failB.y, { button: 'right' });
    await waitForTypesInclude('polyline');
    await page.click('[data-tool=\"select\"]');
    await page.mouse.click(failB.x - 6, failB.y);
    await waitForTypesInclude('polyline');
    const failId = await selectPrimaryId();
    if (!Number.isFinite(failId)) throw new Error('Extend(polyline failure): failed to read primaryId for fail polyline');
    const failBeforeX = await readPolylineEndX(failId);

    // Success target: open polyline ending left of boundary.
    await page.click('[data-tool=\"polyline\"]');
    const okA = point(0.22, 0.70);
    const okB = point(0.48, 0.70);
    await page.mouse.click(okA.x, okA.y);
    await page.mouse.click(okB.x, okB.y);
    await page.mouse.click(okB.x, okB.y, { button: 'right' });
    await waitForTypesInclude('polyline');
    await page.click('[data-tool=\"select\"]');
    await page.mouse.click(okB.x - 6, okB.y);
    await waitForTypesInclude('polyline');
    const okId = await selectPrimaryId();
    if (!Number.isFinite(okId)) throw new Error('Extend(polyline failure): failed to read primaryId for ok polyline');
    const okBeforeX = await readPolylineEndX(okId);
    if (![failBeforeX, okBeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline failure): failed to read endpoint x before extend');
    }

    // Extend: pick boundary, click fail target (no intersection), then click ok target without re-picking boundary.
    await page.click('[data-tool=\"extend\"]');
    const boundaryPick = { x: eppB1.x, y: (eppB1.y + eppB2.y) * 0.5 };
    await page.mouse.click(boundaryPick.x, boundaryPick.y);
    await page.mouse.click(failB.x - 2, failB.y);
    await page.waitForTimeout(60);
    await page.mouse.click(okB.x - 2, okB.y);
    await page.waitForTimeout(60);

    // Verify ok extended and fail unchanged (via debug entity geometry, not selection UI).
    const okAfterX = await readPolylineEndX(okId);
    const failAfterX = await readPolylineEndX(failId);
    if (Math.abs(okAfterX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline failure) did not reach boundary (dx=' + Math.abs(okAfterX - boundaryX) + ')');
    }
    if (Math.abs(failAfterX - failBeforeX) > 0.05) {
      throw new Error('Extend(polyline failure) unexpectedly changed fail polyline');
    }

    // Undo/redo last extend should affect ok polyline only.
    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(({ id, beforeX }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      const pts = e && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 1) return false;
      const last = pts[pts.length - 1];
      const x = last ? last.x : NaN;
      if (!Number.isFinite(x)) return false;
      return Math.abs(x - beforeX) <= 0.08;
    }, { id: okId, beforeX: okBeforeX }, { timeout: timeoutMs });
    const failUndoX = await readPolylineEndX(failId);
    if (Math.abs(failUndoX - failBeforeX) > 0.05) {
      throw new Error('Extend(polyline failure) undo unexpectedly changed fail polyline');
    }

    await page.keyboard.press('Control+Y');
    await page.waitForFunction(({ id, afterX }) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return false;
      const e = d.getEntity(id);
      const pts = e && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 1) return false;
      const last = pts[pts.length - 1];
      const x = last ? last.x : NaN;
      if (!Number.isFinite(x)) return false;
      return Math.abs(x - afterX) <= 0.08;
    }, { id: okId, afterX: okAfterX }, { timeout: timeoutMs });

    results.extend_polyline_continue_after_failure = {
      boundaryX,
      fail: { id: failId, beforeX: failBeforeX, afterX: failAfterX },
      ok: { id: okId, beforeX: okBeforeX, afterX: okAfterX },
      status: (await page.textContent('#cad-status-message')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

  setStep('grip_hover_vs_snap');
  // 13) Select tool: grip hover highlight should coexist with snap hint (overlay-level invariant via ?debug=1 hook)
  {
    await clearDoc();

    // Ensure snap ON and enable Endpoint only.
    const snapBtn2 = page.locator('#cad-toggle-snap');
    const snapLabel2 = ((await snapBtn2.textContent()) || '').toLowerCase();
    if (snapLabel2.includes('off')) {
      await snapBtn2.click();
    }
    await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
    const endOpt = page.locator('#cad-snap-form label:has-text(\"Endpoint\") input[type=checkbox]');
    const midOpt = page.locator('#cad-snap-form label:has-text(\"Midpoint\") input[type=checkbox]');
    const cenOpt = page.locator('#cad-snap-form label:has-text(\"Center\") input[type=checkbox]');
    const intOpt = page.locator('#cad-snap-form label:has-text(\"Intersection\") input[type=checkbox]');
    const quaOpt = page.locator('#cad-snap-form label:has-text(\"Quadrant\") input[type=checkbox]');
    const tanOpt = page.locator('#cad-snap-form label:has-text(\"Tangent\") input[type=checkbox]');
    const neaOpt = page.locator('#cad-snap-form label:has-text(\"Nearest\") input[type=checkbox]');
    const gridOpt2 = page.locator('#cad-snap-form label:has-text(\"Grid\") input[type=checkbox]');
    await endOpt.check();
    if (await midOpt.isChecked()) await midOpt.uncheck();
    if (await cenOpt.isChecked()) await cenOpt.uncheck();
    if (await intOpt.isChecked()) await intOpt.uncheck();
    if (await quaOpt.isChecked()) await quaOpt.uncheck();
    if (await tanOpt.isChecked()) await tanOpt.uncheck();
    if (await neaOpt.isChecked()) await neaOpt.uncheck();
    if (await gridOpt2.isChecked()) await gridOpt2.uncheck();

    await page.click('[data-tool=\"line\"]');
    const ghA = point(0.28, 0.42);
    const ghB = point(0.62, 0.42);
    await page.mouse.click(ghA.x, ghA.y);
    await page.mouse.click(ghB.x, ghB.y);
    await waitForTypesExact(['line']);

    // Select tool activates grips.
    await page.click('[data-tool=\"select\"]');

    // Hover near the start grip. This should set gripHover overlay.
    const nearGrip = { x: ghA.x + 2, y: ghA.y + 2 };
    await page.mouse.move(nearGrip.x, nearGrip.y);
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getOverlays !== 'function') return false;
      const o = d.getOverlays();
      return !!(o && o.gripHover);
    }, null, { timeout: timeoutMs });

    // Moving near the same endpoint should also produce snapHint (END) while gripHover remains.
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const o = d && typeof d.getOverlays === 'function' ? d.getOverlays() : null;
      return !!(o && o.gripHover && o.snapHint && o.snapHint.kind === 'END');
    }, null, { timeout: timeoutMs });

    // Small jitter should not clear gripHover due to hysteresis.
    await page.mouse.move(nearGrip.x + 1.5, nearGrip.y + 1.0);
    await page.waitForTimeout(20);
    await page.waitForFunction(() => {
      const d = window.__cadDebug;
      const o = d && typeof d.getOverlays === 'function' ? d.getOverlays() : null;
      return !!(o && o.gripHover);
    }, null, { timeout: timeoutMs });

    results.grip_hover_vs_snap = { ok: true };
  }

  setStep('layer_lock_grip');
  // 14) Layer lock: grips must be blocked when locked, and work when unlocked
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const lockA = point(0.22, 0.42);
  const lockB = point(0.52, 0.42);
  await page.mouse.click(lockA.x, lockA.y);
  await page.mouse.click(lockB.x, lockB.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"select\"]');
  const lockBefore = {
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (![lockBefore.endX, lockBefore.endY].every(Number.isFinite)) {
    throw new Error('Layer lock: failed to read end.x/end.y before drag');
  }

  // Lock layer 0.
  await page.click('#cad-layer-list .cad-layer-item:has-text(\"0:0\") button:has-text(\"Unlocked\")');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btns = el.querySelectorAll('button');
    if (btns.length < 2) return false;
    return String(btns[1].textContent || '').toLowerCase().includes('locked');
  }, null, { timeout: timeoutMs });

  // While locked, attempting to edit properties must not change geometry.
  const lockAttemptX = lockBefore.endX + 10;
  await page.fill('#cad-property-form input[name=\"end.x\"]', String(lockAttemptX));
  await blurActive(); // triggers selection.propertyPatch

  // Re-select to force the property panel to re-render from document state.
  await page.keyboard.press('Control+A');
  await waitForTypesExact(['line']);

  const lockStatusAfterBlockedEdit = (await page.textContent('#cad-status-message')) || '';
  const lockAfterBlocked = {
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (![lockAfterBlocked.endX, lockAfterBlocked.endY].every(Number.isFinite)) {
    throw new Error('Layer lock: failed to read end.x/end.y after blocked edit');
  }
  if (Math.abs(lockAfterBlocked.endX - lockBefore.endX) > 1e-6 || Math.abs(lockAfterBlocked.endY - lockBefore.endY) > 1e-6) {
    throw new Error('Layer lock failed: end point changed while locked');
  }

  // Unlock layer 0.
  await page.click('#cad-layer-list .cad-layer-item:has-text(\"0:0\") button:has-text(\"Locked\")');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btns = el.querySelectorAll('button');
    if (btns.length < 2) return false;
    return String(btns[1].textContent || '').toLowerCase().includes('unlocked');
  }, null, { timeout: timeoutMs });

  // Ensure the line is selected before applying an edit.
  await blurActive();
  await page.keyboard.press('Control+A');
  await waitForTypesExact(['line']);

  const lockAfterX = lockBefore.endX + 10;
  await page.fill('#cad-property-form input[name=\"end.x\"]', String(lockAfterX));
  await blurActive();

  await page.waitForFunction((beforeX) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    return Number.isFinite(v) && Math.abs(v - beforeX) > 0.5;
  }, lockBefore.endX, { timeout: timeoutMs });

  const lockAfter = {
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction((beforeX) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(beforeX) * 0.08);
    return Math.abs(v - beforeX) <= tol;
  }, lockBefore.endX, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction((afterX) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    const tol = Math.max(0.05, Math.abs(afterX) * 0.08);
    return Math.abs(v - afterX) <= tol;
  }, lockAfter.endX, { timeout: timeoutMs });

  results.layer_lock_grip = {
    before: lockBefore,
    after: lockAfter,
    blockedAttempt: {
      attemptedEndX: lockAttemptX,
      after: lockAfterBlocked,
      status: lockStatusAfterBlockedEdit,
    },
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('toggles_and_snap');
  // 14) Toggle wiring + snap hit assertion (endpoint)
  await clearDoc();

  const gridBtn = page.locator('#cad-toggle-grid');
  const orthoBtn = page.locator('#cad-toggle-ortho');
  const snapBtn = page.locator('#cad-toggle-snap');

  const gridBefore = (await gridBtn.textContent()) || '';
  await gridBtn.click();
  const gridAfter = (await gridBtn.textContent()) || '';
  if (gridAfter === gridBefore) {
    throw new Error('Grid toggle did not change');
  }
  // Restore grid off for deterministic snapping/ortho checks.
  if (String(gridAfter).toLowerCase().includes('on')) {
    await gridBtn.click();
  }

  // Ortho constraint: endY must match startY when dx >= dy.
  const orthoLabelBefore = (await orthoBtn.textContent()) || '';
  if (!orthoLabelBefore.toLowerCase().includes('on')) {
    await orthoBtn.click();
  }
  await page.click('[data-tool=\"line\"]');
  const oA = point(0.25, 0.25);
  const oB = point(0.62, 0.30);
  await page.mouse.click(oA.x, oA.y);
  await page.mouse.click(oB.x, oB.y);
  await waitForTypesExact(['line']);
  const orthoStartY = await readNumberInput('start.y');
  const orthoEndY = await readNumberInput('end.y');
  if (!Number.isFinite(orthoStartY) || !Number.isFinite(orthoEndY) || Math.abs(orthoStartY - orthoEndY) > 1e-6) {
    throw new Error('Ortho failed: expected horizontal line (end.y==start.y)');
  }
  // Turn ortho back off for snap test.
  const orthoLabelAfter = (await orthoBtn.textContent()) || '';
  if (orthoLabelAfter.toLowerCase().includes('on')) {
    await orthoBtn.click();
  }

  // Ensure snap is on.
  const snapLabelBefore = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelBefore.includes('off')) {
    await snapBtn.click();
  }

  // Endpoint snap: line2 start must snap to line1 end even if click is offset within snap radius.
  await clearDoc();
  await page.click('[data-tool=\"line\"]');
  const s1 = point(0.30, 0.40);
  const s2 = point(0.58, 0.52);
  await page.mouse.click(s1.x, s1.y);
  await page.mouse.click(s2.x, s2.y);
  await waitForTypesExact(['line']);
  const refEnd = { x: await readNumberInput('end.x'), y: await readNumberInput('end.y') };

  await page.click('[data-tool=\"line\"]');
  const near = { x: s2.x + 4, y: s2.y + 3 };
  const s3 = point(0.78, 0.64);
  await page.mouse.click(near.x, near.y);
  // Avoid pathological cases where the 2nd click snaps back to the start point and blocks line creation.
  const snapLabelMid = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelMid.includes('on')) {
    await snapBtn.click();
  }
  await page.mouse.click(s3.x, s3.y);
  await waitForTypesExact(['line']);
  const line2Start = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const snapDx = Math.abs(line2Start.x - refEnd.x);
  const snapDy = Math.abs(line2Start.y - refEnd.y);
  if (snapDx > 1e-6 || snapDy > 1e-6) {
    throw new Error('Endpoint snap failed: start != ref end (dx=' + snapDx + ' dy=' + snapDy + ')');
  }

  results.toggles_and_snap = {
    gridBefore,
    gridAfter,
    orthoStartY,
    orthoEndY,
    refEnd,
    line2Start,
    status: (await page.textContent('#cad-status-message')) || '',
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('move_line');
  // 15) Move tool: base point + target point + undo/redo (assert rigid translation by geometry)
  await clearDoc();

  // Keep snap off so the delta is deterministic in world space.
  const moveSnapLabel = ((await snapBtn.textContent()) || '').toLowerCase();
  if (moveSnapLabel.includes('on')) {
    await snapBtn.click();
  }

  await page.click('[data-tool=\"line\"]');
  const mvA = point(0.28, 0.32);
  const mvB = point(0.50, 0.36);
  await page.mouse.click(mvA.x, mvA.y);
  await page.mouse.click(mvB.x, mvB.y);
  await waitForTypesExact(['line']);

  const moveBefore = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (![moveBefore.startX, moveBefore.startY, moveBefore.endX, moveBefore.endY].every(Number.isFinite)) {
    throw new Error('Move(line) failed to read start/end inputs');
  }
  const moveBeforeState = await readDebugState();
  const moveEntityId = moveBeforeState && Number.isFinite(moveBeforeState.primaryId)
    ? Number(moveBeforeState.primaryId)
    : NaN;
  const moveBeforeEntity = Number.isFinite(moveEntityId) ? await readEntityById(moveEntityId) : null;
  if (!moveBeforeState || moveBeforeState.entityCount !== 1 || !moveBeforeEntity || moveBeforeEntity.type !== 'line') {
    throw new Error('Move(line) failed to capture pre-move geometry');
  }

  await page.click('[data-tool=\"move\"]');
  const mvBase = { x: (mvA.x + mvB.x) * 0.5, y: (mvA.y + mvB.y) * 0.5 };
  const mvTarget = { x: mvBase.x + 120, y: mvBase.y + 60 };
  await page.mouse.click(mvBase.x, mvBase.y);
  await page.mouse.click(mvTarget.x, mvTarget.y);

  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent : '';
    return t.includes('Move applied');
  }, null, { timeout: timeoutMs });

  const moveStatus = (await page.textContent('#cad-status-message')) || '';

  const moveAfter = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  const moveAfterState = await readDebugState();
  const moveAfterEntity = Number.isFinite(moveEntityId) ? await readEntityById(moveEntityId) : null;
  if (!moveAfterState || moveAfterState.entityCount !== 1 || !moveAfterEntity || moveAfterEntity.type !== 'line') {
    throw new Error('Move(line) failed to capture post-move geometry');
  }

  const moveLineLength = (line) => Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
  const mvBeforeLen = moveLineLength(moveBeforeEntity);
  const mvAfterLen = moveLineLength(moveAfterEntity);
  if (!Number.isFinite(mvBeforeLen) || !Number.isFinite(mvAfterLen) || mvBeforeLen <= 1e-6 || mvAfterLen <= 1e-6) {
    throw new Error('Move(line) invalid geometry length');
  }
  const moveLenTol = Math.max(0.05, mvBeforeLen * 0.02);
  if (Math.abs(mvAfterLen - mvBeforeLen) > moveLenTol) {
    throw new Error('Move(line) changed length unexpectedly');
  }
  const mvDxStart = moveAfterEntity.start.x - moveBeforeEntity.start.x;
  const mvDyStart = moveAfterEntity.start.y - moveBeforeEntity.start.y;
  const mvDxEnd = moveAfterEntity.end.x - moveBeforeEntity.end.x;
  const mvDyEnd = moveAfterEntity.end.y - moveBeforeEntity.end.y;
  const deltaTol = 0.25;
  if (Math.abs(mvDxStart - mvDxEnd) > deltaTol || Math.abs(mvDyStart - mvDyEnd) > deltaTol) {
    throw new Error('Move(line) is not a rigid translation');
  }
  if (Math.hypot(mvDxStart, mvDyStart) <= 0.5) {
    throw new Error('Move(line) delta too small (likely no-op)');
  }

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction(({ id, before }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return false;
    const e = d.getEntity(id);
    if (!e || e.type !== 'line') return false;
    const tol = 0.25;
    return (
      Math.abs(e.start.x - before.startX) <= tol &&
      Math.abs(e.start.y - before.startY) <= tol &&
      Math.abs(e.end.x - before.endX) <= tol &&
      Math.abs(e.end.y - before.endY) <= tol
    );
  }, { id: moveEntityId, before: moveBefore }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ id, after }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return false;
    const e = d.getEntity(id);
    if (!e || e.type !== 'line') return false;
    const tol = 0.25;
    return (
      Math.abs(e.start.x - after.startX) <= tol &&
      Math.abs(e.start.y - after.startY) <= tol &&
      Math.abs(e.end.x - after.endX) <= tol &&
      Math.abs(e.end.y - after.endY) <= tol
    );
  }, { id: moveEntityId, after: moveAfter }, { timeout: timeoutMs });

  results.move_line = {
    before: moveBefore,
    after: moveAfter,
    geometry: {
      id: moveEntityId,
      before: moveBeforeEntity,
      after: moveAfterEntity,
      delta: { dx: mvDxStart, dy: mvDyStart },
    },
    status: moveStatus,
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('copy_line');
  // 16) Copy tool: base point + target point + undo/redo (assert topology + copied geometry)
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const cpA = point(0.26, 0.50);
  const cpB = point(0.48, 0.55);
  await page.mouse.click(cpA.x, cpA.y);
  await page.mouse.click(cpB.x, cpB.y);
  await waitForTypesExact(['line']);
  const copyBeforeState = await readDebugState();
  const copyOriginalId = copyBeforeState && Number.isFinite(copyBeforeState.primaryId)
    ? Number(copyBeforeState.primaryId)
    : NaN;
  const copyOriginal = Number.isFinite(copyOriginalId) ? await readEntityById(copyOriginalId) : null;
  if (!copyBeforeState || copyBeforeState.entityCount !== 1 || !copyOriginal || copyOriginal.type !== 'line') {
    throw new Error('Copy(line) failed to capture original line');
  }

  await page.click('[data-tool=\"copy\"]');
  const cpBase = { x: (cpA.x + cpB.x) * 0.5, y: (cpA.y + cpB.y) * 0.5 };
  const cpTarget = { x: cpBase.x + 140, y: cpBase.y + 20 };
  await page.mouse.click(cpBase.x, cpBase.y);
  await page.mouse.click(cpTarget.x, cpTarget.y);

  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent : '';
    return t.includes('Copy applied');
  }, null, { timeout: timeoutMs });
  const copyStatus = (await page.textContent('#cad-status-message')) || '';

  // Ctrl+A selection is implemented by the Select tool.
  await page.click('[data-tool=\"select\"]');
  await blurActive();
  await page.keyboard.press('Control+A');
  await page.waitForFunction(() => {
    const d = window.__cadDebug;
    const s = d && typeof d.getState === 'function' ? d.getState() : null;
    return !!s && Number(s.entityCount) === 2 && Number(s.selectionCount) === 2;
  }, null, { timeout: timeoutMs });
  const copyAfterCtrlA = (await page.textContent('#cad-selection-summary')) || '';
  const copyAfterIds = await readSelectionIds();
  if (!Array.isArray(copyAfterIds) || copyAfterIds.length !== 2) {
    throw new Error('Copy(line) expected 2 selected entities after Ctrl+A');
  }
  if (!copyAfterIds.includes(copyOriginalId)) {
    throw new Error('Copy(line) original entity missing after copy');
  }
  const copyCandidateId = copyAfterIds.find((id) => id !== copyOriginalId);
  const copyCandidate = Number.isFinite(copyCandidateId) ? await readEntityById(copyCandidateId) : null;
  if (!copyCandidate || copyCandidate.type !== 'line') {
    throw new Error('Copy(line) copied entity missing');
  }
  const pdist = (a, b) => Math.hypot((a.x - b.x), (a.y - b.y));
  const directErr =
    pdist(copyCandidate.start, copyOriginal.start) + pdist(copyCandidate.end, copyOriginal.end);
  const reverseErr =
    pdist(copyCandidate.start, copyOriginal.end) + pdist(copyCandidate.end, copyOriginal.start);
  const mappedStart = directErr <= reverseErr ? copyOriginal.start : copyOriginal.end;
  const mappedEnd = directErr <= reverseErr ? copyOriginal.end : copyOriginal.start;
  const copyDxStart = copyCandidate.start.x - mappedStart.x;
  const copyDyStart = copyCandidate.start.y - mappedStart.y;
  const copyDxEnd = copyCandidate.end.x - mappedEnd.x;
  const copyDyEnd = copyCandidate.end.y - mappedEnd.y;
  const copyTol = 0.25;
  if (Math.abs(copyDxStart - copyDxEnd) > copyTol || Math.abs(copyDyStart - copyDyEnd) > copyTol) {
    throw new Error('Copy(line) translation mismatch between endpoints');
  }
  if (Math.hypot(copyDxStart, copyDyStart) <= 0.5) {
    throw new Error('Copy(line) produced near-zero translation');
  }

  await page.keyboard.press('Control+Z');
  await page.keyboard.press('Control+A');
  await page.waitForFunction(({ id }) => {
    const d = window.__cadDebug;
    const s = d && typeof d.getState === 'function' ? d.getState() : null;
    const ids = d && typeof d.getSelectionIds === 'function' ? d.getSelectionIds() : [];
    if (!s || Number(s.entityCount) !== 1 || Number(s.selectionCount) !== 1) return false;
    return Array.isArray(ids) && ids.length === 1 && Number(ids[0]) === Number(id);
  }, { id: copyOriginalId }, { timeout: timeoutMs });
  const copyAfterUndoCtrlA = (await page.textContent('#cad-selection-summary')) || '';

  await page.keyboard.press('Control+Y');
  await page.keyboard.press('Control+A');
  await page.waitForFunction(() => {
    const d = window.__cadDebug;
    const s = d && typeof d.getState === 'function' ? d.getState() : null;
    return !!s && Number(s.entityCount) === 2 && Number(s.selectionCount) === 2;
  }, null, { timeout: timeoutMs });
  const copyAfterRedoCtrlA = (await page.textContent('#cad-selection-summary')) || '';
  const copyRedoIds = await readSelectionIds();
  if (!Array.isArray(copyRedoIds) || copyRedoIds.length !== 2 || !copyRedoIds.includes(copyOriginalId)) {
    throw new Error('Copy(line) redo did not restore original+copy selection');
  }
  const copyRedoCandidateId = copyRedoIds.find((id) => id !== copyOriginalId);
  const copyRedoCandidate = Number.isFinite(copyRedoCandidateId) ? await readEntityById(copyRedoCandidateId) : null;
  if (!copyRedoCandidate || copyRedoCandidate.type !== 'line') {
    throw new Error('Copy(line) redo missing copied geometry');
  }
  const redoDirect =
    pdist(copyRedoCandidate.start, copyCandidate.start) + pdist(copyRedoCandidate.end, copyCandidate.end);
  const redoReverse =
    pdist(copyRedoCandidate.start, copyCandidate.end) + pdist(copyRedoCandidate.end, copyCandidate.start);
  if (Math.min(redoDirect, redoReverse) > 0.5) {
    throw new Error('Copy(line) redo geometry drifted');
  }

  results.copy_line = {
    status: copyStatus,
    afterCtrlA: copyAfterCtrlA,
    afterUndoCtrlA: copyAfterUndoCtrlA,
    afterRedoCtrlA: copyAfterRedoCtrlA,
    geometry: {
      originalId: copyOriginalId,
      copiedId: copyCandidateId,
      original: copyOriginal,
      copied: copyCandidate,
      translation: { dx: copyDxStart, dy: copyDyStart },
    },
  };

  setStep('rotate_line');
  // 17) Rotate tool: center + reference + target + undo/redo (assert rotation geometry, not status text)
  await clearDoc();

  await page.click('[data-tool=\"line\"]');
  const rtA = point(0.30, 0.42);
  const rtB = point(0.55, 0.42);
  await page.mouse.click(rtA.x, rtA.y);
  await page.mouse.click(rtB.x, rtB.y);
  await waitForTypesExact(['line']);

  const rotBefore = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  const rotateBeforeState = await readDebugState();
  const rotateEntityId = rotateBeforeState && Number.isFinite(rotateBeforeState.primaryId)
    ? Number(rotateBeforeState.primaryId)
    : NaN;
  const rotateBeforeEntity = Number.isFinite(rotateEntityId) ? await readEntityById(rotateEntityId) : null;
  if (!rotateBeforeState || rotateBeforeState.entityCount !== 1 || !rotateBeforeEntity || rotateBeforeEntity.type !== 'line') {
    throw new Error('Rotate(line) failed to capture pre-rotate geometry');
  }
  const lenBefore = Math.hypot(
    rotateBeforeEntity.end.x - rotateBeforeEntity.start.x,
    rotateBeforeEntity.end.y - rotateBeforeEntity.start.y,
  );
  if (!Number.isFinite(lenBefore) || lenBefore <= 1e-6) {
    throw new Error('Rotate(line) invalid geometry length before');
  }

  await page.click('[data-tool=\"rotate\"]');
  const rtCenter = { x: rtA.x, y: rtA.y };
  const rtRef = { x: rtB.x, y: rtB.y };
  const rtTarget = { x: rtA.x, y: rtA.y - 140 };
  await page.mouse.click(rtCenter.x, rtCenter.y);
  await page.mouse.click(rtRef.x, rtRef.y);
  await page.mouse.click(rtTarget.x, rtTarget.y);

  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-status-message');
    const t = el && el.textContent ? el.textContent : '';
    return t.includes('Rotate applied');
  }, null, { timeout: timeoutMs });
  const rotateStatus = (await page.textContent('#cad-status-message')) || '';

  const rotAfter = {
    startX: await readNumberInput('start.x'),
    startY: await readNumberInput('start.y'),
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  const rotateAfterState = await readDebugState();
  const rotateAfterEntity = Number.isFinite(rotateEntityId) ? await readEntityById(rotateEntityId) : null;
  if (!rotateAfterState || rotateAfterState.entityCount !== 1 || !rotateAfterEntity || rotateAfterEntity.type !== 'line') {
    throw new Error('Rotate(line) failed to capture post-rotate geometry');
  }
  const lenAfter = Math.hypot(
    rotateAfterEntity.end.x - rotateAfterEntity.start.x,
    rotateAfterEntity.end.y - rotateAfterEntity.start.y,
  );
  if (!Number.isFinite(lenAfter)) {
    throw new Error('Rotate(line) invalid geometry length after');
  }
  if (Math.abs(lenAfter - lenBefore) > Math.max(0.05, lenBefore * 0.02)) {
    throw new Error('Rotate(line) length not preserved');
  }
  const centerTol = 0.25;
  if (
    Math.abs(rotateAfterEntity.start.x - rotateBeforeEntity.start.x) > centerTol ||
    Math.abs(rotateAfterEntity.start.y - rotateBeforeEntity.start.y) > centerTol
  ) {
    throw new Error('Rotate(line) moved rotation center/start point');
  }
  if (Math.abs(rotAfter.endX - rotBefore.endX) <= 0.5 && Math.abs(rotAfter.endY - rotBefore.endY) <= 0.5) {
    throw new Error('Rotate(line) end did not move');
  }
  const vbx = rotateBeforeEntity.end.x - rotateBeforeEntity.start.x;
  const vby = rotateBeforeEntity.end.y - rotateBeforeEntity.start.y;
  const vax = rotateAfterEntity.end.x - rotateAfterEntity.start.x;
  const vay = rotateAfterEntity.end.y - rotateAfterEntity.start.y;
  const rotDot = vbx * vax + vby * vay;
  const rotCross = vbx * vay - vby * vax;
  const angleDelta = Math.atan2(rotCross, rotDot);
  if (Math.abs(Math.abs(angleDelta) - (Math.PI / 2)) > 0.25) {
    throw new Error('Rotate(line) angle delta is not near 90 degrees');
  }

  await blurActive();
  await page.keyboard.press('Control+Z');
  await page.waitForFunction(({ id, before }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return false;
    const e = d.getEntity(id);
    if (!e || e.type !== 'line') return false;
    const tol = 0.25;
    return (
      Math.abs(e.start.x - before.startX) <= tol &&
      Math.abs(e.start.y - before.startY) <= tol &&
      Math.abs(e.end.x - before.endX) <= tol &&
      Math.abs(e.end.y - before.endY) <= tol
    );
  }, { id: rotateEntityId, before: rotBefore }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ id, after }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return false;
    const e = d.getEntity(id);
    if (!e || e.type !== 'line') return false;
    const tol = 0.25;
    return (
      Math.abs(e.start.x - after.startX) <= tol &&
      Math.abs(e.start.y - after.startY) <= tol &&
      Math.abs(e.end.x - after.endX) <= tol &&
      Math.abs(e.end.y - after.endY) <= tol
    );
  }, { id: rotateEntityId, after: rotAfter }, { timeout: timeoutMs });

  results.rotate_line = {
    before: rotBefore,
    after: rotAfter,
    geometry: {
      id: rotateEntityId,
      before: rotateBeforeEntity,
      after: rotateAfterEntity,
      angleDeltaRad: angleDelta,
    },
    status: rotateStatus,
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('box_select');
  // 18) Box select semantics: window (left->right) vs crossing (right->left) + Shift toggle
  await clearDoc();
  await page.click('[data-tool=\"line\"]');
  const bx1 = point(0.36, 0.34);
  const bx2 = point(0.46, 0.44); // fully inside box
  const bx3 = point(0.36, 0.56);
  const bx4 = point(0.70, 0.56); // partially outside box on the right
  await page.mouse.click(bx1.x, bx1.y);
  await page.mouse.click(bx2.x, bx2.y);
  await waitForTypesExact(['line']);
  await page.mouse.click(bx3.x, bx3.y);
  await page.mouse.click(bx4.x, bx4.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"select\"]');
  const boxTL = point(0.31, 0.30);
  const boxBR = point(0.52, 0.62);

  // Window select (left->right): only the fully-contained line should be selected.
  await page.mouse.move(boxTL.x, boxTL.y);
  await page.mouse.down();
  await page.mouse.move(boxBR.x, boxBR.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('1 selected');
  }, null, { timeout: timeoutMs });
  const boxWindowSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Crossing select (right->left): any endpoint inside should count, so both lines are selected.
  await page.mouse.move(boxBR.x, boxBR.y);
  await page.mouse.down();
  await page.mouse.move(boxTL.x, boxTL.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const boxCrossSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Shift+click toggles: remove one entity and add it back.
  const bxMid1 = { x: (bx1.x + bx2.x) * 0.5, y: (bx1.y + bx2.y) * 0.5 };
  await page.keyboard.down('Shift');
  await page.mouse.click(bxMid1.x, bxMid1.y);
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('1 selected');
  }, null, { timeout: timeoutMs });
  const boxAfterShiftRemove = (await page.textContent('#cad-selection-summary')) || '';

  await page.keyboard.down('Shift');
  await page.mouse.click(bxMid1.x, bxMid1.y);
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const boxAfterShiftAdd = (await page.textContent('#cad-selection-summary')) || '';

  results.box_select = {
    window: boxWindowSummary,
    crossing: boxCrossSummary,
    afterShiftRemove: boxAfterShiftRemove,
    afterShiftAdd: boxAfterShiftAdd,
  };

  setStep('layer_visibility');
  // 19) Layer visibility: hidden layer entities must not be pickable
  await clearDoc();

  // Disable snap so entity positions match click locations (pick tolerance is tighter than snap radius).
  const layerSnapLabel = ((await snapBtn.textContent()) || '').toLowerCase();
  if (layerSnapLabel.includes('on')) {
    await snapBtn.click();
  }

  // Ensure layer 0 is visible before creating entities (clearDoc keeps layers).
  const layer0Item = page.locator('#cad-layer-list .cad-layer-item:has-text(\"0:0\")');
  const layer0VisBtn = layer0Item.locator('button').nth(0);
  const layer0VisLabel = ((await layer0VisBtn.textContent()) || '').toLowerCase();
  if (layer0VisLabel.includes('hidden')) {
    await layer0VisBtn.click();
  }
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btns = el.querySelectorAll('button');
    if (btns.length < 1) return false;
    return String(btns[0].textContent || '').toLowerCase().includes('visible');
  }, null, { timeout: timeoutMs });

  // Add a second layer (id=1 by default) and put one line on it.
  await page.fill('#cad-new-layer-name', 'L1');
  await page.click('#cad-add-layer');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    return items.some((n) => String(n.textContent || '').includes('1:L1'));
  }, null, { timeout: timeoutMs });

  await page.click('[data-tool=\"line\"]');
  const ly0A = point(0.24, 0.30);
  const ly0B = point(0.44, 0.30);
  await page.mouse.click(ly0A.x, ly0A.y);
  await page.mouse.click(ly0B.x, ly0B.y);
  await waitForTypesExact(['line']);

  await page.click('[data-tool=\"line\"]');
  const ly1A = point(0.24, 0.44);
  const ly1B = point(0.44, 0.44);
  await page.mouse.click(ly1A.x, ly1A.y);
  await page.mouse.click(ly1B.x, ly1B.y);
  await waitForTypesExact(['line']);

  await page.fill('#cad-property-form input[name=\"layerId\"]', '1');
  await blurActive();
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-property-form input[name=\"layerId\"]');
    const v = el ? Number.parseInt(el.value, 10) : NaN;
    return Number.isFinite(v) && v === 1;
  }, null, { timeout: timeoutMs });

  // Hide layer 0 and confirm it is not pickable.
  await layer0VisBtn.click();
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btns = el.querySelectorAll('button');
    if (btns.length < 1) return false;
    return String(btns[0].textContent || '').toLowerCase().includes('hidden');
  }, null, { timeout: timeoutMs });

  // Picking/clearing selection behavior lives in Select tool.
  await page.click('[data-tool=\"select\"]');

  // Hidden layer should also be excluded from Ctrl+A selection.
  await blurActive();
  await page.keyboard.press('Control+A');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('1 selected');
  }, null, { timeout: timeoutMs });
  const afterHideCtrlA = (await page.textContent('#cad-selection-summary')) || '';

  // Clear selection and try to pick the hidden entity.
  const blank = point(0.12, 0.12);
  await page.mouse.click(blank.x, blank.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });

  const ly0Mid = { x: (ly0A.x + ly0B.x) * 0.5, y: ly0A.y };
  await page.mouse.click(ly0Mid.x, ly0Mid.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });
  const hiddenPickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Hidden layer must also be excluded from box select (window/crossing).
  // This specifically guards UI wiring around selection.box + layer visibility filtering.
  // Use a generous box to avoid edge-case misses from rounding/pick tolerance.
  const lvBoxTL = point(0.12, 0.22);
  const lvBoxBR = point(0.56, 0.56);
  await page.mouse.move(lvBoxBR.x, lvBoxBR.y);
  await page.mouse.down();
  await page.mouse.move(lvBoxTL.x, lvBoxTL.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('1 selected');
  }, null, { timeout: timeoutMs });
  const hiddenBoxSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Clear selection before picking visible entity (so this stays a click-pick assertion).
  await page.mouse.click(blank.x, blank.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });

  // Visible layer 1 entity must still be pickable.
  const ly1Mid = { x: (ly1A.x + ly1B.x) * 0.5, y: ly1A.y };
  await page.mouse.click(ly1Mid.x, ly1Mid.y);
  await waitForTypesExact(['line']);
  const visiblePickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Show layer 0 again and ensure it becomes pickable.
  await layer0VisBtn.click();
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btns = el.querySelectorAll('button');
    if (btns.length < 1) return false;
    return String(btns[0].textContent || '').toLowerCase().includes('visible');
  }, null, { timeout: timeoutMs });

  // Ctrl+A should now include the layer 0 entity again.
  await blurActive();
  await page.keyboard.press('Control+A');
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const shownPickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Box select should now include both entities again.
  await page.mouse.click(blank.x, blank.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });
  await page.mouse.move(lvBoxBR.x, lvBoxBR.y);
  await page.mouse.down();
  await page.mouse.move(lvBoxTL.x, lvBoxTL.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent : '';
    return t.startsWith('2 selected');
  }, null, { timeout: timeoutMs });
  const shownBoxSummary = (await page.textContent('#cad-selection-summary')) || '';

  results.layer_visibility = {
    afterHideCtrlA,
    hiddenPick: hiddenPickSummary,
    hiddenBox: hiddenBoxSummary,
    visiblePick: visiblePickSummary,
    shownPick: shownPickSummary,
    shownBox: shownBoxSummary,
    status: (await page.textContent('#cad-status-message')) || '',
  };

  setStep('snap_kinds_extra');
  // 20) Snap kinds: MID/CEN/INT/QUA/NEA minimal assertions (by geometry, not canvas overlay)
  await clearDoc();

  // Ensure snap is enabled for this step.
  const snapLabelExtra = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelExtra.includes('off')) {
    await snapBtn.click();
  }

  // Keep snap kinds deterministic: Nearest/Tangent add lots of candidates and can mask MID/INT assertions.
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  const endpointOpt = page.locator('#cad-snap-form label:has-text(\"Endpoint\") input[type=checkbox]');
  const midpointOpt = page.locator('#cad-snap-form label:has-text(\"Midpoint\") input[type=checkbox]');
  const centerOpt = page.locator('#cad-snap-form label:has-text(\"Center\") input[type=checkbox]');
  const intersectionOpt = page.locator('#cad-snap-form label:has-text(\"Intersection\") input[type=checkbox]');
  // Ensure the specific snap kinds needed by this step are enabled.
  await endpointOpt.check();
  await midpointOpt.check();
  await centerOpt.check();
  await intersectionOpt.check();
  const quadrantOpt = page.locator('#cad-snap-form label:has-text(\"Quadrant\") input[type=checkbox]');
  if (await quadrantOpt.isChecked()) {
    await quadrantOpt.uncheck();
  }
  const gridOpt = page.locator('#cad-snap-form label:has-text(\"Grid\") input[type=checkbox]');
  if (await gridOpt.isChecked()) {
    await gridOpt.uncheck();
  }
  const nearestOpt = page.locator('#cad-snap-form label:has-text(\"Nearest\") input[type=checkbox]');
  if (await nearestOpt.isChecked()) {
    await nearestOpt.uncheck();
  }
  const tangentOpt = page.locator('#cad-snap-form label:has-text(\"Tangent\") input[type=checkbox]');
  if (await tangentOpt.isChecked()) {
    await tangentOpt.uncheck();
  }

  // MID snap
  await page.click('[data-tool=\"line\"]');
  const midA = point(0.28, 0.34);
  const midB = point(0.54, 0.34);
  await page.mouse.click(midA.x, midA.y);
  await page.mouse.click(midB.x, midB.y);
  await waitForTypesExact(['line']);
  const midStart = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const midEnd = { x: await readNumberInput('end.x'), y: await readNumberInput('end.y') };
  const expectedMid = { x: (midStart.x + midEnd.x) * 0.5, y: (midStart.y + midEnd.y) * 0.5 };

  await page.click('[data-tool=\"line\"]');
  const midScreen = { x: (midA.x + midB.x) * 0.5, y: (midA.y + midB.y) * 0.5 };
  const midNear = { x: midScreen.x + 5, y: midScreen.y + 3 };
  const midP2 = point(0.74, 0.46);
  await page.mouse.click(midNear.x, midNear.y);
  // Disable snap for the 2nd click to avoid snapping back to the start point and blocking line creation.
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();
  if (await quadrantOpt.isChecked()) await quadrantOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  if (await nearestOpt.isChecked()) await nearestOpt.uncheck();
  if (await tangentOpt.isChecked()) await tangentOpt.uncheck();
  await page.mouse.click(midP2.x, midP2.y);
  await waitForTypesExact(['line']);
  const midSnapped = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const midDx2 = Math.abs(midSnapped.x - expectedMid.x);
  const midDy2 = Math.abs(midSnapped.y - expectedMid.y);
  if (midDx2 > 1e-4 || midDy2 > 1e-4) {
    throw new Error('MID snap failed (dx=' + midDx2 + ' dy=' + midDy2 + ')');
  }

  // CEN snap
  await clearDoc();
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  await centerOpt.check();
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();
  if (await quadrantOpt.isChecked()) await quadrantOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  if (await nearestOpt.isChecked()) await nearestOpt.uncheck();
  if (await tangentOpt.isChecked()) await tangentOpt.uncheck();
  await page.click('[data-tool=\"circle\"]');
  const cenC = point(0.36, 0.44);
  const cenR = point(0.46, 0.44);
  await page.mouse.click(cenC.x, cenC.y);
  await page.mouse.click(cenR.x, cenR.y);
  await waitForTypesExact(['circle']);
  const expectedCen = { x: await readNumberInput('center.x'), y: await readNumberInput('center.y') };

  await page.click('[data-tool=\"line\"]');
  const cenNear = { x: cenC.x + 5, y: cenC.y + 3 };
  const cenP2 = point(0.74, 0.60);
  await page.mouse.click(cenNear.x, cenNear.y);
  // Disable snap for the 2nd click to avoid snapping back to the start point and blocking line creation.
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  await page.mouse.click(cenP2.x, cenP2.y);
  await waitForTypesExact(['line']);
  const cenSnapped = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const cenDx2 = Math.abs(cenSnapped.x - expectedCen.x);
  const cenDy2 = Math.abs(cenSnapped.y - expectedCen.y);
  if (cenDx2 > 1e-4 || cenDy2 > 1e-4) {
    throw new Error('CEN snap failed (dx=' + cenDx2 + ' dy=' + cenDy2 + ')');
  }

  // INT snap
  await clearDoc();
  await page.click('[data-tool=\"line\"]');
  const intH1 = point(0.32, 0.52);
  const intH2 = point(0.72, 0.52);
  await page.mouse.click(intH1.x, intH1.y);
  await page.mouse.click(intH2.x, intH2.y);
  await waitForTypesExact(['line']);
  const intY = await readNumberInput('start.y');

  // Create the vertical line with snap disabled so setup is deterministic.
  const snapLabelIntSetup = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelIntSetup.includes('on')) {
    await snapBtn.click();
  }
  const intV1 = point(0.52, 0.30);
  const intV2 = point(0.52, 0.74);
  await page.mouse.click(intV1.x, intV1.y);
  await page.mouse.click(intV2.x, intV2.y);
  await waitForTypesExact(['line']);
  const vStart = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const vEnd = { x: await readNumberInput('end.x'), y: await readNumberInput('end.y') };
  if (Math.abs(vStart.y - vEnd.y) < 0.5) {
    throw new Error('INT setup failed: expected vertical line');
  }
  const intX = vStart.x;

  // Re-enable snap + keep kinds deterministic for the actual snap assertion.
  const snapLabelIntEnable = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelIntEnable.includes('off')) {
    await snapBtn.click();
  }
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  await endpointOpt.check();
  await midpointOpt.check();
  await centerOpt.check();
  await intersectionOpt.check();
  if (await nearestOpt.isChecked()) {
    await nearestOpt.uncheck();
  }
  if (await tangentOpt.isChecked()) {
    await tangentOpt.uncheck();
  }
  if (await quadrantOpt.isChecked()) {
    await quadrantOpt.uncheck();
  }
  if (await gridOpt.isChecked()) {
    await gridOpt.uncheck();
  }

  const expectedInt = { x: intX, y: intY };
  const intScreen = { x: point(0.52, 0.52).x, y: point(0.52, 0.52).y };
  await page.click('[data-tool=\"line\"]');
  const intNear = { x: intScreen.x + 5, y: intScreen.y + 3 };
  const intP2 = point(0.74, 0.72);
  await page.mouse.click(intNear.x, intNear.y);
  // Disable snap for the 2nd click to avoid snapping back to the start point and blocking line creation.
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();
  if (await quadrantOpt.isChecked()) await quadrantOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  if (await nearestOpt.isChecked()) await nearestOpt.uncheck();
  if (await tangentOpt.isChecked()) await tangentOpt.uncheck();
  await page.mouse.click(intP2.x, intP2.y);
  await waitForTypesExact(['line']);
  const intSnapped = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const intDx2 = Math.abs(intSnapped.x - expectedInt.x);
  const intDy2 = Math.abs(intSnapped.y - expectedInt.y);
  if (intDx2 > 1e-4 || intDy2 > 1e-4) {
    throw new Error('INT snap failed (dx=' + intDx2 + ' dy=' + intDy2 + ')');
  }

  async function readCursorWorld() {
    const raw = (await page.textContent('#cad-status-cursor')) || '';
    const ix = raw.indexOf('X:');
    const iy = raw.indexOf('Y:');
    if (ix < 0 || iy < 0) return { x: NaN, y: NaN, raw };
    const xs = raw.slice(ix + 2, iy).trim();
    const ys = raw.slice(iy + 2).trim();
    return { x: Number(xs), y: Number(ys), raw };
  }

  // QUA snap (circle quadrant)
  await clearDoc();
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  await quadrantOpt.check();
  if (await nearestOpt.isChecked()) await nearestOpt.uncheck();
  if (await tangentOpt.isChecked()) await tangentOpt.uncheck();

  await page.click('[data-tool=\"circle\"]');
  const quaC = point(0.36, 0.44);
  const quaR = point(0.46, 0.44);
  await page.mouse.click(quaC.x, quaC.y);
  await page.mouse.click(quaR.x, quaR.y);
  await waitForTypesExact(['circle']);
  const quaCenter = { x: await readNumberInput('center.x'), y: await readNumberInput('center.y') };
  const quaRadius = Math.max(0.001, await readNumberInput('radius'));
  const quaExpected = { x: quaCenter.x + quaRadius, y: quaCenter.y };

  await page.click('[data-tool=\"line\"]');
  const quaNear = { x: quaR.x + 4, y: quaR.y + 2 };
  const quaP2 = point(0.74, 0.60);
  await page.mouse.click(quaNear.x, quaNear.y);
  // Disable snap for the 2nd click to avoid snapping back to the start point and blocking line creation.
  await quadrantOpt.uncheck();
  await page.mouse.click(quaP2.x, quaP2.y);
  await waitForTypesExact(['line']);
  const quaSnapped = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const quaDx2 = Math.abs(quaSnapped.x - quaExpected.x);
  const quaDy2 = Math.abs(quaSnapped.y - quaExpected.y);
  if (quaDx2 > 1e-4 || quaDy2 > 1e-4) {
    throw new Error('QUA snap failed (dx=' + quaDx2 + ' dy=' + quaDy2 + ')');
  }

  // NEA snap (closest point on circle)
  await clearDoc();
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  await nearestOpt.check();
  if (await tangentOpt.isChecked()) await tangentOpt.uncheck();
  if (await quadrantOpt.isChecked()) await quadrantOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();

  await page.click('[data-tool=\"circle\"]');
  const neaC = point(0.36, 0.44);
  const neaR = point(0.46, 0.44);
  await page.mouse.click(neaC.x, neaC.y);
  await page.mouse.click(neaR.x, neaR.y);
  await waitForTypesExact(['circle']);
  const neaCenter = { x: await readNumberInput('center.x'), y: await readNumberInput('center.y') };
  const neaRadius = Math.max(0.001, await readNumberInput('radius'));

  const neaScreen = point(0.60, 0.38);
  await page.mouse.move(neaScreen.x, neaScreen.y);
  await page.waitForTimeout(30);
  const neaCursor = await readCursorWorld();
  const ndx = neaCursor.x - neaCenter.x;
  const ndy = neaCursor.y - neaCenter.y;
  const nlen = Math.hypot(ndx, ndy);
  const neaExpected = nlen <= 1e-9
    ? { x: neaCenter.x + neaRadius, y: neaCenter.y }
    : { x: neaCenter.x + (ndx / nlen) * neaRadius, y: neaCenter.y + (ndy / nlen) * neaRadius };

  await page.click('[data-tool=\"line\"]');
  const neaP2 = point(0.74, 0.60);
  await page.mouse.click(neaScreen.x, neaScreen.y);
  // Disable snap for the 2nd click to avoid snapping back to the start point and blocking line creation.
  await nearestOpt.uncheck();
  await page.mouse.click(neaP2.x, neaP2.y);
  await waitForTypesExact(['line']);
  const neaSnapped = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const neaDx2 = Math.abs(neaSnapped.x - neaExpected.x);
  const neaDy2 = Math.abs(neaSnapped.y - neaExpected.y);
  if (neaDx2 > 0.05 || neaDy2 > 0.05) {
    throw new Error('NEA snap failed (dx=' + neaDx2 + ' dy=' + neaDy2 + ')');
  }

  // TAN snap (tangent from line start to circle; validate by geometry invariant, not overlay text)
  await clearDoc();
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  // Ensure snap is enabled.
  const snapLabelTan = ((await snapBtn.textContent()) || '').toLowerCase();
  if (snapLabelTan.includes('off')) {
    await snapBtn.click();
  }
  // Keep snap kinds deterministic: only Tangent enabled for this assertion.
  if (await endpointOpt.isChecked()) await endpointOpt.uncheck();
  if (await midpointOpt.isChecked()) await midpointOpt.uncheck();
  if (await centerOpt.isChecked()) await centerOpt.uncheck();
  if (await intersectionOpt.isChecked()) await intersectionOpt.uncheck();
  if (await quadrantOpt.isChecked()) await quadrantOpt.uncheck();
  if (await gridOpt.isChecked()) await gridOpt.uncheck();
  if (await nearestOpt.isChecked()) await nearestOpt.uncheck();
  await tangentOpt.check();
  // Increase snap radius a bit to reduce flakiness on different zoom defaults.
  const snapRadiusInput = page.locator('#cad-snap-form label:has-text(\"Snap radius\") input[type=number]');
  await snapRadiusInput.fill('24');
  await snapRadiusInput.dispatchEvent('change');

  await page.click('[data-tool=\"circle\"]');
  const tanC = point(0.50, 0.50);
  const tanR = point(0.62, 0.50);
  await page.mouse.click(tanC.x, tanC.y);
  await page.mouse.click(tanR.x, tanR.y);
  await waitForTypesExact(['circle']);
  const tanCenter = { x: await readNumberInput('center.x'), y: await readNumberInput('center.y') };
  const tanRadius = Math.max(0.001, await readNumberInput('radius'));

  function tangentPoints(center, radius, fromPoint) {
    const dx = fromPoint.x - center.x;
    const dy = fromPoint.y - center.y;
    const d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= radius + 1e-6) return [];
    const theta = Math.atan2(dy, dx);
    const cosArg = Math.max(-1, Math.min(1, radius / d));
    const alpha = Math.acos(cosArg);
    const angles = [theta + alpha, theta - alpha];
    return angles.map((ang) => ({
      x: center.x + radius * Math.cos(ang),
      y: center.y + radius * Math.sin(ang),
    }));
  }

  // Use cursor world readout to find a screen point that is close to one of the tangent candidates.
  const tanStartScreen = point(0.26, 0.32);
  await page.mouse.move(tanStartScreen.x, tanStartScreen.y);
  await page.waitForTimeout(20);
  const tanStartWorld = await readCursorWorld();
  const tanCandidates = tangentPoints(tanCenter, tanRadius, tanStartWorld);
  if (tanCandidates.length < 2) {
    throw new Error('TAN setup failed: expected 2 tangent candidates');
  }

  const tanProbeScreens = [
    point(0.42, 0.30),
    point(0.46, 0.30),
    point(0.50, 0.30),
    point(0.54, 0.30),
    point(0.58, 0.30),
    point(0.44, 0.36),
    point(0.50, 0.36),
    point(0.56, 0.36),
    point(0.62, 0.36),
    point(0.46, 0.42),
    point(0.52, 0.42),
    point(0.58, 0.42),
  ];

  let bestTan = null;
  for (const s of tanProbeScreens) {
    await page.mouse.move(s.x, s.y);
    await page.waitForTimeout(18);
    const w = await readCursorWorld();
    let best = Infinity;
    for (const c of tanCandidates) {
      const ddx = w.x - c.x;
      const ddy = w.y - c.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < best) best = d2;
    }
    if (!bestTan || best < bestTan.d2) {
      bestTan = { screen: { x: s.x, y: s.y }, world: { x: w.x, y: w.y }, d2: best };
    }
  }
  if (!bestTan) throw new Error('TAN probe failed: no best candidate');

  await page.click('[data-tool=\"line\"]');
  await page.mouse.click(tanStartScreen.x, tanStartScreen.y);
  await page.mouse.click(bestTan.screen.x, bestTan.screen.y);
  await waitForTypesExact(['line']);
  const tanLineStart = { x: await readNumberInput('start.x'), y: await readNumberInput('start.y') };
  const tanLineEnd = { x: await readNumberInput('end.x'), y: await readNumberInput('end.y') };

  // Validate tangent invariants:
  // - end is on the circle (|end-center| ~= radius)
  // - radius vector at tangent point is orthogonal to line direction (dot ~= 0)
  const rvx = tanLineEnd.x - tanCenter.x;
  const rvy = tanLineEnd.y - tanCenter.y;
  const lvx = tanLineEnd.x - tanLineStart.x;
  const lvy = tanLineEnd.y - tanLineStart.y;
  const rlen = Math.hypot(rvx, rvy);
  const llen = Math.hypot(lvx, lvy);
  const rErr = Math.abs(rlen - tanRadius);
  if (rErr > 0.05) {
    throw new Error('TAN snap failed: end not on circle (dr=' + rErr + ')');
  }
  const dot = rvx * lvx + rvy * lvy;
  const denom = Math.max(1e-9, rlen * llen);
  const cosAbs = Math.abs(dot) / denom;
  if (cosAbs > 0.01) {
    throw new Error('TAN snap failed: not tangent (cos=' + cosAbs + ')');
  }

  results.snap_kinds_extra = {
    mid: { expected: expectedMid, got: midSnapped },
    cen: { expected: expectedCen, got: cenSnapped },
    int: { expected: expectedInt, got: intSnapped },
    qua: { expected: quaExpected, got: quaSnapped },
    nea: { cursor: neaCursor, expected: neaExpected, got: neaSnapped },
    tan: {
      center: tanCenter,
      radius: tanRadius,
      start: tanLineStart,
      end: tanLineEnd,
      probe: bestTan,
    },
  };

  } catch (err) {
    const selectionSummary = (await page.textContent('#cad-selection-summary')) || '';
    const statusMessage = (await page.textContent('#cad-status-message')) || '';
    results.__error = {
      step: results.__step,
      message: err && err.message ? String(err.message) : String(err),
      stack: err && err.stack ? String(err.stack) : '',
      selectionSummary,
      statusMessage,
    };
  }

  // Short final snapshot for PASS paths (makes triage easier even without __error).
  results.__final = {
    selectionSummary: (await page.textContent('#cad-selection-summary')) || '',
    statusMessage: (await page.textContent('#cad-status-message')) || '',
  };
  return results;
})" >"$FLOW_RESULT" 2>>"$PLAYWRIGHT_LOG"
FLOW_EXIT_CODE=$?

CLI_SCREENSHOT_NAME="editor_ui_flow.png"
{
  echo "[SCREENSHOT] $SCREENSHOT"
  "$PWCLI" screenshot --filename "$CLI_SCREENSHOT_NAME"
  if [[ -f ".playwright-cli/$CLI_SCREENSHOT_NAME" ]]; then
    cp -f ".playwright-cli/$CLI_SCREENSHOT_NAME" "$SCREENSHOT"
  fi
  echo "[CONSOLE] warnings+"
  "$PWCLI" console warning
} >>"$PLAYWRIGHT_LOG" 2>&1

"$PWCLI" console warning >"$CONSOLE_LOG" 2>&1 || true

set -e

OK="false"
FLOW_JSON_OK="false"
if [[ -s "$FLOW_RESULT" ]]; then
  set +e
  python3 - "$FLOW_RESULT" <<'PY' >/dev/null 2>&1
import json
import sys

path = sys.argv[1]
try:
  raw = open(path, "r", encoding="utf-8", errors="replace").read()
except Exception:
  raise SystemExit(1)

parsed = None
for line in reversed(raw.splitlines()):
  s = line.strip()
  if not (s.startswith("{") and s.endswith("}")):
    continue
  try:
    parsed = json.loads(s)
    break
  except Exception:
    continue

if not isinstance(parsed, dict):
  raise SystemExit(1)

# Ensure the flow returned the expected structure (guards against bash quoting issues producing empty output).
if "line" not in parsed:
  raise SystemExit(1)
if parsed.get("__error"):
  raise SystemExit(1)

raise SystemExit(0)
PY
  flow_json_rc=$?
  set -e
  if [[ "$flow_json_rc" -eq 0 ]]; then
    FLOW_JSON_OK="true"
  fi
fi

if [[ "$FLOW_EXIT_CODE" -eq 0 && -s "$SCREENSHOT" && "$FLOW_JSON_OK" == "true" ]]; then
  OK="true"
fi

FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export RUN_ID MODE STARTED_AT FINISHED_AT URL VIEWPORT TIMEOUT_MS SCREENSHOT OK FLOW_EXIT_CODE PLAYWRIGHT_LOG FLOW_RESULT CONSOLE_LOG

python3 - "$SUMMARY" <<'PY'
import json
import os
import sys

def read_tail(path, n=40):
  try:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
      lines = f.read().splitlines()
    return lines[-n:]
  except Exception:
    return []

def try_read_json(path):
  if not path:
    return None
  try:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
      raw = f.read()
    if not raw or not raw.strip():
      return None
    # playwright-cli may print headers; pick the last JSON-looking line.
    for line in reversed(raw.splitlines()):
      s = line.strip()
      if not s.startswith("{") or not s.endswith("}"):
        continue
      try:
        return json.loads(s)
      except Exception:
        continue
    return None
  except Exception:
    return None

path = sys.argv[1]
log_path = os.environ.get("PLAYWRIGHT_LOG", "")
flow_path = os.environ.get("FLOW_RESULT", "")
console_path = os.environ.get("CONSOLE_LOG", "")

payload = {
  "run_id": os.environ.get("RUN_ID", ""),
  "mode": os.environ.get("MODE", ""),
  "started_at": os.environ.get("STARTED_AT", ""),
  "finished_at": os.environ.get("FINISHED_AT", ""),
  "url": os.environ.get("URL", ""),
  "viewport": os.environ.get("VIEWPORT", ""),
  "timeout_ms": int(os.environ.get("TIMEOUT_MS", "0") or "0"),
  "screenshot": os.environ.get("SCREENSHOT", ""),
  "playwright_log": log_path,
  "flow_result": flow_path,
  "console_log": console_path,
  "flow": try_read_json(flow_path),
  "error_tail": read_tail(log_path, 40) if log_path else [],
  "ok": os.environ.get("OK", "").lower() == "true",
  "exit_code": int(os.environ.get("FLOW_EXIT_CODE", "0") or "0"),
}

# Add a short, stable triage summary for both PASS and FAIL runs.
flow = payload.get("flow") or {}
if isinstance(flow, dict):
  payload["flow_step"] = flow.get("__step")
  final = flow.get("__final")
  err = flow.get("__error")
  if isinstance(err, dict):
    payload["flow_selection"] = err.get("selectionSummary", "")
    payload["flow_status"] = err.get("statusMessage", "")
  elif isinstance(final, dict):
    payload["flow_selection"] = final.get("selectionSummary", "")
    payload["flow_status"] = final.get("statusMessage", "")
  else:
    payload["flow_selection"] = ""
    payload["flow_status"] = ""

with open(path, "w", encoding="utf-8") as f:
  json.dump(payload, f, indent=2)
print(path)
PY

if [[ "$MODE" == "gate" && "$OK" != "true" ]]; then
  exit 2
fi
exit 0
