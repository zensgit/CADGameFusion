## DXF B5b: Top-Level Entity Committers

### Goal
Extract the top-level entity commit loops from `importer_import_document(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_top_level_entity_committers.h`
- Add `plugins/dxf_top_level_entity_committers.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract the top-level entity emission block that currently commits:
- polylines
- lines
- points
- circles
- arcs
- ellipses
- splines
- text entities
- top-level DIMENSION text emitted from inserts

The new helper may depend on:
- `DxfDocumentCommitContext`
- `dxf_importer_internal_types.h`
- existing metadata/style writers

### Required invariants
- Preserve exact top-level entity emission order.
- Preserve exact layer resolution behavior and error strings.
- Preserve exact `include_space(...)` behavior from the prepared commit context.
- Preserve exact layout metadata behavior, including default paper layout fallback.
- Preserve exact group assignment behavior for top-level polylines and texts.
- Preserve exact origin metadata and text metadata writes.
- Preserve exact line-style application behavior and default line scale threading.
- Preserve exact DIMENSION text formatting, trimming, fallback measurement formatting, and omission behavior.
- Keep `emit_block(...)` and later block/insert expansion logic in `dxf_importer_plugin.cpp`.

### Out of scope
- Document commit context preparation
- Layer bootstrap/context preparation
- Block recursion / `emit_block(...)`
- Root block fallback emission
- Insert expansion and source-bundle recursion
- Plugin ABI
