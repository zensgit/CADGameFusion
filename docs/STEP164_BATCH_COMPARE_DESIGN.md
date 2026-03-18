# STEP164 Batch AutoCAD Comparison Design

## Goal
Run multiple AutoCAD PDF comparisons via Playwright CLI and collect a summary table.

## Inputs
- JSON case list (`--cases`):
  - `name`, `pdf`, `manifest`
  - `filters` (e.g. `["dimension", "all"]`)
  - `space` (`model` or `paper`)
  - `paper_viewport` toggle
  - Optional: `layout`, `text_style`, `line_weight_scale`, component filters

## Output
- Per-case artifacts in `docs/assets/batch/<case>_<filter>/`
- Appended detailed sections in `docs/STEP164_BATCH_COMPARE_VERIFICATION.md`
- Summary table at the end of the report

