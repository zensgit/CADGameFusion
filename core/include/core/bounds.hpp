#pragma once

#include "core/document.hpp"

namespace core {

// Real geometry content bounds of a Document, in world coordinates.
//
// This is the "one geometry truth" for view fitting (fitToContent) and the
// render service's version-diff common-window upgrade. It is the extent of the
// ACTUAL geometry, deliberately distinct from the DXF HEADER $EXTMIN/$EXTMAX
// (which can be stale-small and clip). Computed over the geometric payload of
// every entity, so it is guaranteed to CONTAIN the rendered ink — it never
// under-covers drawn geometry (the property the common-window upgrade needs).
//
// Coverage per payload type:
//   Polyline  - all vertices (exact). DXF flattens Arc/Circle/Line/Spline/
//               LWPolyline into Polyline at import, so this arm carries most
//               real ink.
//   Line      - both endpoints (exact).
//   Circle    - center +/- radius (exact).
//   Arc       - over-covered by its full circle (center +/- radius): safe, and
//               avoids extreme-angle math (native Arc only from core-API docs;
//               DXF arcs arrive pre-flattened).
//   Ellipse   - rotated full-ellipse AABB (over-covers elliptical arcs).
//   Spline    - control-point hull AABB (a clamped B-spline lies within it).
//   Text      - rotated glyph-box over-estimate from pos/height/rotation. Exact
//               width needs font metrics (QFontMetricsF, render layer); that
//               render-accurate refinement is a documented follow-up. The
//               estimate here over-covers (never clips), so it is safe for the
//               common-window purpose.
//   Point     - EXCLUDED: renderScene draws no pixels for a Point, so including
//               it would inflate the box with non-ink markers.
//   BlockInstance - insertion point only (defensive; the DXF importer flattens
//               blocks into primitives, so this payload never occurs there).
//
// Returns false (leaving the outputs untouched) when the document has no
// bounding geometry (empty, or only Points).
bool contentBounds(const Document& doc,
                   double& minX, double& minY, double& maxX, double& maxY);

}  // namespace core
