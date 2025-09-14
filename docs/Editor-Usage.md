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