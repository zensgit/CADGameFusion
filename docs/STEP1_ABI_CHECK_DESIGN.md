# Step 1: ABI Self-Check Rollout — Design

## Goals
- Make every host/consumer of `core_c` validate ABI level before continuing.
- Provide documentation so external integrators know the bootstrap checklist.
- Surface ABI/feature information in existing tooling (export CLI + Unity sample watcher).

## Changes
1. **Documentation**
   - `docs/API_STABILITY.md`: Added a "Host Integration Checklist" describing ABI/version/feature checks and fallback behavior.
   - `docs/API.md`: Included a bootstrap snippet that demonstrates how to compare `cadgf_get_abi_version()`/`CADGF_ABI_VERSION`, log `cadgf_get_version()`, and inspect feature flags.
2. **Tooling (export_cli)**
   - At startup, `export_cli` now compares the runtime ABI to `CADGF_ABI_VERSION` and aborts with a clear error if they do not match.
   - Logs the detected version and feature set for diagnostics before exporting scenes.
3. **Unity Sample Watcher**
   - Added a shared ABI version constant in `CoreBindings` and pulled it into `WatchAndReload`.
   - `WatchAndReload` now logs (and highlights mismatches) once on `Start()`, so users immediately see compatibility issues when running the Unity scene.

## Out of Scope
- Plugin ABI host demo updates (planned later).
- Mandatory checks in every Unity helper script (Triangulate/Offset) — they rely on the global log for now.
