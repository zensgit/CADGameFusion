# CI/CD Ops Checklist — vcpkg Cache Optimization (v0.3)

This checklist streamlines the end-to-end ops for pushing branches, opening PRs, warming up CI, validating Daily CI, and creating a release.

Prereqs
- GitHub CLI: `gh auth login`
- jq installed (for scripts that parse JSON)

1) Push branches and open PRs
- Push branches:
  - `git push origin fix/vcpkg-ninja-generator`
  - `git push origin test/vcpkg-cache-debug`
- Open PRs using templates:
  - `.github/PULL_REQUEST_TEMPLATE/vcpkg_fix.md`
  - `.github/PULL_REQUEST_TEMPLATE/vcpkg_debug.md`
- Optional: use drafts in `.github/PR_DRAFTS/` to fill descriptions

2) Warm-up and Daily CI (one-liners)
- Two rounds warm-up + Daily CI:
  - `bash scripts/ci_quick_ops.sh run-all --repeat 2`
  - View status: `bash scripts/ci_quick_ops.sh status`
- Expected: Daily CI shows vcpkg = N/A (header-only) with cache stats attached

3) Optional cache pipeline proof
- Run once with probe, then re-run to observe >0% hit:
  - `bash scripts/ci_quick_ops.sh run-exports --cache-probe`
  - `bash scripts/ci_quick_ops.sh run-exports`
- Turn probe off for normal runs (default)

4) Close tracking issue
- Paste summary from: `.github/PR_DRAFTS/issue_close_comment_vcpkg_cache.txt`

5) Create Release v0.3.0
- Using helper script:
  - `bash scripts/release_create.sh v0.3.0 --notes-file RELEASE_NOTES_v0.3.0_2025_09_23.md`
- Or manual gh command:
  - `gh release create v0.3.0 --title "v0.3.0 — CI vcpkg cache optimization" --notes-file RELEASE_NOTES_v0.3.0_2025_09_23.md`

6) Troubleshooting quick tips
- gh/jq missing: install and run `gh auth login`
- Daily CI cannot find artifacts: the workflow tries multiple names (Ubuntu/macOS/Windows). Check run’s artifacts list printed in the log.
- vcpkg shows 0%: header-only = expected; N/A is now reported. Use `--cache-probe` for one-off verification.

7) Rollback
- Revert the workflow/script commits that introduced the changes:
  - `.github/workflows/*core-strict*`, `daily-ci-status.yml`
  - `scripts/vcpkg_log_stats.sh`, `scripts/ci_quick_ops.sh`
  - `README.md` notes and report indexes

References
- Final summary: `VCPKG_CACHE_FINALIZATION_SUMMARY_2025_09_22.md`
- Final report: `VCPKG_OPTIMIZATION_FINAL_REPORT_2025_09_22.md`
- Status report: `VCPKG_PROJECT_STATUS_REPORT_2025_09_22.md`

