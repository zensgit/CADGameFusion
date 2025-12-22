# Step 12: Snap Apply to Selection — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`
3. `ctest --test-dir build_vcpkg -V`

## Result
- PASS (snap-applied canvas tests and full Qt suite)
