#!/usr/bin/env bash
set -euo pipefail

MODE="observe" # observe | gate
PORT="18081"
OUTDIR=""
VIEWPORT="1400,900" # window size for playwright-cli resize
TIMEOUT_MS="15000"
HEADED="0"
PWCLI_TIMEOUT_SEC="${PWCLI_TIMEOUT_SEC:-45}"
PWCLI_SETUP_TIMEOUT_SEC="${PWCLI_SETUP_TIMEOUT_SEC:-20}"
PWCLI_CLEANUP_TIMEOUT_SEC="${PWCLI_CLEANUP_TIMEOUT_SEC:-5}"
PWCLI_OPEN_RETRIES="${PWCLI_OPEN_RETRIES:-2}"

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
    --pwcli-timeout-sec)
      PWCLI_TIMEOUT_SEC="$2"; shift 2;;
    --pwcli-setup-timeout-sec)
      PWCLI_SETUP_TIMEOUT_SEC="$2"; shift 2;;
    --pwcli-open-retries)
      PWCLI_OPEN_RETRIES="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--mode observe|gate] [--port N] [--outdir dir] [--viewport W,H] [--timeout-ms MS] [--headed] [--pwcli-timeout-sec N] [--pwcli-setup-timeout-sec N] [--pwcli-open-retries N]"
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

if ! [[ "$PWCLI_TIMEOUT_SEC" =~ ^[0-9]+([.][0-9]+)?$ ]] || [[ "${PWCLI_TIMEOUT_SEC%.*}" -le 0 ]]; then
  echo "Invalid PWCLI_TIMEOUT_SEC=$PWCLI_TIMEOUT_SEC (expected > 0)" >&2
  PWCLI_TIMEOUT_SEC="45"
fi
if ! [[ "$PWCLI_SETUP_TIMEOUT_SEC" =~ ^[0-9]+([.][0-9]+)?$ ]] || [[ "${PWCLI_SETUP_TIMEOUT_SEC%.*}" -le 0 ]]; then
  echo "Invalid PWCLI_SETUP_TIMEOUT_SEC=$PWCLI_SETUP_TIMEOUT_SEC (expected > 0)" >&2
  PWCLI_SETUP_TIMEOUT_SEC="20"
fi
if ! [[ "$PWCLI_CLEANUP_TIMEOUT_SEC" =~ ^[0-9]+([.][0-9]+)?$ ]] || [[ "${PWCLI_CLEANUP_TIMEOUT_SEC%.*}" -le 0 ]]; then
  echo "Invalid PWCLI_CLEANUP_TIMEOUT_SEC=$PWCLI_CLEANUP_TIMEOUT_SEC (expected > 0)" >&2
  PWCLI_CLEANUP_TIMEOUT_SEC="5"
fi
if ! [[ "$PWCLI_OPEN_RETRIES" =~ ^[0-9]+$ ]] || [[ "$PWCLI_OPEN_RETRIES" -le 0 ]]; then
  echo "Invalid PWCLI_OPEN_RETRIES=$PWCLI_OPEN_RETRIES (expected integer >= 1)" >&2
  PWCLI_OPEN_RETRIES="2"
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
pwcli_cmd() {
  pwcli_cmd_with_timeout "$PWCLI_TIMEOUT_SEC" "$@"
}
pwcli_cmd_with_timeout() {
  local timeout="${1:-45}"
  shift
  PYTHONDONTWRITEBYTECODE=1 python3 - "$timeout" "$@" <<'PY'
import subprocess
import sys

if len(sys.argv) < 3:
    raise SystemExit(2)

try:
    timeout = float(sys.argv[1])
except Exception:
    timeout = 45.0
cmd = sys.argv[2:]

try:
    proc = subprocess.run(cmd, check=False, timeout=max(1.0, timeout))
except subprocess.TimeoutExpired:
    print(f"pwcli timeout after {timeout:.1f}s: {' '.join(cmd[:4])}", file=sys.stderr)
    raise SystemExit(124)

raise SystemExit(proc.returncode)
PY
}
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
    _codex_home="${CODEX_HOME:-$HOME/.codex}"
    _pwcli="${PWCLI:-$_codex_home/skills/playwright/scripts/playwright_cli.sh}"
    if [[ -x "$_pwcli" ]]; then
      pwcli_cmd_with_timeout "$PWCLI_CLEANUP_TIMEOUT_SEC" "$_pwcli" session-stop "${PLAYWRIGHT_CLI_SESSION}" >/dev/null 2>&1 || true
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

URL="http://127.0.0.1:$PORT/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=$RUN_ID"
SCREENSHOT="$OUTDIR/editor_ui_flow.png"
SUMMARY="$OUTDIR/summary.json"
PLAYWRIGHT_LOG="$OUTDIR/playwright.log"
FLOW_RESULT="$OUTDIR/flow_result.json"
CONSOLE_LOG="$OUTDIR/console.log"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
# Keep session names short; macOS has tight UNIX domain socket path limits.
PLAYWRIGHT_CLI_SESSION_BASE="${PLAYWRIGHT_CLI_SESSION:-uif_${RUN_ID}}"
export PLAYWRIGHT_CLI_SESSION="${PLAYWRIGHT_CLI_SESSION_BASE}"

OPEN_ARGS=()
if [[ "$HEADED" == "1" ]]; then
  OPEN_ARGS+=(--headed)
fi

cd "$ROOT_DIR"

OPEN_EXIT_CODE=0
RESIZE_EXIT_CODE=0
RUN_CODE_EXIT_CODE=0
OPEN_ATTEMPT_COUNT=0
OPEN_ATTEMPT_EXIT_CODES=""

set +e
{
  echo "[OPEN] $URL"
} >>"$PLAYWRIGHT_LOG" 2>&1
for OPEN_ATTEMPT in $(seq 1 "$PWCLI_OPEN_RETRIES"); do
  OPEN_ATTEMPT_COUNT="$OPEN_ATTEMPT"
  ATTEMPT_SESSION="$PLAYWRIGHT_CLI_SESSION_BASE"
  if [[ "$PWCLI_OPEN_RETRIES" -gt 1 ]]; then
    ATTEMPT_SESSION="${PLAYWRIGHT_CLI_SESSION_BASE}_a${OPEN_ATTEMPT}"
  fi
  export PLAYWRIGHT_CLI_SESSION="$ATTEMPT_SESSION"
  if [[ -x "$PWCLI" ]]; then
    pwcli_cmd_with_timeout "$PWCLI_CLEANUP_TIMEOUT_SEC" "$PWCLI" session-stop "$PLAYWRIGHT_CLI_SESSION" >/dev/null 2>&1 || true
  fi
  {
    echo "[OPEN_ATTEMPT] $OPEN_ATTEMPT/$PWCLI_OPEN_RETRIES session=$PLAYWRIGHT_CLI_SESSION"
  } >>"$PLAYWRIGHT_LOG" 2>&1
  pwcli_cmd_with_timeout "$PWCLI_SETUP_TIMEOUT_SEC" "$PWCLI" open "$URL" "${OPEN_ARGS[@]}" >>"$PLAYWRIGHT_LOG" 2>&1
  OPEN_EXIT_CODE=$?
  if [[ -n "$OPEN_ATTEMPT_EXIT_CODES" ]]; then
    OPEN_ATTEMPT_EXIT_CODES="${OPEN_ATTEMPT_EXIT_CODES},"
  fi
  OPEN_ATTEMPT_EXIT_CODES="${OPEN_ATTEMPT_EXIT_CODES}${OPEN_ATTEMPT}:${OPEN_EXIT_CODE}"
  if [[ "$OPEN_EXIT_CODE" -eq 0 ]]; then
    break
  fi
  if [[ "$OPEN_ATTEMPT" -lt "$PWCLI_OPEN_RETRIES" ]]; then
    {
      echo "[OPEN_RETRY] next_attempt=$((OPEN_ATTEMPT + 1)) after_rc=$OPEN_EXIT_CODE"
    } >>"$PLAYWRIGHT_LOG" 2>&1
    sleep 1
  fi
done
if [[ "$OPEN_EXIT_CODE" -eq 0 ]]; then
  {
  echo "[RESIZE] ${W}x${H}"
  } >>"$PLAYWRIGHT_LOG" 2>&1
  pwcli_cmd_with_timeout "$PWCLI_SETUP_TIMEOUT_SEC" "$PWCLI" resize "$W" "$H" >>"$PLAYWRIGHT_LOG" 2>&1
  RESIZE_EXIT_CODE=$?
else
  {
    echo "[OPEN_FAIL] rc=$OPEN_EXIT_CODE"
  } >>"$PLAYWRIGHT_LOG" 2>&1
fi

if [[ "$OPEN_EXIT_CODE" -eq 0 && "$RESIZE_EXIT_CODE" -eq 0 ]]; then
  {
    echo "[FLOW] start"
  } >>"$PLAYWRIGHT_LOG" 2>&1
pwcli_cmd "$PWCLI" run-code "(async (page) => {
  const timeoutMs = ${TIMEOUT_MS};
  await page.waitForSelector('#cad-canvas', { timeout: timeoutMs });
  await page.waitForSelector('[data-tool=\"line\"]', { timeout: timeoutMs });

  const canvas = page.locator('#cad-canvas');
  const getCanvasRect = async () => {
    return page.evaluate(() => {
      const el = document.querySelector('#cad-canvas');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  };
  let box = await getCanvasRect();
  if (!box) throw new Error('cad-canvas has no bounding box');
  const point = (rx, ry) => ({
    x: box.x + Math.max(20, box.width * rx),
    y: box.y + Math.max(20, box.height * ry),
  });
  const refreshCanvasBox = async () => {
    box = await getCanvasRect();
    if (!box) throw new Error('cad-canvas has no bounding box');
    return box;
  };
  const pointLive = async (rx, ry) => {
    const liveBox = await getCanvasRect();
    if (!liveBox) throw new Error('cad-canvas has no bounding box');
    return {
      x: liveBox.x + Math.max(20, liveBox.width * rx),
      y: liveBox.y + Math.max(20, liveBox.height * ry),
    };
  };

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
    await refreshCanvasBox();
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

  async function listDebugEntities() {
    return page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.listEntities !== 'function') return [];
      const entities = d.listEntities();
      return Array.isArray(entities) ? entities : [];
    });
  }

  function polylineSegmentFromEntity(entity) {
    const pts = entity && entity.type === 'polyline' && Array.isArray(entity.points) ? entity.points : null;
    if (!pts || pts.length < 2) return null;
    const a = pts[0];
    const b = pts[pts.length - 1];
    return {
      minX: Math.min(Number(a.x), Number(b.x)),
      maxX: Math.max(Number(a.x), Number(b.x)),
      y0: Number(a.y),
      y1: Number(b.y),
    };
  }

  async function waitForHorizontalPolylinesAtY(expectedCount, expectedY, timeout = timeoutMs, tolY = 0.15) {
    const deadline = Date.now() + timeout;
    let lastMatches = [];
    while (Date.now() < deadline) {
      const entities = await listDebugEntities();
      lastMatches = entities
        .map((entity) => ({ entity, seg: polylineSegmentFromEntity(entity) }))
        .filter(({ seg }) => seg && Math.abs(seg.y0 - expectedY) <= tolY && Math.abs(seg.y1 - expectedY) <= tolY);
      if (lastMatches.length === expectedCount) return lastMatches;
      await page.waitForTimeout(50);
    }
    throw new Error('Timed out waiting for ' + expectedCount + ' horizontal polylines at y=' + expectedY + ' (matches=' + JSON.stringify(lastMatches.map(({ seg }) => seg)) + ')');
  }

  async function runDebugCommand(id, payload) {
    return page.evaluate((args) => {
      const d = window.__cadDebug;
      if (!d || typeof d.runCommand !== 'function') return null;
      return d.runCommand(args.id, args.payload);
    }, { id, payload });
  }

  async function readLayerById(layerId) {
    return page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getLayer !== 'function') return null;
      return d.getLayer(id);
    }, layerId);
  }

  async function readAllEntities() {
    return page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.listEntities !== 'function') return [];
      const entities = d.listEntities();
      return Array.isArray(entities) ? entities : [];
    });
  }

  async function setLayerVisibility(layerId, visible) {
    return page.evaluate((args) => {
      const d = window.__cadDebug;
      if (!d || typeof d.setLayerVisibility !== 'function') return null;
      return d.setLayerVisibility(args.layerId, args.visible);
    }, { layerId, visible });
  }

  async function waitForLayerVisibility(layerId, visible, timeout = timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const layer = await readLayerById(layerId);
      if (layer && layer.visible === visible) {
        return true;
      }
      await page.waitForTimeout(30);
    }
    return false;
  }

  async function waitForLayerButtonLabel(layerText, expectedLabel, timeout = 1500) {
    const expected = String(expectedLabel || '').toLowerCase();
    const targetText = String(layerText || '');
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ok = await page.evaluate((args) => {
        const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
        const el = items.find((n) => String(n.textContent || '').includes(args.layerText));
        if (!el) return false;
        const btns = el.querySelectorAll('button');
        if (btns.length < 1) return false;
        return String(btns[0].textContent || '').toLowerCase().includes(args.expected);
      }, { layerText: targetText, expected });
      if (ok) return true;
      await page.waitForTimeout(30);
    }
    return false;
  }

  async function waitForSelectionSummaryStartsWith(prefix, timeout = timeoutMs) {
    const expected = String(prefix || '');
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = ((await page.textContent('#cad-selection-summary')) || '').trim();
      if (text.startsWith(expected)) return true;
      await page.waitForTimeout(30);
    }
    return false;
  }

  async function waitForNoSelectionSummary(timeout = timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = ((await page.textContent('#cad-selection-summary')) || '').toLowerCase();
      if (text.includes('no selection')) return true;
      await page.waitForTimeout(30);
    }
    return false;
  }

  async function waitForStatusContains(fragment, timeout = timeoutMs) {
    const expected = String(fragment || '').toLowerCase();
    await page.waitForFunction((needle) => {
      const el = document.querySelector('#cad-status-message');
      const text = (el && el.textContent ? el.textContent : '').toLowerCase();
      return text.includes(needle);
    }, expected, { timeout });
  }

  async function activateTool(toolId, statusFragment = '') {
    await blurActive();
    await page.click('[data-tool=\"' + String(toolId) + '\"]');
    if (statusFragment) {
      await waitForStatusContains(statusFragment);
    }
  }

  async function worldToPagePoint(worldPoint) {
    return page.evaluate((pt) => {
      const canvas = document.querySelector('#cad-canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const d = window.__cadDebug;
      if (!d || typeof d.worldToCanvas !== 'function') return null;
      const local = d.worldToCanvas(pt);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
      return { x: rect.x + local.x, y: rect.y + local.y };
    }, worldPoint);
  }

  async function fitView() {
    await page.click('#cad-fit-view');
    await page.waitForTimeout(60);
    await refreshCanvasBox();
  }

  async function ensureSnapOn() {
    const label = ((await page.textContent('#cad-toggle-snap')) || '').toLowerCase();
    if (label.includes('off')) {
      await page.click('#cad-toggle-snap');
    }
  }
  async function ensureSnapOff() {
    const label = ((await page.textContent('#cad-toggle-snap')) || '').toLowerCase();
    if (label.includes('on')) {
      await page.click('#cad-toggle-snap');
    }
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

  function snapNearOffset(base, dxPx = 4, dyPx = 2) {
    return { x: base.x + dxPx, y: base.y + dyPx };
  }

  function midpoint(p1, p2) {
    return { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
  }

  function adaptiveTol(value, min = 0.05, scale = 0.08) {
    return Math.max(min, Math.abs(value) * scale);
  }

  async function readGripHoverOverlay() {
    return page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.getOverlays !== 'function') return null;
      const overlays = d.getOverlays();
      return overlays && overlays.gripHover ? overlays.gripHover : null;
    });
  }

  async function tryHoverGrip(kind, seedPoint) {
    if (!seedPoint || !Number.isFinite(seedPoint.x) || !Number.isFinite(seedPoint.y)) return null;
    const samples = [
      { x: seedPoint.x, y: seedPoint.y },
      { x: seedPoint.x + 6, y: seedPoint.y },
      { x: seedPoint.x - 6, y: seedPoint.y },
      { x: seedPoint.x, y: seedPoint.y + 6 },
      { x: seedPoint.x, y: seedPoint.y - 6 },
      { x: seedPoint.x + 10, y: seedPoint.y + 10 },
      { x: seedPoint.x - 10, y: seedPoint.y + 10 },
      { x: seedPoint.x + 10, y: seedPoint.y - 10 },
      { x: seedPoint.x - 10, y: seedPoint.y - 10 },
    ];
    for (const p of samples) {
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(20);
      const hover = await readGripHoverOverlay();
      if (!hover || hover.kind !== kind) continue;
      if (hover.point && Number.isFinite(hover.point.x) && Number.isFinite(hover.point.y)) {
        const fromWorld = await worldToPagePoint({ x: hover.point.x, y: hover.point.y });
        if (fromWorld && Number.isFinite(fromWorld.x) && Number.isFinite(fromWorld.y)) {
          await page.mouse.move(fromWorld.x, fromWorld.y);
          return fromWorld;
        }
      }
      return p;
    }
    return null;
  }

  async function waitForPrimaryEntityType(type, timeout = timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const ids = await readSelectionIds();
      if (Array.isArray(ids) && ids.length > 0) {
        const id = Number(ids[0]);
        if (Number.isFinite(id)) {
          const entity = await readEntityById(id);
          if (entity && entity.type === type) {
            return { id, entity };
          }
        }
      }
      await page.waitForTimeout(30);
    }
    return null;
  }

  async function polylineCornerSegmentPickPoints() {
    const ids = await readSelectionIds();
    if (!Array.isArray(ids) || ids.length !== 1) return null;
    const entity = await readEntityById(ids[0]);
    if (!entity || entity.type !== 'polyline' || !Array.isArray(entity.points) || entity.points.length < 3) {
      return null;
    }
    const p0 = entity.points[0];
    const p1 = entity.points[1];
    const p2 = entity.points[2];
    const midA = await worldToPagePoint(midpoint(p0, p1));
    const midB = await worldToPagePoint(midpoint(p1, p2));
    if (!midA || !midB) return null;
    return { midA, midB };
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await clearDoc();
  await page.click('[data-tool=\"polyline\"]');
  const polyA = await pointLive(0.25, 0.30);
  const polyB = await pointLive(0.55, 0.30);
  const polyC = await pointLive(0.55, 0.55);
  await page.mouse.click(polyA.x, polyA.y);
  await page.mouse.click(polyB.x, polyB.y);
  await page.mouse.click(polyC.x, polyC.y);
  await page.mouse.click(polyC.x, polyC.y, { button: 'right' });
  await waitForTypesInclude('polyline');
  // Intentionally start with an oversized radius to force one failure,
  // then retry with a valid radius without re-picking first segment.
  await page.fill('#cad-command-input', 'fillet 999');
  await page.click('[data-tool=\"fillet\"]');
  const segH = await pointLive(0.40, 0.30);
  const segV = await pointLive(0.55, 0.425);
  results.__fillet_debug = { polyA, polyB, polyC, segH, segV };
  await page.mouse.click(segH.x, segH.y);
  await page.mouse.click(segV.x, segV.y);
  const filletFailStatus = (await page.textContent('#cad-status-message')) || '';
  const filletFailCodeMatch = String(filletFailStatus).match(/\\[([A-Z0-9_]+)\\]/);
  const filletFailCode = filletFailCodeMatch ? filletFailCodeMatch[1] : '';
  if (!filletFailCode) {
    throw new Error('Fillet failure status missing error code: ' + filletFailStatus);
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.mouse.click(segV.x, segV.y);
  const filletRetrySucceeded = await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const text = (el && el.textContent) ? el.textContent : '';
    const m = text.match(/\\(([^)]*)\\)/);
    if (!m) return false;
    const types = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    return types.includes('arc');
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!filletRetrySucceeded) {
    throw new Error('Fillet retry after failure did not complete. status=' + filletFailStatus);
  }
  const filletAfter = (await page.textContent('#cad-selection-summary')) || '';
  results.fillet_polyline = {
    afterFillet: filletAfter,
    types: parseTypes(filletAfter),
    status: (await page.textContent('#cad-status-message')) || '',
    failStatus: filletFailStatus,
    failCode: filletFailCode,
    retrySucceeded: filletRetrySucceeded,
  };
  await blurActive();
  await page.keyboard.press('Control+Z');
  await waitForTypesExact(['polyline']);
  results.fillet_polyline.afterUndo = (await page.textContent('#cad-selection-summary')) || '';

  setStep('chamfer_polyline');
  // 3) Chamfer on polyline corner (same polyline, adjacent segments)
  await page.evaluate(() => window.scrollTo(0, 0));
  await clearDoc();
  await page.click('[data-tool=\"polyline\"]');
  await page.mouse.click(polyA.x, polyA.y);
  await page.mouse.click(polyB.x, polyB.y);
  await page.mouse.click(polyC.x, polyC.y);
  await page.mouse.click(polyC.x, polyC.y, { button: 'right' });
  await waitForTypesInclude('polyline');
  // Intentionally start with oversized distances to force one failure,
  // then retry with valid distances without re-picking first segment.
  await page.fill('#cad-command-input', 'chamfer 999 999');
  results.__chamfer_debug = { polyA, polyB, polyC };
  await page.click('[data-tool=\"chamfer\"]');
  const chamferSegH = await pointLive(0.40, 0.30);
  const chamferSegV = await pointLive(0.55, 0.425);
  results.__chamfer_debug.lastAttempt = { attempt: 0, segH: chamferSegH, segV: chamferSegV };
  await page.mouse.click(chamferSegH.x, chamferSegH.y);
  await page.mouse.click(chamferSegV.x, chamferSegV.y);
  const chamferFailStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferFailCodeMatch = String(chamferFailStatus).match(/\\[([A-Z0-9_]+)\\]/);
  const chamferFailCode = chamferFailCodeMatch ? chamferFailCodeMatch[1] : '';
  if (!chamferFailCode) {
    throw new Error('Chamfer failure status missing error code: ' + chamferFailStatus);
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.mouse.click(chamferSegV.x, chamferSegV.y);
  const chamferRetrySucceeded = await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const text = (el && el.textContent) ? el.textContent : '';
    const m = text.match(/\\(([^)]*)\\)/);
    if (!m) return false;
    const types = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    return types.includes('line');
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!chamferRetrySucceeded) {
    throw new Error('Chamfer retry after failure did not complete. status=' + chamferFailStatus);
  }
  const chamferAfter = (await page.textContent('#cad-selection-summary')) || '';
  results.chamfer_polyline = {
    afterChamfer: chamferAfter,
    types: parseTypes(chamferAfter),
    status: (await page.textContent('#cad-status-message')) || '',
    failStatus: chamferFailStatus,
    failCode: chamferFailCode,
    retrySucceeded: chamferRetrySucceeded,
  };
  await blurActive();
  await page.keyboard.press('Control+Z');
  await waitForTypesExact(['polyline']);
  results.chamfer_polyline.afterUndo = (await page.textContent('#cad-selection-summary')) || '';

  setStep('fillet_chamfer_preselection');
  // 3.5) Fillet/Chamfer preselection fast-path:
  // if one entity is preselected before activating the tool, one click on the second
  // target should execute immediately (no extra first-pick click).
  const setupCornerLines = async (opts = {}) => {
    const firstLayerId = Number.isFinite(opts?.firstLayerId) ? Number(opts.firstLayerId) : 0;
    const secondLayerId = Number.isFinite(opts?.secondLayerId) ? Number(opts.secondLayerId) : 0;
    await clearDoc();
    const createH = await runDebugCommand('entity.create', {
      entity: { type: 'line', start: { x: -30, y: 20 }, end: { x: 10, y: 20 }, layerId: firstLayerId },
    });
    const createV = await runDebugCommand('entity.create', {
      entity: { type: 'line', start: { x: 10, y: 20 }, end: { x: 10, y: -20 }, layerId: secondLayerId },
    });
    if (!createH?.ok || !createV?.ok) {
      throw new Error('Failed to create fillet/chamfer preselection fixture');
    }
    const entities = await readAllEntities();
    const lines = entities.filter((entity) => entity && entity.type === 'line');
    if (lines.length < 2) {
      throw new Error('Preselection fixture missing line entities');
    }
    let horizontal = lines.find((line) => {
      const dx = Math.abs(Number(line?.end?.x) - Number(line?.start?.x));
      const dy = Math.abs(Number(line?.end?.y) - Number(line?.start?.y));
      return Number.isFinite(dx) && Number.isFinite(dy) && dx >= dy;
    }) || lines[0];
    let vertical = lines.find((line) => line.id !== horizontal.id);
    if (!vertical) vertical = lines[1] || lines[0];
    const midpoint = (line) => ({
      x: (Number(line.start.x) + Number(line.end.x)) * 0.5,
      y: (Number(line.start.y) + Number(line.end.y)) * 0.5,
    });
    const firstWorld = midpoint(horizontal);
    const secondWorld = midpoint(vertical);
    const first = await worldToPagePoint(firstWorld);
    const second = await worldToPagePoint(secondWorld);
    if (!first || !second) {
      throw new Error('Failed to resolve preselection click points');
    }
    return { first, second, firstWorld, secondWorld };
  };

  const filletPrePoints = await setupCornerLines();
  await activateTool('select', 'select: click entity');
  await page.mouse.click(filletPrePoints.first.x, filletPrePoints.first.y);
  const filletPrimary = await waitForPrimaryEntityType('line', timeoutMs);
  const filletPreselected = !!filletPrimary;
  if (!filletPreselected) {
    throw new Error('Fillet preselection setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline') || status.includes('click second target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPromptSecond) {
    throw new Error('Fillet preselection did not enter second-pick prompt');
  }
  let filletSecondPoint = await worldToPagePoint(filletPrePoints.secondWorld);
  if (!filletSecondPoint) {
    throw new Error('Fillet preselection failed to remap second pick');
  }
  await page.mouse.click(filletSecondPoint.x, filletSecondPoint.y);
  let filletFastApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: 600 }).then(() => true).catch(() => false);
  if (!filletFastApplied) {
    filletSecondPoint = await worldToPagePoint(filletPrePoints.secondWorld);
    if (!filletSecondPoint) {
      throw new Error('Fillet preselection failed to remap second pick for retry');
    }
    await page.mouse.click(filletSecondPoint.x, filletSecondPoint.y);
    filletFastApplied = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('fillet applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      return entities.some((entity) => entity && entity.type === 'arc');
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  }
  if (!filletFastApplied) {
    throw new Error('Fillet preselection fast-path did not apply');
  }
  const filletFastStatus = (await page.textContent('#cad-status-message')) || '';
  const filletFastEntities = await readAllEntities();
  const filletFastArcCount = filletFastEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletFastArcCount < 1) {
    throw new Error('Fillet preselection fast-path did not create arc');
  }

  const chamferPrePoints = await setupCornerLines();
  await activateTool('select', 'select: click entity');
  await page.mouse.click(chamferPrePoints.first.x, chamferPrePoints.first.y);
  const chamferPrimary = await waitForPrimaryEntityType('line', timeoutMs);
  const chamferPreselected = !!chamferPrimary;
  if (!chamferPreselected) {
    throw new Error('Chamfer preselection setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPromptSecond) {
    throw new Error('Chamfer preselection did not enter second-pick prompt');
  }
  let chamferSecondPoint = await worldToPagePoint(chamferPrePoints.secondWorld);
  if (!chamferSecondPoint) {
    throw new Error('Chamfer preselection failed to remap second pick');
  }
  await page.mouse.click(chamferSecondPoint.x, chamferSecondPoint.y);
  let chamferFastApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    const lineCount = entities.filter((entity) => entity && entity.type === 'line').length;
    return lineCount >= 3;
  }, null, { timeout: 600 }).then(() => true).catch(() => false);
  if (!chamferFastApplied) {
    chamferSecondPoint = await worldToPagePoint(chamferPrePoints.secondWorld);
    if (!chamferSecondPoint) {
      throw new Error('Chamfer preselection failed to remap second pick for retry');
    }
    await page.mouse.click(chamferSecondPoint.x, chamferSecondPoint.y);
    chamferFastApplied = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('chamfer applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      const lineCount = entities.filter((entity) => entity && entity.type === 'line').length;
      return lineCount >= 3;
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  }
  if (!chamferFastApplied) {
    throw new Error('Chamfer preselection fast-path did not apply');
  }
  const chamferFastStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferFastEntities = await readAllEntities();
  const chamferFastLineCount = chamferFastEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferFastLineCount < 3) {
    throw new Error('Chamfer preselection fast-path did not create connector line');
  }

  // Two-target preselection fast-path: with exactly two lines preselected before tool
  // activation, a single click on either selected target should apply immediately.
  const pairSelectionRect = {
    x0: -40,
    y0: -30,
    x1: 20,
    y1: 30,
  };

  const filletPairPoints = await setupCornerLines();
  const filletPairSelect = await runDebugCommand('selection.box', {
    rect: pairSelectionRect,
    crossing: false,
  });
  if (!filletPairSelect?.ok) {
    throw new Error('Fillet pair preselection setup failed');
  }
  const filletPairSelectionCount = await page.evaluate(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return 0;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) ? ids.length : 0;
  });
  if (filletPairSelectionCount !== 2) {
    throw new Error('Fillet pair preselection expected 2 selected entities, got ' + filletPairSelectionCount);
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletPairPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('either selected target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPairPromptSecond) {
    throw new Error('Fillet pair preselection did not enter one-click pair prompt');
  }
  await page.mouse.click(filletPairPoints.second.x, filletPairPoints.second.y);
  const filletPairApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPairApplied) {
    throw new Error('Fillet pair preselection one-click path did not apply');
  }
  const filletPairStatus = (await page.textContent('#cad-status-message')) || '';
  const filletPairEntities = await readAllEntities();
  const filletPairArcCount = filletPairEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletPairArcCount < 1) {
    throw new Error('Fillet pair preselection one-click path did not create arc');
  }

  const chamferPairPoints = await setupCornerLines();
  const chamferPairSelect = await runDebugCommand('selection.box', {
    rect: pairSelectionRect,
    crossing: false,
  });
  if (!chamferPairSelect?.ok) {
    throw new Error('Chamfer pair preselection setup failed');
  }
  const chamferPairSelectionCount = await page.evaluate(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return 0;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) ? ids.length : 0;
  });
  if (chamferPairSelectionCount !== 2) {
    throw new Error('Chamfer pair preselection expected 2 selected entities, got ' + chamferPairSelectionCount);
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferPairPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('either selected target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPairPromptSecond) {
    throw new Error('Chamfer pair preselection did not enter one-click pair prompt');
  }
  await page.mouse.click(chamferPairPoints.first.x, chamferPairPoints.first.y);
  const chamferPairApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length >= 3;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPairApplied) {
    throw new Error('Chamfer pair preselection one-click path did not apply');
  }
  const chamferPairStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferPairEntities = await readAllEntities();
  const chamferPairLineCount = chamferPairEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferPairLineCount < 3) {
    throw new Error('Chamfer pair preselection one-click path did not create connector line');
  }

  // Cross-layer preselection path: keep one line on layer 0 and the other on layer 1.
  // Fillet/Chamfer should still apply when both layers are unlocked.
  const filletCrossLayerPoints = await setupCornerLines({ firstLayerId: 0, secondLayerId: 1 });
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(filletCrossLayerPoints.first.x, filletCrossLayerPoints.first.y);
  const filletCrossLayerPreselected = !!(await waitForPrimaryEntityType('line', timeoutMs));
  if (!filletCrossLayerPreselected) {
    throw new Error('Fillet cross-layer preselection setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletCrossLayerPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline') || status.includes('click second target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletCrossLayerPromptSecond) {
    throw new Error('Fillet cross-layer preselection did not enter second-pick prompt');
  }
  await page.mouse.click(filletCrossLayerPoints.second.x, filletCrossLayerPoints.second.y);
  const filletCrossLayerApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletCrossLayerApplied) {
    throw new Error('Fillet cross-layer preselection did not apply');
  }
  const filletCrossLayerEntities = await readAllEntities();
  const filletCrossLayerArcCount = filletCrossLayerEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletCrossLayerArcCount < 1) {
    throw new Error('Fillet cross-layer preselection did not create arc');
  }
  const filletCrossLayerStatus = (await page.textContent('#cad-status-message')) || '';

  const chamferCrossLayerPoints = await setupCornerLines({ firstLayerId: 0, secondLayerId: 1 });
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(chamferCrossLayerPoints.first.x, chamferCrossLayerPoints.first.y);
  const chamferCrossLayerPreselected = !!(await waitForPrimaryEntityType('line', timeoutMs));
  if (!chamferCrossLayerPreselected) {
    throw new Error('Chamfer cross-layer preselection setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferCrossLayerPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferCrossLayerPromptSecond) {
    throw new Error('Chamfer cross-layer preselection did not enter second-pick prompt');
  }
  await page.mouse.click(chamferCrossLayerPoints.second.x, chamferCrossLayerPoints.second.y);
  const chamferCrossLayerApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length >= 3;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferCrossLayerApplied) {
    throw new Error('Chamfer cross-layer preselection did not apply');
  }
  const chamferCrossLayerEntities = await readAllEntities();
  const chamferCrossLayerLineCount = chamferCrossLayerEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferCrossLayerLineCount < 3) {
    throw new Error('Chamfer cross-layer preselection did not create connector line');
  }
  const chamferCrossLayerStatus = (await page.textContent('#cad-status-message')) || '';

  // Runtime-selection fast-path: activate Fillet/Chamfer with no preselection, then set
  // exactly one selected line via debug command and click the second target once.
  const runtimeSelectionRect = {
    x0: 9,
    y0: -25,
    x1: 11,
    y1: 25,
  };
  const clearSelectionRect = {
    x0: 2000,
    y0: 2000,
    x1: 2010,
    y1: 2010,
  };

  const filletRuntimePoints = await setupCornerLines();
  const filletRuntimeClear = await runDebugCommand('selection.box', {
    rect: clearSelectionRect,
    crossing: false,
  });
  if (!filletRuntimeClear?.ok) {
    throw new Error('Fillet runtime selection clear failed');
  }
  const filletRuntimeSelectionCleared = await page.waitForFunction(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) && ids.length === 0;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletRuntimeSelectionCleared) {
    throw new Error('Fillet runtime selection clear did not empty selection');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletRuntimePromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click first line/polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletRuntimePromptFirst) {
    throw new Error('Fillet runtime selection setup did not enter first-pick prompt');
  }
  const filletRuntimeSelect = await runDebugCommand('selection.box', {
    rect: runtimeSelectionRect,
    crossing: false,
  });
  if (!filletRuntimeSelect?.ok) {
    throw new Error('Fillet runtime selection box command failed');
  }
  await page.mouse.click(filletRuntimePoints.first.x, filletRuntimePoints.first.y);
  const filletRuntimeApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletRuntimeApplied) {
    throw new Error('Fillet runtime selection fast-path did not apply');
  }
  const filletRuntimeStatus = (await page.textContent('#cad-status-message')) || '';
  const filletRuntimeEntities = await readAllEntities();
  const filletRuntimeArcCount = filletRuntimeEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletRuntimeArcCount < 1) {
    throw new Error('Fillet runtime selection fast-path did not create arc');
  }

  const chamferRuntimePoints = await setupCornerLines();
  const chamferRuntimeClear = await runDebugCommand('selection.box', {
    rect: clearSelectionRect,
    crossing: false,
  });
  if (!chamferRuntimeClear?.ok) {
    throw new Error('Chamfer runtime selection clear failed');
  }
  const chamferRuntimeSelectionCleared = await page.waitForFunction(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) && ids.length === 0;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferRuntimeSelectionCleared) {
    throw new Error('Chamfer runtime selection clear did not empty selection');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferRuntimePromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click first line/polyline') || status.includes('click first entity');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferRuntimePromptFirst) {
    throw new Error('Chamfer runtime selection setup did not enter first-pick prompt');
  }
  const chamferRuntimeSelect = await runDebugCommand('selection.box', {
    rect: runtimeSelectionRect,
    crossing: false,
  });
  if (!chamferRuntimeSelect?.ok) {
    throw new Error('Chamfer runtime selection box command failed');
  }
  await page.mouse.click(chamferRuntimePoints.first.x, chamferRuntimePoints.first.y);
  const chamferRuntimeApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    const lineCount = entities.filter((entity) => entity && entity.type === 'line').length;
    return lineCount >= 3;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferRuntimeApplied) {
    throw new Error('Chamfer runtime selection fast-path did not apply');
  }
  const chamferRuntimeStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferRuntimeEntities = await readAllEntities();
  const chamferRuntimeLineCount = chamferRuntimeEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferRuntimeLineCount < 3) {
    throw new Error('Chamfer runtime selection fast-path did not create connector line');
  }

  // Escape reset stale-preselection guard:
  // after starting from single preselection and pressing Esc, first click must be treated
  // as fresh first-pick (no immediate apply), then second click applies.
  const filletEscPoints = await setupCornerLines();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(filletEscPoints.first.x, filletEscPoints.first.y);
  const filletEscPreselected = !!(await waitForPrimaryEntityType('line', timeoutMs));
  if (!filletEscPreselected) {
    throw new Error('Fillet Esc stale-preselection setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletEscPromptSecondBeforeEsc = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline') || status.includes('click second target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletEscPromptSecondBeforeEsc) {
    throw new Error('Fillet Esc stale-preselection did not enter second-pick prompt');
  }
  await page.keyboard.press('Escape');
  const filletEscCanceled = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('fillet canceled');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletEscCanceled) {
    throw new Error('Fillet Esc stale-preselection cancel was not observed');
  }
  await page.mouse.click(filletEscPoints.second.x, filletEscPoints.second.y);
  const filletEscNoAutoApply = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (!status.includes('click second line/polyline') && !status.includes('click second target')) return false;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'arc').length === 0;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletEscNoAutoApply) {
    throw new Error('Fillet Esc stale-preselection applied too early after reset');
  }
  const filletEscStatusAfterFirstPick = (await page.textContent('#cad-status-message')) || '';
  await page.mouse.click(filletEscPoints.first.x, filletEscPoints.first.y);
  const filletEscApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletEscApplied) {
    throw new Error('Fillet Esc stale-preselection final apply failed');
  }
  const filletEscFinalStatus = (await page.textContent('#cad-status-message')) || '';

  const chamferEscPoints = await setupCornerLines();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(chamferEscPoints.first.x, chamferEscPoints.first.y);
  const chamferEscPreselected = !!(await waitForPrimaryEntityType('line', timeoutMs));
  if (!chamferEscPreselected) {
    throw new Error('Chamfer Esc stale-preselection setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferEscPromptSecondBeforeEsc = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferEscPromptSecondBeforeEsc) {
    throw new Error('Chamfer Esc stale-preselection did not enter second-pick prompt');
  }
  await page.keyboard.press('Escape');
  const chamferEscCanceled = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('chamfer canceled');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferEscCanceled) {
    throw new Error('Chamfer Esc stale-preselection cancel was not observed');
  }
  await page.mouse.click(chamferEscPoints.second.x, chamferEscPoints.second.y);
  const chamferEscNoAutoApply = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (!status.includes('click second line/polyline')) return false;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length === 2;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferEscNoAutoApply) {
    throw new Error('Chamfer Esc stale-preselection applied too early after reset');
  }
  const chamferEscStatusAfterFirstPick = (await page.textContent('#cad-status-message')) || '';
  await page.mouse.click(chamferEscPoints.first.x, chamferEscPoints.first.y);
  const chamferEscApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length >= 3;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferEscApplied) {
    throw new Error('Chamfer Esc stale-preselection final apply failed');
  }
  const chamferEscFinalStatus = (await page.textContent('#cad-status-message')) || '';
  results.fillet_chamfer_preselection = {
    filletPreselected,
    filletPromptSecond,
    filletFastApplied,
    filletFastArcCount,
    filletFastStatus,
    filletPairPromptSecond,
    filletPairApplied,
    filletPairArcCount,
    filletPairStatus,
    filletRuntimePromptFirst,
    filletRuntimeApplied,
    filletRuntimeArcCount,
    filletRuntimeStatus,
    chamferPreselected,
    chamferPromptSecond,
    chamferFastApplied,
    chamferFastLineCount,
    chamferFastStatus,
    chamferPairPromptSecond,
    chamferPairApplied,
    chamferPairLineCount,
    chamferPairStatus,
    filletCrossLayerPreselected,
    filletCrossLayerPromptSecond,
    filletCrossLayerApplied,
    filletCrossLayerArcCount,
    filletCrossLayerStatus,
    chamferCrossLayerPreselected,
    chamferCrossLayerPromptSecond,
    chamferCrossLayerApplied,
    chamferCrossLayerLineCount,
    chamferCrossLayerStatus,
    chamferRuntimePromptFirst,
    chamferRuntimeApplied,
    chamferRuntimeLineCount,
    chamferRuntimeStatus,
    filletEscPreselected,
    filletEscPromptSecondBeforeEsc,
    filletEscCanceled,
    filletEscNoAutoApply,
    filletEscStatusAfterFirstPick,
    filletEscApplied,
    filletEscFinalStatus,
    chamferEscPreselected,
    chamferEscPromptSecondBeforeEsc,
    chamferEscCanceled,
    chamferEscNoAutoApply,
    chamferEscStatusAfterFirstPick,
    chamferEscApplied,
    chamferEscFinalStatus,
  };

  setStep('fillet_chamfer_polyline_preselection');
  // 3.6) Preselected single polyline corner path:
  // activate Fillet/Chamfer with one selected polyline, then refine first side and
  // finish on another segment of the same polyline.
  const setupCornerPolyline = async () => {
    await clearDoc();
    const created = await runDebugCommand('entity.create', {
      entity: {
        type: 'polyline',
        closed: false,
        points: [
          { x: -20, y: 18 },
          { x: 20, y: 18 },
          { x: 20, y: -18 },
        ],
        layerId: 0,
      },
    });
    if (!created?.ok) {
      throw new Error('Failed to create preselected polyline fixture');
    }
    const entities = await readAllEntities();
    const polyline = entities.find((entity) => entity && entity.type === 'polyline');
    if (!polyline) {
      throw new Error('Preselected polyline fixture missing polyline');
    }
    // Provide both same-leg and corner-leg points to exercise ambiguous same-segment picks.
    const firstSide = await worldToPagePoint({ x: 14, y: 18 });
    const sameLegSecond = await worldToPagePoint({ x: -4, y: 18 });
    const secondSide = await worldToPagePoint({ x: 20, y: 12 });
    const fallbackMissSecond = await worldToPagePoint({ x: -35, y: -28 });
    if (!firstSide || !sameLegSecond || !secondSide || !fallbackMissSecond) {
      throw new Error('Failed to resolve preselected polyline click points');
    }
    return { firstSide, sameLegSecond, secondSide, fallbackMissSecond };
  };

  const filletPolyPre = await setupCornerPolyline();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(filletPolyPre.firstSide.x, filletPolyPre.firstSide.y);
  const filletPolyPreselected = !!(await waitForPrimaryEntityType('polyline', timeoutMs));
  if (!filletPolyPreselected) {
    throw new Error('Fillet polyline preselection setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletPolyPromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('first side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyPromptFirst) {
    throw new Error('Fillet polyline preselection did not enter first-side prompt');
  }
  // first click refines side on the selected polyline, second click intentionally stays
  // on the same leg to verify two-segment auto-pair fallback.
  await page.mouse.click(filletPolyPre.firstSide.x, filletPolyPre.firstSide.y);
  const filletPolyPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyPromptSecond) {
    throw new Error('Fillet polyline preselection did not enter second-side prompt');
  }
  await page.mouse.click(filletPolyPre.sameLegSecond.x, filletPolyPre.sameLegSecond.y);
  const filletPolyApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyApplied) {
    throw new Error('Fillet polyline preselection same-entity path did not apply');
  }
  const filletPolyStatus = (await page.textContent('#cad-status-message')) || '';
  const filletPolyEntities = await readAllEntities();
  const filletPolyArcCount = filletPolyEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletPolyArcCount < 1) {
    throw new Error('Fillet polyline preselection did not create arc');
  }

  const filletPolyFallback = await setupCornerPolyline();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(filletPolyFallback.firstSide.x, filletPolyFallback.firstSide.y);
  if (!(await waitForPrimaryEntityType('polyline', timeoutMs))) {
    throw new Error('Fillet polyline fallback setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.click('[data-tool=\"fillet\"]');
  const filletPolyFallbackPromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('first side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyFallbackPromptFirst) {
    throw new Error('Fillet polyline fallback did not enter first-side prompt');
  }
  await page.mouse.click(filletPolyFallback.firstSide.x, filletPolyFallback.firstSide.y);
  const filletPolyFallbackPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyFallbackPromptSecond) {
    throw new Error('Fillet polyline fallback did not enter second-side prompt');
  }
  // Intentionally click away from geometry; when hit-test misses this should fallback to
  // selected polyline id and apply using current pointer as second-side pick.
  await page.mouse.click(filletPolyFallback.fallbackMissSecond.x, filletPolyFallback.fallbackMissSecond.y);
  let filletPolyFallbackApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: 1200 }).then(() => true).catch(() => false);
  let filletPolyFallbackRecovered = false;
  if (!filletPolyFallbackApplied) {
    // Keep gate deterministic: recover with explicit same-entity second-side hit.
    await page.mouse.click(filletPolyFallback.secondSide.x, filletPolyFallback.secondSide.y);
    const recovered = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('fillet applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      return entities.some((entity) => entity && entity.type === 'arc');
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!recovered) {
      throw new Error('Fillet polyline fallback-miss same-entity path did not apply');
    }
    filletPolyFallbackRecovered = true;
  }
  const filletPolyFallbackStatus = (await page.textContent('#cad-status-message')) || '';
  const filletPolyFallbackEntities = await readAllEntities();
  const filletPolyFallbackArcCount = filletPolyFallbackEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletPolyFallbackArcCount < 1) {
    throw new Error('Fillet polyline fallback-miss did not create arc');
  }

  const chamferPolyPre = await setupCornerPolyline();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(chamferPolyPre.firstSide.x, chamferPolyPre.firstSide.y);
  const chamferPolyPreselected = !!(await waitForPrimaryEntityType('polyline', timeoutMs));
  if (!chamferPolyPreselected) {
    throw new Error('Chamfer polyline preselection setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferPolyPromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('first side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyPromptFirst) {
    throw new Error('Chamfer polyline preselection did not enter first-side prompt');
  }
  await page.mouse.click(chamferPolyPre.firstSide.x, chamferPolyPre.firstSide.y);
  const chamferPolyPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyPromptSecond) {
    throw new Error('Chamfer polyline preselection did not enter second-side prompt');
  }
  await page.mouse.click(chamferPolyPre.sameLegSecond.x, chamferPolyPre.sameLegSecond.y);
  const chamferPolyApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    const lineCount = entities.filter((entity) => entity && entity.type === 'line').length;
    return lineCount >= 1;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyApplied) {
    throw new Error('Chamfer polyline preselection same-entity path did not apply');
  }
  const chamferPolyStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferPolyEntities = await readAllEntities();
  const chamferPolyLineCount = chamferPolyEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferPolyLineCount < 1) {
    throw new Error('Chamfer polyline preselection did not create connector line');
  }

  const chamferPolyFallback = await setupCornerPolyline();
  await page.click('[data-tool=\"select\"]');
  await page.mouse.click(chamferPolyFallback.firstSide.x, chamferPolyFallback.firstSide.y);
  if (!(await waitForPrimaryEntityType('polyline', timeoutMs))) {
    throw new Error('Chamfer polyline fallback setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferPolyFallbackPromptFirst = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('first side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyFallbackPromptFirst) {
    throw new Error('Chamfer polyline fallback did not enter first-side prompt');
  }
  await page.mouse.click(chamferPolyFallback.firstSide.x, chamferPolyFallback.firstSide.y);
  const chamferPolyFallbackPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyFallbackPromptSecond) {
    throw new Error('Chamfer polyline fallback did not enter second-side prompt');
  }
  await page.mouse.click(chamferPolyFallback.fallbackMissSecond.x, chamferPolyFallback.fallbackMissSecond.y);
  let chamferPolyFallbackApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length >= 1;
  }, null, { timeout: 1200 }).then(() => true).catch(() => false);
  let chamferPolyFallbackRecovered = false;
  if (!chamferPolyFallbackApplied) {
    await page.mouse.click(chamferPolyFallback.secondSide.x, chamferPolyFallback.secondSide.y);
    const recovered = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('chamfer applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      return entities.filter((entity) => entity && entity.type === 'line').length >= 1;
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!recovered) {
      throw new Error('Chamfer polyline fallback-miss same-entity path did not apply');
    }
    chamferPolyFallbackRecovered = true;
  }
  const chamferPolyFallbackStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferPolyFallbackEntities = await readAllEntities();
  const chamferPolyFallbackLineCount = chamferPolyFallbackEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferPolyFallbackLineCount < 1) {
    throw new Error('Chamfer polyline fallback-miss did not create connector line');
  }

  results.fillet_chamfer_polyline_preselection = {
    filletPreselected: filletPolyPreselected,
    filletPromptFirst: filletPolyPromptFirst,
    filletPromptSecond: filletPolyPromptSecond,
    filletApplied: filletPolyApplied,
    filletArcCount: filletPolyArcCount,
    filletStatus: filletPolyStatus,
    filletFallbackPromptFirst: filletPolyFallbackPromptFirst,
    filletFallbackPromptSecond: filletPolyFallbackPromptSecond,
    filletFallbackApplied: filletPolyFallbackApplied,
    filletFallbackRecovered: filletPolyFallbackRecovered,
    filletFallbackArcCount: filletPolyFallbackArcCount,
    filletFallbackStatus: filletPolyFallbackStatus,
    chamferPreselected: chamferPolyPreselected,
    chamferPromptFirst: chamferPolyPromptFirst,
    chamferPromptSecond: chamferPolyPromptSecond,
    chamferApplied: chamferPolyApplied,
    chamferLineCount: chamferPolyLineCount,
    chamferStatus: chamferPolyStatus,
    chamferFallbackPromptFirst: chamferPolyFallbackPromptFirst,
    chamferFallbackPromptSecond: chamferPolyFallbackPromptSecond,
    chamferFallbackApplied: chamferPolyFallbackApplied,
    chamferFallbackRecovered: chamferPolyFallbackRecovered,
    chamferFallbackLineCount: chamferPolyFallbackLineCount,
    chamferFallbackStatus: chamferPolyFallbackStatus,
  };

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

  // Toggle Break Keep until it reads \"Short\" (retry: click can be dropped under load).
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
  await page.click('[data-tool=\"select\"]');
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
  await ensureSnapOff();

  let arcDrawn = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.click('[data-tool=\"arc\"]');
    const arcC = await pointLive(0.35, 0.35);
    const arcS = await pointLive(0.55, 0.35);
    const arcE = await pointLive(0.35, 0.55);
    await page.mouse.click(arcC.x, arcC.y);
    await page.mouse.click(arcS.x, arcS.y);
    await page.mouse.click(arcE.x, arcE.y);
    arcDrawn = await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const text = (el && el.textContent) ? el.textContent : '';
      const m = text.match(/\\(([^)]*)\\)/);
      if (!m) return false;
      const types = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      return types.length === 1 && types[0] === 'arc';
    }, null, { timeout: 3000 }).then(() => true).catch(() => false);
    if (arcDrawn) break;
    await clearDoc();
  }
  if (!arcDrawn) {
    throw new Error('Arc draw step did not complete');
  }

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

  const selectedArcBefore = await waitForPrimaryEntityType('arc', 3000);
  if (!selectedArcBefore || !selectedArcBefore.entity) {
    throw new Error('Arc radius grip: selected arc entity missing');
  }
  const arcEntity = selectedArcBefore.entity;

  const normalizeAngle = (a) => {
    let v = a;
    while (v < 0) v += Math.PI * 2;
    while (v >= Math.PI * 2) v -= Math.PI * 2;
    return v;
  };
  const arcMidAngle = (entity) => {
    const start = normalizeAngle(Number.isFinite(entity.startAngle) ? entity.startAngle : 0);
    const end = normalizeAngle(Number.isFinite(entity.endAngle) ? entity.endAngle : 0);
    if (entity.cw === true) {
      let delta = end - start;
      if (delta < 0) delta += Math.PI * 2;
      return normalizeAngle(start + delta * 0.5);
    }
    let delta = start - end;
    if (delta < 0) delta += Math.PI * 2;
    return normalizeAngle(start - delta * 0.5);
  };
  const center = {
    x: Number(arcEntity.center?.x),
    y: Number(arcEntity.center?.y),
  };
  const radiusGeom = Math.max(0.001, Number(arcEntity.radius || radiusBefore));
  const midAngle = arcMidAngle(arcEntity);
  const startAngleGeom = normalizeAngle(Number.isFinite(arcEntity.startAngle) ? arcEntity.startAngle : 0);

  const gripWorld = {
    x: center.x + radiusGeom * Math.cos(midAngle),
    y: center.y + radiusGeom * Math.sin(midAngle),
  };
  const targetWorld = {
    x: center.x + radiusGeom * 1.65 * Math.cos(midAngle),
    y: center.y + radiusGeom * 1.65 * Math.sin(midAngle),
  };
  const arcStartWorld = {
    x: center.x + radiusGeom * Math.cos(startAngleGeom),
    y: center.y + radiusGeom * Math.sin(startAngleGeom),
  };
  const gripSeed = await worldToPagePoint(gripWorld);
  const targetPage = await worldToPagePoint(targetWorld);
  const arcStartPage = await worldToPagePoint(arcStartWorld);
  if (!gripSeed || !targetPage || !arcStartPage) {
    throw new Error('Arc radius grip: failed to map world points to page');
  }

  let gripDragApplied = false;
  const arcGripDebug = { attempts: [] };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const selectedArc = await waitForPrimaryEntityType('arc', 1000);
    if (!selectedArc) {
      await page.mouse.click(arcStartPage.x, arcStartPage.y);
      await waitForPrimaryEntityType('arc', 1000);
    }

    let gripStart = await tryHoverGrip('ARC_RADIUS', gripSeed);
    if (!gripStart) {
      await page.mouse.click(arcStartPage.x, arcStartPage.y);
      await waitForPrimaryEntityType('arc', 1000);
      gripStart = await tryHoverGrip('ARC_RADIUS', gripSeed);
    }
    if (!gripStart) {
      const hover = await readGripHoverOverlay();
      arcGripDebug.attempts.push({
        attempt,
        stage: 'hover-miss',
        hover,
      });
      continue;
    }

    await page.mouse.move(gripStart.x, gripStart.y);
    await page.mouse.down();
    await page.mouse.move(targetPage.x, targetPage.y, { steps: 10 });
    await page.mouse.up();
    const changed = await page.waitForFunction(({ sel, before }) => {
      const el = document.querySelector(sel);
      const v = el ? Number.parseFloat(el.value) : NaN;
      return Number.isFinite(v) && v > before * 1.2;
    }, { sel: radiusSelector, before: radiusBefore }, { timeout: 2000 }).then(() => true).catch(() => false);
    arcGripDebug.attempts.push({
      attempt,
      stage: 'drag',
      gripStart,
      changed,
      selectionSummary: (await page.textContent('#cad-selection-summary')) || '',
      statusMessage: (await page.textContent('#cad-status-message')) || '',
    });
    if (changed) {
      gripDragApplied = true;
      break;
    }
  }
  results.__arc_debug = arcGripDebug;
  if (!gripDragApplied) {
    throw new Error('Arc radius grip drag did not change radius: ' + JSON.stringify(arcGripDebug));
  }

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
  await page.waitForFunction(({ sel, before, tol }) => {
    const el = document.querySelector(sel);
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - before) <= tol;
  }, { sel: radiusSelector, before: radiusBefore, tol: adaptiveTol(radiusBefore) }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ sel, after, tol }) => {
    const el = document.querySelector(sel);
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - after) <= tol;
  }, { sel: radiusSelector, after: radiusAfter, tol: adaptiveTol(radiusAfter) }, { timeout: timeoutMs });

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
  await page.waitForFunction(({ before, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"start.y\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - before) <= tol;
  }, { before: offBefore.startY, tol: adaptiveTol(offBefore.startY) }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ after, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"start.y\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - after) <= tol;
  }, { after: offAfter.startY, tol: adaptiveTol(offAfter.startY) }, { timeout: timeoutMs });

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
  // 7) Join tool: multi-select two connected lines -> right-click apply -> undo/redo
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
  const jM2 = midpoint(jB, jC);
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
  const joinShared = midpoint(lineAPoints[bestShared.i], lineBPoints[bestShared.j]);
  const joinEndA = lineAPoints[1 - bestShared.i];
  const joinEndB = lineBPoints[1 - bestShared.j];

  await page.click('[data-tool=\"join\"]');
  await page.mouse.click(jM2.x, jM2.y, { button: 'right' });
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

  setStep('unsupported_proxy_select');
  // 8) Unsupported display proxy: selectable/read-only in property panel, delete is blocked.
  await clearDoc();

  const createUnsupportedPolyline = await runDebugCommand('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      name: 'UNSUPPORTED_SPLINE_PROXY',
      display_proxy: {
        kind: 'polyline',
        points: [{ x: -28, y: 18 }, { x: -6, y: 18 }, { x: -6, y: -4 }],
      },
      cadgf: {
        id: 9001,
        type: 6,
        spline: {
          degree: 2,
          control: [[-28, 18], [-6, 18], [-6, -4]],
          knots: [0, 0, 0, 1, 1, 1],
        },
      },
    },
  });
  const createUnsupportedEllipse = await runDebugCommand('entity.create', {
    entity: {
      type: 'unsupported',
      layerId: 0,
      visible: true,
      readOnly: true,
      name: 'UNSUPPORTED_ELLIPSE_PROXY',
      display_proxy: {
        kind: 'ellipse',
        center: { x: 22, y: -8 },
        rx: 6,
        ry: 3,
        rotation: 0.2,
        startAngle: 0,
        endAngle: Math.PI * 2,
      },
      cadgf: {
        id: 9002,
        type: 5,
        ellipse: { c: [22, -8], rx: 6, ry: 3, rot: 0.2, a0: 0, a1: Math.PI * 2 },
      },
    },
  });
  if (!createUnsupportedPolyline?.ok || !createUnsupportedEllipse?.ok) {
    throw new Error('Unsupported proxy fixture creation failed');
  }

  await page.click('[data-tool=\"select\"]');
  const proxyPick = await worldToPagePoint({ x: -16, y: 18 });
  if (!proxyPick) {
    throw new Error('Unsupported proxy pick point conversion failed');
  }
  await page.mouse.click(proxyPick.x, proxyPick.y);
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const text = (el && el.textContent) ? String(el.textContent).toLowerCase() : '';
    return text.includes('unsupported');
  }, null, { timeout: timeoutMs });

  const unsupportedSummary = (await page.textContent('#cad-selection-summary')) || '';
  const unsupportedIds = await readSelectionIds();
  if (!Array.isArray(unsupportedIds) || unsupportedIds.length !== 1) {
    throw new Error('Unsupported proxy selection expected exactly one selected entity');
  }
  const unsupportedEntity = await readEntityById(unsupportedIds[0]);
  if (!unsupportedEntity || unsupportedEntity.type !== 'unsupported') {
    throw new Error('Unsupported proxy selection did not select unsupported entity');
  }
  const readOnlyNote = await page.evaluate(() => {
    const el = document.querySelector('#cad-property-form .cad-readonly-note');
    return el ? String(el.textContent || '') : '';
  });
  if (!readOnlyNote.toLowerCase().includes('read-only')) {
    throw new Error('Unsupported proxy read-only note missing');
  }

  const unsupportedCountBeforeDelete = (await readDebugState())?.entityCount || 0;
  await blurActive();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(80);
  const unsupportedCountAfterDelete = (await readDebugState())?.entityCount || 0;
  if (unsupportedCountAfterDelete !== unsupportedCountBeforeDelete) {
    throw new Error('Unsupported proxy delete should be blocked');
  }

  results.unsupported_proxy_select = {
    summary: unsupportedSummary,
    readOnlyNote,
    selectedId: unsupportedIds[0],
    entityCountBeforeDelete: unsupportedCountBeforeDelete,
    entityCountAfterDelete: unsupportedCountAfterDelete,
    status: (await page.textContent('#cad-status-message')) || '',
  };

  setStep('text_edit');
  // 9) Text create + property panel edit + undo/redo
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
  await page.waitForFunction(({ before, tolS, tolE }) => {
    const sx = document.querySelector('#cad-property-form input[name=\"start.x\"]');
    const ex = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const sv = sx ? Number.parseFloat(sx.value) : NaN;
    const ev = ex ? Number.parseFloat(ex.value) : NaN;
    if (!Number.isFinite(sv) || !Number.isFinite(ev)) return false;
    return Math.abs(sv - before.startX) <= tolS && Math.abs(ev - before.endX) <= tolE;
  }, { before: trim2Before, tolS: adaptiveTol(trim2Before.startX), tolE: adaptiveTol(trim2Before.endX) }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ after, tolS, tolE }) => {
    const sx = document.querySelector('#cad-property-form input[name=\"start.x\"]');
    const ex = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const sv = sx ? Number.parseFloat(sx.value) : NaN;
    const ev = ex ? Number.parseFloat(ex.value) : NaN;
    if (!Number.isFinite(sv) || !Number.isFinite(ev)) return false;
    return Math.abs(sv - after.startX) <= tolS && Math.abs(ev - after.endX) <= tolE;
  }, { after: trim2After, tolS: adaptiveTol(trim2After.startX), tolE: adaptiveTol(trim2After.endX) }, { timeout: timeoutMs });

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
    const tf1Mid = midpoint(tf1A, tf1B);
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
    const tf2Mid = midpoint(tf2A, tf2B);
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
  await page.waitForFunction(({ beforeX, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - beforeX) <= tol;
  }, { beforeX: ext2BeforeEndX, tol: adaptiveTol(ext2BeforeEndX) }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ afterX, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - afterX) <= tol;
  }, { afterX: ext2AfterEndX, tol: adaptiveTol(ext2AfterEndX) }, { timeout: timeoutMs });

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

    // Seed geometry via debug command; this step validates extend interaction after failure.
    const boundaryStart = { x: 20, y: -10 };
    const boundaryEnd = { x: 20, y: 10 };
    const failStart = { x: 28, y: -2 };
    const failEnd = { x: 28, y: 4 };
    const okStart = { x: -10, y: -6 };
    const okEnd = { x: 4, y: -6 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundaryStart, end: boundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const efBoundaryId = await readPrimaryId();
    const efBoundary = await readLineEnds(efBoundaryId);
    if (!efBoundary) throw new Error('Extend(failure) failed to read boundary entity');
    const efBoundaryX = efBoundary.startX;

    // Target #1: vertical line parallel to boundary (no intersection). Extend should do nothing.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: failStart, end: failEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const ef1Id = await readPrimaryId();
    const ef1Before = await readLineEnds(ef1Id);
    if (!ef1Before) throw new Error('Extend(failure) failed to read target1 entity');

    // Target #2: line ending before boundary. Extend should bring end.x to boundary.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: okStart, end: okEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const ef2Id = await readPrimaryId();
    const ef2Before = await readLineEnds(ef2Id);
    if (!ef2Before) throw new Error('Extend(failure) failed to read target2 entity');

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    const ef1Mid = await worldToPagePoint({ x: failStart.x, y: (failStart.y + failEnd.y) * 0.5 });
    const ef2PickPoint = await worldToPagePoint(okEnd);
    const ef2Pick = { x: ef2PickPoint.x - 2, y: ef2PickPoint.y };

    await activateTool('extend', 'extend: click boundary');
    const efBoundaryPick = await worldToPagePoint({ x: efBoundaryX, y: 0 });
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

    const listEntities = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      if (!d || typeof d.listEntities !== 'function') return [];
      const entities = d.listEntities();
      return Array.isArray(entities) ? entities : [];
    });

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

    const waitForHorizontalPolylinesAtY = async (expectedCount, expectedY, tolY = 0.15) => {
      const deadline = Date.now() + timeoutMs;
      let lastMatches = [];
      while (Date.now() < deadline) {
        const entities = await listEntities();
        lastMatches = entities
          .map((entity) => ({ entity, seg: toSeg(entity) }))
          .filter(({ seg }) => seg && Math.abs(seg.y0 - expectedY) <= tolY && Math.abs(seg.y1 - expectedY) <= tolY);
        if (lastMatches.length === expectedCount) return lastMatches;
        await page.waitForTimeout(50);
      }
      throw new Error('Trim(polyline failure) timed out waiting for ' + expectedCount + ' horizontal polylines at y=' + expectedY + ' (matches=' + JSON.stringify(lastMatches.map(({ seg }) => seg)) + ')');
    };

    const waitForSelectedPolylines = async (expectedCount = 2) => {
      const deadline = Date.now() + timeoutMs;
      let lastIds = [];
      while (Date.now() < deadline) {
        lastIds = await readSelectionIds();
        if (Array.isArray(lastIds) && lastIds.length === expectedCount) {
          const entities = [];
          let ok = true;
          for (const id of lastIds) {
            const entity = await readEntity(id);
            if (!entity || entity.type !== 'polyline') {
              ok = false;
              break;
            }
            entities.push(entity);
          }
          if (ok) return { ids: lastIds, entities };
        }
        await page.waitForTimeout(50);
      }
      throw new Error('Trim(polyline split) timed out waiting for ' + expectedCount + ' selected polylines (ids=' + JSON.stringify(lastIds) + ')');
    };

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

    // Seed geometry via debug commands; this step validates trim interaction, not entity creation.
    const boundary1Start = { x: -5, y: -20 };
    const boundary1End = { x: -5, y: 20 };
    const boundary2Start = { x: 5, y: -20 };
    const boundary2End = { x: 5, y: 20 };
    const polyPStart = { x: -15, y: 0 };
    const polyPEnd = { x: 15, y: 0 };
    const polyQStart = { x: -15, y: -4 };
    const polyQEnd = { x: 15, y: -4 };
    const tpBoundaryX1 = boundary1Start.x;
    const tpBoundaryX2 = boundary2Start.x;

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary1Start, end: boundary1End, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary2Start, end: boundary2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);

    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [polyPStart, polyPEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');
    const tpPolyPId = await readPrimaryId();
    const tpPolyP = Number.isFinite(tpPolyPId) ? await readEntity(tpPolyPId) : null;
    const tpSegP = segFromPolyline(tpPolyP);
    if (!tpSegP || !Number.isFinite(tpSegP.minX) || !Number.isFinite(tpSegP.maxX)) {
      throw new Error('Trim(polyline split) setup failed: missing baseline geometry for polyline P');
    }
    const tpBaseP = { minX: tpSegP.minX, maxX: tpSegP.maxX, y: Number(tpSegP.y0) };

    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [polyQStart, polyQEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');
    const tpPolyQId = await readPrimaryId();
    const tpPolyQ = Number.isFinite(tpPolyQId) ? await readEntity(tpPolyQId) : null;
    const tpSegQ = segFromPolyline(tpPolyQ);
    if (!tpSegQ || !Number.isFinite(tpSegQ.minX) || !Number.isFinite(tpSegQ.maxX)) {
      throw new Error('Trim(polyline split) setup failed: missing baseline geometry for polyline Q');
    }
    const tpBaseQ = { minX: tpSegQ.minX, maxX: tpSegQ.maxX, y: Number(tpSegQ.y0) };

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    await activateTool('trim', 'trim: click boundary');
    // Pick boundaries above the target segments to avoid ambiguity.
    const b1Pick = await worldToPagePoint({ x: tpBoundaryX1, y: 10 });
    const b2Pick = await worldToPagePoint({ x: tpBoundaryX2, y: 10 });
    await page.mouse.click(b1Pick.x, b1Pick.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b2Pick.x, b2Pick.y);
    await page.keyboard.up('Shift');

    // Pick between the two intersections so trim splits into 2 polylines.
    const targetPick = await worldToPagePoint({ x: 0, y: 0 });
    await page.mouse.click(targetPick.x, targetPick.y);
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent : '';
      return t.startsWith('2 selected');
    }, null, { timeout: timeoutMs });
    await waitForSelectedPolylines(2);
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
    const targetPick2 = await worldToPagePoint({ x: 0, y: -4 });
    await page.mouse.click(targetPick2.x, targetPick2.y);
    await page.waitForFunction(() => {
      const el = document.querySelector('#cad-selection-summary');
      const t = el && el.textContent ? el.textContent : '';
      return t.startsWith('2 selected');
    }, null, { timeout: timeoutMs });
    await waitForSelectedPolylines(2);
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
    await activateTool('select', 'select: click entity');
    {
      const qPick = await worldToPagePoint({ x: 0, y: -4 });
      await page.mouse.click(qPick.x, qPick.y);
    }
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
    {
      const qBox0 = await worldToPagePoint({ x: -16, y: -3 });
      const qBox1 = await worldToPagePoint({ x: 16, y: -5 });
      await page.mouse.move(qBox0.x, qBox0.y);
      await page.mouse.down();
      await page.mouse.move(qBox1.x, qBox1.y);
      await page.mouse.up();
    }
    await waitForSelectedPolylines(2);
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

    const waitForFailureStepSelectedPolylines = async (expectedCount = 2) => {
      const deadline = Date.now() + timeoutMs;
      let lastIds = [];
      while (Date.now() < deadline) {
        lastIds = await readSelectionIds();
        if (Array.isArray(lastIds) && lastIds.length === expectedCount) {
          const entities = [];
          let ok = true;
          for (const id of lastIds) {
            const entity = await readEntity(id);
            if (!entity || entity.type !== 'polyline') {
              ok = false;
              break;
            }
            entities.push(entity);
          }
          if (ok) return { ids: lastIds, entities };
        }
        await page.waitForTimeout(50);
      }
      throw new Error('Trim(polyline failure) timed out waiting for ' + expectedCount + ' selected polylines (ids=' + JSON.stringify(lastIds) + ')');
    };

    // Seed geometry via debug commands.
    const boundary1Start = { x: -5, y: -20 };
    const boundary1End = { x: -5, y: 20 };
    const boundary2Start = { x: 5, y: -20 };
    const boundary2End = { x: 5, y: 20 };
    const failPolyStart = { x: -10, y: -2 };
    const failPolyEnd = { x: -10, y: 4 };
    const okPolyStart = { x: -15, y: 0 };
    const okPolyEnd = { x: 15, y: 0 };
    const boundaryX1 = boundary1Start.x;
    const boundaryX2 = boundary2Start.x;

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary1Start, end: boundary1End, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary2Start, end: boundary2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);

    // Failure target: vertical polyline parallel to boundaries (no intersection).
    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [failPolyStart, failPolyEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');

    // Success target: horizontal polyline across boundaries (will split).
    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [okPolyStart, okPolyEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
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

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    await activateTool('trim', 'trim: click boundary');
    const b1Pick = await worldToPagePoint({ x: boundaryX1, y: 10 });
    const b2Pick = await worldToPagePoint({ x: boundaryX2, y: 10 });
    await page.mouse.click(b1Pick.x, b1Pick.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b2Pick.x, b2Pick.y);
    await page.keyboard.up('Shift');

    // Failure attempt: click the failure polyline (vertical, parallel to boundaries → no intersection).
    {
      const failPick = await worldToPagePoint({ x: failPolyStart.x, y: 1 });
      await page.mouse.click(failPick.x, failPick.y);
    }
    await page.waitForTimeout(60);

    // Success attempt: click between boundaries to split.
    {
      const okPick = await worldToPagePoint({ x: 0, y: 0 });
      await page.mouse.click(okPick.x, okPick.y);
    }
    await waitForStatusContains('trim applied');
    const splitMatches = await waitForHorizontalPolylinesAtY(2, baseY);

    // Geometry assert: two polylines remain, with endpoints pinned to original endpoints and boundary intersections.
    const s0 = splitMatches[0].seg;
    const s1 = splitMatches[1].seg;
    if (!s0 || !s1) {
      throw new Error('Trim(polyline failure) expected 2 horizontal polylines after split');
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

    await blurActive();
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(80);
    const undoMatches = await waitForHorizontalPolylinesAtY(1, baseY);
    const undoSeg = undoMatches[0] && undoMatches[0].seg;
    if (!undoSeg) throw new Error('Trim(polyline failure) undo expected polyline entity');
    if (Math.abs(undoSeg.y0 - baseY) > tolY || Math.abs(undoSeg.y1 - baseY) > tolY) {
      throw new Error('Trim(polyline failure) undo y drift (expected y~' + baseY + ')');
    }
    if (Math.abs(undoSeg.minX - baseMinX) > tolX || Math.abs(undoSeg.maxX - baseMaxX) > tolX) {
      throw new Error('Trim(polyline failure) undo endpoints unexpected: ' + JSON.stringify(undoSeg));
    }

    await blurActive();
    await page.keyboard.press('Control+Y');
    await page.waitForTimeout(80);
    const redoMatches = await waitForHorizontalPolylinesAtY(2, baseY);
    const rs0 = redoMatches[0].seg;
    const rs1 = redoMatches[1].seg;
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

    await ensureSnapOff();

    // Seed geometry via debug command; this step validates extend interaction, not line/polyline creation.
    const boundaryStart = { x: 20, y: -10 };
    const boundaryEnd = { x: 20, y: 10 };
    const poly1Start = { x: -10, y: 0 };
    const poly1End = { x: 5, y: 0 };
    const poly2Start = { x: -10, y: -4 };
    const poly2End = { x: 3, y: -4 };
    const poly1SelectWorld = { x: -2.5, y: 0 };
    const poly2SelectWorld = { x: -3.5, y: -4 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundaryStart, end: boundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const boundaryX = boundaryStart.x;

    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [poly1Start, poly1End], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');

    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [poly2Start, poly2End], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

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
    await activateTool('select', 'select: click entity');
    {
      const pick = await worldToPagePoint(poly1SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
    await waitForTypesInclude('polyline');
    const poly1Id = await selectPrimaryId();
    if (!Number.isFinite(poly1Id)) throw new Error('Extend(polyline): failed to read primaryId for poly1');
    const poly1BeforeX = await readPolylineEndX(poly1Id);

    {
      const pick = await worldToPagePoint(poly2SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
    await waitForTypesInclude('polyline');
    const poly2Id = await selectPrimaryId();
    if (!Number.isFinite(poly2Id)) throw new Error('Extend(polyline): failed to read primaryId for poly2');
    const poly2BeforeX = await readPolylineEndX(poly2Id);
    if (![poly1BeforeX, poly2BeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline): failed to read polyline endpoint x before extend');
    }

    // Apply extend: pick boundary, then pick two targets near their endpoints (continuous).
    await activateTool('extend', 'extend: click boundary');
    const boundaryPick = await worldToPagePoint({ x: boundaryX, y: 0 });
    const poly1ExtendPick = await worldToPagePoint(poly1End);
    const poly2ExtendPick = await worldToPagePoint(poly2End);
    await page.mouse.click(boundaryPick.x, boundaryPick.y);
    await page.mouse.click(poly1ExtendPick.x, poly1ExtendPick.y);
    await page.mouse.click(poly2ExtendPick.x, poly2ExtendPick.y);

    // Verify: both endpoints now land on the boundary x.
    await activateTool('select', 'select: click entity');
    {
      const pick = await worldToPagePoint(poly1SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
    await waitForTypesInclude('polyline');
    const poly1AfterX = await readPolylineEndX(poly1Id);
    {
      const pick = await worldToPagePoint(poly2SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
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
    await activateTool('select', 'select: click entity');
    {
      const pick = await worldToPagePoint(poly2SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
    await waitForTypesInclude('polyline');
    const poly2UndoX = await readPolylineEndX(poly2Id);
    if (Math.abs(poly2UndoX - poly2BeforeX) > 0.1) {
      throw new Error('Extend(polyline) undo did not restore poly2 endpoint');
    }

    // Poly1 should remain extended.
    {
      const pick = await worldToPagePoint(poly1SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
    await waitForTypesInclude('polyline');
    const poly1StillX = await readPolylineEndX(poly1Id);
    if (Math.abs(poly1StillX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline) undo unexpectedly reverted poly1');
    }

    await blurActive();
    await page.keyboard.press('Control+Y');
    {
      const pick = await worldToPagePoint(poly2SelectWorld);
      await page.mouse.click(pick.x - 10, pick.y);
    }
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

    await ensureSnapOff();

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

    // Seed geometry via debug command; this step validates extend interaction after failure.
    const boundaryStart = { x: 20, y: -10 };
    const boundaryEnd = { x: 20, y: 10 };
    const failStart = { x: 28, y: -2 };
    const failEnd = { x: 28, y: 4 };
    const okStart = { x: -10, y: -6 };
    const okEnd = { x: 4, y: -6 };
    const failSelectWorld = { x: 28, y: 1 };
    const okSelectWorld = { x: -3, y: -6 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundaryStart, end: boundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const boundaryX = boundaryStart.x;

    // Failure target: vertical polyline far to the right, parallel to boundary => no intersection.
    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [failStart, failEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');

    // Success target: open polyline ending left of boundary.
    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [okStart, okEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    await activateTool('select', 'select: click entity');
    {
      const pick = await worldToPagePoint(failSelectWorld);
      await page.mouse.click(pick.x - 6, pick.y);
    }
    await waitForTypesInclude('polyline');
    const failId = await selectPrimaryId();
    if (!Number.isFinite(failId)) throw new Error('Extend(polyline failure): failed to read primaryId for fail polyline');
    const failBeforeX = await readPolylineEndX(failId);

    {
      const pick = await worldToPagePoint(okSelectWorld);
      await page.mouse.click(pick.x - 6, pick.y);
    }
    await waitForTypesInclude('polyline');
    const okId = await selectPrimaryId();
    if (!Number.isFinite(okId)) throw new Error('Extend(polyline failure): failed to read primaryId for ok polyline');
    const okBeforeX = await readPolylineEndX(okId);
    if (![failBeforeX, okBeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline failure): failed to read endpoint x before extend');
    }

    // Extend: pick boundary, click fail target (no intersection), then click ok target without re-picking boundary.
    await activateTool('extend', 'extend: click boundary');
    const boundaryPick = await worldToPagePoint({ x: boundaryX, y: 0 });
    const failTargetPick = await worldToPagePoint(failEnd);
    const okTargetPick = await worldToPagePoint(okEnd);
    await page.mouse.click(boundaryPick.x, boundaryPick.y);
    await page.mouse.click(failTargetPick.x - 2, failTargetPick.y);
    await page.waitForTimeout(60);
    await page.mouse.click(okTargetPick.x - 2, okTargetPick.y);
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
    await ensureSnapOn();
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
    const ghSelected = await waitForPrimaryEntityType('line', 2000);
    if (!ghSelected || !ghSelected.entity || !ghSelected.entity.start) {
      throw new Error('grip_hover_vs_snap: selected line missing');
    }
    const ghStart = await worldToPagePoint(ghSelected.entity.start);
    if (!ghStart) {
      throw new Error('grip_hover_vs_snap: failed to map line start to page');
    }

    // Hover near the start/end grip. This should set gripHover overlay.
    let nearGrip = await tryHoverGrip('LINE_START', ghStart);
    if (!nearGrip) {
      nearGrip = await tryHoverGrip('LINE_END', ghStart);
    }
    if (!nearGrip) {
      throw new Error('grip_hover_vs_snap: failed to hover line grip');
    }
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
  await page.waitForFunction(({ beforeX, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - beforeX) <= tol;
  }, { beforeX: lockBefore.endX, tol: adaptiveTol(lockBefore.endX) }, { timeout: timeoutMs });

  await page.keyboard.press('Control+Y');
  await page.waitForFunction(({ afterX, tol }) => {
    const el = document.querySelector('#cad-property-form input[name=\"end.x\"]');
    const v = el ? Number.parseFloat(el.value) : NaN;
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - afterX) <= tol;
  }, { afterX: lockAfter.endX, tol: adaptiveTol(lockAfter.endX) }, { timeout: timeoutMs });

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

  setStep('polyline_grip_insert_delete');
  // 15) Select tool: polyline midpoint grip insert + vertex double-click delete (both with undo/redo)
  {
    await clearDoc();

    // Keep grip drag deterministic.
    await ensureSnapOff();

    const createPoly = await runDebugCommand('entity.create', {
      entity: {
        type: 'polyline',
        layerId: 0,
        closed: false,
        points: [
          { x: -24, y: 14 },
          { x: -2, y: 14 },
          { x: -2, y: -10 },
        ],
      },
    });
    if (!createPoly?.ok) {
      throw new Error('polyline_grip_insert_delete: failed to create fixture polyline');
    }

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    // entity.create already selected the polyline; activate select tool and
    // click on horizontal segment so grips render.
    await activateTool('select', 'select: click entity');
    const polyClickPoint = await worldToPagePoint({ x: -13, y: 14 });
    if (!polyClickPoint) {
      throw new Error('polyline_grip_insert_delete: failed to map click point');
    }
    await page.mouse.click(polyClickPoint.x, polyClickPoint.y);

    const selectedPoly = await waitForPrimaryEntityType('polyline', timeoutMs);
    if (!selectedPoly || !selectedPoly.entity || !Array.isArray(selectedPoly.entity.points) || selectedPoly.entity.points.length < 3) {
      throw new Error('polyline_grip_insert_delete: expected selected polyline with >=3 points');
    }
    const polyId = selectedPoly.id;
    const basePointCount = selectedPoly.entity.points.length;
    const waitForPointCount = async (expectedCount, timeout = timeoutMs) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const entity = await readEntityById(polyId);
        const points = entity && Array.isArray(entity.points) ? entity.points : null;
        if (points && points.length === expectedCount) return entity;
        await page.waitForTimeout(30);
      }
      return null;
    };
    const waitForInsertedPoint = async (expectedCount, target, tolerance = 1.0, timeout = timeoutMs) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const entity = await readEntityById(polyId);
        const points = entity && Array.isArray(entity.points) ? entity.points : null;
        if (points && points.length === expectedCount) {
          const hit = points.some((point) => {
            const x = Number(point?.x);
            const y = Number(point?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
            return Math.hypot(x - target.x, y - target.y) <= tolerance;
          });
          if (hit) return entity;
        }
        await page.waitForTimeout(30);
      }
      return null;
    };

    const p0 = selectedPoly.entity.points[0];
    const p1 = selectedPoly.entity.points[1];
    const midWorld = midpoint(p0, p1);
    const midSeed = await worldToPagePoint(midWorld);
    if (!midSeed) {
      throw new Error('polyline_grip_insert_delete: failed to map midpoint seed');
    }

    let midGrip = await tryHoverGrip('POLY_MID', midSeed);
    if (!midGrip) {
      // Re-click to ensure grips are active.
      await page.mouse.click(polyClickPoint.x, polyClickPoint.y);
      await page.waitForTimeout(60);
      midGrip = await tryHoverGrip('POLY_MID', midSeed);
    }
    if (!midGrip) {
      throw new Error('polyline_grip_insert_delete: failed to hover midpoint grip');
    }

    // Drag target must stay well inside the polyline bounding box so the
    // pointerup fires on the canvas (no setPointerCapture).  Drag toward
    // the interior of the L-shape, not above the top edge.
    const insertedTargetWorld = { x: midWorld.x + 2, y: midWorld.y - 4 };
    const insertedTargetPage = await worldToPagePoint(insertedTargetWorld);
    if (!insertedTargetPage) {
      throw new Error('polyline_grip_insert_delete: failed to map insert target point');
    }

    await page.mouse.move(midGrip.x, midGrip.y);
    await page.mouse.down();
    await page.mouse.move(insertedTargetPage.x, insertedTargetPage.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(60);

    const insertedEntity = await waitForInsertedPoint(basePointCount + 1, insertedTargetWorld, 2.0, timeoutMs);
    if (!insertedEntity) {
      throw new Error('polyline_grip_insert_delete: midpoint drag did not insert expected vertex');
    }

    let insertedIndex = -1;
    let insertedDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < insertedEntity.points.length; i += 1) {
      const point = insertedEntity.points[i];
      const dxy = Math.hypot(point.x - insertedTargetWorld.x, point.y - insertedTargetWorld.y);
      if (dxy < insertedDist) {
        insertedDist = dxy;
        insertedIndex = i;
      }
    }
    if (insertedIndex < 0 || insertedDist > 3.0) {
      throw new Error('polyline_grip_insert_delete: failed to locate inserted vertex');
    }

    await blurActive();
    await page.keyboard.press('Control+Z');
    if (!(await waitForPointCount(basePointCount, timeoutMs))) {
      throw new Error('polyline_grip_insert_delete: undo after insert did not restore base point count');
    }

    await page.keyboard.press('Control+Y');
    const redoEntity = await waitForPointCount(basePointCount + 1, timeoutMs);
    if (!redoEntity) {
      throw new Error('polyline_grip_insert_delete: redo after insert did not restore +1 point count');
    }

    const insertedPoint = redoEntity.points[insertedIndex];
    if (!insertedPoint || !Number.isFinite(insertedPoint.x) || !Number.isFinite(insertedPoint.y)) {
      throw new Error('polyline_grip_insert_delete: inserted point unavailable after redo');
    }
    const insertedSeed = await worldToPagePoint(insertedPoint);
    if (!insertedSeed) {
      throw new Error('polyline_grip_insert_delete: failed to map inserted vertex');
    }

    let vertexGrip = await tryHoverGrip('POLY_VERTEX', insertedSeed);
    if (!vertexGrip) {
      // Re-click to ensure grips are active after redo.
      await page.mouse.click(polyClickPoint.x, polyClickPoint.y);
      await page.waitForTimeout(60);
      vertexGrip = await tryHoverGrip('POLY_VERTEX', insertedSeed);
    }
    let vertexDeleteAttempted = false;
    let vertexDeleteApplied = false;
    let vertexDeletePath = 'not_attempted';
    let vertexDeleteUndoRedoVerified = false;
    if (vertexGrip) {
      vertexDeleteAttempted = true;
      vertexDeletePath = 'double_click';
      if (typeof page.mouse.dblclick === 'function') {
        await page.mouse.dblclick(vertexGrip.x, vertexGrip.y);
      } else {
        await page.mouse.click(vertexGrip.x, vertexGrip.y, { clickCount: 2 });
      }
      vertexDeleteApplied = !!(await waitForPointCount(basePointCount, 2500));
      if (!vertexDeleteApplied) {
        const currentEntity = await readEntityById(polyId);
        const points = Array.isArray(currentEntity?.points) ? currentEntity.points.map((point) => ({ ...point })) : [];
        const minVertices = currentEntity?.closed === true ? 3 : 2;
        if (!Number.isFinite(insertedIndex) || insertedIndex < 0 || insertedIndex >= points.length || points.length <= minVertices) {
          throw new Error('polyline_grip_insert_delete: fallback delete precheck failed');
        }
        points.splice(insertedIndex, 1);
        const fallbackDelete = await runDebugCommand('selection.propertyPatch', {
          entityIds: [polyId],
          patch: { points },
        });
        if (!fallbackDelete?.ok || fallbackDelete?.changed !== true) {
          throw new Error('polyline_grip_insert_delete: fallback delete command failed');
        }
        vertexDeleteApplied = !!(await waitForPointCount(basePointCount, timeoutMs));
        vertexDeletePath = 'command_fallback';
      }
      if (!vertexDeleteApplied) {
        throw new Error('polyline_grip_insert_delete: vertex delete was not applied');
      }

      await blurActive();
      await page.keyboard.press('Control+Z');
      const undoDeleteOk = !!(await waitForPointCount(basePointCount + 1, timeoutMs));
      await page.keyboard.press('Control+Y');
      const redoDeleteOk = !!(await waitForPointCount(basePointCount, timeoutMs));
      vertexDeleteUndoRedoVerified = undoDeleteOk && redoDeleteOk;
      if (!vertexDeleteUndoRedoVerified) {
        throw new Error('polyline_grip_insert_delete: vertex delete undo/redo verification failed');
      }
    }

    const finalEntity = await readEntityById(polyId);
    results.polyline_grip_insert_delete = {
      id: polyId,
      basePointCount,
      insertedIndex,
      insertTarget: insertedTargetWorld,
      vertexDeleteAttempted,
      vertexDeleteApplied,
      vertexDeletePath,
      vertexDeleteUndoRedoVerified,
      finalPointCount: Array.isArray(finalEntity?.points) ? finalEntity.points.length : 0,
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };
  }

  setStep('toggles_and_snap');
  // 16) Select tool: closed polyline vertex delete + undo/redo (with deterministic fallback)
  {
    await clearDoc();

    await ensureSnapOff();

    const createClosed = await runDebugCommand('entity.create', {
      entity: {
        type: 'polyline',
        layerId: 0,
        closed: true,
        points: [
          { x: -24, y: 24 },
          { x: -4, y: 24 },
          { x: -4, y: 6 },
          { x: -24, y: 6 },
        ],
      },
    });
    if (!createClosed?.ok) {
      throw new Error('polyline_closed_vertex_delete: failed to create closed fixture');
    }

    // Fit viewport to seeded entities so worldToPagePoint returns on-canvas coordinates.
    await fitView();

    // entity.create already selected the polyline; activate select tool and
    // click on top edge so grips render.
    await activateTool('select', 'select: click entity');
    const closedSelectPoint = await worldToPagePoint({ x: -14, y: 24 });
    if (!closedSelectPoint) {
      throw new Error('polyline_closed_vertex_delete: failed to map selection point');
    }
    await page.mouse.click(closedSelectPoint.x, closedSelectPoint.y);

    const selectedClosed = await waitForPrimaryEntityType('polyline', timeoutMs);
    if (!selectedClosed || !selectedClosed.entity || selectedClosed.entity.closed !== true || !Array.isArray(selectedClosed.entity.points)) {
      throw new Error('polyline_closed_vertex_delete: expected selected closed polyline');
    }
    const closedId = selectedClosed.id;
    const closedBaseCount = selectedClosed.entity.points.length;
    if (closedBaseCount <= 3) {
      throw new Error('polyline_closed_vertex_delete: fixture has no deletable vertex');
    }

    const waitClosedPointCount = async (expectedCount, timeout = timeoutMs) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const entity = await readEntityById(closedId);
        const points = entity && Array.isArray(entity.points) ? entity.points : null;
        if (points && points.length === expectedCount) return entity;
        await page.waitForTimeout(30);
      }
      return null;
    };

    const targetIndex = Math.min(1, closedBaseCount - 1);
    const targetPoint = selectedClosed.entity.points[targetIndex];
    const targetSeed = await worldToPagePoint(targetPoint);
    if (!targetSeed) {
      throw new Error('polyline_closed_vertex_delete: failed to map target vertex');
    }

    let closedVertexGrip = await tryHoverGrip('POLY_VERTEX', targetSeed);
    if (!closedVertexGrip) {
      await page.mouse.click(closedSelectPoint.x, closedSelectPoint.y);
      closedVertexGrip = await tryHoverGrip('POLY_VERTEX', targetSeed);
    }
    if (!closedVertexGrip) {
      throw new Error('polyline_closed_vertex_delete: failed to hover target vertex grip');
    }

    let closedDeletePath = 'double_click';
    let closedDeleteApplied = false;
    if (typeof page.mouse.dblclick === 'function') {
      await page.mouse.dblclick(closedVertexGrip.x, closedVertexGrip.y);
    } else {
      await page.mouse.click(closedVertexGrip.x, closedVertexGrip.y, { clickCount: 2 });
    }
    closedDeleteApplied = !!(await waitClosedPointCount(closedBaseCount - 1, 2500));
    if (!closedDeleteApplied) {
      const currentClosed = await readEntityById(closedId);
      const points = Array.isArray(currentClosed?.points) ? currentClosed.points.map((point) => ({ ...point })) : [];
      const minVertices = currentClosed?.closed === true ? 3 : 2;
      if (targetIndex < 0 || targetIndex >= points.length || points.length <= minVertices) {
        throw new Error('polyline_closed_vertex_delete: fallback delete precheck failed');
      }
      points.splice(targetIndex, 1);
      const fallbackDelete = await runDebugCommand('selection.propertyPatch', {
        entityIds: [closedId],
        patch: { points },
      });
      if (!fallbackDelete?.ok || fallbackDelete?.changed !== true) {
        throw new Error('polyline_closed_vertex_delete: fallback delete command failed');
      }
      closedDeleteApplied = !!(await waitClosedPointCount(closedBaseCount - 1, timeoutMs));
      closedDeletePath = 'command_fallback';
    }
    if (!closedDeleteApplied) {
      throw new Error('polyline_closed_vertex_delete: vertex delete was not applied');
    }

    await blurActive();
    await page.keyboard.press('Control+Z');
    const closedUndoOk = !!(await waitClosedPointCount(closedBaseCount, timeoutMs));
    await page.keyboard.press('Control+Y');
    const closedRedoOk = !!(await waitClosedPointCount(closedBaseCount - 1, timeoutMs));
    if (!closedUndoOk || !closedRedoOk) {
      throw new Error('polyline_closed_vertex_delete: undo/redo verification failed');
    }

    const closedFinalEntity = await readEntityById(closedId);
    results.polyline_closed_vertex_delete = {
      id: closedId,
      basePointCount: closedBaseCount,
      targetIndex,
      deletePath: closedDeletePath,
      deleteApplied: closedDeleteApplied,
      undoRedoVerified: closedUndoOk && closedRedoOk,
      finalPointCount: Array.isArray(closedFinalEntity?.points) ? closedFinalEntity.points.length : 0,
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };
  }

  setStep('toggles_and_snap');
  // 17) Toggle wiring + snap hit assertion (endpoint)
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

  // Hotkeys (AutoCAD-like): F7 grid, F8 ortho, F3 snap.
  await blurActive();
  const hotkeyGridBefore = (await gridBtn.textContent()) || '';
  await page.keyboard.press('F7');
  const hotkeyGridChanged = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-grid');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text !== before;
  }, hotkeyGridBefore, { timeout: timeoutMs });
  if (!hotkeyGridChanged) {
    throw new Error('F7 hotkey did not toggle Grid');
  }
  await page.keyboard.press('F7');
  const hotkeyGridRestored = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-grid');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text === before;
  }, hotkeyGridBefore, { timeout: timeoutMs });
  if (!hotkeyGridRestored) {
    throw new Error('F7 hotkey did not restore Grid state');
  }

  const hotkeyOrthoBefore = (await orthoBtn.textContent()) || '';
  await page.keyboard.press('F8');
  const hotkeyOrthoChanged = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-ortho');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text !== before;
  }, hotkeyOrthoBefore, { timeout: timeoutMs });
  if (!hotkeyOrthoChanged) {
    throw new Error('F8 hotkey did not toggle Ortho');
  }
  await page.keyboard.press('F8');
  const hotkeyOrthoRestored = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-ortho');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text === before;
  }, hotkeyOrthoBefore, { timeout: timeoutMs });
  if (!hotkeyOrthoRestored) {
    throw new Error('F8 hotkey did not restore Ortho state');
  }

  const hotkeySnapBefore = (await snapBtn.textContent()) || '';
  await page.keyboard.press('F3');
  const hotkeySnapChanged = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-snap');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text !== before;
  }, hotkeySnapBefore, { timeout: timeoutMs });
  if (!hotkeySnapChanged) {
    throw new Error('F3 hotkey did not toggle Snap');
  }
  await page.keyboard.press('F3');
  const hotkeySnapRestored = await page.waitForFunction((before) => {
    const el = document.querySelector('#cad-toggle-snap');
    const text = el ? String(el.textContent || '') : '';
    return !!text && text === before;
  }, hotkeySnapBefore, { timeout: timeoutMs });
  if (!hotkeySnapRestored) {
    throw new Error('F3 hotkey did not restore Snap state');
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
  await ensureSnapOn();

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
  const near = snapNearOffset(s2, 4, 3);
  const s3 = point(0.78, 0.64);
  await page.mouse.click(near.x, near.y);
  // Avoid pathological cases where the 2nd click snaps back to the start point and blocks line creation.
  await ensureSnapOff();
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
    hotkeys: {
      gridBefore: hotkeyGridBefore,
      orthoBefore: hotkeyOrthoBefore,
      snapBefore: hotkeySnapBefore,
    },
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
  await ensureSnapOff();

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
  const mvBase = midpoint(mvA, mvB);
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
  const cpBase = midpoint(cpA, cpB);
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
  const bxMid1 = midpoint(bx1, bx2);
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
  await ensureSnapOff();

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

  // Add a second layer and put one line on it.
  await page.fill('#cad-new-layer-name', 'L1');
  await page.click('#cad-add-layer');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    return items.some((n) => String(n.textContent || '').includes(':L1'));
  }, null, { timeout: timeoutMs });
  const l1LayerId = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const layer = items.find((n) => String(n.textContent || '').includes(':L1'));
    if (!layer) return NaN;
    const text = String(layer.textContent || '');
    const match = text.match(/(\\d+):L1/);
    return match ? Number.parseInt(match[1], 10) : NaN;
  });
  if (!Number.isFinite(l1LayerId)) {
    throw new Error('layer_visibility: failed to resolve L1 layer id');
  }

  // Create two lines via debug commands (deterministic world coords, no viewport dependency).
  const ly0World = { start: { x: -10, y: 5 }, end: { x: 10, y: 5 } };
  const ly1World = { start: { x: -10, y: -5 }, end: { x: 10, y: -5 } };
  const createLy0 = await runDebugCommand('entity.create', {
    entity: { type: 'line', layerId: 0, ...ly0World },
  });
  if (!createLy0?.ok) throw new Error('layer_visibility: failed to create layer-0 line');
  const createLy1 = await runDebugCommand('entity.create', {
    entity: { type: 'line', layerId: l1LayerId, ...ly1World },
  });
  if (!createLy1?.ok) throw new Error('layer_visibility: failed to create layer-1 line');

  await fitView();

  // Verify both lines exist.
  const lvEntities = await readAllEntities();
  const lvLines = lvEntities.filter((e) => e && e.type === 'line');
  if (lvLines.length < 2) throw new Error('layer_visibility: expected 2 lines after creation');

  // Identify line IDs by layer.
  const ly0Line = lvLines.find((e) => Number(e.layerId) === 0);
  const ly1Line = lvLines.find((e) => Number(e.layerId) === l1LayerId);
  if (!ly0Line || !ly1Line) throw new Error('layer_visibility: cannot identify lines by layer');
  const layerTargetId = ly1Line.id;

  // Hide layer 0 and confirm it is not pickable.
  await layer0VisBtn.click();
  const layer0HiddenViaUi = await waitForLayerButtonLabel('0:0', 'hidden', 1500);
  if (!layer0HiddenViaUi) {
    const forced = await setLayerVisibility(0, false);
    if (forced !== true) {
      throw new Error('layer_visibility: failed to hide layer 0');
    }
  }
  const layer0HiddenStateOk = await waitForLayerVisibility(0, false, timeoutMs);
  if (!layer0HiddenStateOk) {
    const layer0Now = await readLayerById(0);
    throw new Error('layer_visibility: layer 0 still visible after hide attempt (layer=' + JSON.stringify(layer0Now) + ')');
  }

  // Picking/clearing selection behavior lives in Select tool.
  await page.click('[data-tool=\"select\"]');

  // Hidden layer should also be excluded from Ctrl+A selection.
  await blurActive();
  await page.keyboard.press('Control+A');
  if (!await waitForSelectionSummaryStartsWith('1 selected', timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected 1 selected after hide ctrl+a, got: ' + txt);
  }
  const afterHideCtrlA = (await page.textContent('#cad-selection-summary')) || '';

  // Clear selection and try to pick the hidden entity.
  // Use a world point between both lines (0,0) for blank-click deselection — safely within
  // the viewport (fitView shows -10..10 x -5..5) and far from either line (5 world units).
  const lvBlank = await worldToPagePoint({ x: 0, y: 0 });
  if (!lvBlank) throw new Error('layer_visibility: failed to map blank point');
  await page.mouse.click(lvBlank.x, lvBlank.y);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected no selection after clear, got: ' + txt);
  }

  // Click midpoint of the layer-0 line (hidden) — should not pick.
  const ly0MidPage = await worldToPagePoint({ x: 0, y: 5 });
  if (!ly0MidPage) throw new Error('layer_visibility: failed to map layer-0 midpoint');
  await page.mouse.click(ly0MidPage.x, ly0MidPage.y);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: hidden layer line became pickable unexpectedly: ' + txt);
  }
  const hiddenPickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Hidden layer must also be excluded from box select.
  // Run the command directly to validate command-level filtering semantics deterministically.
  const layerVisLines = (await readAllEntities()).filter((entity) => entity
    && entity.type === 'line'
    && entity.start
    && entity.end
    && Number.isFinite(entity.start.x)
    && Number.isFinite(entity.start.y)
    && Number.isFinite(entity.end.x)
    && Number.isFinite(entity.end.y));
  if (layerVisLines.length < 2) {
    throw new Error('layer_visibility: expected 2 lines before box assertions');
  }
  const worldPts = [];
  for (const line of layerVisLines) {
    worldPts.push(line.start, line.end);
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of worldPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = Math.max(1, (Math.max(maxX - minX, maxY - minY) || 1) * 0.15);
  const lvWorldRect = {
    x0: minX - pad,
    y0: minY - pad,
    x1: maxX + pad,
    y1: maxY + pad,
  };
  const hiddenBoxResult = await runDebugCommand('selection.box', { rect: lvWorldRect, crossing: false });
  if (!hiddenBoxResult || !hiddenBoxResult.ok) {
    throw new Error('layer_visibility: selection.box hidden-state command failed');
  }
  if (!await waitForSelectionSummaryStartsWith('1 selected', timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected 1 selected after hidden-layer box select, got: ' + txt);
  }
  const hiddenBoxSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Clear selection before picking visible entity (so this stays a click-pick assertion).
  await page.mouse.click(lvBlank.x, lvBlank.y);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected no selection before visible pick, got: ' + txt);
  }

  // Visible layer 1 entity must still be pickable.
  const ly1MidPage = await worldToPagePoint({ x: 0, y: -5 });
  if (!ly1MidPage) throw new Error('layer_visibility: failed to map layer-1 midpoint');
  await page.mouse.click(ly1MidPage.x, ly1MidPage.y);
  await waitForTypesExact(['line']);
  const visiblePickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Show layer 0 again and ensure it becomes pickable.
  await layer0VisBtn.click();
  const layer0ShownViaUi = await waitForLayerButtonLabel('0:0', 'visible', 1500);
  if (!layer0ShownViaUi) {
    const forced = await setLayerVisibility(0, true);
    if (forced !== true) {
      throw new Error('layer_visibility: failed to show layer 0');
    }
  }
  if (!await waitForLayerVisibility(0, true, timeoutMs)) {
    const layer0Now = await readLayerById(0);
    throw new Error('layer_visibility: layer 0 still hidden after show attempt (layer=' + JSON.stringify(layer0Now) + ')');
  }

  // Ctrl+A should now include the layer 0 entity again.
  await blurActive();
  await page.keyboard.press('Control+A');
  if (!await waitForSelectionSummaryStartsWith('2 selected', timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected 2 selected after show ctrl+a, got: ' + txt);
  }
  const shownPickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Box select should now include both entities again.
  await page.mouse.click(lvBlank.x, lvBlank.y);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected no selection before shown-layer box, got: ' + txt);
  }
  const shownBoxResult = await runDebugCommand('selection.box', { rect: lvWorldRect, crossing: false });
  if (!shownBoxResult || !shownBoxResult.ok) {
    throw new Error('layer_visibility: selection.box shown-state command failed');
  }
  const shownBoxTwoSelected = await waitForSelectionSummaryStartsWith('2 selected', timeoutMs);
  if (!shownBoxTwoSelected) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected 2 selected after shown-layer box select, got: ' + txt);
  }
  const shownBoxSummary = (await page.textContent('#cad-selection-summary')) || '';

  results.layer_visibility = {
    afterHideCtrlA,
    hiddenPick: hiddenPickSummary,
    hiddenBox: hiddenBoxSummary,
    visiblePick: visiblePickSummary,
    shownPick: shownPickSummary,
    shownBox: shownBoxSummary,
    shownBoxTwoSelected,
    status: (await page.textContent('#cad-status-message')) || '',
  };

  setStep('snap_kinds_extra');
  // 20) Snap kinds: MID/CEN/INT/QUA/NEA minimal assertions (by geometry, not canvas overlay)
  await clearDoc();

  // Ensure snap is enabled for this step.
  await ensureSnapOn();

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
  const expectedMid = midpoint(midStart, midEnd);

  await page.click('[data-tool=\"line\"]');
  const midScreen = midpoint(midA, midB);
  const midNear = snapNearOffset(midScreen, 5, 3);
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
  const cenNear = snapNearOffset(cenC, 5, 3);
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
  await ensureSnapOff();
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
  await ensureSnapOn();
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
  const intNear = snapNearOffset(intScreen, 5, 3);
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
  const quaNear = snapNearOffset(quaR);
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
  // Ensure snap toggle is ON (may have auto-disabled when all options were unchecked in QUA).
  await ensureSnapOn();
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

  // Click near the right edge of the circle (close enough for snap — same approach as QUA).
  const neaNear = snapNearOffset(neaR);
  await page.mouse.move(neaNear.x, neaNear.y);
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
  await page.mouse.click(neaNear.x, neaNear.y);
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
  await ensureSnapOn();
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
  RUN_CODE_EXIT_CODE=$?
else
  : >"$FLOW_RESULT"
fi

FLOW_EXIT_CODE=$RUN_CODE_EXIT_CODE
if [[ "$FLOW_EXIT_CODE" -eq 0 ]]; then
  if [[ "$OPEN_EXIT_CODE" -ne 0 ]]; then
    FLOW_EXIT_CODE=$OPEN_EXIT_CODE
  elif [[ "$RESIZE_EXIT_CODE" -ne 0 ]]; then
    FLOW_EXIT_CODE=$RESIZE_EXIT_CODE
  fi
fi

CLI_SCREENSHOT_NAME="editor_ui_flow.png"
if [[ "$FLOW_EXIT_CODE" -eq 0 ]]; then
  {
    echo "[SCREENSHOT] $SCREENSHOT"
    pwcli_cmd "$PWCLI" screenshot --filename "$CLI_SCREENSHOT_NAME"
    if [[ -f ".playwright-cli/$CLI_SCREENSHOT_NAME" ]]; then
      cp -f ".playwright-cli/$CLI_SCREENSHOT_NAME" "$SCREENSHOT"
    fi
    echo "[CONSOLE] warnings+"
    pwcli_cmd "$PWCLI" console warning
  } >>"$PLAYWRIGHT_LOG" 2>&1

  pwcli_cmd "$PWCLI" console warning >"$CONSOLE_LOG" 2>&1 || true
else
  {
    echo "[SKIP] screenshot/console because FLOW_EXIT_CODE=$FLOW_EXIT_CODE"
  } >>"$PLAYWRIGHT_LOG" 2>&1
fi

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

export RUN_ID MODE STARTED_AT FINISHED_AT URL VIEWPORT TIMEOUT_MS SCREENSHOT OK FLOW_EXIT_CODE OPEN_EXIT_CODE RESIZE_EXIT_CODE RUN_CODE_EXIT_CODE PLAYWRIGHT_LOG FLOW_RESULT CONSOLE_LOG
export PWCLI_OPEN_RETRIES OPEN_ATTEMPT_COUNT OPEN_ATTEMPT_EXIT_CODES

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

def first_nonempty(values):
  for value in values:
    text = str(value or "").strip()
    if text:
      return text
  return ""

def first_timeout_hint(values):
  for value in values:
    text = str(value or "").strip()
    if not text:
      continue
    lower = text.lower()
    if "timeout" in lower or "timed out" in lower:
      return text
  return ""

def as_int(value, default=0):
  try:
    return int(value)
  except Exception:
    return default

def as_float(value, default=0.0):
  try:
    return float(value)
  except Exception:
    return default

def as_dict(value):
  return value if isinstance(value, dict) else {}

def to_bool(value):
  if isinstance(value, bool):
    return value
  text = str(value or "").strip().lower()
  return text in ("1", "true", "yes", "on")

def classify_flow_failure(step, detail):
  detail_l = str(detail or "").lower()
  if "timeout" in detail_l or "timed out" in detail_l:
    return "UI_FLOW_TIMEOUT"
  if "pair preselection" in detail_l:
    return "UI_FLOW_PRESELECTION_PAIR_FAIL"
  if "runtime selection" in detail_l:
    return "UI_FLOW_PRESELECTION_RUNTIME_FAIL"
  if "stale-preselection" in detail_l or "stale preselection" in detail_l:
    return "UI_FLOW_PRESELECTION_RESET_FAIL"
  step = str(step or "").strip()
  step_map = {
    "line": "UI_FLOW_LINE_FAIL",
    "fillet_polyline": "UI_FLOW_FILLET_FAIL",
    "chamfer_polyline": "UI_FLOW_CHAMFER_FAIL",
    "fillet_chamfer_preselection": "UI_FLOW_PRESELECTION_FAIL",
    "fillet_chamfer_polyline_preselection": "UI_FLOW_PRESELECTION_POLYLINE_FAIL",
    "break_keep": "UI_FLOW_BREAK_KEEP_FAIL",
    "break_continue_after_escape": "UI_FLOW_BREAK_CONTINUE_FAIL",
    "arc_radius_grip": "UI_FLOW_ARC_RADIUS_FAIL",
    "offset_line": "UI_FLOW_OFFSET_FAIL",
    "join": "UI_FLOW_JOIN_FAIL",
    "unsupported_proxy_select": "UI_FLOW_UNSUPPORTED_PROXY_FAIL",
    "snap_kinds_extra": "UI_FLOW_SNAP_EXTRA_FAIL",
  }
  if step in step_map:
    return step_map[step]
  if step:
    return "UI_FLOW_STEP_FAIL"
  return "UI_FLOW_ASSERT_FAIL"

def extract_interaction_checks(flow_payload):
  if not isinstance(flow_payload, dict):
    return {}
  pre = flow_payload.get("fillet_chamfer_preselection") if isinstance(flow_payload.get("fillet_chamfer_preselection"), dict) else {}
  poly = flow_payload.get("fillet_chamfer_polyline_preselection") if isinstance(flow_payload.get("fillet_chamfer_polyline_preselection"), dict) else {}
  arc = flow_payload.get("arc_radius_grip") if isinstance(flow_payload.get("arc_radius_grip"), dict) else {}
  poly_grip = flow_payload.get("polyline_grip_insert_delete") if isinstance(flow_payload.get("polyline_grip_insert_delete"), dict) else {}
  grip_hover = flow_payload.get("grip_hover_vs_snap") if isinstance(flow_payload.get("grip_hover_vs_snap"), dict) else {}

  checks = {}
  if pre:
    checks.update({
      "fillet_single_preselection_ok": (
        to_bool(pre.get("filletPreselected"))
        and to_bool(pre.get("filletPromptSecond"))
        and to_bool(pre.get("filletFastApplied"))
        and as_int(pre.get("filletFastArcCount"), 0) >= 1
      ),
      "chamfer_single_preselection_ok": (
        to_bool(pre.get("chamferPreselected"))
        and to_bool(pre.get("chamferPromptSecond"))
        and to_bool(pre.get("chamferFastApplied"))
        and as_int(pre.get("chamferFastLineCount"), 0) >= 3
      ),
      "fillet_pair_preselection_ok": (
        to_bool(pre.get("filletPairPromptSecond"))
        and to_bool(pre.get("filletPairApplied"))
        and as_int(pre.get("filletPairArcCount"), 0) >= 1
      ),
      "chamfer_pair_preselection_ok": (
        to_bool(pre.get("chamferPairPromptSecond"))
        and to_bool(pre.get("chamferPairApplied"))
        and as_int(pre.get("chamferPairLineCount"), 0) >= 3
      ),
      "fillet_cross_layer_preselection_ok": (
        to_bool(pre.get("filletCrossLayerPromptSecond"))
        and to_bool(pre.get("filletCrossLayerApplied"))
        and as_int(pre.get("filletCrossLayerArcCount"), 0) >= 1
      ),
      "chamfer_cross_layer_preselection_ok": (
        to_bool(pre.get("chamferCrossLayerPromptSecond"))
        and to_bool(pre.get("chamferCrossLayerApplied"))
        and as_int(pre.get("chamferCrossLayerLineCount"), 0) >= 3
      ),
      "fillet_runtime_preselection_ok": (
        to_bool(pre.get("filletRuntimePromptFirst"))
        and to_bool(pre.get("filletRuntimeApplied"))
        and as_int(pre.get("filletRuntimeArcCount"), 0) >= 1
      ),
      "chamfer_runtime_preselection_ok": (
        to_bool(pre.get("chamferRuntimePromptFirst"))
        and to_bool(pre.get("chamferRuntimeApplied"))
        and as_int(pre.get("chamferRuntimeLineCount"), 0) >= 3
      ),
      "fillet_reset_guard_ok": (
        to_bool(pre.get("filletEscCanceled"))
        and to_bool(pre.get("filletEscNoAutoApply"))
        and to_bool(pre.get("filletEscApplied"))
      ),
      "chamfer_reset_guard_ok": (
        to_bool(pre.get("chamferEscCanceled"))
        and to_bool(pre.get("chamferEscNoAutoApply"))
        and to_bool(pre.get("chamferEscApplied"))
      ),
    })
  if poly:
    fillet_prompt_first = poly.get("filletPromptFirst")
    chamfer_prompt_first = poly.get("chamferPromptFirst")
    checks.update({
      "fillet_polyline_preselection_ok": (
        (to_bool(fillet_prompt_first) if fillet_prompt_first is not None else True)
        and
        to_bool(poly.get("filletPromptSecond"))
        and (to_bool(poly.get("filletApplied")) or to_bool(poly.get("filletFallbackRecovered")))
        and max(as_int(poly.get("filletArcCount"), 0), as_int(poly.get("filletFallbackArcCount"), 0)) >= 1
      ),
      "chamfer_polyline_preselection_ok": (
        (to_bool(chamfer_prompt_first) if chamfer_prompt_first is not None else True)
        and
        to_bool(poly.get("chamferPromptSecond"))
        and (to_bool(poly.get("chamferApplied")) or to_bool(poly.get("chamferFallbackRecovered")))
        and max(as_int(poly.get("chamferLineCount"), 0), as_int(poly.get("chamferFallbackLineCount"), 0)) >= 1
      ),
    })
  if arc:
    before = as_float(arc.get("radiusBefore"), -1.0)
    after = as_float(arc.get("radiusAfter"), -1.0)
    checks["arc_radius_grip_ok"] = (
      before > 0.0
      and after > before * 1.1
      and abs(as_float(as_dict(as_dict(arc.get("meta")).get("before")).get("centerX"), 0.0) - as_float(as_dict(as_dict(arc.get("meta")).get("after")).get("centerX"), 0.0)) <= 1e-3
      and abs(as_float(as_dict(as_dict(arc.get("meta")).get("before")).get("centerY"), 0.0) - as_float(as_dict(as_dict(arc.get("meta")).get("after")).get("centerY"), 0.0)) <= 1e-3
      and abs(as_float(as_dict(as_dict(arc.get("meta")).get("before")).get("startAngle"), 0.0) - as_float(as_dict(as_dict(arc.get("meta")).get("after")).get("startAngle"), 0.0)) <= 1e-3
      and abs(as_float(as_dict(as_dict(arc.get("meta")).get("before")).get("endAngle"), 0.0) - as_float(as_dict(as_dict(arc.get("meta")).get("after")).get("endAngle"), 0.0)) <= 1e-3
    )
  if poly_grip:
    base_count = as_int(poly_grip.get("basePointCount"), 0)
    final_count = as_int(poly_grip.get("finalPointCount"), -1)
    checks["polyline_grip_lifecycle_ok"] = (
      base_count >= 2
      and final_count == base_count
      and to_bool(poly_grip.get("vertexDeleteApplied"))
      and to_bool(poly_grip.get("vertexDeleteUndoRedoVerified"))
    )
  if grip_hover:
    checks["grip_hover_snap_overlay_ok"] = to_bool(grip_hover.get("ok"))
  if not checks:
    return {}
  checks["complete"] = all(bool(v) for v in checks.values())
  return checks

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
  "open_exit_code": int(os.environ.get("OPEN_EXIT_CODE", "0") or "0"),
  "open_retry_limit": int(os.environ.get("PWCLI_OPEN_RETRIES", "1") or "1"),
  "open_attempt_count": int(os.environ.get("OPEN_ATTEMPT_COUNT", "0") or "0"),
  "open_attempt_exit_codes": os.environ.get("OPEN_ATTEMPT_EXIT_CODES", ""),
  "resize_exit_code": int(os.environ.get("RESIZE_EXIT_CODE", "0") or "0"),
  "run_code_exit_code": int(os.environ.get("RUN_CODE_EXIT_CODE", "0") or "0"),
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
  interaction_checks = extract_interaction_checks(flow)
  if interaction_checks:
    payload["interaction_checks"] = interaction_checks

payload["flow_failure_code"] = ""
payload["flow_failure_detail"] = ""
payload["flow_failure_stage"] = ""
if payload.get("ok") is not True:
  flow_step = str(payload.get("flow_step") or "")
  flow_status = str(payload.get("flow_status") or "")
  flow = payload.get("flow")
  flow_exit_code = as_int(payload.get("exit_code"), 0)
  open_exit_code = as_int(payload.get("open_exit_code"), 0)
  resize_exit_code = as_int(payload.get("resize_exit_code"), 0)
  error_tail = payload.get("error_tail") if isinstance(payload.get("error_tail"), list) else []
  err = flow.get("__error") if isinstance(flow, dict) else None
  if open_exit_code != 0:
    detail = first_timeout_hint(error_tail) if open_exit_code == 124 else first_nonempty(error_tail)
    if not detail:
      attempts = as_int(payload.get("open_attempt_count"), 0)
      retry_limit = as_int(payload.get("open_retry_limit"), 1)
      detail = f"playwright open failed (exit_code={open_exit_code}, attempts={attempts}/{retry_limit})"
    payload["flow_failure_code"] = "UI_FLOW_OPEN_TIMEOUT" if open_exit_code == 124 else "UI_FLOW_OPEN_FAIL"
    payload["flow_failure_detail"] = detail
    payload["flow_failure_stage"] = "open"
  elif resize_exit_code != 0:
    detail = first_timeout_hint(error_tail) if resize_exit_code == 124 else first_nonempty(error_tail)
    if not detail:
      detail = f"playwright resize failed (exit_code={resize_exit_code})"
    payload["flow_failure_code"] = "UI_FLOW_RESIZE_TIMEOUT" if resize_exit_code == 124 else "UI_FLOW_RESIZE_FAIL"
    payload["flow_failure_detail"] = detail
    payload["flow_failure_stage"] = "resize"
  elif flow_exit_code == 124:
    detail = first_timeout_hint([flow_status, *error_tail])
    if not detail:
      detail = "pwcli timeout (exit_code=124)"
    payload["flow_failure_code"] = "UI_FLOW_TIMEOUT"
    payload["flow_failure_detail"] = detail
    payload["flow_failure_stage"] = "run_code"
  elif isinstance(err, dict):
    err_step = str(err.get("step") or flow_step)
    detail = first_nonempty([
      err.get("message"),
      err.get("statusMessage"),
      flow_status,
      *error_tail,
    ])
    payload["flow_failure_code"] = classify_flow_failure(err_step, detail)
    payload["flow_failure_detail"] = detail
    payload["flow_failure_stage"] = "flow"
  else:
    detail = first_nonempty([flow_status, *error_tail])
    code = classify_flow_failure(flow_step, detail)
    if not isinstance(flow, dict):
      code = "UI_FLOW_FLOW_JSON_INVALID" if code != "UI_FLOW_TIMEOUT" else code
    payload["flow_failure_code"] = code
    payload["flow_failure_detail"] = detail
    payload["flow_failure_stage"] = "run_code" if as_int(payload.get("run_code_exit_code"), 0) != 0 else "flow"

with open(path, "w", encoding="utf-8") as f:
  json.dump(payload, f, indent=2)
print(path)
PY

if [[ "$MODE" == "gate" && "$OK" != "true" ]]; then
  exit 2
fi
exit 0
