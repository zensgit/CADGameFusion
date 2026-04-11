## Scope

Implement the fourth parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only the `HEADER` section parsing branch from
`parse_dxf_entities(...)`.

## Goal

Reduce parser branching inside `parse_dxf_entities(...)` by moving the DXF
header-variable parsing block into a dedicated helper module:

- `plugins/dxf_header_vars.h`
- `plugins/dxf_header_vars.cpp`

## Included

Extract only this branch:

- `if (current_section == DxfSection::Header) { ... }`

That includes:

- `code == 9` header-variable selection
- `$DWGCODEPAGE` handling for group codes `3` and `1`
- `$LTSCALE`, `$CELTSCALE`, `$TEXTSIZE` handling for group code `40`

The helper may introduce a narrow context struct for the mutable parser state.

## Explicit Non-Goals

Do **not** extract:

- zero-record dispatch
- `code == 2` section/table name routing
- layout object parsing
- layer/style/vport table record parsing
- block header parsing
- entity property decoding
- parser main loop
- committer code
- plugin ABI

Do **not** change:

- header variable selection semantics
- `$DWGCODEPAGE` assignment semantics
- `$LTSCALE` / `$CELTSCALE` / `$TEXTSIZE` parsing semantics
- `has_header_*` flag behavior
- parse-double failure handling

## Design Constraints

### 1. Keep the parser loop in place

`parse_dxf_entities(...)` must remain in `dxf_importer_plugin.cpp`.

This packet only absorbs the `HEADER` branch.

### 2. Keep dependencies narrow

The new helper may depend on:

- `dxf_parser_zero_record.h` for `DxfSection`
- `dxf_math_utils.h` for `parse_double` if needed
- standard headers

Avoid new dependencies into higher-level DXF modules.

### 3. Preserve continue behavior

The helper should report whether it consumed the record so the parser loop can
continue exactly as before.

### 4. Preserve variable/flag timing

The helper must preserve:

- when `current_header_var` changes
- when `header_codepage` / `has_header_codepage` update
- when `header_ltscale` / `header_celtscale` / `header_textsize` update
- when `has_header_ltscale` / `has_header_celtscale` / `has_header_textsize`
  update

## Expected Files

- `plugins/dxf_header_vars.h`
- `plugins/dxf_header_vars.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- `HEADER` branch only
- no widened parser extraction
- preserved header-variable semantics
- unchanged `continue` behavior
