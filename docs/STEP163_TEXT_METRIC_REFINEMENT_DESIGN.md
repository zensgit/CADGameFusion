# STEP163 Text Metric Refinement Design

## Goal
Improve text overlay alignment by incorporating DXF width factors and default text height, and by using consistent line height for multi-line text.

## Changes
- **DXF importer**
  - Capture `TEXT` width factor (code 41) as `dxf.entity.*.text_width_factor`.
  - Persist header default text height as `dxf.default_text_height`.
- **convert_cli**
  - Export `text_width_factor` for text entities in `document.json`.
- **web_viewer**
  - Use `text_width_factor` when estimating text width.
  - Use `dxf.default_text_height` as a fallback height.
  - Apply a consistent line height multiplier for multi-line text.

