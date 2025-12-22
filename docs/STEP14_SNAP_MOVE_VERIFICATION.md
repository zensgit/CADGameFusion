# Step 14: Snap-Aware Move — Verification

## Commands Executed
1. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`
2. `ctest --test-dir build_vcpkg -V`

## Result
- PASS (Qt suite including canvas selection test)

## Notes
- No dedicated automated drag test yet; behavior verified by unit coverage and shared snap path.
