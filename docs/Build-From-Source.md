# Build From Source

This guide covers building the repo on macOS/Windows/Linux.

## Prerequisites
- Git, CMake (3.16+), C++17 compiler
- vcpkg (scripts/bootstrap_vcpkg.sh will clone & bootstrap into repo)
- Qt 6 (only needed for the legacy `editor/qt` build in this repo)
- Optional: Ninja for faster multi-config builds

## Quick scripts
```bash
./scripts/bootstrap_vcpkg.sh
export VCPKG_ROOT="$(pwd)/vcpkg"
# Core
./scripts/build_core.sh
# Legacy editor (auto-detects Qt; pass path if needed)
./scripts/build_editor.sh /Applications/Qt/6.x/macos
```

Note: the standalone Qt app now lives in https://github.com/zensgit/cadgf-app-qt.

## Manual CMake
```bash
# Configure with vcpkg toolchain and manifest
cmake -S CADGameFusion -B build \
  -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
  -DVCPKG_MANIFEST_MODE=ON -DBUILD_EDITOR_QT=ON
cmake --build build --config Release
```

## Generators
- Ninja Multi-Config (preferred if installed)
- macOS: Xcode
- Windows: Visual Studio (MSVC)
- Linux: Ninja/Unix Makefiles

## Output
- `build/bin/core_c.*` — C API (Unity adapter)
- `build/bin/editor_qt` — legacy Qt editor app

## Validate Exports Locally
- 验证一个场景目录：
  ```bash
  python3 tools/validate_export.py sample_exports/scene_sample
  ```
- 可选启用 JSON Schema 校验（需安装 jsonschema）：
  ```bash
  # Install jsonschema (optional)
  pip3 install jsonschema
  
  # Run validation with schema
  python3 tools/validate_export.py sample_exports/scene_sample --schema
  ```
- 验证所有样例场景：
  ```bash
  for scene in sample_exports/scene_*; do
    python3 tools/validate_export.py "$scene" --schema
  done
  ```

## Export CLI
- 构建：
  ```bash
  cmake -S . -B build -DBUILD_EDITOR_QT=OFF
  cmake --build build --target export_cli
  ```
- 用法（包含 JSON 规范输入）：
  ```bash
  # Generate predefined scenes
  build/tools/export_cli --out build/exports --scene sample
  build/tools/export_cli --out build/exports --scene holes
  build/tools/export_cli --out build/exports --scene complex
  
  # Generate from JSON spec (supports both formats)
  # Format 1: flat_pts + ring_counts
  build/tools/export_cli --out build/exports --spec tools/specs/scene_complex_spec.json
  
  # Format 2: rings structure
  build/tools/export_cli --out build/exports --spec tools/specs/scene_rings_spec.json
  
  # Validate generated exports
  python3 tools/validate_export.py build/exports/scene_cli_complex --schema
  python3 tools/validate_export.py build/exports/scene_cli_scene_complex_spec --schema
  ```

## Troubleshooting
- See `docs/Troubleshooting.md`
