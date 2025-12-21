# Step 5: Export CLI Smoke Test — Verification

## Commands Executed
1. `cmake --build build --target export_cli --clean-first`
   - Rebuilt the CLI after adding the test driver.
2. `ctest --test-dir build -R export_cli_sample_run -V`
   - Ran the new smoke test and confirmed the output JSON exists and is non-empty.

## Output
- `export_cli` wrote: `build/exports_cli_smoke/scene_cli_sample/group_0.json` (504 bytes)

## Result
- PASS
