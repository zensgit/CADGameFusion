# Step 54: PLM Conversion Script - Verification

## Command
```bash
python3 tools/plm_convert.py \
  --plugin build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample.json \
  --out build_vcpkg/plm_convert_smoke \
  --emit json,gltf,meta --hash-names --keep-legacy-names --strict --clean
```

## Results
- Artifacts created under `build_vcpkg/plm_convert_smoke/`:
  - `document_<sha>.json`, `document.json`
  - `mesh_<sha>.gltf`, `mesh.gltf`
  - `mesh_<sha>.bin`, `mesh.bin`
  - `mesh_metadata_<sha>.json`, `mesh_metadata.json`
  - `manifest.json`
- `manifest.json` reports status `ok`, `schema_version` `1`, includes `input_size`, `input_mtime`, `source_hash`, `output_layout`, `tool_versions`, plus `content_hashes`, `artifact_sizes`, `outputs`, and structured `warnings`.

## CTest
```bash
ctest --test-dir build_vcpkg -R plm_convert_smoke -V
```

```bash
ctest --test-dir build_vcpkg -R plm_emit_ -V
```

## CTest Results
- `plm_convert_smoke` (runs with `--hash-names --keep-legacy-names --strict --clean`) passed; manifest validated at `build_vcpkg/plm_convert_smoke/manifest.json`.
- `plm_emit_json_smoke`, `plm_emit_gltf_smoke`, `plm_emit_meta_smoke` passed.
- `plm_emit_invalid_smoke` passed (invalid `--emit` rejected).

## Schema Validation
```bash
python3 tools/validate_plm_manifest.py \
  --check-hashes --check-names \
  build_vcpkg/plm_convert_smoke/manifest.json
```

## Schema Validation Results
- Manifest validates against `schemas/plm_manifest.schema.json` with hash/name checks and legacy artifacts present.
