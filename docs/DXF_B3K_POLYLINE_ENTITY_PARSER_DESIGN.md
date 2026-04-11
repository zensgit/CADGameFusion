## DXF B3k: Polyline Entity Parser Extraction

### Goal
Extract the `DxfEntityKind::Polyline` parsing branch from `parse_dxf_entities(...)` into a dedicated helper module without changing behavior.

### Scope
- Add `plugins/dxf_polyline_entity_parser.h`
- Add `plugins/dxf_polyline_entity_parser.cpp`
- Update `plugins/dxf_importer_plugin.cpp`
- Update `plugins/CMakeLists.txt`

### Allowed extraction
Only extract the `DxfEntityKind::Polyline` branch.

### Required invariants
- Preserve `parse_entity_space(...)` passthrough behavior.
- Preserve `parse_entity_owner(...)` passthrough behavior.
- Preserve `parse_style_code(...)` passthrough behavior.
- Preserve exact layer parsing via `sanitize_utf8(value_line, header_codepage)`.
- Preserve the `70` closed-flag parsing semantics.
- Preserve `10/20` point accumulation semantics, including `pending_x` / `has_x` timing.
- Preserve `current_polyline.points.push_back(...)` ordering exactly.
- Preserve the main parser's `break`/`continue` behavior via thin wrapper calls only.

### Out of scope
- Line / Point / Circle / Arc branches
- Ellipse / Spline / Text / Solid / Hatch / Insert / Viewport
- `flush_current(...)`
- Zero-record dispatch
- Name routing / header vars / layout objects / block headers / table records
- Finalizers
- Committer / plugin ABI
