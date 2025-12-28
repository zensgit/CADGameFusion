# Document and C API Implementation Tasks

This is the implementation task list derived from
`docs/DOCUMENT_API_CHANGESET.md`. It is designed as a sequence of small PRs,
each with clear scope, risks, and verification steps.

## Guiding rules

- Append-only changes to C ABI in `core/include/core/core_c_api.h`.
- Keep `cadgf_*` aliases in lockstep with `core_*`.
- Avoid breaking JSON output; only add new fields.

## PR-01: Core geometry structs + entity type expansion (P0)

Scope:
- Add `Point`, `Line`, `Arc`, `Circle` structs.
- Expand `EntityType` enum.
- Replace `std::shared_ptr<void>` with a tagged variant payload.

Files:
- `core/include/core/geometry2d.hpp`
- `core/include/core/document.hpp`

Risks:
- Payload refactor impacts all callers using `payload`.

Verification:
- Build core library.
- Update and run `tests/core/test_document_entities.cpp`.

## PR-02: Document add/get/set for P0 entities

Scope:
- Add `add_point/add_line/add_arc/add_circle`.
- Add `get_*` and `set_*` typed accessors.
- Ensure notifications for geometry changes.

Files:
- `core/include/core/document.hpp`
- `core/src/document.cpp`

Risks:
- Incorrect type checks or notification types.

Verification:
- Extend `tests/core/test_document_entities.cpp`.
- Run `tests/core/test_document_notifications.cpp`.

## PR-03: C API extension for P0 entities

Scope:
- Add new `core_*` structs and functions for Point/Line/Arc/Circle.
- Update `core_document_get_entity_info(_v2)` to return correct types.

Files:
- `core/include/core/core_c_api.h`
- `core/src/core_c_api.cpp`
- `tests/core/test_c_api_document_query.cpp`

Risks:
- ABI mistakes; missing `cadgf_*` aliases.

Verification:
- Run `tests/core/test_c_api_document_query.cpp`.
- Compile `tests/package_consumer/main.c`.

## PR-04: JSON export for new entities

Scope:
- Add JSON export branches for Point/Line/Arc/Circle.
- Keep existing polyline output unchanged.

Files:
- `tools/convert_cli.cpp`

Risks:
- Break consumers relying on JSON layout.

Verification:
- Manual run `tools/convert_cli` on sample input.
- Ensure JSON is still valid and includes new entity blocks.

## PR-05: DXF importer P0 (LINE/ARC/CIRCLE)

Scope:
- Parse DXF LINE, ARC, CIRCLE.
- Map to new Document entities.

Files:
- `plugins/dxf_importer_plugin.cpp`
- `tests/plugin_data/importer_sample.dxf` (optional extension)

Risks:
- DXF parse edge cases, layer mapping regressions.

Verification:
- Add a minimal DXF sample and run plugin import smoke.
- If available, extend `tests/python/test_cadgf_smoke.py`.

## PR-06: Coincident constraint and element refs (P0)

Scope:
- Add `ElementRef` and `PointRole` types.
- Add a `coincident` constraint type in solver.

Files:
- `core/include/core/document.hpp` (element ref)
- `core/include/core/solver.hpp`
- `core/src/solver.cpp`
- `tests/core/test_solver_constraints.cpp`

Risks:
- Undefined binding of sub-entity refs without a stable schema.

Verification:
- Add a minimal coincident test and check residuals.

## PR-07: P1 entities (Ellipse/Spline/Text) and C API

Scope:
- Add `Ellipse`, `Spline`, `Text` structs + Document methods.
- Add C API create/get/set for P1 entities.

Files:
- `core/include/core/geometry2d.hpp`
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `core/include/core/core_c_api.h`
- `core/src/core_c_api.cpp`
- `tests/core/test_document_entities.cpp`
- `tests/core/test_c_api_document_query.cpp`

Risks:
- Spline memory ownership and knot validation.

Verification:
- Add tests with small spline control points.

## PR-08: Line style fields (P1)

Scope:
- Add per-entity line style fields: `line_type`, `line_weight`, `line_type_scale`.
- Add C API setters/getters (two-call for UTF-8).

Files:
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `core/include/core/core_c_api.h`
- `core/src/core_c_api.cpp`

Risks:
- Line style not reflected in JSON or UI yet (acceptable for P1).

Verification:
- Add small core tests for set/get paths.

## PR-09: JSON export update for P1 entities

Scope:
- Add JSON branches for ellipse/spline/text.
- Add line style metadata fields where available.

Files:
- `tools/convert_cli.cpp`

Risks:
- JSON growth; keep fields optional.

Verification:
- Run `convert_cli` and inspect JSON schema manually.

## PR-10: DXF importer P1 (ELLIPSE/SPLINE/TEXT)

Scope:
- Map DXF ELLIPSE, SPLINE, TEXT/MTEXT to new entities.
- Fallback to polyline approximations where needed.

Files:
- `plugins/dxf_importer_plugin.cpp`

Risks:
- Complex DXF variants; use conservative parsing.

Verification:
- Add targeted DXF samples and run import.

## Validation Matrix (per phase)

P0:
- Core tests: `tests/core/test_document_entities.cpp`
- C API tests: `tests/core/test_c_api_document_query.cpp`
- Import smoke: `tests/python/test_cadgf_smoke.py` (if enabled)

P1:
- Extend P0 tests with ellipse/spline/text cases.
- JSON export manual inspection.

## Notes on sequencing

- PR-01 to PR-03 should land together before importer work.
- JSON export can be delayed until after new entities are stable.
- Constraints can be staged independently, but element refs must exist first.
