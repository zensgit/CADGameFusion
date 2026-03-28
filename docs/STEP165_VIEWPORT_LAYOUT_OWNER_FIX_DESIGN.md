# STEP165 Viewport Layout Owner Fix Design

## Problem
Some DXF exports include paper-space VIEWPORT entities but omit the 410 layout name.
AutoCAD still renders the layout because each VIEWPORT is owned by a layout block record
handle (code 330), and the layout name is stored in the OBJECTS section (LAYOUT objects).

Without the 410 field, the web viewer cannot filter viewports by layout, so paper
previews appear empty or unselectable.

## Approach
- Parse LAYOUT objects in the DXF OBJECTS section.
- Build a mapping: `block_record_handle -> layout_name` (from LAYOUT code 330 + 1).
- Capture VIEWPORT owner handle (code 330).
- When a VIEWPORT has no 410 layout, fill it using the owner mapping.
- If the resolved layout is not Model, mark the viewport as paper-space (space = 1).

## Output
The importer now writes `dxf.viewport.N.layout` even when 410 is missing, so the
viewer `layout=` filter works for these DXFs.
