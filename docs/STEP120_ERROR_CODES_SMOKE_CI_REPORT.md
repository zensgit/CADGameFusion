# Step 120: Error Code Smoke in CI - Report

## Goal
Expose the error-code smoke script in the tools reference and run it in CI quick checks.

## Scope
- `docs/Tools.md`: add `plm_error_codes_smoke.sh` entry.
- `.github/workflows/quick-check.yml`: run the smoke script in the quick-check workflow.

## Summary
- Error-code smoke script is now documented and enforced by CI.
