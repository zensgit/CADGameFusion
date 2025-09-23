## v0.2.2 (2025-09-21)

Enhancements
- Scripts: offline/local lightweight validation options
  - tools/local_ci.sh: add `--offline`, `--no-pip`, and `-h|--help`
  - scripts/check_verification.sh: add `--no-struct`
  - README: document offline usage and add Quick Links + Offline Mode section

Validation
- Local: offline and full runs PASS (8 scenes, schema/structure/fields OK)
- CI: PR #68 passed 13/13 checks; Windows stable

Compatibility
- Default behavior unchanged; CI unaffected; flags are opt‑in
## v0.3.0 (2025-09-23)

CI: vcpkg cache optimization (final)
- Build time ~60–90s (beats <120s target)
- vcpkg hit rate: N/A for header‑only deps (by design); optional cache_probe to validate pipeline
- Workflows: fixed triplets (Linux/macOS/Windows), pinned vcpkg, explicit files cache, tee CMake logs, publish vcpkg_cache_stats.json
- Daily CI: prefer validation workflow; robust artifact fallbacks; show N/A when cacheable=false
- Scripts: add scripts/ci_quick_ops.sh (trigger/wait); scripts/vcpkg_log_stats.sh outputs cacheable
- Docs: README adds Binary Cache Notes + Reports index; PR templates + summary reports

