# Qt Editor — Usage and Shortcuts

This document summarizes how the Qt editor demo works, key operations, and the current interaction model.

Version: 0.1 (kept in sync with source)

## Canvas Basics
- Background grid with cosmetic lines; X axis (cyan), Y axis (red).
- Pan: Middle mouse button drag, or Alt + Left-drag.
- Zoom: Mouse wheel (zooms around the cursor, keeping world point under the mouse fixed).
- Selection: Click near an edge (12 px threshold) to select a polyline. Selected line highlights in amber.

## Toolbar Actions
- Add Polyline: Adds a closed rectangle {0,0}->{W,0}->{W,H}->{0,H}->{0,0}.
- Triangulate: Triangulates a rectangle and adds each triangle as a closed polyline; all triangles share one group.
- Boolean: Computes union of two rectangles and displays all result rings; all rings share one group.
- Offset: Offsets a rectangle (delta > 0) and displays the resulting ring(s); all rings share one group.
- Delete Selected: Removes the currently selected polyline only.
- Delete Similar: Removes the whole group of the selected item (preferred); if no group, removes polylines of the same color.
- Clear All: Removes all polylines and any triangle wireframe.

Notes:
- Boolean and Offset require Clipper2 via vcpkg to be active (USE_CLIPPER2 defined). If unavailable, the result may be empty with a status hint.
- Triangulate uses earcut when available (USE_EARCUT); otherwise a convex-fan fallback is used (demo only).

## Grouping Semantics
- Each toolbar action creates a new groupId; all polylines created by that action belong to the same group.
- Delete Selected removes just one polyline; Delete Similar removes the entire group.
- This solves the UX issue of needing multiple deletes for a triangulated mesh: select one triangle edge, then Delete Similar (or Shift+Delete in code) to remove the whole batch.

## Visual Details
- Cosmetic pens are used for grid/axes/curves, so stroke width remains constant regardless of zoom.
- Selection threshold is 12 px; adjust in `editor/qt/src/canvas.cpp` if needed.

## Known Limitations (Demo Scope)
- Selection is a simple edge proximity test, scanning back-to-front. For larger scenes, add a spatial index (quadtree) to accelerate hit-testing.
- Boolean/Offset currently render all rings the same; to distinguish outer/holes, consider styling (different colors/dashes) and winding checks.
- Document model is not persisted in the editor (the C API document is used only to demo API calls). A persistent Document would own entities; Canvas would render from it.

## Where to Look in Code
- Canvas widget: `editor/qt/src/canvas.{hpp,cpp}` (rendering, panning/zooming, hit-testing, deletion logic, grouping)
- Main window/actions: `editor/qt/src/mainwindow.cpp` (toolbar actions and group assignment)
- C API: `core/include/core/core_c_api.h` and `core/src/core_c_api.cpp`
- 2D ops: `core/include/core/ops2d.hpp` and `core/src/ops2d.cpp`

