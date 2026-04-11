# DXF B5d: Block Entry Committers

## Goal

Extract the remaining block-entry orchestration from
`plugins/dxf_importer_plugin.cpp` into a dedicated helper module, after B5c has
landed the recursive block-emission path.

This packet is intentionally narrow. It does not change parsing, entity
materialization, or plugin ABI. It only moves the block entrypoint shell that
decides which blocks to emit and when.

## Scope

Move the following logic out of `importer_import_document(...)`:

- `block_has_entities(...)`
- `find_named_block(...)`
- `collect_top_level_paper_layout(...)`
- `collect_top_level_paper_layouts(...)`
- `emit_root_block(...)`
- fallback root-block selection/emission for `*Model_Space` / `*Paper_Space`
- paperspace root-block recovery
- top-level `INSERT` expansion that calls the recursive block emitter

Expected new files:

- `plugins/dxf_block_entry_committers.h`
- `plugins/dxf_block_entry_committers.cpp`

Expected touched existing files:

- `plugins/dxf_importer_plugin.cpp`
- `plugins/CMakeLists.txt`

## Non-Goals

Do not change:

- `emit_dxf_block_entities(...)`
- `commit_dxf_top_level_entities(...)`
- parser modules
- table/finalizer helpers
- plugin ABI entrypoints
- metadata keys or group-id semantics

## Required Invariants

Preserve exactly:

- fallback preference order for root blocks
- paperspace recovery rules driven by `count_space1`
- top-level insert handling for `*D` dimension blocks
- `top_level_local_groups` behavior
- `dxf.block_ref.<group_id>` metadata writes
- space/layout propagation and error semantics

## Notes

B5d should be implemented only after B5c merges, because it depends on the new
recursive block-emission helper being available on `main`.
