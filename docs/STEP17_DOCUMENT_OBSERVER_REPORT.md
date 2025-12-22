# Step 17: Document Change Notifications + Canvas Auto-Sync — Report

## Summary
- Added a core Document observer API and change batching.
- Canvas now listens to Document events and syncs geometry incrementally.
- Removed manual Canvas reloads in editor commands and project load.
- Editor build now links export helpers directly.

## Scope
1. **Core notifications** (`core/include/core/document.hpp`, `core/src/document.cpp`)
   - Introduced `DocumentObserver`, change events, and `DocumentChangeGuard` batching.
2. **Canvas auto-sync** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Subscribes to Document changes and updates cached polylines on add/remove/geometry.
   - Selection is updated when entities are removed.
3. **Editor workflow updates** (`editor/qt/src/mainwindow.cpp`, `editor/qt/src/project/project.cpp`)
   - Removed manual `reloadFromDocument()` calls and batched project load changes.
4. **Build fix** (`editor/qt/CMakeLists.txt`)
   - Added export helper sources to the editor target to resolve link errors.
5. **Test alignment** (`tests/qt/test_qt_document_commands.cpp`)
   - Commands no longer manually reload the canvas; tests rely on auto-sync.

## Files Updated
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/mainwindow.cpp`
- `editor/qt/src/project/project.cpp`
- `editor/qt/CMakeLists.txt`
- `tests/qt/test_qt_document_commands.cpp`
- `docs/STEP17_DOCUMENT_OBSERVER_DESIGN.md`
- `docs/STEP17_DOCUMENT_OBSERVER_VERIFICATION.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j`
2. `ctest --test-dir build_vcpkg -V`

Result: PASS (21/21 tests).
