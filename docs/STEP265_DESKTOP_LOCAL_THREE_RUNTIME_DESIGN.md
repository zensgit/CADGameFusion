# Step265: Desktop Local Three Runtime Design

## Goal

Remove the core viewer runtime dependency on `https://unpkg.com` so live desktop, packaged desktop,
and packaged DWG open all run against a self-contained local Three.js module set.

## Problem

Before Step265:

- desktop DWG route/readiness and packaged autostart were already green
- the live renderer still imported `three`, `OrbitControls`, `GLTFLoader`, and line overlay modules
  from `unpkg`
- packaged settings smoke could pass while the renderer still depended on a CDN for core module
  resolution

That left an avoidable product gap: packaged desktop was operational, but not fully self-contained.

## Contract

### 1. Three.js is vendored locally

The viewer must load its core Three.js runtime from `tools/web_viewer/vendor/three`, not from
remote CDN URLs.

### 2. Runtime asset provenance is inspectable

`preview_app.js` must expose the resolved runtime asset URLs through the existing debug surface, so
smokes can prove which module set actually loaded.

### 3. Live and packaged settings smokes enforce no Three CDN dependency

Both desktop settings smokes must record `three_cdn_requests` and fail if any request hits
`unpkg.com/three`.

### 4. Packaged real DWG open still works

The stronger packaged DWG smoke must remain green after the viewer runtime switches to local
vendored modules.

## Key Files

- `tools/web_viewer/index.html`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/vendor/three/**`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer/README.md`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step265 is complete when:

- `index.html` importmap no longer points to `unpkg`
- `preview_app.js` no longer imports remote Three.js URLs
- live and packaged settings smokes both report local `runtime_assets`
- both settings smokes report `three_cdn_requests=[]`
- packaged real DWG open remains green after repacking
