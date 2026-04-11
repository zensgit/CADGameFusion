# DXF B5e Block Leaf Entity Emitters Design

## Goal

Extract block leaf-entity emission from `plugins/dxf_block_entity_committers.cpp` into a dedicated helper module, while leaving nested `INSERT` recursion and top-level block orchestration unchanged.

## Scope

Add:

- `plugins/dxf_block_leaf_entity_emitters.h`
- `plugins/dxf_block_leaf_entity_emitters.cpp`

Update:

- `plugins/dxf_block_entity_committers.cpp`
- `plugins/CMakeLists.txt`

## Extraction Boundary

Move only the leaf entity emission loops for:

- `polylines`
- `lines`
- `points`
- `circles`
- `arcs`
- `ellipses`
- `splines`
- `texts`

Keep in `dxf_block_entity_committers.cpp`:

- `emit_dxf_block_entities(...)` public entry
- local-group/source-bundle setup
- nested `INSERT` recursion
- transform composition for nested blocks
- recursion depth / cycle checks

## Invariants

- No behavior change in block recursion, group assignment, source-bundle metadata, layout metadata, or insert-derived metadata.
- No changes to importer parse flow or plugin ABI.
- Preserve the current runnable `dxf|dwg` subset behavior unchanged.
