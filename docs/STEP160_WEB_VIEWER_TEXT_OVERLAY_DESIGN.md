# STEP160 Web Viewer Text Overlay - Design

## Goal
Render CAD text (TEXT + DIMENSION) in the web viewer using `document.json` metadata.

## Scope
- Use `document.json` text entities (`type=CADGF_ENTITY_TYPE_TEXT`).
- Apply alignment from `text_attachment` or `text_halign/text_valign`.
- Apply rotation from `dim_text_rotation` for dimensions or `text.rot` for regular text.
- Use `text_width` (mtext width) or glyph-based estimates to refine horizontal anchor alignment in screen space.
- Compute text height in screen space using the rotated text-up vector (rotation-aware scaling).
- Apply a small baseline shift when `text_valign=0` along the text-up direction.
- Provide simple filters (Dimension/Text/All) and a top-level Text toggle.
- Clean common DXF formatting codes for readability.
- Support a "clean" overlay style for CAD-like screenshots (no label background/border).

## Implementation
- `tools/web_viewer/index.html`: add toggle button and a canvas overlay layer.
- `tools/web_viewer/style.css`: overlay + canvas styling.
- `tools/web_viewer/app.js`:
  - Collect text entities from `document.json`.
  - Project world positions to screen each frame.
  - Render text to a dedicated canvas overlay (rotation + baseline alignment).
  - Filter by `text_kind` and cap label count.
  - Strip common formatting markers (`\\H`, `\\S`, braces, `%%p/%%d/%%c`).
  - Support URL params for automation:
    - `text_filter=dimension|text|all`
    - `text_overlay=0|1|false|true|off|on`
    - `text_style=clean` (strip background/border/shadow for overlay labels)
    - `view=top` (force top view)
    - `projection=ortho` (orthographic camera)
    - `grid=0|1` (toggle grid)
    - `bg=black|dark` (set black background)
    - `render=wire|wireframe` (wireframe materials)
    - `ui=0|1` (hide/show sidebar + HUD)
    - `space=model|paper|all` (filter entities/slices by DXF space; default all)
  - Update overlay stats panel (total, displayed, capped, filter, overlay state).

## Constraints
- Max label count capped for performance.
- Formatting codes are not fully parsed; values are shown as raw text with `\P` -> newline.
- Labels are culled when off-screen or below minimum screen size.
