## Scope

Implement the fifth parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only the layout-object parsing branch from
`parse_dxf_entities(...)`.

## Goal

Reduce parser branching inside `parse_dxf_entities(...)` by moving the layout
object field parsing block into a dedicated helper module:

- `plugins/dxf_layout_objects.h`
- `plugins/dxf_layout_objects.cpp`

## Included

Extract only this branch:

- `if (current_section == DxfSection::Objects && in_layout_object) { ... }`

That includes:

- layout name parsing for group code `1`
- layout block-record parsing for group code `330`

The helper may introduce a narrow context struct for the mutable parser state.

## Explicit Non-Goals

Do **not** extract:

- zero-record dispatch
- `code == 2` section/table name routing
- `HEADER` parsing
- layer/style/vport table record parsing
- block header parsing
- entity property decoding
- parser main loop
- committer code
- plugin ABI

Do **not** change:

- `sanitize_utf8(..., header_codepage)` behavior for layout names
- `has_name` semantics
- block-record assignment semantics
- `has_block_record` semantics
- `continue` behavior for records inside layout objects

## Design Constraints

### 1. Keep the parser loop in place

`parse_dxf_entities(...)` must remain in `dxf_importer_plugin.cpp`.

This packet only absorbs the layout-object branch.

### 2. Keep dependencies narrow

The new helper may depend on:

- `dxf_parser_zero_record.h` for `DxfSection`
- `dxf_text_encoding.h` if needed for `sanitize_utf8`
- standard headers

Avoid new dependencies into higher-level DXF modules.

### 3. Preserve continue behavior

The helper should report whether it consumed the record so the parser loop can
continue exactly as before.

### 4. Preserve layout-field timing

The helper must preserve:

- when `current_layout.name` updates
- when `current_layout.has_name` updates
- when `current_layout.block_record` updates
- when `current_layout.has_block_record` updates

## Expected Files

- `plugins/dxf_layout_objects.h`
- `plugins/dxf_layout_objects.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- `Objects + in_layout_object` branch only
- no widened parser extraction
- preserved layout metadata semantics
- unchanged `continue` behavior
