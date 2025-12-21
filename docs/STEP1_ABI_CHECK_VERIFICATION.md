# Step 1: ABI Self-Check Rollout — Verification

## Commands Executed
1. `cmake --build build --target export_cli --clean-first`
   - Rebuilt `core`, `core_c`, and `export_cli` to pick up the ABI gate + logging changes.
2. `./build/tools/export_cli --scene sample --output build/exports_cli_step1_new`
   - Observed new startup diagnostic line:
     ` [INFO] CADGF core version=1.0.0 abi=1 features=[EARCUT=OFF, CLIPPER2=OFF]`
   - CLI continued to export the sample scene successfully (still warning about missing TinyGLTF as expected).

## Not Covered (manual verification needed later)
- Unity `WatchAndReload` ABI log — requires running the Unity sample scene, which is outside this environment.
