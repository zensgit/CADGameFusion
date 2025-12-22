# Step 20: Property Panel Auto-Sync — Report

## Summary
- PropertyPanel now observes Document changes and updates visibility state automatically.
- MainWindow no longer manually recalculates visibility state for the panel.

## Scope
1. **PropertyPanel observer** (`editor/qt/include/panels/property_panel.hpp`, `editor/qt/src/panels/property_panel.cpp`)
   - Updates the visible check state when selected entities change visibility.
2. **MainWindow wiring** (`editor/qt/src/mainwindow.cpp`)
   - Supplies Document to the panel; removes manual visibility state updates.
3. **Test build fix** (`tests/qt/CMakeLists.txt`)
   - Ensures property panel tests can see core headers and link core.

## Files Updated
- `editor/qt/include/panels/property_panel.hpp`
- `editor/qt/src/panels/property_panel.cpp`
- `editor/qt/src/mainwindow.cpp`
- `tests/qt/CMakeLists.txt`
- `docs/STEP20_PROPERTY_PANEL_OBSERVER_DESIGN.md`
- `docs/STEP20_PROPERTY_PANEL_OBSERVER_VERIFICATION.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target test_qt_property_panel`
2. `ctest --test-dir build_vcpkg -R qt_property_panel_run -V`
3. `ctest --test-dir build_vcpkg -V`

Result: PASS.
