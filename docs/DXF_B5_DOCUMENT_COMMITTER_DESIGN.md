## DXF B5: Document Committer Prelude And Layer Context

### Goal
Extract the document-committer prelude from `importer_import_document(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_document_commit_context.h`
- Add `plugins/dxf_document_commit_context.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract the prelude/context block that currently:
- filters paper-space viewports
- resolves the default paper layout name
- counts entities by space
- computes `include_all_spaces`, `target_space`, and `default_space`
- writes document-level DXF metadata:
  - viewport list metadata
  - default text height
  - hatch stats
  - text stats
  - import stats / unsupported types
  - active view metadata
- initializes the document layer table and layer-id map
- returns the commit-time context needed by later top-level entity emission

### Required invariants
- Preserve exact `default_space` selection behavior.
- Preserve exact `default_paper_layout_name` resolution behavior.
- Preserve exact `include_all_spaces` / `target_space` semantics.
- Preserve exact metadata keys, value formatting, and omission rules for all `dxf.*` document meta writes.
- Preserve deterministic sorting of `dxf.import.unsupported_types`.
- Preserve layer bootstrap behavior for `"0"` and `""`.
- Preserve layer metadata application behavior:
  - visible
  - locked
  - frozen
  - printable
  - color
- Preserve fallback color `0xFFFFFFu` when dynamically adding a missing layer.
- Preserve later caller behavior by keeping `importer_import_document(...)` as a thin orchestration wrapper.

### Out of scope
- Top-level entity emission loops
- Text-height resolution helpers for entity text emission
- Dimension text generation
- Block recursion / `emit_block`
- Insert expansion / source bundle metadata
- Parser extraction
- Plugin ABI
