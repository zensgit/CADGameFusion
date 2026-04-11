# DXF B5f: Root Block Committers

## Goal

Extract the root-block emission path from `plugins/dxf_block_entry_committers.cpp`
into a dedicated helper module without changing DXF import behavior.

This step is intentionally narrow. It only moves the logic that:

- discovers emit-worthy root blocks
- decides which paperspace root blocks should be emitted
- performs fallback root-block emission when there are no top-level entities

It does **not** change top-level `INSERT` handling.

## Scope

Add:

- `plugins/dxf_root_block_committers.h`
- `plugins/dxf_root_block_committers.cpp`

Update:

- `plugins/dxf_block_entry_committers.cpp`
- `plugins/CMakeLists.txt`

## Extraction Boundary

Move only the root-block path from `commit_dxf_block_entries(...)`, including the
minimal local helpers it needs:

- `block_has_entities(...)`
- `find_named_block(...)`
- paperspace block collection
- top-level paperspace layout collection
- `emit_root_block(...)`
- fallback `*MODEL_SPACE` / `*PAPER_SPACE` handling when there are no top-level entities
- paperspace root-block emission when `has_paperspace && include_space(1)`

Leave in `dxf_block_entry_committers.cpp`:

- `uppercase_ascii(...)`
- `is_paper_block_name(...)`
- `is_model_layout_name(...)`
- `resolve_local_group_id(...)`
- the top-level `INSERT` loop
- group-id assignment for top-level inserts
- top-level insert recursion entry via `emit_dxf_block_entities(...)`

## Public Contract

The new helper should expose one narrow entry point:

- `commit_dxf_root_blocks(...)`

It should receive the existing commit context pieces it needs and return `false`
on the same failures as the current inline logic.

## Invariants

Preserve exactly:

- fallback order:
  - `*Model_Space`
  - `*MODEL_SPACE`
  - `*Paper_Space`
  - `*PAPER_SPACE`
- root block deduplication by block name
- paperspace layout omission rules based on:
  - `commit_ctx.count_space1`
  - explicit layout-name attribution
  - `has_unattributed_top_level_paperspace`
- layout-name propagation into `emit_dxf_block_entities(...)`
- `set_error(out_err, 3, "failed to emit block entities")`
- recursion stack reset behavior around each root emission

## Non-Goals

Do not:

- change `emit_dxf_block_entities(...)`
- change `commit_dxf_block_entries(...)` top-level insert semantics
- change root block selection rules
- change metadata writing
- change plugin ABI
- mix this step with committer leaf emission or insert orchestration work

## Notes

This is the natural follow-up to:

- B5c: block entity committers
- B5d: block entry committers
- B5e: block leaf entity emitters

After this step, `dxf_block_entry_committers.cpp` should mainly own:

- helper predicates
- top-level insert orchestration
- local-group wiring for top-level inserts
