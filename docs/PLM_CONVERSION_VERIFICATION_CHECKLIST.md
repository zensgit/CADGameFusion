# PLM Conversion Verification Checklist

## Local Build
- [ ] `cmake -S . -B build_vcpkg`
- [ ] `cmake --build build_vcpkg --target convert_cli cadgf_dxf_importer_plugin`

## Core Smoke Tests
- [ ] `ctest --test-dir build_vcpkg -R plm_convert_smoke -V`

## Emit Mode Coverage
- [ ] `ctest --test-dir build_vcpkg -R plm_emit_ -V`

## Manifest Validation
- [ ] `python3 tools/validate_plm_manifest.py --check-hashes --check-names --check-document build_vcpkg/plm_convert_smoke/manifest.json`

## Outputs Sanity
- [ ] `build_vcpkg/plm_convert_smoke/manifest.json` contains:
  - `schema_version`, `document_schema_version`, `output_layout`, `outputs`
  - `content_hashes`, `artifact_sizes`, `tool_versions`, `warnings`
- [ ] Legacy artifacts exist when `--keep-legacy-names` is enabled

## CI Gates
- [ ] quick-check: `plm_emit_` passes
- [ ] core-strict: `plm_convert_smoke` + `plm_emit_` pass
