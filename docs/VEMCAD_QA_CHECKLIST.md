# VemCAD QA Checklist

Use this checklist before any internal release.

## Router
- [ ] Start router and confirm `/health` returns `status=ok`.
- [ ] Upload a DXF via `/convert` and open the returned `viewer_url`.

## Desktop App
- [ ] Launch VemCAD and open Settings (Cmd/Ctrl+,).
- [ ] Set Router URL, plugin, convert_cli, and DWG command if needed.
- [ ] Click **Test Router** (must show version/commit).
- [ ] Click **Check DWG** (must return ok).

## File Open
- [ ] Open a DXF (should render geometry + layers).
- [ ] Open a DWG (should convert + render, no UTF-8 errors).
- [ ] Verify entity selection shows metadata (color/layer/name).

## Diff View
- [ ] Load a diff manifest (or run `/diff`) and open the viewer.
- [ ] Toggle Only Differences / Show All and verify counts.

## Packaging
- [ ] macOS pack output exists (`VemCAD-<version>-arm64.dmg`).
- [ ] Windows build artifacts exist (Setup EXE, `win-unpacked`).
