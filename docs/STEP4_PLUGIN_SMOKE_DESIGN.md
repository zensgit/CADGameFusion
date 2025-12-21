# Step 4: Plugin Smoke Test Automation — Design

## Goals
- Automatically exercise the sample plugin via `plugin_host_demo` inside CI to catch ABI/loader regressions.
- Ensure the smoke test is part of CTest so a single `ctest` run validates the entire plugin pipeline (build plugin → load → export file).

## Changes
1. **`tools/plugin_host_demo.cpp`** already logs ABI/version info and requires matching core ABI (from Step 3). No code changes were needed beyond the earlier update.
2. **`tools/CMakeLists.txt`** now:
   - Adds an explicit dependency from `plugin_host_demo` to the sample plugin target so the plugin is always built before the host runs.
   - Registers a new CTest entry `plugin_host_demo_smoke` that runs the host demo directly with the built plugin and writes an artifact under `build/test_artifacts/`.
   - Populates the appropriate runtime library path (`PATH`, `DYLD_LIBRARY_PATH`, or `LD_LIBRARY_PATH`) so the plugin and `core_c` shared libraries can be resolved without installing.

## Rationale
- Previously, only a scripted CMake test existed; this new native test makes the smoke scenario visible in `ctest -R plugin_host_demo_smoke` and acts as an extra guard when running subsets locally.
- The test log shows the ABI/version banner, plugin metadata, and confirms the output file was written.
