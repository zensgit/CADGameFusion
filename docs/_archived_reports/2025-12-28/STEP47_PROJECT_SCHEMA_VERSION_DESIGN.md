# Step 47: Project Schema Versioning - Design

## Goal
Introduce an explicit `schemaVersion` for `.cgf` project files so the loader can make deterministic compatibility decisions without relying on lexicographic `meta.version` comparisons.

## Decisions
- Add `meta.schemaVersion` (integer) to the project JSON header.
- Preserve `meta.version` as a human-readable format label.
- Loading logic resolves the schema version as follows:
  - If `schemaVersion` exists: use it.
  - If missing: infer from legacy `meta.version` (>= 0.3 => schema 1; otherwise legacy schema 0).
  - If `schemaVersion` is greater than the current supported version: fail the load.

## Format Update
```json
{
  "meta": {
    "version": "0.4",
    "schemaVersion": 1,
    "appVersion": "1.0.0",
    "createdAt": "2025-09-25T01:00:00Z",
    "modifiedAt": "2025-09-25T01:10:00Z"
  },
  "document": {
    "layers": [],
    "entities": [],
    "settings": { "unitScale": 1.0 }
  }
}
```

## Compatibility Rules
- **Schema 0**: legacy `document.polylines` format (`meta.version` < 0.3).
- **Schema 1**: document-centric format with `layers`, `entities`, `settings`.
- **Forward compatibility**: if a file declares a schema newer than supported, the loader refuses to open it.

## Files Updated
- `editor/qt/include/project/project.hpp`
- `editor/qt/src/project/project.cpp`
- `tests/qt/test_qt_project_roundtrip.cpp`
- `docs/editor/Qt-UI-Shell-Design.md`
