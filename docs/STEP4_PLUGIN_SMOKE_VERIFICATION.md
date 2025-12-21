# Step 4: Plugin Smoke Test Automation — Verification

## Commands Executed
1. `cmake --build build --target plugin_host_demo`
   - Reconfigured to include the new test target and rebuilt `core`, `core_c`, the sample plugin, and the host demo.
2. `ctest --test-dir build -R plugin_host_demo_smoke -V`
   - Runs the new test. Output snippet:
     ```
     [core] version=1.0.0 abi=1 features=[EARCUT=OFF, CLIPPER2=OFF]
     Loaded plugin: .../libcadgf_sample_plugin.dylib
       ABI: 1 (table size=64)
       Name: CADGameFusion Sample Plugin
       Version: 0.1.0
       Description: Sample exporter plugin implementing cadgf_plugin_api_v1
     Using exporter: Sample JSON Exporter (*.json)
     Wrote: .../plugin_host_output.json (459 bytes)
     ```
   - Confirms the smoke run succeeds end-to-end.
