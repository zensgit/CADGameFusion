# Step261: Desktop Runtime Diagnostics Design

## Goal

Turn desktop DWG readiness from a backend-only fact into a first-class product surface:

- Settings should open with the real combined router + DWG truth
- the UI should explicitly say which CAD runtime is in use
- packaged builds should expose whether they are using packaged `cad_resources`

This targets the remaining ordinary-user/support gap after Step260: the app could already open a real `.dwg`, but the live UI still made users infer too much from raw paths.

## Problem

Before Step261:

- opening Settings auto-ran only DWG readiness
- router readiness still required a manual `Test Router`
- runtime provenance existed in backend/package behavior, but not as formal UI-facing fields

That meant packaged readiness was real, but not immediately legible.

## Contract

### 1. Desktop runtime diagnostics are formal result fields

Router / DWG / open results now expose:

- `cad_runtime_root`
- `cad_runtime_source`
- `cad_runtime_ready`
- `router_service_path`
- `plm_convert_path`
- `viewer_root`

DWG readiness also exposes:

- `dwg_service_path`

These are not log-only facts; they are part of the desktop contract.

### 2. Settings opens with combined readiness

Opening Settings now auto-runs both:

- router readiness
- DWG readiness

and renders them in one combined status panel:

- `[Router]`
- `[DWG]`

This makes the modal a true first-screen diagnostic surface instead of a single-lane DWG check.

### 3. Packaged runtime provenance must be explicit

When the app is running from packaged assets, the UI must make that visible via:

- `CAD runtime source: packaged-cad-resources`
- `CAD runtime root: .../Contents/Resources/cad_resources`
- `CAD runtime ready: yes`

alongside the concrete runtime paths:

- bundled router service
- bundled `plm_convert.py`
- bundled viewer root

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Non-Goals

Step261 does not:

- add a second modal or separate diagnostics page
- replace packaged smoke with UI smoke
- change the actual DWG route preference logic

## Acceptance

Step261 is complete when:

- router/DWG/open results carry runtime diagnostics formally
- Settings opens with combined router + DWG status
- live UI smoke proves packaged-style runtime facts are visible
- real packaged DWG smoke proves those fields also exist in actual packaged runtime results
