# Step 105: Mesh Metadata Layer Info — Report

## Summary
- convert_cli now emits layer name/color and DXF color metadata into mesh_metadata.json slices.
- Web viewer renders a Layers list and uses mesh_metadata when document.json is absent.
- Added a new convert_cli smoke test to validate mesh_metadata fields.

## Changes
- Mesh metadata export: `tools/convert_cli.cpp`.
- Web viewer layers list + selection layer name: `tools/web_viewer/index.html`, `tools/web_viewer/style.css`, `tools/web_viewer/app.js`.
- New test: `cmake/RunConvertCliMeshMetadata.cmake`, `CMakeLists.txt`.
- Docs: `tools/web_viewer/README.md`.
