## Scope

Implement the first parser-layer extraction batch for the DXF importer in:

- `plugins/dxf_importer_plugin.cpp`

This packet extracts only reusable parser helpers. It does **not** extract the
main `parse_dxf_entities(...)` state machine.

## Goal

Reduce the amount of low-level parsing utility code embedded inside
`dxf_importer_plugin.cpp` by moving shared parser helpers into a dedicated leaf
module:

- `plugins/dxf_parser_helpers.h`
- `plugins/dxf_parser_helpers.cpp`

## Included

Extract only these helpers:

- `parse_entity_space(...)`
- `parse_entity_owner(...)`
- any tiny helper state or parameter plumbing needed to support them cleanly

And re-home the existing low-level parsing utility includes/usage so the parser
state machine can consume them through the new helper header.

If useful, the new helper module may also wrap the already shared low-level
utilities from `dxf_math_utils.h`:

- `parse_int(...)`
- `parse_double(...)`
- `trim_code_line(...)`
- `strip_cr(...)`

But this packet must stay a **thin parser-helper extraction**, not a parser
rewrite.

## Explicit Non-Goals

Do **not** extract:

- `parse_dxf_entities(...)`
- entity-kind switch/state-machine logic
- block/layout finalization
- parser object model structs
- insert handler extraction
- hatch pattern extraction
- document committer code
- final plugin-shell slimming

Do **not** change:

- plugin ABI
- DXF behavior
- entity ordering
- text/style/layout semantics
- error reporting semantics

## Design Constraints

### 1. Keep the state machine in place

`parse_dxf_entities(...)` should remain in `dxf_importer_plugin.cpp`.

The new helper module should only reduce local clutter by moving repeatable
entity-level parse helpers out of the monolith.

### 2. Keep helper dependencies narrow

The new parser-helper module should depend only on:

- `dxf_types.h`
- `dxf_math_utils.h`
- standard headers as needed

Avoid introducing new dependencies back into higher-level DXF modules.

### 3. Preserve current call shape

The call sites inside the parser switch should stay straightforward. Prefer a
drop-in helper API so the packet remains reviewable and behavior-neutral.

### 4. Preserve paperspace detection behavior

`parse_entity_space(...)` currently influences `has_paperspace`. Keep that exact
behavior unchanged.

### 5. Preserve owner-handle semantics

`parse_entity_owner(...)` must preserve:

- group code `330`
- empty/non-empty owner handling
- `has_owner_handle` updates

## Expected Files

- `plugins/dxf_parser_helpers.h`
- `plugins/dxf_parser_helpers.cpp`
- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Suggested Review Focus

- narrow helper-only extraction
- no parser state-machine movement
- no dependency cycle
- no behavior drift in `space` / `owner` parsing
