# Step 106: PLM Preview Closed Loop - Report

## Goal
Confirm and document the minimal PLM preview loop: upload -> convert -> web preview.

## Scope
- Use the router service to accept uploads and emit a viewer URL.
- Use the preview helper to generate artifacts and a viewer URL.
- Document the exact commands and expected artifacts for local use.

## Components
- `tools/plm_router_service.py`: HTTP service for upload/convert, returns `viewer_url`.
- `tools/plm_convert.py`: CLI wrapper around `convert_cli` to produce artifacts + manifest.
- `tools/plm_preview.py`: local helper for generate + viewer URL output.
- `tools/web_viewer/`: static viewer for `manifest.json` or glTF.
- `tools/plm_web_demo/`: minimal upload UI that opens the preview URL.

## Minimal Flow
1. Build `convert_cli` + importer plugin (`libcadgf_json_importer_plugin.dylib`).
2. Start router service (serves static repo files + API endpoints).
3. Upload a file to `POST /convert` (via `plm_web_demo` or curl).
4. Open the returned `viewer_url` to load the preview.

## Notes
- Router outputs live under `build_vcpkg/plm_service_runs/<timestamp>/`.
- Preview helper outputs under a caller-defined folder (ex: `build_vcpkg/plm_preview_step106/`).
- Viewer resolves `manifest.json` to find `mesh.gltf` and metadata.
