---
name: "CI: vcpkg cache setup & stats"
about: "Explicit vcpkg binary cache (files backend), fixed triplets, pin vcpkg; tee logs + stats artifact"
title: "ci(vcpkg): explicit binary cache, fixed triplets, pin vcpkg; tee logs + stats"
labels: ["ci", "infra", "vcpkg"]
---

## Summary
Explicitly enable vcpkg files-based binary cache with stable paths, fix target triplets per-OS, pin vcpkg commit, and add build log tee + cache stats artifacts for Daily CI visibility.

## Changes
- core-strict-exports-validation.yml
  - Configure `VCPKG_DEFAULT_BINARY_CACHE`, `VCPKG_BINARY_SOURCES=clear;files,<archives>,readwrite;default`, `VCPKG_DEFAULT_TRIPLET=x64-linux`.
  - Pin vcpkg to `c9fa965c2a1b1334469b4539063f3ce95383653c` and bootstrap.
  - Tee CMake logs to `build/_cmake_configure.log`, `build/_cmake_build.log`.
  - Generate `build/vcpkg_cache_stats.json` and copy `vcpkg_cache_stats.json`.
  - Upload `strict-exports-reports-ubuntu-latest` (logs + stats).
- core-strict-build-tests.yml
  - Configure per-OS archives path and `VCPKG_BINARY_SOURCES`.
  - Set `VCPKG_DEFAULT_TRIPLET` to `x64-linux`/`x64-osx`/`x64-windows` and pass `-DVCPKG_TARGET_TRIPLET`.
  - Tee logs and upload per-OS stats artifact.

## Rationale
Stabilize ABI hash inputs and ensure the binary cache is used consistently. Provide observability (logs + stats) for Daily CI and debugging.

## Verification steps
1. Run twice (at least Ubuntu):
   - Core Strict – Exports, Validation, Comparison (debug=false)
   - Core Strict – Build and Tests (debug=false)
2. Run Daily CI Status and confirm it reads stats and renders the vcpkg section.

## Risks / Rollback
- Low risk; rollback by reverting workflow changes.

## Related reports
- `VCPKG_CACHE_TEST_SUMMARY_2025_09_22.md`
- `VCPKG_CACHE_FIX_FINAL_REPORT_2025_09_22.md`

## Checklist
- [ ] CI green across matrices
- [ ] Daily CI shows stats section with valid JSON
- [ ] Artifact names match Daily CI fallbacks