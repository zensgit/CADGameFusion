# Step 13: Polyline Update API — Design

## Goals
- Provide a stable way to update polyline geometry in `core::Document`.
- Expose the same capability in the C API (stable boundary).
- Keep the change append-only and compatible with existing consumers.

## Changes
1. **Document API** (`core/include/core/document.hpp`, `core/src/document.cpp`)
   - Added `Document::set_polyline_points(EntityId, const Polyline&)` to replace polyline geometry in-place.
2. **C API** (`core/include/core/core_c_api.h`, `core/src/core_c_api.cpp`)
   - Added `core_document_set_polyline_points()` and `cadgf_document_set_polyline_points()` wrappers.
3. **Tests** (`tests/core/test_document_entities.cpp`, `tests/core/test_c_api_document_query.cpp`)
   - Added coverage for updating polyline points and reading back the new geometry.

## Rationale
Edit operations (move/transform/constraints) require modifying geometry without
recreating entities. This API keeps the stable boundary in sync with the internal
Document representation and enables editor operations while preserving IDs.
