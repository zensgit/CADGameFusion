## DXF B3j: Simple Geometry Entity Parsers Extraction

### Goal
Extract the simplest geometry entity parsing branches from `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_simple_geometry_entities.h`
- Add `plugins/dxf_simple_geometry_entities.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract these `switch (current_kind)` branches:
- `DxfEntityKind::Line`
- `DxfEntityKind::Point`
- `DxfEntityKind::Circle`
- `DxfEntityKind::Arc`

### Required invariants
- Preserve `parse_entity_space(...)` passthrough behavior.
- Preserve `parse_entity_owner(...)` passthrough behavior.
- Preserve `parse_style_code(...)` passthrough behavior.
- Preserve exact layer parsing via `sanitize_utf8(value_line, header_codepage)`.
- Preserve exact field-to-group-code mapping:
  - `Line`: `10/20/11/21`
  - `Point`: `10/20`
  - `Circle`: `10/20/40`
  - `Arc`: `10/20/40/50/51`
- Preserve all `has_*` flag semantics and timing.
- Preserve the main parser's `break`/`continue` behavior via thin wrapper calls only.

### Out of scope
- `DxfEntityKind::Polyline`
- `DxfEntityKind::Ellipse`
- `DxfEntityKind::Spline`
- `DxfEntityKind::Text`
- `DxfEntityKind::Solid`
- `DxfEntityKind::Hatch`
- `DxfEntityKind::Insert`
- `DxfEntityKind::Viewport`
- `flush_current(...)`
- Zero-record dispatch
- Name routing / header vars / layout objects / block headers / table records
- Finalizers
- Committer / plugin ABI
