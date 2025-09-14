# Editor Usage

Qt editor keyboard shortcuts and operations.

## Basic Controls
- **Alt+Click**: Select polyline at point
- **Ctrl+Click**: Multi-select (add to selection)
- **Ctrl+A**: Select all entities
- **Delete/Backspace**: Delete selected entities
- **Esc**: Clear selection

## Tools
- **Add Polyline**: Creates a sample rectangle
- **Triangulate**: Triangulates selected polylines
- **Boolean**: Demo boolean operation (union)
- **Offset**: Demo offset operation

## Export Options

### Export Dialog (Ctrl+E)
The export dialog provides comprehensive control over export settings:

#### Format Options
- **JSON**: CAD data with optional metadata
  - Ring roles: Export ring classification (outer/hole)
- **glTF**: 3D format for visualization
  - Include holes: Enable hole triangulation
- **Unity**: Unity-compatible format

#### Export Range
- **All Groups**: Export entire document
- **Selected Group Only**: Export only the currently selected group

#### Offset Metadata
These settings are saved as metadata for future offset operations:
- **Join Type**: Miter, Round, or Bevel
- **Miter Limit**: Maximum miter extension (1.0-10.0)

#### Actions
- **Open Export Directory**: Quick access to last export location
- **Copy Report**: Copy configuration report to clipboard

### Export Validation Checklist
1. ✅ Verify export format matches intended use case
2. ✅ Check export range (all vs selected)
3. ✅ For glTF/Unity: Enable holes if needed
4. ✅ For JSON: Consider ring roles for topology preservation
5. ✅ Review offset metadata for future operations
6. ✅ Test exported files in target application

### Detailed Export Behavior

#### JSON Export
- **Files**: `group_#.json`
- **Fields**: 
  - `group_id`: Group identifier (primary)
  - `groupId`: Duplicate for compatibility
  - `flat_pts`: Point data (supports both formats)
    - Object format: `[{"x": 0.0, "y": 0.0}, ...]`
    - Array format: `[0.0, 0.0, 1.0, 0.0, ...]`
  - `ring_counts`: Number of points per ring
  - `ring_roles`: Optional ring classification (0=outer, 1=hole)
  - `meta`: Export metadata
    - `joinType`: 0=Miter, 1=Round, 2=Bevel
    - `miterLimit`: Miter extension limit (1.0-10.0)
    - `unitScale`: Scale factor from document settings
    - `useDocUnit`: Whether document units are used

#### glTF Export
- **Files**: `mesh_group_#.gltf` + `mesh_group_#.bin`
- **Attributes**: 
  - POSITION: float32 vec3 (Z=0)
  - Indices: uint32
  - Mode: TRIANGLES (4)
- **Validation**: Includes `validation_report.txt` summarizing all checks

#### Unit Scale Support
The export system respects document unit settings:
- When "Use Document Unit" is enabled:
  - Uses scale from document settings
  - Applies to both JSON and glTF coordinates
- When disabled:
  - Uses custom unit scale value
- Metadata preserves both `unitScale` and `useDocUnit` for traceability

### Validation (Local & CI)

#### Local Validation
Run validation on single or multiple scenes:
```bash
# Single scene
python3 tools/validate_export.py sample_exports/scene_sample

# Multiple scenes (bash)
for scene in sample_exports/scene_*; do
  python3 tools/validate_export.py "$scene"
done
```

#### CI Validation (Enhanced)
The CI system now performs comprehensive multi-scene validation:

1. **Search Priority**:
   - Primary: All `sample_exports/scene_*` directories
   - Fallback: Root `./scene_*` directories (only if no sample_exports)

2. **Validation Process**:
   - Iterates through ALL found scene directories
   - Validates each scene independently
   - Collects and reports aggregate results
   - Fails CI if ANY scene validation fails

3. **Output Format**:
   ```
   [INFO] Found scenes in sample_exports:
     - scene_sample
     - scene_units
     - scene_holes
     - scene_multi_groups
   
   [VALIDATE] Scene: scene_sample
   [RESULT] scene_sample: PASSED
   
   [STATS] Total: 4 | Passed: 4 | Failed: 0
   [RESULT] ALL VALIDATIONS PASSED
   ```

#### Validation Checks
- **JSON Validation**:
  - Required fields presence (`group_id`/`groupId`, `flat_pts`, `ring_counts`)
  - Point count consistency across formats
  - Ring roles validity (0 or 1 only)
  - Meta field completeness
  
- **glTF Validation**:
  - Version 2.0 compliance
  - Buffer/binary file consistency
  - Accessor validity (POSITION, indices)
  - Primitive mode verification
  - Index range sanity checks

## CI/CD Features

### Optional vcpkg Support
The project now supports optional vcpkg integration in CI:
- Automatically detects and uses vcpkg when available
- Falls back to stub implementations when vcpkg is not present
- Caching improves CI performance on subsequent runs

### Enhanced Testing
When CLIPPER2 is available, tests include:
- **Boolean Operations**: Disjoint, shared edge, and contained geometry tests
- **Offset Operations**: Various join types with area and point count assertions
- **Strict Assertions**: Mathematical verification using Shoelace formula

### Build Status
The CI system tests on:
- Ubuntu (latest)
- macOS (latest)
- Windows (latest)

All platforms must pass for successful merge.
