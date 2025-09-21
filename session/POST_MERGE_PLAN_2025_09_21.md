## Post‑Merge Plan — 2025-09-21

Scope: PR #68 (offline/local validation flags)

1) Merge PR #68 into main (squash or merge)
2) Trigger remote CI on main
   - Core Strict - Exports, Validation, Comparison (use_vcpkg=false/true)
   - Daily CI Status Report
3) If all green
   - Consider setting Strict Exports as a required check
   - Close PR #68 and link reports
4) Documentation bump
   - Add CHANGELOG.md to release checklist
   - Publish Release Notes v0.2.2
5) Monitoring
   - Track Windows nightly and report any regressions in Issue #64

Notes
- All flags are opt‑in; defaults remain unchanged
- Rollback: revert PR or avoid using flags
