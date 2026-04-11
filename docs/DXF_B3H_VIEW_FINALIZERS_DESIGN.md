## DXF B3h: View And Layout Finalizers Extraction

### Goal
Extract the three view/layout finalizers from `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_view_finalizers.h`
- Add `plugins/dxf_view_finalizers.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract these lambdas:
- `finalize_viewport(...)`
- `finalize_vport(...)`
- `finalize_layout(...)`

### Required invariants
- Preserve the completeness gate for `DxfViewport` before it is emitted.
- Preserve width/height/view-height positivity checks.
- Preserve paperspace promotion logic:
  - non-model `viewport.layout`
  - paper block name fallback when `in_block`
  - `has_paperspace = true` side effect
- Preserve `viewports.push_back(viewport)` timing.
- Preserve `*ACTIVE` detection for `DxfView`.
- Preserve `active_view` / `has_active_view` assignment semantics.
- Preserve `layout_by_block_record[current_layout.block_record] = current_layout.name`.

### Out of scope
- Reset helpers
- `flush_current(...)`
- Zero-record dispatch
- Section/table name routing
- Header vars
- Table-record field handlers
- Layout object field handling
- Block header parsing
- Entity parsing
- Committer / plugin ABI
