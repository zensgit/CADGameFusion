# M2 (UX & Engine Interop) — Verification Plan

## Build Verification (Every Phase)

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j$(sysctl -n hw.ncpu)
cd build && ctest -R qt_ --output-on-failure
```

**Acceptance**: All Qt tests pass (zero failures).

---

## Phase 1 Verification: Live Preview + Layer Lock

### Automated Tests

| Test File | Assertions |
|-----------|------------|
| `test_qt_live_export.cpp` | LiveExportManager writes scene files on document change; debounce batches rapid changes; toggle enable/disable; exported signal fires |
| `test_qt_layer_lock.cpp` | Locked layer entities cannot be moved/rotated/scaled; lock state roundtrips through project save/load; selection still works on locked entities |

### Manual Verification

- [ ] File → "Set Live Preview Directory..." → select empty dir
- [ ] File → "Live Preview" toggle ON → status bar shows "Live: ON"
- [ ] Add/modify entity → verify JSON+glTF files appear in export dir within ~500ms
- [ ] Open Unity project with WatchAndReload.cs → verify mesh updates in <2s
- [ ] Layer Panel → toggle Lock checkbox → try to drag locked entity → blocked
- [ ] Locked entity still selectable (yellow highlight) but cannot transform

---

## Phase 2 Verification: Measurement + Guides

### Automated Tests

| Test File | Assertions |
|-----------|------------|
| `test_qt_measure_tool.cpp` | Distance calculation between two known points matches expected value; angle computation correct |
| `test_qt_guides.cpp` | GuideManager add/remove; findNearestGuide returns correct snap position; SnapManager with Guide type produces SnapResult |

### Manual Verification

- [ ] Press M → cursor changes → click point A → move → see distance preview → click point B → dimension label displayed
- [ ] Measure between (0,0) and (3,4) → verify distance shows 5.00
- [ ] Double-click top ruler → horizontal guide appears → entities snap to guide
- [ ] Double-click left ruler → vertical guide appears
- [ ] Rulers show tick marks matching grid spacing
- [ ] Escape exits measure tool back to default mode

---

## Phase 3 Verification: Align/Distribute + Pivot

### Automated Tests

| Test File | Assertions |
|-----------|------------|
| `test_qt_align_panel.cpp` | 3 entities align-left → all left edges match; distribute-horizontal → equal spacing between entities |
| `test_qt_pivot.cpp` | Rotate around Origin vs Centroid produces different results; Custom pivot at (0,0) matches Origin mode |

### Manual Verification

- [ ] Select 3 entities → Align Panel → click "Align Left" → verify left edges aligned
- [ ] Select 3 entities → "Distribute Horizontal" → verify equal spacing
- [ ] All align/distribute operations undoable with Ctrl+Z
- [ ] TransformPanel → change Pivot to "Origin" → press R → rotation around (0,0)
- [ ] Change Pivot to "Custom" → enter (5,5) → R → rotation around (5,5)
- [ ] Canvas shows pivot marker (cross+circle) at selected pivot position

---

## Phase 4 Verification: Gizmo Handles + Polish

### Automated Tests

| Test File | Assertions |
|-----------|------------|
| `test_qt_gizmo.cpp` | Handle hit-test at known screen positions returns correct HandleType; drag produces correct move/rotate/scale signals; gizmo appears/disappears with selection |
| `test_qt_guide_persistence.cpp` | Guides roundtrip through project save/load; guide count and positions preserved |

### Manual Verification

- [ ] Select entity → see move arrows (red X, green Y) + rotate arc + scale corner squares
- [ ] Drag X arrow → entity moves only in X axis
- [ ] Drag Y arrow → entity moves only in Y axis
- [ ] Drag rotate arc → entity rotates around pivot
- [ ] Drag corner square → entity scales from pivot
- [ ] Deselect → gizmo disappears
- [ ] Status bar shows "Tool: Gizmo" when active
- [ ] Save project with guides → close → reopen → guides still present
- [ ] Shortcut V=select, M=measure verified

---

## Regression Checks (Every Phase)

| Area | Check |
|------|-------|
| Selection | Point pick, marquee, crossing, group select (Alt+Click) |
| Snap | Grid, endpoint, midpoint, center, intersection |
| Move/Rotate/Scale | Keyboard shortcuts, TransformPanel numeric input |
| Undo/Redo | All operations, multi-step undo chain |
| Save/Load | .cgf roundtrip preserves entities, layers, metadata |
| Export | JSON flat_pts/ring_counts, glTF mesh structure |
| Status bar | Coordinates, selection count, snap type |

---

## Test Count Target

| Phase | New Tests | Cumulative Total |
|-------|-----------|-----------------|
| Pre-M2 | — | 14 |
| Phase 1 | +2 | 16 |
| Phase 2 | +2 | 18 |
| Phase 3 | +2 | 20 |
| Phase 4 | +2 | 22 |

**M2 Exit Criteria**: 22/22 Qt tests passing, all manual checks verified.

---

## M2 Acceptance Criteria (from Roadmap)

- [ ] Edit in Qt → auto-updates in Unity in <2s for small scenes
- [ ] Core editing flows are smooth and discoverable
- [ ] Measurement tools functional (distance + angle)
- [ ] Align/distribute works for multi-selection
- [ ] Visual gizmo handles on selected entities
- [ ] Per-layer lock prevents accidental edits
