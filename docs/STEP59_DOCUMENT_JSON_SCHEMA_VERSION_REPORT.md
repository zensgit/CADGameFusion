# Step 59: Document JSON Schema Version - Report

## Goal
Version the `document.json` output so downstream tools can make deterministic compatibility decisions.

## Changes
- `tools/convert_cli.cpp`: emit top-level `schema_version` (currently `1`) in `document.json`.

## Notes
- The schema version is independent from `cadgf_version` and can advance without changing the core semantic version.
