# Step 37: Reload Preserve Selection — Report

## Summary
- Preserved selection across `reloadFromDocument()` when entities still exist.
- Emitted `selectionChanged` only when selection actually changes.

## Scope
1. **Reload behavior** (`editor/qt/src/canvas.cpp`)
   - Preserve selection if IDs remain valid.
2. **Test access** (`editor/qt/src/canvas.hpp`)
   - Added selection accessor for test-only use.
3. **Tests** (`tests/qt/test_qt_document_commands.cpp`)
   - Added assertions that reload preserves selection.
4. **Audit update** (`docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`)
   - P2 reload selection item marked completed.

## Files Updated
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/canvas.hpp`
- `tests/qt/test_qt_document_commands.cpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
- `docs/STEP37_RELOAD_PRESERVE_SELECTION_DESIGN.md`
- `docs/STEP37_RELOAD_PRESERVE_SELECTION_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target test_qt_document_commands`
2. `ctest --test-dir build_vcpkg -R qt_document_commands_run -V`

Result: PASS.
