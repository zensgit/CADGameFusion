# Step 50: Headless Conversion CLI - Design

## Goal
Provide a headless conversion entry point for PLM-style pipelines: import a CAD file via plugin -> build `cadgf_document` -> export JSON/glTF artifacts.

## CLI Interface
```
convert_cli --plugin <path> --input <file> [--out <dir>] [--json] [--gltf]
```
- `--plugin`: importer plugin shared library.
- `--input`: input CAD/JSON file.
- `--out`: output directory (default `build/convert_out`).
- `--json`: emit `document.json` (sample exporter format).
- `--gltf`: emit `mesh.gltf` + `mesh.bin` (if TinyGLTF available).

If neither `--json` nor `--gltf` is provided, both are attempted.

## Export Behavior
- JSON output matches the sample exporter schema (`cadgf_version`, `layers`, `entities`, `polyline`).
- glTF export triangulates each polyline and combines them into a single mesh.
- When TinyGLTF is unavailable, glTF export is skipped with a warning.
- When glTF is emitted, a `mesh_metadata.json` sidecar captures per-entity vertex/index ranges.

## Files Added/Updated
- `tools/convert_cli.cpp`
- `tools/CMakeLists.txt`
- `cmake/RunConvertCli.cmake`
- `CMakeLists.txt`
