# DXF B5h: Top-Level Geometry Committers

## Goal

Extract the simple top-level geometry emission path from
`plugins/dxf_top_level_entity_committers.cpp` into a dedicated helper module.

This step deliberately moves only the geometry loops and keeps text-related
logic for a later step.

## Scope

Add:

- `plugins/dxf_top_level_geometry_committers.h`
- `plugins/dxf_top_level_geometry_committers.cpp`

Update:

- `plugins/dxf_top_level_entity_committers.cpp`
- `plugins/CMakeLists.txt`

## Extraction Boundary

Move only these top-level loops:

- `polylines`
- `lines`
- `points`
- `circles`
- `arcs`
- `ellipses`
- `splines`

Keep in `dxf_top_level_entity_committers.cpp`:

- shared local helpers:
  - `resolve_local_group_id(...)`
  - `trim_ascii(...)`
  - `format_measurement(...)`
- shared resolver lambdas:
  - `resolve_layer_id(...)`
  - `layer_style_for(...)`
  - `maybe_write_layout_metadata(...)`
  - `include_space(...)`
  - `apply_group(...)`
  - `resolve_text_height(...)`
- top-level text emission
- top-level dimension text emission

## Invariants

Preserve exactly:

- layer creation fallback behavior
- layout metadata behavior
- origin metadata writes for geometry entities
- line-style application behavior
- local-group mapping for top-level polylines
- omission rules:
  - polyline point count `< 2`
  - spline control point count `< 2`
  - ellipse invalid major/radius cases

## Non-Goals

Do not:

- change text entity handling
- change dimension text handling
- change helper lambdas shared with text handling
- change plugin ABI

## Expected End State

After B5h, `dxf_top_level_entity_committers.cpp` should mostly own:

- shared layer/layout helpers
- top-level text emission
- dimension text emission

and delegate the simple geometry loops to the new helper.
