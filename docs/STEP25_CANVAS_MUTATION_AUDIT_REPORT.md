# Step 25: Canvas Mutation Audit — Report

## Summary
- Removed redundant Canvas dependencies from Document-backed command paths.
- Relied on Document observer updates instead of explicit `canvas->update()` calls.

## Scope
1. **Command decoupling** (`editor/qt/src/mainwindow.cpp`)
   - `MoveEntitiesCommand`, `RemoveEntitiesCommand`, `SetVisibleCommand`, and batch visibility command now operate on Document only.
   - Removed unused Canvas captures in related lambdas.

## Files Updated
- `editor/qt/src/mainwindow.cpp`
- `docs/STEP25_CANVAS_MUTATION_AUDIT_DESIGN.md`
- `docs/STEP25_CANVAS_MUTATION_AUDIT_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j`
2. `ctest --test-dir build_vcpkg -V`

Result: PASS.
