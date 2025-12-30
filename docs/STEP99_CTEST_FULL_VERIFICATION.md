# Full CTest Verification (build_vcpkg)

## Scope
- Run the full CTest suite after DXF BYLAYER fallback changes.

## Steps
1. Run the full test suite:
   ```
   ctest --test-dir build_vcpkg -V
   ```

## Results
- 19/19 tests passed.
- Notable coverage:
  - DXF importer entity test includes layer metadata and BYLAYER style fallback.

## Status
- PASS (manual).
- Notes: Executed in `build_vcpkg` after plugin + test rebuild.
