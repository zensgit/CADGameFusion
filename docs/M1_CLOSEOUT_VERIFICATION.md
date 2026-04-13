# M1 Closeout — Verification Report

## Build

```
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j$(sysctl -n hw.ncpu)
```

**Result**: editor_qt and all 14 Qt test targets compile with zero errors. DXF leader metadata test compiles (was previously broken).

## Automated Test Results

### Qt Tests: 14/14 PASS

```
100% tests passed, 0 tests failed out of 14
Total Test time (real) = 2.10 sec
```

| # | Test | Status |
|---|------|--------|
| 1 | qt_export_meta_run | PASS |
| 2 | qt_document_commands_run | PASS |
| 3 | qt_layer_panel_run | PASS |
| 4 | qt_property_panel_run | PASS |
| 5 | qt_project_roundtrip_run | PASS |
| 6 | qt_project_legacy_load_run | PASS |
| 7 | qt_export_helpers_run | PASS |
| 8 | qt_canvas_box_select_run | PASS |
| 9 | qt_canvas_color_metadata_run | PASS |
| 10 | qt_snap_manager_run | PASS |
| 11 | qt_snap_settings_run | PASS |
| 12 | qt_m1_transforms_run | PASS (7 sub-tests) |
| 13 | **qt_m1_e2e_run** | **PASS** (6 steps, new) |
| 14 | qt_selection_model_run | PASS |

### E2E Test Detail (test_qt_m1_e2e)

```
Step 1 PASS: created 3 entities
Step 2 PASS: square rotated 45 deg, distances preserved
Step 3 PASS: triangle scaled 2x, distances doubled
Step 4 PASS: square+triangle grouped, L-shape independent
Step 5 PASS: JSON export verified (flat_pts, ring_counts)
Step 6 PASS: full undo restores all entities to original
```

### DXF Build Fix

- `test_dxf_leader_metadata` compiles successfully (was build error before)
- Requires DXF plugin + test file at runtime (CI-only)

## M1 Feature Summary

| Feature | Keyboard | Status | Test Coverage |
|---------|----------|--------|---------------|
| Selection (point/marquee/crossing) | Click/Drag | Done | qt_canvas_box_select |
| Snap (grid/endpoint/midpoint/center) | F3/F7/F8 | Done | qt_snap_manager, qt_snap_settings |
| Undo/Redo | Ctrl+Z/Y | Done | qt_document_commands |
| Delete | Del/Shift+Del | Done | qt_document_commands |
| Move (drag) | Drag selected | Done | qt_canvas_box_select |
| **Rotate (instant 90°)** | **Shift+R** | Done | qt_m1_transforms |
| **Rotate (free drag)** | **R → drag → click** | Done | Manual |
| **Scale** | **+/-** | Done | qt_m1_transforms |
| **Group/Ungroup** | **Ctrl+G / Ctrl+Shift+G** | Done | qt_m1_transforms |
| **Status bar** | — | Done | Signal test |
| **Numeric input panel** | TransformPanel | Done | Manual |
| **JSON/glTF/DXF export** | Menu | Done | qt_export_helpers, qt_m1_e2e |
| Save/Load .cgf | Ctrl+S/O | Done | qt_project_roundtrip |

## Commits

| Hash | Description |
|------|-------------|
| `e35fb63` | feat: M1 transform tools, grouping, status bar, numeric input |
| `39fc5a9` | fix: resolve 4 pre-existing Qt test failures (13/13) |
| `ad97bbb` | docs: M1 editor transforms design & verification |
| `f2ac365` | feat: free-rotation drag mode, E2E test, DXF build fix (14/14) |

## M1 Status: FEATURE COMPLETE

All M1 roadmap editor deliverables are implemented, tested, and documented. Ready for M2.
