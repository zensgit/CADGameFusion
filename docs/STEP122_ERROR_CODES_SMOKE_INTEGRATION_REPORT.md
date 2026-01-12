# Step 122: Error Code Smoke Integration - Report

## Goal
Add an optional error-code verification pass to `plm_smoke.sh` and expand troubleshooting guidance.

## Scope
- `tools/plm_smoke.sh`: `VERIFY_ERRORS=1` triggers `tools/plm_error_codes_smoke.sh`.
- `docs/Tools.md`: document the new `VERIFY_ERRORS` toggle.
- `docs/Troubleshooting.md`: add a detailed error-code table.

## Summary
- Error-code smoke can now run as part of the standard PLM smoke script.
- Troubleshooting now includes a quick mapping from error codes to fixes.
