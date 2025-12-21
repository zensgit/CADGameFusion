# Step 6: Plugin Registry Hardening + Authoring Guide — Design

## Goals
- Fail fast when plugins return malformed exporter/importer tables (null pointers, undersized structs, negative counts).
- Make it easier for third-party authors to implement plugins correctly via a concise checklist and build snippet.

## Changes
1. **PluginRegistry validation** (`tools/plugin_registry.hpp`)
   - Added validation for exporter/importer counts (must be non-negative).
   - Added per-entry validation for exporter/importer tables (size check + required function pointers).
   - Errors are now more specific (include index and failure reason) and cleanup is performed via `shutdown()` when validation fails after `initialize()`.
2. **Authoring guidance** (`docs/PLUGIN_ABI_C_V1.md`)
   - Added a quick-start checklist (shared library, export symbol, static strings, C API only).
   - Included a CMake snippet that matches how sample plugins are built in this repo.

## Rationale
- Invalid plugin tables are undefined behavior for hosts; validating them early prevents crashes later.
- Authors routinely copy/paste example code; a checklist reduces avoidable mistakes (missing function pointers, returning non-static strings).
