## DXF B3l: Ellipse Entity Parser Extraction

### Goal
Extract the `DxfEntityKind::Ellipse` parsing branch from `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_ellipse_entity_parser.h`
- Add `plugins/dxf_ellipse_entity_parser.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract the `DxfEntityKind::Ellipse` branch.

### Required invariants
- Preserve `parse_entity_space(...)` passthrough behavior.
- Preserve `parse_entity_owner(...)` passthrough behavior.
- Preserve `parse_style_code(...)` passthrough behavior.
- Preserve exact layer parsing via `sanitize_utf8(value_line, header_codepage)`.
- Preserve exact field-to-group-code mapping:
  - `10/20` center
  - `11/21` major axis
  - `40` ratio
  - `41/42` start/end param
- Preserve all `has_*` flag semantics and timing.
- Preserve the main parser's `break`/`continue` behavior via thin wrapper calls only.

### Out of scope
- Polyline / Line / Point / Circle / Arc
- Spline / Text / Solid / Hatch / Insert / Viewport
- `flush_current(...)`
- Zero-record dispatch
- Name routing / header vars / layout objects / block headers / table records
- Finalizers
- Committer / plugin ABI
