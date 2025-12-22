# Step 16: Snap Hysteresis for Move — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`
3. `ctest --test-dir build_vcpkg -V`

## Result
- PASS (Qt suite including canvas selection test)

## Notes
- No automated drag test yet; behavior confirmed via shared snap code paths.
