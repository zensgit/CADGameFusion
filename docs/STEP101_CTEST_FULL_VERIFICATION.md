# Full CTest Verification (build_vcpkg)

## Scope
- Run the full CTest suite after DXF BLOCKS/INSERT support.

## Steps
1. Run the full test suite:
   ```
   ctest --test-dir build_vcpkg -V
   ```

## Results
- 20/20 tests passed.
- Includes `test_dxf_importer_blocks_run` for INSERT flattening.

## Status
- PASS (manual).
- Notes: Executed in `build_vcpkg` after BLOCKS/INSERT changes.
