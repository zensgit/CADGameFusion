# Step 5: Export CLI Smoke Test — Design

## Goals
- Ensure the CLI export path is exercised by CTest to catch regressions in ABI checks, file emission, and output layout.
- Keep the test lightweight: run the CLI against the built-in `sample` scene and verify the JSON output exists and is non-empty.

## Changes
1. **CTest hook**
   - Added a new test `export_cli_sample_run` in the top-level `CMakeLists.txt` that invokes a helper script.
2. **CMake driver script**
   - Added `cmake/RunExportCli.cmake` to run `export_cli` with `--scene sample --out <dir>`.
   - Ensures runtime shared library discovery on all platforms (PATH/DYLD/LD adjustments).
   - Verifies that `group_0.json` exists and is non-empty.

## Rationale
- `export_cli` is part of the public tool surface; a smoke test protects the ABI gate, export path, and file output from accidental breakage.
- Using a CMake script avoids hardcoding OS-specific environment setup in CI workflows.
