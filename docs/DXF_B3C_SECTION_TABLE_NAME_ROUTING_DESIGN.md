## Scope

Implement the third parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only the `code == 2` section/table name routing that
follows the zero-record dispatcher. It does **not** extract header/object/entity
field parsing.

## Goal

Reduce the amount of section/table name routing embedded inside
`parse_dxf_entities(...)` by moving that logic into a narrow helper module:

- `plugins/dxf_parser_name_routing.h`
- `plugins/dxf_parser_name_routing.cpp`

## Included

Extract only these branches:

- `if (expect_section_name && code == 2) { ... }`
- `if (expect_table_name && code == 2) { ... }`

The helper may introduce a narrow routing context struct if needed.

## Explicit Non-Goals

Do **not** extract:

- the zero-record dispatcher
- non-`code == 2` field parsing
- header variable parsing
- layout object parsing
- entity property decoding
- parser main loop
- committer code
- plugin ABI

Do **not** change:

- section selection semantics for `TABLES`, `HEADER`, `ENTITIES`, `BLOCKS`, `OBJECTS`
- `current_header_var.clear()` behavior for `HEADER`
- `in_block` / `in_block_header` reset semantics
- `current_table` semantics
- `in_layer_table` / `in_style_table` / `in_vport_table` toggles

## Design Constraints

### 1. Keep the parser loop in place

`parse_dxf_entities(...)` must remain in `dxf_importer_plugin.cpp`.

This packet only absorbs the `code == 2` name-routing block.

### 2. Keep dependencies narrow

The new routing helper may depend on:

- `dxf_parser_zero_record.h` if needed for shared enums/types
- `dxf_types.h`
- standard headers

Avoid new dependencies into committer or higher-level DXF modules.

### 3. Preserve transition ordering exactly

The helper must preserve:

- `expect_section_name = false` timing
- `expect_table_name = false` timing
- `current_section` updates
- `current_table` assignment
- block-state reset ordering
- table-flag toggles

## Expected Files

- `plugins/dxf_parser_name_routing.h`
- `plugins/dxf_parser_name_routing.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- `code == 2` routing only
- no widened parser extraction
- no behavior drift in section/table selection
- preserved block-state reset semantics
