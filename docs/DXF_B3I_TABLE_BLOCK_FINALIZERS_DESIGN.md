## DXF B3i: Table And Block Finalizers Extraction

### Goal
Extract the table/block finalizers from `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_table_block_finalizers.h`
- Add `plugins/dxf_table_block_finalizers.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract these lambdas:
- `finalize_layer(...)`
- `finalize_text_style(...)`
- `finalize_block(...)`

### Required invariants
- Preserve the layer-name gate before insertion into `layers`.
- Preserve the `layer.style.hidden => layer.visible = false` side effect.
- Preserve `layers[layer.name] = layer` assignment semantics.
- Preserve the text-style name gate and `text_styles[style.name] = style`.
- Preserve the block-name gate and `blocks[block.name] = block`.
- Preserve all zero-record call sites via thin wrappers only; do not change reset timing.

### Out of scope
- View/layout finalizers
- Reset helpers
- `flush_current(...)`
- Zero-record dispatch
- Name routing / header vars / table-record handlers
- Layout-object parsing
- Block-header parsing
- Entity parsing
- Committer / plugin ABI
