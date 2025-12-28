# Step 52: Mobile/PWA Adaptation - Design

## Goal
Make the web viewer usable on mobile/tablet and provide a lightweight PWA shell for offline UI caching.

## Changes
- Added `manifest.webmanifest` with SVG icon + theme colors.
- Added `service-worker.js` to cache UI assets.
- Linked manifest and theme color in `index.html` and registered the service worker.
- Responsive tweaks: panel scroll on small screens, compact HUD spacing.

## Files Added/Updated
- `tools/web_viewer/manifest.webmanifest`
- `tools/web_viewer/service-worker.js`
- `tools/web_viewer/assets/icon.svg`
- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/README.md`
