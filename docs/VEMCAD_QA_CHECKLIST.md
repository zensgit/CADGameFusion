# VemCAD QA Checklist

Use this checklist before any internal release.

## Router
- [ ] Start router and confirm `/health` returns `status=ok`.
- [ ] Upload a DXF via `/convert` and open the returned `viewer_url`.

## Desktop App
- [ ] Review latest automated DWG evidence (`STEP250` desktop route proof and `STEP251` 44-case matrix proof).
- [ ] Launch VemCAD and open Settings (Cmd/Ctrl+,).
- [ ] Confirm the main status line immediately shows startup readiness before opening Settings.
- [ ] Set Router URL, plugin, convert_cli, and DWG command if needed.
- [ ] Confirm the settings modal auto-renders DWG readiness on open (no extra click required).
- [ ] Confirm the settings modal opens with combined `[Router]` + `[DWG]` readiness, not just DWG.
- [ ] Confirm the modal shows runtime provenance (`CAD runtime source/root/ready`, `Router service`, `Preview pipeline`, `Viewer root`).
- [ ] Save a bad local override, click **Use Recommended**, and confirm the form snaps back to detected defaults while local overrides are cleared.
- [ ] Click **Export Diagnostics** and confirm the downloaded bundle reports `schema=vemcad.desktop.diagnostics.v1`, packaged/live app facts, effective settings, router result, DWG result, and local runtime assets.
- [ ] In packaged desktop, confirm **Export Diagnostics** reports a concrete saved file path and that the JSON file is actually written to disk with `schema=vemcad.desktop.diagnostics.v1`.
- [ ] Confirm the latest live/packaged settings smoke summaries report `three_cdn_requests=[]` and local `vendor/three` runtime asset URLs.
- [ ] Confirm the latest live/packaged settings smoke summaries report `font_cdn_requests=[]`.
- [ ] Click **Test Router** (must show version/commit).
- [ ] Click **Check DWG** (must return ok and show `route=direct-plugin` or `route=local-convert`).
- [ ] Force `DWG Route Mode = local-convert` and confirm `Open CAD File` reports `Opened ... via local-convert.`
- [ ] Temporarily clear DWG plugin/convert setup and confirm `Open CAD File` reopens Settings with a `Hint: ...` recovery message.
- [ ] Temporarily clear Router URL and confirm `Open CAD File` reopens Settings with router-specific recovery facts (`Router URL / auto start / start cmd / plugin / convert_cli`) plus a `Hint: ...`.
- [ ] Stage desktop CAD resources and confirm real DWG open still works without explicitly passing plugin/convert_cli/DWG convert overrides to Electron.
- [ ] Confirm the packaged app (`dist/mac-arm64/VemCAD.app` or platform equivalent) can open a real DWG with default local auto-start and packaged `cad_resources` only.

## File Open
- [ ] Open a DXF (should render geometry + layers).
- [ ] Open a DWG (should open through the reported route, render successfully, show no UTF-8 errors, and report `Opened ... via <route>.` in the status line).
- [ ] Verify entity selection shows metadata (color/layer/name).

## Diff View
- [ ] Load a diff manifest (or run `/diff`) and open the viewer.
- [ ] Toggle Only Differences / Show All and verify counts.

## Packaging
- [ ] `npm run pack` finishes after staging CAD resources and cleaning stale pack output.
- [ ] Packaged smoke passes: `python3 tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default`.
- [ ] macOS pack output exists (`VemCAD-<version>-arm64.dmg`).
- [ ] Windows build artifacts exist (Setup EXE, `win-unpacked`).
