# Step 53: Engine Metadata Mapping - Verification

## Manual Steps
1. Generate artifacts:
   ```bash
   ./build_vcpkg/tools/convert_cli --plugin ./build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
     --input tests/plugin_data/importer_sample.json --out build_vcpkg/convert_cli_smoke --gltf
   ```
2. Confirm `build_vcpkg/convert_cli_smoke/mesh_metadata.json` exists and includes entity ranges (and optional line style fields if set).
3. Unity: load glTF and parse metadata with `MetadataMapping.Load(...)`.
4. Godot: parse metadata JSON and verify the index ranges align with the mesh.

## Results
- `mesh_metadata.json` generated via `plm_convert.py` contains 1 entity slice; line style fields are present when set in the source.
- Engine-side selection/highlight still requires manual verification.
