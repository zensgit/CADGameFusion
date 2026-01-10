# Step 110: Line-only Metadata Export - Report

## Goal
Ensure line-only glTF exports also emit `mesh_metadata.json` so the preview pipeline can apply layer/entity metadata when no triangulatable mesh exists.

## Scope
- `tools/convert_cli.cpp`: collect per-entity slices for line-only geometry and write `mesh_metadata.json`.
- `tools/plm_preview.py`: validate manifest includes `mesh_metadata` for line-only input with `--emit json,gltf,meta`.

## Summary
- Line-only geometry now produces `mesh_metadata.json` alongside `mesh.gltf` and `mesh.bin`.
- Manifest reports `outputs: ["gltf", "json", "meta"]` with `mesh_metadata` artifact.

## Input
- `tests/plugin_data/importer_sample_p1.json` (ellipse + spline + text, no polylines).
