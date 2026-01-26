# VemCAD Web Viewer Visual Parity Design

## Goals
- Reduce visual drift from AutoCAD in the web preview for DWG/DXF conversions.
- Preserve CAD intent for line types/weights, hatch fills, and text styles.
- Keep changes contained to the web viewer + DXF importer metadata.

## Scope
- Web viewer rendering (`tools/web_viewer/app.js`).
- DXF importer metadata (`plugins/dxf_importer_plugin.cpp`).
- No changes to core geometry generation or GLTF export.

## Line Style Rendering
- **Problem**: Line types and weights were ignored; all lines rendered as basic single-width strokes.
- **Approach**:
  - Read `line_type`, `line_type_scale`, and `line_weight` from entity data.
  - Parse DXF `LTYPE` table and emit `dxf.linetype.<name>.pattern/.length` metadata.
  - Prefer DXF linetype patterns when available; fall back to presets for unknown styles.
  - When a full pattern is available, pre-split line segments into dash/gap geometry instead of relying on single dash/gap materials.
  - Build wide line batches with `LineSegments2` + `LineMaterial` (Three.js r160).
  - Group slices by `(line_type, dash_size, gap_size, line_weight, opacity)` to reduce object count.
  - Use `LineSegmentsGeometry.setColors()` to preserve per-entity colors via vertex colors.
  - For dashed lines, set `dashed/dashSize/gapSize` on `LineMaterial` and call `computeLineDistances()`.
  - Update `LineMaterial.resolution` on resize for consistent screen-space thickness.

## Text Style Mapping
- **Problem**: Text style metadata was unavailable; viewer used a single fallback font.
- **Approach**:
  - DXF importer writes `dxf.entity.<id>.text_style` (default `STANDARD`).
  - Viewer resolves style name to a font family stack.
  - Use a CJK-friendly default font stack to improve Chinese text rendering.

## Hatch Fill Rendering
- **Problem**: Hatch boundaries existed but were only rendered as polylines, resulting in missing fills.
- **Approach**:
  - Detect hatch boundary entities using `__cadgf_hatch:<id>` naming.
  - Group boundaries by hatch id and build a `THREE.Shape`:
    - Largest-area loop is outer boundary.
    - Remaining loops become holes.
  - Render fills with `MeshBasicMaterial` at low opacity behind linework.
  - Apply outlier clipping planes and normal visibility rules.

## Visibility + Clipping Integration
- Hatch meshes and dashed line materials reuse existing visibility logic:
  - Diff filters, layer visibility, space visibility, and outlier clipping.
- `refreshHatchMeshes()` is called on space changes, diff toggles, contrast changes, and document ingestion.

## Known Limitations
- WebGL line width support is platform-limited; heavy lineweight parity may require custom line rendering.
- Linetype shapes/text segments (e.g., complex linetype definitions) are not rendered; only dash/gap segments are supported.
- Paper-space viewports do not yet clone hatch fills into the overlay.
