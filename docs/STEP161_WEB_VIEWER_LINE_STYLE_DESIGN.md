# STEP161 Web Viewer Line Style - Design

## Goal
Improve DXF line fidelity in the web viewer by honoring line types (dash patterns) and line weights.

## Scope
- Use `mesh_metadata.json` line slice metadata (`line_entities`) to group line segments by entity.
- Render CAD lines with thickness in world units and basic dash patterns.
- Keep triangle mesh rendering unchanged.
- Include DXF hatch pattern lines (e.g., ANSI31) as line entities for visual parity.
- Honor hatch pattern dash/gap sequences (DXF group code 49) when generating hatch line segments.
- Scale hatch pattern definitions by header line scale (`$LTSCALE * $CELTSCALE`) to better match AutoCAD density.
- Increase arc/ellipse sampling density for hatch clipping (smaller angular step).

## Implementation
- `tools/convert_cli.cpp`
  - Extend `mesh_metadata.json` to emit `line_entities` alongside `entities` when both mesh and line primitives exist.
- `plugins/dxf_importer_plugin.cpp`
  - Parse HATCH pattern definition (pattern name/scale/lines) and emit hatch pattern line segments as `LINE` entities.
  - Add deterministic guardrails for extreme hatch density:
    - `k`-step stride cap (`kMaxHatchPatternKSteps`)
    - Per-hatch / per-document emitted line budgets with early stop
    - Compute budgets for large hatch boundaries (edge-check limit + boundary point cap)
    - Emit import meta keys for attribution (`dxf.hatch_pattern_*`)
- `tools/web_viewer/app.js`
  - Capture glTF line primitive data.
  - Build per-entity line groups using `LineSegments2` + `LineSegmentsGeometry`.
  - Map `line_type` to basic dash patterns (center/hidden/dash/dot/phantom).
  - Map `line_weight` to world-unit line width (clamped default range).
  - Apply `line_type_scale` to dash/gap length.
  - Support `line_weight_scale` URL param to tune visual weight.

## Controls
- Rendering behavior still respects existing URL params:
  - `render=wire` for mesh wireframe
  - `view=top`, `projection=ortho`, `bg=black`, `ui=0`
  - `line_overlay=0` to hide the line overlay (useful for text-only verification)

## Constraints
- Dash patterns are approximate; complex DXF linetypes are not fully reproduced.
- Line width uses world units; exact paper-space line weights may still differ.
- When `line_entities` is missing, line styling falls back to glTF lines.

## Hatch density guardrails
DXF HATCH patterns can encode extremely small spacing, which would otherwise lead to very large `k` ranges and/or
explosive `LINE` emission. The importer applies:
- `k`-range cap via stride: when `k_range > kMaxHatchPatternKSteps`, iterate with `stride=ceil(k_range/kMaxHatchPatternKSteps)`.
- Budgets with early stop:
  - Per-hatch emitted lines: `kMaxHatchPatternLinesPerHatch`
  - Per-document emitted lines: `kMaxHatchPatternLinesPerDocument`
- Compute budgets (hang prevention):
  - Boundary point cap for hatch pattern generation: `kMaxHatchPatternBoundaryPointsForPattern` (skip pattern lines when exceeded)
  - Per-hatch edge-check limit: `kMaxHatchPatternEdgeChecksPerHatch`
  - Per-document edge-check limit: `kMaxHatchPatternEdgeChecksPerDocument`
- Attribution meta keys written to `document.json` (`metadata.meta`):
  - `dxf.hatch_pattern_emitted_lines`
  - `dxf.hatch_pattern_clamped`
  - `dxf.hatch_pattern_clamped_hatches`
  - `dxf.hatch_pattern_stride_max`
  - `dxf.hatch_pattern_ksteps_limit`
  - `dxf.hatch_pattern_edge_checks`
  - `dxf.hatch_pattern_edge_budget_exhausted_hatches`
  - `dxf.hatch_pattern_boundary_points_clamped_hatches`
  - `dxf.hatch_pattern_boundary_points_max`
  - `dxf.hatch_pattern_edge_checks_limit_per_hatch`
  - `dxf.hatch_pattern_edge_checks_limit_per_doc`
  - `dxf.hatch_pattern_boundary_points_limit`

Non-goal (current): do not subtract holes in hatch boundaries; this step only caps density and records attribution.
