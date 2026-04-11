## Scope

Implement the second parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only the `code == 0` transition logic from
`parse_dxf_entities(...)`. It does **not** extract the full parser state
machine.

## Goal

Reduce the amount of zero-record transition branching embedded inside
`parse_dxf_entities(...)` by moving that logic into a narrow helper module:

- `plugins/dxf_parser_zero_record.h`
- `plugins/dxf_parser_zero_record.cpp`

## Included

Extract only the `code == 0` transition handling for:

- section open/close transitions:
  - `SECTION`
  - `ENDSEC`
  - `TABLE`
  - `ENDTAB`
- table-record transitions:
  - `LAYER`
  - `STYLE`
  - `VPORT`
- block/layout transitions:
  - `BLOCK`
  - `ENDBLK`
  - `LAYOUT`
- entity-activation transitions:
  - `SEQEND`
  - `ATTRIB`
  - top-level entity kind selection for
    - `INSERT`
    - `LWPOLYLINE`
    - `LINE`
    - `POINT`
    - `CIRCLE`
    - `ARC`
    - `ELLIPSE`
    - `SPLINE`
    - `SOLID`
    - `HATCH`
    - `TEXT`
    - `MTEXT`
    - `DIMENSION`
    - `LEADER`
    - `VIEWPORT`
    - `POLYLINE`
    - `VERTEX`
    - `ATTDEF`
    - `ATTRIB`

The helper may introduce a narrow parser-transition context struct if needed,
but the packet must remain a zero-record extraction, not a parser rewrite.

## Explicit Non-Goals

Do **not** extract:

- `parse_dxf_entities(...)`
- non-zero group-code field parsing
- entity property decoding
- block/layout finalization internals
- committer code
- insert handler extraction
- hatch pattern extraction
- plugin ABI

Do **not** change:

- entity ordering
- section/table semantics
- block/header semantics
- active insert attribute owner semantics
- `entities_parsed` counting
- error reporting semantics

## Design Constraints

### 1. Keep the parser loop in place

`parse_dxf_entities(...)` must remain in `dxf_importer_plugin.cpp`.

The new helper should only absorb the zero-record transition branch and return
enough information for the loop to continue with the existing non-zero parsing
logic.

### 2. Keep dependencies narrow

The new zero-record helper module may depend on:

- `dxf_types.h`
- `dxf_parser_helpers.h`
- standard headers as needed

Avoid new dependencies into committer or higher-level DXF modules.

### 3. Preserve flush/finalize behavior exactly

The existing zero-record path currently coordinates:

- `flush_current()`
- old-style polyline sequence handling
- table-record finalize/reset
- block finalize/reset
- layout finalize/reset

That behavior must remain byte-for-byte equivalent at the call level.

### 4. Preserve entity-kind activation behavior

The packet must preserve:

- `current_kind` transitions
- `has_last_top_level_insert`
- `has_active_insert_attribute_owner`
- `active_insert_attribute_owner`
- `import_stats->entities_parsed`

### 5. Prefer reviewable helper boundaries

If one helper becomes too wide, split it into two or three narrow helpers such
as:

- section/table transitions
- block/layout transitions
- entity-kind transitions

But do not move unrelated parser code in this packet.

## Expected Files

- `plugins/dxf_parser_zero_record.h`
- `plugins/dxf_parser_zero_record.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- zero-record branch only
- no parser state-machine rewrite
- no new dependency cycle
- preserved finalize/reset semantics
- preserved entity-kind activation semantics
