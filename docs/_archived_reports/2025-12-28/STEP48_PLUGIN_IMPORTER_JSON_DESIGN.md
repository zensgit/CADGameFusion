# Step 48: JSON Importer Plugin - Design

## Goal
Provide a reference importer plugin that can load the JSON format emitted by the sample exporter, proving the full plugin import pipeline works end-to-end.

## Decisions
- Add a new plugin `cadgf_json_importer_plugin` implementing `cadgf_importer_api_v1`.
- Parse the sample exporter JSON (`layers`, `entities`, `polyline`) using the vendored `nlohmann::json` header.
- Add importer discovery helpers to `PluginRegistry` (list importers + resolve by extension).
- Add a CLI demo `plugin_import_demo` and CTest entry to validate import success.

## Import Format (Supported)
```json
{
  "layers": [
    {"id": 0, "name": "Default", "color": 16711680, "visible": 1, "locked": 0}
  ],
  "entities": [
    {"id": 1, "type": 0, "layer_id": 0, "name": "square", "polyline": [[0,0],[1,0]]}
  ]
}
```

## Implementation Notes
- Layer 0 maps to the existing default layer; only color/visibility/lock are updated (name cannot be changed via C API).
- Non-zero layers are created via `cadgf_document_add_layer` and mapped by source ID.
- Polyline entities accept both `[x,y]` arrays and `{x,y}` objects.

## Files Updated
- `plugins/json_importer_plugin.cpp`
- `plugins/CMakeLists.txt`
- `tools/plugin_import_demo.cpp`
- `tools/plugin_registry.hpp`
- `tools/CMakeLists.txt`
- `cmake/RunPluginImportDemo.cmake`
- `tests/plugin_data/importer_sample.json`
- `CMakeLists.txt`
