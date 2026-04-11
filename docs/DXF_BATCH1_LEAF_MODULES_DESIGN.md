# DXF Batch 1 Leaf Modules

## Scope

Extract the first low-risk DXF importer leaf modules from `plugins/dxf_importer_plugin.cpp`:

- `dxf_types.h`
- `dxf_text_encoding.h/.cpp`
- `dxf_color.h/.cpp`
- `dxf_math_utils.h/.cpp`

Update `plugins/CMakeLists.txt` to compile the new `.cpp` files.

## Non-Goals

- No parser extraction
- No document committer extraction
- No plugin ABI changes
- No plugin-shell slimming beyond removing moved code from `dxf_importer_plugin.cpp`

## Invariants

- `cadgf_plugin_get_api_v1()` behavior stays unchanged
- Existing DXF importer behavior stays unchanged
- Private helpers remain private where practical; this step does not blindly remove `static`
- No new dependency cycles among extracted leaf modules

## Expected Result

`dxf_importer_plugin.cpp` becomes smaller, while encoding/color/math code is moved into self-contained leaf modules that can be reused by later DXF phases.
