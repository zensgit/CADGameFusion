# Step 55: DXF Importer Plugin - Design

## Goal
Provide a minimal DXF importer plugin to validate the DXF -> Document -> export pipeline.

## Scope
- Supports ASCII DXF `LWPOLYLINE` entities only.
- Captures layer name (group code 8) and closed flag (group code 70).
- Builds polylines in `cadgf_document` via `cadgf_document_add_polyline_ex`.

## Limitations
- Ignores other DXF entities (LINE, ARC, SPLINE, POLYLINE, etc.).
- Does not preserve DXF colors, line types, or block inserts.
- Intended as a lightweight bridge until a full parser (libdxfrw/ODA) is integrated.

## Files Added/Updated
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`
- `tests/plugin_data/importer_sample.dxf`
- `CMakeLists.txt`
- `tools/CMakeLists.txt`
