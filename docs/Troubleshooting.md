# Troubleshooting

Common build/run issues and fixes.

## CMake not found
- Symptom: `bash: cmake: command not found`
- Fix: install CMake or use the app binary path
  - macOS: `brew install cmake` or `/Applications/CMake.app/Contents/bin/cmake`
  - Windows: `winget install Kitware.CMake`
  - Linux: `sudo apt-get install cmake`
- Scripts accept `CMAKE_BIN` env to point to cmake: `CMAKE_BIN=/Applications/CMake.app/Contents/bin/cmake ./scripts/build_core.sh`

## vcpkg ports not found
- Symptom: `... ports/earcut: error: earcut does not exist`
- Cause: wrong port name
- Fix: use `earcut-hpp` (header-only) and `clipper2`. Already set in `vcpkg.json`.
- Tip: `./vcpkg/vcpkg search earcut` to confirm names.

## Generator mismatch / missing build tool
- Symptom: `Does not match the generator used previously: Unix Makefiles` or `CMAKE_MAKE_PROGRAM not set`
- Fix: remove build cache: `rm -rf build` and reconfigure
- Scripts pick a generator automatically:
  - Prefer Ninja if available (`brew install ninja`)
  - Else Xcode on macOS; MSVC on Windows

## Qt not detected
- Symptom: `find_package(Qt6 ...)` fails
- Fix: provide the Qt CMake prefix path:
  - `./scripts/build_editor.sh /Applications/Qt/6.x/macos`
  - or set `-DCMAKE_PREFIX_PATH=/path/to/Qt/6.x/<platform>`
- The script also auto-detects common locations (`/Applications/Qt`, `~/Qt`).

## Clipper2/earcut not active
- Symptom: Boolean/Offset/Triangulate return empty or fallback
- Fix: build with vcpkg toolchain and manifest mode:
  - `-DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake -DVCPKG_MANIFEST_MODE=ON`
- CMake defines `USE_CLIPPER2` and/or `USE_EARCUT` when headers/libs are found.

## JSON spec parsing fails
- Symptom: `--spec` errors out or CI fails at "Check vendored nlohmann/json header (hard check)".
- Causes:
  - `tools/third_party/json.hpp` is missing or not the official nlohmann/json single-header.
  - The build was configured without `-DCADGF_USE_NLOHMANN_JSON=ON`.
- Fix:
  - Download the official header from https://github.com/nlohmann/json (single_include/nlohmann/json.hpp) and place it at `tools/third_party/json.hpp`.
  - Reconfigure with `-DCADGF_USE_NLOHMANN_JSON=ON`.
  - Rerun the strict exports workflow (Ubuntu) or your local build.

## Field-level comparison fails
- Symptom: CI fails during field-level (numeric) comparison.
- Notes:
  - Critical scenes (sample/holes/complex/spec/concave/nested_holes) use full-mode coordinate + meta checks with tolerance (default rtol=1e-6).
  - `units`/`multi` use counts-only + meta; glTF presence mismatches are allowed.
- Fix:
  - If minor float discrepancies are expected, rerun workflow with a higher tolerance (e.g., `rtol=1e-5` via workflow_dispatch input).
  - Ensure sample_exports are up-to-date and not modified locally.
  - Verify export_cli uses the same unit scale and meta configuration.
  - Since glTF holes now default to `full`, ensure goldens are refreshed with `--gltf-holes full` (run `tools/refresh_golden_samples.sh`).
  - Locally, use `tools/local_ci.sh --gltf-holes full` to reproduce strict workflow behavior.

## Unity cannot load core_c
- Symptom: DllNotFoundException / plugin not found
- Fix:
  - Place the library under `Assets/Plugins/<Platform>/` with correct name:
    - Windows: `core_c.dll`
    - macOS: `libcore_c.dylib`
    - Linux: `libcore_c.so`
  - Architecture must match the Unity Editor/Player (x86_64 vs arm64).
  - On macOS Gatekeeper may block unsigned dylibs; allow from Security & Privacy or codesign locally for distribution.

## Symbol not found or ABI mismatch
- Ensure `CoreBindings.cs` uses `CallingConvention.Cdecl` and correct struct layout.
- Keep `core_c` and `CoreBindings.cs` versions in sync; consider adding a `core_get_version()` API.

## Selection feels hard
- Adjust hit threshold (pixels) in `editor/qt/src/canvas.cpp` (default 12 px).
- Cosmetic pens are enabled; line width stays constant across zoom.

## Clean rebuild
- `rm -rf build` then re-run scripts.

## Logs
- vcpkg manifest log: `build/vcpkg-manifest-install.log`
- CMake configure log: `build/CMakeFiles/CMakeConfigureLog.yaml`

## Windows CI flaky due to vcpkg/msys2 mirrors
- Symptom: Windows strict build fails with 404 (e.g., `pkgconf` tarball) or transient download errors.
- Cause: Upstream mirror outages or CDN issues.
- Current policy: Non‑blocking Windows for strict build/tests until stability is observed. After ≥3 consecutive green nightly runs, consider flipping strict CI to blocking for Windows.
- Mitigations in repo:
  - Retry logic (5 attempts, exponential backoff) for vcpkg bootstrap/checkout on Windows.
  - Nightly monitor workflow: "Windows Nightly - Strict Build Monitor" runs daily and uploads logs.
  - Watchdog workflow raises Issues automatically when nightly fails.
  - Toggleable gate in `.github/workflows/core-strict-build-tests.yml`:
    - Set `WINDOWS_CONTINUE_ON_ERROR: 'false'` to enforce blocking once mirrors are stable for several days.
- Recommendation: Flip the toggle after ≥3 consecutive green nightly runs and no mirror warnings.
