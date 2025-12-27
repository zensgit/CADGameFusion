# Step 74: Document Schema Validation CLI - Design

## Goal
Gate PLM conversions with an optional document.json schema validation step.

## CLI changes
- `tools/plm_convert.py` adds:
  - `--validate-document` to validate `document.json` after conversion/migration.
  - `--document-schema` to override the schema path (default `schemas/document.schema.json`).

## Router changes
- `POST /convert` accepts optional fields:
  - `validate_document=true`
  - `document_schema=<path>` (restricted to repo root)

## Behavior
- Validation runs only when JSON output is enabled.
- If validation is requested and document.json is missing or invalid, conversion fails.
- Validation uses `jsonschema` (required when `--validate-document` is used).

## Files
- `tools/plm_convert.py`
- `tools/plm_router_service.py`
- `docs/STEP74_DOCUMENT_SCHEMA_VALIDATION_CLI_DESIGN.md`
- `docs/STEP74_DOCUMENT_SCHEMA_VALIDATION_CLI_VERIFICATION.md`
