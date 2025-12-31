# Step 104: DXF Color Metadata in Qt + Web Preview — Report

## Summary
- Qt canvas now resolves entity colors using DXF metadata (BYLAYER/BYBLOCK/INDEX/TRUECOLOR).
- convert_cli emits per-entity `color` in document.json to support truecolor and explicit colors in downstream tools.
- Web viewer loads `document_json` + `mesh_metadata` from manifests, applies per-entity materials, and shows DXF color metadata in the selection panel.
- Added a Qt regression test covering DXF color metadata resolution.

## Changes
- Qt canvas color resolution: `editor/qt/src/canvas.cpp`.
- Document schema + JSON export: `schemas/document.schema.json`, `tools/convert_cli.cpp`.
- Web viewer metadata ingest and colorization: `tools/web_viewer/app.js`, `tools/web_viewer/README.md`.
- Qt test: `tests/qt/test_qt_canvas_color_metadata.cpp`, `tests/qt/CMakeLists.txt`.
