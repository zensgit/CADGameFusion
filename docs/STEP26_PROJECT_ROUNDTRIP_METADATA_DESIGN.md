# Step 26: Project Roundtrip Metadata Coverage — Design

## Goals
- Expand project roundtrip coverage for layer and entity metadata.
- Validate persistence of visibility, color, locked, and group IDs across save/load.

## Changes
1. **Roundtrip test expansion** (`tests/qt/test_qt_project_roundtrip.cpp`)
   - Set and verify layer 0 metadata (name/color/visible/locked).
   - Set and verify metadata on a second entity (group/color/visibility).

## Rationale
The project format already persists metadata; expanded assertions guard against
regressions in serialization and migration logic.
