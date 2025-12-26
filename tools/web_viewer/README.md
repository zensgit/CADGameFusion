# Web Viewer Prototype

## Run locally
```bash
cd /path/to/CADGameFusion
python3 -m http.server 8080
```

Then open:
```
http://localhost:8080/tools/web_viewer/
```

You can also pass query params to auto-load artifacts:
```
http://localhost:8080/tools/web_viewer/index.html?gltf=sample_exports/scene_sample/mesh_group_0.gltf
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json
```

## PLM preview loop
Generate artifacts with `tools/plm_preview.py`, then open the provided URL.
```
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview
```

## PLM router service
Run a local service that accepts uploads and returns a preview URL:
```
python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli
```
Then upload a file:
```
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" http://localhost:9000/convert
```
The JSON response includes `viewer_url` for the web preview.

Async upload with status polling:
```
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" -F "async=true" http://localhost:9000/convert
curl -s http://localhost:9000/status/<task_id>
```

## Notes
- Default glTF path points to `sample_exports/scene_sample/mesh_group_0.gltf`.
- Use the URL field to load artifacts produced by `convert_cli` (e.g., `build_vcpkg/convert_cli_smoke/mesh.gltf`).
- Shift + click adds a simple annotation marker.
- A basic PWA manifest + service worker are included for offline caching of the viewer UI (assets only).
- The viewer pulls Three.js modules from `https://unpkg.com` (network required for first load).
