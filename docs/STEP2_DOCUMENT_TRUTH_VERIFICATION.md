# Step 2: Document-as-Truth Audit — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_export_helpers`
   - Builds the new helper module along with the Qt test (pulls in exporter + helper sources).
2. `./build_vcpkg/tests/qt/test_qt_export_helpers`
   - Passes; confirms `collectExportItems` and `selectionGroupId` read Document metadata (layer names/colors, group IDs) correctly.

## Notes
- No GUI actions were required; tests run headless via QtCore.
- CI workflow `Qt Tests (Trial)` now builds/runs the new target automatically.
