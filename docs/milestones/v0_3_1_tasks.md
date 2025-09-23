# v0.3.1 — Engine‑first Tasks Checklist (Draft)

P0 — Consolidation & Robustness
- [ ] Strict exports: consolidate on `core-strict-exports-validation.yml`; keep legacy with deprecation banner; evaluate removal after 2 weeks
- [ ] Daily CI: add 7‑day trend row (use `scripts/ci_trend_summary.sh`); keep artifact fallbacks in sync and list missing artifacts on failure
- [ ] Windows Nightly: upload versions — `vcpkg version`, `cmake --version`, compiler (`cl`/`clang`/`gcc`)

P1 — Engine‑first scaffolding
- [ ] C API v1 spec review (`docs/api/C_API_v1_spec.md`); align with current `core/include/core/core_c_api.h`
- [ ] Add minimal C API usage examples (C/C++): create/draw polygon/offset/export
- [ ] Unity adapter: ensure CoreBindings.cs matches C API surface; add a smoke test scene

P2 — Optional improvements
- [ ] SOP: retire `strict-exports.yml` (if validation workflow stable)
- [ ] Consider sccache pilot on Windows Nightly (separate workflow, non-blocking)
- [ ] Only if compiled deps added: evaluate NuGet binary cache or container baseline

