# Maintainer Operations Guide

Purpose: quick, copy‑paste friendly steps for common maintainer tasks.

## Branch Protection
- Required status checks (exact names):
  - Core Strict - Build and Tests
  - Core Strict - Exports, Validation, Comparison
  - Simple Validation Test
  - (Optional) Core CI
  - (Optional) Quick Check - Verification + Lint
- Strict mode: start with strict=false; consider enabling later when stable.
- Backup current config: store JSON snapshot under `docs/branch_protection/`.

## CI Baseline Management
- Current anchor: `ci-baseline-2025-09-21`
- Create a new baseline:
  ```bash
  git tag -a ci-baseline-YYYY-MM-DD -m "CI baseline"
  git push origin ci-baseline-YYYY-MM-DD
  ```
- Reference baseline in Daily CI report for quick context.

## Workflows to Trigger Manually
- Core Strict - Exports, Validation, Comparison
  - Run twice with inputs: use_vcpkg=false / true (rtol default)
- Daily CI Status Report
  - Verifies streaks and recent runs; posts to Issue "Daily CI Status"

## Release Process (minor)
1) Ensure all strict gates are green on main
2) Update CHANGELOG and create `RELEASE_NOTES_vX.Y.Z_YYYY_MM_DD.md`
3) Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`
4) Create GitHub Release and paste release notes
5) Announce in Issue #64 (Daily CI Status) comment

## Triage Cheatsheet
- Fast local check: `bash tools/local_ci.sh --offline`
- Full local gate: `bash tools/local_ci.sh`
- Quick verification summary: `bash scripts/check_verification.sh --root build --verbose`
- Single scene regenerate:
  ```bash
  build/tools/export_cli --out build/exports --scene complex --gltf-holes full
  python3 tools/validate_export.py build/exports/scene_cli_complex --schema
  ```

## Windows CI Strategy
- Keep vcpkg minimal; enable retries and longpaths
- Monitor with Windows Nightly workflow and streak script
- If mirrors/regressions spike: temporarily loosen gates (continue‑on‑error), then restore

## Naming Stability
- If a workflow/job name changes, update Branch Protection required checks accordingly
- Keep names in `.github/workflows/*.yml` stable to avoid merge blocks

