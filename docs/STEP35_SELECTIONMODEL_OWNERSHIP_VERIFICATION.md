# Step 35: SelectionModel Ownership — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_document_commands test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_document_commands_run -V`
3. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`

## Result
- PASS
