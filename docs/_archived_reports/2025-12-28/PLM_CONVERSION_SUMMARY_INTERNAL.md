# PLM Conversion Summary (Internal)

## Scope
Step 54 established the PLM conversion CLI, manifest contract, schema validation, and CTest coverage
for full and partial emit modes.

## Deliverables
- CLI: `tools/plm_convert.py`
- Schema: `schemas/plm_manifest.schema.json`
- Validator: `tools/validate_plm_manifest.py`
- CMake drivers: `cmake/RunPlmConvert.cmake`, `cmake/RunPlmEmit.cmake`, `cmake/RunPlmEmitInvalid.cmake`
- Tests: `plm_convert_smoke`, `plm_emit_json_smoke`, `plm_emit_gltf_smoke`, `plm_emit_meta_smoke`, `plm_emit_invalid_smoke`

## Key Behaviors
- `--emit` overrides `--json/--gltf` and supports `json`, `gltf`, `meta`.
- `meta` implies `gltf` (metadata requires mesh output), `gltf` alone does not emit metadata.
- `--hash-names` generates hash-named artifacts and records `content_hashes`.
- `--keep-legacy-names` keeps legacy file names alongside hashed outputs.
- `--strict` fails if any requested artifact is missing.
- `--clean` deletes the output directory before conversion.

## Manifest Contract Highlights
- Input metadata: `input_size`, `input_mtime`, `source_hash`.
- Layout: `output_layout` (`legacy|hashed|both`).
- Outputs list: `outputs` (`json|gltf|meta`).
- Artifact integrity: `content_hashes`, `artifact_sizes`.
- Tooling: `tool_versions` for `plm_convert`, `cadgf`, `convert_cli`.
- Structured warnings: `{code, message}`; see code list below.

Known warning codes:
- `legacy_document_copy_failed`
- `legacy_mesh_bin_copy_failed`
- `legacy_mesh_gltf_copy_failed`
- `legacy_mesh_gltf_uri_update_failed`
- `legacy_mesh_metadata_copy_failed`
- `legacy_mesh_metadata_update_failed`
- `mesh_metadata_cleanup_failed`

## Test Coverage
- `plm_convert_smoke`: full pipeline (`--emit json,gltf,meta --hash-names --keep-legacy-names --strict --clean`).
- `plm_emit_json_smoke`: `--emit json`.
- `plm_emit_gltf_smoke`: `--emit gltf` (metadata absent).
- `plm_emit_meta_smoke`: `--emit meta` (gltf + metadata).
- `plm_emit_invalid_smoke`: invalid emit rejected.

## CI Integration
- `core-strict-build-tests.yml`: runs `plm_convert_smoke` + `plm_emit_`.
- `quick-check.yml`: builds `convert_cli` + `cadgf_dxf_importer_plugin`, runs `plm_emit_`.

## Verification Commands
```
cmake -S . -B build_vcpkg
ctest --test-dir build_vcpkg -R plm_convert_smoke -V
ctest --test-dir build_vcpkg -R plm_emit_ -V
python3 tools/validate_plm_manifest.py --check-hashes --check-names build_vcpkg/plm_convert_smoke/manifest.json
```

## Notes
- Emit-specific tests use `cmake/RunPlmEmit.cmake` with hash/name checks enabled.
- Invalid emit test uses `cmake/RunPlmEmitInvalid.cmake`.
