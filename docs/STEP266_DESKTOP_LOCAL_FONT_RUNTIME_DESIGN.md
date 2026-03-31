# Step266: Desktop Local Font Runtime Design

## Goal

Remove the remaining first-paint dependency on Google Fonts so live desktop, packaged desktop, and
packaged DWG open all render against self-contained local UI assets.

## Problem

Before Step266:

- Step265 already removed the viewer's core Three.js CDN dependency
- `index.html` still linked `fonts.googleapis.com`
- first paint for `Space Grotesk` / `IBM Plex Mono` still depended on `fonts.gstatic.com`

That meant the packaged app could open DWG offline in functional terms, but not in fully
self-contained UI-runtime terms.

## Contract

### 1. Viewer fonts are vendored locally

The viewer must ship local font files for:

- `Space Grotesk`
- `IBM Plex Mono`

and load them through local `@font-face` declarations.

### 2. No Google Fonts links remain in the viewer entrypoint

`tools/web_viewer/index.html` must not keep:

- `fonts.googleapis.com`
- `fonts.gstatic.com`

preconnect or stylesheet links.

### 3. Desktop settings smokes enforce no font CDN dependency

Both live and packaged settings smokes must record `font_cdn_requests` and fail if any request
hits:

- `fonts.googleapis.com`
- `fonts.gstatic.com`

### 4. Packaged DWG open remains green

The stronger packaged DWG smoke must remain green after repacking with local font assets.

## Key Files

- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/vendor/fonts/**`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer/README.md`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step266 is complete when:

- the viewer entrypoint no longer references Google Fonts
- `style.css` loads local `Space Grotesk` and `IBM Plex Mono`
- live and packaged settings smokes both report `font_cdn_requests=[]`
- packaged real DWG open remains green after repacking
