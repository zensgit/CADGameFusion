# Step270: Desktop Packaged Open CAD UI Smoke Design

## Goal

Verify the real packaged desktop `Open CAD File` user flow end-to-end after startup auto-repair, while making the packaged `dwg2dxf` fallback self-contained and visible in diagnostics.

## Problem

- Step269 proves packaged startup can self-repair stale local settings.
- Step262 proves packaged Settings can open and render runtime diagnostics.
- Step260 proves packaged DWG open can succeed through the desktop lane.

But those proofs still leave a gap:

1. the packaged Settings smoke never clicks the real `Open CAD File` button;
2. the Python packaged smoke validates the desktop lane, but bypasses the renderer-level UX contract;
3. packaged fallback conversion may still depend on host `dwg2dxf` unless the pack step stages it into packaged CAD resources.

Step270 closes that gap by making the packaged Settings smoke exercise the real viewer controls and by promoting staged `dwg2dxf` into packaged runtime defaults.

## Contract

### 1. Deterministic packaged open-file selection for smoke

Packaged smoke must be able to trigger the real `Open CAD File` action without manual dialog interaction.

- `main.js` accepts a smoke-only file override from:
  - CLI `--smoke-open-file`
  - `VEMCAD_SMOKE_OPEN_FILE_PATH`
  - `CADGF_SMOKE_OPEN_FILE_PATH`
- when the override exists, `vemcad:open-cad-file` uses that file directly;
- when the override is configured but missing, the IPC handler returns a structured failure instead of silently falling back to the file picker.

This keeps production UX unchanged while making packaged UI verification deterministic.

### 2. Bundled `dwg2dxf` is part of packaged CAD runtime detection

Packaged builds should prefer a staged `dwg2dxf` binary from packaged CAD resources before consulting host-level common paths.

- pack staging copies an available host `dwg2dxf` into `cad_resources/dwg_service/bin/`;
- runtime detection prefers packaged candidates under `Resources/cad_resources/...`;
- desktop diagnostics and settings form must expose that packaged path as the active `dwg2dxf` runtime.

This keeps the fallback conversion story consistent with the already-bundled router/plugin/convert-cli resources.

### 3. Packaged settings smoke must prove the real viewer flow

After startup auto-repair has recovered packaged defaults, smoke must:

1. confirm packaged readiness and diagnostics expose the staged `dwg2dxf` path;
2. click the real `Open CAD File` button in the renderer;
3. verify main status reports successful open through the actual route, currently `Opened ... via direct-plugin.`;
4. verify a router-misconfigured save still auto-opens Settings with the expected recovery hint;
5. verify `Reset` restores packaged defaults, including the staged `dwg2dxf` path, and clears local overrides.

### 4. Cross-smoke consistency

The Python packaged DWG smoke remains valuable as a broader runtime proof, but it should also assert that runtime autodetect resolved `dwg2dxf` from packaged `cad_resources/dwg_service/bin`.

## Scope

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/plm_dwg_open_desktop_smoke.py`
- `docs/STEP270_DESKTOP_PACKAGED_OPEN_CAD_UI_SMOKE_DESIGN.md`
- `docs/STEP270_DESKTOP_PACKAGED_OPEN_CAD_UI_SMOKE_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step270 is complete when:

- packaged smoke can deterministically drive `Open CAD File` without a manual picker;
- packaged readiness, saved settings, and diagnostics all agree on the staged `dwg2dxf` runtime path;
- the real packaged viewer flow opens a sample DWG successfully after startup auto-repair;
- packaged router misconfiguration still reopens Settings with an actionable hint;
- `Reset` restores packaged defaults and clears localStorage overrides;
- packaged Python smoke confirms runtime autodetect resolved `dwg2dxf` from packaged CAD resources.
