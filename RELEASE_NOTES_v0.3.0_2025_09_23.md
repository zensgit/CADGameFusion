## Release Notes — v0.3.0 (2025-09-23)

CI vcpkg cache optimization (final)

Highlights
- Build time ~60–90s (beats <120s target)
- vcpkg hit rate: N/A for header‑only deps (by design)
- Unified logs + cache stats artifacts; multi‑platform fallbacks
- Optional cache_probe (off by default) to validate cache pipeline (zlib)

Key changes
- Workflows: fixed triplets (Linux/macOS/Windows), pinned vcpkg, explicit files cache, tee CMake logs, publish vcpkg_cache_stats.json
- Daily CI: prefer the new validation workflow; fall back across platform artifacts; show N/A when cacheable=false
- Scripts: add scripts/ci_quick_ops.sh (trigger/wait); scripts/vcpkg_log_stats.sh outputs `cacheable`
- Docs: README adds Binary Cache Notes + Reports index; PR templates and summary reports added

Usage & validation
- Warm-up: `bash scripts/ci_quick_ops.sh run-all --repeat 2`
- Pipeline proof (optional): `bash scripts/ci_quick_ops.sh run-exports --cache-probe`, then rerun `run-exports`

Known behavior
- Header‑only deps don’t produce binary archives → N/A hit rate; builds already within target
- Re‑evaluate NuGet/container/self‑hosted runners if compiled deps are introduced later

References
- `VCPKG_CACHE_FINALIZATION_SUMMARY_2025_09_22.md`
- `VCPKG_OPTIMIZATION_FINAL_REPORT_2025_09_22.md`
- `VCPKG_PROJECT_STATUS_REPORT_2025_09_22.md`
