# Step 35: SelectionModel Ownership — Report

## Summary
- Renamed Canvas selection sync API to make SelectionModel the explicit source of truth.
- Updated tests and the Document/Canvas audit checklist.

## Scope
1. **Canvas selection sync** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - `setSelection(...)` → `setSelectionFromModel(...)`.
2. **Owner wiring** (`editor/qt/src/mainwindow.cpp`)
   - SelectionModel now syncs Canvas via the renamed method.
3. **Tests** (`tests/qt/test_qt_document_commands.cpp`, `tests/qt/test_qt_canvas_box_select.cpp`)
   - Updated to the new API name.
4. **Audit update** (`docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`)
   - P1 selection ownership marked completed.

## Files Updated
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/mainwindow.cpp`
- `tests/qt/test_qt_document_commands.cpp`
- `tests/qt/test_qt_canvas_box_select.cpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
- `docs/STEP35_SELECTIONMODEL_OWNERSHIP_DESIGN.md`
- `docs/STEP35_SELECTIONMODEL_OWNERSHIP_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target test_qt_document_commands test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_document_commands_run -V`
3. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`

Result: PASS.
