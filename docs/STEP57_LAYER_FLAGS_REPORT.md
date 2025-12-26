# Step 57: Layer Flags - Report

## Goal
Extend layer state with printable/frozen/construction flags and expose them across core, C API, and project serialization.

## Changes
- `core/include/core/document.hpp`, `core/src/document.cpp`: add layer flags and setters.
- `core/include/core/core_c_api.h`, `core/src/core_c_api.cpp`: introduce `cadgf_layer_info_v2` plus layer flag setters.
- `editor/qt/src/project/project.cpp`: persist layer flags in project JSON load/save.
- `tools/convert_cli.cpp`: export layer flags (prefers v2, falls back to legacy info).

## Notes
- `cadgf_document_get_layer_info_v2` keeps legacy `cadgf_layer_info` intact while adding new flags.
