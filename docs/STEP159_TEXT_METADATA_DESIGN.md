# STEP159 Text Alignment & Dimension Metadata Design

## Goal
Expose DXF text alignment and dimension metadata to `document.json` so downstream viewers can position/annotate text consistently.

## Alignment position policy (strict)
DXF text entities can include both an insertion point (group codes `10/20`) and an alignment point (`11/21`).
To avoid "missing axis becomes 0" bugs and keep behavior deterministic:
- Only use `align_pos` when **both** `align_x` **and** `align_y` exist (`11` + `21`).
- When `11/21` is partial (only one axis present), keep `pos` from `10/20` unchanged.
- Reject non-finite numeric values (`NaN/Inf`) during parsing (treat as missing), so invalid entities are skipped instead of poisoning downstream geometry.

Implementation notes:
- `finalize_text()` is the single alignment decision point (strict mode).
- Import emission must not re-override `pos` using `align_pos` based on `(has_align_x || has_align_y)`.

## Import attribution meta (document-level)
To make regressions explainable (and to avoid re-introducing partial-axis bugs), the importer writes doc-level meta keys:
- `dxf.text.align_policy`: `"strict"`
- `dxf.text.entities_seen`
- `dxf.text.entities_emitted`
- `dxf.text.skipped_missing_xy`
- `dxf.text.align_complete`
- `dxf.text.align_partial`
- `dxf.text.align_partial_x_only`
- `dxf.text.align_partial_y_only`
- `dxf.text.align_used`
- `dxf.text.nonfinite_values`

## Scope
- DXF importer writes text alignment + dimension metadata into document meta.
- `convert_cli` surfaces those meta fields on text entities in `document.json`.
- Schema updated with optional fields.

## Metadata flow
1. `plugins/dxf_importer_plugin.cpp`
   - Writes per-entity meta:
     - `dxf.entity.<id>.text_kind` (text/mtext/attrib/attdef/mleader/table/dimension)
     - `dxf.entity.<id>.text_width`
     - `dxf.entity.<id>.text_attachment`
     - `dxf.entity.<id>.text_halign`
     - `dxf.entity.<id>.text_valign`
     - `dxf.entity.<id>.dim_type`
     - `dxf.entity.<id>.dim_style`
     - `dxf.entity.<id>.dim_text_pos_x/y`
     - `dxf.entity.<id>.dim_text_rotation` (radians)
2. `tools/convert_cli.cpp`
   - Reads these meta values and emits them on the text entity JSON.

## JSON additions (optional)
Added optional fields under `entities[]` for text entities:
- `text_kind`, `text_width`, `text_attachment`, `text_halign`, `text_valign`
- `dim_type`, `dim_style`, `dim_text_pos`, `dim_text_rotation`

## Non-breaking
- Fields are optional and only present when metadata exists.
- Schema allows additional properties; new fields are documented for validation.
