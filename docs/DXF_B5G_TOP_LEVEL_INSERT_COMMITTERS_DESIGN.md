# DXF B5g: Top-Level Insert Committers

## Goal

Extract the remaining top-level `INSERT` orchestration from
`plugins/dxf_block_entry_committers.cpp` into a dedicated helper module.

This step follows B5f. After B5f, `dxf_block_entry_committers.cpp` is already
reduced to:

- root-block commit delegation
- top-level `INSERT` orchestration
- local-group remapping for top-level inserts

B5g moves only the second half.

## Scope

Add:

- `plugins/dxf_top_level_insert_committers.h`
- `plugins/dxf_top_level_insert_committers.cpp`

Update:

- `plugins/dxf_block_entry_committers.cpp`
- `plugins/CMakeLists.txt`

## Extraction Boundary

Move only the top-level `for (const auto& insert : inserts)` path, including:

- `include_space(insert.space)` gating
- block lookup by `insert.block_name`
- dimension-block detection
- insert-layer fallback to `"0"`
- transform construction for top-level inserts
- stack initialization with the referenced block name
- local-group resolution and fallback group allocation
- `emit_dxf_block_entities(...)` invocation for top-level inserts
- `dxf.block_ref.<group_id>` metadata writing for non-dimension inserts

Leave in `dxf_block_entry_committers.cpp`:

- `resolve_local_group_id(...)`
- delegation to `commit_dxf_root_blocks(...)`
- the thin public `commit_dxf_block_entries(...)` wrapper

## Invariants

Preserve exactly:

- dimension-block rule:
  - `insert.is_dimension || block.name.rfind("*D", 0) == 0`
- identity transform behavior for dimension blocks
- base-point transform logic for non-dimension inserts
- local-group reuse semantics for `insert.local_group_tag`
- `source_bundle_id` passthrough:
  - `insert.is_dimension ? group_id : -1`
- `layout_name` passthrough from the top-level insert
- `dxf.block_ref.<group_id>` metadata write only for non-dimension inserts

## Non-Goals

Do not:

- change root-block fallback logic from B5f
- change `emit_dxf_block_entities(...)`
- change block recursion
- change leaf entity emission
- change plugin ABI

## Expected End State

After B5g, `dxf_block_entry_committers.cpp` should be a thin facade that:

- calls `commit_dxf_root_blocks(...)`
- calls `commit_dxf_top_level_inserts(...)`

That will leave this file effectively closed out for the current B5 committer
track.
