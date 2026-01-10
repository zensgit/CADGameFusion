# Step 107: Document Schema Versioning - Report

## Goal
Confirm the document schema versioning path is usable end-to-end in the PLM pipeline (migration + validation + manifest metadata).

## Scope
- `tools/convert_cli.cpp`: emits `document.json` with `schema_version` (base).
- `tools/document_migrate.py`: upgrades to target schema and injects `document_id` + `schema_migrated_at`.
- `tools/plm_convert.py`: runs migration/validation hooks and records `document_schema_version` in `manifest.json`.
- `tools/plm_router_service.py`: exposes migration/validation flags through `/convert`.
- `tools/plm_web_demo/`: toggles for migration/validation in the upload UI.

## Recommended Usage
- For PLM ingest, run conversion with migration + validation enabled:
  - `--migrate-document --document-target 2 --validate-document --document-schema schemas/document.schema.json`
- Persist the resulting `document.json` and `manifest.json` together; use `manifest.document_schema_version` for compatibility checks.

## Notes
- `document_id` becomes the stable identity for versioned documents; `schema_migrated_at` is the audit marker.
- Router/web demo already support these flags; the server can enforce defaults if desired.
