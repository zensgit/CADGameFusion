# Step257: Desktop DWG Route Mode Control Design

## Goal

Turn DWG route selection from an implicit internal preference into an explicit user-controlled workflow.

## Problem

By Step256, the desktop product already:

- selected a working DWG route automatically
- surfaced route/readiness in Settings
- explained setup failures with actionable hints

That was good enough for the default path, but still weak for QA, support, and advanced users:

- there was no first-class way to force `local-convert` while `direct-plugin` was also available
- there was no stable proof that a forced route stayed forced through the real desktop path
- the live UI could show the chosen route, but not always the user-selected route mode behind it

## Contract

### 1. Route mode becomes a persisted desktop setting

The live settings modal now exposes:

- `auto`
- `direct-plugin`
- `local-convert`

under `DWG Route Mode`.

This value is stored with the rest of the desktop overrides.

### 2. Main process enforces the selected route mode

`resolveDwgReadiness()` and `resolveDwgOpenPlan()` treat route mode as an explicit contract:

- `auto`
  - prefer `direct-plugin`, fallback to `local-convert`
- `direct-plugin`
  - only allow direct plugin
  - do not silently fall back to local conversion
- `local-convert`
  - only allow local conversion
  - do not silently fall back to direct plugin

### 3. Route mode is visible in diagnostics

Structured status/results now show:

- `Route`
- `Route mode`
- readiness booleans

This applies to:

- `Check DWG`
- `Open CAD File` result details

### 4. Browser smoke protects forced-route behavior

The live settings smoke must prove:

1. default `auto` still picks `direct-plugin`
2. forcing `local-convert` yields `Opened ... via local-convert.`
3. forcing `local-convert` with a missing convert command fails cleanly
4. the failure still shows that direct-plugin is available, but intentionally unused because route mode is forced

### 5. Real desktop smoke can force route mode

`tools/plm_dwg_open_desktop_smoke.py` now accepts:

- `--dwg-route-mode auto|direct-plugin|local-convert`

and validates that both `prepared` and `convert` preserve the forced route mode.

## Key Files

- `tools/web_viewer/index.html`
- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer_desktop/main.js`
- `tools/plm_dwg_open_desktop_smoke.py`

## Non-Goals

Step257 does not:

- change DWG geometry output
- change the default preference that `auto` uses
- replace installer/packaging work

## Acceptance

Step257 is complete when:

- route mode is editable and persisted in the live UI
- forced `local-convert` is visible in both browser smoke and real desktop smoke
- forced-route failures do not silently fall back to another path
