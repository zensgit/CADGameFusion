# PR-15 glTF Metadata Line Style CTest Verification

## Scope
- Add a TinyGLTF-guarded CTest that validates line style fields in `mesh_metadata.json`.

## Configure
- `cmake -S . -B build_vcpkg`

## Test
- `ctest --test-dir build_vcpkg -R gltf_metadata_line_style_smoke -V`

## Results
- `gltf_metadata_line_style_smoke`: Passed (line style fields present in metadata).
