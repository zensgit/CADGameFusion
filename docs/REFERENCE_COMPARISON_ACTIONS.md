# Reference Comparison Actions

This document turns the reference comparison into an executable, staged plan.
It aligns with the stable boundary strategy (core_c as ABI) and prioritizes
technical debt that unlocks PLM + web + editor paths.

## Goals (from comparison)
- Stabilize document metadata and change signaling (FreeCAD pattern).
- Match 2D CAD expectations for layers/entities (LibreCAD pattern).
- Ensure glTF metadata survives in three.js via `extras`/`userData`.
- Prepare assembly/instance metadata and PLM property sets (cadquery/xeokit).
- Keep core headless and avoid UI coupling (LibreCAD warning).

## Phase P0 (1-2 weeks): Metadata + Layer Semantics + glTF extras

### Deliverables
1) Document metadata API
- Add doc-level metadata fields (label, author, unit, meta map).
- Add change notification hooks.
- Expose minimal C API accessors/mutators.

2) Layer state parity
- Layer flags: lock/print/freeze/construction.
- Serialize to/from JSON and project files.

3) glTF metadata mapping
- Write CAD metadata into glTF `extras` (e.g. `extras.cadgf`).
- Keep sidecar metadata for PLM if needed.

### Code targets
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `core/include/core/core_c_api.h`
- `core/src/core_c_api.cpp`
- `tools/convert_cli.cpp`
- `tools/plm_convert.py`

### Tests
- `tests/core/test_document_layers.cpp` (extend for new layer flags)
- New: `tests/core/test_document_metadata.cpp`
- Extend glTF metadata verification tests (or add new test in `tests/core`).

### Acceptance
- C API can read/write document metadata and layer flags.
- JSON round-trip preserves new fields.
- three.js loads glTF with metadata in `userData`.

### Risks
- Backward compatibility with existing `document.json` schema.
- Editor code must ignore unknown fields without failure.

---

## Phase P1 (2-6 weeks): Entity Coverage + DXF Importer Expansion

### Deliverables
1) Entity type expansion
- Add line/arc/circle/ellipse/spline/text/dim types.
- Keep polyline conversion path for 2D ops as needed.

2) DXF importer upgrade
- Map LINE/ARC/CIRCLE/SPLINE/TEXT/DIMENSION.
- Map layer, color, linetype, lineweight.
- Optional: external GPL plugin using `libdxfrw` (keep core clean).

3) Editor surface updates
- Display and selection for new entity types.
- Ensure Document remains source of truth.

### Code targets
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/project/project.cpp`

### Tests
- Add DXF sample files for each entity under `tests/plugin_data/`.
- Extend `tests/core/test_document_entities.cpp`.
- Add CTest for new DXF importer coverage.

### Acceptance
- DXF import for key entities succeeds with layer/line style mapping.
- JSON and glTF export preserve entity metadata.

### Risks
- Entity expansion may require edits to selection/UI tools.
- DXF text/dim handling needs careful unit scaling.

---

## Phase P2 (6-10 weeks): Constraints + Assembly/Instance Graph

### Deliverables
1) Constraint subsystem (basic)
- Coincident, Horizontal, Vertical, Parallel, Perpendicular, Distance.
- DOF/rank checks (solvespace pattern).

2) Assembly/instance data model
- Tree model (nodeId/parentId/transform/metadata).
- Aligns with glTF node graph.

### Code targets
- `core/include/core/solver.hpp`
- `core/src/solver.cpp`
- `core/include/core/document.hpp`
- `core/src/document.cpp`

### Tests
- New: `tests/core/test_constraints_basic.cpp`
- New: `tests/core/test_assembly_roundtrip.cpp`

### Acceptance
- Constraints are stable and detect redundancy.
- Assembly JSON round-trip matches input.

### Risks
- Solver complexity can grow; keep scope minimal.
- Assembly graph requires careful ID stability.

---

## Phase P3 (10-16 weeks): 2.5D + PLM Property Sets + Service Path

### Deliverables
1) 2.5D extrusion and mesh boolean (optional)
- Use manifold (Apache 2.0) as optional dependency.
- Export EXT_mesh_manifold or sidecar with merge/run data.

2) PLM property sets
- Add property set model (xeokit pattern).
- `document.properties` and `entity.property_sets`.

3) Service pipeline
- Stable conversion path to glTF + metadata + document JSON.

### Code targets
- `core/src/ops2d.cpp` or new 2.5D module
- `tools/convert_cli.cpp`
- `tools/plm_convert.py`
- `schemas/plm_manifest.schema.json`

### Tests
- New: property set round-trip tests.
- Extend conversion pipeline tests to include property sets.

### Acceptance
- Property sets are accessible from C API and export pipeline.
- Web viewer can query metadata per object.

---

## Cross-Cutting Rules
- Keep `core_c` as the only stable ABI boundary.
- Do not introduce UI pointers into core (avoid LibreCAD pitfall).
- Version `document.json` schema and provide migrations.
- Prefer optional plugins for GPL-only components.

## Suggested Next Actions (Immediate)
1) Confirm P0 scope and fields for document metadata.
2) Approve layer state flags for Document + serialization.
3) Decide glTF metadata policy (extras only vs extras + sidecar).

## Tracking
- Owner: (assign)
- Start date: (assign)
- Target completion: (assign)
