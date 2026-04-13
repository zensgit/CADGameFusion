# M1 Editor Transform Tools — Verification Report

## Build Environment

| Component | Version |
|-----------|---------|
| Platform | macOS Darwin 25.4.0 (arm64) |
| Compiler | AppleClang 21.0.0 |
| CMake | 4.3.1 |
| Qt | 6.11.0 |
| Eigen | 5.0.1 |

## Build Verification

```
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j$(sysctl -n hw.ncpu)
```

**Result**: editor_qt and all test targets compile with zero errors.

## Automated Test Results

### New Tests: `test_qt_m1_transforms` (7 tests)

| # | Test | Status | Verification |
|---|------|--------|-------------|
| 1 | Rotate 90° x4 = identity | PASS | 4 consecutive 90° rotations return all points to original within 1e-6 |
| 2 | Rotate 45° + undo | PASS | Points move after rotation; undo restores exactly |
| 3 | Scale 2x / 0.5x + undo | PASS | Distance from centroid doubles/halves; undo restores |
| 4 | Scale + Rotate composition | PASS | Undo rotate restores to scaled state; undo scale restores to original |
| 5 | Multi-entity rotate 180+180 | PASS | Two 180° rotations on 2 entities = identity |
| 6 | Group + Ungroup + undo/redo | PASS | groupId correctly set/cleared/restored across undo/redo |
| 7 | Canvas signals connectable | PASS | cursorWorldPositionChanged and snapStateChanged signals exist |

### Existing Tests: All Qt tests (13/13)

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | qt_export_meta_run | PASS | |
| 2 | qt_document_commands_run | PASS | Fixed: selection signal on entity removal |
| 3 | qt_layer_panel_run | PASS | |
| 4 | qt_property_panel_run | PASS | Fixed: checkbox state change assertion |
| 5 | qt_project_roundtrip_run | PASS | |
| 6 | qt_project_legacy_load_run | PASS | |
| 7 | qt_export_helpers_run | PASS | |
| 8 | qt_canvas_box_select_run | PASS | Fixed: move hit-test fallback |
| 9 | qt_canvas_color_metadata_run | PASS | |
| 10 | qt_snap_manager_run | PASS | Fixed: grid-only snap test isolation |
| 11 | qt_snap_settings_run | PASS | |
| 12 | qt_m1_transforms_run | PASS | New: 7 transform tests |
| 13 | qt_selection_model_run | PASS | |

```
100% tests passed, 0 tests failed out of 13
Total Test time (real) = 3.94 sec
```

## Crash Fix Verification

**Before fix**: `editor_qt` crashed immediately on launch (exit code 139 / SIGSEGV) — both on original and modified code.

**After fix**: `editor_qt` launches successfully and runs without crash (exit code 143 when terminated externally, exit code 0 on clean quit).

**Root cause**: `m_undoStack` and `m_cmdMgr` were never initialized (nullptr), causing null pointer dereference on first command push.

## Regression Analysis

- All 13 Qt tests pass (was 9/13 before fixes)
- No new test failures introduced
- 4 pre-existing test failures fixed
- Editor binary launches and runs without crash (was crashing before)
- Existing features (selection, snap, move, delete, undo/redo, save/load) unaffected

## Commits

| Hash | Description |
|------|-------------|
| `e35fb63` | feat(editor): add M1 transform tools, grouping, status bar & numeric input |
| `39fc5a9` | fix(editor): resolve 4 pre-existing Qt test failures (13/13 green) |

## Manual Test Checklist (Optional)

For full verification, launch `editor_qt` and test:

- [ ] Status bar shows cursor coordinates on mouse move
- [ ] Status bar shows selection count when entities selected
- [ ] Status bar shows snap type when hovering near snap points
- [ ] R key rotates selected entities 90° CCW
- [ ] +/- keys scale selected entities
- [ ] Ctrl+G groups 2+ selected entities
- [ ] Alt+Click selects entire group after grouping
- [ ] Ctrl+Shift+G ungroups selected entities
- [ ] Transform panel dX/dY/Angle/Factor inputs work with Apply buttons
- [ ] All operations support Ctrl+Z / Ctrl+Y undo/redo
- [ ] Save/Load .cgf preserves all entity data after transforms
