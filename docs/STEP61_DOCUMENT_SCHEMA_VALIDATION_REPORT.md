# Step 61: Document JSON Schema Validation - Report

## Goal
Define a versioned JSON schema for `document.json` and validate it during PLM manifest checks.

## Changes
- `schemas/document.schema.json`: formal schema for `document.json` v1.
- `tools/validate_plm_manifest.py`: add `--check-document` and validate `document.json` when hash checks run.
- `docs/PLM_CONVERSION_VERIFICATION_CHECKLIST.md`: updated to include document schema validation.

## Notes
- Validation is performed when `--check-hashes` is used and `schemas/document.schema.json` exists.
