# STEP162 Paper Space Viewport Design

## Goal
Render paper-space layouts by mapping model-space geometry into paper-space viewports, and clip to the viewport rectangle for layout-like previews.

## Inputs
- DXF meta keys from `document.json`:
  - `dxf.viewport.count`
  - `dxf.viewport.{i}.space`
  - `dxf.viewport.{i}.center_x|center_y`
  - `dxf.viewport.{i}.width|height`
  - `dxf.viewport.{i}.view_center_x|view_center_y`
  - `dxf.viewport.{i}.view_height`
  - `dxf.viewport.{i}.twist_deg`
  - `dxf.viewport.{i}.layout` (optional)
- URL params:
  - `space=paper` to enable paper mode
  - `paper_viewport=1|0` toggle
  - `layout=<name>` filter

## Model → Paper Transform
For each viewport:
- `scale = viewport.height / viewport.view_height`
- `twistRad = viewport.twist_deg * PI / 180`
- Apply rotation by `-twistRad`, then scale, then translate to paper center:
  - `p' = R(-twist) * (p - view_center)`
  - `paper = center + p' * scale`

## Clipping
Use a 2D Cohen–Sutherland clip against the viewport rectangle:
- `minX/maxX = center.x ± width/2`
- `minY/maxY = center.y ± height/2`

## Viewer Behavior
- If `space=paper` and `paper_viewport=1` and viewports exist:
  - Render paper-space entities as-is.
  - Render model-space line/text entries through each viewport transform and clip.
- If no viewport metadata exists, paper view behaves as “paper-only.”

