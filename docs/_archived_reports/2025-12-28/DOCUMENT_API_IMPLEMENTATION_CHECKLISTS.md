# Document + C API Implementation Checklists

This file provides per-PR checklists and verification commands for the
implementation tasks described in `docs/DOCUMENT_API_IMPLEMENTATION_TASKS.md`.

Common setup (run once per branch):
- `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release`
- `cmake --build build -j`

## PR-01: Core geometry structs + entity type expansion (P0)

Checklist:
- Add `Point`, `Line`, `Arc`, `Circle` to `core/include/core/geometry2d.hpp`.
- Extend `EntityType` in `core/include/core/document.hpp`.
- Replace `payload` with a tagged variant in `core/include/core/document.hpp`.
- Update code that accessed `payload` directly.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_document_entities -V`

## PR-02: Document add/get/set for P0 entities

Checklist:
- Add add/get/set methods in `core/include/core/document.hpp`.
- Implement in `core/src/document.cpp`.
- Ensure `DocumentChangeType::EntityGeometryChanged` is fired.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_document_entities -V`
- `ctest --test-dir build -R core_tests_document_notifications -V`

## PR-03: C API extension for P0 entities

Checklist:
- Append new POD structs and constants in `core/include/core/core_c_api.h`.
- Add `core_document_add_*`, `core_document_get_*`, `core_document_set_*`.
- Add matching `cadgf_*` aliases.
- Update `core_document_get_entity_info(_v2)` type mapping.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_c_api_document_query -V`
- `cmake --build build -j --target package_consumer`

## PR-04: JSON export for new entities

Checklist:
- Add JSON branches in `tools/convert_cli.cpp` for Point/Line/Arc/Circle.
- Keep polyline JSON unchanged.

Verification:
- `cmake --build build -j --target convert_cli`
- `./build/tools/convert_cli --plugin ./build/plugins/libcadgf_json_importer_plugin.dylib --input tests/plugin_data/importer_sample.json --out /tmp/cadgf_convert --json`
- Inspect `/tmp/cadgf_convert/document.json`.

## PR-05: DXF importer P0 (LINE/ARC/CIRCLE)

Checklist:
- Extend parser in `plugins/dxf_importer_plugin.cpp`.
- Map LINE/ARC/CIRCLE to new Document entities.
- Preserve layer mapping behavior.

Verification:
- `cmake --build build -j --target cadgf_dxf_importer_plugin`
- `cmake --build build -j --target convert_cli`
- `./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_sample.dxf --out /tmp/cadgf_dxf --json`

## PR-06: Coincident constraint and element refs (P0)

Checklist:
- Add `PointRole` and `ElementRef` in `core/include/core/document.hpp`.
- Add `coincident` constraint handling in `core/src/solver.cpp`.
- Add or extend tests in `tests/core/test_solver_constraints.cpp`.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_solver_constraints -V`

## PR-07: P1 entities (Ellipse/Spline/Text) and C API

Checklist:
- Add `Ellipse`, `Spline`, `Text` to `core/include/core/geometry2d.hpp`.
- Add Document add/get/set for P1 entities.
- Add P1 C API functions and structs in `core/include/core/core_c_api.h`.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_document_entities -V`
- `ctest --test-dir build -R core_tests_c_api_document_query -V`

## PR-08: Line style fields (P1)

Checklist:
- Add `line_type`, `line_weight`, `line_type_scale` to `Entity`.
- Add C API setters/getters for line style.
- Add tests to cover new fields.

Verification:
- `cmake --build build -j`
- `ctest --test-dir build -R core_tests_document_entities -V`

## PR-09: JSON export update for P1 entities

Checklist:
- Add JSON branches for Ellipse/Spline/Text in `tools/convert_cli.cpp`.
- Add optional line-style fields where relevant.

Verification:
- `cmake --build build -j --target convert_cli`
- `./build/tools/convert_cli --plugin ./build/plugins/libcadgf_json_importer_plugin.dylib --input tests/plugin_data/importer_sample.json --out /tmp/cadgf_convert --json`
- Inspect `/tmp/cadgf_convert/document.json`.

## PR-10: DXF importer P1 (ELLIPSE/SPLINE/TEXT)

Checklist:
- Parse ELLIPSE/SPLINE/TEXT/MTEXT in `plugins/dxf_importer_plugin.cpp`.
- Fallback to polyline approximation when required.

Verification:
- `cmake --build build -j --target cadgf_dxf_importer_plugin`
- Add DXF samples to `tests/plugin_data` and import via `convert_cli`.

## Optional smoke tests

- Full core test run: `ctest --test-dir build -R core_tests_ -V`
- Tool tests: `ctest --test-dir build -R plugin_host_demo_smoke -V`
