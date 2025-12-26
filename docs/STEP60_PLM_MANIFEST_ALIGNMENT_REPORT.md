# Step 60: PLM Manifest Alignment - Report

## Goal
Align PLM manifest metadata with the versioned `document.json` schema.

## Changes
- `tools/plm_convert.py`: read `schema_version` from `document.json` and emit `document_schema_version` in `manifest.json`.
- `schemas/plm_manifest.schema.json`: allow `document_schema_version` (integer >= 1).
- `docs/PLM_CONVERSION_VERIFICATION_CHECKLIST.md`: checklist updated to include `document_schema_version`.

## Notes
- `schema_version` for the manifest remains `1` to avoid breaking existing consumers; the new field is additive.
