## DXF B5c: Block Entity Committers

### Goal
Extract the recursive block-entity emission path from `importer_import_document(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_block_entity_committers.h`
- Add `plugins/dxf_block_entity_committers.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract the recursive `emit_block(...)` path and the small helper logic tightly coupled to it:
- `resolve_entity_layer_name(...)`
- block-local group resolution
- source-bundle propagation for dimension-derived entities
- transform-sensitive block entity emission for:
  - block polylines
  - block lines
  - block points
  - block circles
  - block arcs
  - block ellipses
  - block splines
  - block texts
  - nested inserts within blocks

### Required invariants
- Preserve exact recursive emission order inside blocks.
- Preserve exact `kMaxBlockDepth` handling.
- Preserve exact transform behavior for uniform and non-uniform scaling.
- Preserve exact layer inheritance from entity layer `"0"` to insert layer.
- Preserve exact layout metadata propagation and source-bundle metadata propagation.
- Preserve exact insert-derived metadata behavior.
- Preserve exact group assignment behavior for nested/local groups.
- Preserve exact text-height scaling, rotation threading, and width metadata behavior for block text.
- Keep `emit_root_block(...)`, fallback block selection, and top-level insert expansion orchestration in `dxf_importer_plugin.cpp`.

### Out of scope
- Document commit context preparation
- Top-level entity committers
- Root block fallback selection/emission
- Top-level insert iteration in `importer_import_document(...)`
- Plugin ABI
