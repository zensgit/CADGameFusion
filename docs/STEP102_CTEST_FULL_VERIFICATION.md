# Full CTest Verification (build_vcpkg)

## Scope
- Run the full CTest suite after DXF BYBLOCK and group-id updates.

## Steps
1. Run the full test suite:
   ```
   ctest --test-dir build_vcpkg -V
   ```

## Results
- 20/20 tests passed.
- Includes updated `test_dxf_importer_blocks_run` with BYBLOCK + group-id checks.

## Status
- PASS (manual).
- Notes: Executed in `build_vcpkg` after layer 0 inheritance coverage updates.
