# Step 37: Reload Preserve Selection — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_document_commands`
2. `ctest --test-dir build_vcpkg -R qt_document_commands_run -V`

## Result
- PASS
