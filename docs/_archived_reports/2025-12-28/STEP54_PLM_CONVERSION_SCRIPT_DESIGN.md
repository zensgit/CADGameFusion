# Step 54: PLM Conversion Script - Design

## Goal
Provide a minimal, scriptable entrypoint for PLM services that wraps `convert_cli`, standardizes output layout, and emits a manifest for downstream systems.

## CLI
```
python3 tools/plm_convert.py --plugin <plugin> --input <file> --out <dir> [--emit json,gltf,meta] [--json] [--gltf] [--hash-names] [--keep-legacy-names] [--strict] [--clean]
```

If neither `--json` nor `--gltf` is provided, both are attempted.
`--emit` overrides `--json/--gltf` when provided (supports `json`, `gltf`, `meta`).
`meta` implies `gltf` (metadata requires mesh output). `gltf` does not include metadata unless `meta` is requested.
`--strict` makes missing artifacts a hard failure (non-zero exit).
`--hash-names` renames artifacts to include their content hash and records `content_hashes`.
`--clean` removes existing outputs in `--out` before conversion.
`--keep-legacy-names` keeps `document.json`, `mesh.gltf`, `mesh.bin`, `mesh_metadata.json` alongside hashed names.

## Output Layout
```
<out>/
  document.json
  mesh.gltf
  mesh.bin
  mesh_metadata.json
  manifest.json
```

With `--hash-names`:
```
<out>/
  document_<sha>.json
  mesh_<sha>.gltf
  mesh_<sha>.bin
  mesh_metadata_<sha>.json
  manifest.json
```

With `--hash-names --keep-legacy-names`:
```
<out>/
  document_<sha>.json
  document.json
  mesh_<sha>.gltf
  mesh.gltf
  mesh_<sha>.bin
  mesh.bin
  mesh_metadata_<sha>.json
  mesh_metadata.json
  manifest.json
```

## Manifest Format
```json
{
  "schema_version": "1",
  "input": "/abs/input.dxf",
  "input_size": 12345,
  "input_mtime": "2025-01-01T00:00:00Z",
  "source_hash": "sha256...",
  "plugin": "/abs/plugin.dylib",
  "output_dir": "/abs/out",
  "output_layout": "both",
  "generated_at": "2025-01-01T00:00:00Z",
  "cadgf_version": "1.0.0",
  "tool_versions": {
    "plm_convert": "1",
    "cadgf": "1.0.0",
    "convert_cli": "1.0.0"
  },
  "artifacts": {
    "document_json": "document_<sha>.json",
    "mesh_gltf": "mesh_<sha>.gltf",
    "mesh_bin": "mesh_<sha>.bin",
    "mesh_metadata": "mesh_metadata_<sha>.json"
  },
  "content_hashes": {
    "document_json": "<sha>",
    "mesh_gltf": "<sha>",
    "mesh_bin": "<sha>",
    "mesh_metadata": "<sha>"
  },
  "artifact_sizes": {
    "document_json": 123,
    "mesh_gltf": 456,
    "mesh_bin": 789,
    "mesh_metadata": 101
  },
  "outputs": ["json", "gltf", "meta"],
  "warnings": [
    {"code": "legacy_mesh_gltf_copy_failed", "message": "legacy mesh.gltf copy failed"}
  ],
  "legacy_artifacts": {
    "document_json": "document.json",
    "mesh_gltf": "mesh.gltf",
    "mesh_bin": "mesh.bin",
    "mesh_metadata": "mesh_metadata.json"
  },
  "status": "ok"
}
```

## Output Layout
- `legacy`: only legacy names (no hashing)
- `hashed`: only hash-named artifacts
- `both`: hash-named + legacy copies

## Warnings
Warnings are structured objects with `code` + `message`, intended for machine parsing and audit logs.
Known codes:
- `legacy_document_copy_failed`
- `legacy_mesh_bin_copy_failed`
- `legacy_mesh_gltf_copy_failed`
- `legacy_mesh_gltf_uri_update_failed`
- `legacy_mesh_metadata_copy_failed`
- `legacy_mesh_metadata_update_failed`
- `mesh_metadata_cleanup_failed`

## Schema & Validation
- Schema: `schemas/plm_manifest.schema.json`
- Validator: `tools/validate_plm_manifest.py`

## CTest
`plm_convert_smoke` runs the script through CMake (requires TinyGLTF + Python3) with `--hash-names --keep-legacy-names --strict --clean` and validates the manifest/artifacts.

## Files Added
- `tools/plm_convert.py`
- `cmake/RunPlmConvert.cmake`
- `cmake/RunPlmEmit.cmake`
- `cmake/RunPlmEmitInvalid.cmake`
- `schemas/plm_manifest.schema.json`
- `tools/validate_plm_manifest.py`
- `docs/STEP54_PLM_CONVERSION_SCRIPT_DESIGN.md`
