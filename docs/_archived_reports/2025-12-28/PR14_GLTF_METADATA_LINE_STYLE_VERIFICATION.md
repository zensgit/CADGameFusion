# PR-14 glTF Metadata Line Style Verification

## Scope
- Include line style fields in `mesh_metadata.json` when exporting glTF.

## Build
- `cmake --build build_vcpkg -j --target convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build_vcpkg/core:build_vcpkg/core_c:build_vcpkg/plugins:build_vcpkg/tools ./build_vcpkg/tools/convert_cli --plugin ./build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_sample.dxf --out /tmp/cadgf_gltf_meta_vcpkg2 --gltf`

## Results
- TinyGLTF available via vcpkg build.
- `/tmp/cadgf_gltf_meta_vcpkg2/mesh_metadata.json` includes `line_type`, `line_weight`, `line_type_scale` on the polyline slice.
