# Step 29: Project Legacy Load Test — Design

## Goals
- Validate legacy project (v0.2) load path for polyline metadata.
- Ensure legacy color/visibility/group parsing remains stable.

## Changes
1. **Legacy load test** (`tests/qt/test_qt_project_legacy_load.cpp`)
   - Creates a v0.2 project JSON with polylines + metadata.
   - Verifies entity visibility, groupId, color, and default layer mapping.
2. **CTest registration** (`tests/qt/CMakeLists.txt`)
   - Adds `qt_project_legacy_load_run`.

## Rationale
Backward compatibility is part of user trust. A dedicated test prevents
regressions in legacy format parsing.
