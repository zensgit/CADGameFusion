# Step 105: Mesh Metadata Layer Info — Verification

## Build
- `cmake -S . -B build_vcpkg -DBUILD_EDITOR_QT=ON -DCMAKE_PREFIX_PATH=$HOME/Qt/6.9.2/macos`
- `cmake --build build_vcpkg --target convert_cli`
  - Warning (toolchain): deprecated `sprintf` in `stb_image_write.h` from TinyGLTF dependencies.

## Tests
- `ctest --test-dir build_vcpkg -R "convert_cli_" -V`
  - `convert_cli_build_smoke`: PASS
  - `convert_cli_smoke`: PASS
  - `convert_cli_dxf_style_smoke`: PASS
  - `convert_cli_mesh_metadata_smoke`: PASS

## Not Run
- Qt editor UI visual verification (optional; unchanged behavior expected).
