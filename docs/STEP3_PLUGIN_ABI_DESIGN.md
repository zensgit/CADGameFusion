# Step 3: Plugin ABI Host Guidance — Design

## Goals
- Ensure plugin hosts validate both the C core ABI and the plugin ABI table before running third-party code.
- Document the loader contract (size checks, abi_version, initialization flow) so external integrators can build compatible hosts.
- Surface the runtime ABI/feature information in the reference `plugin_host_demo` CLI for easier debugging.

## Changes
1. **Plugin Host Demo (`tools/plugin_host_demo.cpp`)**
   - Added a startup gate identical to the CLI/Unity samples: the host now compares `cadgf_get_abi_version()` against `CADGF_ABI_VERSION`, logs the detected version/features, and aborts if mismatched.
   - After loading a plugin, the demo logs the plugin’s reported ABI version and table size so mismatches are obvious.
   - Explicitly includes `core/core_c_api.h` to make the dependency clear.
2. **Documentation (`docs/PLUGIN_ABI_C_V1.md`)**
   - Expanded section 8 (Loader design) with a detailed host flow that includes C ABI validation before any plugin is loaded.
   - Added a code snippet demonstrating the `api->size` / `abi_version` checks using `cadgf_plugin_api_v1_min` as the minimum contract.
   - Cross-referenced the real loader implementation (`tools/plugin_registry.hpp`) and CLI demo for future readers.

## Future Work
- Add automated plugin smoke tests once a sample plugin binary is part of CI artifacts.
- Extend docs with importer examples once those APIs are wired into host tools.
