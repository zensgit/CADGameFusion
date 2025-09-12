# Build From Source

This guide covers building the repo on macOS/Windows/Linux.

## Prerequisites
- Git, CMake (3.16+), C++17 compiler
- vcpkg (scripts/bootstrap_vcpkg.sh will clone & bootstrap into repo)
- Qt 6 (for the Qt editor)
- Optional: Ninja for faster multi-config builds

## Quick scripts
```bash
./scripts/bootstrap_vcpkg.sh
export VCPKG_ROOT="$(pwd)/vcpkg"
# Core
./scripts/build_core.sh
# Editor (auto-detects Qt; pass path if needed)
./scripts/build_editor.sh /Applications/Qt/6.x/macos
```

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
- `build/bin/editor_qt` — Qt editor app

## Troubleshooting
- See `docs/Troubleshooting.md`

