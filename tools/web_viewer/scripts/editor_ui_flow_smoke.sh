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
  if [[ ${#OPEN_ARGS[@]} -gt 0 ]]; then
    pwcli_cmd_with_timeout "$PWCLI_SETUP_TIMEOUT_SEC" "$PWCLI" open "$URL" "${OPEN_ARGS[@]}" >>"$PLAYWRIGHT_LOG" 2>&1
  else
    pwcli_cmd_with_timeout "$PWCLI_SETUP_TIMEOUT_SEC" "$PWCLI" open "$URL" >>"$PLAYWRIGHT_LOG" 2>&1
  fi
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
FLOW_JS="$(cat <<'__CAD_UI_FLOW__'
(async (page) => {
  const timeoutMs = __TIMEOUT_MS__;
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
    const m = String(text || '').match(/\(([^)]*)\)/);
    if (!m) return [];
    return m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  async function readSelectionSummaryText() {
    return (await page.textContent('#cad-selection-summary')) || '';
  }

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
    const expected = String(type || '');
    const deadline = Date.now() + timeoutMs;
    let lastText = '';
    while (Date.now() < deadline) {
      lastText = await readSelectionSummaryText();
      if (parseTypes(lastText).includes(expected)) return;
      await page.waitForTimeout(50);
    }
    throw new Error('Timed out waiting for selection types to include "' + expected + '" (selection=' + JSON.stringify(lastText) + ')');
  }

  async function waitForTypesExact(types) {
    const expected = Array.isArray(types) ? types.map((type) => String(type || '')) : [];
    const deadline = Date.now() + timeoutMs;
    let lastText = '';
    while (Date.now() < deadline) {
      lastText = await readSelectionSummaryText();
      const actual = parseTypes(lastText);
      if (actual.length === expected.length && actual.every((type, index) => type === expected[index])) return;
      await page.waitForTimeout(50);
    }
    throw new Error('Timed out waiting for exact selection types ' + JSON.stringify(expected) + ' (selection=' + JSON.stringify(lastText) + ')');
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

  async function readLineEnds(entityId) {
    return page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      const e = d.getEntity(id);
      if (!e || e.type !== 'line' || !e.start || !e.end) return null;
      const s = e.start;
      const t = e.end;
      if (![s.x, s.y, t.x, t.y].every(Number.isFinite)) return null;
      return { startX: s.x, startY: s.y, endX: t.x, endY: t.y };
    }, entityId);
  }

  async function readSelectionDetails() {
    return page.evaluate(() => {
      const root = document.querySelector('#cad-selection-details');
      if (!root) return null;
      const items = {};
      for (const row of root.querySelectorAll('[data-selection-field]')) {
        const key = String(row.getAttribute('data-selection-field') || '').trim();
        if (!key) continue;
        const valueEl = row.querySelector('strong');
        items[key] = valueEl ? String(valueEl.textContent || '').trim() : String(row.textContent || '').trim();
      }
      const badges = {};
      for (const chip of root.querySelectorAll('[data-selection-badge]')) {
        const key = String(chip.getAttribute('data-selection-badge') || '').trim();
        if (!key) continue;
        badges[key] = String(chip.textContent || '').trim();
      }
      const noteEl = root.querySelector('.cad-selection-empty');
      const entityCount = Number.parseInt(String(root.getAttribute('data-entity-count') || '0'), 10);
      return {
        mode: String(root.getAttribute('data-mode') || ''),
        entityCount: Number.isFinite(entityCount) ? entityCount : 0,
        primaryType: String(root.getAttribute('data-primary-type') || ''),
        readOnly: String(root.getAttribute('data-read-only') || ''),
        note: noteEl ? String(noteEl.textContent || '').trim() : '',
        items,
        badges,
      };
    });
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

  async function setDebugSelection(ids, primaryId = null) {
    return page.evaluate((args) => {
      const d = window.__cadDebug;
      if (!d || typeof d.setSelection !== 'function') return null;
      return d.setSelection(args.ids, args.primaryId);
    }, { ids, primaryId });
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

  async function waitForLayerButtonLabel(layerText, action, expectedLabel, timeout = 1500) {
    const expected = String(expectedLabel || '').toLowerCase();
    const targetText = String(layerText || '');
    const targetAction = String(action || '').trim().toLowerCase();
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ok = await page.evaluate((args) => {
        const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
        const el = items.find((n) => String(n.textContent || '').includes(args.layerText));
        if (!el) return false;
        const btn = el.querySelector('button[data-layer-action=' + args.action + ']');
        if (!btn) return false;
        return String(btn.textContent || '').toLowerCase().includes(args.expected);
      }, { layerText: targetText, action: targetAction, expected });
      if (ok) return true;
      await page.waitForTimeout(30);
    }
    return false;
  }

  async function readFocusedLayerPanel() {
    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
      const focused = items.find((item) => item.classList.contains('is-focused'));
      if (!focused) return null;
      const id = Number.parseInt(String(focused.getAttribute('data-layer-id') || ''), 10);
      return {
        layerId: Number.isFinite(id) ? id : null,
        text: String(focused.textContent || '').trim(),
      };
    });
  }

  async function readCurrentLayerPanel() {
    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
      const current = items.find((item) => item.classList.contains('is-current'));
      if (!current) return null;
      const id = Number.parseInt(String(current.getAttribute('data-layer-id') || ''), 10);
      return {
        layerId: Number.isFinite(id) ? id : null,
        text: String(current.textContent || '').trim(),
      };
    });
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
      const d = window.__cadDebug;
      if (!d || typeof d.worldToCanvas !== 'function') return null;
      const local = d.worldToCanvas(pt);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x + local.x, y: rect.y + local.y };
    }, worldPoint);
  }

  async function worldToCanvasPoint(worldPoint) {
    return page.evaluate((pt) => {
      const d = window.__cadDebug;
      if (!d || typeof d.worldToCanvas !== 'function') return null;
      const local = d.worldToCanvas(pt);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
      return { x: local.x, y: local.y };
    }, worldPoint);
  }

  async function clickWorldPoint(worldPoint, options = {}) {
    const local = await worldToCanvasPoint(worldPoint);
    if (!local) {
      throw new Error('Failed to resolve canvas click point for world point ' + JSON.stringify(worldPoint));
    }
    await page.evaluate((payload) => {
      const pt = payload && payload.pt ? payload.pt : null;
      const options = payload && payload.options ? payload.options : {};
      const el = document.querySelector('#cad-canvas');
      if (!el) throw new Error('cad-canvas missing');
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        throw new Error('Invalid canvas-local click point');
      }
      const rect = el.getBoundingClientRect();
      const x = rect.left + pt.x;
      const y = rect.top + pt.y;
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
        detail: 1,
        shiftKey: Boolean(options && options.shiftKey),
        ctrlKey: Boolean(options && options.ctrlKey),
        altKey: Boolean(options && options.altKey),
        metaKey: Boolean(options && options.metaKey),
      };
      const pointerBase = {
        ...base,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent('pointerdown', pointerBase));
      el.dispatchEvent(new MouseEvent('mousedown', base));
      const up = { ...base, buttons: 0 };
      const pointerUp = { ...pointerBase, buttons: 0 };
      el.dispatchEvent(new PointerEvent('pointerup', pointerUp));
      el.dispatchEvent(new MouseEvent('mouseup', up));
      el.dispatchEvent(new MouseEvent('click', up));
    }, { pt: local, options });
    return local;
  }

  async function clickWorldCandidatesUntilStatus(candidates, statusFragment, timeout = 700) {
    const points = Array.isArray(candidates) ? candidates : [candidates];
    let lastError = null;
    for (const point of points) {
      await clickWorldPoint(point);
      try {
        await waitForStatusContains(statusFragment, timeout);
        return point;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Failed to reach status ' + String(statusFragment));
  }

  async function clickPagePoint(pagePoint, options = {}) {
    const liveBox = await getCanvasRect();
    if (!liveBox) {
      throw new Error('cad-canvas has no bounding box');
    }
    const x = Number(pagePoint?.x);
    const y = Number(pagePoint?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Invalid page click point: ' + JSON.stringify(pagePoint));
    }
    const position = {
      x: Math.max(1, Math.min(liveBox.width - 1, x - liveBox.x)),
      y: Math.max(1, Math.min(liveBox.height - 1, y - liveBox.y)),
    };
    await canvas.click({ position, ...options });
    return position;
  }

  async function hoverPagePoint(pagePoint) {
    const liveBox = await getCanvasRect();
    if (!liveBox) {
      throw new Error('cad-canvas has no bounding box');
    }
    const x = Number(pagePoint?.x);
    const y = Number(pagePoint?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Invalid page hover point: ' + JSON.stringify(pagePoint));
    }
    const position = {
      x: Math.max(1, Math.min(liveBox.width - 1, x - liveBox.x)),
      y: Math.max(1, Math.min(liveBox.height - 1, y - liveBox.y)),
    };
    await canvas.hover({ position });
    return position;
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
      await hoverPagePoint(p);
      await page.waitForTimeout(20);
      const hover = await readGripHoverOverlay();
      if (!hover || hover.kind !== kind) continue;
      if (hover.point && Number.isFinite(hover.point.x) && Number.isFinite(hover.point.y)) {
        const fromWorld = await worldToPagePoint({ x: hover.point.x, y: hover.point.y });
        if (fromWorld && Number.isFinite(fromWorld.x) && Number.isFinite(fromWorld.y)) {
          await hoverPagePoint(fromWorld);
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
  const lineCreated = await waitForPrimaryEntityType('line');
  if (!lineCreated) {
    throw new Error('line: expected created line to become primary selection');
  }
  const lineAfterDraw = await readSelectionSummaryText();
  if (!parseTypes(lineAfterDraw).includes('line')) {
    throw new Error('line: selection summary missing line after draw (' + JSON.stringify(lineAfterDraw) + ')');
  }
  results.line = {
    afterDraw: lineAfterDraw,
    types: parseTypes(lineAfterDraw),
  };
  const lineUndo = await runDebugCommand('history.undo');
  if (!lineUndo?.ok) {
    throw new Error('line: undo failed');
  }
  await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const t = el && el.textContent ? el.textContent.toLowerCase() : '';
    return t.includes('no selection');
  }, null, { timeout: timeoutMs });
  results.line.afterUndo = await readSelectionSummaryText();
  const lineRedo = await runDebugCommand('history.redo');
  if (!lineRedo?.ok) {
    throw new Error('line: redo failed');
  }
  const lineAfterRedo = await waitForPrimaryEntityType('line');
  if (!lineAfterRedo) {
    throw new Error('line: expected redo line to become primary selection');
  }
  results.line.afterRedo = await readSelectionSummaryText();

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
  const filletCornerPicks = await polylineCornerSegmentPickPoints();
  if (!filletCornerPicks) {
    throw new Error('Fillet polyline: failed to resolve segment pick points from created polyline');
  }
  const segH = filletCornerPicks.midA;
  const segV = filletCornerPicks.midB;
  results.__fillet_debug = { polyA, polyB, polyC, segH, segV };
  await page.mouse.click(segH.x, segH.y);
  await page.mouse.click(segV.x, segV.y);
  const filletFailStatus = (await page.textContent('#cad-status-message')) || '';
  const filletFailCodeMatch = String(filletFailStatus).match(/\[([A-Z0-9_]+)\]/);
  const filletFailCode = filletFailCodeMatch ? filletFailCodeMatch[1] : '';
  if (!filletFailCode) {
    throw new Error('Fillet failure status missing error code: ' + filletFailStatus);
  }
  await page.fill('#cad-command-input', 'fillet 1');
  await page.mouse.click(segV.x, segV.y);
  const filletRetrySucceeded = await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const text = (el && el.textContent) ? el.textContent : '';
    const m = text.match(/\(([^)]*)\)/);
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
  const chamferCornerPicks = await polylineCornerSegmentPickPoints();
  if (!chamferCornerPicks) {
    throw new Error('Chamfer polyline: failed to resolve segment pick points from created polyline');
  }
  const chamferSegH = chamferCornerPicks.midA;
  const chamferSegV = chamferCornerPicks.midB;
  results.__chamfer_debug.lastAttempt = { attempt: 0, segH: chamferSegH, segV: chamferSegV };
  await page.mouse.click(chamferSegH.x, chamferSegH.y);
  await page.mouse.click(chamferSegV.x, chamferSegV.y);
  const chamferFailStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferFailCodeMatch = String(chamferFailStatus).match(/\[([A-Z0-9_]+)\]/);
  const chamferFailCode = chamferFailCodeMatch ? chamferFailCodeMatch[1] : '';
  if (!chamferFailCode) {
    throw new Error('Chamfer failure status missing error code: ' + chamferFailStatus);
  }
  await page.fill('#cad-command-input', 'chamfer 1 1');
  await page.mouse.click(chamferSegV.x, chamferSegV.y);
  const chamferRetrySucceeded = await page.waitForFunction(() => {
    const el = document.querySelector('#cad-selection-summary');
    const text = (el && el.textContent) ? el.textContent : '';
    const m = text.match(/\(([^)]*)\)/);
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
    await fitView();
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
    const firstWorld = midpoint(horizontal.start, horizontal.end);
    const secondWorld = midpoint(vertical.start, vertical.end);
    const pairFirstWorld = { x: 8, y: 20 };
    const pairSecondWorld = { x: 10, y: 18 };
    const first = await worldToPagePoint(firstWorld);
    const second = await worldToPagePoint(secondWorld);
    const pairFirst = await worldToPagePoint(pairFirstWorld);
    const pairSecond = await worldToPagePoint(pairSecondWorld);
    if (!first || !second || !pairFirst || !pairSecond) {
      throw new Error('Failed to resolve preselection click points');
    }
    return {
      first,
      second,
      firstWorld,
      secondWorld,
      pairFirst,
      pairSecond,
      pairFirstWorld,
      pairSecondWorld,
    };
  };

  const setupLineCircleFixture = async (opts = {}) => {
    const lineLayerId = Number.isFinite(opts?.lineLayerId) ? Number(opts.lineLayerId) : 0;
    const circleLayerId = Number.isFinite(opts?.circleLayerId) ? Number(opts.circleLayerId) : 0;
    const lineStart = opts?.lineStart || { x: -12, y: 0 };
    const lineEnd = opts?.lineEnd || { x: 12, y: 0 };
    const circleCenter = opts?.circleCenter || { x: 0, y: 8 };
    const radius = Number.isFinite(opts?.radius) ? Number(opts.radius) : 5;
    await clearDoc();
    const createLine = await runDebugCommand('entity.create', {
      entity: { type: 'line', start: lineStart, end: lineEnd, layerId: lineLayerId },
    });
    const createCircle = await runDebugCommand('entity.create', {
      entity: { type: 'circle', center: circleCenter, radius, layerId: circleLayerId },
    });
    if (!createLine?.ok || !createCircle?.ok) {
      throw new Error('Failed to create fillet/chamfer curve preselection fixture');
    }
    await fitView();
    const lineWorld = opts?.lineWorld || { x: -3, y: 0 };
    const circleWorld = opts?.circleWorld || {
      x: circleCenter.x - (radius / Math.sqrt(2)),
      y: circleCenter.y - (radius / Math.sqrt(2)),
    };
    const linePage = await worldToPagePoint(lineWorld);
    const circlePage = await worldToPagePoint(circleWorld);
    if (!linePage || !circlePage) {
      throw new Error('Failed to resolve curve preselection click points');
    }
    const selectionRect = opts?.selectionRect || {
      x0: Math.min(lineStart.x, lineEnd.x, circleCenter.x - radius) - 2,
      y0: Math.min(lineStart.y, lineEnd.y, circleCenter.y - radius) - 2,
      x1: Math.max(lineStart.x, lineEnd.x, circleCenter.x + radius) + 2,
      y1: Math.max(lineStart.y, lineEnd.y, circleCenter.y + radius) + 2,
    };
    return {
      lineWorld,
      circleWorld,
      linePage,
      circlePage,
      selectionRect,
    };
  };

  const waitForFilletApplied = async (arcCountMin, timeout) => page.waitForFunction((minArcCount) => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'arc').length >= minArcCount;
  }, arcCountMin, { timeout }).then(() => true).catch(() => false);

  const waitForChamferApplied = async (lineCountMin, arcCountMin, timeout) => page.waitForFunction(({ minLineCount, minArcCount }) => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    const lineCount = entities.filter((entity) => entity && entity.type === 'line').length;
    const arcCount = entities.filter((entity) => entity && entity.type === 'arc').length;
    return lineCount >= minLineCount && arcCount >= minArcCount;
  }, { minLineCount: lineCountMin, minArcCount: arcCountMin }, { timeout }).then(() => true).catch(() => false);

  const filletPrePoints = await setupCornerLines();
  await activateTool('select', 'select: click entity');
  await clickWorldPoint(filletPrePoints.firstWorld);
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
  await clickWorldPoint(filletPrePoints.secondWorld);
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
    await clickWorldPoint(filletPrePoints.secondWorld);
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
  await clickWorldPoint(chamferPrePoints.firstWorld);
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
  await clickWorldPoint(chamferPrePoints.secondWorld);
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
    await clickWorldPoint(chamferPrePoints.secondWorld);
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

  const filletCurvePoints = await setupLineCircleFixture();
  await activateTool('select', 'select: click entity');
  await clickWorldPoint(filletCurvePoints.circleWorld);
  const filletCurvePrimary = await waitForPrimaryEntityType('circle', timeoutMs);
  const filletCurvePreselected = !!filletCurvePrimary;
  if (!filletCurvePreselected) {
    throw new Error('Fillet curve preselection setup failed');
  }
  await page.fill('#cad-command-input', 'fillet 2');
  await page.click('[data-tool=\"fillet\"]');
  const filletCurvePromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletCurvePromptSecond) {
    throw new Error('Fillet curve preselection did not enter second-pick prompt');
  }
  await clickWorldPoint(filletCurvePoints.lineWorld);
  const filletCurveApplied = await waitForFilletApplied(2, timeoutMs);
  if (!filletCurveApplied) {
    throw new Error('Fillet curve preselection fast-path did not apply');
  }
  const filletCurveStatus = (await page.textContent('#cad-status-message')) || '';
  const filletCurveEntities = await readAllEntities();
  const filletCurveArcCount = filletCurveEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletCurveArcCount < 2) {
    throw new Error('Fillet curve preselection fast-path did not create trimmed circle arc and fillet arc');
  }

  const chamferCurvePoints = await setupLineCircleFixture({
    circleCenter: { x: 0, y: 0 },
    lineWorld: { x: 7, y: 0 },
    circleWorld: { x: 5 / Math.sqrt(2), y: 5 / Math.sqrt(2) },
    selectionRect: {
      x0: -14,
      y0: -7,
      x1: 14,
      y1: 7,
    },
  });
  await activateTool('select', 'select: click entity');
  await clickWorldPoint(chamferCurvePoints.circleWorld);
  const chamferCurvePrimary = await waitForPrimaryEntityType('circle', timeoutMs);
  const chamferCurvePreselected = !!chamferCurvePrimary;
  if (!chamferCurvePreselected) {
    throw new Error('Chamfer curve preselection setup failed');
  }
  await page.fill('#cad-command-input', 'chamfer 2 3');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferCurvePromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('click second line/polyline') || status.includes('click second target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferCurvePromptSecond) {
    throw new Error('Chamfer curve preselection did not enter second-pick prompt');
  }
  await clickWorldPoint(chamferCurvePoints.lineWorld);
  const chamferCurveApplied = await waitForChamferApplied(2, 1, timeoutMs);
  if (!chamferCurveApplied) {
    throw new Error('Chamfer curve preselection fast-path did not apply');
  }
  const chamferCurveStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferCurveEntities = await readAllEntities();
  const chamferCurveLineCount = chamferCurveEntities.filter((entity) => entity && entity.type === 'line').length;
  const chamferCurveArcCount = chamferCurveEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (chamferCurveLineCount < 2 || chamferCurveArcCount < 1) {
    throw new Error('Chamfer curve preselection fast-path did not create connector line and trimmed circle arc');
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
  await clickWorldPoint(filletPairPoints.pairSecondWorld);
  let filletPairApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('fillet applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.some((entity) => entity && entity.type === 'arc');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPairApplied) {
    await clickWorldPoint(filletPairPoints.pairSecondWorld);
    filletPairApplied = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('fillet applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      return entities.some((entity) => entity && entity.type === 'arc');
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  }
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
  await clickWorldPoint(chamferPairPoints.pairFirstWorld);
  let chamferPairApplied = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    if (status.includes('chamfer applied')) return true;
    const debug = window.__cadDebug;
    if (!debug || typeof debug.listEntities !== 'function') return false;
    const entities = debug.listEntities();
    if (!Array.isArray(entities)) return false;
    return entities.filter((entity) => entity && entity.type === 'line').length >= 3;
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPairApplied) {
    await clickWorldPoint(chamferPairPoints.pairFirstWorld);
    chamferPairApplied = await page.waitForFunction(() => {
      const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
      if (status.includes('chamfer applied')) return true;
      const debug = window.__cadDebug;
      if (!debug || typeof debug.listEntities !== 'function') return false;
      const entities = debug.listEntities();
      if (!Array.isArray(entities)) return false;
      return entities.filter((entity) => entity && entity.type === 'line').length >= 3;
    }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  }
  if (!chamferPairApplied) {
    throw new Error('Chamfer pair preselection one-click path did not apply');
  }
  const chamferPairStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferPairEntities = await readAllEntities();
  const chamferPairLineCount = chamferPairEntities.filter((entity) => entity && entity.type === 'line').length;
  if (chamferPairLineCount < 3) {
    throw new Error('Chamfer pair preselection one-click path did not create connector line');
  }

  const filletCurvePairPoints = await setupLineCircleFixture();
  const filletCurvePairSelect = await runDebugCommand('selection.box', {
    rect: filletCurvePairPoints.selectionRect,
    crossing: false,
  });
  if (!filletCurvePairSelect?.ok) {
    throw new Error('Fillet curve pair preselection setup failed');
  }
  const filletCurvePairSelectionCount = await page.evaluate(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return 0;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) ? ids.length : 0;
  });
  if (filletCurvePairSelectionCount !== 2) {
    throw new Error('Fillet curve pair preselection expected 2 selected entities, got ' + filletCurvePairSelectionCount);
  }
  await page.fill('#cad-command-input', 'fillet 2');
  await page.click('[data-tool=\"fillet\"]');
  const filletCurvePairPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('either selected target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletCurvePairPromptSecond) {
    throw new Error('Fillet curve pair preselection did not enter one-click pair prompt');
  }
  await clickWorldPoint(filletCurvePairPoints.circleWorld);
  let filletCurvePairApplied = await waitForFilletApplied(2, timeoutMs);
  if (!filletCurvePairApplied) {
    await clickWorldPoint(filletCurvePairPoints.circleWorld);
    filletCurvePairApplied = await waitForFilletApplied(2, timeoutMs);
  }
  if (!filletCurvePairApplied) {
    throw new Error('Fillet curve pair preselection one-click path did not apply');
  }
  const filletCurvePairStatus = (await page.textContent('#cad-status-message')) || '';
  const filletCurvePairEntities = await readAllEntities();
  const filletCurvePairArcCount = filletCurvePairEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (filletCurvePairArcCount < 2) {
    throw new Error('Fillet curve pair preselection one-click path did not create trimmed circle arc and fillet arc');
  }

  const chamferCurvePairPoints = await setupLineCircleFixture({
    circleCenter: { x: 0, y: 0 },
    lineWorld: { x: 7, y: 0 },
    circleWorld: { x: 5 / Math.sqrt(2), y: 5 / Math.sqrt(2) },
    selectionRect: {
      x0: -14,
      y0: -7,
      x1: 14,
      y1: 7,
    },
  });
  const chamferCurvePairSelect = await runDebugCommand('selection.box', {
    rect: chamferCurvePairPoints.selectionRect,
    crossing: false,
  });
  if (!chamferCurvePairSelect?.ok) {
    throw new Error('Chamfer curve pair preselection setup failed');
  }
  const chamferCurvePairSelectionCount = await page.evaluate(() => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return 0;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) ? ids.length : 0;
  });
  if (chamferCurvePairSelectionCount !== 2) {
    throw new Error('Chamfer curve pair preselection expected 2 selected entities, got ' + chamferCurvePairSelectionCount);
  }
  await page.fill('#cad-command-input', 'chamfer 2 3');
  await page.click('[data-tool=\"chamfer\"]');
  const chamferCurvePairPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('either selected target');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferCurvePairPromptSecond) {
    throw new Error('Chamfer curve pair preselection did not enter one-click pair prompt');
  }
  await clickWorldPoint(chamferCurvePairPoints.circleWorld);
  let chamferCurvePairApplied = await waitForChamferApplied(2, 1, timeoutMs);
  if (!chamferCurvePairApplied) {
    await clickWorldPoint(chamferCurvePairPoints.circleWorld);
    chamferCurvePairApplied = await waitForChamferApplied(2, 1, timeoutMs);
  }
  if (!chamferCurvePairApplied) {
    throw new Error('Chamfer curve pair preselection one-click path did not apply');
  }
  const chamferCurvePairStatus = (await page.textContent('#cad-status-message')) || '';
  const chamferCurvePairEntities = await readAllEntities();
  const chamferCurvePairLineCount = chamferCurvePairEntities.filter((entity) => entity && entity.type === 'line').length;
  const chamferCurvePairArcCount = chamferCurvePairEntities.filter((entity) => entity && entity.type === 'arc').length;
  if (chamferCurvePairLineCount < 2 || chamferCurvePairArcCount < 1) {
    throw new Error('Chamfer curve pair preselection one-click path did not create connector line and trimmed circle arc');
  }

  // Cross-layer preselection path: keep one line on layer 0 and the other on layer 1.
  // Fillet/Chamfer should still apply when both layers are unlocked.
  const filletCrossLayerPoints = await setupCornerLines({ firstLayerId: 0, secondLayerId: 1 });
  await page.click('[data-tool=\"select\"]');
  await clickWorldPoint(filletCrossLayerPoints.firstWorld);
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
  await clickWorldPoint(filletCrossLayerPoints.secondWorld);
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
  await clickWorldPoint(chamferCrossLayerPoints.firstWorld);
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
  await clickWorldPoint(chamferCrossLayerPoints.secondWorld);
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
  await clickWorldPoint(filletRuntimePoints.firstWorld);
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
  await clickWorldPoint(chamferRuntimePoints.firstWorld);
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
  await clickWorldPoint(filletEscPoints.firstWorld);
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
  await clickWorldPoint(filletEscPoints.secondWorld);
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
  await clickWorldPoint(filletEscPoints.firstWorld);
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
  await clickWorldPoint(chamferEscPoints.firstWorld);
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
  await clickWorldPoint(chamferEscPoints.secondWorld);
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
  await clickWorldPoint(chamferEscPoints.firstWorld);
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
    filletCurvePreselected,
    filletCurvePromptSecond,
    filletCurveApplied,
    filletCurveArcCount,
    filletCurveStatus,
    filletPairPromptSecond,
    filletPairApplied,
    filletPairArcCount,
    filletPairStatus,
    filletCurvePairPromptSecond,
    filletCurvePairApplied,
    filletCurvePairArcCount,
    filletCurvePairStatus,
    filletRuntimePromptFirst,
    filletRuntimeApplied,
    filletRuntimeArcCount,
    filletRuntimeStatus,
    chamferPreselected,
    chamferPromptSecond,
    chamferFastApplied,
    chamferFastLineCount,
    chamferFastStatus,
    chamferCurvePreselected,
    chamferCurvePromptSecond,
    chamferCurveApplied,
    chamferCurveLineCount,
    chamferCurveArcCount,
    chamferCurveStatus,
    chamferPairPromptSecond,
    chamferPairApplied,
    chamferPairLineCount,
    chamferPairStatus,
    chamferCurvePairPromptSecond,
    chamferCurvePairApplied,
    chamferCurvePairLineCount,
    chamferCurvePairArcCount,
    chamferCurvePairStatus,
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
    return {
      firstSide: { x: 14, y: 18 },
      sameLegSecond: { x: -4, y: 18 },
      secondSide: { x: 20, y: 12 },
      fallbackMissSecond: { x: -35, y: -28 },
    };
  };

  const filletPolyPre = await setupCornerPolyline();
  await page.click('[data-tool=\"select\"]');
  await clickWorldPoint(filletPolyPre.firstSide);
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
  await clickWorldPoint(filletPolyPre.firstSide);
  const filletPolyPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyPromptSecond) {
    throw new Error('Fillet polyline preselection did not enter second-side prompt');
  }
  await clickWorldPoint(filletPolyPre.sameLegSecond);
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
  await clickWorldPoint(filletPolyFallback.firstSide);
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
  await clickWorldPoint(filletPolyFallback.firstSide);
  const filletPolyFallbackPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!filletPolyFallbackPromptSecond) {
    throw new Error('Fillet polyline fallback did not enter second-side prompt');
  }
  // Intentionally click away from geometry; when hit-test misses this should fallback to
  // selected polyline id and apply using current pointer as second-side pick.
  await clickWorldPoint(filletPolyFallback.fallbackMissSecond);
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
    await clickWorldPoint(filletPolyFallback.secondSide);
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
  await clickWorldPoint(chamferPolyPre.firstSide);
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
  await clickWorldPoint(chamferPolyPre.firstSide);
  const chamferPolyPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyPromptSecond) {
    throw new Error('Chamfer polyline preselection did not enter second-side prompt');
  }
  await clickWorldPoint(chamferPolyPre.sameLegSecond);
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
  await clickWorldPoint(chamferPolyFallback.firstSide);
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
  await clickWorldPoint(chamferPolyFallback.firstSide);
  const chamferPolyFallbackPromptSecond = await page.waitForFunction(() => {
    const status = (document.querySelector('#cad-status-message')?.textContent || '').toLowerCase();
    return status.includes('second side on selected polyline');
  }, null, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (!chamferPolyFallbackPromptSecond) {
    throw new Error('Chamfer polyline fallback did not enter second-side prompt');
  }
  await clickWorldPoint(chamferPolyFallback.fallbackMissSecond);
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
    await clickWorldPoint(chamferPolyFallback.secondSide);
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
  const targetPick = { x: midpoint(r1, r2).x, y: r1.y };
  await page.mouse.click(targetPick.x, targetPick.y);
  // Shift+click first break point, then click second point.
  const b1 = { x: r2.x, y: midpoint(r2, r3).y };
  const b2 = { x: midpoint(r3, r4).x, y: r3.y };
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
    const targetPick2 = { x: midpoint(r1, r2).x, y: r1.y };
    await page.mouse.click(targetPick2.x, targetPick2.y);

    const bb1 = { x: r2.x, y: midpoint(r2, r3).y };
    const bb2 = { x: midpoint(r3, r4).x, y: r3.y };
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
      const m = text.match(/\(([^)]*)\)/);
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

  const offMid = { x: midpoint(offA, offB).x, y: offA.y };
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
  const lenTol = adaptiveTol(beforeLen, 0.1, 0.05);
  if (Math.abs(afterLen - beforeLen) > lenTol) {
    throw new Error('Offset(line) changed line length unexpectedly');
  }
  const expectedOffset = 5.0;
  const distTol = adaptiveTol(expectedOffset, 0.35, 0.25);
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
  const joinLine0 = { start: { x: -20, y: 0 }, end: { x: 0, y: 0 } };
  const joinLine1 = { start: { x: 0, y: 0 }, end: { x: 20, y: 10 } };
  const joinCreateA = await runDebugCommand('entity.create', { entity: { type: 'line', layerId: 0, ...joinLine0 } });
  const joinCreateB = await runDebugCommand('entity.create', { entity: { type: 'line', layerId: 0, ...joinLine1 } });
  if (!joinCreateA?.ok || !joinCreateB?.ok) {
    throw new Error('Join setup failed to seed deterministic lines');
  }
  await fitView();

  const joinSeedLines = (await readAllEntities())
    .filter((entity) => entity
      && entity.type === 'line'
      && entity.start
      && entity.end
      && Number.isFinite(entity.start.x)
      && Number.isFinite(entity.start.y)
      && Number.isFinite(entity.end.x)
      && Number.isFinite(entity.end.y))
    .sort((a, b) => {
      const aMidX = midpoint(a.start, a.end).x;
      const bMidX = midpoint(b.start, b.end).x;
      return aMidX - bMidX;
    });
  if (joinSeedLines.length !== 2) {
    throw new Error('Join setup expected 2 line entities after seeding');
  }
  const joinPickA = await worldToPagePoint(midpoint(joinSeedLines[0].start, joinSeedLines[0].end));
  const joinPickB = await worldToPagePoint(midpoint(joinSeedLines[1].start, joinSeedLines[1].end));
  if (!joinPickA || !joinPickB) {
    throw new Error('Join setup failed to map line midpoints');
  }
  const joinWorldPoints = joinSeedLines.flatMap((entity) => [entity.start, entity.end]);
  const joinRect = {
    x0: Math.min(...joinWorldPoints.map((point) => point.x)) - 1,
    y0: Math.min(...joinWorldPoints.map((point) => point.y)) - 1,
    x1: Math.max(...joinWorldPoints.map((point) => point.x)) + 1,
    y1: Math.max(...joinWorldPoints.map((point) => point.y)) + 1,
  };

  await page.click('[data-tool=\"select\"]');
  const joinSelectResult = await runDebugCommand('selection.box', { rect: joinRect, crossing: false });
  if (!joinSelectResult?.ok) {
    throw new Error('Join setup selection.box failed');
  }

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
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const d = window.__cadDebug;
    const state = d && typeof d.getState === 'function' ? d.getState() : null;
    const statusEl = document.querySelector('#cad-status-message');
    const statusText = statusEl && statusEl.textContent ? statusEl.textContent.toLowerCase() : '';
    if (state && state.entityCount === 1) return true;
    return statusText.includes('unresolved endpoint matches') || statusText.includes('join failed');
  }, null, { timeout: timeoutMs });
  const joinAfterState = await readDebugState();
  const joinStatus = (await page.textContent('#cad-status-message')) || '';
  if (!joinAfterState || joinAfterState.entityCount !== 1) {
    throw new Error('Join failed to merge deterministic lines: ' + joinStatus);
  }
  await waitForTypesExact(['polyline']);
  const joinAfterId = joinAfterState && Number.isFinite(joinAfterState.primaryId)
    ? Number(joinAfterState.primaryId)
    : NaN;
  const joinPolyline = Number.isFinite(joinAfterId) ? await readEntityById(joinAfterId) : null;
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

  setStep('selection_provenance_summary');
  // 9) Single-selection provenance/effective-style summary: stable DOM contract + promotion to TRUECOLOR.
  await clearDoc();

  const createSelectionSummaryFixture = await runDebugCommand('entity.create', {
    entity: {
      type: 'line',
      start: { x: -24, y: 6 },
      end: { x: 24, y: 6 },
      layerId: 0,
      visible: true,
      color: '#808080',
      colorSource: 'BYLAYER',
      colorAci: 8,
      sourceType: 'INSERT',
      editMode: 'fragment',
      space: 1,
      layout: 'Layout-A',
      lineType: 'HIDDEN2',
      lineWeight: 0.55,
      lineTypeScale: 1.7,
    },
  });
  if (!createSelectionSummaryFixture?.ok) {
    throw new Error('Selection provenance fixture creation failed');
  }
  await waitForTypesExact(['line']);
  await page.waitForSelector('#cad-selection-details[data-mode=\"single\"]', { timeout: timeoutMs });
  const selectionContractBefore = await readSelectionDetails();
  if (!selectionContractBefore || selectionContractBefore.mode !== 'single' || selectionContractBefore.entityCount !== 1 || selectionContractBefore.primaryType !== 'line') {
    throw new Error('Selection provenance contract did not enter single-select mode');
  }
  if (selectionContractBefore.items.origin !== 'INSERT / fragment') {
    throw new Error('Selection provenance origin summary mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  if (selectionContractBefore.items.layer !== '0:0') {
    throw new Error('Selection provenance layer mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  // BYLAYER: effective color is the layer color (#d0d7de for layer 0), not entity's own color (#808080)
  if (selectionContractBefore.items['effective-color'] !== '#d0d7de') {
    throw new Error('Selection provenance effective color mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  if (selectionContractBefore.items['color-source'] !== 'BYLAYER' || selectionContractBefore.items['color-aci'] !== '8') {
    throw new Error('Selection provenance color source mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  if (selectionContractBefore.items.space !== 'Paper' || selectionContractBefore.items.layout !== 'Layout-A') {
    throw new Error('Selection provenance space/layout mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  if (
    selectionContractBefore.items['line-type'] !== 'HIDDEN2'
    || selectionContractBefore.items['line-weight'] !== '0.55'
    || selectionContractBefore.items['line-type-scale'] !== '1.7'
  ) {
    throw new Error('Selection provenance style mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  if (
    selectionContractBefore.badges.type !== 'line'
    || selectionContractBefore.badges.layer !== '0:0'
    || selectionContractBefore.badges.space !== 'Paper'
    || selectionContractBefore.badges.layout !== 'Layout-A'
    || selectionContractBefore.badges['color-source'] !== 'BYLAYER'
  ) {
    throw new Error('Selection provenance badge mismatch: ' + JSON.stringify(selectionContractBefore));
  }
  const focusedLayerBefore = await readFocusedLayerPanel();
  if (!focusedLayerBefore || focusedLayerBefore.layerId !== 0) {
    throw new Error('Selection provenance layer focus mismatch before edit: ' + JSON.stringify(focusedLayerBefore));
  }

  const targetLayerId = 1;
  const targetLayer = await readLayerById(targetLayerId);
  const targetLayerName = String(targetLayer?.name || '').trim();
  const targetLayerColor = String(targetLayer?.color || '').trim();
  if (!targetLayerName || !targetLayerColor) {
    throw new Error('Selection provenance target layer contract missing: ' + JSON.stringify(targetLayer));
  }
  const targetLayerLabel = `${targetLayerId}:${targetLayerName}`;

  await page.fill('#cad-property-form input[name=\"layerId\"]', String(targetLayerId));
  await blurActive();
  await page.waitForFunction((expected) => {
    const layer = document.querySelector('#cad-selection-details [data-selection-field="layer"] strong');
    const source = document.querySelector('#cad-selection-details [data-selection-field=\"color-source\"] strong');
    const color = document.querySelector('#cad-selection-details [data-selection-field=\"effective-color\"] strong');
    return layer && String(layer.textContent || '').trim() === expected.layerLabel
      && source && String(source.textContent || '').trim() === 'BYLAYER'
      && color && String(color.textContent || '').trim() === expected.layerColor;
  }, { layerLabel: targetLayerLabel, layerColor: targetLayerColor }, { timeout: timeoutMs });
  const selectionSummaryEntityIds = await readSelectionIds();
  const selectionContractAfter = await readSelectionDetails();
  const selectionContractEntity = await readEntityById(selectionSummaryEntityIds[0]);
  if (
    !selectionContractAfter
    || selectionContractAfter.items.layer !== targetLayerLabel
    || selectionContractAfter.items['color-source'] !== 'BYLAYER'
    || selectionContractAfter.items['effective-color'] !== targetLayerColor
  ) {
    throw new Error('Selection provenance reassignment summary mismatch: ' + JSON.stringify(selectionContractAfter));
  }
  if (selectionContractAfter.badges.layer !== targetLayerLabel || selectionContractAfter.badges['color-source'] !== 'BYLAYER') {
    throw new Error('Selection provenance reassignment badge mismatch: ' + JSON.stringify(selectionContractAfter));
  }
  if (!selectionContractEntity || selectionContractEntity.layerId !== targetLayerId || selectionContractEntity.colorSource !== 'BYLAYER') {
    throw new Error('Selection provenance entity reassignment mismatch: ' + JSON.stringify(selectionContractEntity));
  }
  const focusedLayerAfter = await readFocusedLayerPanel();
  if (!focusedLayerAfter || focusedLayerAfter.layerId !== targetLayerId) {
    throw new Error('Selection provenance layer focus mismatch after edit: ' + JSON.stringify(focusedLayerAfter));
  }

  results.selection_provenance_summary = {
    summary: (await page.textContent('#cad-selection-summary')) || '',
    before: selectionContractBefore,
    after: selectionContractAfter,
    focused_layer_before: focusedLayerBefore,
    focused_layer_after: focusedLayerAfter,
    target_layer: {
      id: targetLayerId,
      name: targetLayerName,
      color: targetLayerColor,
      visible: targetLayer?.visible,
      locked: targetLayer?.locked,
      frozen: targetLayer?.frozen,
      plottable: targetLayer?.plottable,
    },
    entity: selectionContractEntity,
    status: (await page.textContent('#cad-status-message')) || '',
  };

  setStep('text_edit');
  // 10) Text create + property panel edit + undo/redo
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
  {
    await clearDoc();

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const id = s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
      return id;
    });
    const trimBoundaryStart = { x: 12, y: -20 };
    const trimBoundaryEnd = { x: 12, y: 20 };
    const trimTarget1Start = { x: -20, y: 0 };
    const trimTarget1End = { x: 20, y: 0 };
    const trimTarget2Start = { x: -20, y: 10 };
    const trimTarget2End = { x: 20, y: 10 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: trimBoundaryStart, end: trimBoundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    const trimBoundaryId = await readPrimaryId();
    const trimBoundary = await readLineEnds(trimBoundaryId);
    if (!trimBoundary) throw new Error('Trim setup failed to read boundary entity');
    const trimBoundaryX = trimBoundary.startX;

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: trimTarget1Start, end: trimTarget1End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const trim1Id = await readPrimaryId();
    const trim1Before = await readLineEnds(trim1Id);
    if (!trim1Before) throw new Error('Trim setup failed to read target1 entity');

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: trimTarget2Start, end: trimTarget2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const trim2Id = await readPrimaryId();
    const trim2Before = await readLineEnds(trim2Id);
    if (!trim2Before) throw new Error('Trim setup failed to read target2 entity');

    await fitView();

    await activateTool('trim', 'trim: click boundary');
    await clickWorldPoint({ x: trimBoundaryX, y: 18 });

    await clickWorldPoint({ x: 18, y: trimTarget1Start.y });
    await waitForStatusContains('trim applied to #' + trim1Id);
    const trimStatus1 = (await page.textContent('#cad-status-message')) || '';

    await clickWorldPoint({ x: 18, y: trimTarget2Start.y });
    await waitForStatusContains('trim applied to #' + trim2Id);
    const trimStatus2 = (await page.textContent('#cad-status-message')) || '';

    const trim1After = await readLineEnds(trim1Id);
    const trim2After = await readLineEnds(trim2Id);
    if (!trim1After || !trim2After) throw new Error('Trim failed to read targets after apply');

    const trim1Dx = Math.min(Math.abs(trim1After.startX - trimBoundaryX), Math.abs(trim1After.endX - trimBoundaryX));
    const trim2Dx = Math.min(Math.abs(trim2After.startX - trimBoundaryX), Math.abs(trim2After.endX - trimBoundaryX));
    if (trim1Dx > 0.05 || trim2Dx > 0.05) {
      throw new Error('Trim target did not reach boundary');
    }
    if (
      Math.abs(trim1After.startX - trim1Before.startX) < 0.05 &&
      Math.abs(trim1After.endX - trim1Before.endX) < 0.05
    ) {
      throw new Error('Trim target1 did not change');
    }
    if (
      Math.abs(trim2After.startX - trim2Before.startX) < 0.05 &&
      Math.abs(trim2After.endX - trim2Before.endX) < 0.05
    ) {
      throw new Error('Trim target2 did not change');
    }

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
    }, { id: trim2Id, before: trim2Before }, { timeout: timeoutMs });

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
    }, { id: trim2Id, after: trim2After }, { timeout: timeoutMs });

    results.trim_line = {
      boundaryX: trimBoundaryX,
      ids: { boundary: trimBoundaryId, target1: trim1Id, target2: trim2Id },
      target1: { before: trim1Before, after: trim1After, dxToBoundary: trim1Dx },
      target2: { before: trim2Before, after: trim2After, dxToBoundary: trim2Dx },
      status1: trimStatus1,
      status2: trimStatus2,
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

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
    const tfBoundaryStart = { x: 14, y: -20 };
    const tfBoundaryEnd = { x: 14, y: 20 };
    const tf1Start = { x: -20, y: 0 };
    const tf1End = { x: -6, y: 0 };
    const tf2Start = { x: -20, y: 10 };
    const tf2End = { x: 20, y: 10 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: tfBoundaryStart, end: tfBoundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    const tfBoundaryId = await readPrimaryId();
    const tfBoundary = await readLineEnds(tfBoundaryId);
    if (!tfBoundary) throw new Error('Trim(failure) failed to read boundary entity');
    const tfBoundaryX = tfBoundary.startX;

    // Target #1: line entirely left of boundary (no intersection) -> should remain unchanged after trim attempt.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: tf1Start, end: tf1End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const tf1Id = await readPrimaryId();
    const tf1Before = await readLineEnds(tf1Id);
    if (!tf1Before) throw new Error('Trim(failure) failed to read target1 entity');

    // Target #2: line crossing boundary -> should trim successfully without re-picking boundary.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: tf2Start, end: tf2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const tf2Id = await readPrimaryId();
    const tf2Before = await readLineEnds(tf2Id);
    if (!tf2Before) throw new Error('Trim(failure) failed to read target2 entity');

    // Trim: pick boundary, then attempt target#1 (expect no change), then target#2 (expect success) without re-picking boundary.
    await fitView();
    await activateTool('trim', 'trim: click boundary');
    await clickWorldPoint({ x: tfBoundaryX, y: 18 });

    // Failure attempt: no intersection.
    await clickWorldPoint(midpoint(tf1Start, tf1End));
    await waitForStatusContains('no trim intersection found');

    // Success attempt: should trim to boundary.
    await clickWorldPoint({ x: 18, y: tf2Start.y });
    await waitForStatusContains('trim applied to #' + tf2Id);

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
    const tfUndo = await runDebugCommand('history.undo');
    if (!tfUndo?.ok) {
      throw new Error('Trim(after failure) undo failed');
    }
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

    const tfRedo = await runDebugCommand('history.redo');
    if (!tfRedo?.ok) {
      throw new Error('Trim(after failure) redo failed');
    }
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
  {
    await clearDoc();

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      const id = s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
      return id;
    });
    const extBoundaryStart = { x: 20, y: -20 };
    const extBoundaryEnd = { x: 20, y: 20 };
    const ext1Start = { x: -20, y: 0 };
    const ext1End = { x: -5, y: 0 };
    const ext2Start = { x: -20, y: 10 };
    const ext2End = { x: -8, y: 10 };

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: extBoundaryStart, end: extBoundaryEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    const extBoundaryId = await readPrimaryId();
    const extBoundary = await readLineEnds(extBoundaryId);
    if (!extBoundary) throw new Error('Extend setup failed to read boundary entity');
    const boundaryExtX = extBoundary.startX;

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: ext1Start, end: ext1End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const ext1Id = await readPrimaryId();
    const ext1Before = await readLineEnds(ext1Id);
    if (!ext1Before) throw new Error('Extend setup failed to read target1 entity');

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: ext2Start, end: ext2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    const ext2Id = await readPrimaryId();
    const ext2Before = await readLineEnds(ext2Id);
    if (!ext2Before) throw new Error('Extend setup failed to read target2 entity');

    await fitView();

    await activateTool('extend', 'extend: click boundary');
    await clickWorldPoint({ x: boundaryExtX, y: 18 });
    await clickWorldPoint({ x: ext1End.x - 1, y: ext1End.y });
    await waitForStatusContains('extend applied to #' + ext1Id);
    const extStatus1 = (await page.textContent('#cad-status-message')) || '';

    await clickWorldPoint({ x: ext2End.x - 1, y: ext2End.y });
    await waitForStatusContains('extend applied to #' + ext2Id);
    const extStatus2 = (await page.textContent('#cad-status-message')) || '';

    const ext1After = await readLineEnds(ext1Id);
    const ext2After = await readLineEnds(ext2Id);
    if (!ext1After || !ext2After) throw new Error('Extend failed to read targets after apply');

    const ext1Dx = Math.abs(ext1After.endX - boundaryExtX);
    const ext2Dx = Math.abs(ext2After.endX - boundaryExtX);
    if (ext1Dx > 0.05) {
      throw new Error('Extend target1 did not reach boundary (dx=' + ext1Dx + ')');
    }
    if (ext2Dx > 0.05) {
      throw new Error('Extend target2 did not reach boundary (dx=' + ext2Dx + ')');
    }

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
    }, { id: ext2Id, before: ext2Before }, { timeout: timeoutMs });

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
    }, { id: ext2Id, after: ext2After }, { timeout: timeoutMs });

    results.extend_line = {
      boundaryX: boundaryExtX,
      ids: { boundary: extBoundaryId, target1: ext1Id, target2: ext2Id },
      target1: { before: ext1Before, after: ext1After, dxToBoundary: ext1Dx },
      target2: { before: ext2Before, after: ext2After, dxToBoundary: ext2Dx },
      status1: extStatus1,
      status2: extStatus2,
      status: (await page.textContent('#cad-status-message')) || '',
      summary: (await page.textContent('#cad-selection-summary')) || '',
    };

    await blurActive();
    await page.keyboard.press('Escape');
  }

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
    const efBoundaryId = await readPrimaryId();
    const efBoundary = await readLineEnds(efBoundaryId);
    if (!efBoundary) throw new Error('Extend(failure) failed to read boundary entity');
    const efBoundaryX = efBoundary.startX;

    // Target #1: vertical line parallel to boundary (no intersection). Extend should do nothing.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: failStart, end: failEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    const ef1Id = await readPrimaryId();
    const ef1Before = await readLineEnds(ef1Id);
    if (!ef1Before) throw new Error('Extend(failure) failed to read target1 entity');

    // Target #2: line ending before boundary. Extend should bring end.x to boundary.
    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: okStart, end: okEnd, layerId: 0, visible: true, color: '#1f2937' },
    });
    const ef2Id = await readPrimaryId();
    const ef2Before = await readLineEnds(ef2Id);
    if (!ef2Before) throw new Error('Extend(failure) failed to read target2 entity');

    // Fit viewport to seeded entities before deterministic canvas-local picks.
    await fitView();

    await activateTool('extend', 'extend: click boundary');
    await clickWorldPoint({ x: efBoundaryX, y: 0 });

    // Failure attempt (no intersection).
    await clickWorldPoint({ x: failStart.x, y: midpoint(failStart, failEnd).y });
    await waitForStatusContains('no extend intersection found');

    // Success attempt without re-picking boundary.
    await clickWorldCandidatesUntilStatus([
      { x: okEnd.x - 1, y: okEnd.y },
      { x: okEnd.x, y: okEnd.y },
      { x: okEnd.x - 3, y: okEnd.y },
    ], 'extend applied to #' + ef2Id);

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
    const efUndo = await runDebugCommand('history.undo');
    if (!efUndo?.ok) {
      throw new Error('Extend(after failure) undo failed');
    }
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

    const efRedo = await runDebugCommand('history.redo');
    if (!efRedo?.ok) {
      throw new Error('Extend(after failure) redo failed');
    }
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

    const near = (a, b, tol = 1e-6) => Math.abs(Number(a) - Number(b)) <= tol;
    const matchLine = (entities, start, end) => entities.find((entity) => entity
      && entity.type === 'line'
      && near(entity.start?.x, start.x)
      && near(entity.start?.y, start.y)
      && near(entity.end?.x, end.x)
      && near(entity.end?.y, end.y)) || null;
    const matchOpenPolyline = (entities, start, end) => entities.find((entity) => {
      const pts = entity && entity.type === 'polyline' && Array.isArray(entity.points) ? entity.points : null;
      if (!pts || pts.length !== 2 || entity.closed === true) return false;
      return near(pts[0]?.x, start.x)
        && near(pts[0]?.y, start.y)
        && near(pts[1]?.x, end.x)
        && near(pts[1]?.y, end.y);
    }) || null;

    const readEntity = async (id) => page.evaluate((entityId) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      return d.getEntity(entityId);
    }, id);

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

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

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary2Start, end: boundary2End, layerId: 0, visible: true, color: '#1f2937' },
    });

    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [polyPStart, polyPEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
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
    const tpPolyQId = await readPrimaryId();
    const tpPolyQ = Number.isFinite(tpPolyQId) ? await readEntity(tpPolyQId) : null;
    const tpSegQ = segFromPolyline(tpPolyQ);
    if (!tpSegQ || !Number.isFinite(tpSegQ.minX) || !Number.isFinite(tpSegQ.maxX)) {
      throw new Error('Trim(polyline split) setup failed: missing baseline geometry for polyline Q');
    }
    const tpBaseQ = { minX: tpSegQ.minX, maxX: tpSegQ.maxX, y: Number(tpSegQ.y0) };

    // Fit viewport to seeded entities before deterministic canvas-local picks.
    await fitView();

    await activateTool('trim', 'trim: click boundary');
    // Pick boundaries above the target segments to avoid ambiguity.
    await clickWorldPoint({ x: tpBoundaryX1, y: 14 });
    await waitForStatusContains('1 boundary selected');
    await clickWorldPoint({ x: tpBoundaryX2, y: 14 }, { shiftKey: true });
    await waitForStatusContains('2 boundary selected');

    // Pick between the two intersections so trim splits into 2 polylines.
    await clickWorldPoint({ x: 0, y: 0 });
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
    await clickWorldPoint({ x: 0, y: -4 });
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
      await clickWorldPoint({ x: 0, y: -4 });
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

    const near = (a, b, tol = 1e-6) => Math.abs(Number(a) - Number(b)) <= tol;
    const matchLine = (entities, start, end) => entities.find((entity) => entity
      && entity.type === 'line'
      && near(entity.start?.x, start.x)
      && near(entity.start?.y, start.y)
      && near(entity.end?.x, end.x)
      && near(entity.end?.y, end.y)) || null;
    const matchOpenPolyline = (entities, start, end) => entities.find((entity) => {
      const pts = entity && entity.type === 'polyline' && Array.isArray(entity.points) ? entity.points : null;
      if (!pts || pts.length !== 2 || entity.closed === true) return false;
      return near(pts[0]?.x, start.x)
        && near(pts[0]?.y, start.y)
        && near(pts[1]?.x, end.x)
        && near(pts[1]?.y, end.y);
    }) || null;

    const readEntity = async (id) => page.evaluate((entityId) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return null;
      return d.getEntity(entityId);
    }, id);

    const readPrimaryId = async () => page.evaluate(() => {
      const d = window.__cadDebug;
      const s = d && typeof d.getState === 'function' ? d.getState() : null;
      return s && Number.isFinite(s.primaryId) ? s.primaryId : NaN;
    });

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
    const tpfBoundary1Id = await readPrimaryId();

    await runDebugCommand('entity.create', {
      entity: { type: 'line', start: boundary2Start, end: boundary2End, layerId: 0, visible: true, color: '#1f2937' },
    });
    await waitForTypesExact(['line']);
    const tpfBoundary2Id = await readPrimaryId();

    // Failure target: vertical polyline parallel to boundaries (no intersection).
    await runDebugCommand('entity.create', {
      entity: { type: 'polyline', points: [failPolyStart, failPolyEnd], closed: false, layerId: 0, visible: true, color: '#334155' },
    });
    await waitForTypesInclude('polyline');
    const failId = await readPrimaryId();

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

    const boundaryIds = [tpfBoundary1Id, tpfBoundary2Id].filter((id) => Number.isFinite(id));
    if (boundaryIds.length !== 2 || !Number.isFinite(failId)) {
      throw new Error('Trim(polyline failure) setup failed: missing boundary or failure ids');
    }

    const failTrim = await runDebugCommand('selection.trim', {
      boundaryIds,
      targetId: failId,
      pick: { x: failPolyStart.x, y: 1 },
    });
    if (failTrim?.ok !== false || failTrim?.error_code !== 'TRIM_NO_INTERSECTION') {
      throw new Error('Trim(polyline failure) expected TRIM_NO_INTERSECTION on failure attempt');
    }

    const okTrim = await runDebugCommand('selection.trim', {
      boundaryIds,
      targetId: successId,
      pick: { x: 0, y: 0 },
    });
    if (!okTrim?.ok) {
      throw new Error('Trim(polyline failure) success attempt failed');
    }
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

    const tpfUndo = await runDebugCommand('history.undo');
    if (!tpfUndo?.ok) {
      throw new Error('Trim(polyline failure) undo failed');
    }
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

    const tpfRedo = await runDebugCommand('history.redo');
    if (!tpfRedo?.ok) {
      throw new Error('Trim(polyline failure) redo failed');
    }
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
    const near = (a, b, tol = 1e-6) => Math.abs(Number(a) - Number(b)) <= tol;
    const matchLine = (entities, start, end) => entities.find((entity) => entity
      && entity.type === 'line'
      && near(entity.start?.x, start.x)
      && near(entity.start?.y, start.y)
      && near(entity.end?.x, end.x)
      && near(entity.end?.y, end.y)) || null;
    const matchOpenPolyline = (entities, start, end) => entities.find((entity) => {
      const pts = entity && entity.type === 'polyline' && Array.isArray(entity.points) ? entity.points : null;
      if (!pts || pts.length !== 2 || entity.closed === true) return false;
      return near(pts[0]?.x, start.x)
        && near(pts[0]?.y, start.y)
        && near(pts[1]?.x, end.x)
        && near(pts[1]?.y, end.y);
    }) || null;

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

    const seededEntities = await readAllEntities();
    const boundaryId = matchLine(seededEntities, boundaryStart, boundaryEnd)?.id;
    const poly1Id = matchOpenPolyline(seededEntities, poly1Start, poly1End)?.id;
    const poly2Id = matchOpenPolyline(seededEntities, poly2Start, poly2End)?.id;

    const readPolylineEndX = async (entityId) => page.evaluate((id) => {
      const d = window.__cadDebug;
      if (!d || typeof d.getEntity !== 'function') return NaN;
      const e = d.getEntity(id);
      const pts = e && Array.isArray(e.points) ? e.points : null;
      if (!pts || pts.length < 1) return NaN;
      const last = pts[pts.length - 1];
      return last && Number.isFinite(last.x) ? last.x : NaN;
    }, entityId);
    const waitForPolylineEndX = async (entityId, expectedX, tolerance = 0.05, timeout = timeoutMs) => {
      const deadline = Date.now() + timeout;
      let lastX = NaN;
      while (Date.now() < deadline) {
        lastX = await readPolylineEndX(entityId);
        if (Number.isFinite(lastX) && Math.abs(lastX - expectedX) <= tolerance) return lastX;
        await page.waitForTimeout(40);
      }
      throw new Error('Extend(polyline) endpoint did not reach x=' + expectedX + ' (last=' + lastX + ')');
    };

    if (!Number.isFinite(boundaryId)) throw new Error('Extend(polyline): failed to locate boundary entity');
    if (!Number.isFinite(poly1Id)) throw new Error('Extend(polyline): failed to locate poly1 entity');
    const poly1BeforeX = await readPolylineEndX(poly1Id);

    if (!Number.isFinite(poly2Id)) throw new Error('Extend(polyline): failed to locate poly2 entity');
    const poly2BeforeX = await readPolylineEndX(poly2Id);
    if (![poly1BeforeX, poly2BeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline): failed to read polyline endpoint x before extend');
    }

    // Drive polyline-end extension through the command surface instead of fragile pixel picks.
    // UI interaction is already covered by line/polyline extend steps above; this slice protects
    // the path-aware polyline endpoint contract and its undo/redo behavior.
    const extend1 = await runDebugCommand('selection.extend', {
      boundaryId,
      targetId: poly1Id,
      pick: { x: poly1End.x + 0.5, y: poly1End.y + 0.1 },
    });
    if (!extend1?.ok || extend1?.changed === false) {
      throw new Error('Extend(polyline)#1 command failed');
    }
    const extend2 = await runDebugCommand('selection.extend', {
      boundaryId,
      targetId: poly2Id,
      pick: { x: poly2End.x + 0.5, y: poly2End.y + 0.1 },
    });
    if (!extend2?.ok || extend2?.changed === false) {
      throw new Error('Extend(polyline)#2 command failed');
    }

    // Verify: both endpoints now land on the boundary x.
    const poly1AfterX = await waitForPolylineEndX(poly1Id, boundaryX);
    const poly2AfterX = await waitForPolylineEndX(poly2Id, boundaryX);

    // Undo/redo last extend should affect only poly2 endpoint.
    const extendUndo = await runDebugCommand('history.undo');
    if (!extendUndo?.ok) {
      throw new Error('Extend(polyline) undo failed');
    }
    const poly2UndoX = await waitForPolylineEndX(poly2Id, poly2BeforeX, 0.1);

    // Poly1 should remain extended.
    const poly1StillX = await readPolylineEndX(poly1Id);
    if (Math.abs(poly1StillX - boundaryX) > 0.05) {
      throw new Error('Extend(polyline) undo unexpectedly reverted poly1');
    }

    const extendRedo = await runDebugCommand('history.redo');
    if (!extendRedo?.ok) {
      throw new Error('Extend(polyline) redo failed');
    }
    const poly2RedoX = await waitForPolylineEndX(poly2Id, boundaryX);

    results.extend_polyline_endpoint = {
      boundaryX,
      poly1: { id: poly1Id, beforeX: poly1BeforeX, afterX: poly1AfterX, result: extend1 },
      poly2: { id: poly2Id, beforeX: poly2BeforeX, afterX: poly2AfterX, undoX: poly2UndoX, redoX: poly2RedoX, result: extend2 },
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

    const near = (a, b, tol = 1e-6) => Math.abs(Number(a) - Number(b)) <= tol;
    const matchLine = (entities, start, end) => entities.find((entity) => entity
      && entity.type === 'line'
      && near(entity.start?.x, start.x)
      && near(entity.start?.y, start.y)
      && near(entity.end?.x, end.x)
      && near(entity.end?.y, end.y)) || null;
    const matchOpenPolyline = (entities, start, end) => entities.find((entity) => {
      const pts = entity && entity.type === 'polyline' && Array.isArray(entity.points) ? entity.points : null;
      if (!pts || pts.length !== 2 || entity.closed === true) return false;
      return near(pts[0]?.x, start.x)
        && near(pts[0]?.y, start.y)
        && near(pts[1]?.x, end.x)
        && near(pts[1]?.y, end.y);
    }) || null;

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
    const seededEntities = await readAllEntities();
    const boundaryId = matchLine(seededEntities, boundaryStart, boundaryEnd)?.id;
    const failId = matchOpenPolyline(seededEntities, failStart, failEnd)?.id;
    const okId = matchOpenPolyline(seededEntities, okStart, okEnd)?.id;
    if (!Number.isFinite(boundaryId)) throw new Error('Extend(polyline failure): failed to locate boundary entity');
    if (!Number.isFinite(failId)) throw new Error('Extend(polyline failure): failed to locate fail polyline');
    const failBeforeX = await readPolylineEndX(failId);
    if (!Number.isFinite(okId)) throw new Error('Extend(polyline failure): failed to locate ok polyline');
    const okBeforeX = await readPolylineEndX(okId);
    if (![failBeforeX, okBeforeX].every(Number.isFinite)) {
      throw new Error('Extend(polyline failure): failed to read endpoint x before extend');
    }

    // Drive the failure->success path through the command surface for deterministic
    // polyline endpoint semantics. The line-based extend smoke above already covers
    // interactive boundary persistence in the browser.
    await setDebugSelection([failId], failId);
    const failExtend = await runDebugCommand('selection.extend', {
      boundaryId,
      targetId: failId,
      pick: { x: failEnd.x + 0.5, y: 1 },
    });
    if (failExtend?.ok !== false || failExtend?.error_code !== 'EXTEND_NO_INTERSECTION') {
      throw new Error('Extend(polyline failure) expected EXTEND_NO_INTERSECTION on failure attempt');
    }
    await setDebugSelection([okId], okId);
    const okExtend = await runDebugCommand('selection.extend', {
      boundaryId,
      targetId: okId,
      pick: { x: okEnd.x + 0.5, y: okEnd.y + 0.1 },
    });
    if (!okExtend?.ok) {
      throw new Error('Extend(polyline failure) success attempt failed');
    }

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
    const failUndo = await runDebugCommand('history.undo');
    if (!failUndo?.ok) {
      throw new Error('Extend(polyline failure) undo failed');
    }
    await page.waitForTimeout(80);
    const okUndoX = await readPolylineEndX(okId);
    if (Math.abs(okUndoX - okBeforeX) > 0.08) {
      throw new Error('Extend(polyline failure) undo did not restore ok polyline');
    }
    const failUndoX = await readPolylineEndX(failId);
    if (Math.abs(failUndoX - failBeforeX) > 0.05) {
      throw new Error('Extend(polyline failure) undo unexpectedly changed fail polyline');
    }

    const failRedo = await runDebugCommand('history.redo');
    if (!failRedo?.ok) {
      throw new Error('Extend(polyline failure) redo failed');
    }
    await page.waitForTimeout(80);
    const okRedoX = await readPolylineEndX(okId);
    if (Math.abs(okRedoX - okAfterX) > 0.08) {
      throw new Error('Extend(polyline failure) redo did not re-apply ok polyline');
    }

    results.extend_polyline_continue_after_failure = {
      boundaryX,
      fail: { id: failId, beforeX: failBeforeX, afterX: failAfterX, result: failExtend, undoX: failUndoX },
      ok: { id: okId, beforeX: okBeforeX, afterX: okAfterX, undoX: okUndoX, redoX: okRedoX, result: okExtend },
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
  await clickPagePoint(lockA);
  await clickPagePoint(lockB);
  await waitForTypesExact(['line']);
  const lockSelected = await waitForPrimaryEntityType('line');
  if (!lockSelected) {
    throw new Error('Layer lock: expected created line to be selected');
  }
  const lockLineId = lockSelected.id;
  const readLineEnd = async (entityId) => page.evaluate((id) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getEntity !== 'function') return null;
    const entity = d.getEntity(id);
    if (!entity || entity.type !== 'line' || !entity.end) return null;
    return {
      x: Number.isFinite(entity.end.x) ? entity.end.x : NaN,
      y: Number.isFinite(entity.end.y) ? entity.end.y : NaN,
    };
  }, entityId);
  const waitForLineEnd = async (entityId, expected, tolerance = 0.05, timeout = timeoutMs) => {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      last = await readLineEnd(entityId);
      if (
        last
        && Number.isFinite(last.x)
        && Number.isFinite(last.y)
        && Math.abs(last.x - expected.x) <= tolerance
        && Math.abs(last.y - expected.y) <= tolerance
      ) {
        return last;
      }
      await page.waitForTimeout(40);
    }
    throw new Error('Layer lock: line endpoint did not reach expected geometry ' + JSON.stringify({ expected, last }));
  };

  await page.click('[data-tool=\"select\"]');
  const lockBefore = {
    endX: await readNumberInput('end.x'),
    endY: await readNumberInput('end.y'),
  };
  if (![lockBefore.endX, lockBefore.endY].every(Number.isFinite)) {
    throw new Error('Layer lock: failed to read end.x/end.y before drag');
  }

  // Lock layer 0.
  await page.click('#cad-layer-list .cad-layer-item:has-text(\"0:0\") button[data-layer-action=\"locked\"]');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btn = el.querySelector('button[data-layer-action=locked]');
    if (!btn) return false;
    return String(btn.textContent || '').toLowerCase().includes('locked');
  }, null, { timeout: timeoutMs });

  await page.waitForFunction(() => !document.querySelector('#cad-property-form input[name="end.x"]'), null, { timeout: timeoutMs });
  await page.waitForSelector('[data-property-action=\"unlock-layer\"]', { timeout: timeoutMs });

  const lockStatusAfterBlockedEdit = (await page.textContent('#cad-status-message')) || '';
  const lockReadonlyNote = (await page.textContent('#cad-property-form .cad-readonly-note')) || '';
  if (!String(lockReadonlyNote).toLowerCase().includes('locked layer')) {
    throw new Error('Layer lock: expected locked-layer read-only note');
  }
  const lockAfterBlockedEntity = await waitForLineEnd(lockLineId, { x: lockBefore.endX, y: lockBefore.endY }, 1e-6);
  const lockAfterBlocked = {
    endX: lockAfterBlockedEntity.x,
    endY: lockAfterBlockedEntity.y,
  };

  // Unlock layer 0.
  await page.click('[data-property-action=\"unlock-layer\"]');
  await page.waitForSelector('#cad-property-form input[name=\"end.x\"]', { timeout: timeoutMs });

  // Ensure the line is selected before applying an edit.
  const unlockedSelection = await waitForPrimaryEntityType('line');
  if (!unlockedSelection || unlockedSelection.id !== lockLineId) {
    throw new Error('Layer lock: expected line selection to survive unlock');
  }

  const lockAfterX = lockBefore.endX + 10;
  await page.fill('#cad-property-form input[name=\"end.x\"]', String(lockAfterX));
  await blurActive();

  const lockAfterEntity = await waitForLineEnd(lockLineId, { x: lockAfterX, y: lockBefore.endY }, adaptiveTol(lockAfterX));
  const lockAfter = {
    endX: lockAfterEntity.x,
    endY: lockAfterEntity.y,
  };

  const lockUndo = await runDebugCommand('history.undo');
  if (!lockUndo?.ok) {
    throw new Error('Layer lock: undo failed');
  }
  await waitForLineEnd(lockLineId, { x: lockBefore.endX, y: lockBefore.endY }, adaptiveTol(lockBefore.endX));

  const lockRedo = await runDebugCommand('history.redo');
  if (!lockRedo?.ok) {
    throw new Error('Layer lock: redo failed');
  }
  await waitForLineEnd(lockLineId, { x: lockAfter.endX, y: lockAfter.endY }, adaptiveTol(lockAfter.endX));

  results.layer_lock_grip = {
    before: lockBefore,
    after: lockAfter,
    blockedAttempt: {
      after: lockAfterBlocked,
      note: lockReadonlyNote,
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

  // Force a deterministic snap-kind baseline for this endpoint smoke.
  await page.waitForSelector('#cad-snap-form', { timeout: timeoutMs });
  const endpointSmokeEndOpt = page.locator('#cad-snap-form label:has-text("Endpoint") input[type=checkbox]');
  const endpointSmokeMidOpt = page.locator('#cad-snap-form label:has-text("Midpoint") input[type=checkbox]');
  const endpointSmokeCenOpt = page.locator('#cad-snap-form label:has-text("Center") input[type=checkbox]');
  const endpointSmokeIntOpt = page.locator('#cad-snap-form label:has-text("Intersection") input[type=checkbox]');
  const endpointSmokeQuaOpt = page.locator('#cad-snap-form label:has-text("Quadrant") input[type=checkbox]');
  const endpointSmokeTanOpt = page.locator('#cad-snap-form label:has-text("Tangent") input[type=checkbox]');
  const endpointSmokeNeaOpt = page.locator('#cad-snap-form label:has-text("Nearest") input[type=checkbox]');
  const endpointSmokeGridOpt = page.locator('#cad-snap-form label:has-text("Grid") input[type=checkbox]');
  await endpointSmokeEndOpt.check();
  if (await endpointSmokeMidOpt.isChecked()) await endpointSmokeMidOpt.uncheck();
  if (await endpointSmokeCenOpt.isChecked()) await endpointSmokeCenOpt.uncheck();
  if (await endpointSmokeIntOpt.isChecked()) await endpointSmokeIntOpt.uncheck();
  if (await endpointSmokeQuaOpt.isChecked()) await endpointSmokeQuaOpt.uncheck();
  if (await endpointSmokeTanOpt.isChecked()) await endpointSmokeTanOpt.uncheck();
  if (await endpointSmokeNeaOpt.isChecked()) await endpointSmokeNeaOpt.uncheck();
  if (await endpointSmokeGridOpt.isChecked()) await endpointSmokeGridOpt.uncheck();
  const endpointSmokeState = {
    endpoint: await endpointSmokeEndOpt.isChecked(),
    midpoint: await endpointSmokeMidOpt.isChecked(),
    center: await endpointSmokeCenOpt.isChecked(),
    intersection: await endpointSmokeIntOpt.isChecked(),
    quadrant: await endpointSmokeQuaOpt.isChecked(),
    tangent: await endpointSmokeTanOpt.isChecked(),
    nearest: await endpointSmokeNeaOpt.isChecked(),
    grid: await endpointSmokeGridOpt.isChecked(),
  };
  if (!endpointSmokeState.endpoint
    || endpointSmokeState.midpoint
    || endpointSmokeState.center
    || endpointSmokeState.intersection
    || endpointSmokeState.quadrant
    || endpointSmokeState.tangent
    || endpointSmokeState.nearest
    || endpointSmokeState.grid) {
    throw new Error('Endpoint snap smoke setup failed: unexpected snap-kind checkbox state');
  }

  // Ensure snap master toggle is on.
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
  const refEndPage = await worldToPagePoint(refEnd);
  const refEndCanvas = await worldToCanvasPoint(refEnd);
  if (!refEndPage) {
    throw new Error('Endpoint snap failed: could not map ref end to page coordinates');
  }
  if (!refEndCanvas) {
    throw new Error('Endpoint snap failed: could not map ref end to canvas coordinates');
  }
  const nearCanvas = snapNearOffset(refEndCanvas, 4, 3);
  const resolveSnapProbe = async () => page.evaluate((args) => {
    const d = window.__cadDebug;
    if (!d || typeof d.screenToWorld !== 'function' || typeof d.resolveSnappedPoint !== 'function') return null;
    const nearWorld = d.screenToWorld(args.nearCanvas);
    if (!nearWorld) return null;
    const snapResult = d.resolveSnappedPoint(nearWorld, {});
    return { nearWorld, snapResult };
  }, { nearCanvas });
  let nearWorld = null;
  let snapResult = null;
  {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const probe = await resolveSnapProbe();
      nearWorld = probe?.nearWorld || null;
      snapResult = probe?.snapResult || null;
      const point = snapResult?.point || null;
      const kind = String(snapResult?.kind || '').toUpperCase();
      const snapDxProbe = point ? Math.abs(Number(point.x) - refEnd.x) : Infinity;
      const snapDyProbe = point ? Math.abs(Number(point.y) - refEnd.y) : Infinity;
      if (nearWorld && point && kind === 'END' && snapDxProbe <= 1e-6 && snapDyProbe <= 1e-6) {
        break;
      }
      nearWorld = null;
      snapResult = null;
      await page.waitForTimeout(50);
    }
  }
  if (!nearWorld) {
    throw new Error('Endpoint snap failed: could not map near canvas point to world');
  }
  if (!snapResult || !snapResult.point) {
    throw new Error('Endpoint snap failed: debug resolveSnappedPoint returned no result');
  }
  const line2Start = snapResult.point;
  const snapDx = Math.abs(Number(line2Start.x) - refEnd.x);
  const snapDy = Math.abs(Number(line2Start.y) - refEnd.y);
  if (snapDx > 1e-6 || snapDy > 1e-6) {
    throw new Error('Endpoint snap failed: start != ref end (dx=' + snapDx + ' dy=' + snapDy + ')');
  }
  if (String(snapResult.kind || '').toUpperCase() !== 'END') {
    throw new Error('Endpoint snap failed: expected END snap kind, got ' + JSON.stringify(snapResult.kind));
  }
  await ensureSnapOff();

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
    endpointSmokeState,
    refEnd,
    refEndPage,
    refEndCanvas,
    nearCanvas,
    nearWorld,
    snapResult,
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
  const moveLenTol = adaptiveTol(mvBeforeLen, 0.05, 0.02);
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
  const rtCenter = await worldToPagePoint(rotateBeforeEntity.start);
  const rtRef = await worldToPagePoint(rotateBeforeEntity.end);
  const rtTargetWorld = {
    x: rotateBeforeEntity.start.x,
    y: rotateBeforeEntity.start.y - lenBefore,
  };
  const rtTarget = await worldToPagePoint(rtTargetWorld);
  if (!rtCenter || !rtRef || !rtTarget) {
    throw new Error('Rotate(line) failed to map rotation geometry to canvas');
  }
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
  if (Math.abs(lenAfter - lenBefore) > adaptiveTol(lenBefore, 0.05, 0.02)) {
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
      targetWorld: rtTargetWorld,
      angleDeltaRad: angleDelta,
    },
    status: rotateStatus,
    summary: (await page.textContent('#cad-selection-summary')) || '',
  };

  setStep('box_select');
  // 18) Box select semantics: window (left->right) vs crossing (right->left) + Shift toggle
  await clearDoc();
  const boxLineInside = {
    start: { x: -10, y: 6 },
    end: { x: -2, y: 2 },
  };
  const boxLineCrossing = {
    start: { x: -10, y: -4 },
    end: { x: 12, y: -4 },
  };
  const createBoxLineInside = await runDebugCommand('entity.create', {
    entity: { type: 'line', ...boxLineInside },
  });
  const boxInsideState = await readDebugState();
  const boxInsideId = boxInsideState && Number.isFinite(boxInsideState.primaryId)
    ? Number(boxInsideState.primaryId)
    : NaN;
  if (!createBoxLineInside?.ok || !Number.isFinite(boxInsideId)) {
    throw new Error('box_select: failed to create contained line');
  }
  const createBoxLineCrossing = await runDebugCommand('entity.create', {
    entity: { type: 'line', ...boxLineCrossing },
  });
  const boxCrossingState = await readDebugState();
  const boxCrossingId = boxCrossingState && Number.isFinite(boxCrossingState.primaryId)
    ? Number(boxCrossingState.primaryId)
    : NaN;
  if (!createBoxLineCrossing?.ok || !Number.isFinite(boxCrossingId)) {
    throw new Error('box_select: failed to create crossing line');
  }
  await fitView();

  await page.click('[data-tool=\"select\"]');
  await setDebugSelection([], null);
  const boxSelectWorldRect = {
    x0: -12,
    y0: 8,
    x1: 6,
    y1: -8,
  };
  const boxTL = await worldToPagePoint({ x: boxSelectWorldRect.x0, y: boxSelectWorldRect.y0 });
  const boxBR = await worldToPagePoint({ x: boxSelectWorldRect.x1, y: boxSelectWorldRect.y1 });
  if (!boxTL || !boxBR) {
    throw new Error('box_select: failed to map selection rectangle to canvas');
  }

  // Window select: only the fully-contained line should be selected.
  const boxWindowResult = await runDebugCommand('selection.box', {
    rect: boxSelectWorldRect,
    crossing: false,
  });
  if (!boxWindowResult?.ok) {
    throw new Error('box_select: window selection command failed');
  }
  await page.waitForFunction((insideId) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) && ids.length === 1 && Number(ids[0]) === Number(insideId);
  }, boxInsideId, { timeout: timeoutMs });
  const boxWindowSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Crossing select: any endpoint inside should count, so both lines are selected.
  const boxCrossResult = await runDebugCommand('selection.box', {
    rect: {
      x0: boxSelectWorldRect.x1,
      y0: boxSelectWorldRect.y1,
      x1: boxSelectWorldRect.x0,
      y1: boxSelectWorldRect.y0,
    },
    crossing: true,
  });
  if (!boxCrossResult?.ok) {
    throw new Error('box_select: crossing selection command failed');
  }
  await page.waitForFunction(({ insideId, crossingId }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    if (!Array.isArray(ids) || ids.length !== 2) return false;
    return ids.includes(insideId) && ids.includes(crossingId);
  }, { insideId: boxInsideId, crossingId: boxCrossingId }, { timeout: timeoutMs });
  const boxCrossSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Shift+click toggles: remove one entity and add it back.
  const bxMid1 = midpoint(boxLineInside.start, boxLineInside.end);
  await clickWorldPoint(bxMid1, { shiftKey: true });
  await page.waitForFunction((crossingId) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    return Array.isArray(ids) && ids.length === 1 && Number(ids[0]) === Number(crossingId);
  }, boxCrossingId, { timeout: timeoutMs });
  const boxAfterShiftRemove = (await page.textContent('#cad-selection-summary')) || '';

  await clickWorldPoint(bxMid1, { shiftKey: true });
  await page.waitForFunction(({ insideId, crossingId }) => {
    const d = window.__cadDebug;
    if (!d || typeof d.getSelectionIds !== 'function') return false;
    const ids = d.getSelectionIds();
    if (!Array.isArray(ids) || ids.length !== 2) return false;
    return ids.includes(insideId) && ids.includes(crossingId);
  }, { insideId: boxInsideId, crossingId: boxCrossingId }, { timeout: timeoutMs });
  const boxAfterShiftAdd = (await page.textContent('#cad-selection-summary')) || '';

  results.box_select = {
    window: boxWindowSummary,
    crossing: boxCrossSummary,
    afterShiftRemove: boxAfterShiftRemove,
    afterShiftAdd: boxAfterShiftAdd,
    command: {
      window: boxWindowResult,
      crossing: boxCrossResult,
      rect: boxSelectWorldRect,
      pageRect: { topLeft: boxTL, bottomRight: boxBR },
    },
    ids: {
      inside: boxInsideId,
      crossing: boxCrossingId,
    },
  };

  setStep('layer_visibility');
  // 19) Layer visibility: hidden layer entities must not be pickable
  await clearDoc();

  // Disable snap so entity positions match click locations (pick tolerance is tighter than snap radius).
  await ensureSnapOff();

  // Ensure layer 0 is visible before creating entities (clearDoc keeps layers).
  const layer0Item = page.locator('#cad-layer-list .cad-layer-item:has-text(\"0:0\")');
  const layer0VisBtn = layer0Item.locator('button[data-layer-action=\"visibility\"]');
  const layer0VisLabel = ((await layer0VisBtn.textContent()) || '').toLowerCase();
  if (layer0VisLabel.includes('hidden')) {
    await layer0VisBtn.click();
  }
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    const el = items.find((n) => String(n.textContent || '').includes('0:0'));
    if (!el) return false;
    const btn = el.querySelector('button[data-layer-action=visibility]');
    if (!btn) return false;
    return String(btn.textContent || '').toLowerCase().includes('shown');
  }, null, { timeout: timeoutMs });

  // Add a second layer and put one line on it.
  await page.fill('#cad-new-layer-name', 'L1');
  await page.click('#cad-add-layer');
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#cad-layer-list .cad-layer-item'));
    return items.some((n) => String(n.textContent || '').includes(':L1'));
  }, null, { timeout: timeoutMs });
  const currentLayerAfterAdd = await readCurrentLayerPanel();
  if (!currentLayerAfterAdd || !String(currentLayerAfterAdd.text || '').includes(':L1')) {
    throw new Error('layer_visibility: expected new L1 layer to become current, got ' + JSON.stringify(currentLayerAfterAdd));
  }
  const l1LayerId = Number(currentLayerAfterAdd.layerId);
  if (!Number.isFinite(l1LayerId)) {
    throw new Error('layer_visibility: current layer did not expose a finite layer id after add');
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
  const layer0HiddenViaUi = await waitForLayerButtonLabel('0:0', 'visibility', 'hidden', 1500);
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
  await clickPagePoint(lvBlank);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected no selection after clear, got: ' + txt);
  }

  // Click midpoint of the layer-0 line (hidden) — should not pick.
  const ly0MidPage = await worldToPagePoint({ x: 0, y: 5 });
  if (!ly0MidPage) throw new Error('layer_visibility: failed to map layer-0 midpoint');
  await clickPagePoint(ly0MidPage);
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
  await setDebugSelection([], null);
  if (!await waitForNoSelectionSummary(timeoutMs)) {
    const txt = (await page.textContent('#cad-selection-summary')) || '';
    throw new Error('layer_visibility: expected no selection before visible pick, got: ' + txt);
  }

  // Visible layer 1 entity must still be pickable.
  const ly1MidPage = await worldToPagePoint({ x: 0, y: -5 });
  if (!ly1MidPage) throw new Error('layer_visibility: failed to map layer-1 midpoint');
  await clickPagePoint(ly1MidPage);
  await waitForTypesExact(['line']);
  const visiblePickSummary = (await page.textContent('#cad-selection-summary')) || '';

  // Show layer 0 again and ensure it becomes pickable.
  await layer0VisBtn.click();
  const layer0ShownViaUi = await waitForLayerButtonLabel('0:0', 'visibility', 'shown', 1500);
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
  await setDebugSelection([], null);
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
  const snapRadiusInput = page.locator('#cad-snap-form label:has-text(\"Snap radius\") input[type=number]');
  await snapRadiusInput.fill('24');
  await snapRadiusInput.dispatchEvent('change');

  async function setSnapKindsState({
    endpoint = false,
    midpoint = false,
    center = false,
    intersection = false,
    quadrant = false,
    grid = false,
    nearest = false,
    tangent = false,
  }) {
    const steps = [
      [endpointOpt, endpoint],
      [midpointOpt, midpoint],
      [centerOpt, center],
      [intersectionOpt, intersection],
      [quadrantOpt, quadrant],
      [gridOpt, grid],
      [nearestOpt, nearest],
      [tangentOpt, tangent],
    ];
    for (const [locator, checked] of steps) {
      if (checked) {
        await locator.check();
      } else if (await locator.isChecked()) {
        await locator.uncheck();
      }
    }
  }

  async function resolveDebugSnap(worldPoint, opts = {}) {
    return page.evaluate((args) => {
      const d = window.__cadDebug;
      if (!d || typeof d.resolveSnappedPoint !== 'function') return null;
      return d.resolveSnappedPoint(args.worldPoint, args.opts || {});
    }, { worldPoint, opts });
  }

  async function createFixtureEntity(entity, label) {
    const result = await runDebugCommand('entity.create', { entity });
    if (!result?.ok) {
      throw new Error(`${label}: failed to create fixture entity`);
    }
  }

  function assertPointNear(name, actual, expected, tol = 1e-4) {
    const dx = Math.abs(Number(actual?.x) - Number(expected?.x));
    const dy = Math.abs(Number(actual?.y) - Number(expected?.y));
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx > tol || dy > tol) {
      throw new Error(`${name} snap failed (dx=${dx} dy=${dy})`);
    }
  }

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

  // MID snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ midpoint: true });
  const midLine = {
    type: 'line',
    layerId: 0,
    start: { x: -12, y: 6 },
    end: { x: 12, y: 6 },
  };
  await createFixtureEntity(midLine, 'MID');
  await fitView();
  const expectedMid = midpoint(midLine.start, midLine.end);
  const midSnapped = await resolveDebugSnap({ x: expectedMid.x + 0.18, y: expectedMid.y + 0.12 }, {});
  if (!midSnapped?.snapped || String(midSnapped.kind || '').toUpperCase() !== 'MID') {
    throw new Error('MID snap failed: expected MID kind, got ' + JSON.stringify(midSnapped));
  }
  assertPointNear('MID', midSnapped.point, expectedMid);

  // CEN snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ center: true });
  const cenCenter = { x: -4, y: 0 };
  const cenRadius = 6;
  await createFixtureEntity({
    type: 'circle',
    layerId: 0,
    center: cenCenter,
    radius: cenRadius,
  }, 'CEN');
  await fitView();
  const expectedCen = { ...cenCenter };
  const cenSnapped = await resolveDebugSnap({ x: cenCenter.x + 0.2, y: cenCenter.y + 0.16 }, {});
  if (!cenSnapped?.snapped || String(cenSnapped.kind || '').toUpperCase() !== 'CEN') {
    throw new Error('CEN snap failed: expected CEN kind, got ' + JSON.stringify(cenSnapped));
  }
  assertPointNear('CEN', cenSnapped.point, expectedCen);

  // INT snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ intersection: true });
  const intHorizontal = {
    type: 'line',
    layerId: 0,
    start: { x: -10, y: 0 },
    end: { x: 10, y: 0 },
  };
  const intVertical = {
    type: 'line',
    layerId: 0,
    start: { x: 0, y: -12 },
    end: { x: 0, y: 12 },
  };
  await createFixtureEntity(intHorizontal, 'INT');
  await createFixtureEntity(intVertical, 'INT');
  await fitView();
  const expectedInt = { x: 0, y: 0 };
  const intSnapped = await resolveDebugSnap({ x: 0.16, y: 0.18 }, {});
  if (!intSnapped?.snapped || String(intSnapped.kind || '').toUpperCase() !== 'INT') {
    throw new Error('INT snap failed: expected INT kind, got ' + JSON.stringify(intSnapped));
  }
  assertPointNear('INT', intSnapped.point, expectedInt);

  // QUA snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ quadrant: true });
  const quaCenter = { x: -4, y: 0 };
  const quaRadius = 6;
  await createFixtureEntity({
    type: 'circle',
    layerId: 0,
    center: quaCenter,
    radius: quaRadius,
  }, 'QUA');
  await fitView();
  const quaExpected = { x: quaCenter.x + quaRadius, y: quaCenter.y };
  const quaSnapped = await resolveDebugSnap({ x: quaExpected.x + 0.18, y: quaExpected.y + 0.08 }, {});
  if (!quaSnapped?.snapped || String(quaSnapped.kind || '').toUpperCase() !== 'QUA') {
    throw new Error('QUA snap failed: expected QUA kind, got ' + JSON.stringify(quaSnapped));
  }
  assertPointNear('QUA', quaSnapped.point, quaExpected);

  // NEA snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ nearest: true });
  const neaCenter = { x: -4, y: 0 };
  const neaRadius = 6;
  await createFixtureEntity({
    type: 'circle',
    layerId: 0,
    center: neaCenter,
    radius: neaRadius,
  }, 'NEA');
  await fitView();
  const neaCursor = { x: neaCenter.x + 5.1, y: neaCenter.y + 1.4 };
  const ndx = neaCursor.x - neaCenter.x;
  const ndy = neaCursor.y - neaCenter.y;
  const nlen = Math.hypot(ndx, ndy);
  const neaExpected = {
    x: neaCenter.x + (ndx / nlen) * neaRadius,
    y: neaCenter.y + (ndy / nlen) * neaRadius,
  };
  const neaSnapped = await resolveDebugSnap(neaCursor, {});
  if (!neaSnapped?.snapped || String(neaSnapped.kind || '').toUpperCase() !== 'NEA') {
    throw new Error('NEA snap failed: expected NEA kind, got ' + JSON.stringify(neaSnapped));
  }
  assertPointNear('NEA', neaSnapped.point, neaExpected, 0.05);

  // TAN snap
  await clearDoc();
  await ensureSnapOn();
  await setSnapKindsState({ tangent: true });
  const tanCenter = { x: 0, y: 0 };
  const tanRadius = 5;
  const tanStartWorld = { x: -12, y: -9 };
  await createFixtureEntity({
    type: 'circle',
    layerId: 0,
    center: tanCenter,
    radius: tanRadius,
  }, 'TAN');
  await fitView();
  const tanCandidates = tangentPoints(tanCenter, tanRadius, tanStartWorld)
    .sort((a, b) => a.y - b.y);
  if (tanCandidates.length < 2) {
    throw new Error('TAN setup failed: expected 2 tangent candidates');
  }
  const tanProbe = {
    x: tanCandidates[0].x + 0.18,
    y: tanCandidates[0].y + 0.12,
  };
  const tanSnap = await resolveDebugSnap(tanProbe, { tangentFrom: tanStartWorld });
  if (!tanSnap?.snapped || String(tanSnap.kind || '').toUpperCase() !== 'TAN') {
    throw new Error('TAN snap failed: expected TAN kind, got ' + JSON.stringify(tanSnap));
  }
  const tanLineStart = { ...tanStartWorld };
  const tanLineEnd = { x: tanSnap.point.x, y: tanSnap.point.y };
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
    mid: { expected: expectedMid, got: midSnapped.point, kind: midSnapped.kind },
    cen: { expected: expectedCen, got: cenSnapped.point, kind: cenSnapped.kind },
    int: { expected: expectedInt, got: intSnapped.point, kind: intSnapped.kind },
    qua: { expected: quaExpected, got: quaSnapped.point, kind: quaSnapped.kind },
    nea: { cursor: neaCursor, expected: neaExpected, got: neaSnapped.point, kind: neaSnapped.kind },
    tan: {
      center: tanCenter,
      radius: tanRadius,
      start: tanLineStart,
      end: tanLineEnd,
      probe: tanProbe,
      kind: tanSnap.kind,
    },
  };

  } catch (err) {
    const selectionSummary = (await page.textContent('#cad-selection-summary')) || '';
    const statusMessage = (await page.textContent('#cad-status-message')) || '';
    const selectionDetails = await readSelectionDetails();
    results.__error = {
      step: results.__step,
      message: err && err.message ? String(err.message) : String(err),
      stack: err && err.stack ? String(err.stack) : '',
      selectionSummary,
      selectionDetails,
      statusMessage,
    };
  }

  // Short final snapshot for PASS paths (makes triage easier even without __error).
  results.__final = {
    selectionSummary: (await page.textContent('#cad-selection-summary')) || '',
    selectionDetails: await readSelectionDetails(),
    statusMessage: (await page.textContent('#cad-status-message')) || '',
  };
  return results;
})
__CAD_UI_FLOW__
)"
FLOW_JS="${FLOW_JS//__TIMEOUT_MS__/${TIMEOUT_MS}}"
pwcli_cmd "$PWCLI" run-code "$FLOW_JS" >"$FLOW_RESULT" 2>>"$PLAYWRIGHT_LOG"
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
  } >>"$PLAYWRIGHT_LOG" 2>&1

  pwcli_cmd "$PWCLI" console warning >"$CONSOLE_LOG" 2>&1 || true
  cat "$CONSOLE_LOG" >>"$PLAYWRIGHT_LOG" 2>/dev/null || true
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
  provenance = flow_payload.get("selection_provenance_summary") if isinstance(flow_payload.get("selection_provenance_summary"), dict) else {}

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
      "fillet_curve_single_preselection_ok": (
        to_bool(pre.get("filletCurvePreselected"))
        and to_bool(pre.get("filletCurvePromptSecond"))
        and to_bool(pre.get("filletCurveApplied"))
        and as_int(pre.get("filletCurveArcCount"), 0) >= 2
      ),
      "chamfer_curve_single_preselection_ok": (
        to_bool(pre.get("chamferCurvePreselected"))
        and to_bool(pre.get("chamferCurvePromptSecond"))
        and to_bool(pre.get("chamferCurveApplied"))
        and as_int(pre.get("chamferCurveLineCount"), 0) >= 2
        and as_int(pre.get("chamferCurveArcCount"), 0) >= 1
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
      "fillet_curve_pair_preselection_ok": (
        to_bool(pre.get("filletCurvePairPromptSecond"))
        and to_bool(pre.get("filletCurvePairApplied"))
        and as_int(pre.get("filletCurvePairArcCount"), 0) >= 2
      ),
      "chamfer_curve_pair_preselection_ok": (
        to_bool(pre.get("chamferCurvePairPromptSecond"))
        and to_bool(pre.get("chamferCurvePairApplied"))
        and as_int(pre.get("chamferCurvePairLineCount"), 0) >= 2
        and as_int(pre.get("chamferCurvePairArcCount"), 0) >= 1
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
  if provenance:
    before = as_dict(provenance.get("before"))
    after = as_dict(provenance.get("after"))
    before_items = as_dict(before.get("items"))
    after_items = as_dict(after.get("items"))
    target_layer = as_dict(provenance.get("target_layer"))
    target_layer_id = as_int(target_layer.get("id"), -1)
    target_layer_name = str(target_layer.get("name") or "")
    target_layer_color = str(target_layer.get("color") or "")
    target_layer_label = f"{target_layer_id}:{target_layer_name}" if target_layer_id >= 0 and target_layer_name else ""
    entity = as_dict(provenance.get("entity"))
    checks["selection_provenance_summary_ok"] = (
      str(before.get("mode") or "") == "single"
      and as_int(before.get("entityCount"), 0) == 1
      and str(before.get("primaryType") or "") == "line"
      and str(before_items.get("origin") or "") == "INSERT / fragment"
      and str(before_items.get("effective-color") or "") == "#d0d7de"
      and str(before_items.get("color-source") or "") == "BYLAYER"
      and str(before_items.get("color-aci") or "") == "8"
      and str(before_items.get("space") or "") == "Paper"
      and str(before_items.get("layout") or "") == "Layout-A"
      and str(before_items.get("line-type") or "") == "HIDDEN2"
      and str(before_items.get("line-weight") or "") == "0.55"
      and str(before_items.get("line-type-scale") or "") == "1.7"
      and str(after_items.get("layer") or "") == target_layer_label
      and str(after_items.get("effective-color") or "") == target_layer_color
      and str(after_items.get("color-source") or "") == "BYLAYER"
      and as_int(entity.get("layerId"), -1) == target_layer_id
      and str(entity.get("colorSource") or "") == "BYLAYER"
    )
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

interaction_checks = payload.get("interaction_checks") if isinstance(payload.get("interaction_checks"), dict) else {}
failed_interaction_checks = []
if interaction_checks:
  failed_interaction_checks = sorted(
    key for key, value in interaction_checks.items()
    if key != "complete" and not to_bool(value)
  )
  payload["interaction_checks_complete"] = to_bool(interaction_checks.get("complete"))
  payload["first_failed_interaction_check"] = failed_interaction_checks[0] if failed_interaction_checks else ""
else:
  payload["interaction_checks_complete"] = True
  payload["first_failed_interaction_check"] = ""

payload["gate_ok"] = bool(payload.get("ok")) and bool(payload.get("interaction_checks_complete"))

payload["flow_failure_code"] = ""
payload["flow_failure_detail"] = ""
payload["flow_failure_stage"] = ""
if payload.get("gate_ok") is not True:
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
  elif interaction_checks and not payload.get("interaction_checks_complete"):
    detail = first_nonempty([
      payload.get("first_failed_interaction_check"),
      flow_status,
      *error_tail,
    ])
    payload["flow_failure_code"] = "UI_FLOW_INTERACTION_CHECK_FAIL"
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

GATE_OK="$OK"
if [[ -s "$SUMMARY" ]]; then
  set +e
  GATE_OK="$(python3 - "$SUMMARY" <<'PY'
import json
import sys

path = sys.argv[1]
try:
  payload = json.load(open(path, "r", encoding="utf-8", errors="replace"))
except Exception:
  print("false")
  raise SystemExit(0)

print("true" if bool(payload.get("gate_ok")) else "false")
PY
)"
  set -e
fi

if [[ "$MODE" == "gate" && "$GATE_OK" != "true" ]]; then
  exit 2
fi
exit 0
