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

## CAD editor mode (AutoCAD-like 2D workspace)
Open:
```
http://localhost:8080/tools/web_viewer/?mode=editor
```

Open a CADGF `document.json` directly:
```
http://localhost:8080/tools/web_viewer/?mode=editor&cadgf=build/cad_regression/<run_id>/previews/<case>/document.json
```

Highlights:
- Workspace layout: top command bar, left tools, right property/layer panels, bottom status bar, center canvas
- Drawing tools: `Line`, `Polyline`, `Circle`, `Arc`, `Text`
- Modify tools: `Select`, `Move`, `Copy`, `Offset`, `Rotate`, `Break`, `Trim`, `Extend`, `Delete`
- Grips (Select tool):
  - drag endpoints/vertices/centers/text position
  - polyline midpoint grip inserts a new vertex (then drag)
  - double-click polyline vertex grip deletes a vertex
  - arc radius grip at mid-angle
  - grip hover highlight (primary entity)
- Drafting aids: `Ortho`, `Object Snap` (endpoint/midpoint/quadrant/center/intersection/tangent/nearest), `Grid`, `Undo/Redo`
- Snap panel: per-snap toggles + `gridSize` / `snapRadiusPx`
- JSON adapter:
  - import/export editor document snapshots (`vemcad-web-2d-v1`)
  - import/export CADGF `document.json` (aligns with `schemas/document.schema.json`, used by `plm_preview`)

Command input examples:
```
line
copy
offset 5
rotate
break
join
ze
undo
redo
tan
nea
quad
grid
ortho
text NOTE_A
exportcadgf
```

## Editor round-trip smoke (import -> edit -> export -> plm_convert)
From repo root:
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
```
Optional gate mode:
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
Artifacts are written under `build/editor_roundtrip/<run_id>/`.

You can also pass query params to auto-load artifacts:
```
http://localhost:8080/tools/web_viewer/index.html?gltf=sample_exports/scene_sample/mesh_group_0.gltf
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json&project_id=demo&document_label=sample&document_id=ZGVtbwpzYW1wbGU
```
Document metadata fields (`project_id`, `document_label`, `document_id`) are optional, but if provided they appear in the Document panel.
If the manifest also contains these fields, the viewer falls back to them when the URL omits query parameters.

## PLM preview loop
Generate artifacts with `tools/plm_preview.py`, then open the provided URL.
```
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview
```
To include document metadata in the preview URL:
```
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview --project-id demo --document-label sample
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

CLI helper for the same flow:
```
python3 tools/plm_router_smoke.py \
  --input tests/plugin_data/importer_sample.dxf \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --emit json,gltf,meta
```

Async upload with status polling:
```
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" -F "async=true" http://localhost:9000/convert
curl -s http://localhost:9000/status/<task_id>
```

## Notes
- Default glTF path points to `sample_exports/scene_sample/mesh_group_0.gltf`.
- Use the URL field to load artifacts produced by `convert_cli` (e.g., `build_vcpkg/convert_cli_smoke/mesh.gltf`).
- When a manifest provides `document_json` and `mesh_metadata`, the viewer applies per-entity colors and shows DXF color metadata on selection.
- Layer list is populated from document.json (preferred) or mesh_metadata when available.
- Shift + click adds a simple annotation marker.
- A basic PWA manifest + service worker are included for offline caching of the viewer UI (assets only).
- The viewer pulls Three.js modules from `https://unpkg.com` (network required for first load).
