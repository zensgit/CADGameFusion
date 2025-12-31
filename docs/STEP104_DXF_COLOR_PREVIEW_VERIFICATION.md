# Step 104: DXF Color Metadata in Qt + Web Preview — Verification

## Build
- `cmake --build build_vcpkg --target convert_cli`
  - Warning (toolchain): deprecated `sprintf` in `stb_image_write.h` from TinyGLTF dependencies.
- `cmake -S . -B build_vcpkg -DBUILD_EDITOR_QT=ON -DCMAKE_PREFIX_PATH=$HOME/Qt/6.9.2/macos`
- `cmake --build build_vcpkg --target test_qt_canvas_color_metadata`

## Tests
- `ctest --test-dir build_vcpkg -R "convert_cli_" -V`
  - `convert_cli_build_smoke`: PASS
  - `convert_cli_smoke`: PASS
  - `convert_cli_dxf_style_smoke`: PASS
- `ctest --test-dir build_vcpkg -R qt_canvas_color_metadata_run -V`: PASS

## Preview Artifacts (PLM)
- `python3 tools/plm_preview.py --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_entities.dxf --out build_vcpkg/plm_preview --emit json,gltf,meta`
- `build_vcpkg/plm_preview/manifest.json` contains `document_json`, `mesh_gltf`, `mesh_bin`, `mesh_metadata`.
- `build_vcpkg/plm_preview/document.json` includes per-entity `color`, `color_source`, `color_aci`.
- `build_vcpkg/plm_preview/mesh_metadata.json` contains triangulated polyline slice entries (1 entry for the sample DXF).
- Preview URL (manual): `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_preview/manifest.json`

## Web Viewer Manual Check
- Served `tools/web_viewer` via `python3 -m http.server 8080`.
- Loaded the preview URL and waited for status `Loaded successfully.`.
- Clicked the mesh at canvas center; selection panel showed:
  - `Entity ID: 1`, `Layer ID: 4`
  - `Color Source: BYLAYER`, `Color ACI: 4`
  - `Resolved Color: #00ffff`

## Qt Editor Launch Smoke
- `QT_QPA_PLATFORM=offscreen build_vcpkg/editor/qt/editor_qt` (launched for 2s, terminated cleanly).

## Not Run
- Qt editor UI verification (no Qt runtime check in this pass).
  - Prepared sample project for manual check: `build_vcpkg/plm_preview/preview.cgf` (open in editor_qt and verify BYLAYER/BYBLOCK/TRUECOLOR rendering).
