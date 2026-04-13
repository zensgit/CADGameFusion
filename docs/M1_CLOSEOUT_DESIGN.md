# M1 Closeout — Design Document

## Overview

Final M1 (2D MVP) deliverables: free-rotation drag interaction, end-to-end test, and DXF build fix. This completes M1 feature-complete status.

## 1. Free-Rotation Drag Mode

### Interaction Model

```
R key (with selection)
  ├─ Enter rotate mode
  ├─ Compute centroid of selected entities → rotate_center_
  ├─ Snapshot all selected entity points → rotate_entities_
  ├─ Record base angle from cursor to centroid → rotate_base_angle_
  └─ Set cursor to CrossCursor

Mouse move (while rotate_active_)
  ├─ Compute current angle: atan2(mouseY-cy, mouseX-cx)
  ├─ Delta angle = current - base (in radians → degrees)
  ├─ Apply rotation preview via set_polyline_points() for each entity
  └─ Draw guide line + angle label in paintEvent

Left click (while rotate_active_)
  ├─ Emit rotateEntitiesRequested(ids, beforePts, angle, center)
  ├─ MainWindow creates RotateEntitiesCommand → push to QUndoStack
  └─ Clear rotate state, restore cursor

Escape (while rotate_active_)
  ├─ Restore all entities to original points from rotate_entities_
  └─ Clear rotate state, restore cursor

Shift+R → Instant 90° rotation (original behavior preserved)
```

### State Variables (canvas.hpp)

```cpp
bool rotate_active_{false};           // Free-rotation mode active
QPointF rotate_center_;               // Centroid of selected entities
double rotate_base_angle_{0.0};       // Initial angle (rad) at mode entry
double rotate_current_angle_{0.0};    // Current preview angle (degrees)
QVector<MoveEntity> rotate_entities_; // Original points snapshot
```

### Visual Feedback (paintEvent)

- Orange dashed line from centroid to cursor
- Angle label near cursor (e.g., "45.0°")
- Orange dot at centroid

### Files Modified

- `editor/qt/src/canvas.hpp` — +6 lines (state variables)
- `editor/qt/src/canvas.cpp` — +134/-18 lines (keyPress, mousePress, mouseMove, paintEvent)

## 2. End-to-End Test

### Test Flow

```
Step 1: Create 3 entities (triangle, square, L-shape)
Step 2: Rotate square 45° → verify distances from centroid preserved
Step 3: Scale triangle 2x → verify distances doubled
Step 4: Group square+triangle → verify groupId, L-shape independent
Step 5: Export JSON → verify flat_pts/ring_counts structure
Step 6: Undo all → verify full restoration to original
```

### File

- `tests/qt/test_qt_m1_e2e.cpp` — 274 lines, offscreen QApplication pattern

## 3. DXF Build Fix

### Root Cause

`test_dxf_leader_metadata.cpp` called non-existent `cadgf_document_get_polyline_point_count()`. The C API uses a two-call idiom: first call with nullptr+0 to query count, second call with allocated buffer.

### Fix

```cpp
// Before (broken):
cadgf_document_get_polyline_point_count(doc, id, &point_count);
cadgf_document_get_polyline_points(doc, id, points.data(), point_count);

// After (correct two-call idiom):
cadgf_document_get_polyline_points(doc, id, nullptr, 0, &point_count);
cadgf_document_get_polyline_points(doc, id, points.data(), point_count, &pc2);
```
