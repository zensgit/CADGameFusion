## Scope

Implement the sixth parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only the block-header parsing branch from
`parse_dxf_entities(...)`.

## Goal

Reduce parser branching inside `parse_dxf_entities(...)` by moving the block
header field parsing block into a dedicated helper module:

- `plugins/dxf_block_header.h`
- `plugins/dxf_block_header.cpp`

## Included

Extract only this branch:

- `if (in_block_header) { ... }`

That includes:

- block name parsing for group code `2`
- owner-handle parsing for group code `330`
- base-point parsing for group codes `10` and `20`

The helper may introduce a narrow context struct for the mutable parser state.

## Explicit Non-Goals

Do **not** extract:

- zero-record dispatch
- `code == 2` name routing
- `HEADER` parsing
- layout object parsing
- table record parsing
- entity property decoding
- parser main loop
- committer code
- plugin ABI

Do **not** change:

- `sanitize_utf8(..., header_codepage)` behavior for block names
- `has_name` semantics
- owner-handle assignment semantics
- `has_owner_handle` semantics
- pending block-base parsing across codes `10` and `20`
- `has_block_x` reset timing
- `continue` behavior

## Design Constraints

### 1. Keep the parser loop in place

`parse_dxf_entities(...)` must remain in `dxf_importer_plugin.cpp`.

This packet only absorbs the block-header branch.

### 2. Keep dependencies narrow

The new helper may depend on:

- `dxf_text_encoding.h` for `sanitize_utf8`
- `dxf_math_utils.h` for `parse_double`
- standard headers

Avoid new dependencies into higher-level DXF modules.

### 3. Preserve continue behavior

The helper should report whether it consumed the record so the parser loop can
continue exactly as before.

## Expected Files

- `plugins/dxf_block_header.h`
- `plugins/dxf_block_header.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- `in_block_header` branch only
- no widened parser extraction
- preserved block metadata semantics
- unchanged `continue` behavior
