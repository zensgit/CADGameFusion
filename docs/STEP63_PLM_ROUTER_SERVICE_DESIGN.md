# Step 63: PLM Router Service - Design

## Goal
Provide a minimal HTTP service that accepts file uploads, runs conversion, and returns a preview URL.

## Endpoints
- `GET /health`: returns `{ "status": "ok" }`.
- `POST /convert`: multipart form-data upload.

### POST /convert fields
- `file`: uploaded CAD/JSON file (required).
- `plugin`: importer plugin path (optional if `--default-plugin` is set).
- `emit`: comma-separated outputs (`json,gltf,meta`).
- `hash_names`: `true/false` (optional).
- `keep_legacy_names`: `true/false` (optional).
- `convert_cli`: override convert_cli path (optional).

## Output
- Artifacts stored under `build_vcpkg/plm_service_runs/<timestamp>/output/`.
- Response returns `manifest`, `viewer_url`, `artifact_urls`.

## Files
- `tools/plm_router_service.py`
- `tools/web_viewer/README.md`
