# CADGameFusion

Mono-repo skeleton for a shared Core (C++), a Qt desktop editor, and a Unity adapter using a C API.

## CI Status

- Core CI (lenient):
  - ![Core CI](https://github.com/zensgit/CADGameFusion/actions/workflows/cadgamefusion-core.yml/badge.svg)
- Core Strict - Build and Tests:
  - ![Core Strict - Build and Tests](https://github.com/zensgit/CADGameFusion/actions/workflows/core-strict-build-tests.yml/badge.svg)
- Core Strict - Exports, Validation, Comparison:
  - ![Core Strict - Exports, Validation, Comparison](https://github.com/zensgit/CADGameFusion/actions/workflows/strict-exports.yml/badge.svg)
- Windows Nightly - Strict Build Monitor (non-blocking):
  - ![Windows Nightly - Strict Build Monitor](https://github.com/zensgit/CADGameFusion/actions/workflows/windows-nightly.yml/badge.svg)
  - Policy: keep non-blocking until ≥3 consecutive green runs, then consider enabling blocking on strict CI.
  - Watchdog: failures auto-open Issues (labels: ci, windows, triage).

## Maintenance
- Refresh golden samples (concave, nested_holes): run the workflow
  "Maintenance - Refresh Golden Samples" from the Actions tab.
  - It builds `export_cli` (with official nlohmann/json), runs
    `tools/refresh_golden_samples.sh`, validates results with
    `tools/validate_export.py --schema`, and uploads updated samples
    as artifacts.
  - Optional input `rtol` (default `1e-6`) controls numeric tolerance for
    the validation statistics step.
  - You can also run locally: `bash tools/refresh_golden_samples.sh` and then
    `python3 tools/validate_export.py sample_exports/scene_concave --schema`.

- Trial ring-sorting normalization (optional): run
  "Trial - Strict Exports (Sort Rings)". This builds export_cli with
  `-DCADGF_SORT_RINGS=ON` and uploads generated scenes as artifacts so you can
  review diffs without changing main CI gates. If you adopt this normalization,
  refresh goldens first via the maintenance workflow, then enable the flag in
  the main strict exports workflow configure step.

- Windows nightly strict build monitor (non-blocking):
  - Workflow: "Windows Nightly - Strict Build Monitor"
  - Runs daily on windows-latest to monitor vcpkg/mirror health, builds strict targets, runs meta.normalize test, and uploads logs.
  - Purpose: decouple transient Windows mirror issues from PR gates while maintaining visibility and fast recovery path.

### Strict Exports workflow modes (vcpkg toggle)
- Default mode (use_vcpkg=false): Ninja + system toolchain, skips vcpkg cache/setup for faster runs.
- Full mode (use_vcpkg=true): Uses vcpkg toolchain + binary cache for full dependency validation.
- How to use: Actions → Core Strict - Exports, Validation, Comparison → Run workflow → set `use_vcpkg` as needed.

CI tracks:
- Lenient: builds without vcpkg; features are optional (stubs used if deps are missing). Fast and stable smoke tests across platforms.
- Strict: uses vcpkg baseline to enable earcut/clipper2 and runs strict assertions and export validation on Ubuntu/macOS/Windows.

## Strict CI Quick Guide
Purpose: reproduce the same gates as the "Core Strict - Exports, Validation, Comparison" workflow locally before opening / updating a PR.

### Export Validation Flow
```
Local Development → Local CI → Quick Check → Push → Remote CI
      ↓              ↓            ↓          ↓         ↓
   Code Changes → Full Export → Verify → Git Push → GitHub Actions
                 + Validation   Results
```

Run locally (full topology holes):
```bash
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```

Optional post-check (fast gate after local_ci run):
```bash
bash scripts/check_verification.sh --root build
```

Dev environment sanity check:
```bash
bash scripts/dev_env_verify.sh
```

Run meta.normalize unit test locally:
```bash
# Configure & build tests (Release)
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF -G Ninja
cmake --build build --target test_meta_normalize -j

# Execute (platform-specific path)
# Linux/macOS:
build/tests/tools/test_meta_normalize
# Windows:
build/tests/tools/Release/test_meta_normalize.exe
```

### Verification Script Features
The `scripts/check_verification.sh` script provides:
- ✅ **Field Status Check**: Ensures all `field_*.json` files show `"status": "passed"`
- ✅ **Scene Coverage**: Verifies all 8 expected scenes are present in consistency stats
- ✅ **Structural Validation**: Basic JSON integrity check (NaN detection)
- ✅ **Clear Exit Codes**: Different codes for different failure types (1=missing files, 2=field failures, 3=stats anomalies, 4=structure issues)

```bash
# Basic check
bash scripts/check_verification.sh --root build

# Verbose output with details
bash scripts/check_verification.sh --root build --verbose
```

### Pre-Push Hook Setup
Automatically run verification before each push:
```bash
cp scripts/hooks/pre-push.sample .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Key outputs:
- Exported scenes: `build/exports/scene_cli_*`
- Field reports: `build/field_*.json` (each should contain `"status": "passed"`)
- Consistency stats: `build/consistency_stats.txt` (counts must match sample_exports baseline)
- Normalization tests: Python + C++ (both must pass)

Pass criteria (all must be true):
- 8 scenes generated (sample, holes, multi, units, complex, complex_spec, concave_spec, nested_holes_spec)
- No schema errors (`validate_export.py --schema` internally)
- No structure mismatches
- All `field_*.json` show numeric comparisons within rtol=1e-6
- Normalization (orientation + start vertex + optional sort) OK

Common quick checks:
```bash
grep -H "\"status\"" build/field_*.json | grep -v passed || echo OK
grep -E "scene_cli_.*" build/consistency_stats.txt
```

### Failure Triage Matrix
| **Failure Type** | **Symptoms** | **Script/Command** |
|------------------|--------------|-------------------|
| **Field failures** | `field_*.json` shows `"status": "failed"` | `python3 tools/compare_fields.py build/exports/scene_cli_X sample_exports/scene_X --rtol 1e-6` |
| **Structure failures** | Shape/topology mismatch | `python3 tools/compare_export_to_sample.py build/exports/scene_cli_X sample_exports/scene_X` |
| **Normalization failures** | Orientation/start vertex errors | `python3 tools/test_normalization.py build/exports` or `build/tests/tools/test_normalization_cpp` |
| **Schema failures** | JSON validation errors | `python3 tools/validate_export.py build/exports/scene_cli_X --schema` |

If a failure occurs:
- Re-run a single scene: `build/tools/export_cli --out build/exports --scene complex --gltf-holes full`
- Validate schema: `python3 tools/validate_export.py build/exports/scene_cli_complex --schema`
- Field diff example: `python3 tools/compare_fields.py build/exports/scene_cli_complex sample_exports/scene_complex --rtol 1e-6`

Refresh golden samples only when intentional exporter output changes are introduced:
```bash
bash tools/refresh_golden_samples.sh
```
Then re-run strict CI locally and via GitHub Actions; tag a new baseline (`ci-baseline-YYYY-MM-DD`).

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
  - Exporter v0.3.0 Roadmap: `docs/exporter/roadmap_v0_3_0.md`
- Unity Integration Guide: `docs/Unity-Guide.md`
- Build From Source: `docs/Build-From-Source.md`
- Troubleshooting: `docs/Troubleshooting.md`
- Contributing: `docs/Contributing.md`
- CI Validation Reports (examples):
  - `CI_FINAL_TEST_REPORT.md`
  - `EXPORT_VALIDATION_TEST_REPORT.md`

### Verification Reports
- Post‑merge verification (ZH): `verification_report.md`
- Post‑merge verification (EN): `verification_report_en.md`

## Sample Exports and Validation
- Sample scenes are provided under `sample_exports/`:
- `scene_sample`: minimal rectangle (JSON + glTF)
- `scene_holes`: outer + hole (JSON carries hole semantics; glTF now uses full topology by default)
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

# Field-level numeric comparison (strict, with tolerance)
python3 tools/compare_fields.py \
  build/exports/scene_cli_complex \
  sample_exports/scene_complex --rtol 1e-6
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
- `--spec <file>` : Read JSON spec and generate scene(s)
- `--gltf-holes <outer|full>` : Control glTF vertices for holes; default is `full`

#### Generating from a JSON Spec
```bash
# Use provided complex scene spec
build/tools/export_cli --out build/exports \
  --spec CADGameFusion/tools/specs/scene_complex_spec.json

# Validate
python3 tools/validate_export.py build/exports/scene_cli_scene_complex_spec
```
# Adjusting strict validation tolerance
You can run the "Core Strict - Exports, Validation, Comparison" workflow with a custom rtol via workflow_dispatch input (default 1e-6). This sets FIELD_COMPARE_RTOL for field-level numeric comparisons.
# JSON spec parsing (official header)
- To enable the full JSON parser for `--spec`, place the official single-header from nlohmann/json into `tools/third_party/json.hpp` and configure with `-DCADGF_USE_NLOHMANN_JSON=ON`.
- The CI (strict-exports workflow) includes a hard check for the header's version macros; if not present, the workflow fails with guidance to vendor the official header.

### CI Gates (Strict Exports)
- Structure-level comparison: sample, holes, complex, spec-complex, concave, nested_holes must match the golden samples exactly.
- Field-level comparison (numeric):
  - Full mode (coordinates + meta): sample, holes, complex, spec-complex, concave, nested_holes
  - Counts-only + meta: units, multi (glTF presence mismatches allowed)
- Tolerance: default rtol=1e-6; can be adjusted via workflow_dispatch input when needed.

## Contributing / PR Checklist
- Run local CI before opening a PR:
  - `bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- Ensure normalization checks (Python + C++) pass; schema validation (docs/schemas) passes.
- Verify structure and field-level comparisons for critical scenes (sample/holes/complex/spec/concave/nested_holes).
- Refresh golden samples if outputs changed:
  - `bash tools/refresh_golden_samples.sh` then commit `sample_exports/`.
- Use `--gltf-holes full` by default; justify deviations.
- For `--spec`, ensure vendored `tools/third_party/json.hpp` is the official nlohmann/json and build with `-DCADGF_USE_NLOHMANN_JSON=ON`.
- See `.github/pull_request_template.md` for the full checklist and links.
