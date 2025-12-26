# Step 56: Document Metadata - Report

## Goal
Add document-level metadata (label, author, company, comment, timestamps, unit name, free-form meta map) to core Document, C API, and project serialization.

## Changes
- `core/include/core/document.hpp`: add `DocumentMetadata`, metadata accessors, and change events.
- `core/src/document.cpp`: implement metadata setters and reset defaults on clear.
- `core/include/core/core_c_api.h`, `core/src/core_c_api.cpp`: expose metadata getters/setters and meta map enumeration.
- `editor/qt/src/project/project.cpp`: persist metadata in project JSON load/save.
- `tools/convert_cli.cpp`: emit metadata in document JSON and glTF extras.

## Notes
- `DocumentChangeType::DocumentMetaChanged` and `SettingsChanged` are emitted from metadata/unit setters.
- C API supports enumerating metadata key/value pairs via count/key_at/value.
