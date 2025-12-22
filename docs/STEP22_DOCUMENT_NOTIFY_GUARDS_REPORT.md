# Step 22: Document Notify Guards — Report

## Summary
- Added no-op guards in Document setters to skip redundant notifications.
- Polyline updates only notify when geometry changes.

## Scope
1. **Document setter guards** (`core/src/document.cpp`)
   - Early returns when layer/entity values are unchanged.
   - Polyline point equality check before emitting `EntityGeometryChanged`.

## Files Updated
- `core/src/document.cpp`
- `docs/STEP22_DOCUMENT_NOTIFY_GUARDS_DESIGN.md`
- `docs/STEP22_DOCUMENT_NOTIFY_GUARDS_VERIFICATION.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target core_tests_document_entities test_qt_document_commands`
2. `ctest --test-dir build_vcpkg -R core_tests_document_entities -V`
3. `ctest --test-dir build_vcpkg -R qt_document_commands_run -V`
4. `ctest --test-dir build_vcpkg -V`

Result: PASS.
