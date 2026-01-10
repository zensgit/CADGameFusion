# Step 108: Line-only glTF Fallback - Report

## Goal
Ensure the preview pipeline emits a glTF when the document has no triangulatable polygons (line-only geometry).

## Scope
- `tools/convert_cli.cpp`: add line-only glTF output path for lines/arcs/circles/ellipses/splines.
- `tools/plm_preview.py`: validate preview output with line-only input.

## Summary
- Line-only entities are converted into a glTF with `LINES` primitives.
- The manifest still reports `outputs: ["gltf", "json"]` with `mesh_bin` + `mesh_gltf` artifacts.
- `mesh_metadata.json` is not emitted for line-only preview runs.

## Inputs
- `tests/plugin_data/importer_sample_p1.json` (ellipse + spline + text, no polylines)
