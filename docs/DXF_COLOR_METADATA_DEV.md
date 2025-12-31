# DXF Color Metadata Capture (Dev Notes)

## Goal
- Preserve DXF color source info without changing current color resolution.
- Record ACI index where available to support future UI rules (e.g., ACI 7 overrides).

## Design
- Store per-entity metadata in Document meta and expose convenience C API getters.
- Keys (UTF-8 strings):
  - `dxf.entity.<id>.color_source` = `BYLAYER`, `BYBLOCK`, `INDEX`, or `TRUECOLOR`.
  - `dxf.entity.<id>.color_aci` = ACI index string (only when available).
- ACI captured from group code 62; truecolor from group code 420 yields `TRUECOLOR`.
- Nested BYBLOCK inherits ACI/truecolor flags when resolved from parent INSERT style.
- C API helpers:
  - `cadgf_document_get_entity_color_source`
  - `cadgf_document_get_entity_color_aci`
- `document.json` includes `color_source` / `color_aci` when present.

## Code Touchpoints
- `plugins/dxf_importer_plugin.cpp`: track ACI/truecolor on `DxfStyle`, resolve color metadata in
  `apply_line_style`, emit meta keys with `cadgf_document_set_meta_value`.
- `tests/tools/test_dxf_importer_blocks.cpp`: assert `color_source`/`color_aci` for BYBLOCK,
  BYLAYER, INDEX, and missing-layer defaults (via both doc meta and C API helpers).
