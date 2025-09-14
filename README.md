# CADGameFusion

Mono-repo skeleton for a shared Core (C++), a Qt desktop editor, and a Unity adapter using a C API.

## CI Status

- Core CI (lenient):
  - ![Core CI](https://github.com/zensgit/CADGameFusion/actions/workflows/cadgamefusion-core.yml/badge.svg)
- Core CI (strict deps):
  - ![Core CI (strict)](https://github.com/zensgit/CADGameFusion/actions/workflows/cadgamefusion-core-strict.yml/badge.svg)

CI tracks:
- Lenient: builds without vcpkg; features are optional (stubs used if deps are missing). Fast and stable smoke tests across platforms.
- Strict: uses vcpkg baseline to enable earcut/clipper2 and runs strict assertions and export validation on Ubuntu/macOS/Windows.

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
 - CI Validation Reports (examples):
   - `CI_FINAL_TEST_REPORT.md`
   - `EXPORT_VALIDATION_TEST_REPORT.md`

## Sample Exports and Validation
- Sample scenes are provided under `sample_exports/`:
  - `scene_sample`: minimal rectangle (JSON + glTF)
  - `scene_holes`: outer + hole (JSON carries hole semantics)
  - `scene_multi_groups`: multiple groups (group_0..2)
  - `scene_units`: large unit scale example (unitScale=1000.0)
- Validate a scene locally:
  - `python3 CADGameFusion/tools/validate_export.py CADGameFusion/sample_exports/scene_sample`
- CI (strict) automatically validates all `sample_exports/scene_*` directories on all platforms.

### Using Export CLI

The export CLI tool generates test scenes in JSON + glTF + binary formats for validation and testing.

#### Building the Tool
```bash
# Build from repository root
cmake -S . -B build -DBUILD_EDITOR_QT=OFF
cmake --build build --target export_cli

# Location of built executable:
# - Linux/macOS: build/tools/export_cli
# - Windows: build/tools/Release/export_cli.exe
```

#### Generating Five Scene Types

1. **Sample** - Basic rectangle (4 vertices, 1 ring)
   ```bash
   build/tools/export_cli --out build/exports --scene sample
   ```

2. **Holes** - Rectangle with hole (8 vertices, 2 rings)
   ```bash
   build/tools/export_cli --out build/exports --scene holes
   ```

3. **Multi** - Three groups with different join types (Miter/Round/Bevel)
   ```bash
   build/tools/export_cli --out build/exports --scene multi
   ```

4. **Units** - Scaled rectangle (1000x unit scale)
   ```bash
   build/tools/export_cli --out build/exports --scene units
   ```

5. **Complex** - L-shaped polygon with 2 holes (14 vertices, 3 rings)
   ```bash
   build/tools/export_cli --out build/exports --scene complex
   ```

#### Local Validation
```bash
# Validate a single scene
python3 tools/validate_export.py build/exports/scene_cli_sample

# Validate all generated scenes
for scene in build/exports/scene_cli_*; do
  echo "Validating $(basename $scene)..."
  python3 tools/validate_export.py "$scene"
done

# Compare with sample exports for structure consistency
python3 tools/compare_export_to_sample.py \
  build/exports/scene_cli_sample \
  sample_exports/scene_sample
```

#### Copying from Spec Directory
```bash
# Copy existing scene files from a spec directory
build/tools/export_cli --out build/exports \
  --spec-dir sample_exports/scene_complex

# Validate the copied scene
python3 tools/validate_export.py build/exports/scene_cli_spec
```

#### Command Options
- `--out <dir>` : Output directory (default: build/exports)
- `--scene <name>` : Scene type: sample|holes|multi|units|complex
- `--unit <scale>` : Unit scale factor (default: 1.0)
- `--spec-dir <dir>` : Copy scenes from specified directory
