## DXF B3g: Table Record Fields Extraction

### Goal
Extract the table-record field handling inside `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_table_records.h`
- Add `plugins/dxf_table_records.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract these three branches:
- `if (in_layer_table && in_layer_record) { ... }`
- `if (in_style_table && in_style_record) { ... }`
- `if (in_vport_table && in_vport_record) { ... }`

### Required invariants
- Preserve `parse_style_code(...)` handling for layer records exactly.
- Preserve `sanitize_utf8(..., header_codepage)` handling for layer/style/vport names.
- Preserve layer flag decoding for `frozen`, `locked`, and `printable`.
- Preserve style height parsing and `has_height` semantics.
- Preserve vport center/view-height/aspect parsing and `has_*` flag semantics.
- Preserve record-consumption behavior: handled table-record lines must still `continue`.

### Out of scope
- Zero-record dispatch
- Section/table name routing
- Header vars
- Layout objects
- Block header parsing
- Entity parsing
- Committer / plugin ABI
