# Step 7: Box Select (Window/Crossing) — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`

## Result
- PASS (window vs crossing selection and visibility filtering)
