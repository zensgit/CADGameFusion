# PLM Conversion Summary Report

## Scope
This report summarizes the PLM conversion pipeline updates and validation coverage added in Step 54.
The goal is to provide a stable, scriptable entrypoint that emits normalized artifacts and a rich manifest
suitable for PLM ingestion, audit, and caching.

## Deliverables
- PLM conversion entrypoint: `tools/plm_convert.py`
- Manifest schema: `schemas/plm_manifest.schema.json`
- Manifest validator: `tools/validate_plm_manifest.py`
- CMake test drivers:
  - `cmake/RunPlmConvert.cmake`
  - `cmake/RunPlmEmit.cmake`
  - `cmake/RunPlmEmitInvalid.cmake`
- CTest coverage:
  - `plm_convert_smoke`
  - `plm_emit_json_smoke`
  - `plm_emit_gltf_smoke`
  - `plm_emit_meta_smoke`
  - `plm_emit_invalid_smoke`

## PLM Conversion CLI
Command:
```
python3 tools/plm_convert.py --plugin <plugin> --input <file> --out <dir>
  [--emit json,gltf,meta] [--json] [--gltf]
  [--hash-names] [--keep-legacy-names] [--strict] [--clean]
```

Key behavior:
- `--emit` overrides `--json/--gltf` when provided (supports `json`, `gltf`, `meta`).
- `meta` implies `gltf` (metadata requires mesh output). `gltf` does not include metadata unless `meta` is requested.
- `--hash-names` writes hash-named artifacts and records `content_hashes`.
- `--keep-legacy-names` keeps legacy file names alongside hashed artifacts.
- `--strict` exits non-zero if any requested artifact is missing.
- `--clean` removes existing outputs in `--out` before conversion.

## Manifest Contract
Manifest fields (highlights):
- Core metadata: `schema_version`, `input`, `input_size`, `input_mtime`, `source_hash`, `output_dir`, `generated_at`
- Layout: `output_layout` (`legacy|hashed|both`)
- Outputs: `outputs` array (`json|gltf|meta`)
- Artifacts: `artifacts`, `content_hashes`, `artifact_sizes`, optional `legacy_artifacts`
- Versions: `tool_versions` (`plm_convert`, `cadgf`, `convert_cli`)
- Warnings: structured list of `{code, message}`

Known warning codes:
- `legacy_document_copy_failed`
- `legacy_mesh_bin_copy_failed`
- `legacy_mesh_gltf_copy_failed`
- `legacy_mesh_gltf_uri_update_failed`
- `legacy_mesh_metadata_copy_failed`
- `legacy_mesh_metadata_update_failed`
- `mesh_metadata_cleanup_failed`

## CTest Coverage
- `plm_convert_smoke`: Full pipeline with `--emit json,gltf,meta --hash-names --keep-legacy-names --strict --clean`.
- `plm_emit_json_smoke`: `--emit json`.
- `plm_emit_gltf_smoke`: `--emit gltf` (no metadata).
- `plm_emit_meta_smoke`: `--emit meta` (gltf + metadata).
- `plm_emit_invalid_smoke`: invalid emit value rejected.

All tests validate the manifest against `schemas/plm_manifest.schema.json` and, when enabled, enforce:
- artifact hashes
- artifact sizes
- outputs/manifest consistency
- legacy artifacts (when enabled)

## Verification Commands
Local (vcpkg build directory):
```
cmake -S . -B build_vcpkg
ctest --test-dir build_vcpkg -R plm_convert_smoke -V
ctest --test-dir build_vcpkg -R plm_emit_ -V
python3 tools/validate_plm_manifest.py --check-hashes --check-names build_vcpkg/plm_convert_smoke/manifest.json
```

CI:
- `core-strict-build-tests.yml` runs `plm_convert_smoke` and `plm_emit_`.
- `quick-check.yml` runs `plm_emit_` after building `convert_cli` and `cadgf_dxf_importer_plugin`.

## Current Status
- Manifest schema and validator fully cover hashes, sizes, outputs, and warnings.
- Emit modes verified via dedicated CTests (json/gltf/meta/invalid).
- Quick-check and core-strict workflows cover emit and conversion tests.

## Next Steps (Optional)
- Add structured warning documentation to a dedicated PLM integration guide.
- Introduce storage optimization strategies (hardlink/symlink) for legacy artifacts.
- Add a compact manifest variant for front-end preview pipelines.
