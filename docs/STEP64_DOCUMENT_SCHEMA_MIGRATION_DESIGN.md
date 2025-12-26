# Step 64: Document Schema Migration - Design

## Goal
Provide a migration helper for `document.json` so older payloads can be normalized and upgraded.

## v2 policy
- `schema_version` 2 indicates a migrated document.
- `document_id` (UUID string) is added for stable indexing.
- `schema_migrated_at` is stamped with UTC time for auditability.

## Migration behavior
- If `schema_version` is missing, treat as v0 and backfill required fields.
- Normalize `feature_flags`, `metadata`, `settings`, `layers`, `entities`.
- Default layer flags (`printable`, `frozen`, `construction`) are added when missing.
- Missing layer entries are synthesized from entity `layer_id` usage.

## Files
- `tools/document_migrate.py`
- `schemas/document.schema.json`
- `docs/STEP64_DOCUMENT_SCHEMA_MIGRATION_DESIGN.md`
- `docs/STEP64_DOCUMENT_SCHEMA_MIGRATION_VERIFICATION.md`
