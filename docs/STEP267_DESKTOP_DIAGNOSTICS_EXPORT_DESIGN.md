# Step267: Desktop Diagnostics Export Design

## Goal

Turn the live desktop readiness surface into a first-class support artifact, so QA and support can
export one authoritative JSON snapshot instead of copying fragmented status text from the modal.

## Problem

Before Step267:

- the desktop settings modal already exposed live router + DWG readiness
- runtime provenance was visible in the UI
- live and packaged settings smokes already proved those facts rendered correctly

But support still had a product gap:

- readiness facts only lived as on-screen text
- app/runtime/settings state could not be exported as one structured payload
- packaged support triage still depended on screenshots or manual copy/paste

## Contract

### 1. Settings exposes `Export Diagnostics`

The live desktop settings modal must include an `Export Diagnostics` action next to
`Test Router` / `Check DWG`.

### 2. Desktop bridge exposes app identity

The desktop preload/main bridge must provide structured app facts so the export can distinguish
live vs packaged runtime:

- app name / version
- packaged flag
- platform / arch
- Electron / Chrome / Node versions
- app / exe / user-data paths

### 3. Exported payload uses a stable schema

The downloaded support bundle must use:

- `schema = "vemcad.desktop.diagnostics.v1"`

and include:

- app metadata
- main status and settings status
- desktop defaults / current / draft / stored overrides / effective settings
- latest router result
- latest DWG result
- runtime asset provenance
- page URL

### 4. Export runs from the real readiness pipeline

The export must reuse the same combined router + DWG readiness refresh path used by the modal,
instead of serializing stale cached values.

### 5. Live and packaged settings smokes enforce the payload

Both settings smokes must export diagnostics from the real renderer and assert:

- schema id
- app facts
- effective settings
- DWG route facts
- local runtime asset provenance

### 6. Real packaged DWG open remains green

The stronger packaged DWG smoke must remain green after adding the diagnostics/export surface.

## Key Files

- `tools/web_viewer/index.html`
- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer_desktop/preload.js`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/README.md`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step267 is complete when:

- the settings modal exposes `Export Diagnostics`
- export downloads a structured `vemcad.desktop.diagnostics.v1` snapshot
- live and packaged settings smokes both assert exported payload contents
- packaged real DWG open remains green after the change
