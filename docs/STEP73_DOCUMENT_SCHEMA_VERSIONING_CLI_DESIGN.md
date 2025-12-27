# Step 73: Document Schema Versioning + Migration CLI - Design

## Goal
Ensure PLM conversions can normalize `document.json` to a target schema version via a dedicated migration step.

## CLI changes
- `tools/plm_convert.py` adds:
  - `--migrate-document` to run `tools/document_migrate.py` after conversion.
  - `--document-target` to select target schema version (default: 2).
  - `--document-backup` to write a `.bak` when migrating in place.

## Router changes
- `POST /convert` accepts optional fields:
  - `migrate_document=true`
  - `document_target=<int>`
  - `document_backup=true`

## Behavior
- Migration runs only when JSON output is enabled.
- Conversion fails if migration is requested and `document.json` is missing.
- Manifest `document_schema_version` is sourced from the migrated document.

## Files
- `tools/plm_convert.py`
- `tools/plm_router_service.py`
- `tools/document_migrate.py`
- `docs/STEP73_DOCUMENT_SCHEMA_VERSIONING_CLI_DESIGN.md`
- `docs/STEP73_DOCUMENT_SCHEMA_VERSIONING_CLI_VERIFICATION.md`
