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

## Preview provenance smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js
```
The script now starts a temporary static server automatically and prints:
- `run_id=...`
- `run_dir=...`
- `summary_json=...`

You can still target an existing server with:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js --base-url http://127.0.0.1:8080/
```

You can also point it at an explicit case set:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases tools/web_viewer/tests/fixtures/preview_provenance_failure_cases.json
```

This checks three preview contract paths:
- `line-only` exploded insert provenance via `build/step186_origin_blocks/manifest.json&mesh=0`
- `document-only` dimension provenance via `build/step186_origin_dimension/manifest.json`
- `line-only` hatch provenance via `build/step186_origin_hatch/manifest.json&mesh=0`

Artifacts are written under `build/preview_provenance_smoke/<run_id>/`.

CI integration:
- `tools/editor_gate.sh` now runs preview provenance smoke in gate mode by default
- `tools/editor_gate.sh` also runs a preview provenance failure-injection case set against:
  - missing `document_json`
  - invalid manifest JSON
  - invalid `mesh_metadata` JSON
- `tools/editor_gate.sh` also runs preview artifact validator failure injection against:
  - invalid `mesh_metadata` JSON
  - provenance mismatch between `document.json` and `mesh_metadata.json`
  - layout/viewport metadata mismatch
  - `summary.spaces[*]` count mismatch
  - duplicate layout names / multiple default layouts
  - `source_type` semantic mismatch for `INSERT` / `DIMENSION` / `HATCH`
  - `color_source` semantic mismatch for `INDEX` / `TRUECOLOR` / `BYLAYER`
  - style-precedence drift for `line_type` / `line_weight` / `line_type_scale`
- `tools/local_ci.sh` exposes:
  - `RUN_PREVIEW_PROVENANCE_SMOKE=1`
  - `RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1`

Artifact-validator red-path runner:
```bash
python3 tools/validate_plm_preview_artifacts_failure_injection.py
```
This consumes:
- `tools/web_viewer/tests/fixtures/preview_artifact_validator_failure_cases.json`

Positive real-artifact smoke runner:
```bash
python3 tools/validate_plm_preview_artifacts_smoke.py
```
This consumes:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases.json`

Current positive case set covers:
- `build/step186_origin_blocks`
- `build/step186_origin_dimension/manifest.json`
- `build/step186_origin_hatch`
- `build/step186_text_kinds/manifest.json`
- `build/step186_mleader/manifest.json`
- `build/step186_table/manifest.json`
- `build/step186_leader`
- `build/step186_origin_mixed`
- `build/step186_multi_layout`
- `build/step186_paperspace_insert_styles`
- `build/step186_viewport_sample`

Optional legacy-only case set:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`
- `build/plm_preview_j0225034_layoutfix_meta`

`build/step186_origin_mixed` is generated from:
- `tests/plugin_data/step186_mixed_origin_sample.dxf`

`build/step186_multi_layout` is generated from:
- `tests/plugin_data/step186_multi_layout_sample.dxf`

`build/step186_text_kinds` is generated from:
- `tests/plugin_data/step186_text_kinds_sample.dxf`

It is intended to keep one real converter artifact that spans:
- exploded `INSERT` provenance
- proxy `DIMENSION` provenance on both text and geometry
- proxy `HATCH` provenance
- paper-layout viewport metadata

Default preview smoke no longer depends on pre-existing large legacy artifacts.
`tools/prepare_step186_preview_artifacts.py` regenerates the default eleven Step186 artifacts from local DXF fixtures, and both `tools/local_ci.sh` and `tools/editor_gate.sh` run that prep stage automatically before preview smoke.

`tools/editor_weekly_validation.sh` keeps the larger legacy preview set on a separate weekly-only lane:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`
- `build/plm_preview_j0225034_layoutfix_meta`

That weekly-only lane now runs in two stages:
- `tools/prepare_legacy_preview_artifacts.py` regenerates each target directory from its existing `manifest.json` (`input` / `plugin` / `outputs`);
- `tools/validate_plm_preview_artifacts_smoke.py` then validates the refreshed legacy directories under the same strict Step186 rules as current artifacts.

`tools/local_ci.sh` now defaults all preview smoke/failure-injection outdirs under `build/`, so an empty environment variable no longer causes summaries to spill into the repo root.

You can also pass query params to auto-load artifacts:
```
http://localhost:8080/tools/web_viewer/index.html?gltf=sample_exports/scene_sample/mesh_group_0.gltf
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json&project_id=demo&document_label=sample&document_id=ZGVtbwpzYW1wbGU
```
Fresh `convert_cli --json --gltf` output directories now emit `manifest.json` directly, so a raw converter run can be opened without `plm_convert.py` wrapping:
```
http://localhost:8080/tools/web_viewer/index.html?manifest=build/step186_viewport_sample/manifest.json
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

## Preview Provenance Smoke Coverage
`tools/web_viewer/scripts/preview_provenance_smoke.js` now covers twelve stable browser cases:
- exploded `INSERT`
- proxy `DIMENSION`
- proxy `HATCH`
- real `ATTRIB` text-kind selection from `build/step186_text_kinds`
- real `ATTDEF` text-kind selection from `build/step186_text_kinds`
- real `MTEXT` text-kind selection from `build/step186_text_kinds`
- real `MLEADER` text-kind selection from `build/step186_mleader`
- real `TABLE` text-kind selection from `build/step186_table`
- real `LEADER` line-only proxy selection from `build/step186_leader`
- real mixed paper-space text from `build/step186_origin_mixed`
- real multi-layout paper-space text from `build/step186_multi_layout`
- real paper-space exploded insert style/provenance from `build/step186_paperspace_insert_styles`

The text-kind artifact loads:
```text
tools/web_viewer/index.html?manifest=build/step186_text_kinds/manifest.json&text_filter=all
```

Expected selections include:
- `Value / ATTRIB_FULL_ALIGN` + `Text Kind / attrib`
- `Value / ATTDEF_PARTIAL_ALIGN_Y_ONLY` + `Text Kind / attdef`
- `Value / MTEXT_PARTIAL_ALIGN_X_ONLY` + `Text Kind / mtext`
- `Value / MLEADER_STEP186 SECOND_LINE` + `Text Kind / mleader`
- `Value / TABLE_STEP186 ROW_2` + `Text Kind / table`

The provenance smoke runner now falls back from coarse viewport grid clicks to text-label targeting for text-only artifacts, so these browser checks stay stable even when the document has no mesh or line geometry.

The mixed paper-space case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_origin_mixed/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutMixed
```

Expected selection includes:
- `Value / PAPER NOTE`

The paper-space insert style case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_paperspace_insert_styles/manifest.json&mesh=0&space=1&layout=LayoutStyle
```

Expected selection includes:
- `Color Source / BYBLOCK`
- `Line Type / CENTER`
- `Line Weight / 0.5`
- `Line Type Scale / 0.25`
- `Origin / INSERT/insert | exploded`
- `Block Name / PaperStyledBlock`
- `Space / 1`
- `Layout / LayoutStyle`

This case exists to guard a real importer path where paper-space entities come from `*Paper_Space*` DXF blocks rather than top-level entity storage.

The `LEADER` case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_leader/manifest.json&mesh=0
```

Expected selection includes:
- `Origin / LEADER/leader | proxy`
- `Space / 0`

The multi-layout case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_multi_layout/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutB
```

Expected selection includes:
- `Value / LAYOUT B NOTE`
- `Space / 1`
- `Layout / LayoutB`

This case exists to guard the second real paper layout path where:
- `LayoutA` content arrives from top-level `ENTITIES`; and
- `LayoutB` content arrives from `*Paper_Space1` block storage and must still survive importer + converter + preview selection.
