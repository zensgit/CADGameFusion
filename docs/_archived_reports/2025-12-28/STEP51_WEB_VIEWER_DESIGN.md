# Step 51: Web Viewer Prototype - Design

## Goal
Provide a lightweight web viewer for glTF artifacts with basic selection and annotation, suitable for PLM preview workflows.

## Features
- Load a glTF URL and render with orbit controls.
- Scene summary (mesh/vertex/triangle counts).
- Click selection with highlight and inspection panel.
- Shift+click annotations with list management.
- Responsive layout for desktop + mobile.
- Import map for Three.js module resolution in the browser.

## Location
- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/app.js`
- `tools/web_viewer/README.md`

## Usage
```
cd tools/web_viewer
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

## Notes
- Default scene points at `sample_exports/scene_sample/mesh_group_0.gltf`.
- Viewer is a static prototype (no bundler, no backend), intended for integration into PLM later.
