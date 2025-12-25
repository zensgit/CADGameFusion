# PLM Conversion Local Verification Report (2025-12-25)

## Scope
- Build directory: `build_vcpkg`
- Focus: PLM conversion CLI emit modes + manifest validation

## Commands
- `cmake --build build_vcpkg -j`
- `ctest --test-dir build_vcpkg -R plm_convert_smoke -V`
- `ctest --test-dir build_vcpkg -R plm_emit_ -V`

## Results
- `plm_convert_smoke`: pass
- `plm_emit_json_smoke`: pass
- `plm_emit_gltf_smoke`: pass
- `plm_emit_meta_smoke`: pass
- `plm_emit_invalid_smoke`: pass

## Notes
- Manifest validation and schema checks ran within the CTest scripts.
- No warnings or failures were reported during the run.

## Re-runs
- 2025-12-25: `ctest --test-dir build_vcpkg -R plm_ -V` (all 5 tests passed)
