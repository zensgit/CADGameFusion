# Step 62: PLM Web Preview Loop - Design

## Goal
Close the loop from conversion artifacts to a browser preview using a manifest-driven glTF loader.

## Changes
- `tools/plm_preview.py`: conversion helper that prints the web viewer URL.
- `tools/web_viewer/app.js`: support `?manifest=` and `?gltf=` query params.
- `tools/web_viewer/README.md`: document preview usage.

## Usage
```bash
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview
cd /path/to/CADGameFusion
python3 -m http.server 8080
```
Then open the URL emitted by the script.

## Notes
- The viewer resolves `artifacts.mesh_gltf` from `manifest.json`.
- The viewer is static and served from the repo root.
