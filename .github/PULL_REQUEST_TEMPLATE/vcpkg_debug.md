---
name: "CI: vcpkg cache N/A semantics & probe"
about: "Handle header-only as N/A; extend Daily CI fallbacks; add cache_probe to validate binary cache"
title: "ci(vcpkg): N/A for header-only; fallbacks; cache_probe"
labels: ["ci", "infra", "vcpkg", "docs"]
---

## Summary
When no cacheable ports are present (header-only), report vcpkg cache hit rate as N/A. Add multi-platform artifact fallbacks for Daily CI and an optional `cache_probe` to install zlib for one-off validation. Update README and reports index.

## Changes
- scripts/vcpkg_log_stats.sh
  - Add `cacheable` flag; `total_signals=0` => `cacheable=false`.
- daily-ci-status.yml
  - Show N/A when `cacheable=false`.
  - Try strict-exports artifacts for ubuntu/macos/windows, then fallback to build-tests artifacts (linux/macos/windows).
- core-strict-exports-validation.yml / core-strict-build-tests.yml
  - Add `cache_probe` workflow_dispatch input; when true, `vcpkg install zlib` to generate archives.
  - List archives after probe (build-tests) for visibility.
- README.md
  - Add "vcpkg Binary Cache Notes" and a "Reports" index.
- VCPKG_CACHE_FINALIZATION_SUMMARY_2025_09_22.md
  - Final summary document.

## Verification steps
1. Regular validation (recommended): run the two workflows twice (debug=false), then run Daily CI; expect N/A if header-only.
2. Cache probe (optional): run with `cache_probe=true`, then rerun; expect >0% hit rate.

## Risks / Rollback
- Low risk; `cache_probe` is off by default. Revert docs and fallbacks if undesired.

## Related reports
- `VCPKG_CACHE_FINALIZATION_SUMMARY_2025_09_22.md`
- `VCPKG_CACHE_ANALYSIS_AND_SOLUTIONS_2025_09_22.md`

## Checklist
- [ ] Daily CI shows N/A when appropriate
- [ ] Probe shows non-zero hit on second run
- [ ] Artifact names resolved by fallbacks