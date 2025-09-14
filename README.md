# CADGameFusion

Mono-repo skeleton for a shared Core (C++), a Qt desktop editor, and a Unity adapter using a C API.

## Quick Start (with scripts)
- Prerequisites: Git, CMake, C++17 compiler. For Qt editor, install Qt 6.
- Bootstrap vcpkg and build:
```bash
# from repo root
./scripts/bootstrap_vcpkg.sh
export VCPKG_ROOT="$(pwd)/vcpkg"

# Build Core only (exports core_c for Unity)
./scripts/build_core.sh

# Build Qt editor (replace with your Qt 6 CMake prefix path or rely on auto-detect)
./scripts/build_editor.sh /path/to/Qt/6.x/<platform>
```
- Artifacts:
  - Core C API: `build/bin/core_c.*`
  - Qt editor: `build/bin/editor_qt`

## Layout
- `core/` — C++ library implementing minimal 2D geometry, document, command stack, and a C API in `core_c` for interop.
- `editor/qt/` — Qt Widgets-based minimal editor app calling the Core C API.
- `adapters/unity/` — C# P/Invoke bindings to call the C API from Unity.
- `docs/` — Purpose, plan, and editor usage docs.

## Build (with optional vcpkg)
The project supports optional dependencies (earcut, clipper2) via vcpkg:
```bash
# Optional: Setup vcpkg for enhanced features
git clone https://github.com/microsoft/vcpkg.git
./vcpkg/bootstrap-vcpkg.sh # or .bat on Windows
export VCPKG_ROOT=$(pwd)/vcpkg

# Build with automatic dependency detection
cmake -S CADGameFusion -B build \
  -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
  -DVCPKG_MANIFEST_MODE=ON -DBUILD_EDITOR_QT=ON
cmake --build build --config Release
```

Note: The project will build without vcpkg, using stub implementations for advanced features.

## Unity Integration (Runtime P/Invoke)
- Copy `build/bin/<platform>/core_c` shared library into `YourUnityProject/Assets/Plugins/<Platform>`.
- Copy `CADGameFusion/adapters/unity/CoreBindings.cs` into your Unity project.
- Example call:
```csharp
var docPtr = CADGameFusion.UnityAdapter.CoreBindings.core_document_create();
var pts = new CADGameFusion.UnityAdapter.CoreBindings.Vec2[]{ new(){x=0,y=0}, new(){x=1,y=0}, new(){x=1,y=1}, new(){x=0,y=0} };
CADGameFusion.UnityAdapter.CoreBindings.core_document_add_polyline(docPtr, pts, pts.Length);
CADGameFusion.UnityAdapter.CoreBindings.core_document_destroy(docPtr);
```

## Documentation
- Purpose & Plan: `docs/Purpose-and-Plan.md`
- Editor Usage & Shortcuts: `docs/Editor-Usage.md`
- API Reference: `docs/API.md`
- Roadmap: `docs/Roadmap.md`
- Unity Integration Guide: `docs/Unity-Guide.md`
- Build From Source: `docs/Build-From-Source.md`
- Troubleshooting: `docs/Troubleshooting.md`
- Contributing: `docs/Contributing.md`
