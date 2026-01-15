# VemCAD Release Notes v0.1.0

## Highlights
- Desktop wrapper around the Web Viewer.
- Open CAD File flow uploads DWG/DXF to the router and loads the preview.
- Settings panel with saved router/DWG configuration + Test Router / Check DWG helpers.
- Router auto-start support for local workflows.
- Diff view and annotations in the viewer (when diff metadata is present).

## Requirements
- Local router running (default: `http://127.0.0.1:9000`).
- DWG requires an external converter (LibreDWG `dwg2dxf` or cadgf-dwg-service).

## Known Limitations
- macOS builds are not code-signed in this environment.
- DWG import quality depends on the external converter.

## Tested
- DWG batch-100 conversion via router (100/100 ok).
