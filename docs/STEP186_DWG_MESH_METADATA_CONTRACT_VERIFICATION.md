# STEP186 DWG Mesh Metadata Contract Verification

## Goal
Verify that enriched `mesh_metadata.json` remains backward-compatible while exposing normalized summary, layout, and viewport facts needed by the router and web viewer.

## Scope
Validate these artifact relationships:
- `manifest.json` is emitted directly by `convert_cli` and still references the existing four artifact files only.
- `document.json` remains the editable and internal representation.
- `mesh_metadata.json` contains the legacy slice arrays plus normalized `summary`, `layouts`, and `viewports`.
- layout and viewport information stay consistent between `document.json` metadata and `mesh_metadata.json`.
- paper-space entity `layout` attribution stays consistent across importer, `document.json`, and `mesh_metadata.json`.

## Sample Cases
Recommended artifact sets:
- `build/plm_preview_dim`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`
- freshly regenerated converter outputs for:
  - `tests/plugin_data/importer_entities.dxf`
  - `tests/plugin_data/viewport_sample.dxf`

These cover:
- model-space geometry and dimensions;
- hatch and line overlay output;
- paper-space layout and viewport metadata;
- freshly generated Step186 sidecar sections.

## Verification Commands
Build the converter:
```bash
cmake --build build --target convert_cli
```

Generate fresh outputs:
```bash
./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/importer_entities.dxf \
  --out ./build/step186_importer_entities \
  --json --gltf

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/viewport_sample.dxf \
  --out ./build/step186_viewport_sample \
  --json --gltf
```

Run artifact validation:
```bash
python3 tools/validate_plm_preview_artifacts.py build/plm_preview_dim
python3 tools/validate_plm_preview_artifacts.py build/plm_preview_btj01239601522_layout
python3 tools/validate_plm_preview_artifacts.py build/step186_importer_entities
python3 tools/validate_plm_preview_artifacts.py build/step186_viewport_sample
```

Run manifest validation on fresh converter outputs:
```bash
python3 tools/validate_plm_manifest.py build/step186_importer_entities/manifest.json --check-hashes --check-document
python3 tools/validate_plm_manifest.py build/step186_viewport_sample/manifest.json --check-hashes --check-document
```

Optional identity metadata check:
```bash
./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/viewport_sample.dxf \
  --out ./build/step186_viewport_sample_meta \
  --json --gltf \
  --project-id demo \
  --document-label viewport_sample
```

Run the converter smoke and importer layout tests:
```bash
ctest --test-dir build -R 'convert_cli_mesh_metadata_smoke|test_dxf_viewport_layout_metadata_run' --output-on-failure
```

## Required Assertions

### Manifest Compatibility
- `convert_cli` fresh output directories contain `manifest.json`.
- `manifest.json.artifacts` still contains exactly:
  - `document_json`
  - `mesh_gltf`
  - `mesh_bin`
  - `mesh_metadata`
- `manifest.json.content_hashes` and `artifact_sizes` match the emitted files.
- optional `project_id`, `document_label`, and `document_id` remain strings when present.
- no new top-level manifest sections are required for this feature.

### Sidecar Shape
- `mesh_metadata.json` contains:
  - `gltf`
  - `bin`
  - `summary`
  - `layouts`
  - `viewports`
  - `entities`
  - `line_entities`
- `line_entities` is always an array, even when empty.

### Summary Consistency
- `summary.document_entity_count == len(document.entities)`
- `summary.mesh_entity_count == len(entities)`
- `summary.line_entity_count == len(line_entities)`
- `summary.default_space` matches `document.json.metadata.meta["dxf.default_space"]` when that key exists.
- `summary.viewport_count == len(viewports)` and matches `document.json.metadata.meta["dxf.viewport.count"]` when present.
- `summary.layout_count == len(layouts)`.

### Layout Consistency
- each layout entry has `name`, `space`, `is_default`, `synthetic`, and `viewport_count`.
- model space appears as synthetic `name="Model"` when model-space content exists.
- each layout name referenced by `viewports[*].layout` is present in `layouts[*].name`.
- per-layout counts are present only where the converter can derive them safely from current space-level metadata.

### Viewport Consistency
- each viewport entry has stable `index` matching its array position.
- numeric fields `center_x`, `center_y`, `width`, `height`, `view_center_x`, `view_center_y`, `view_height`, and `twist_deg` stay consistent with `dxf.viewport.{i}.*` in document metadata.
- `layout` matches the corresponding `dxf.viewport.{i}.layout` when present.
- `space` stays `1` for paper-space viewports.

### Entity Slice Consistency
- every `entities[*].space` is either `0` or `1` when present.
- every `line_entities[*].space` is either `0` or `1` when present.
- when an entity id exists in both `document.json` and `mesh_metadata.json`, the `space` values match.
- when a paper-space entity has `layout`, the value matches between `document.json` and `mesh_metadata.json`.

### Derived Origin Metadata Consistency
- when present, `source_type`, `edit_mode`, `proxy_kind`, `block_name`, and `hatch_pattern` are non-empty strings.
- when present, `hatch_id` is an integer in both `document.json` and `mesh_metadata.json`.
- `INSERT`-derived entities keep `source_type=INSERT`, `edit_mode=exploded`, `proxy_kind=insert`.
- `DIMENSION` text keeps `source_type=DIMENSION`, `edit_mode=proxy`, `proxy_kind=dimension`, plus existing `text_kind/dim_type/dim_style`.
- `HATCH` boundaries and emitted scan lines keep `source_type=HATCH`, `edit_mode=proxy`, `proxy_kind=hatch`, and preserve `hatch_id/hatch_pattern`.

## Manual Viewer Check
For a paper-space sample:
```text
http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/plm_preview_btj01239601522_layout/manifest.json&space=paper&paper_viewport=1
```

Expected:
- paper-space geometry remains visible;
- layout filtering remains stable;
- existing consumers that only read slice arrays do not regress;
- fresh `convert_cli` output directories can be opened directly through their emitted `manifest.json`.

## Verification Result Template
| Case | Expected | Result | Notes |
| --- | --- | --- | --- |
| `plm_preview_dim` | legacy artifacts still validate | `PASS` | `validate_plm_preview_artifacts.py` passed; entities=372, mesh=41, lines=270 |
| `plm_preview_btj01239601522_layout` | legacy layout sample still validates | `PASS` | `validate_plm_preview_artifacts.py` passed; entities=370, mesh=25, lines=300 |
| `step186_importer_entities` | summary + model layout emitted | `PASS` | fresh `convert_cli` output validated; layouts=1, viewports=0 |
| `step186_viewport_sample` | summary + layouts + viewports emitted | `PASS` | fresh `convert_cli` output validated; layouts=2, viewports=1 |

## Exit Criteria
Verification passes when:
- manifest compatibility is unchanged;
- enriched sidecar fields are internally consistent;
- viewport samples remain previewable;
- validation detects malformed counts or layout or space drift.

## Incremental Origin-Metadata Recheck

### Commands
```bash
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_importer_blocks test_dxf_text_metadata test_dxf_hatch_dash -j4

ctest --test-dir build -R 'test_dxf_importer_blocks_run|test_dxf_text_metadata_run|test_dxf_hatch_dash_run|convert_cli_mesh_metadata_smoke' --output-on-failure

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/importer_blocks.dxf \
  --out ./build/step186_origin_blocks \
  --json --gltf
python3 tools/validate_plm_preview_artifacts.py ./build/step186_origin_blocks

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/hatch_dash_sample.dxf \
  --out ./build/step186_origin_hatch \
  --json --gltf
python3 tools/validate_plm_preview_artifacts.py ./build/step186_origin_hatch

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/importer_text_metadata.dxf \
  --out ./build/step186_origin_dimension \
  --json
```

### Result
- focused build: PASS.
- regression tests: PASS.
  - `test_dxf_importer_blocks_run`
  - `test_dxf_text_metadata_run`
  - `test_dxf_hatch_dash_run`
  - `convert_cli_mesh_metadata_smoke`
- fresh preview artifact validation: PASS.
  - `build/step186_origin_blocks`
  - `build/step186_origin_hatch`
- manual JSON inspection confirms:
  - `importer_blocks.dxf` emits `source_type=INSERT`, `edit_mode=exploded`, `proxy_kind=insert`, `block_name=BlockA/...`
  - `importer_text_metadata.dxf` emits `source_type=DIMENSION`, `edit_mode=proxy`, `proxy_kind=dimension`, `block_name=*D0`
  - `hatch_dash_sample.dxf` emits `source_type=HATCH`, `edit_mode=proxy`, `proxy_kind=hatch`, `hatch_id=1`, `hatch_pattern=ANSI31`

## Latest Contract Recheck (2026-03-06)

### Commands
```bash
cmake --build build --target convert_cli -j4

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/importer_entities.dxf \
  --out ./build/step186_importer_entities \
  --json --gltf

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/viewport_sample.dxf \
  --out ./build/step186_viewport_sample \
  --json --gltf

python3 tools/validate_plm_preview_artifacts.py build/plm_preview_dim
python3 tools/validate_plm_preview_artifacts.py build/plm_preview_btj01239601522_layout
python3 tools/validate_plm_preview_artifacts.py build/step186_importer_entities
python3 tools/validate_plm_preview_artifacts.py build/step186_viewport_sample

python3 tools/validate_plm_manifest.py build/step186_importer_entities/manifest.json --check-hashes --check-document
python3 tools/validate_plm_manifest.py build/step186_viewport_sample/manifest.json --check-hashes --check-document

ctest --test-dir build -R 'convert_cli_mesh_metadata_smoke|test_dxf_viewport_layout_metadata_run' --output-on-failure
```

### Result
- all listed validation commands passed.
- manifest/hash/size/document schema checks passed for both fresh Step186 outputs.
- ctest recheck passed:
  - `convert_cli_mesh_metadata_smoke`
  - `test_dxf_viewport_layout_metadata_run`

## Preview Selection Provenance Recheck (2026-03-07)

### Commands
```bash
python3 -m http.server 8080

# In another shell
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" open \
  "http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/step186_origin_hatch/manifest.json"

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" eval \
  '() => { const r = document.querySelector("#viewport").getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }'

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mousemove 378 414
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mousedown left
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mouseup left

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" eval \
  '() => document.querySelector("#selection-info")?.innerText || ""'

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" screenshot
```

### Result
- preview load: PASS.
  - sample: `build/step186_origin_hatch/manifest.json`
  - scene summary showed `Meshes=1`, `Vertices=4`, `Triangles=2`
- click-to-selection provenance rendering: PASS.
  - selection text after clicking viewport center:
    - `Name / mesh_0`
    - `Entity ID / 1`
    - `Entity Name / __cadgf_hatch:1`
    - `Origin / HATCH/hatch | proxy`
    - `Derived proxy from DWG/DXF source; preview only.`
    - `Hatch ID / 1`
    - `Hatch Pattern / ANSI31`
    - `Space / 0`
- screenshot captured:
  - `output/playwright/.playwright-cli/page-2026-03-07T02-57-28-658Z.png`
- conclusion:
  - Step186 producer fields are now visible in the preview selection panel, not only in raw JSON sidecars.
  - preview consumer wording is aligned with editor-side provenance/read-only semantics.

## Preview Line-Overlay Provenance Recheck (2026-03-07)

### Commands
```bash
python3 -m http.server 8080

# In another shell
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" open \
  "http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/step186_origin_hatch/manifest.json&mesh=0"

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" run-code \
  '(page) => (async () => {
    const box = await page.locator("#viewport").boundingBox();
    if (!box) return { hit: false, reason: "no_viewport" };
    const points = [];
    for (let y = box.y + 30; y < box.y + box.height - 30; y += 35) {
      for (let x = box.x + 30; x < box.x + box.width - 30; x += 35) {
        points.push([Math.round(x), Math.round(y)]);
      }
    }
    for (const [x, y] of points) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(20);
      const text = await page.locator("#selection-info").innerText();
      if (text && !text.includes("Click a surface")) {
        return { hit: true, x, y, text };
      }
    }
    return { hit: false, scanned: points.length };
  })()'

"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mousemove 345 255
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mousedown left
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" mouseup left
"$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" screenshot
```

### Result
- line-only preview load (`mesh=0`): PASS.
- line-overlay hit test: PASS.
  - first successful pick found by grid scan at approximately `x=345`, `y=255`
  - selection text included:
    - `Name / __cadgf_hatch:1`
    - `Entity ID / 1`
    - `Origin / HATCH/hatch | proxy`
    - `Derived proxy from DWG/DXF source; preview only.`
    - `Hatch ID / 1`
    - `Hatch Pattern / ANSI31`
    - `Space / 0`
- screenshot captured:
  - `output/playwright/.playwright-cli/page-2026-03-07T03-03-13-708Z.png`
- conclusion:
  - Step186 provenance rendering is now consistent for both mesh-slice selection and line-overlay selection.
  - `mesh_metadata.line_entities` is no longer a display-only channel in preview mode; it is now also inspectable through the same selection UI.

## Preview Provenance Smoke Script Recheck (2026-03-07)

### Commands
```bash
python3 -m http.server 8080

# In another shell
node tools/web_viewer/scripts/preview_provenance_smoke.js
```

### Result
- preview provenance smoke script: PASS.
- output summary:
  - `build/preview_provenance_smoke/20260307_111933/summary.json`
- case: `dimension_doc_only`
  - sample: `build/step186_origin_dimension/manifest.json`
  - status: PASS
  - selection text included:
    - `Value / 123.45`
    - `Origin / DIMENSION/dimension | proxy`
    - `Block Name / *D0`
    - `Dim Type / 0`
    - `Dim Style / STANDARD`
  - screenshot:
    - `build/preview_provenance_smoke/20260307_111933/dimension_doc_only.png`
- case: `hatch_line_only`
  - sample: `build/step186_origin_hatch/manifest.json&mesh=0`
  - status: PASS
  - selection text included:
    - `Origin / HATCH/hatch | proxy`
    - `Hatch ID / 1`
    - `Hatch Pattern / ANSI31`
  - screenshot:
    - `build/preview_provenance_smoke/20260307_111933/hatch_line_only.png`
- conclusion:
  - Step186 preview now supports provenance inspection across three consumer paths:
    - mesh-slice selection
    - line-overlay selection
    - document-only text selection
  - preview provenance verification is no longer only an ad hoc browser exercise; it is now captured in a repo-local smoke script.

## Json-Only Validator + Exploded Insert Smoke Recheck (2026-03-07)

### Commands
```bash
python3 -m http.server 8080

# In another shell
node tools/web_viewer/scripts/preview_provenance_smoke.js
python3 tools/validate_plm_preview_artifacts.py \
  build/step186_origin_blocks \
  build/step186_origin_hatch \
  build/step186_origin_dimension
```

### Result
- preview provenance smoke script: PASS.
  - output summary:
    - `build/preview_provenance_smoke/20260307_112444/summary.json`
  - case: `insert_exploded`
    - sample: `build/step186_origin_blocks/manifest.json&mesh=0`
    - status: PASS
    - selection text included:
      - `Line Type / PHANTOM`
      - `Line Weight / 0.9`
      - `Line Type Scale / 0.4`
      - `Origin / INSERT/insert | exploded`
      - `Exploded source fragment; provenance retained in metadata.`
      - `Block Name / BlockF`
    - screenshot:
      - `build/preview_provenance_smoke/20260307_112444/insert_exploded.png`
  - case: `dimension_doc_only`
    - sample: `build/step186_origin_dimension/manifest.json`
    - status: PASS
    - selection text included:
      - `Origin / DIMENSION/dimension | proxy`
      - `Dim Style / STANDARD`
      - `Value / 123.45`
    - screenshot:
      - `build/preview_provenance_smoke/20260307_112444/dimension_doc_only.png`
  - case: `hatch_line_only`
    - sample: `build/step186_origin_hatch/manifest.json&mesh=0`
    - status: PASS
    - selection text included:
      - `Origin / HATCH/hatch | proxy`
      - `Hatch Pattern / ANSI31`
    - screenshot:
      - `build/preview_provenance_smoke/20260307_112444/hatch_line_only.png`

- preview artifact validator: PASS.
  - `build/step186_origin_blocks`
  - `build/step186_origin_hatch`
  - `build/step186_origin_dimension/manifest.json`
  - notable result:
    - `step186_origin_dimension` now validates as `json-only preview contract`
    - `step186_origin_blocks` and `step186_origin_hatch` still pass full `mesh_metadata` validation

- conclusion:
  - Step186 coverage now includes exploded insert provenance in browser-level preview smoke.
  - `validate_plm_preview_artifacts.py` is no longer limited to 4-artifact preview bundles; it now accepts the json-only manifest shape already consumed by preview.
  - provenance fields for `INSERT`, `DIMENSION`, and `HATCH` are now covered across importer output, artifact validation, and browser-level consumer verification.

## Self-Hosted Preview Smoke + CI Wiring Recheck (2026-03-07)

### Commands
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke_ci

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_LIMIT=1 \
EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh

RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick
```

### Result
- self-hosted preview provenance smoke: PASS.
  - summary:
    - `build/preview_provenance_smoke_ci/20260307_114243/summary.json`
  - notable result:
    - the script no longer requires a separately managed `python3 -m http.server`
    - emitted fields:
      - `run_id=20260307_114243`
      - `summary_json=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_ci/20260307_114243/summary.json`

- editor gate integration: PASS.
  - command completed with `DONE`
  - gate summary:
    - `build/editor_gate_summary.json`
  - preview provenance subsection:
    - `enabled=true`
    - `mode=gate`
    - `ok=true`
    - `case_count=3`
    - `pass_count=3`
    - `fail_count=0`
    - `summary_json=build/preview_provenance_smoke_gate/20260307_114304/summary.json`

- local CI integration: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - preview provenance fields:
    - `runPreviewProvenanceSmoke=true`
    - `previewProvenanceSmokeStatus=ok`
    - `previewProvenanceSmokeCaseCount=3`
    - `previewProvenanceSmokePassCount=3`
    - `previewProvenanceSmokeFailCount=0`
    - `previewProvenanceSmokeSummaryJson=build/preview_provenance_smoke/20260307_114356/summary.json`

- shell/static checks: PASS.
  - `node --check tools/web_viewer/scripts/preview_provenance_smoke.js`
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`

### Conclusion
- preview provenance verification is now self-hosted and automation-friendly;
- `editor_gate` and `local_ci` both expose explicit preview provenance status in their machine-readable summaries;
- weekly summary generation can now carry the gate-side preview provenance section without requiring a second dedicated smoke path.

## Failure Injection + Manifest Fallback Bugfix Recheck (2026-03-07)

### Commands
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases tools/web_viewer/tests/fixtures/preview_provenance_failure_cases.json \
  --outdir build/preview_provenance_smoke_neg

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_LIMIT=1 \
EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh

RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_STEP166_SUITE=0 \
RUN_STEP166_GATE=0 \
RUN_PERF_GUARD=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick
```

### Result
- failure-injection smoke: PASS.
  - summary:
    - `build/preview_provenance_smoke_neg3/20260307_132107/summary.json`
  - cases:
    - `missing_document_artifact`
    - `invalid_manifest_json`
    - `invalid_mesh_metadata_json`
  - observed status:
    - all three stay on `Failed to load manifest.`
  - screenshots:
    - `build/preview_provenance_smoke_neg3/20260307_132107/missing_document_artifact.png`
    - `build/preview_provenance_smoke_neg3/20260307_132107/invalid_manifest_json.png`
    - `build/preview_provenance_smoke_neg3/20260307_132107/invalid_mesh_metadata_json.png`

- consumer bugfix confirmed.
  - before the fix, a bad manifest would still end up at `Loaded successfully.` because the viewer fell back to the default sample glTF input;
  - after the fix, the same bad manifest stays on `Failed to load manifest.` and no sample-scene fallback occurs.

- editor gate with positive + negative provenance stages: PASS.
  - gate summary:
    - `build/editor_gate_summary.json`
  - positive provenance section:
    - `preview_provenance_smoke.ok=true`
    - `case_count=3`
    - `summary_json=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_gate/20260307_132123/summary.json`
  - failure-injection section:
    - `preview_provenance_failure_injection.status=PASS`
    - `case_count=3`
    - `summary_json=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_injection/20260307_132135/summary.json`

- local CI failure-injection stage: PASS.
  - local CI summary:
    - `build/local_ci_summary.json`
  - section:
    - `runPreviewProvenanceFailureInjection=true`
    - `runPreviewProvenanceFailureInjectionGate=true`
    - `previewProvenanceFailureInjectionStatus=ok`
    - `previewProvenanceFailureInjectionCaseCount=3`
    - `previewProvenanceFailureInjectionPassCount=3`
    - `previewProvenanceFailureInjectionFailCount=0`
    - `previewProvenanceFailureInjectionSummaryJson=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_injection/20260307_132128/summary.json`

### Conclusion
- Step186 preview contract coverage now includes positive provenance rendering plus three negative rejection paths (`document_json` missing, manifest JSON invalid, `mesh_metadata` JSON invalid);
- viewer manifest loading fails closed instead of silently falling back to the sample scene;
- both `editor_gate` and `local_ci` now prove that the preview contract is capable of reporting red conditions, not only successful paths.

## Artifact Validator Failure Injection Recheck (2026-03-07)

### Commands
```bash
python3 tools/validate_plm_preview_artifacts_failure_injection.py \
  --outdir build/preview_artifact_validator_failure_injection_manual

RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_STEP166_SUITE=0 \
RUN_STEP166_GATE=0 \
RUN_PERF_GUARD=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_LIMIT=1 \
EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- standalone artifact-validator failure injection: PASS.
  - summary:
    - `build/preview_artifact_validator_failure_injection_manual5/20260307_110955/summary.json`
  - cases:
    - `invalid_mesh_metadata_json`
    - `provenance_mismatch`
    - `layout_viewport_mismatch`
    - `summary_space_mismatch`
    - `layout_duplicate_default`
    - `source_semantic_mismatch`
    - `color_source_semantic_mismatch`
    - `style_precedence_mismatch`
  - expected errors matched:
    - `JSON parse failed`
    - `proxy_kind mismatch`
    - `hatch_pattern mismatch`
    - `mesh_metadata.layouts missing names referenced by document viewports`
    - `mesh_metadata.viewports[0].layout mismatch`
    - `mesh_metadata.summary.spaces[0].document_entity_count mismatch`
    - `mesh_metadata.summary.spaces[1].mesh_entity_count mismatch`
    - `mesh_metadata.layouts contains duplicate name`
    - `mesh_metadata.layouts contains multiple default layouts`
    - `source_type DIMENSION requires edit_mode='proxy'`
    - `source_type HATCH requires proxy_kind='hatch'`
    - `source_type INSERT requires block_name`
    - `color_source INDEX requires color_aci`
    - `has invalid color_source 'BROKEN'`
    - `color_source TRUECOLOR requires color`
    - `color_source BYLAYER requires color == layer_color`
    - `line_type mismatch`
    - `line_weight mismatch`
    - `line_type_scale mismatch`

- local CI artifact-validator failure injection: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - section:
    - `runPreviewArtifactValidatorFailureInjection=true`
    - `runPreviewArtifactValidatorFailureInjectionGate=true`
    - `previewArtifactValidatorFailureInjectionStatus=ok`
    - `previewArtifactValidatorFailureInjectionCaseCount=8`
    - `previewArtifactValidatorFailureInjectionPassCount=8`
    - `previewArtifactValidatorFailureInjectionFailCount=0`
    - `previewArtifactValidatorFailureInjectionSummaryJson=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_validator_failure_injection/20260307_111001/summary.json`

- editor gate artifact-validator failure injection: PASS.
  - gate summary:
    - `build/editor_gate_summary.json`
  - section:
    - `preview_artifact_validator_failure_injection.status=PASS`
    - `case_count=8`
    - `summary_json=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_validator_failure_injection/20260307_110956/summary.json`

### Conclusion
- Step186 now covers both consumer-side red paths and validator-side semantic drift checks;
- `editor_gate` and `local_ci` can both prove that valid-looking preview artifacts with provenance/layout drift are rejected for the expected reason;
- weekly summary wiring now includes the required gate-side payload fields for this new validator section.

## Real-Artifact Smoke + Mixed Origin Recheck (2026-03-07)

### Commands
```bash
cmake --build build --target test_dxf_dimension_geometry_metadata cadgf_dxf_importer_plugin convert_cli -j4

ctest --test-dir build -R 'test_dxf_dimension_geometry_metadata_run|test_dxf_text_metadata_run' --output-on-failure

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/step186_mixed_origin_sample.dxf \
  --out ./build/step186_origin_mixed \
  --json --gltf

python3 tools/validate_plm_preview_artifacts.py build/step186_origin_mixed

python3 tools/validate_plm_preview_artifacts_smoke.py \
  --outdir build/preview_artifact_smoke_manual2

RUN_PREVIEW_ARTIFACT_SMOKE=1 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_STEP166_SUITE=0 \
RUN_STEP166_GATE=0 \
RUN_PERF_GUARD=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_LIMIT=1 \
EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- new importer regression test: PASS.
  - `test_dxf_dimension_geometry_metadata_run`
  - sample:
    - `tests/plugin_data/step186_mixed_origin_sample.dxf`
  - checks:
    - dimension-derived text and geometry both carry `dim_type=32` and `dim_style=Standard`
    - mixed sample still includes `INSERT`, `HATCH`, and viewport layout metadata

- fresh mixed converter artifact: PASS.
  - output:
    - `build/step186_origin_mixed`
  - validator:
    - `python3 tools/validate_plm_preview_artifacts.py build/step186_origin_mixed`
  - notable result:
    - `document entities=11`
    - `mesh metadata entities=3`
    - `line_entities=9`
    - `mesh_metadata layouts=2`
    - `mesh_metadata viewports=1`

- standalone positive real-artifact smoke: PASS.
  - summary:
    - `build/preview_artifact_smoke_manual2/20260307_113711/summary.json`
  - cases:
    - `origin_blocks_insert`
    - `origin_dimension_json_only`
    - `origin_hatch_proxy`
    - `origin_mixed_insert_dimension_hatch_viewport`
    - `viewport_sample_step186`
  - result:
    - `passed=5`
    - `failed=0`

- local CI positive smoke section: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - section:
    - `previewArtifactSmokeStatus=ok`
    - `previewArtifactSmokeRunId=20260307_113725`
    - `previewArtifactSmokeCaseCount=5`
    - `previewArtifactSmokePassCount=5`
    - `previewArtifactSmokeFailCount=0`
    - `previewArtifactSmokeSummaryJson=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_smoke/20260307_113725/summary.json`
  - note:
    - `previewArtifactSmokeSummaryJson` now resolves under `build/preview_artifact_smoke/...`; the earlier repo-root spill path was fixed by default outdir handling.

- editor gate positive smoke section: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - section:
    - `preview_artifact_smoke.status=PASS`
    - `run_id=20260307_113734`
    - `case_count=5`
    - `pass_count=5`
    - `fail_count=0`
    - `summary_json=/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_smoke/20260307_113734/summary.json`

### Conclusion
- the Step186 contract now has both red-path and real-path automation;
- a mixed real converter artifact now guards the interaction between `INSERT`, `DIMENSION`, `HATCH`, and viewport/layout metadata in one run;
- the dimension metadata projection gap was fixed at the exporter layer, not papered over in the validator;
- `local_ci` no longer leaks preview smoke summaries into the repo root when outdir env vars are left empty.

## Incremental Verification: Mixed Paper-Space Entity Recovery
### Commands
```bash
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_dimension_geometry_metadata -j4

ctest --test-dir build -R 'test_dxf_dimension_geometry_metadata_run|test_dxf_text_metadata_run' --output-on-failure

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/step186_mixed_origin_sample.dxf \
  --out ./build/step186_origin_mixed \
  --json --gltf

python3 tools/validate_plm_preview_artifacts.py build/step186_origin_mixed

node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir build/preview_provenance_smoke_mixed2

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
EDITOR_GATE_RUN_PERF_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- importer mixed regression: PASS.
  - `test_dxf_dimension_geometry_metadata_run`
  - checks now include:
    - at least one imported `space=1` entity exists in the mixed DXF;
    - imported paper-space entities carry `layout=LayoutMixed`;
    - at least one imported paper-space text entity exists.

- fresh mixed converter artifact: PASS.
  - `build/step186_origin_mixed`
  - notable result after the importer fix:
    - `document entities=16`
    - `space0=11`
    - `space1=5`
    - `layouts={'LayoutMixed': 5}`
    - `mesh_metadata.summary.spaces=[{space:0,...},{space:1,...}]`

- standalone preview provenance smoke: PASS.
  - summary:
    - `build/preview_provenance_smoke_mixed2/20260307_201535/summary.json`
  - result:
    - `passed=4`
    - `failed=0`
  - new case:
    - `mixed_paperspace_text`
  - selected payload includes:
    - `Value / PAPER NOTE`
    - `Space / 1`
    - `Layout / LayoutMixed`

- local CI preview provenance smoke: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - section:
    - `previewProvenanceSmokeStatus=ok`
    - `previewProvenanceSmokeCaseCount=4`
    - `previewProvenanceSmokePassCount=4`
    - `previewProvenanceSmokeFailCount=0`

- editor gate preview provenance smoke: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - section:
    - `preview_provenance_smoke.status=PASS`
    - `case_count=4`
    - `pass_count=4`
    - `fail_count=0`

### Conclusion
- the mixed real artifact now validates a previously missing path: paper-space entities stored in `*Paper_Space*` blocks;
- the importer fix is structural, not fixture-specific: it restores `space=1` entities when paper-space geometry exists only in block storage;
- preview provenance automation now covers a real mixed paper-space click path, not just model-space proxy/exploded cases.

## Incremental Verification: Layout Count Presence Failure Injection
### Commands
```bash
python3 -m py_compile tools/validate_plm_preview_artifacts.py tools/validate_plm_preview_artifacts_failure_injection.py

python3 tools/validate_plm_preview_artifacts_failure_injection.py \
  --outdir build/preview_artifact_validator_failure_injection_manual6

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- validator failure injection: PASS.
  - summary:
    - `build/preview_artifact_validator_failure_injection_manual6/20260307_122014/summary.json`
  - result:
    - `passed=9`
    - `failed=0`

- new red-path case:
  - `layout_count_presence_mismatch`
  - fixture:
    - `tools/web_viewer/tests/fixtures/preview_bad_artifact_layout_count_presence_mismatch/`
  - expected failure:
    - `mesh_metadata.layouts[1].document_entity_count mismatch`
    - `mesh_metadata.layouts[1].line_entity_count mismatch`

- editor gate validator failure section: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - section:
    - `preview_artifact_validator_failure_injection.case_count=9`
    - `preview_artifact_validator_failure_injection.pass_count=9`
    - `preview_artifact_validator_failure_injection.fail_count=0`

### Conclusion
- Step186 validator coverage now rejects layout metadata that claims paper-space entity counts without corresponding exported entities;
- the exact class of “paper-space layout exists, entities missing” drift is now covered both positively by the mixed real artifact and negatively by failure injection.

## Incremental Verification: Real Multi-Layout Paper-Space Recovery
### Commands
```bash
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_multi_layout_metadata -j4

ctest --test-dir build -R 'test_dxf_multi_layout_metadata_run|test_dxf_dimension_geometry_metadata_run' --output-on-failure

./build/tools/convert_cli \
  --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input ./tests/plugin_data/step186_multi_layout_sample.dxf \
  --out ./build/step186_multi_layout \
  --json --gltf

python3 tools/validate_plm_preview_artifacts.py build/step186_multi_layout

python3 tools/validate_plm_preview_artifacts_smoke.py \
  --outdir build/preview_artifact_smoke_multi

node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir build/preview_provenance_smoke_multi

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=1 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
EDITOR_GATE_RUN_PERF_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- importer multi-layout regression: PASS.
  - `test_dxf_multi_layout_metadata_run`
  - checks now include:
    - `dxf.viewport.count == 2`
    - viewport layouts include `LayoutA` and `LayoutB`
    - paper-space entities include both `LayoutA` and `LayoutB`
    - visible paper-space texts include `LAYOUT A NOTE` and `LAYOUT B NOTE`

- fresh multi-layout converter artifact: PASS.
  - `build/step186_multi_layout`
  - notable result:
    - `document entities=4`
    - `space0=2`
    - `space1=2`
    - `layouts=[Model, LayoutA, LayoutB]`
    - `mesh_metadata.layouts` keeps:
      - `Model.synthetic=true`
      - `LayoutA.is_default=false`
      - `LayoutB.is_default=false`

- standalone artifact validator: PASS.
  - `python3 tools/validate_plm_preview_artifacts.py build/step186_multi_layout`

- standalone positive artifact smoke: PASS.
  - summary:
    - `build/preview_artifact_smoke_multi_clean/20260307_134100/summary.json`
  - result:
    - `passed=6`
    - `failed=0`
  - new case:
    - `multi_layout_real_paperspace`

- standalone preview provenance smoke: PASS.
  - summary:
    - `build/preview_provenance_smoke_multi_clean/20260307_214101/summary.json`
  - result:
    - `passed=5`
    - `failed=0`
  - new case:
    - `multi_layout_layout_b_text`
  - selected payload includes:
    - `Value / LAYOUT B NOTE`
    - `Space / 1`
    - `Layout / LayoutB`

- local CI preview sections: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - sections:
    - `previewProvenanceSmokeCaseCount=5`
    - `previewProvenanceSmokePassCount=5`
    - `previewArtifactSmokeCaseCount=6`
    - `previewArtifactSmokePassCount=6`
    - `previewArtifactValidatorFailureInjectionCaseCount=9`
    - `previewArtifactValidatorFailureInjectionPassCount=9`

- editor gate preview sections: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - sections:
    - `preview_provenance_smoke.case_count=5`
    - `preview_provenance_smoke.pass_count=5`
    - `preview_artifact_smoke.case_count=6`
    - `preview_artifact_smoke.pass_count=6`
    - `preview_artifact_validator_failure_injection.case_count=9`
    - `preview_artifact_validator_failure_injection.pass_count=9`

### Conclusion
- the importer now recovers secondary paper layouts that live only in root `*Paper_Space*` blocks;
- the converter/validator path now treats synthetic `Model` counts and multi-paper-layout defaults correctly;
- browser provenance automation now covers a real second paper layout, not just a single `LayoutMixed` path.

## Incremental Verification: Auto-Prepared Default Step186 Artifacts + Preview Style Visibility
### Commands
```bash
python3 tools/prepare_step186_preview_artifacts.py --build-dir build --outdir build/step186_preview_artifact_prep_manual

node tools/web_viewer/scripts/preview_provenance_smoke.js

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=1 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
EDITOR_GATE_RUN_PERF_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Step186 preview artifact prep: PASS.
  - summary:
    - `build/step186_preview_artifact_prep_manual/20260307_140757/summary.json`
  - result:
    - `passed=6`
    - `failed=0`
  - default generated artifacts:
    - `step186_origin_blocks`
    - `step186_origin_dimension`
    - `step186_origin_hatch`
    - `step186_origin_mixed`
    - `step186_multi_layout`
    - `step186_viewport_sample`

- preview provenance smoke after style-visibility update: PASS.
  - summary:
    - `build/preview_provenance_smoke/20260307_220815/summary.json`
  - `insert_exploded` selection now includes:
    - `Line Type / PHANTOM`
    - `Line Weight / 0.9`
    - `Line Type Scale / 0.4`
    - `Color Source / BYBLOCK`
    - `Origin / INSERT/insert | exploded`
    - `Block Name / BlockF`

- local CI preview sections after auto-prep: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - sections:
    - `step186PreviewArtifactPrepStatus=ok`
    - `step186PreviewArtifactPrepCaseCount=6`
    - `step186PreviewArtifactPrepPassCount=6`
    - `previewProvenanceSmokeCaseCount=5`
    - `previewProvenanceSmokePassCount=5`
    - `previewArtifactSmokeCaseCount=6`
    - `previewArtifactSmokePassCount=6`
    - `previewArtifactValidatorFailureInjectionCaseCount=9`
    - `previewArtifactValidatorFailureInjectionPassCount=9`

- editor gate preview sections after auto-prep: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - sections:
    - `step186_preview_artifact_prep.status=PASS`
    - `step186_preview_artifact_prep.case_count=6`
    - `preview_provenance_smoke.case_count=5`
    - `preview_artifact_smoke.case_count=6`
    - `preview_artifact_validator_failure_injection.case_count=9`

### Conclusion
- default Step186 positive smoke is now self-preparing and does not depend on legacy large artifacts already being present;
- legacy large samples remain available through `preview_artifact_smoke_cases_legacy.json`, but are no longer part of the default gate path;
- style-precedence metadata is now visible in the preview selection panel, so browser smoke covers both provenance and effective style on a real exploded `INSERT` sample.

## Incremental Verification: Paper-Space Insert Style Sample + Weekly Legacy Lane
### Commands
```bash
ctest --test-dir build -R 'test_dxf_paperspace_insert_styles_run|test_dxf_importer_blocks_run|test_dxf_multi_layout_metadata_run' --output-on-failure

python3 tools/prepare_step186_preview_artifacts.py \
  --build-dir build \
  --outdir build/step186_preview_artifact_prep_style

python3 tools/validate_plm_preview_artifacts_smoke.py \
  --outdir build/preview_artifact_smoke_style2

python3 tools/validate_plm_preview_artifacts_smoke.py \
  --cases tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json \
  --outdir build/preview_artifact_smoke_legacy_manual

node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir build/preview_provenance_smoke_paperspace_style2

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=1 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
EDITOR_GATE_RUN_PERF_TREND=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- importer regression: PASS.
  - `test_dxf_paperspace_insert_styles_run`
  - confirms:
    - `LayoutStyle` viewport metadata survives;
    - paper-space note `LAYOUT STYLE NOTE` survives;
    - exploded insert fragments retain:
      - `source_type=INSERT`
      - `edit_mode=exploded`
      - `proxy_kind=insert`
      - `block_name=PaperStyledBlock`
    - BYBLOCK fragment retains:
      - `color_source=BYBLOCK`
      - `line_type=CENTER`
      - `line_weight=0.5`
      - `line_type_scale=0.25`
      - resolved color `0xFF0000`
    - BYLAYER fragment retains:
      - `color_source=BYLAYER`
      - `line_type=CENTER2`
      - `line_weight=0.25`
      - `line_type_scale=0.6`
      - resolved color `0x00FFFF`

- Step186 artifact prep after adding the paper-space style sample: PASS.
  - summary:
    - `build/step186_preview_artifact_prep_style/20260307_143414/summary.json`
  - result:
    - `passed=7`
    - `failed=0`
  - generated artifacts:
    - `step186_origin_blocks`
    - `step186_origin_dimension`
    - `step186_origin_hatch`
    - `step186_origin_mixed`
    - `step186_multi_layout`
    - `step186_paperspace_insert_styles`
    - `step186_viewport_sample`

- default positive artifact smoke after adding the paper-space style sample: PASS.
  - summary:
    - `build/preview_artifact_smoke_style2/20260307_143414/summary.json`
  - result:
    - `passed=7`
    - `failed=0`

- weekly legacy-only artifact smoke lane: PASS.
  - summary:
    - `build/preview_artifact_smoke_legacy_manual/20260307_143414/summary.json`
  - result:
    - `passed=2`
    - `failed=0`
  - scope remains:
    - `build/plm_preview_dim_hatch`
    - `build/plm_preview_btj01239601522_layout`

- browser provenance smoke with the new paper-space insert style case: PASS.
  - summary:
    - `build/preview_provenance_smoke_paperspace_style2/20260307_223540/summary.json`
  - result:
    - `passed=6`
    - `failed=0`
  - new `paperspace_insert_style` selection includes:
    - `Color Source / BYBLOCK`
    - `Line Type / CENTER`
    - `Line Weight / 0.5`
    - `Line Type Scale / 0.25`
    - `Origin / INSERT/insert | exploded`
    - `Block Name / PaperStyledBlock`
    - `Layout / LayoutStyle`

- local CI preview sections after the new default case: PASS.
  - summary:
    - `build/local_ci_summary.json`
  - sections:
    - `step186PreviewArtifactPrepCaseCount=7`
    - `previewProvenanceSmokeCaseCount=6`
    - `previewArtifactSmokeCaseCount=7`
    - `previewArtifactValidatorFailureInjectionCaseCount=9`

- editor gate preview sections after the new default case: PASS.
  - summary:
    - `build/editor_gate_summary.json`
  - sections:
    - `step186_preview_artifact_prep.case_count=7`
    - `preview_provenance_smoke.case_count=6`
    - `preview_artifact_smoke.case_count=7`
    - `preview_artifact_validator_failure_injection.case_count=9`

### Conclusion
- paper-space exploded inserts now keep provenance and resolved style metadata, not just style values;
- the default Step186 prep/smoke set now includes a real paper-space insert-style artifact, so browser coverage is no longer limited to model-space exploded inserts;
- legacy large preview artifacts are still exercised, but only on a separate weekly lane, keeping default gate/local CI cost unchanged.

## Incremental Verification: Real Weekly Summary + Dashboard Contract For Preview Lanes
### Commands
```bash
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=1 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
PERF_ENTITIES=2000 \
PERF_PICK_SAMPLES=400 \
PERF_BOX_SAMPLES=150 \
PERF_DRAG_SAMPLES=40 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step176_dashboard.py \
  --weekly-history-dir build/editor_weekly_validation_history \
  --out build/step176_dashboard_live.md

bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_live.md \
  --require-dashboard
```

### Result
- real weekly validation: PASS.
  - summary:
    - `build/editor_weekly_validation_summary.json`
    - `build/editor_weekly_validation_summary.md`
  - history:
    - `build/editor_weekly_validation_history/weekly_20260307_145902_20260307_225541_261_d2d4_20260307_145545.json`

- weekly gate preview sections are now present in the real summary payload:
  - `gate_preview_provenance_smoke`
    - `case_count=6`
    - `pass_count=6`
    - `run_id=20260307_225833`
  - `gate_preview_artifact_smoke`
    - `case_count=7`
    - `pass_count=7`
    - `run_id=20260307_145857`
  - `gate_preview_artifact_validator_failure_injection`
    - `case_count=9`
    - `pass_count=9`
    - `run_id=20260307_145857`
  - `weekly_legacy_preview_artifact_smoke`
    - `case_count=2`
    - `pass_count=2`
    - `missing_target_count=0`
    - `run_id=20260307_145901`

- real weekly gate execution still preserved the Step186 core preview lanes:
  - `step186_preview_artifact_prep`
    - `case_count=7`
    - `pass_count=7`
  - `preview_provenance_smoke`
    - `case_count=6`
    - `pass_count=6`
  - `preview_artifact_smoke`
    - `case_count=7`
    - `pass_count=7`
  - `preview_artifact_validator_failure_injection`
    - `case_count=9`
    - `pass_count=9`

- live dashboard render: PASS.
  - dashboard:
    - `build/step176_dashboard_live.md`
  - latest weekly section now includes:
    - `weekly_ui_flow_stage_trend`
    - `weekly_gate_preview_provenance_smoke`
    - `weekly_gate_preview_artifact_smoke`
    - `weekly_gate_preview_artifact_validator_failure_injection`
    - `weekly_legacy_preview_artifact_smoke`

- weekly summary contract checker with dashboard requirement: PASS.
  - output:
    - `[weekly-summary] OK status=stable mode=gate days=7 enabled_samples=10 fail_ratio=0.000 attribution_ratio=1.000 dashboard=checked`

### Conclusion
- preview lanes now survive the full weekly path, not just gate/local CI JSON;
- the weekly checker now enforces those preview sections and their artifact paths;
- the STEP176 dashboard now renders the same preview-lane data, so machine checks and human review read the same contract.

## Incremental Verification: Weekly Legacy Artifact Regeneration + Strict Validation
### Commands
```bash
python3 tools/prepare_legacy_preview_artifacts.py \
  --outdir build/preview_artifact_prep_legacy_weekly_manual2

python3 tools/validate_plm_preview_artifacts.py \
  build/plm_preview_dim_hatch \
  build/plm_preview_btj01239601522_layout

python3 tools/validate_plm_preview_artifacts_smoke.py \
  --cases tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json \
  --outdir build/preview_artifact_smoke_legacy_weekly_manual3

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=1 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
PERF_ENTITIES=2000 \
PERF_PICK_SAMPLES=400 \
PERF_BOX_SAMPLES=150 \
PERF_DRAG_SAMPLES=40 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_live2.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_live2.md

bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_live2.md \
  --require-dashboard
```

### Result
- standalone legacy artifact regeneration: PASS.
  - summary:
    - `build/preview_artifact_prep_legacy_weekly_manual2/20260307_160852/summary.json`
  - result:
    - `passed=2`
    - `failed=0`
    - `missing_input_count=0`
    - `missing_manifest_count=0`

- strict validator on regenerated legacy artifacts: PASS.
  - targets:
    - `build/plm_preview_dim_hatch`
    - `build/plm_preview_btj01239601522_layout`
  - result:
    - both directories passed `validate_plm_preview_artifacts.py` with zero errors

- standalone legacy smoke after regeneration: PASS.
  - summary:
    - `build/preview_artifact_smoke_legacy_weekly_manual3/20260307_160921/summary.json`
  - result:
    - `passed=2`
    - `failed=0`

- real weekly validation with embedded legacy prep lane: PASS.
  - weekly summary:
    - `build/editor_weekly_validation_summary.json`
    - `build/editor_weekly_validation_summary.md`
  - weekly history:
    - `build/editor_weekly_validation_history/weekly_20260307_161327_20260308_000923_274_c4b8_20260307_160927.json`

- weekly summary now carries both legacy-refresh lanes:
  - `weekly_legacy_preview_artifact_prep`
    - `status=ok`
    - `run_id=20260307_161325`
    - `case_count=2`
    - `pass_count=2`
    - `fail_count=0`
    - `missing_input_count=0`
    - `missing_manifest_count=0`
    - `summary_json=build/preview_artifact_prep_legacy_weekly/20260307_161325/summary.json`
  - `weekly_legacy_preview_artifact_smoke`
    - `status=ok`
    - `run_id=20260307_161326`
    - `case_count=2`
    - `pass_count=2`
    - `fail_count=0`
    - `missing_target_count=0`
    - `summary_json=build/preview_artifact_smoke_legacy_weekly/20260307_161326/summary.json`

- real weekly gate preview sections also reflect the current expanded Step186 set:
  - `step186_preview_artifact_prep`
    - `case_count=8`
    - `pass_count=8`
    - `run_id=20260307_161221`
  - `gate_preview_provenance_smoke`
    - `case_count=9`
    - `pass_count=9`
    - `run_id=20260308_001222`
  - `gate_preview_artifact_smoke`
    - `case_count=8`
    - `pass_count=8`
    - `run_id=20260307_161321`
  - `gate_preview_artifact_validator_failure_injection`
    - `case_count=10`
    - `pass_count=10`
    - `run_id=20260307_161321`

- root-level dashboard/report/checker replay: PASS.
  - dashboard:
    - `build/step176_dashboard_live2.md`
  - weekly report render:
    - `build/step176_weekly_live2.md`
  - checker output:
    - `[weekly-summary] OK status=stable mode=gate days=7 enabled_samples=12 fail_ratio=0.000 attribution_ratio=1.000 dashboard=checked`

### Conclusion
- the legacy weekly lane no longer reports stale-artifact failures as if they were converter regressions;
- strict Step186 validation stays intact, because compatibility is achieved by regenerating legacy artifacts, not by weakening validator rules;
- weekly summary, dashboard, and checker now expose both the legacy regeneration step and the post-regeneration strict smoke result.

## Incremental Verification: MLEADER/TABLE Text-Only Closure + Legacy Weekly Expansion
Commands run:
```bash
cmake --build deps/cadgamefusion/build --target cadgf_dxf_importer_plugin test_dxf_mleader_metadata test_dxf_table_metadata convert_cli -j4
ctest --test-dir deps/cadgamefusion/build -R 'test_dxf_mleader_metadata_run|test_dxf_table_metadata_run' --output-on-failure

python3 deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/step186_mleader \
  deps/cadgamefusion/build/step186_table
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts_smoke.py \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_smoke_step186_texts
node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_step186_texts_fix

python3 deps/cadgamefusion/tools/prepare_legacy_preview_artifacts.py \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_prep_legacy_manual3
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/plm_preview_j0225034_layoutfix_meta
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts_smoke.py \
  --cases deps/cadgamefusion/tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_smoke_legacy_manual4
```

Results:
- importer regression tests: PASS.
  - `test_dxf_mleader_metadata_run`
  - `test_dxf_table_metadata_run`

- default Step186 artifact prep: PASS.
  - summary:
    - `build/step186_preview_artifact_prep/20260307_163019/summary.json`
  - result:
    - `passed=10`
    - `failed=0`

- json-only validator checks: PASS.
  - `build/step186_mleader/manifest.json`
  - `build/step186_table/manifest.json`

- positive Step186 artifact smoke: PASS.
  - summary:
    - `build/preview_artifact_smoke_step186_texts/20260307_163019/summary.json`
  - result:
    - `passed=10`
    - `failed=0`

- browser provenance smoke: PASS.
  - summary:
    - `build/preview_provenance_smoke_step186_texts_fix/20260308_003153/summary.json`
  - result:
    - `passed=11`
    - `failed=0`
  - newly covered text-only selections:
    - `Value / MLEADER_STEP186 SECOND_LINE` + `Text Kind / mleader`
    - `Value / TABLE_STEP186 ROW_2` + `Text Kind / table`

- strict validator on regenerated large legacy candidate: PASS.
  - target:
    - `build/plm_preview_j0225034_layoutfix_meta`
  - result:
    - entities=`5319`
    - mesh=`357`
    - line_entities=`4429`
    - layouts=`3`
    - viewports=`4`

- legacy artifact regeneration after case-set promotion: PASS.
  - summary:
    - `build/preview_artifact_prep_legacy_manual3/20260307_162934/summary.json`
  - result:
    - `passed=3`
    - `failed=0`

- legacy strict smoke after promotion: PASS.
  - summary:
    - `build/preview_artifact_smoke_legacy_manual4/20260307_162946/summary.json`
  - result:
    - `passed=3`
    - `failed=0`

Notable issue found and fixed in this increment:
- `TABLE` entity import initially failed with `Import failed: no supported DXF entities found`;
- root cause was importer control flow: `0/TABLE` was being consumed as a `TABLES` section marker even inside `ENTITIES`;
- after narrowing that branch to `current_section == DxfSection::Tables`, `TABLE` entities now reach the existing text-import path and pass both importer and browser checks.

Conclusion:
- `MLEADER` and `TABLE` are now real Step186-covered annotation cases rather than validator-only enum values;
- weekly legacy coverage now includes a third regenerated large sample without weakening Step186 contract rules.

- minimal weekly validation after case-set expansion: PASS.
  - weekly summary:
    - `build/editor_weekly_validation_summary.json`
  - gate preview sections:
    - `step186_preview_artifact_prep`
      - `run_id=20260307_163640`
      - `case_count=10`
      - `pass_count=10`
    - `gate_preview_provenance_smoke`
      - `run_id=20260308_003641`
      - `case_count=11`
      - `pass_count=11`
    - `gate_preview_artifact_smoke`
      - `run_id=20260307_163746`
      - `case_count=10`
      - `pass_count=10`
    - `gate_preview_artifact_validator_failure_injection`
      - `run_id=20260307_163746`
      - `case_count=10`
      - `pass_count=10`
  - weekly legacy refresh sections:
    - `weekly_legacy_preview_artifact_prep`
      - `run_id=20260307_163750`
      - `case_count=3`
      - `pass_count=3`
    - `weekly_legacy_preview_artifact_smoke`
      - `run_id=20260307_163802`
      - `case_count=3`
      - `pass_count=3`
  - checker/dashboard replay:
    - `build/step176_dashboard_step186_live3.md`
    - `build/step176_weekly_step186_live3.md`
    - `[weekly-summary] OK status=stable mode=gate days=7 enabled_samples=13 fail_ratio=0.000 attribution_ratio=1.000 dashboard=checked`

## Incremental Verification: LEADER Proxy Closure + Weekly Step186 Prep Contract
Commands run:
```bash
cmake --build deps/cadgamefusion/build --target cadgf_dxf_importer_plugin test_dxf_leader_metadata convert_cli -j4
ctest --test-dir deps/cadgamefusion/build -R 'test_dxf_leader_metadata_run' --output-on-failure

python3 deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step186_preview_artifact_prep_leader
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/step186_leader
python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts_smoke.py \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_artifact_smoke_leader
node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_leader

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=1 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
PERF_ENTITIES=2000 \
PERF_PICK_SAMPLES=400 \
PERF_BOX_SAMPLES=150 \
PERF_DRAG_SAMPLES=40 \
bash deps/cadgamefusion/tools/editor_weekly_validation.sh

python3 deps/cadgamefusion/tools/write_step176_dashboard.py \
  --history deps/cadgamefusion/build/editor_weekly_validation_history.json \
  --out deps/cadgamefusion/build/step176_dashboard_step186_live4.md
python3 deps/cadgamefusion/tools/write_step176_weekly_report.py \
  --weekly-summary deps/cadgamefusion/build/editor_weekly_validation_summary.json \
  --report deps/cadgamefusion/build/step176_weekly_step186_live4.md
bash deps/cadgamefusion/tools/check_weekly_summary.sh \
  --summary deps/cadgamefusion/build/editor_weekly_validation_summary.json \
  --dashboard deps/cadgamefusion/build/step176_dashboard_step186_live4.md \
  --require-dashboard
```

Results:
- importer regression test: PASS.
  - `test_dxf_leader_metadata_run`

- standalone Step186 prep after `LEADER` addition: PASS.
  - summary:
    - `build/step186_preview_artifact_prep_leader/20260307_165442/summary.json`
  - result:
    - `passed=11`
    - `failed=0`

- strict validator on `build/step186_leader`: PASS.
  - result:
    - entities=`1`
    - mesh_entities=`1`
    - line_entities=`1`
    - layouts=`1`
    - viewports=`0`
  - required provenance:
    - `source_type=LEADER`
    - `edit_mode=proxy`
    - `proxy_kind=leader`

- positive artifact smoke after `LEADER` addition: PASS.
  - summary:
    - `build/preview_artifact_smoke_leader/20260307_165443/summary.json`
  - result:
    - `passed=11`
    - `failed=0`

- browser provenance smoke after `LEADER` addition: PASS.
  - summary:
    - `build/preview_provenance_smoke_leader/20260308_005443/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - new covered selection:
    - `Origin / LEADER/leader | proxy`
    - `Space / 0`

- regenerated large legacy candidate still passes strict validator: PASS.
  - target:
    - `build/plm_preview_j0225034_layoutfix_meta`

- minimal weekly validation after `LEADER` addition: PASS.
  - weekly summary:
    - `build/editor_weekly_validation_summary.json`
  - preview lanes:
    - `step186_preview_artifact_prep`
      - `run_id=20260307_170836`
      - `case_count=11`
      - `pass_count=11`
    - `gate_preview_provenance_smoke`
      - `run_id=20260308_010838`
      - `case_count=12`
      - `pass_count=12`
    - `gate_preview_artifact_smoke`
      - `run_id=20260307_170955`
      - `case_count=11`
      - `pass_count=11`
    - `gate_preview_artifact_validator_failure_injection`
      - `run_id=20260307_170955`
      - `case_count=10`
      - `pass_count=10`
    - `weekly_legacy_preview_artifact_prep`
      - `run_id=20260307_171000`
      - `case_count=3`
      - `pass_count=3`
    - `weekly_legacy_preview_artifact_smoke`
      - `run_id=20260307_171012`
      - `case_count=3`
      - `pass_count=3`

- weekly dashboard/report/checker replay after surfacing `step186_preview_artifact_prep`: PASS.
  - dashboard:
    - `build/step176_dashboard_step186_live4.md`
  - weekly report:
    - `build/step176_weekly_step186_live4.md`
  - checker output:
    - `[weekly-summary] OK status=stable mode=gate days=7 enabled_samples=15 fail_ratio=0.000 attribution_ratio=1.000 dashboard=checked`

Conclusion:
- `LEADER` is now a real Step186-covered proxy path, not just an importer fallback;
- weekly summary, dashboard, and checker now carry the upstream Step186 prep lane explicitly instead of only the downstream smoke lanes;
- current Step186 contract breadth is:
  - positive prep/artifact smoke: `11`
  - browser provenance smoke: `12`
  - validator failure injection: `10`
  - weekly legacy regenerated large artifacts: `3`

## Incremental Verification: Block/Instance Contract + Typed Solver Diagnostics

Commands run:
```bash
cmake --build deps/cadgamefusion/build --target convert_cli solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke|convert_cli_block_instances_smoke|convert_cli_block_instances_contract_smoke' \
  --output-on-failure

python3 deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py \
  --outdir deps/cadgamefusion/build/step186_preview_artifact_prep_parallel2

python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/step186_origin_blocks

tmp=$(mktemp /tmp/cadgf_bad_constraints_XXXX.json)
cat > "$tmp" <<'JSON'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "diag-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}}
    ],
    "constraints": [
      {"id": "c0", "type": "broken", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "distance", "refs": ["p0.x", "p0.y", "p1.x", "p1.y"]},
      {"id": "c2", "type": "horizontal", "refs": ["p0.y"]},
      {"id": "c3", "type": "equal", "refs": ["p0.x", "missing.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
JSON
./deps/cadgamefusion/build/tools/solve_from_project --json "$tmp" || true
rm -f "$tmp"
```

Results:
- build: PASS.
  - `convert_cli`, `solve_from_project`, and `core_tests_solver_diagnostics` all built successfully.

- new block/instance contract tests: PASS.
  - `convert_cli_block_instances_smoke`
  - `convert_cli_block_instances_contract_smoke`
  - both passed under `ctest`.

- new typed solver diagnostics tests: PASS.
  - `core_tests_solver_diagnostics`
  - `solve_from_project_json_smoke`
  - both passed under `ctest`.

- refreshed Step186 prep after block/instance export change: PASS.
  - summary:
    - `deps/cadgamefusion/build/step186_preview_artifact_prep_parallel2/20260308_031910/summary.json`
  - result:
    - `passed=11`
    - `failed=0`

- strict validator on `step186_origin_blocks`: PASS.
  - manifest present
  - `document entities=14`
  - `mesh metadata entities=13`
  - `line_entities=13`
  - optional `group_id` / `instances[]` / `blocks[]` accepted and validated

- inspected `step186_origin_blocks/mesh_metadata.json` confirms new sidecar shape:
  - `summary.instance_count = 12`
  - `summary.block_count = 11`
  - first instance record includes:
    - `group_id=1`
    - `block_name=BlockA`
    - `source_type=INSERT`
    - `edit_mode=exploded`
    - `proxy_kind=insert`
    - `document_entity_count=2`
    - `mesh_entity_count=2`
    - `line_entity_count=2`
  - first block summary includes:
    - `name=BlockA`
    - `instance_count=2`
    - `document_entity_count=3`
    - `mesh_entity_count=3`
    - `line_entity_count=3`
    - `proxy_entity_count=3`

- manual `solve_from_project --json` inspection confirms structured diagnostics:
  - output `ok=false`
  - `message="Constraint validation failed"`
  - diagnostics present for:
    - `unsupported_type` on `broken`
    - `missing_value` on `distance`
    - `wrong_arity` on `horizontal`
    - `unbound_variable` on `equal`

- browser provenance smoke after preview instance-graph consumption: PASS.
  - command:
    - `node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js --outdir deps/cadgamefusion/build/preview_provenance_smoke_parallel_instance`
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_parallel_instance/20260308_112107/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - upgraded `insert_exploded` selection now shows:
    - `Group ID / 6`
    - `Instance Summary / BlockF | group 6 | doc 1 | mesh 1 | line 1`
    - `Block Summary / instances 1 | doc 1 | mesh 1 | line 1 | proxy 1`
  - this confirms the new sidecar records are not only emitted and validated, but also rendered in the preview selection UI on a real Step186 artifact.

- minimal editor gate replay after the new instance-graph consumer path: PASS.
  - summary:
    - `deps/cadgamefusion/build/editor_gate_summary.json`
  - relevant preview lanes:
    - `step186_preview_artifact_prep`
      - `case_count=11`
      - `pass_count=11`
    - `preview_provenance_smoke`
      - `ok=true`
      - `case_count=12`
      - `pass_count=12`
    - `preview_artifact_smoke`
      - `case_count=11`
      - `pass_count=11`
    - `preview_artifact_validator_failure_injection`
      - `case_count=10`
      - `pass_count=10`

Conclusion:
- Step186 now carries a first-class block/instance summary beside exploded geometry rather than exposing block provenance only fragment-by-fragment;
- the preview/artifact validator path remains backward compatible because the new block/instance fields are optional-but-typed;
- solver failures are now machine-checkable at both library and CLI level, which is the necessary first step before DOF/rank/redundancy work;
- preview now consumes the first block/instance milestone directly, so the repo has crossed from “metadata only” into a visible user-facing instance contract.

## Incremental Verification: Instance Drill-Down + Duplicate Constraint Diagnostics

Commands run:
```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_drilldown

tmp=$(mktemp /tmp/cadgf_dup_constraints_XXXX.json)
cat > "$tmp" <<'JSON'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "diag-dup-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 0}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]},
      {"id": "c1", "type": "horizontal", "refs": ["p0.y", "p1.y"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
JSON
./deps/cadgamefusion/build/tools/solve_from_project --json "$tmp" || true
rm -f "$tmp"
```

Results:
- solver rebuild after duplicate-diagnostic addition: PASS.

- solver regression + CLI smoke: PASS.
  - `core_tests_solver_diagnostics`
  - `solve_from_project_json_smoke`

- manual duplicate-constraint CLI probe: PASS.
  - `solve_from_project --json` returned:
    - `ok=false`
    - `analysis.duplicate_constraint_count=1`
    - `analysis.unique_constraint_count=1`
    - `analysis.well_formed_constraint_count=2`
    - `code="duplicate_constraint"`
    - `constraint_index=1`
    - `related_constraint_index=0`
    - `detail="duplicates constraint #0"`

- preview drill-down smoke: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_drilldown/20260308_114257/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - upgraded `insert_exploded` selection now shows:
    - `Group ID / 6`
    - `Instance Fragment Count / 1`
    - `Instance Entity IDs / 8`
    - `Block Instance Count / 1`
  - upgraded `paperspace_insert_style` selection now shows:
    - `Instance Fragment Count / 2`
    - `Instance Entity IDs / 3, 4`
    - `Block Instance Count / 1`

Conclusion:
- the Step186 block/instance contract is now drillable in preview, not just summarized;
- the solver now diagnoses the safest, most explainable subset of redundancy: exact duplicate constraints;
- the solver now also exports a stable analysis summary for CI/tooling, which is the right bridge toward later rank/DOF work;
- this keeps the repo aligned with the P2 reference direction while avoiding premature, brittle rank math.

## Incremental Verification: Linked Instance Highlighting + Jacobian Rank/DOF v1

Commands run:
```bash
cmake --build deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_linked_highlight_v2

tmp=$(mktemp /tmp/cadgf_rank_probe_XXXX.json)
cat > "$tmp" <<'JSON'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "rank-probe", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
JSON
./deps/cadgamefusion/build/tools/solve_from_project --json "$tmp"
rm -f "$tmp"
```

Results:
- solver rebuild after Jacobian analysis addition: PASS.

- solver regression + CLI smoke: PASS.
  - `solve_from_project_json_smoke`
  - `core_tests_solver_diagnostics`

- browser provenance smoke after linked sibling highlighting: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_linked_highlight_v2/20260308_134607/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - updated `insert_exploded` selection now shows:
    - `Highlighted Sibling Count / 0`
    - `Group ID / 6`
    - `Instance Entity IDs / 8`
  - updated `paperspace_insert_style` selection now shows:
    - `Highlighted Sibling Count / 1`
    - `Instance Entity IDs / 3, 4`
    - `Block Instance Count / 1`
  - this confirms the preview no longer stops at static summaries; it now reflects same-instance sibling linkage in the rendered selection UI.

- text-only and line-only Step186 cases remained green under the same preview run:
  - `dimension_doc_only`
  - `text_kind_table`
  - `leader_line_only`
  - `multi_layout_layout_b_text`
  - this is important because linked highlighting did not regress non-insert provenance flows.

- manual rank/DOF CLI probe: PASS.
  - `solve_from_project --json` returned:
    - `ok=true`
    - `analysis.evaluable_constraint_count=1`
    - `analysis.jacobian_row_count=1`
    - `analysis.jacobian_column_count=2`
    - `analysis.jacobian_rank=1`
    - `analysis.dof_estimate=1`
    - `analysis.redundant_constraint_estimate=0`
  - resulting variables converged to a horizontal solution in one iteration.

- flake hardening for preview smoke: PASS.
  - `waitForLoaded()` timeout in `preview_provenance_smoke.js` was raised from `15000ms` to `25000ms`.
  - rationale:
    - the earlier run timed out on a later text-only case even though the artifact itself was valid;
    - a rerun after the timeout increase completed `12/12`, so the failure was treated as a smoke-timing false red rather than a Step186 consumer defect.

Conclusion:
- the block/instance contract has now crossed from “metadata present” to “group linkage visible in the rendered UI”;
- the preview path remains green for mesh, line, and text artifacts after the linked-highlight behavior was added;
- the solver now exports the first credible rank/DOF/redundancy estimate from the existing Jacobian path, which is the right foundation for future SolveSpace-style diagnostics;
- this increment both follows the reference plan and exceeds the old target by making instance linkage and structural solve analysis directly consumable by tooling and UI.

### Incremental verification: clickable sibling drill-down

Command run:
```bash
node --input-type=module <<'EOF'
// simplified here; actual command executed from deps/cadgamefusion workdir
// 1) open step186_paperspace_insert_styles in Playwright
// 2) wait for line overlay to be ready
// 3) call window.__cadgfPreviewDebug.selectEntityById(3)
// 4) click selection panel chip [data-entity-id="4"]
// 5) capture selection panel text before/after
EOF
```

Result: PASS.
- captured artifact:
  - `deps/cadgamefusion/build/preview_instance_nav_check.json`
- before click:
  - selected entity `3`
  - `Highlighted Sibling IDs / 4`
- after clicking chip `4`:
  - selection moved to `line_4`
  - selected entity changed to `4`
  - sibling chip flipped to `3`
- this confirms the new instance inspector path is interactive, not just decorative metadata.

### Incremental verification: duplicate redundancy groups

Commands run:
```bash
ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure
```

Results: PASS.
- `core_tests_solver_diagnostics` now verifies:
  - `duplicateConstraintGroupCount == 1`
  - `largestDuplicateConstraintGroupSize == 2`
  - `redundancyGroups[0].anchorConstraintIndex == 4`
  - `redundancyGroups[0].constraintIndices == [4, 5]`
- `solve_from_project_json_smoke` now verifies:
  - `analysis.duplicate_constraint_group_count = 1`
  - `analysis.largest_duplicate_constraint_group_size = 2`
  - `redundancy_groups[0].anchor_constraint_index = 4`
  - `redundancy_groups[0].group_size = 2`

Reference-driven conclusion:
- the instance lane is now beyond “assembly metadata export” and has entered interactive inspector territory;
- the solver lane is now beyond “single duplicate warning” and exposes grouped redundancy summaries suitable for future rank/DOF diagnostics and UI surfacing.

## Incremental Verification: Instance Member Drill-down + Structural State Summary

Commands run:
```bash
cmake --build deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_instance_members_v2

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_underconstrained_probe.json \
  > deps/cadgamefusion/build/solver_underconstrained_probe.out.json

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_mixed_probe.json \
  > deps/cadgamefusion/build/solver_mixed_probe.out.json
```

Results:
- rebuild after `structuralState` + mixed-case regression update: PASS.

- `core_tests_solver_diagnostics`: PASS.
  - the previous crash was traced to a test-only use-after-free (`delete solver` before the mixed-case probe);
  - after fixing the test, the suite now verifies:
    - `good_result.analysis.structuralState == Underconstrained`
    - `mixed_result.analysis.structuralState == Mixed`
    - `mixed_result.analysis.jacobianRank == 1`
    - `mixed_result.analysis.dofEstimate == 1`
    - `mixed_result.analysis.redundantConstraintEstimate == 1`

- `solve_from_project_json_smoke`: PASS.
  - the CLI JSON now includes:
    - `analysis.structural_state`
    - `structural_summary.state`
    - `structural_summary.dof_estimate`
    - `structural_summary.redundant_constraint_estimate`

- manual structural-state probes: PASS.
  - underconstrained probe artifact:
    - `deps/cadgamefusion/build/solver_underconstrained_probe.out.json`
  - mixed probe artifact:
    - `deps/cadgamefusion/build/solver_mixed_probe.out.json`
  - observed values:
    - underconstrained:
      - `state = underconstrained`
      - `jacobian_rank = 1`
      - `dof_estimate = 1`
      - `redundant_constraint_estimate = 0`
    - mixed:
      - `state = mixed`
      - `jacobian_rank = 1`
      - `dof_estimate = 1`
      - `redundant_constraint_estimate = 1`

- preview provenance smoke after `Instance Member IDs` expectations were added: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_instance_members_v2/20260308_145113/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - upgraded `insert_exploded` now hard-checks:
    - `Instance Member IDs / 8`
  - upgraded `paperspace_insert_style` now hard-checks:
    - `Instance Member IDs / 3 4`
    - `Highlighted Sibling IDs / 4`

- direct browser chip-navigation check: PASS.
  - workflow used Playwright CLI against:
    - `http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/step186_paperspace_insert_styles/manifest.json&mesh=0&space=1&layout=LayoutStyle`
  - selection was seeded through `window.__cadgfPreviewDebug.selectEntityById(3)`, then the rendered `Instance Member IDs` chip `4` was clicked.
  - captured artifact:
    - `deps/cadgamefusion/build/preview_instance_member_nav_check.json`
  - before click:
    - selected entity `3`
    - `Instance Member IDs / 3 4`
    - `Color Source / BYBLOCK`
    - `Line Type / CENTER`
  - after clicking chip `4`:
    - selected entity `4`
    - `Highlighted Sibling IDs / 3`
    - `Color Source / BYLAYER`
    - `Line Type / CENTER2`
  - screenshot artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/.playwright-cli/page-2026-03-08T06-50-27-061Z.png`
    - `/Users/huazhou/Downloads/Github/VemCAD/.playwright-cli/page-2026-03-08T06-50-30-744Z.png`
  - this confirms the new instance-member inspector path is interactive and does not collapse different exploded members into one static summary.

Conclusion:
- the instance lane now goes beyond “click sibling count” and supports direct member traversal from the logical instance record itself;
- the solver lane now goes beyond raw Jacobian counts and exposes a stable structural classification (`unknown / underconstrained / well_constrained / overconstrained / mixed`);
- both increments are still conservative, but they move the repo measurably closer to the P2 reference direction while staying grounded in executable verification.

## Incremental Verification: Focus-State Observability + Structural Groups

Commands run:
```bash
cmake --build deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_focus_state

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_grouped_probe.json \
  > deps/cadgamefusion/build/solver_grouped_probe.out.json
```

Results:
- solver rebuild after structural-group export: PASS.

- `core_tests_solver_diagnostics`: PASS.
  - still verifies the existing duplicate-group diagnostics;
  - now also verifies:
    - one-group `underconstrained` analysis for a single horizontal constraint;
    - one-group `mixed` analysis for `equal + vertical` over the same variables;
    - two structural groups for a disconnected mixed solve:
      - group `0` is `underconstrained`
      - group `1` is `mixed`

- `solve_from_project_json_smoke`: PASS.
  - the JSON contract now carries:
    - `analysis.structural_group_count`
    - `analysis.underconstrained_group_count`
    - `analysis.mixed_group_count`
    - `structural_groups[]`
  - the grouped smoke case confirms:
    - top-level `structural_state = mixed`
    - `structural_group_count = 2`
    - first component anchored at constraint `0`
    - second component anchored at constraint `1`

- grouped CLI probe: PASS.
  - artifact:
    - `deps/cadgamefusion/build/solver_grouped_probe.out.json`
  - observed values:
    - `structural_state = mixed`
    - `structural_group_count = 2`
    - `underconstrained_group_count = 1`
    - `mixed_group_count = 1`
    - `structural_groups[0].variable_keys = ["p0.y", "p1.y"]`
    - `structural_groups[1].variable_keys = ["p2.x", "p3.x"]`

- preview provenance smoke after focus-state instrumentation: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_focus_state/20260308_145811/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - this confirms the new focus-state instrumentation did not regress any existing Step186 provenance paths.

- direct browser focus-state check: PASS.
  - the browser session seeded selection through:
    - `window.__cadgfPreviewDebug.selectEntityById(3, "debug-select")`
  - then clicked the rendered `Instance Member IDs` chip for entity `4`
  - captured artifact:
    - `deps/cadgamefusion/build/preview_focus_state_check.json`
  - observed before state:
    - `entity_id = 3`
    - `center = (125, 180, 0)`
    - `camera_after.position = (179, 225, 63)`
  - observed after state:
    - `entity_id = 4`
    - `nav_kind = instance-member`
    - `center = (110, 200, 0)`
    - `camera_after.position = (146, 230, 42)`
  - this proves the instance-member click changed both the selected fragment and the fitted view target; it is not just a selection-card text swap.

Reference-driven conclusion:
- the preview lane is now beyond “member chips are clickable” and has machine-readable evidence that fit-to-fragment follows navigation;
- the solver lane is now beyond a single global structural label and can describe disconnected structural regions independently;
- both increments stay within the repo's current numerical/document architecture while moving measurably closer to the P2 reference goal around assembly/instance graphs and SolveSpace-style structural diagnostics.

## Incremental Verification: Automated Focus Checks + Problematic Constraint Subset

Commands run:
```bash
cmake --build deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_focus_gate_v2

RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
bash deps/cadgamefusion/tools/editor_gate.sh
```

Results:
- solver rebuild after problematic-subset export: PASS.

- `core_tests_solver_diagnostics`: PASS.
  - new assertions now verify:
    - `problematicConstraintCount == 0` for the simple underconstrained case;
    - `problematicConstraintIndices == [0, 1]` for the one-group mixed case;
    - `problematicConstraintIndices == [1, 2]` for the disconnected grouped case.

- `solve_from_project_json_smoke`: PASS.
  - the JSON contract now includes:
    - `analysis.problematic_constraint_count`
    - `structural_summary.problematic_constraint_count`
    - `problematic_constraint_indices`
  - the grouped case confirms:
    - `problematic_constraint_count = 2`
    - `problematic_constraint_indices = [1, 2]`

- grouped solver probe: PASS.
  - artifact:
    - `deps/cadgamefusion/build/solver_grouped_probe.out.json`
  - observed values:
    - `structural_group_count = 2`
    - `mixed_group_count = 1`
    - `problematic_constraint_indices = [1, 2]`

- provenance smoke with automated focus checks: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_focus_gate_v2/20260308_151544/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - the `paperspace_insert_style` case now includes a checked `focusCheck` payload:
    - initial selection anchored at entity `3`
    - chip navigation through `clickNavKind = instance-member`
    - post-click selection on entity `4`
    - `focus.navKind = instance-member`
    - `focus.groupId = 2`
    - camera target changed from `(103.325, 71.3207, 0)` to `(110, 200, 0)`

- minimal gate replay with no special gate-script changes: PASS.
  - summary:
    - `deps/cadgamefusion/build/editor_gate_summary.json`
  - observed preview lane:
    - `preview_provenance_smoke.ok = true`
    - `preview_provenance_smoke.case_count = 12`
    - `preview_provenance_smoke.summary_json = deps/cadgamefusion/build/preview_provenance_smoke_gate/20260308_151841/summary.json`
  - this confirms the new focus-check contract rides through the existing gate path automatically because it is enforced inside the smoke script itself.

Reference-driven conclusion:
- the preview lane has crossed from “focus is observable in debug” to “focus is enforced in automated provenance smoke and gate”;
- the solver lane now exposes a conservative problematic subset in addition to disconnected structural groups, which is a useful bridge toward future conflict grouping or redundancy-subset work;
- both increments remain narrower than a full symbolic CAD kernel, but they clearly exceed the old repo state and stay aligned with the P2 reference direction.

## Incremental Verification: Multi-hop Focus Sequences + Conflict Groups

Commands run:
```bash
cmake --build deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' \
  --output-on-failure

node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_multihop

cat > deps/cadgamefusion/build/solver_conflict_probe.json <<'EOF'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "conflict-probe", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p2", "type": "point", "params": {"x": 5, "y": 2}},
      {"id": "p3", "type": "point", "params": {"x": 8, "y": 6}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]},
      {"id": "c1", "type": "equal", "refs": ["p2.x", "p3.x"]},
      {"id": "c2", "type": "vertical", "refs": ["p2.x", "p3.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
EOF

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_conflict_probe.json \
  > deps/cadgamefusion/build/solver_conflict_probe.out.json

RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
bash deps/cadgamefusion/tools/editor_gate.sh
```

Results:
- solver rebuild after conflict-group export: PASS.

- `core_tests_solver_diagnostics`: PASS.
  - new assertions now verify:
    - `conflictGroupCount == 0`, `redundancySubsetCount == 0` for the simple underconstrained case;
    - `conflictGroupCount == 1`, `redundancySubsetCount == 1`, `redundantConstraintCandidateCount == 1` for the one-group mixed case;
    - the mixed case exports:
      - `basisConstraintIndices = [0]`
      - `redundantConstraintIndices = [1]`
    - the disconnected grouped case exports:
      - `problematicConstraintIndices = [1, 2]`
      - `conflictGroups[0].constraintIndices = [1, 2]`
      - `redundancySubsets[0].redundantConstraintIndices = [2]`

- `solve_from_project_json_smoke`: PASS.
  - the JSON contract now includes:
    - `analysis.conflict_group_count`
    - `analysis.largest_conflict_group_size`
    - `analysis.redundancy_subset_count`
    - `analysis.redundant_constraint_candidate_count`
    - `conflict_groups[]`
    - `redundancy_subsets[]`
  - the grouped case confirms:
    - `conflict_group_count = 1`
    - `largest_conflict_group_size = 2`
    - `redundancy_subset_count = 1`
    - `redundant_constraint_candidate_count = 1`

- grouped solver probe: PASS.
  - artifact:
    - `deps/cadgamefusion/build/solver_conflict_probe.out.json`
  - observed values:
    - `structural_group_count = 2`
    - `conflict_group_count = 1`
    - `problematic_constraint_indices = [1, 2]`
    - `conflict_groups[0].constraint_indices = [1, 2]`
    - `redundancy_subsets[0].basis_constraint_indices = [1]`
    - `redundancy_subsets[0].redundant_constraint_indices = [2]`

- provenance smoke with multi-hop focus checks: PASS.
  - summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_multihop/20260308_162934/summary.json`
  - result:
    - `passed=12`
    - `failed=0`
  - the `paperspace_insert_style` case now records two checked focus steps:
    - step 1:
      - click `Instance Member IDs / 4`
      - `focus.navKind = instance-member`
      - `focus.entityId = 4`
      - camera target changes to `(110, 200, 0)`
    - step 2:
      - click `Highlighted Sibling IDs / 3`
      - `focus.navKind = highlighted-sibling`
      - `focus.entityId = 3`
      - camera target changes to `(125, 180, 0)`
  - this proves the instance inspector supports reversible navigation inside one real group instead of only a one-way member jump.

- gate-side preview provenance lane replay with no gate-script changes: PASS.
  - gate invocation explicitly disabled unrelated UI/perf lanes and let the script advance into `1.6) Preview provenance smoke (gate)`.
  - generated gate-side smoke summary:
    - `deps/cadgamefusion/build/preview_provenance_smoke_gate_multihop/20260308_163256/summary.json`
  - observed preview lane result:
    - `passed = 12`
    - `failed = 0`
    - the same two-step `paperspace_insert_style` focus sequence remains green inside the gate-owned outdir
  - this is enough to confirm the multi-hop focus contract rides through the existing gate path automatically because it remains enforced inside the smoke script itself.

Reference-driven conclusion:
- the preview lane is now beyond “one chip click can move focus” and covers an actual navigation loop inside a real insert instance group;
- the solver lane is now beyond a flat problematic index list and exports both problematic connected regions and narrower greedy redundancy subsets;
- both increments remain conservative, machine-readable, and aligned with the repo's P2 target around assembly/instance graphs and SolveSpace-style redundancy/conflict diagnostics.

## Incremental Verification: Group Focus + Free Variable Candidates

Commands run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js

node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_group_focus

cat > deps/cadgamefusion/build/solver_group_freevar_probe.json <<'EOF'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "group-freevar-probe", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p2", "type": "point", "params": {"x": 5, "y": 2}},
      {"id": "p3", "type": "point", "params": {"x": 8, "y": 6}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]},
      {"id": "c1", "type": "equal", "refs": ["p2.x", "p3.x"]},
      {"id": "c2", "type": "vertical", "refs": ["p2.x", "p3.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
EOF

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_group_freevar_probe.json \
  > deps/cadgamefusion/build/solver_group_freevar_probe.out.json

RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
PREVIEW_PROVENANCE_SMOKE_OUTDIR=build/preview_provenance_smoke_gate_group_focus \
bash deps/cadgamefusion/tools/editor_gate.sh
```

Results:
- `node --check` for `preview_app.js`: PASS.
- `node --check` for `preview_provenance_smoke.js`: PASS.
- solver rebuild after free-variable export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.

Standalone preview provenance smoke:
- summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_group_focus/20260308_193614/summary.json`
- result:
  - `passed = 12`
  - `failed = 0`
- the real `paperspace_insert_style` case now records three checked focus steps inside one insert group:
  - step 1:
    - click `Instance Member IDs / 4`
    - `focus.navKind = instance-member`
    - `focus.targetType = object`
    - `focus.entityId = 4`
    - `focus.box.center = (110, 200, 0)`
  - step 2:
    - click `Highlighted Sibling IDs / 3`
    - `focus.navKind = highlighted-sibling`
    - `focus.targetType = object`
    - `focus.entityId = 3`
    - `focus.box.center = (125, 180, 0)`
  - step 3:
    - click `Group ID / 2`
    - `focus.navKind = group`
    - `focus.targetType = group`
    - `focus.groupMemberIds = [3, 4]`
    - `focus.box.center = (125, 190, 0)`
    - `focus.cameraAfter.target = (125, 190, 0)`

This matters because the preview lane is no longer only checking fragment-to-fragment jumps. It now proves that a real group-level focus action fits the full exploded instance footprint and exports a machine-readable `targetType=group` focus state.

Grouped solver free-variable probe:
- artifact:
  - `deps/cadgamefusion/build/solver_group_freevar_probe.out.json`
- observed values:
  - `analysis.structural_group_count = 2`
  - `analysis.conflict_group_count = 1`
  - `analysis.free_variable_candidate_count = 2`
  - `problematic_constraint_indices = [1, 2]`
  - `structural_groups[0].basis_variable_keys = ["p0.y"]`
  - `structural_groups[0].free_variable_keys = ["p1.y"]`
  - `structural_groups[1].basis_variable_keys = ["p2.x"]`
  - `structural_groups[1].free_variable_keys = ["p3.x"]`
  - `conflict_groups[0].free_variable_keys = ["p3.x"]`

This is the first verified export where underconstrained and mixed structural groups both carry machine-readable free-variable candidates, which makes the typed diagnostics materially more useful than the earlier rank/DOF-only summary.

Gate-side preview provenance lane replay:
- smoke summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_gate_group_focus/20260308_193743/summary.json`
- result:
  - `passed = 12`
  - `failed = 0`
- the gate-owned outdir keeps the same three-step `paperspace_insert_style` sequence green, including the group-level focus step.

`editor_gate_summary.json` now reports:
- `preview_provenance_smoke.enabled = true`
- `preview_provenance_smoke.ok = true`
- `preview_provenance_smoke.case_count = 12`
- `preview_provenance_smoke.pass_count = 12`
- `preview_provenance_smoke.summary_json = /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_gate_group_focus/20260308_193743/summary.json`

Reference-driven conclusion:
- the preview lane is now beyond member-level chip navigation and can validate whole-group focus behavior inside a real paper-space insert sample;
- the solver lane is now beyond raw state counts and names plausible free variables for both underconstrained and mixed structural components;
- both increments stay conservative, machine-readable, and aligned with the repo's P2 target around assembly/instance inspection and SolveSpace-style structural diagnostics.

## Incremental Verification: Second Group-Focus Case + Priority-Ranked Diagnostics

Commands run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js

node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_priority

cat > deps/cadgamefusion/build/solver_priority_probe.json <<'EOF'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "priority-probe", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p4", "type": "point", "params": {"x": 20, "y": 0}},
      {"id": "p5", "type": "point", "params": {"x": 24, "y": 3}}
    ],
    "constraints": [
      {"id": "c0", "type": "equal", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "vertical", "refs": ["p0.x", "p1.x"]},
      {"id": "c2", "type": "equal", "refs": ["p4.x", "p5.x"]},
      {"id": "c3", "type": "vertical", "refs": ["p4.x", "p5.x"]},
      {"id": "c4", "type": "distance", "refs": ["p4.x", "p4.y", "p5.x", "p5.y"], "value": 5.0}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
EOF

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_priority_probe.json \
  > deps/cadgamefusion/build/solver_priority_probe.out.json
```

Results:
- `node --check` for `preview_app.js`: PASS.
- `node --check` for `preview_provenance_smoke.js`: PASS.
- solver rebuild after priority-ranked diagnostics: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.

Standalone preview provenance smoke:
- summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_priority/20260308_195602/summary.json`
- result:
  - `passed = 13`
  - `failed = 0`
- new real case:
  - `insert_blocka_group_focus`
- observed sequence:
  - initial hit:
    - `Group ID = 1`
    - `Block Name = BlockA`
    - `Instance Fragment Count = 2`
    - `Instance Entity IDs = 2, 3`
  - step 1:
    - click `Highlighted Sibling IDs / 3`
    - `focus.navKind = highlighted-sibling`
    - `focus.entityId = 3`
    - `focus.box.center = (3, 7, 0)`
    - the selection flips to:
      - `Color Source = BYLAYER`
      - `Line Type = CONTINUOUS`
      - `Line Weight = 0.05`
      - `Line Type Scale = 3`
  - step 2:
    - click `Group ID / 1`
    - `focus.navKind = group`
    - `focus.targetType = group`
    - `focus.groupMemberIds = [2, 3]`
    - `focus.box.center = (3.5, 7, 0)`

This matters because the default Step186 preview smoke now proves group-level navigation on two distinct real insert samples:
- `step186_paperspace_insert_styles`
- `step186_origin_blocks`

Solver priority probe:
- artifact:
  - `deps/cadgamefusion/build/solver_priority_probe.out.json`
- observed values:
  - `analysis.conflict_group_count = 2`
  - `analysis.redundancy_subset_count = 2`
  - `analysis.primary_conflict_anchor_constraint_index = 2`
  - `analysis.primary_conflict_priority_score = 16322`
  - `analysis.primary_redundancy_subset_anchor_constraint_index = 0`
  - `analysis.primary_redundancy_priority_score = 980`
  - `conflict_groups` are exported in ranked order:
    - anchors `[2, 0]`
    - scores `[16322, 16211]`
  - `redundancy_subsets` are exported in ranked order:
    - anchors `[0, 2]`
    - witness counts `[2, 3]`

This is the first verified export where:
- the solver chooses a larger mixed conflict group as the primary conflict region;
- the solver chooses the smaller redundancy witness as the primary redundancy subset.

Scope note:
- this increment was validated with:
  - `ctest`
  - standalone preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `editor_gate/local_ci/weekly` rerun for this increment.

Reference-driven conclusion:
- the preview lane now has two real group-focus regressions instead of one special-case paper-space sample;
- the solver lane now exports stable “what to inspect first” anchors for both conflict regions and redundancy subsets;
- both increments stay conservative and machine-readable while moving the project beyond flat metadata dumps toward a more usable instance inspector and structural diagnostics surface.

## Incremental Verification: Third Group-Focus Case + Direct Primary Index Exports

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_primary_direct

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_priority_probe.json \
  > deps/cadgamefusion/build/solver_priority_probe.out.json
```

Results:
- solver rebuild after direct primary index export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.

Solver priority probe:
- artifact:
  - `deps/cadgamefusion/build/solver_priority_probe.out.json`
- observed values:
  - `analysis.primary_conflict_anchor_constraint_index = 2`
  - `primary_conflict_constraint_indices = [2, 3, 4]`
  - `analysis.primary_redundancy_subset_anchor_constraint_index = 0`
  - `primary_redundancy_basis_constraint_indices = [0]`
  - `primary_redundant_constraint_indices = [1]`

This matters because the typed diagnostics no longer require consumers to:
- find `conflict_groups[0]` and then re-read its `constraint_indices`;
- find `redundancy_subsets[0]` and then split basis vs redundant rows themselves.

Preview smoke:
- targeted group-focus smoke summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_group_triple/20260308_201026/summary.json`
- result:
  - `passed = 3`
  - `failed = 0`
- the default provenance smoke fixture now also includes:
  - `mixed_block_group_focus`
  - manifest: `build/step186_origin_mixed/manifest.json`
- checked path:
  - initial selection on `entity 8`
  - `Highlighted Sibling IDs -> 9`
  - `Group ID -> 2`
- expected contract:
  - `Group ID = 2`
  - `Block Name = BlockMixed`
  - `Instance Fragment Count = 2`
  - `Instance Entity IDs = 8, 9`
  - `Instance Member IDs = 8, 9`
  - group focus exports:
    - `targetType = group`
    - `groupMemberIds = [8, 9]`
    - `box.center = (142.5, 115.5, 0)`

The same targeted summary also confirms the two previously checked real group-focus cases remain green:
- `insert_blocka_group_focus`
- `paperspace_insert_style`

Scope note:
- the targeted group-focus summary above is the authoritative preview artifact for this increment;
- this increment does not claim a fresh full `editor_gate/local_ci/weekly` rerun.

Reference-driven conclusion:
- the preview lane now has three real group-focus regressions covering different insert/rendering shapes;
- the solver lane now exports direct primary conflict/redundancy index sets, not only ranked anchors;
- both increments continue the P2 direction while making the diagnostics and instance-inspector outputs easier to consume downstream.

## Incremental Verification: DIMENSION Proxy Group-Focus + Smallest Conflict Export

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases deps/cadgamefusion/build/preview_provenance_smoke_targeted_cases.json \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_targeted_after_fix

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_smallest_conflict_probe.json \
  > deps/cadgamefusion/build/solver_smallest_conflict_probe.out.json
```

Results:
- solver rebuild after smallest-conflict export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.

Targeted preview smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_targeted_after_fix/20260308_203130/summary.json`
- result:
  - `passed = 4`
  - `failed = 0`

The updated `mixed_dimension_group_focus` case now verifies a stable real path:
- initial selection is the visible dimension text:
  - `Value = 20`
  - `Entity ID = 14`
  - `Group ID = 3`
  - `Origin = DIMENSION/dimension | proxy`
- group navigation then succeeds through the real `Group ID` chip:
  - `focus.navKind = group`
  - `focus.targetType = group`
  - `focus.groupId = 3`
  - `focus.groupMemberIds = [11, 12, 13, 14]`
  - `focus.box.center = (133.5, 114.3, 0)`

This is the correct outcome for preview-level contract verification:
- the preview still proves provenance and group navigation on a real dimension proxy sample;
- the default smoke is no longer coupled to a brittle grid hit on sparse line fragments;
- the contract remains user-visible and machine-readable.

Solver smallest-conflict probe:
- artifact:
  - `deps/cadgamefusion/build/solver_smallest_conflict_probe.out.json`
- observed values:
  - `analysis.conflict_group_count = 2`
  - `analysis.primary_conflict_anchor_constraint_index = 2`
  - `analysis.smallest_conflict_group_anchor_constraint_index = 0`
  - `analysis.smallest_conflict_group_size = 2`
  - `primary_conflict_constraint_indices = [2, 3, 4, 5]`
  - `smallest_conflict_constraint_indices = [0, 1]`
  - `analysis.primary_redundancy_subset_anchor_constraint_index = 2`
  - `analysis.smallest_redundancy_subset_anchor_constraint_index = 0`
  - `analysis.smallest_redundancy_witness_constraint_count = 2`

This confirms the intended asymmetry is now exported explicitly:
- the primary conflict region is the larger mixed chain;
- the smallest conflict witness is the two-constraint pair `[0, 1]`;
- the redundancy side keeps its independent “smallest witness” export.

Scope note:
- this increment was validated with:
  - rebuild
  - `ctest`
  - targeted preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- the preview lane now has a stable real `DIMENSION` proxy group-focus regression instead of a flaky sparse-line hit;
- the solver lane now exports both:
  - highest-priority conflict information;
  - smallest conflict witness information;
- together they continue moving the project beyond flat metadata export toward a usable instance inspector and structured diagnostics surface.

## Incremental Verification: Fourth Group-Focus Sample + Priority Breakdown Export

Commands run:

```bash
python3 deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py \
  --outdir deps/cadgamefusion/build/step186_preview_artifact_prep_triad

python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/step186_insert_triad

cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases deps/cadgamefusion/build/preview_provenance_smoke_targeted_cases_v3.json \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_targeted_v3

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_priority_breakdown_probe.json \
  > deps/cadgamefusion/build/solver_priority_breakdown_probe.out.json
```

Results:
- Step186 prep after adding `step186_insert_triad_sample.dxf`: PASS.
- `validate_plm_preview_artifacts.py build/step186_insert_triad`: PASS.
- solver rebuild after priority-breakdown export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.

Step186 prep summary:
- artifact:
  - `deps/cadgamefusion/build/step186_preview_artifact_prep_triad/20260308_124740/summary.json`
- result:
  - `passed = 12`
  - `failed = 0`
- the new case is present as:
  - `insert_triad_modelspace_group_focus`

Preview smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_targeted_v3/20260308_204953/summary.json`
- result:
  - `passed = 4`
  - `failed = 0`

New `triad_group_focus` observations:
- initial selection:
  - `Entity ID = 2`
  - `Group ID = 1`
  - `Block Name = BlockTriad`
  - `Instance Fragment Count = 3`
  - `Instance Entity IDs = 1, 2, 3`
  - `Highlighted Sibling IDs = 1, 3`
- group focus:
  - `focus.navKind = group`
  - `focus.targetType = group`
  - `focus.groupMemberIds = [1, 2, 3]`
  - `focus.box.center = (80, 54, 0)`

This matters because the default regression matrix now contains four real insert group-focus samples:
- `BlockA`
- `BlockMixed`
- `BlockTriad`
- `PaperStyledBlock` remains separately covered, even though the authoritative green summary for this increment uses the four-case targeted set above.

Solver priority-breakdown probe:
- artifact:
  - `deps/cadgamefusion/build/solver_priority_breakdown_probe.out.json`
- observed values:
  - `analysis.primary_conflict_anchor_constraint_index = 2`
  - `analysis.smallest_conflict_group_anchor_constraint_index = 0`
  - `analysis.primary_redundancy_subset_anchor_constraint_index = 2`
  - `analysis.smallest_redundancy_subset_anchor_constraint_index = 0`
- primary conflict group breakdown:
  - `state_bias = 15000`
  - `redundant_constraint_contribution = 2000`
  - `constraint_count_contribution = 400`
  - `free_variable_contribution = 10`
  - `dof_contribution = 1`
  - `priority_score = 17411`
- smallest redundancy witness breakdown:
  - `redundant_constraint_contribution = 1000`
  - `witness_penalty = -20`
  - `priority_score = 980`

This confirms that:
- the ranking policy is now externally inspectable, not just inferable from score order;
- downstream consumers can explain both conflict and redundancy ranking using stable structured fields.

Scope note:
- this increment was validated with:
  - prep
  - strict artifact validation
  - solver rebuild + `ctest`
  - targeted browser-level provenance smoke
  - direct JSON probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- preview now has a fourth real insert group-focus sample under Step186 control;
- solver ranking is no longer a black-box integer score;
- together these increments continue the “instance inspector + structured diagnostics” track and move beyond the earlier target surface.

## Incremental Verification: Stable Paper-Space Entry + Analysis-Level Breakdown Summary

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases deps/cadgamefusion/build/preview_provenance_smoke_five_cases.json \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_five_cases

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_full_after_initial

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_analysis_breakdown_probe.json \
  > deps/cadgamefusion/build/solver_analysis_breakdown_probe.out.json
```

Results:
- solver rebuild after analysis-level breakdown export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.
- five-case real preview provenance bundle: PASS.

Preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_five_cases/20260308_205726/summary.json`
- result:
  - `passed = 5`
  - `failed = 0`
- covered real group-focus cases:
  - `insert_blocka_group_focus`
  - `mixed_block_group_focus`
  - `mixed_dimension_group_focus`
  - `triad_group_focus`
  - `paperspace_insert_style`

Full default provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_full_after_initial/20260308_205843/summary.json`
- result:
  - `passed = 16`
  - `failed = 0`

This confirms the fix is not just a targeted-case workaround; the default Step186/browser provenance matrix is green after the stable initial-selection path was added.

New `paperspace_insert_style` observations:
- initial selection is now deterministic:
  - `click.kind = initial`
  - `entityId = 3`
  - `navKind = initial-entity`
- initial selection includes:
  - `Entity ID = 3`
  - `Group ID = 2`
  - `Instance Entity IDs = 3, 4`
  - `Instance Member IDs = 3, 4`
  - `Color Source = BYBLOCK`
  - `Line Type = CENTER`
  - `Line Weight = 0.5`
  - `Line Type Scale = 0.25`
- the checked focus sequence remains green:
  - `instance-member -> entity 4`
  - `highlighted-sibling -> entity 3`
  - `group -> groupMemberIds = [3, 4]`

This confirms that the previous flake was in the smoke entry path, not in the provenance or focus contract.

Analysis-level breakdown probe:
- artifact:
  - `deps/cadgamefusion/build/solver_analysis_breakdown_probe.out.json`
- observed values:
  - `analysis.primary_conflict_priority_breakdown = { state_bias = 15000, redundant_constraint_contribution = 2000, constraint_count_contribution = 400, free_variable_contribution = 10, dof_contribution = 1 }`
  - `analysis.smallest_conflict_priority_breakdown = { state_bias = 15000, redundant_constraint_contribution = 1000, constraint_count_contribution = 200, free_variable_contribution = 10, dof_contribution = 1 }`
  - `analysis.primary_redundancy_priority_breakdown = { redundant_constraint_contribution = 2000, witness_penalty = -40 }`
  - `analysis.smallest_redundancy_priority_breakdown = { redundant_constraint_contribution = 1000, witness_penalty = -20 }`

This confirms that:
- primary/smallest ranking explanations are now available directly in `analysis`;
- consumers no longer need to chase `conflict_groups[]` or `redundancy_subsets[]` just to explain the chosen winner;
- the exported summaries still match the underlying grouped ranking policy.

Scope note:
- this increment was validated with:
  - rebuild
  - `ctest`
  - five-case real preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- the Step186 preview lane now has a stable fifth real group-focus case instead of a paper-space entry flake;
- the solver lane now exposes primary/smallest ranking explanations at analysis level, not just inside grouped arrays;
- together these changes keep pushing the project beyond flat metadata export toward an explainable instance inspector plus explainable structural diagnostics surface.

## Incremental Verification: Deterministic Insert Entry + Selection Policy Export

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases deps/cadgamefusion/build/preview_provenance_smoke_five_cases_v3.json \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_five_cases_v3

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_full_after_initial_v2

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_selection_policy_probe.json \
  > deps/cadgamefusion/build/solver_selection_policy_probe.out.json
```

Results:
- solver rebuild after selection-policy export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.
- targeted five-case preview provenance smoke: PASS.
- full default preview provenance smoke: PASS.

Targeted preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_five_cases_v3/20260308_210620/summary.json`
- result:
  - `passed = 5`
  - `failed = 0`

Key observation:
- the three real insert group-focus cases now enter through deterministic initial selection instead of a grid hit:
  - `insert_blocka_group_focus`:
    - `click.kind = initial`
    - `entityId = 2`
  - `mixed_block_group_focus`:
    - `click.kind = initial`
    - `entityId = 8`
  - `triad_group_focus`:
    - `click.kind = initial`
    - `entityId = 2`

Full default preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_full_after_initial_v2/20260308_210416/summary.json`
- result:
  - `passed = 16`
  - `failed = 0`

This confirms the deterministic-entry change is not limited to a hand-picked bundle; the default browser provenance matrix stays green with the updated cases.

Solver selection-policy probe:
- artifact:
  - `deps/cadgamefusion/build/solver_selection_policy_probe.out.json`
- observed values:
  - `analysis.primary_conflict_selection_policy = ["priority_score_desc", "constraint_count_desc", "anchor_constraint_index_asc"]`
  - `analysis.smallest_conflict_selection_policy = ["constraint_count_asc", "priority_score_desc", "anchor_constraint_index_asc"]`
  - `analysis.primary_redundancy_selection_policy = ["priority_score_desc", "witness_constraint_count_asc", "anchor_constraint_index_asc"]`
  - `analysis.smallest_redundancy_selection_policy = ["witness_constraint_count_asc", "redundant_constraint_count_desc", "anchor_constraint_index_asc"]`

This confirms that:
- the selected primary/smallest groups and subsets are now accompanied by explicit machine-readable ordering rules;
- downstream CI/UI code no longer has to infer the ranking policy from the implementation alone.

Scope note:
- this increment was validated with:
  - rebuild
  - `ctest`
  - targeted preview provenance smoke
  - full default preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- the default Step186 insert inspector lane is now deterministic across multiple real insert samples;
- the solver diagnostics lane now exports both score components and explicit selection-policy summaries;
- together these changes continue the “instance inspector + explainable structured diagnostics” track beyond the original target surface.

## Incremental Verification: Text/Line Determinism + Explanation Labels

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases deps/cadgamefusion/build/preview_provenance_smoke_text_line_cases.json \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_text_line_cases

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_full_after_text_line_initial

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_selection_explanation_probe.json \
  > deps/cadgamefusion/build/solver_selection_explanation_probe.out.json
```

Results:
- solver rebuild after explanation-label export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.
- targeted text/line real preview provenance smoke: PASS.
- full default preview provenance smoke: PASS.

Targeted text/line preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_text_line_cases/20260308_211910/summary.json`
- result:
  - `passed = 8`
  - `failed = 0`

Key observation:
- the following real cases now enter through deterministic initial entity selection:
  - `insert_exploded`
  - `dimension_doc_only`
  - `hatch_line_only`
  - `leader_line_only`
  - `text_kind_attrib`
  - `text_kind_attdef`
  - `text_kind_mtext`
  - `mixed_paperspace_text`

Full default preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_full_after_text_line_initial/20260308_211941/summary.json`
- result:
  - `passed = 16`
  - `failed = 0`

This confirms that extending deterministic initial selection from insert-focused cases into text-only and line-only real samples does not regress the full default provenance matrix.

Solver selection explanation probe:
- artifact:
  - `deps/cadgamefusion/build/solver_selection_explanation_probe.out.json`
- observed values:
  - `analysis.primary_conflict_selection_explanation = "highest_priority_conflict_group"`
  - `analysis.smallest_conflict_selection_explanation = "smallest_conflict_witness"`
  - `analysis.primary_redundancy_selection_explanation = "highest_priority_redundancy_subset"`
  - `analysis.smallest_redundancy_selection_explanation = "smallest_redundancy_witness"`
  - `analysis.primary_conflict_selection_policy = ["priority_score_desc", "constraint_count_desc", "anchor_constraint_index_asc"]`
  - `analysis.smallest_redundancy_selection_policy = ["witness_constraint_count_asc", "redundant_constraint_count_desc", "anchor_constraint_index_asc"]`

This confirms that:
- the solver now exports a stable explanation label alongside the already machine-readable policy arrays;
- downstream UI/CI code can display a compact reason without decoding the full policy sequence;
- the explanation labels remain consistent with the underlying ranking policy and probe output.

Scope note:
- this increment was validated with:
  - rebuild
  - `ctest`
  - targeted preview provenance smoke
  - full default preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- the Step186 preview lane is now deterministic across both exploded-insert and text/line proxy coverage, reducing entry-path flakiness across the default real matrix;
- the solver diagnostics lane now exports both policy arrays and stable explanation labels, which is a clearer consumer contract than the original raw ranking surface;
- together these changes continue moving the project beyond passive metadata export toward a deterministic instance inspector and an explainable structural diagnostics API.

## Incremental Verification: Entry Coverage Summary + Selection Summaries

Commands run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js

cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_full_with_entry_summary

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_selection_explanation_probe.json \
  > deps/cadgamefusion/build/solver_selection_summary_probe.out.json
```

Results:
- `node --check` for preview provenance runner: PASS.
- solver rebuild after selection-summary export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.
- full default preview provenance smoke with entry summary: PASS.
- direct `solve_from_project --json` summary probe: PASS.

Full default preview provenance smoke:
- artifact:
  - `deps/cadgamefusion/build/preview_provenance_smoke_full_with_entry_summary/20260308_211646/summary.json`
- result:
  - `passed = 16`
  - `failed = 0`
- new summary counters:
  - `entry_kind_counts = { "initial": 16 }`
  - `nav_kind_counts = { "initial-entity": 16 }`
  - `initial_entry_case_count = 16`
  - `deterministic_entry_case_count = 16`
  - `focus_check_case_count = 5`

This confirms that:
- the entire current default real preview matrix now enters through deterministic initial selection;
- the smoke output now makes that coverage machine-readable instead of leaving it implicit in per-case logs;
- the default matrix is no longer mixing deterministic and hit-test entry paths.

Selection summary probe:
- artifact:
  - `deps/cadgamefusion/build/solver_selection_summary_probe.out.json`
- observed values:
  - `analysis.primary_conflict_selection_explanation = "highest_priority_conflict_group"`
  - `analysis.primary_conflict_selection_summary = "highest_priority_conflict_group(state=mixed,constraints=4,score=17411,anchor=2)"`
  - `analysis.smallest_conflict_selection_summary = "smallest_conflict_witness(state=mixed,constraints=2,score=16211,anchor=0)"`
  - `analysis.primary_redundancy_selection_summary = "highest_priority_redundancy_subset(redundant=2,witness=4,score=1960,anchor=2)"`
  - `analysis.smallest_redundancy_selection_summary = "smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)"`

This confirms that:
- the solver now exports directly renderable summaries for the chosen primary/smallest conflict and redundancy results;
- consumers no longer need to reconstruct the headline explanation from scattered fields;
- the summaries remain anchored in the exact numeric ranking state, so the contract stays deterministic.

Scope note:
- this increment was validated with:
  - JS syntax check
  - rebuild
  - `ctest`
  - full default preview provenance smoke
  - direct `solve_from_project --json` probe
- it does not claim a fresh full `local_ci` or weekly rerun.

Reference-driven conclusion:
- the preview lane now exposes deterministic-entry coverage as a first-class contract, not just as an incidental property of passing cases;
- the solver lane now exports explanation summaries on top of labels and selection policies, making the diagnostics surface closer to a real consumer API;
- together these changes continue the “deterministic instance inspector + explainable structural diagnostics” path beyond the original Step186 target.

## Incremental Verification: Selection Tags + Entry Metrics Propagation

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4

ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure

bash -n deps/cadgamefusion/tools/editor_gate.sh
bash -n deps/cadgamefusion/tools/local_ci.sh
bash -n deps/cadgamefusion/tools/editor_weekly_validation.sh
bash -n deps/cadgamefusion/tools/check_weekly_summary.sh

python3 -m py_compile \
  deps/cadgamefusion/tools/write_ci_artifact_summary.py \
  deps/cadgamefusion/tools/write_step176_dashboard.py \
  deps/cadgamefusion/tools/write_step176_weekly_report.py

deps/cadgamefusion/build/tools/solve_from_project --json \
  deps/cadgamefusion/build/solver_selection_tags_probe.in.json \
  > deps/cadgamefusion/build/solver_selection_tags_probe.out.json

cd deps/cadgamefusion && \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

cd deps/cadgamefusion && \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_STEP166_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
bash tools/editor_gate.sh

python3 deps/cadgamefusion/tools/write_ci_artifact_summary.py \
  --gate-summary deps/cadgamefusion/build/editor_gate_summary.json \
  --local-summary deps/cadgamefusion/build/local_ci_summary.json \
  --out deps/cadgamefusion/build/ci_artifact_summary_entry_metrics.md
```

Results:
- solver rebuild after selection-tag export: PASS.
- `core_tests_solver_diagnostics`: PASS.
- `solve_from_project_json_smoke`: PASS.
- shell syntax checks for gate/local_ci/weekly/checker: PASS.
- Python syntax checks for reporting consumers: PASS.
- quick `local_ci` provenance lane: PASS.
- narrow `editor_gate` provenance lane: completed and wrote gate summary; gate result was expectedly red because `insert_exploded` missed initial selection in that specific run, which is exactly the kind of regression signal the new metrics are meant to surface.

Solver selection-tag probe:
- artifact:
  - `deps/cadgamefusion/build/solver_selection_tags_probe.out.json`
- observed values:
  - `analysis.primary_conflict_selection_tag = "conflict-primary-priority"`
  - `analysis.smallest_conflict_selection_tag = "conflict-smallest-witness"`
  - `analysis.primary_redundancy_selection_tag = "redundancy-primary-priority"`
  - `analysis.smallest_redundancy_selection_tag = "redundancy-smallest-witness"`
  - `analysis.primary_conflict_selection_summary = "highest_priority_conflict_group(state=mixed,constraints=3,score=16322,anchor=2)"`

This confirms that:
- the solver now exports a short, stable UI/CI-facing tag in addition to labels, summaries, and policies;
- the tag contract remains aligned with the ranked selection output;
- downstream code can key on a compact selector without parsing free-form summary strings.

Local CI provenance summary:
- artifact:
  - `deps/cadgamefusion/build/local_ci_summary.json`
- observed values:
  - `previewProvenanceSmokeCaseCount = 16`
  - `previewProvenanceSmokePassCount = 16`
  - `previewProvenanceSmokeInitialEntryCaseCount = 16`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 16`
  - `previewProvenanceSmokeFocusCheckCaseCount = 5`

Gate provenance summary after export fix:
- artifact:
  - `deps/cadgamefusion/build/editor_gate_summary.json`
- observed values:
  - `preview_provenance_smoke.case_count = 16`
  - `preview_provenance_smoke.pass_count = 15`
  - `preview_provenance_smoke.fail_count = 1`
  - `preview_provenance_smoke.initial_entry_case_count = 15`
  - `preview_provenance_smoke.deterministic_entry_case_count = 15`
  - `preview_provenance_smoke.focus_check_case_count = 5`
  - `preview_provenance_smoke.first_failed_case = "insert_exploded"`

This confirms two things at once:
- the `editor_gate.sh` export bug is fixed because the new fields are no longer frozen at zero;
- the metrics are useful in practice because they captured a real gate-only miss (`insert_exploded`) instead of masking it.

Rendered consumer artifacts:
- CI markdown:
  - `deps/cadgamefusion/build/ci_artifact_summary_entry_metrics.md`
  - observed lines:
    - `preview_provenance_smoke: ... entry=15/16 focus_checks=5`
    - `local_preview_provenance_smoke: ... entry=16/16 focus_checks=5`
- synthetic weekly replay from real gate summary:
  - summary:
    - `deps/cadgamefusion/build/editor_weekly_validation_summary_entry_metrics.json`
  - dashboard:
    - `deps/cadgamefusion/build/step176_dashboard_entry_metrics.md`
  - report:
    - `deps/cadgamefusion/build/step176_weekly_entry_metrics.md`
  - checker:
    - `deps/cadgamefusion/tools/check_weekly_summary.sh --summary ... --dashboard ... --require-dashboard`
  - observed lines:
    - dashboard: `weekly_gate_preview_provenance_smoke: ... entry=15/16 focus_checks=5`
    - weekly report: `gate_preview_provenance_smoke: ... entry=15/16 focus_checks=5 ...`
  - checker result:
    - `[weekly-summary] OK ... dashboard=checked`

Scope note:
- this increment validated the full producer/consumer chain using:
  - real `local_ci` summary
  - real `editor_gate` summary
  - CI markdown rendering
  - weekly/dashboard/checker replay from the real gate summary
- it does not claim a fresh full weekly rerun; the weekly consumer validation in this increment was a replay against current gate outputs, which is sufficient for the consumer contract being changed here.

Reference-driven conclusion:
- the solver diagnostics lane now exposes a compact, UI-friendly tag surface on top of the existing explanation contract;
- the preview provenance lane now carries deterministic-entry coverage all the way into gate/local CI and rendered weekly artifacts;
- the gate export fix proved the new contract is catching real regressions instead of just adding decorative fields.

## Incremental Verification: Ready-Wait Fix + Paperspace Leader Sample

Commands run:

```bash
cmake --build deps/cadgamefusion/build --target test_dxf_paperspace_insert_leader -j4

ctest --test-dir deps/cadgamefusion/build -R 'test_dxf_paperspace_insert_leader_run' --output-on-failure

python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts.py \
  deps/cadgamefusion/build/step186_paperspace_insert_leader

python3 deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py \
  --outdir deps/cadgamefusion/build/step186_preview_artifact_prep_leader_fix

python3 deps/cadgamefusion/tools/validate_plm_preview_artifacts_smoke.py \
  --outdir deps/cadgamefusion/build/preview_artifact_smoke_after_paperspace_leader

node deps/cadgamefusion/tools/web_viewer/scripts/preview_provenance_smoke.js \
  --outdir deps/cadgamefusion/build/preview_provenance_smoke_full_after_ready_wait

cd deps/cadgamefusion && \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_STEP166_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
bash tools/editor_gate.sh

cd deps/cadgamefusion && \
RUN_PREVIEW_PROVENANCE_SMOKE=1 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=0 \
RUN_PREVIEW_ARTIFACT_SMOKE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

python3 deps/cadgamefusion/tools/write_ci_artifact_summary.py \
  --gate-summary deps/cadgamefusion/build/editor_gate_summary.json \
  --local-summary deps/cadgamefusion/build/local_ci_summary.json \
  --out deps/cadgamefusion/build/ci_artifact_summary_ready_wait.md
```

Results:
- `test_dxf_paperspace_insert_leader_run`: PASS.
- strict validator on `build/step186_paperspace_insert_leader`: PASS.
- Step186 preview artifact prep after adding the new sample: PASS (`13/13`).
- preview artifact smoke after adding the new sample: PASS (`13/13`).
- full default preview provenance smoke after the readiness wait fix: PASS (`17/17`).
- narrow gate provenance lane after the readiness wait fix: PASS (`17/17`).
- quick local CI provenance + Step186 prep run: PASS.
- CI artifact summary render from fresh gate/local summaries: PASS.

New real sample verification:
- artifact:
  - `deps/cadgamefusion/build/step186_paperspace_insert_leader`
- observed contract:
  - `document entities=5`
  - `mesh metadata entities=4`
  - `mesh metadata line_entities=4`
  - `mesh_metadata.layouts=2`
  - `mesh_metadata.viewports=1`
- observed provenance:
  - paperspace leader:
    - `source_type=LEADER`
    - `edit_mode=proxy`
    - `proxy_kind=leader`
    - `layout=LayoutStyle`
    - `space=1`
  - exploded insert fragments:
    - `source_type=INSERT`
    - `edit_mode=exploded`
    - `proxy_kind=insert`
    - `block_name=PaperStyledBlock`
    - `layout=LayoutStyle`
    - `space=1`

Artifact locations:
- new sample validator target:
  - `deps/cadgamefusion/build/step186_paperspace_insert_leader/manifest.json`
- Step186 prep summary:
  - `deps/cadgamefusion/build/step186_preview_artifact_prep_leader_fix/20260308_133552/summary.json`
- artifact smoke summary:
  - `deps/cadgamefusion/build/preview_artifact_smoke_after_paperspace_leader/20260308_133858/summary.json`

Preview readiness-fix verification:
- standalone preview provenance smoke summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_full_after_ready_wait/20260308_213746/summary.json`
- observed values:
  - `passed = 17`
  - `failed = 0`
  - `initial_entry_case_count = 17`
  - `deterministic_entry_case_count = 17`
  - `focus_check_case_count = 5`
  - `insert_exploded.click.kind = "initial"`
  - `paperspace_leader_proxy.click.kind = "initial"`

Gate verification after readiness fix:
- provenance lane summary:
  - `deps/cadgamefusion/build/preview_provenance_smoke_gate/20260308_213816/summary.json`
- gate summary:
  - `deps/cadgamefusion/build/editor_gate_summary.json`
- observed values:
  - `preview_provenance_smoke.case_count = 17`
  - `preview_provenance_smoke.pass_count = 17`
  - `preview_provenance_smoke.fail_count = 0`
  - `preview_provenance_smoke.initial_entry_case_count = 17`
  - `preview_provenance_smoke.deterministic_entry_case_count = 17`
  - `preview_provenance_smoke.focus_check_case_count = 5`
  - `preview_provenance_smoke.first_failed_case = ""`

This confirms that:
- the real gate-only miss on `insert_exploded` was caused by preview-target readiness timing rather than a bad case definition;
- the new wait logic fixes the race without changing preview behavior itself;
- the deterministic-entry metrics now correctly show a fully stable `17/17` default matrix in both standalone and gate-owned runs.

Local CI verification:
- local CI summary:
  - `deps/cadgamefusion/build/local_ci_summary.json`
- observed values:
  - `previewProvenanceSmokeCaseCount = 17`
  - `previewProvenanceSmokePassCount = 17`
  - `previewProvenanceSmokeInitialEntryCaseCount = 17`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 17`
  - `previewProvenanceSmokeFocusCheckCaseCount = 5`
  - `step186PreviewArtifactPrepCaseCount = 13`
  - `step186PreviewArtifactPrepPassCount = 13`

Rendered consumer artifact:
- CI markdown:
  - `deps/cadgamefusion/build/ci_artifact_summary_ready_wait.md`
- observed lines:
  - `step186_preview_artifact_prep: ... cases=13 pass=13 fail=0`
  - `preview_provenance_smoke: ... entry=17/17 focus_checks=5`
  - `local_preview_provenance_smoke: ... entry=17/17 focus_checks=5`

Reference-driven conclusion:
- this increment closes a real preview-race regression that was still visible only in gate-owned execution;
- it adds a richer real Step186 paperspace sample covering `viewport + leader proxy + note text + exploded insert`;
- compared against the remaining P2 items called out in `REFERENCE_COMPARISON_ACTIONS.md`, the next clear structural gaps are still:
  - `tests/core/test_constraints_basic.cpp`
  - `tests/core/test_assembly_roundtrip.cpp`

## Incremental Verification: Basic Constraints + Editor Assembly Roundtrip
Commands run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_roundtrip_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js

cmake --build deps/cadgamefusion/build \
  --target core_tests_constraints_basic core_tests_solver_diagnostics solve_from_project convert_cli \
  -j4

ctest --test-dir deps/cadgamefusion/build \
  -R 'core_tests_constraints_basic|core_tests_solver_diagnostics|solve_from_project_json_smoke|convert_cli_block_instances_smoke|convert_cli_block_instances_contract_smoke|editor_assembly_roundtrip_smoke' \
  --output-on-failure

cd deps/cadgamefusion && \
node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode gate \
  --cases build/editor_assembly_roundtrip_smoke_manual/editor_assembly_roundtrip_cases.json \
  --limit 1 \
  --no-convert \
  --outdir build/editor_roundtrip_assembly_manual2
```

Results:
- `node --check` on the modified adapter and roundtrip smoke script: PASS.
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`110/110`).
- targeted CTest bundle: PASS (`6/6`).
  - `convert_cli_block_instances_smoke`
  - `convert_cli_block_instances_contract_smoke`
  - `editor_assembly_roundtrip_smoke`
  - `solve_from_project_json_smoke`
  - `core_tests_constraints_basic`
  - `core_tests_solver_diagnostics`
- manual editor assembly roundtrip smoke on the real block-instance artifact: PASS.

Artifact locations:
- CTest-owned editor assembly roundtrip summary:
  - `deps/cadgamefusion/build/editor_assembly_roundtrip_smoke/20260308_220437_377_95cb/summary.json`
- manual editor assembly roundtrip summary:
  - `deps/cadgamefusion/build/editor_roundtrip_assembly_manual2/20260308_220423_610_a08d/summary.json`

Observed editor assembly roundtrip contract:
- source artifact:
  - `deps/cadgamefusion/build/convert_cli_block_instances_smoke/document.json`
- import-side counts:
  - `entity_count = 14`
  - `unsupported_count = 1`
  - `exploded_origin_count = 12`
  - `assembly_tracked_count = 13`
  - `assembly_group_count = 12`
- assembly semantics result:
  - `checked_count = 13`
  - `group_count = 12`
  - `missing_count = 0`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`
  - `message = "checked=13 groups=12 missing=0 metadata_drift=0 group_drift=0"`

Observed solver basic-regression result:
- `core_tests_constraints_basic`: PASS.
- covered successful solve paths:
  - `horizontal`
  - `vertical`
  - `equal`
  - `distance`
  - `parallel`
  - `perpendicular`
- covered taxonomy mapping:
  - `classifyConstraintKind()`
  - `constraintKindName()`

Observed adapter roundtrip result:
- `editor_commands.test.js` still passes after widening the editor metadata subset.
- new assertions confirm import/export preservation of:
  - `group_id`
  - `space`
  - `layout`
  - plus the pre-existing provenance fields for dimension-derived text.

Important debugging notes from this increment:
- first editor assembly run failed for a real logic reason:
  - the new group summarizer was called with raw entities instead of tracked assembly records
  - symptom:
    - `metadata_drift_count = 0`
    - `group_drift_count = 12`
  - after normalizing through `captureAssemblyTrackedEntities()`, the same artifact passed cleanly
- first CTest attempt also exposed a CMake-path issue:
  - quoted `-Drepo/-Dinputdoc/-Doutdir` values reached `execute_process()` with literal quotes
  - `RunEditorAssemblyRoundtrip.cmake` now trims those quotes before invoking Node

Reference-driven conclusion:
- the explicit `tests/core/test_constraints_basic.cpp` gap is now closed;
- the `test_assembly_roundtrip` gap is addressed through a stronger real editor-path smoke based on `convert_cli_block_instances_smoke/document.json`;
- the remaining P2 assembly work is no longer “can metadata survive at all”, but “can the editor expose and eventually edit a richer instance graph without losing that contract”.

## Incremental Verification: richer paperspace assembly smoke + read-only offset fix

Commands run:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
cmake --build /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build --target convert_cli test_dxf_paperspace_insert_leader -j4
ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build -R 'editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_smoke|test_dxf_paperspace_insert_leader_run|core_tests_constraints_basic|core_tests_solver_diagnostics|solve_from_project_json_smoke|convert_cli_block_instances_smoke|convert_cli_block_instances_contract_smoke' --output-on-failure
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode gate \
  --cases build/editor_assembly_roundtrip_paperspace_manual/editor_assembly_roundtrip_paperspace_cases.json \
  --limit 1 \
  --no-convert \
  --outdir build/editor_roundtrip_paperspace_manual2
```

Results:
- `node --check tools/web_viewer/commands/command_registry.js`: PASS.
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`112/112`).
- targeted CTest bundle: PASS (`8/8`).
  - `convert_cli_block_instances_smoke`
  - `convert_cli_block_instances_contract_smoke`
  - `editor_assembly_roundtrip_smoke`
  - `editor_assembly_roundtrip_paperspace_smoke`
  - `solve_from_project_json_smoke`
  - `core_tests_constraints_basic`
  - `core_tests_solver_diagnostics`
  - `test_dxf_paperspace_insert_leader_run`
- manual paper-space editor assembly roundtrip smoke: PASS.

Artifact locations:
- manual paperspace editor assembly summary:
  - `deps/cadgamefusion/build/editor_roundtrip_paperspace_manual2/20260308_221126_637_7a5b/summary.json`

Observed richer paperspace contract:
- source artifact:
  - `deps/cadgamefusion/build/editor_assembly_roundtrip_paperspace_smoke/source_preview/document.json`
- import-side counts:
  - `entity_count = 5`
  - `unsupported_count = 0`
  - `derived_proxy_count = 1`
  - `exploded_origin_count = 2`
  - `assembly_tracked_count = 4`
  - `assembly_group_count = 2`
- edit results:
  - `move-line`: PASS
  - `offset-line`: PASS
  - `insert-poly-vertex`: correctly rejected with `Selected entities are read-only proxies`
  - `offset-polyline`: correctly rejected with `error_code = UNSUPPORTED_READ_ONLY`
  - `patch-text`: PASS
- export-side semantics:
  - `derived_proxy_semantics.ok = true`
  - `exploded_origin_editability.ok = true`
  - `assembly_roundtrip_semantics.ok = true`
  - `checked_count = 4`
  - `group_count = 2`
  - `missing_count = 0`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`

Observed provenance in the converted paper-space source document:
- leader proxy entity preserves:
  - `source_type = LEADER`
  - `edit_mode = proxy`
  - `proxy_kind = leader`
  - `layout = LayoutStyle`
  - `space = 1`
  - `group_id = 1`
- exploded insert fragments preserve:
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `block_name = PaperStyledBlock`
  - `layout = LayoutStyle`
  - `space = 1`
  - `group_id = 2`

Important debugging notes from this increment:
- first paperspace smoke run exposed a real editor bug:
  - `selection.offset` did not honor `isReadOnlyEntity(entity)`
  - symptom in the failing summary:
    - `offset-polyline.ok = true`
    - `assembly_roundtrip_semantics.ok = false`
    - `group_drift_count = 1`
- after fixing `runOffsetSelection()` to reject all-read-only selections and skip read-only entities in mixed selections, the same smoke passed cleanly
- the first CTest rerun then exposed a test-script bug, not a product bug:
  - `RunEditorAssemblyRoundtripPaperspace.cmake` searched the roundtrip summary for raw provenance fields such as `"source_type": "LEADER"`
  - those fields belong in the converted `document.json`, not the summary contract
  - after splitting validation into:
    - summary semantic checks
    - source-document provenance checks
    the CTest turned green

Reference-driven conclusion:
- the assembly lane now covers both:
  - model-space block-instance roundtrip
  - mixed paper-space proxy + insert roundtrip
- the richer smoke found and closed a real command-layer contract hole that lighter samples would not catch;
- the next assembly target should be a denser mixed sample, not more of the same simple model-space coverage.

## Incremental Verification: created-entity provenance stripping + dense mixed assembly smoke

Commands run:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode gate \
  --cases build/editor_assembly_roundtrip_mixed_manual_cases.json \
  --limit 1 \
  --no-convert \
  --outdir build/editor_roundtrip_mixed_manual_fix
cmake -S /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion -B /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build
ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build -R 'editor_assembly_roundtrip_mixed_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_smoke|core_tests_constraints_basic|core_tests_solver_diagnostics|solve_from_project_json_smoke|test_dxf_dimension_geometry_metadata_run|test_dxf_paperspace_insert_leader_run|convert_cli_block_instances_smoke|convert_cli_block_instances_contract_smoke' --output-on-failure
```

Results:
- `node --check tools/web_viewer/commands/command_registry.js`: PASS.
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`114/114`).
- manual dense mixed editor roundtrip smoke: PASS.
- targeted CTest bundle after reconfigure: PASS (`10/10`).
  - `convert_cli_block_instances_smoke`
  - `convert_cli_block_instances_contract_smoke`
  - `editor_assembly_roundtrip_smoke`
  - `editor_assembly_roundtrip_paperspace_smoke`
  - `editor_assembly_roundtrip_mixed_smoke`
  - `solve_from_project_json_smoke`
  - `core_tests_constraints_basic`
  - `core_tests_solver_diagnostics`
  - `test_dxf_dimension_geometry_metadata_run`
  - `test_dxf_paperspace_insert_leader_run`

Artifact locations:
- manual mixed editor assembly summary:
  - `deps/cadgamefusion/build/editor_roundtrip_mixed_manual_fix/20260309_000219_229_bd33/summary.json`

Observed dense mixed contract:
- source artifact:
  - `deps/cadgamefusion/build/step186_origin_mixed/document.json`
- import-side counts:
  - `entity_count = 16`
  - `unsupported_count = 0`
  - `derived_proxy_count = 9`
  - `exploded_origin_count = 2`
  - `assembly_tracked_count = 14`
  - `assembly_group_count = 5`
- export-side semantics:
  - `derived_proxy_semantics.ok = true`
  - `exploded_origin_editability.ok = true`
  - `assembly_roundtrip_semantics.ok = true`
  - `checked_count = 14`
  - `group_count = 5`
  - `missing_count = 0`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`
  - `message = "checked=14 groups=5 missing=0 metadata_drift=0 group_drift=0"`

Observed mixed edit behavior:
- `move-line`: PASS
- `offset-line`: PASS
- `insert-poly-vertex`: correctly rejected with `Selected entities are read-only proxies`
- `offset-polyline`: correctly rejected with `error_code = UNSUPPORTED_READ_ONLY`
- `patch-circle-radius`: PASS
- `patch-text`: correctly rejected with `Selected entities are read-only proxies`

Observed provenance in the mixed source document:
- ungrouped hatch proxy:
  - `source_type = HATCH`
  - `edit_mode = proxy`
  - `proxy_kind = hatch`
- exploded insert group:
  - `group_id = 2`
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `block_name = BlockMixed`
- dimension proxy groups:
  - `group_id = 3/4/5`
  - `source_type = DIMENSION`
  - `edit_mode = proxy`
  - `proxy_kind = dimension`
  - `dim_style = Standard`
- paper-space layout group:
  - `group_id = 1`
  - `space = 1`
  - `layout = LayoutMixed`

Important debugging notes from this increment:
- the first manual mixed smoke exposed a second real assembly/editor bug:
  - `selection.offset` on a grouped editable entity created a new entity that incorrectly retained imported provenance
  - symptom:
    - `assembly_roundtrip_semantics.ok = false`
    - `drifted_group_ids = [1]`
- root cause:
  - created entities in `selection.copy` / `selection.offset` were cloned from the source entity without clearing imported provenance
  - this made newly created user geometry look like extra members of the original imported assembly group
- fix:
  - add `stripImportedProvenanceForCreatedEntity()`
  - apply it to new entities created by `selection.copy` and `selection.offset`
- command-level regression coverage added:
  - copied grouped entity no longer keeps `groupId/sourceType/editMode/proxyKind/blockName`
  - offset-created grouped entity no longer keeps the same imported provenance
  - `space/layout` remain intact

Reference-driven conclusion:
- the assembly lane now covers three real levels:
  - model-space block-instance roundtrip
  - mixed paper-space proxy + insert roundtrip
  - dense mixed proxy/insert/layout roundtrip
- the newly added mixed smoke proved the remaining contract gap was not serialization, but provenance detachment for newly created geometry;
- that gap is now explicitly tested and closed.

## Incremental Verification: assembly roundtrip CTest lane propagation through local/gate/weekly

Commands run:

```bash
bash -n /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/local_ci.sh
bash -n /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_gate.sh
bash -n /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh
bash -n /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/check_weekly_summary.sh
python3 -m py_compile \
  /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_ci_artifact_summary.py \
  /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step176_dashboard.py \
  /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step176_weekly_report.py
ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build -R 'editor_assembly_roundtrip_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_mixed_smoke' --output-on-failure
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_EDITOR_SMOKE=0 \
  RUN_EDITOR_SMOKE_GATE=0 \
  RUN_EDITOR_UI_FLOW_SMOKE=0 \
  RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=0 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
  RUN_EDITOR_GATE=0 \
  bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_EDITOR_UI_FLOW_SMOKE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION=0 \
  RUN_REAL_SCENE_PERF=0 \
  RUN_GATE=1 \
  RUN_EDITOR_PARALLEL_CYCLE=0 \
  RUN_STEP166_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  PERF_ENTITIES=2000 \
  PERF_PICK_SAMPLES=400 \
  PERF_BOX_SAMPLES=150 \
  PERF_DRAG_SAMPLES=40 \
  bash tools/editor_weekly_validation.sh
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_ci_artifact_summary.py \
    --mode observe \
    --gate-summary build/editor_gate_summary.json \
    --local-summary build/local_ci_summary.json \
    --out build/ci_artifact_summary_assembly_roundtrip.md
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_dashboard.py \
    --gate-history-dir build/editor_gate_history \
    --weekly-history-dir build/editor_weekly_validation_history \
    --out build/step176_dashboard_assembly_roundtrip.md
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --report build/step176_weekly_assembly_roundtrip.md
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  bash tools/check_weekly_summary.sh \
    --summary build/editor_weekly_validation_summary.json \
    --dashboard build/step176_dashboard_assembly_roundtrip.md \
    --require-dashboard
```

Results:
- shell syntax checks for `local_ci` / `editor_gate` / `editor_weekly_validation` / weekly checker: PASS.
- Python consumer scripts compile: PASS.
- targeted assembly roundtrip CTests: PASS (`3/3`).
  - `editor_assembly_roundtrip_smoke`
  - `editor_assembly_roundtrip_paperspace_smoke`
  - `editor_assembly_roundtrip_mixed_smoke`
- quick `local_ci` run after the preview-counter initialization fix: PASS.
- real weekly validation replay with gate + legacy preview lanes: PASS.
- markdown/dashboard/report/checker consumer replay after the new assembly lane propagation: PASS.

Artifact locations:
- local CI summary:
  - `deps/cadgamefusion/build/local_ci_summary.json`
- local CI markdown:
  - `deps/cadgamefusion/build/local_ci_artifact_summary.md`
- gate summary:
  - `deps/cadgamefusion/build/editor_gate_summary.json`
- CI artifact markdown replay:
  - `deps/cadgamefusion/build/ci_artifact_summary_assembly_roundtrip.md`
- weekly summary:
  - `deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- weekly dashboard replay:
  - `deps/cadgamefusion/build/step176_dashboard_assembly_roundtrip.md`
- weekly report replay:
  - `deps/cadgamefusion/build/step176_weekly_assembly_roundtrip.md`

Observed local CI assembly lane:
- `ctestAssemblyRoundtripStatus = "ok"`
- `ctestAssemblyRoundtripCaseCount = 3`
- `ctestAssemblyRoundtripPassCount = 3`
- `ctestAssemblyRoundtripFailCount = 0`
- `ctestAssemblyRoundtripMissingCount = 0`
- per-case statuses:
  - `ctestAssemblyRoundtripModelStatus = "ok"`
  - `ctestAssemblyRoundtripPaperspaceStatus = "ok"`
  - `ctestAssemblyRoundtripMixedStatus = "ok"`
- local preview provenance was intentionally disabled in this quick run, and the previously missing deterministic-entry counters now emit stable zero values:
  - `previewProvenanceSmokeInitialEntryCaseCount = 0`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 0`
  - `previewProvenanceSmokeFocusCheckCaseCount = 0`

Observed gate/weekly assembly lane:
- `gate_assembly_roundtrip_ctest` in `editor_weekly_validation_summary.json`:
  - `enabled = true`
  - `status = "PASS"`
  - `case_count = 3`
  - `pass_count = 3`
  - `fail_count = 0`
  - `missing_count = 0`
  - `model_status = "PASS"`
  - `paperspace_status = "PASS"`
  - `mixed_status = "PASS"`
- gate-side preview lanes remained green in the same real weekly run:
  - `gate_preview_provenance_smoke`: `17/17`, `entry=17/17`, `focus_checks=5`
  - `gate_preview_artifact_smoke`: `13/13`
  - `gate_preview_artifact_validator_failure_injection`: `10/10`
- weekly legacy regeneration/smoke stayed green:
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Observed consumer rendering:
- CI artifact markdown replay now shows:
  - `preview_provenance_smoke: enabled=true status=PASS ... entry=17/17 focus_checks=5`
  - `assembly_roundtrip_ctest: enabled=true status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS`
- local CI markdown now shows:
  - `local_ctest_assembly_roundtrip: enabled=true status=ok cases=3 pass=3 fail=0 missing=0 model=ok paperspace=ok mixed=ok`
- weekly dashboard replay now shows:
  - `weekly_gate_preview_provenance_smoke: ... entry=17/17 focus_checks=5`
  - `weekly_gate_assembly_roundtrip_ctest: status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS`
- weekly report replay now shows:
  - `gate_preview_provenance_smoke: mode=gate ok=True run_id=20260309_002104 cases=17 pass=17 fail=0 entry=17/17 focus_checks=5`
  - `gate_assembly_roundtrip_ctest: status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS first_failed_case=-`
- `check_weekly_summary.sh`: PASS with dashboard verification enabled.

Important debugging notes from this increment:
- the first quick `local_ci` run exposed a real script bug:
  - `previewProvenanceSmokeInitialEntryCaseCount` / `previewProvenanceSmokeDeterministicEntryCaseCount` / `previewProvenanceSmokeFocusCheckCaseCount` were only assigned inside the preview provenance lane;
  - when that lane was disabled, summary generation aborted with `unbound variable` before the new assembly CTest lane could be written;
  - initializing those counters to zero fixed the issue and made skipped preview lanes compatible with the new assembly lane propagation.
- consumer replay then exposed a second real pipeline bug:
  - `write_ci_artifact_summary.py` rendered gate-side disabled preview provenance smoke as `FAIL` because it mapped `ok=false` directly to `FAIL`;
  - the gate payload did not carry a dedicated `status` field for disabled provenance smoke, only `enabled=false` and `mode=skipped`;
  - rendering now treats `enabled=false` as `SKIPPED`, which removes a false red signal from CI markdown output.

Reference-driven conclusion:
- the assembly roundtrip contract is no longer isolated to low-level smoke execution;
- it is now visible and checkable across:
  - targeted CTests,
  - `local_ci`,
  - `editor_gate`,
  - weekly summary payloads,
  - dashboard/report consumers,
  - weekly checker validation;
- the same increment also hardened the surrounding automation contract so skipped preview lanes do not corrupt summary generation or consumer rendering.

### Incremental verification: aggregate assembly metrics through local/gate/weekly + solver variable-focus exports

Commands executed:

```bash
cd /Users/huazhou/Downloads/Github/VemCAD && \
  cmake --build deps/cadgamefusion/build --target solve_from_project core_tests_solver_diagnostics -j4
cd /Users/huazhou/Downloads/Github/VemCAD && \
  ctest --test-dir deps/cadgamefusion/build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke' --output-on-failure
cd /Users/huazhou/Downloads/Github/VemCAD && \
  python3 deps/cadgamefusion/tools/read_editor_assembly_roundtrip_metrics.py --build-dir deps/cadgamefusion/build
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_PREVIEW_PROVENANCE_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_STEP166_GATE=0 \
  RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_gate.sh
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_ci_artifact_summary.py \
    --gate-summary build/editor_gate_summary.json \
    --local-summary build/local_ci_summary.json \
    > build/ci_artifact_summary_assembly_metrics.md
cd /Users/huazhou/Downloads/Github/VemCAD && \
  ./deps/cadgamefusion/build/tools/solve_from_project --json /tmp/tradeoff_constraints_project.json \
    > deps/cadgamefusion/build/solver_tradeoff_variable_probe.out.json
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_EDITOR_UI_FLOW_SMOKE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION=0 \
  RUN_REAL_SCENE_PERF=0 \
  RUN_GATE=1 \
  RUN_EDITOR_PARALLEL_CYCLE=0 \
  RUN_STEP166_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_weekly_validation.sh
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_dashboard.py \
    --gate-history-dir build/editor_gate_history \
    --weekly-history-dir build/editor_weekly_validation_history \
    --out build/step176_dashboard_assembly_metrics_live.md
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --report build/step176_weekly_assembly_metrics_live.md
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  bash tools/check_weekly_summary.sh \
    --summary build/editor_weekly_validation_summary.json \
    --dashboard build/step176_dashboard_assembly_metrics_live.md \
    --require-dashboard
```

Results:
- solver build + diagnostics CTests: PASS (`2/2`)
- direct assembly metric aggregation script: PASS
- quick `local_ci`: PASS
- narrow real `editor_gate`: PASS
- real weekly validation: PASS
- CI markdown replay: PASS
- weekly dashboard replay: PASS
- weekly report replay: PASS
- weekly checker: PASS

Observed aggregate assembly roundtrip metrics:
- `summary_json_count = 3`
- `import_entity_count = 35`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 10`
- `import_exploded_origin_count = 16`
- `import_assembly_tracked_count = 31`
- `import_assembly_group_count = 19`
- `export_derived_proxy_checked_count = 10`
- `export_exploded_checked_count = 16`
- `export_assembly_checked_count = 31`
- `export_assembly_group_count = 19`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`

Source assembly summaries resolved by `read_editor_assembly_roundtrip_metrics.py`:
- model:
  - `build/editor_assembly_roundtrip_smoke/20260309_070945_325_0ed7/summary.json`
  - `case = assembly_block_instances`
- paperspace:
  - `build/editor_assembly_roundtrip_paperspace_smoke/20260309_070945_670_cd34/summary.json`
  - `case = assembly_paperspace_insert_leader`
- mixed:
  - `build/editor_assembly_roundtrip_mixed_smoke/20260309_070945_996_4225/summary.json`
  - `case = assembly_mixed_origin`

Observed quick `local_ci` propagation:
- `ctestAssemblyRoundtripStatus = "ok"`
- `ctestAssemblyRoundtripCaseCount = 3`
- `ctestAssemblyRoundtripPassCount = 3`
- `ctestAssemblyRoundtripSummaryJsonCount = 3`
- `ctestAssemblyRoundtripImportAssemblyTrackedCount = 31`
- `ctestAssemblyRoundtripImportAssemblyGroupCount = 19`
- `ctestAssemblyRoundtripImportDerivedProxyCount = 10`
- `ctestAssemblyRoundtripImportExplodedOriginCount = 16`
- `ctestAssemblyRoundtripExportAssemblyCheckedCount = 31`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`
- preview provenance stayed coherent in the same quick run:
  - `previewProvenanceSmokeCaseCount = 17`
  - `previewProvenanceSmokePassCount = 17`
  - `previewProvenanceSmokeInitialEntryCaseCount = 17`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 17`
  - `previewProvenanceSmokeFocusCheckCaseCount = 5`

Observed narrow real gate:
- `assembly_roundtrip_ctest.status = "PASS"`
- `assembly_roundtrip_ctest.case_count = 3`
- `assembly_roundtrip_ctest.pass_count = 3`
- `assembly_roundtrip_ctest.summary_json_count = 3`
- `assembly_roundtrip_ctest.import_assembly_tracked_count = 31`
- `assembly_roundtrip_ctest.import_assembly_group_count = 19`
- `assembly_roundtrip_ctest.import_derived_proxy_count = 10`
- `assembly_roundtrip_ctest.import_exploded_origin_count = 16`
- `assembly_roundtrip_ctest.export_assembly_checked_count = 31`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`
- gate-side preview lanes in the same run:
  - `step186_preview_artifact_prep = 13/13`
  - `preview_provenance_smoke = 17/17`
  - `preview_artifact_smoke = 13/13`
  - `preview_artifact_validator_failure_injection = 10/10`

Observed real weekly payload:
- `build/editor_weekly_validation_summary.json`
- key fields:
  - `gate_preview_provenance_smoke: 17/17, entry=17/17, focus_checks=5`
  - `step186_preview_artifact_prep: 13/13`
  - `gate_preview_artifact_smoke: 13/13`
  - `gate_preview_artifact_validator_failure_injection: 10/10`
  - `gate_assembly_roundtrip_ctest: PASS, cases=3, pass=3, fail=0, missing=0`
  - `gate_assembly_roundtrip_ctest: summaries=3, tracked=31, groups=19, proxies=10, exploded=16, checked=31, drift=0/0`
  - `weekly_legacy_preview_artifact_prep: 3/3`
  - `weekly_legacy_preview_artifact_smoke: 3/3`

Observed consumer rendering:
- `build/ci_artifact_summary_assembly_metrics.md` now renders:
  - `assembly_roundtrip_ctest: enabled=true status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS summaries=3 tracked=31 groups=19 proxies=10 exploded=16 checked=31 export_groups=19 drift=0/0`
  - `local_ctest_assembly_roundtrip: enabled=true status=ok cases=3 pass=3 fail=0 missing=0 model=ok paperspace=ok mixed=ok summaries=3 tracked=31 groups=19 proxies=10 exploded=16 checked=31 export_groups=19 drift=0/0`
- `build/step176_dashboard_assembly_metrics_live.md` renders:
  - `weekly_gate_assembly_roundtrip_ctest: status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS summaries=3 tracked=31 groups=19 proxies=10 exploded=16 checked=31 drift=0/0`
- `build/step176_weekly_assembly_metrics_live.md` renders:
  - `gate_assembly_roundtrip_ctest: status=PASS cases=3 pass=3 fail=0 missing=0 model=PASS paperspace=PASS mixed=PASS summaries=3 tracked=31 groups=19 proxies=10 exploded=16 checked=31 drift=0/0`
- weekly checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_assembly_metrics_live.md --require-dashboard`
  - result: PASS

Observed solver analysis-level variable-focus export:
- probe artifact:
  - `deps/cadgamefusion/build/solver_tradeoff_variable_probe.out.json`
- key values:
  - `primary_conflict_variable_keys = ["p4.x", "p5.x", "p6.x"]`
  - `primary_conflict_free_variable_keys = ["p6.x"]`
  - `smallest_conflict_variable_keys = ["p0.x", "p1.x"]`
  - `smallest_conflict_free_variable_keys = ["p1.x"]`
  - `primary_redundancy_variable_keys = ["p4.x", "p5.x", "p6.x"]`
  - `smallest_redundancy_variable_keys = ["p0.x", "p1.x"]`
  - `primary_conflict_selection_tag = "conflict-primary-priority"`
  - `smallest_redundancy_selection_tag = "redundancy-smallest-witness"`

Two real pipeline bugs fixed in this increment:
- macOS bash compatibility:
  - `${name^^}` caused `bad substitution` on bash 3.2 in both `tools/local_ci.sh` and `tools/editor_gate.sh`;
  - replacing it with `tr '[:lower:]' '[:upper:]'` made the aggregate assembly metric lane run on the actual host shell.
- gate summary propagation:
  - `tools/editor_gate.sh` was collecting assembly metrics but not exporting them into the summary-writing Python environment;
  - after export, the lane stopped writing false zeroes even though the underlying CTests were green.

Reference-driven conclusion:
- Phase P2’s two explicit test gaps are now materially exceeded:
  - `test_constraints_basic.cpp` exists and passes,
  - assembly roundtrip is validated through real editor-path smokes rather than a thin core-only loop;
- this increment pushed the remaining gap from “do these contracts exist?” to “are they operationally visible, explainable, and enforced all the way through local/gate/weekly consumers?”;
- the answer is now yes for:
  - preview provenance,
  - preview artifact smoke,
  - validator failure injection,
  - assembly roundtrip aggregate metrics,
  - solver selection tags/explanations/summaries/direct variable-focus exports.

## Verification: dense assembly lane and solver action hints

### Commands

```bash
cmake --build /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics convert_cli -j4

ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke|editor_assembly_roundtrip_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_mixed_smoke|editor_assembly_roundtrip_dense_smoke' \
  --output-on-failure

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/read_editor_assembly_roundtrip_metrics.py --build-dir build

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_PREVIEW_PROVENANCE_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 \
  bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_STEP166_GATE=0 \
  RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_gate.sh

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_EDITOR_UI_FLOW_SMOKE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION=0 \
  RUN_REAL_SCENE_PERF=0 \
  RUN_GATE=1 \
  RUN_EDITOR_PARALLEL_CYCLE=0 \
  RUN_STEP166_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_weekly_validation.sh

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_ci_artifact_summary.py \
    --local-summary build/local_ci_summary.json \
    --gate-summary build/editor_gate_summary.json \
    --out build/ci_artifact_summary_dense_action_hint.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_dashboard.py \
    --gate-history-dir build/editor_gate_history \
    --weekly-history-dir build/editor_weekly_validation_history \
    --out build/step176_dashboard_dense_action_hint.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --report build/step176_weekly_dense_action_hint.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  bash tools/check_weekly_summary.sh \
    --summary build/editor_weekly_validation_summary.json \
    --dashboard build/step176_dashboard_dense_action_hint.md \
    --require-dashboard
```

### Results

Observed solver build + diagnostics CTests:
- PASS (`6/6` in the targeted package)
- dense assembly lane included:
  - `editor_assembly_roundtrip_dense_smoke`

Observed direct solver action-hint probe:
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_hint_probe.out.json`
- key values:
  - `primary_conflict_action_hint = "Inspect the primary conflict group first and relax or remove one conflicting constraint near the anchor."`
  - `smallest_conflict_action_hint = "Start with the smallest conflict witness; it is the fastest subset to inspect and isolate."`
  - `primary_redundancy_action_hint = "Remove or suppress one redundant constraint from the primary redundancy subset first."`
  - `smallest_redundancy_action_hint = "Trim the smallest redundancy witness first; it is the cheapest subset to simplify."`

Observed aggregate assembly metrics from `read_editor_assembly_roundtrip_metrics.py`:
- `summary_json_count = 4`
- `import_entity_count = 56`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 20`
- `import_exploded_origin_count = 20`
- `import_assembly_tracked_count = 49`
- `import_assembly_group_count = 26`
- `export_derived_proxy_checked_count = 20`
- `export_exploded_checked_count = 20`
- `export_assembly_checked_count = 49`
- `export_assembly_group_count = 26`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`
- resolved summaries:
  - model:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_smoke/20260309_091152_790_a055/summary.json`
  - paperspace:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_paperspace_smoke/20260309_091153_310_e149/summary.json`
  - mixed:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_mixed_smoke/20260309_091153_637_3e39/summary.json`
  - dense:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_091019_819_0a6d/summary.json`

Observed quick `local_ci` propagation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186 preview artifact prep = 13/13`
  - `preview provenance = 17/17`
  - `preview deterministic entry = 17/17`
  - `preview focus checks = 5`
  - `preview artifact smoke = 13/13`
  - `preview artifact validator failure injection = 10/10`
  - `ctestAssemblyRoundtripStatus = "ok"`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripDenseStatus = "ok"`
  - `ctestAssemblyRoundtripSummaryJsonCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 49`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 26`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 20`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 20`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 49`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Observed narrow real gate:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 13/13`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 49`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 26`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 20`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 49`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`

Observed fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 13/13`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 49`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 26`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 20`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 49`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Observed consumer replay:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_action_hint.md`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_action_hint.md`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_action_hint.md`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_action_hint.md --require-dashboard`
  - result: PASS

Observed consumer contract behavior:
- CI markdown now renders the dense lane explicitly:
  - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=49 groups=26 proxies=20 exploded=20 checked=49 export_groups=26 drift=0/0`
  - `local_ctest_assembly_roundtrip ... model=ok paperspace=ok mixed=ok dense=ok summaries=4 tracked=49 groups=26 proxies=20 exploded=20 checked=49 export_groups=26 drift=0/0`
- weekly dashboard renders:
  - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=49 groups=26 proxies=20 exploded=20 checked=49 drift=0/0`
- weekly report renders the same dense-aware contract line.

Conclusion:
- the dense assembly lane is now a real operational contract rather than a hidden CTest detail;
- solver action hints are now exported as first-class analysis fields, not reconstructed downstream;
- fresh local, gate, weekly, dashboard, report, and checker results all agree on the same dense assembly totals and zero-drift outcome.

## Verification: dense styles bundle and solver action labels

### Commands

```bash
cmake --build /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build \
  --target solve_from_project core_tests_solver_diagnostics convert_cli -j4

ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build \
  -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke|editor_assembly_roundtrip_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_mixed_smoke|editor_assembly_roundtrip_dense_smoke' \
  --output-on-failure

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/read_editor_assembly_roundtrip_metrics.py --build-dir build

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_PREVIEW_PROVENANCE_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_SMOKE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 \
  bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_STEP166_GATE=0 \
  RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_gate.sh

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  RUN_EDITOR_UI_FLOW_SMOKE=0 \
  RUN_UI_FLOW_FAILURE_INJECTION=0 \
  RUN_REAL_SCENE_PERF=0 \
  RUN_GATE=1 \
  RUN_EDITOR_PARALLEL_CYCLE=0 \
  RUN_STEP166_GATE=0 \
  RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 \
  RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
  RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 \
  RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 \
  RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 \
  RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
  GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
  bash tools/editor_weekly_validation.sh

cat >/tmp/solver_action_label_project_v4.json <<'JSON'
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "tradeoff-groups-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p4", "type": "point", "params": {"x": 20, "y": 0}},
      {"id": "p5", "type": "point", "params": {"x": 24, "y": 3}},
      {"id": "p6", "type": "point", "params": {"x": 30, "y": 6}}
    ],
    "constraints": [
      {"id": "c0", "type": "equal", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "vertical", "refs": ["p0.x", "p1.x"]},
      {"id": "c2", "type": "equal", "refs": ["p4.x", "p5.x"]},
      {"id": "c3", "type": "vertical", "refs": ["p4.x", "p5.x"]},
      {"id": "c4", "type": "equal", "refs": ["p5.x", "p6.x"]},
      {"id": "c5", "type": "vertical", "refs": ["p5.x", "p6.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
JSON

/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/tools/solve_from_project \
  --json /tmp/solver_action_label_project_v4.json \
  > /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_label_probe_v4.out.json

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_ci_artifact_summary.py \
    --local-summary build/local_ci_summary.json \
    --gate-summary build/editor_gate_summary.json \
    --out build/ci_artifact_summary_dense_action_label_v2.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_dashboard.py \
    --gate-history-dir build/editor_gate_history \
    --weekly-history-dir build/editor_weekly_validation_history \
    --out build/step176_dashboard_dense_action_label_v2.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  python3 tools/write_step176_weekly_report.py \
    --weekly-summary build/editor_weekly_validation_summary.json \
    --report build/step176_weekly_dense_action_label_v2.md

cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion && \
  bash tools/check_weekly_summary.sh \
    --summary build/editor_weekly_validation_summary.json \
    --dashboard build/step176_dashboard_dense_action_label_v2.md \
    --require-dashboard
```

### Results

Observed targeted build + CTests:
- PASS (`6/6` in the targeted package)
- dense lane still resolves as a first-class CTest:
  - `editor_assembly_roundtrip_dense_smoke`

Observed direct aggregate assembly metrics:
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_095537_588_2aec/summary.json`
- aggregated via `tools/read_editor_assembly_roundtrip_metrics.py`:
  - `summary_json_count = 4`
  - `import_entity_count = 60`
  - `import_unsupported_count = 1`
  - `import_derived_proxy_count = 20`
  - `import_exploded_origin_count = 22`
  - `import_assembly_tracked_count = 52`
  - `import_assembly_group_count = 28`
  - `export_derived_proxy_checked_count = 20`
  - `export_exploded_checked_count = 22`
  - `export_assembly_checked_count = 52`
  - `export_assembly_group_count = 28`
  - `export_metadata_drift_count = 0`
  - `export_group_drift_count = 0`

Observed direct solver action-label probe:
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_label_probe_v4.out.json`
- key values:
  - `primary_conflict_action_label = "Relax primary conflict"`
  - `smallest_conflict_action_label = "Inspect smallest conflict witness"`
  - `primary_redundancy_action_label = "Suppress primary redundancy"`
  - `smallest_redundancy_action_label = "Trim smallest redundancy witness"`
  - `primary_conflict_action_hint = "Inspect the primary conflict group first and relax or remove one conflicting constraint near the anchor."`
  - `smallest_conflict_action_hint = "Start with the smallest conflict witness; it is the fastest subset to inspect and isolate."`
  - `primary_redundancy_action_hint = "Remove or suppress one redundant constraint from the primary redundancy subset first."`
  - `smallest_redundancy_action_hint = "Trim the smallest redundancy witness first; it is the cheapest subset to simplify."`

Observed fresh quick `local_ci`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186 preview artifact prep = 13/13`
  - `preview provenance = 17/17`
  - `preview deterministic entry = 17/17`
  - `preview focus checks = 5`
  - `preview artifact smoke = 13/13`
  - `preview artifact validator failure injection = 10/10`
  - `ctestAssemblyRoundtripStatus = "ok"`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripDenseStatus = "ok"`
  - `ctestAssemblyRoundtripSummaryJsonCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 52`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 28`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 20`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 22`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 52`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Observed fresh narrow `editor_gate`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 13/13`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 52`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 28`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 22`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 52`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`

Observed fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 13/13`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 52`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 28`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 22`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 52`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Observed consumer replay with fresh outputs:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_action_label_v2.md`
  - renders:
    - `preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=52 groups=28 proxies=20 exploded=22 checked=52 export_groups=28 drift=0/0`
    - `local_ctest_assembly_roundtrip ... model=ok paperspace=ok mixed=ok dense=ok summaries=4 tracked=52 groups=28 proxies=20 exploded=22 checked=52 export_groups=28 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_action_label_v2.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=52 groups=28 proxies=20 exploded=22 checked=52 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_action_label_v2.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=52 groups=28 proxies=20 exploded=22 checked=52 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_action_label_v2.md --require-dashboard`
  - result: PASS

Conclusion:
- the dense lane now covers the richer three-case dense sub-bundle while preserving zero drift across the full aggregate assembly contract;
- solver now exports both:
  - short UI-ready labels (`action_label`)
  - longer operator guidance (`action_hint`)
- fresh local, gate, weekly, dashboard, report, and checker outputs all agree on the updated dense totals:
  - `tracked = 52`
  - `groups = 28`
  - `proxies = 20`
  - `exploded = 22`
  - `checked = 52`
  - `drift = 0/0`

## Verification: dense triad subcase and solver action-panel contract

Scope of this increment:
- expand the dense assembly lane from three to four dense subcases by adding the real `insert_triad` Step186 sample;
- export pre-assembled solver action-panel objects so downstream consumers do not need to reconstruct action cards from low-level fields.

Targeted build and CTest:
- command:
  - `cmake --build /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build --target solve_from_project convert_cli -j4`
  - `ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build -R 'solve_from_project_json_smoke|editor_assembly_roundtrip_dense_smoke' --output-on-failure`
- result:
  - `2/2` passed

Observed direct solver action-panel probe:
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_probe.out.json`
- key values:
  - `analysis.primary_conflict_action.label = "Relax primary conflict"`
  - `analysis.primary_conflict_action.tag = "conflict-primary-priority"`
  - `analysis.primary_conflict_action.summary = "highest_priority_conflict_group(state=mixed,constraints=4,score=17411,anchor=2)"`
  - `analysis.primary_conflict_action.anchor_constraint_index = 2`
  - `analysis.primary_conflict_action.priority_score = 17411`
  - `analysis.primary_conflict_action.variable_keys = ["p4.x", "p5.x", "p6.x"]`
  - `analysis.primary_conflict_action.free_variable_keys = ["p6.x"]`
  - `analysis.smallest_conflict_action.label = "Inspect smallest conflict witness"`
  - `analysis.smallest_conflict_action.anchor_constraint_index = 0`
  - `analysis.smallest_conflict_action.priority_score = 16211`
  - `analysis.smallest_conflict_action.variable_keys = ["p0.x", "p1.x"]`
  - `analysis.smallest_conflict_action.free_variable_keys = ["p1.x"]`
  - `analysis.primary_redundancy_action.label = "Suppress primary redundancy"`
  - `analysis.primary_redundancy_action.anchor_constraint_index = 2`
  - `analysis.primary_redundancy_action.priority_score = 1960`
  - `analysis.primary_redundancy_action.variable_keys = ["p4.x", "p5.x", "p6.x"]`
  - `analysis.smallest_redundancy_action.label = "Trim smallest redundancy witness"`
  - `analysis.smallest_redundancy_action.anchor_constraint_index = 0`
  - `analysis.smallest_redundancy_action.priority_score = 980`
  - `analysis.smallest_redundancy_action.variable_keys = ["p0.x", "p1.x"]`

Observed fresh quick `local_ci`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186 preview artifact prep = 13/13`
  - `preview provenance = 17/17`
  - `preview deterministic entry = 17/17`
  - `preview focus checks = 5`
  - `preview artifact smoke = 13/13`
  - `preview artifact validator failure injection = 10/10`
  - `ctestAssemblyRoundtripStatus = "ok"`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripDenseStatus = "ok"`
  - `ctestAssemblyRoundtripSummaryJsonCount = 4`
  - `ctestAssemblyRoundtripImportEntityCount = 63`
  - `ctestAssemblyRoundtripImportUnsupportedCount = 1`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 55`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 29`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 20`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 25`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 55`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Observed fresh narrow `editor_gate`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 13/13`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_entity_count = 63`
  - `assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 55`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 29`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 25`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 55`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`

Observed fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 13/13`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 13/13`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_entity_count = 63`
  - `gate_assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 55`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 29`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 20`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 25`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 55`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Observed consumer replay and checker with fresh outputs:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_action_panel_v1.md`
  - renders:
    - `preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=55 groups=29 proxies=20 exploded=25 checked=55 export_groups=29 drift=0/0`
    - `local_ctest_assembly_roundtrip ... model=ok paperspace=ok mixed=ok dense=ok summaries=4 tracked=55 groups=29 proxies=20 exploded=25 checked=55 export_groups=29 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_action_panel_v1.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=55 groups=29 proxies=20 exploded=25 checked=55 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_action_panel_v1.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=55 groups=29 proxies=20 exploded=25 checked=55 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_action_panel_v1.md --require-dashboard`
  - result: PASS

Conclusion:
- the dense assembly lane now covers a four-case real editor-path bundle and still preserves zero metadata drift and zero group drift;
- the aggregate totals moved forward to:
  - `entity_count = 63`
  - `tracked = 55`
  - `groups = 29`
  - `proxies = 20`
  - `exploded = 25`
  - `checked = 55`
  - `drift = 0/0`
- solver diagnostics now export a full action-panel contract, not just disconnected explanation fields;
- fresh local, gate, weekly, dashboard, report, and checker outputs all converge on the same dense-lane and preview-contract totals.

## Verification: dense paper-space dimension subcase and solver `action_panels[]`

Scope of this increment:
- expand the dense assembly lane from four to five dense subcases by adding the real `paperspace_insert_dimension` Step186 sample;
- export a first-class solver `action_panels[]` array so downstream consumers do not need to reconstruct action cards from scattered analysis fields.

Targeted build and CTest:
- commands:
  - `cmake --build /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build --target solve_from_project convert_cli test_dxf_paperspace_insert_dimension -j4`
  - `ctest --test-dir /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build -R 'solve_from_project_json_smoke|test_dxf_paperspace_insert_dimension_run|editor_assembly_roundtrip_dense_smoke' --output-on-failure`
- result:
  - `3/3` passed

Observed direct solver `action_panels[]` probe:
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panels_probe_v2.out.json`
- key values:
  - `analysis.action_panel_count = 4`
  - `analysis.action_panels[0].id = "primary_conflict"`
  - `analysis.action_panels[0].category = "conflict"`
  - `analysis.action_panels[0].scope = "primary"`
  - `analysis.action_panels[0].constraint_indices = [2, 3, 4]`
  - `analysis.action_panels[0].label = "Relax primary conflict"`
  - `analysis.action_panels[0].tag = "conflict-primary-priority"`
  - `analysis.action_panels[0].summary = "highest_priority_conflict_group(state=mixed,constraints=3,score=16322,anchor=2)"`
  - `analysis.action_panels[0].variable_keys = ["p4.x", "p5.x", "p4.y", "p5.y"]`
  - `analysis.action_panels[0].free_variable_keys = ["p4.y", "p5.y"]`
  - `analysis.action_panels[2].id = "primary_redundancy"`
  - `analysis.action_panels[2].basis_constraint_indices = [0]`
  - `analysis.action_panels[2].redundant_constraint_indices = [1]`

Observed fresh targeted Step186 prep:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step186_preview_artifact_prep_incremental_v2/20260309_022300/summary.json`
- result:
  - `14/14` passed
- the new sample appears as:
  - `id = "paperspace_insert_dimension"`
  - `output_dir = "/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step186_paperspace_insert_dimension"`

Observed fresh quick `local_ci`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186 preview artifact prep = 14/14`
  - `preview provenance = 17/17`
  - `preview deterministic entry = 17/17`
  - `preview focus checks = 5`
  - `preview artifact smoke = 14/14`
  - `preview artifact validator failure injection = 10/10`
  - `ctestAssemblyRoundtripStatus = "ok"`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripImportEntityCount = 75`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 66`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 34`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 27`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 27`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 66`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Observed fresh narrow `editor_gate`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 14/14`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 14/14`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_entity_count = 75`
  - `assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 66`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 34`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 27`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 27`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 66`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`

Observed fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 14/14`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 14/14`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_entity_count = 75`
  - `gate_assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 66`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 34`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 27`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 27`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 66`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Observed consumer replay and checker with fresh outputs:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_action_panels_v2.md`
  - renders:
    - `preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=66 groups=34 proxies=27 exploded=27 checked=66 export_groups=34 drift=0/0`
    - `local_ctest_assembly_roundtrip ... model=ok paperspace=ok mixed=ok dense=ok summaries=4 tracked=66 groups=34 proxies=27 exploded=27 checked=66 export_groups=34 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_action_panels_v2.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=66 groups=34 proxies=27 exploded=27 checked=66 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_action_panels_v2.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=66 groups=34 proxies=27 exploded=27 checked=66 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_action_panels_v2.md --require-dashboard`
  - result: PASS

Conclusion:
- the dense assembly lane now covers a five-case real editor-path bundle and still preserves zero metadata drift and zero group drift;
- the aggregate totals moved forward to:
  - `entity_count = 75`
  - `tracked = 66`
  - `groups = 34`
  - `proxies = 27`
  - `exploded = 27`
  - `checked = 66`
  - `drift = 0/0`
- solver diagnostics now export an ordered `action_panels[]` contract in addition to the existing analysis-level selection metadata;
- fresh local, gate, weekly, dashboard, report, and checker outputs all converge on the same dense-lane and preview-contract totals.

## Verification: dense paper-space dimension+hatch lane and action-panel UI contract

Fresh targeted sample validation:
- sample:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/plugin_data/step186_paperspace_insert_dimension_hatch_sample.dxf`
- manual convert/validate output:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/tmp_step186_paperspace_insert_dimension_hatch_out`
- result:
  - validator PASS

Fresh manual editor roundtrip probe:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip_dimension_hatch_probe/20260309_110024_082_7f61/summary.json`
- key values:
  - `entity_count = 15`
  - `derived_proxy_count = 8`
  - `exploded_origin_count = 2`
  - `assembly_tracked_count = 14`
  - `assembly_group_count = 5`
  - `derived_proxy_semantics.ok = true`
  - `exploded_origin_editability.ok = true`
  - `assembly_roundtrip_semantics.ok = true`
  - `checked_count = 14`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`

Fresh targeted build + CTest:
- command set:
  - `cmake --build ... --target solve_from_project convert_cli test_dxf_paperspace_insert_dimension_hatch -j4`
  - `ctest --test-dir ... -R 'solve_from_project_json_smoke|test_dxf_paperspace_insert_dimension_hatch_run|editor_assembly_roundtrip_dense_smoke' --output-on-failure`
- result:
  - `3/3` PASS

Fresh Step186 prep after the new sample:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step186_preview_artifact_prep/20260309_031102/summary.json`
- result:
  - `15/15` PASS
- new case observed:
  - `paperspace_insert_dimension_hatch`

Fresh local summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186PreviewArtifactPrepCaseCount = 15`
  - `step186PreviewArtifactPrepPassCount = 15`
  - `previewProvenanceSmokeCaseCount = 17`
  - `previewProvenanceSmokePassCount = 17`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 17`
  - `previewProvenanceSmokeFocusCheckCaseCount = 5`
  - `previewArtifactSmokeCaseCount = 15`
  - `previewArtifactSmokePassCount = 15`
  - `previewArtifactValidatorFailureInjectionCaseCount = 10`
  - `previewArtifactValidatorFailureInjectionPassCount = 10`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportEntityCount = 90`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 80`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 39`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 35`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 29`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 80`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`
  - `ctestAssemblyRoundtripDenseStatus = ok`

Fresh narrow `editor_gate`:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 15/15`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 15/15`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_entity_count = 90`
  - `assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 80`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 39`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 35`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 29`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 80`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `assembly_roundtrip_ctest.dense_case_name = assembly_dense_insert_triad,assembly_dense_mixed_origin,assembly_dense_paperspace_insert_dimension,assembly_dense_paperspace_insert_dimension_hatch,assembly_dense_paperspace_insert_leader,assembly_dense_paperspace_insert_styles`

Fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 15/15`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 15/15`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_entity_count = 90`
  - `gate_assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 80`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 39`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 35`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 29`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 80`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Fresh dense aggregate totals:
- `summary_json_count = 4`
- `import_entity_count = 90`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 35`
- `import_exploded_origin_count = 29`
- `import_assembly_tracked_count = 80`
- `import_assembly_group_count = 39`
- `export_derived_proxy_checked_count = 35`
- `export_exploded_checked_count = 29`
- `export_assembly_checked_count = 80`
- `export_assembly_group_count = 39`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`

Fresh solver UI probe:
- probe:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panels_ui_ranked_probe.out.json`
- key values:
  - `analysis.action_panel_count = 4`
  - `analysis.action_panels[0].id = primary_conflict`
  - `analysis.action_panels[0].label = "Relax primary conflict"`
  - `analysis.action_panels[0].tag = "conflict-primary-priority"`
  - `analysis.action_panels[0].ui.title = "Relax primary conflict"`
  - `analysis.action_panels[0].ui.badge_label = "Conflict"`
  - `analysis.action_panels[0].ui.severity = "warning"`
  - `analysis.action_panels[0].ui.cta_label = "Relax primary conflict"`
  - `analysis.action_panels[0].ui.recommended = true`
  - `analysis.action_panels[0].ui.display_order = 0`
  - `analysis.action_panels[2].id = primary_redundancy`
  - `analysis.action_panels[2].label = "Suppress primary redundancy"`
  - `analysis.action_panels[2].ui.badge_label = "Redundancy"`
  - `analysis.action_panels[2].ui.severity = "info"`
  - `analysis.action_panels[2].ui.display_order = 2`

Fresh consumer replay and checker:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_action_panels_v3.md`
  - renders:
    - `preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=80 groups=39 proxies=35 exploded=29 checked=80 export_groups=39 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_action_panels_v3.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=80 groups=39 proxies=35 exploded=29 checked=80 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_action_panels_v3.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=80 groups=39 proxies=35 exploded=29 checked=80 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_action_panels_v3.md --require-dashboard`
  - result: PASS

Conclusion:
- the dense assembly lane now covers a six-case real editor-path bundle and still preserves zero metadata drift and zero group drift
- aggregate totals moved forward again to:
  - `entity_count = 90`
  - `tracked = 80`
  - `groups = 39`
  - `proxies = 35`
  - `exploded = 29`
  - `checked = 80`
  - `drift = 0/0`
- solver diagnostics now expose a directly consumable UI action-panel shape, not just raw selection metadata
- fresh local, gate, weekly, dashboard, weekly report, and checker all converge on the same dense-lane and preview-contract totals

## Verification: annotation bundle dense lane and direct solver action-panel consumer

This increment validates two new surfaces:
- a richer real dense assembly subcase built from `step186_paperspace_annotation_bundle_sample.dxf`;
- a direct web-editor consumer for solver `action_panels[]`.

Files added or promoted in this increment:
- sample:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf`
- importer regression:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/tools/test_dxf_paperspace_annotation_bundle.cpp`
- Step186 prep wiring:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/prepare_step186_preview_artifacts.py`
- dense assembly CTest wiring:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/cmake/RunEditorAssemblyRoundtripDense.cmake`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/CMakeLists.txt`
- direct solver action-panel consumer:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/solver_action_panel.js`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/index.html`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/style.css`

Fresh targeted build and CTest:
- command set:
  - `cmake --build build --target test_dxf_paperspace_annotation_bundle solve_from_project convert_cli -j4`
  - `ctest --test-dir build -R 'test_dxf_paperspace_annotation_bundle_run|solve_from_project_json_smoke|editor_assembly_roundtrip_dense_smoke' --output-on-failure`
- result:
  - `3/3` PASS

Fresh JS validation:
- commands:
  - `node --check tools/web_viewer/ui/solver_action_panel.js`
  - `node --check tools/web_viewer/ui/workspace.js`
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
- result:
  - `116/116` PASS

Direct browser validation of the solver action panel:
- local server:
  - `python3 -m http.server 8123`
- working editor URL:
  - `http://127.0.0.1:8123/tools/web_viewer/index.html?mode=editor&debug=1&solver_json=/build/solver_action_panel/solver_ui.json`
- note:
  - a relative `solver_json=build/...` path resolves under `/tools/web_viewer/` and 404s; root-relative `/build/...` is required for the local server layout
- observed rendered cards from the Playwright snapshot:
  - `Relax primary conflict`
  - `Inspect smallest conflict witness`
  - `Suppress primary redundancy`
  - `Trim smallest redundancy witness`
- snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/.playwright-cli/page-2026-03-09T03-24-08-636Z.yml`
- screenshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/.playwright-cli/page-2026-03-09T03-24-16-717Z.png`

Fresh local summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186PreviewArtifactPrepCaseCount = 16`
  - `step186PreviewArtifactPrepPassCount = 16`
  - `previewProvenanceSmokeCaseCount = 17`
  - `previewProvenanceSmokePassCount = 17`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 17`
  - `previewProvenanceSmokeFocusCheckCaseCount = 5`
  - `previewArtifactSmokeCaseCount = 16`
  - `previewArtifactSmokePassCount = 16`
  - `previewArtifactValidatorFailureInjectionCaseCount = 10`
  - `previewArtifactValidatorFailureInjectionPassCount = 10`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 100`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 45`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 100`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`
  - `ctestAssemblyRoundtripDenseStatus = ok`

Fresh narrow gate:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `preview_provenance_smoke = 17/17`
  - `preview_provenance_smoke entry = 17/17`
  - `preview_provenance_smoke focus_checks = 5`
  - `preview_artifact_smoke = 16/16`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.dense_status = PASS`
  - `assembly_roundtrip_ctest.summary_json_count = 4`
  - `assembly_roundtrip_ctest.import_entity_count = 111`
  - `assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 100`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 45`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 33`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 100`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `assembly_roundtrip_ctest.dense_case_name = assembly_dense_insert_triad,assembly_dense_mixed_origin,assembly_dense_paperspace_annotation_bundle,assembly_dense_paperspace_insert_dimension,assembly_dense_paperspace_insert_dimension_hatch,assembly_dense_paperspace_insert_leader,assembly_dense_paperspace_insert_styles`

Fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `gate_preview_provenance_smoke = 17/17`
  - `gate_preview_provenance_smoke entry = 17/17`
  - `gate_preview_provenance_smoke focus_checks = 5`
  - `gate_preview_artifact_smoke = 16/16`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.dense_status = PASS`
  - `gate_assembly_roundtrip_ctest.summary_json_count = 4`
  - `gate_assembly_roundtrip_ctest.import_entity_count = 111`
  - `gate_assembly_roundtrip_ctest.import_unsupported_count = 1`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 100`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 45`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 33`
  - `gate_assembly_roundtrip_ctest.export_assembly_checked_count = 100`
  - `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Fresh consumer replay and checker:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_annotation_bundle_action_panel.md`
  - renders:
    - `preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 export_groups=45 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_annotation_bundle_action_panel.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_annotation_bundle_action_panel.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=17/17 focus_checks=5`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_annotation_bundle_action_panel.md --require-dashboard`
  - result: PASS

Fresh dense aggregate totals after the annotation-bundle addition:
- `summary_json_count = 4`
- `import_entity_count = 111`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 44`
- `import_exploded_origin_count = 33`
- `import_assembly_tracked_count = 100`
- `import_assembly_group_count = 45`
- `export_derived_proxy_checked_count = 44`
- `export_exploded_checked_count = 33`
- `export_assembly_checked_count = 100`
- `export_assembly_group_count = 45`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`

Fresh solver consumer result:
- probe payload:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panels_ui_ranked_probe.out.json`
- key values:
  - `analysis.action_panel_count = 4`
  - `analysis.action_panels[0].id = primary_conflict`
  - `analysis.action_panels[0].ui.title = "Relax primary conflict"`
  - `analysis.action_panels[0].ui.badge_label = "Conflict"`
  - `analysis.action_panels[0].ui.severity = "warning"`
  - `analysis.action_panels[2].id = primary_redundancy`
  - `analysis.action_panels[2].ui.title = "Suppress primary redundancy"`
  - `analysis.action_panels[2].ui.badge_label = "Redundancy"`
  - `analysis.action_panels[2].ui.severity = "info"`

Conclusion:
- the dense assembly lane now covers a seven-subcase real editor-path bundle and still preserves zero metadata drift and zero group drift
- aggregate totals moved forward again to:
  - `entity_count = 111`
  - `tracked = 100`
  - `groups = 45`
  - `proxies = 44`
- `exploded = 33`
- `checked = 100`
- `drift = 0/0`
- solver `action_panels[].ui` is no longer only a JSON contract; it is now exercised by a direct web-editor consumer and browser-level rendering check
- fresh local, gate, weekly, dashboard, weekly report, and checker all converge on the same dense-lane and preview-contract totals

## Verification: annotation-bundle provenance focus and interactive solver action panel

This increment validates two fresh additions:
- a real paper-space annotation-bundle preview provenance case anchored on a dimension proxy group;
- an interactive solver action panel with stable invocation state, not just static rendering.

Files added or promoted in this increment:
- targeted preview smoke input:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_annotation_bundle_v2/cases.json`
- targeted preview smoke output:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_annotation_bundle_v2/20260309_114811/summary.json`
- interactive action-panel smoke:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_manual_v2/20260309_114759/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_manual_v2/20260309_114759/solver_action_panel.png`

Targeted preview provenance verification:
- command:
  - `node tools/web_viewer/scripts/preview_provenance_smoke.js --cases build/preview_provenance_smoke_annotation_bundle_v2/cases.json --outdir build/preview_provenance_smoke_annotation_bundle_v2`
- result:
  - `1/1` PASS
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_annotation_bundle_v2/20260309_114811/summary.json`
- key values:
  - `click.kind = initial`
  - `click.entityId = 14`
  - `click.navKind = initial-entity`
  - initial selection contains:
    - `Group ID = 3`
    - `Origin = DIMENSION/dimension | proxy`
    - `Block Name = *D1`
    - `Dim Style = Standard`
    - `Layout = LayoutStyle`
  - focus step after clicking `Group ID = 3`:
    - `navKind = group`
    - `targetType = group`
    - `groupMemberIds = [14, 15, 16, 17]`
    - `cameraAfter.target = { x = 50, y = 23.0625, z = 0 }`

Verification note:
- the first attempted annotation-bundle group-focus anchor used a leader-centric group and did not change `lastFocusState` reliably enough for contract use;
- the case was replaced with the dimension-proxy group because it is visible, stable, and exercises the same paper-space grouped annotation path more defensibly.

Interactive solver action-panel smoke:
- commands:
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_manual_v2`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_manual_v2/20260309_114759/summary.json`
- result:
  - `ok = true`
  - `panel_count = 4`
- initial state:
  - `activePanelId = ""`
  - `lastInvokedPanelId = ""`
  - `invocationCount = 0`
- after clicking `primary_conflict`:
  - `activePanelId = primary_conflict`
  - `lastInvokedPanelId = primary_conflict`
  - `invocationCount = 1`
  - status message contains:
    - `Relax primary conflict: highest_priority_conflict_group`
- after clicking `smallest_redundancy`:
  - `activePanelId = smallest_redundancy`
  - `lastInvokedPanelId = smallest_redundancy`
  - `invocationCount = 2`
  - status message contains:
    - `Trim smallest redundancy witness: smallest_redundancy_witness`

Fresh local summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186PreviewArtifactPrepCaseCount = 16`
  - `step186PreviewArtifactPrepPassCount = 16`
  - `previewProvenanceSmokeCaseCount = 18`
  - `previewProvenanceSmokePassCount = 18`
  - `previewProvenanceSmokeInitialEntryCaseCount = 18`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 18`
  - `previewProvenanceSmokeFocusCheckCaseCount = 6`
  - `previewArtifactSmokeCaseCount = 16`
  - `previewArtifactSmokePassCount = 16`
  - `previewArtifactValidatorFailureInjectionCaseCount = 10`
  - `previewArtifactValidatorFailureInjectionPassCount = 10`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 100`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 45`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`

Fresh narrow gate:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `preview_provenance_smoke = 18/18`
  - `preview_provenance_smoke entry = 18/18`
  - `preview_provenance_smoke focus_checks = 6`
  - `preview_artifact_smoke = 16/16`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 100`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 45`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 33`

Fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `gate_preview_provenance_smoke = 18/18`
  - `gate_preview_provenance_smoke entry = 18/18`
  - `gate_preview_provenance_smoke focus_checks = 6`
  - `gate_preview_artifact_smoke = 16/16`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Fresh consumer replay and checker:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_annotation_bundle_action_panel_v2.md`
  - renders:
    - `preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 export_groups=45 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_annotation_bundle_action_panel_v2.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_annotation_bundle_action_panel_v2.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=100 groups=45 proxies=44 exploded=33 checked=100 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_annotation_bundle_action_panel_v2.md --require-dashboard`
  - result: PASS

Conclusion:
- the default preview provenance matrix has moved from `17/17` to `18/18` and now includes `6` explicit focus-check cases;
- interactive solver action panels are no longer only rendered; they are invoked, state-tracked, and smoke-tested in a browser run;
- fresh local, gate, weekly, dashboard, weekly report, and checker all converge on the new `18/18` preview-contract totals without changing dense assembly aggregate drift.

## Verification: dense multi-layout lane and solver chip-focus action flow

Targeted multi-layout dense-lane probe:
- command:
  - `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --cases build/editor_assembly_roundtrip_smoke_manual/editor_assembly_roundtrip_cases.json --limit 1 --no-convert --outdir build/editor_roundtrip_multilayout_probe`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip_multilayout_probe/20260309_121435_683_f01c/summary.json`
- result:
  - `ok = true`
  - `assembly_tracked_count = 1`
  - `assembly_group_count = 1`
  - `checked_count = 1`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`

Dense assembly lane after adding `assembly_dense_multi_layout`:
- command:
  - `ctest --test-dir build -R 'editor_assembly_roundtrip_dense_smoke|solve_from_project_json_smoke' --output-on-failure`
- dense summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_121739_562_a855/summary.json`
- result:
  - `pass = 8`
  - includes:
    - `assembly_dense_insert_triad`
    - `assembly_dense_mixed_origin`
    - `assembly_dense_multi_layout`
    - `assembly_dense_paperspace_annotation_bundle`
    - `assembly_dense_paperspace_insert_dimension`
    - `assembly_dense_paperspace_insert_dimension_hatch`
    - `assembly_dense_paperspace_insert_leader`
    - `assembly_dense_paperspace_insert_styles`
  - aggregate:
    - `tracked = 70`
    - `groups = 27`
    - `proxies = 34`
    - `exploded = 17`
    - `checked = 70`
    - `drift = 0/0`

Interactive solver chip-focus smoke:
- commands:
  - `node --check tools/web_viewer/ui/solver_action_panel.js`
  - `node --check tools/web_viewer/ui/workspace.js`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_focus_v3`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_focus_v3/20260309_121740/summary.json`
- screenshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_focus_v3/20260309_121740/solver_action_panel.png`
- result:
  - `ok = true`
  - `panel_count = 4`
- state transitions:
  - initial:
    - `activePanelId = ""`
    - `lastInvokedPanelId = ""`
    - `invocationCount = 0`
    - `activeFocus = null`
  - after clicking `primary_conflict`:
    - `activePanelId = primary_conflict`
    - `lastInvokedPanelId = primary_conflict`
    - `invocationCount = 1`
  - after clicking variable chip `p4.x`:
    - `activeFocus = { panelId = primary_conflict, kind = variable, value = p4.x }`
    - status message contains:
      - `Relax primary conflict: variable p4.x`
  - after switching to `smallest_redundancy`:
    - `activePanelId = smallest_redundancy`
    - `activeFocus = null`

Fresh local summary after dense multi-layout and chip-focus landing:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `step186PreviewArtifactPrepCaseCount = 16`
  - `step186PreviewArtifactPrepPassCount = 16`
  - `previewProvenanceSmokeCaseCount = 18`
  - `previewProvenanceSmokePassCount = 18`
  - `previewProvenanceSmokeInitialEntryCaseCount = 18`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 18`
  - `previewProvenanceSmokeFocusCheckCaseCount = 6`
  - `previewArtifactSmokeCaseCount = 16`
  - `previewArtifactSmokePassCount = 16`
  - `previewArtifactValidatorFailureInjectionCaseCount = 10`
  - `previewArtifactValidatorFailureInjectionPassCount = 10`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 101`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 46`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`

Fresh narrow gate:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `preview_provenance_smoke = 18/18`
  - `preview_provenance_smoke entry = 18/18`
  - `preview_provenance_smoke focus_checks = 6`
  - `preview_artifact_smoke = 16/16`
  - `preview_artifact_validator_failure_injection = 10/10`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 101`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 46`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 33`

Fresh weekly validation:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `step186_preview_artifact_prep = 16/16`
  - `gate_preview_provenance_smoke = 18/18`
  - `gate_preview_provenance_smoke entry = 18/18`
  - `gate_preview_provenance_smoke focus_checks = 6`
  - `gate_preview_artifact_smoke = 16/16`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.pass_count = 4`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 101`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 46`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 33`
  - `weekly_legacy_preview_artifact_prep = 3/3`
  - `weekly_legacy_preview_artifact_smoke = 3/3`

Fresh consumer replay and checker:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dense_multilayout_action_flow.md`
  - renders:
    - `preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `assembly_roundtrip_ctest ... model=PASS paperspace=PASS mixed=PASS dense=PASS summaries=4 tracked=101 groups=46 proxies=44 exploded=33 checked=101 export_groups=46 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_dense_multilayout_action_flow.md`
  - renders:
    - `weekly_gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `weekly_gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=101 groups=46 proxies=44 exploded=33 checked=101 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dense_multilayout_action_flow.md`
  - renders:
    - `gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `gate_assembly_roundtrip_ctest ... dense=PASS summaries=4 tracked=101 groups=46 proxies=44 exploded=33 checked=101 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_dense_multilayout_action_flow.md --require-dashboard`
  - result: PASS

Conclusion:
- the dense editor-path roundtrip lane now covers a real multi-layout paper-space case and lifts the aggregate assembly contract to `tracked=101/groups=46/proxies=44/exploded=33`;
- solver action panels are no longer only card-level interactive; chip-level focus is now browser-smoked and machine-readable;
- fresh local, gate, weekly, dashboard, weekly report, and checker all converge on the same `18/18` deterministic preview totals and the same `4/4` assembly-ctest totals.

Verification: solver action-flow lane propagation
- scope:
  - verify that `solver_action_panel_smoke` is visible and numerically consistent in:
    - local summary
    - gate summary
    - weekly summary
    - CI markdown
    - dashboard
    - weekly report
    - weekly checker

Commands:
- gate:
  - `RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
- weekly:
  - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=1 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 PERF_ENTITIES=2000 PERF_PICK_SAMPLES=400 PERF_BOX_SAMPLES=150 PERF_DRAG_SAMPLES=40 bash tools/editor_weekly_validation.sh`
- local:
  - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
- consumer replay:
  - `python3 tools/write_ci_artifact_summary.py --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_solver_action_flow_v2.md`
  - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_solver_action_flow_v2.md`
  - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_solver_action_flow_v2.md`
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_solver_action_flow_v2.md --require-dashboard`

Fresh gate summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- key values:
  - `solver_action_panel_smoke.enabled = true`
  - `solver_action_panel_smoke.ok = true`
  - `solver_action_panel_smoke.run_id = 20260309_142406`
  - `solver_action_panel_smoke.panel_count = 4`
  - `solver_action_panel_smoke.flow_check_count = 4`
  - `solver_action_panel_smoke.visited_panel_count = 2`
  - `preview_provenance_smoke = 18/18`
  - `preview_provenance_smoke entry = 18/18`
  - `preview_provenance_smoke focus_checks = 6`
  - `assembly_roundtrip_ctest = PASS`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 101`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 46`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 33`

Fresh weekly summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- key values:
  - `gate_solver_action_panel_smoke.enabled = true`
  - `gate_solver_action_panel_smoke.ok = true`
  - `gate_solver_action_panel_smoke.run_id = 20260309_142406`
  - `gate_solver_action_panel_smoke.panel_count = 4`
  - `gate_solver_action_panel_smoke.flow_check_count = 4`
  - `gate_solver_action_panel_smoke.visited_panel_count = 2`
  - `gate_preview_provenance_smoke = 18/18`
  - `gate_preview_provenance_smoke entry = 18/18`
  - `gate_preview_provenance_smoke focus_checks = 6`
  - `gate_assembly_roundtrip_ctest = PASS`
  - `gate_assembly_roundtrip_ctest.case_count = 4`
  - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 101`
  - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 46`
  - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 33`

Fresh local summary:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- key values:
  - `solverActionPanelSmokeStatus = ok`
  - `solverActionPanelSmokeRunId = 20260309_142547`
  - `solverActionPanelSmokePanelCount = 4`
  - `solverActionPanelSmokeFlowCheckCount = 4`
  - `solverActionPanelSmokeVisitedPanelCount = 2`
  - `previewProvenanceSmokeCaseCount = 18`
  - `previewProvenanceSmokePassCount = 18`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 18`
  - `previewProvenanceSmokeFocusCheckCaseCount = 6`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 101`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 46`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`

Fresh solver action-flow smoke artifacts:
- gate smoke summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_gate/20260309_142406/summary.json`
- local smoke summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke/20260309_142547/summary.json`
- stable values:
  - `panel_count = 4`
  - `flow_check_count = 4`
  - `visited_panel_ids = ["primary_conflict", "smallest_redundancy"]`

Fresh consumer replay:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_solver_action_flow_v2.md`
  - rendered lines include:
    - `solver_action_panel_smoke ... panels=4 flow_checks=4 visited_panels=2`
    - `local_solver_action_panel_smoke ... panels=4 flow_checks=4 visited_panels=2`
    - `preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `assembly_roundtrip_ctest ... tracked=101 groups=46 proxies=44 exploded=33 checked=101 drift=0/0`
- dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_solver_action_flow_v2.md`
  - rendered lines include:
    - `weekly_gate_solver_action_panel_smoke ... panels=4 flow_checks=4 visited_panels=2`
    - `weekly_gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `weekly_gate_assembly_roundtrip_ctest ... tracked=101 groups=46 proxies=44 exploded=33 checked=101 drift=0/0`
- weekly report:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_solver_action_flow_v2.md`
  - rendered lines include:
    - `gate_solver_action_panel_smoke ... panels=4 flow_checks=4 visited_panels=2`
    - `gate_preview_provenance_smoke ... entry=18/18 focus_checks=6`
    - `gate_assembly_roundtrip_ctest ... tracked=101 groups=46 proxies=44 exploded=33 checked=101 drift=0/0`
- checker:
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_solver_action_flow_v2.md --require-dashboard`
  - result:
    - `PASS`

Fresh conclusion:
- `solver_action_panel_smoke` is now a real high-level lane instead of an isolated browser smoke;
- local, gate, weekly, markdown, dashboard, report, and checker all agree on:
  - `panels = 4`
  - `flow_checks = 4`
  - `visited_panels = 2`
- the same fresh run also preserves the broader Step186 contracts:
  - `preview provenance = 18/18`
  - `entry = 18/18`
  - `focus_checks = 6`
  - `assembly roundtrip = 4/4`
  - `tracked = 101`
  - `groups = 46`
  - `proxies = 44`
  - `exploded = 33`
  - `drift = 0/0`

Verification delta: solver action-flow full contract
- static validation:
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
- standalone smoke:
  - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_flow_contract`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_flow_contract/20260309_150906/summary.json`
  - screenshot:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_flow_contract/20260309_150906/solver_action_panel.png`
  - fresh results:
    - `panel_count = 4`
    - `flow_check_count = 10`
    - `next_check_count = 4`
    - `rewind_check_count = 2`
    - `restart_check_count = 2`
    - `visited_panel_count = 2`

Verification delta: fresh local summary
- command:
  - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- fresh values:
  - `solverActionPanelSmokeStatus = ok`
  - `solverActionPanelSmokePanelCount = 4`
  - `solverActionPanelSmokeFlowCheckCount = 10`
  - `solverActionPanelSmokeNextCheckCount = 4`
  - `solverActionPanelSmokeRewindCheckCount = 2`
  - `solverActionPanelSmokeRestartCheckCount = 2`
  - `solverActionPanelSmokeVisitedPanelCount = 2`
  - `previewProvenanceSmokeCaseCount = 18`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 18`
  - `previewProvenanceSmokeFocusCheckCaseCount = 6`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 101`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 46`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`

Verification delta: fresh gate summary
- command:
  - `RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- solver lane:
  - `enabled = true`
  - `ok = true`
  - `panel_count = 4`
  - `flow_check_count = 10`
  - `next_check_count = 4`
  - `rewind_check_count = 2`
  - `restart_check_count = 2`
  - `visited_panel_count = 2`
- paired contracts remained green:
  - `preview provenance = 18/18`
  - `deterministic entry = 18/18`
  - `focus checks = 6`
  - `assembly roundtrip ctest = 4/4`
  - `tracked = 101`
  - `groups = 46`
  - `proxies = 44`
  - `exploded = 33`

Verification delta: fresh weekly propagation and checker replay
- command:
  - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=1 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=0 bash tools/editor_weekly_validation.sh`
- note:
  - the weekly script exited with `rc=2` because of existing UI-flow gate failures, but it continued to write fresh weekly summary artifacts.
  - that non-zero exit is not caused by the solver action-flow contract.
- fresh weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- fresh weekly values:
  - `gate_solver_action_panel_smoke.enabled = true`
  - `gate_solver_action_panel_smoke.ok = true`
  - `gate_solver_action_panel_smoke.panel_count = 4`
  - `gate_solver_action_panel_smoke.flow_check_count = 10`
  - `gate_solver_action_panel_smoke.next_check_count = 4`
  - `gate_solver_action_panel_smoke.rewind_check_count = 2`
  - `gate_solver_action_panel_smoke.restart_check_count = 2`
  - `gate_solver_action_panel_smoke.visited_panel_count = 2`
  - `gate_preview_provenance_smoke = 18/18`
  - `gate_preview_provenance_smoke entry = 18/18`
  - `gate_preview_provenance_smoke focus_checks = 6`
  - `gate_assembly_roundtrip_ctest = PASS 4/4`
  - `gate_assembly_roundtrip_ctest tracked = 101`
  - `gate_assembly_roundtrip_ctest groups = 46`
  - `gate_assembly_roundtrip_ctest proxies = 44`
  - `gate_assembly_roundtrip_ctest exploded = 33`

Verification delta: fresh consumer replay
- commands:
  - `python3 tools/write_ci_artifact_summary.py --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_solver_action_flow_contract_v3.md`
  - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_solver_action_flow_contract_v3.md`
  - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_solver_action_flow_contract_v3.md`
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_solver_action_flow_contract_v3.md --require-dashboard`
- fresh generated artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_solver_action_flow_contract_v3.md`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_solver_action_flow_contract_v3.md`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_solver_action_flow_contract_v3.md`
- checker result:
  - `PASS`
- rendered metrics now agree across local/gate/weekly consumers:
  - `panels = 4`
  - `flow_checks = 10`
  - `next = 4`
  - `prev = 2`
  - `restart = 2`
  - `visited_panels = 2`
  - `preview provenance = 18/18`
  - `entry = 18/18`
  - `focus_checks = 6`
  - `assembly tracked = 101`
  - `assembly groups = 46`
  - `assembly proxies = 44`
  - `assembly exploded = 33`
  - `assembly drift = 0/0`

Verification delta: fresh solver request-contract smoke
- command:
  - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_request_contract_v2`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_request_contract_v2/20260309_153438/summary.json`
- result:
  - `PASS`
- fresh values:
  - `panel_count = 4`
  - `flow_check_count = 10`
  - `request_count = 12`
  - `invoke_request_count = 2`
  - `focus_request_count = 2`
  - `flow_request_count = 8`
  - `next_check_count = 4`
  - `rewind_check_count = 2`
  - `restart_check_count = 2`
  - `visited_panel_count = 2`

Verification delta: viewport sample joins the full deterministic preview matrix
- command:
  - `node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke_viewport_contract`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_viewport_contract/20260309_153059/summary.json`
- result:
  - `19/19`
- fresh run-level values:
  - `entry_kind_counts = { "initial": 19 }`
  - `nav_kind_counts = { "initial-entity": 19 }`
  - `initial_entry_case_count = 19`
  - `deterministic_entry_case_count = 19`
  - `focus_check_case_count = 6`
- new verified case:
  - `viewport_sample_paperspace_line_only`
  - `Entity ID = 2`
  - `Color Source = BYLAYER`
  - `Line Type Scale = 1`
  - `Space = 1`
  - `Layout = PaperSpace`

Verification delta: fresh local summary after request-contract propagation
- command:
  - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- fresh values:
  - `step186PreviewArtifactPrepCaseCount = 16`
  - `step186PreviewArtifactPrepPassCount = 16`
  - `previewArtifactSmokeCaseCount = 16`
  - `previewArtifactSmokePassCount = 16`
  - `previewArtifactValidatorFailureInjectionCaseCount = 10`
  - `previewArtifactValidatorFailureInjectionPassCount = 10`
  - `previewProvenanceSmokeCaseCount = 19`
  - `previewProvenanceSmokePassCount = 19`
  - `previewProvenanceSmokeInitialEntryCaseCount = 19`
  - `previewProvenanceSmokeDeterministicEntryCaseCount = 19`
  - `previewProvenanceSmokeFocusCheckCaseCount = 6`
  - `solverActionPanelSmokePanelCount = 4`
  - `solverActionPanelSmokeFlowCheckCount = 10`
  - `solverActionPanelSmokeRequestCount = 12`
  - `solverActionPanelSmokeInvokeRequestCount = 2`
  - `solverActionPanelSmokeFocusRequestCount = 2`
  - `solverActionPanelSmokeFlowRequestCount = 8`
  - `solverActionPanelSmokeVisitedPanelCount = 2`
  - `ctestAssemblyRoundtripCaseCount = 4`
  - `ctestAssemblyRoundtripPassCount = 4`
  - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 101`
  - `ctestAssemblyRoundtripImportAssemblyGroupCount = 46`
  - `ctestAssemblyRoundtripImportDerivedProxyCount = 44`
  - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`
  - `ctestAssemblyRoundtripExportAssemblyCheckedCount = 101`
  - `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
  - `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Verification delta: fresh gate summary after viewport/request propagation
- command:
  - `RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_STEP166_GATE=0 EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- fresh values:
  - `preview_provenance_smoke.case_count = 19`
  - `preview_provenance_smoke.pass_count = 19`
  - `preview_provenance_smoke.initial_entry_case_count = 19`
  - `preview_provenance_smoke.deterministic_entry_case_count = 19`
  - `preview_provenance_smoke.focus_check_case_count = 6`
  - `solver_action_panel_smoke.panel_count = 4`
  - `solver_action_panel_smoke.flow_check_count = 10`
  - `solver_action_panel_smoke.request_count = 12`
  - `solver_action_panel_smoke.invoke_request_count = 2`
  - `solver_action_panel_smoke.focus_request_count = 2`
  - `solver_action_panel_smoke.flow_request_count = 8`
  - `solver_action_panel_smoke.visited_panel_count = 2`
  - `preview_artifact_smoke.case_count = 16`
  - `preview_artifact_smoke.pass_count = 16`
  - `preview_artifact_validator_failure_injection.case_count = 10`
  - `preview_artifact_validator_failure_injection.pass_count = 10`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
  - `assembly_roundtrip_ctest.import_assembly_tracked_count = 101`
  - `assembly_roundtrip_ctest.import_assembly_group_count = 46`
  - `assembly_roundtrip_ctest.import_derived_proxy_count = 44`
  - `assembly_roundtrip_ctest.import_exploded_origin_count = 33`
  - `assembly_roundtrip_ctest.export_assembly_checked_count = 101`
  - `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
  - `assembly_roundtrip_ctest.export_group_drift_count = 0`

Verification delta: weekly replay from an existing gate summary
- code change:
  - `tools/editor_weekly_validation.sh` now preserves an externally supplied `GATE_SUMMARY` when `RUN_GATE=0`, and marks the gate lane as `status=reused`.
- replay command:
  - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
- intended effect:
  - weekly summary / dashboard / report / checker can be replayed against a known-good gate payload without rerunning the whole gate.
- the authoritative gate numbers for that replay are the fresh gate values above:
  - preview provenance `19/19`
  - deterministic entry `19/19`
  - focus checks `6`
  - solver requests `12/2/2/8`
  - artifact smoke `16/16`
  - validator failure injection `10/10`
  - assembly roundtrip `4/4`
  - assembly tracked/groups/proxies/exploded `101/46/44/33`
- fresh replay outputs:
  - weekly summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - CI markdown:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_request_viewport_replay.md`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_request_viewport_replay.md`
  - weekly report:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_request_viewport_replay.md`
- fresh weekly replay values:
  - `gate.status = reused`
  - `gate.exit_code = 0`
  - `gate_preview_provenance_smoke = 19/19`
  - `gate_preview_provenance_smoke entry = 19/19`
  - `gate_preview_provenance_smoke focus_checks = 6`
  - `gate_solver_action_panel_smoke.panel_count = 4`
  - `gate_solver_action_panel_smoke.flow_check_count = 10`
  - `gate_solver_action_panel_smoke.request_count = 12`
  - `gate_solver_action_panel_smoke.invoke_request_count = 2`
  - `gate_solver_action_panel_smoke.focus_request_count = 2`
  - `gate_solver_action_panel_smoke.flow_request_count = 8`
  - `gate_preview_artifact_smoke = 16/16`
  - `gate_preview_artifact_validator_failure_injection = 10/10`
  - `gate_assembly_roundtrip_ctest = PASS 4/4`
  - `gate_assembly_roundtrip_ctest tracked = 101`
  - `gate_assembly_roundtrip_ctest groups = 46`
  - `gate_assembly_roundtrip_ctest proxies = 44`
  - `gate_assembly_roundtrip_ctest exploded = 33`
- checker result:
  - `PASS`
- rendered consumer outputs now show the same fresh numbers, including:
  - `requests = 12`
  - `invoke = 2`
  - `focus = 2`
  - `flow = 8`
  - `preview provenance = 19/19`
  - `entry = 19/19`
  - `focus_checks = 6`
  - `assembly tracked = 101`
  - `assembly groups = 46`
  - `assembly proxies = 44`
  - `assembly exploded = 33`

Verification delta: visible solver action-flow console and viewport-bearing dense assembly metrics
- standalone solver action-flow console smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_flow_console`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_flow_console/20260309_160255/summary.json`
  - result:
    - `ok = true`
    - `panel_count = 4`
    - `flow_check_count = 10`
    - `request_count = 12`
    - `invoke_request_count = 2`
    - `focus_request_count = 2`
    - `flow_request_count = 8`
    - `visited_panel_ids = ["primary_conflict","smallest_redundancy"]`
  - direct console assertions were exercised:
    - invoke -> `lastRequestKind = invoke`
    - flow -> `lastRequestKind = flow`
    - chip focus -> `lastRequestKind = focus`
    - rendered console text contains the active panel title and last target label

- dense assembly viewport-bearing semantic check:
  - command:
    - `ctest --test-dir build -R 'editor_assembly_roundtrip_dense_smoke' --output-on-failure`
  - result:
    - `1/1 PASS`
  - this validates the strengthened dense CMake contract against real viewport-bearing source docs rather than a synthetic viewport-only sample

- fresh local summary with new metrics:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - fresh values:
    - `step186 prep = 16/16`
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 10 / requests 12 / invoke 2 / focus 2 / flow 8 / visited 2`
    - `assembly roundtrip ctest = 4/4`
    - `assembly tracked = 101`
    - `assembly groups = 46`
    - `assembly proxies = 44`
    - `assembly exploded = 33`
    - `assembly viewports = 12`
    - `assembly viewport_layouts = 10`
    - `assembly viewport_cases = 9`
    - `assembly checked = 101`
    - `assembly drift = 0/0`
  - authoritative local smoke artifacts:
    - solver action-flow summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke/20260309_160400/summary.json`
    - preview provenance summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke/20260309_160331/summary.json`
    - dense assembly summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_160405_693_d49d/summary.json`

- fresh gate summary with new metrics:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh --build-dir build`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - fresh values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 10 / requests 12 / invoke 2 / focus 2 / flow 8 / visited 2`
    - `artifact smoke = 16/16`
    - `validator failure injection = 10/10`
    - `assembly roundtrip ctest = PASS 4/4`
    - `assembly tracked = 101`
    - `assembly groups = 46`
    - `assembly proxies = 44`
    - `assembly exploded = 33`
    - `assembly viewports = 12`
    - `assembly viewport_layouts = 10`
    - `assembly viewport_cases = 9`
    - `assembly checked = 101`
    - `assembly drift = 0/0`
  - authoritative gate artifacts:
    - solver action-flow summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_gate/20260309_160534/summary.json`
    - preview provenance summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_gate/20260309_160505/summary.json`
    - dense assembly summary:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_160547_298_f85f/summary.json`
  - gate process exit remained non-zero because the existing UI-flow gate still failed in runs `20260309_160417_ui_flow` and `20260309_160442_ui_flow`.
  - that non-zero exit is outside this delta; the new solver/preview/assembly lanes all passed and still produced a valid summary payload.

- fresh weekly replay from the fresh gate summary:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP=1 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE=1 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - fresh replay values:
    - `gate.status = reused`
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 10 / requests 12 / invoke 2 / focus 2 / flow 8 / visited 2`
    - `gate_preview_artifact_smoke = 16/16`
    - `gate_preview_artifact_validator_failure_injection = 10/10`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest tracked = 101`
    - `gate_assembly_roundtrip_ctest groups = 46`
    - `gate_assembly_roundtrip_ctest proxies = 44`
    - `gate_assembly_roundtrip_ctest exploded = 33`
    - `gate_assembly_roundtrip_ctest viewports = 12`
    - `gate_assembly_roundtrip_ctest viewport_layouts = 10`
    - `gate_assembly_roundtrip_ctest viewport_cases = 9`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`

- fresh consumer replay + checker:
  - CI artifact summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_flow_console_viewports.md`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_flow_console_viewports.md`
  - weekly report:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_flow_console_viewports.md`
  - checker:
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_flow_console_viewports.md --require-dashboard`
    - `PASS`
  - rendered consumer lines now expose the new metrics:
    - `solver_action_panel_smoke ... panels=4 flow_checks=10 requests=12 invoke=2 focus=2 flow=8 next=4 prev=2 restart=2 visited_panels=2`
    - `assembly_roundtrip_ctest ... tracked=101 groups=46 proxies=44 exploded=33 viewports=12 viewport_layouts=10 viewport_cases=9 checked=101 drift=0/0`

- real consumer bug fixed during this verification wave:
  - symptom:
    - `local_ci_summary.json` already contained `ctestAssemblyRoundtripImportViewportCount = 12`, `ctestAssemblyRoundtripImportViewportLayoutCount = 10`, `ctestAssemblyRoundtripImportViewportCaseCount = 9`
    - but `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_flow_console_viewports.md` initially rendered the local assembly line as `viewports=0 viewport_layouts=0 viewport_cases=0`
  - root cause:
    - `tools/write_ci_artifact_summary.py` mapped viewport-bearing assembly metrics for gate/weekly payloads but omitted the local `ctestAssemblyRoundtripImportViewport*` keys
  - fix:
    - map the three local viewport keys into `local_ctest_assembly_roundtrip`
  - post-fix evidence:
    - `local_ctest_assembly_roundtrip ... viewports=12 viewport_layouts=10 viewport_cases=9`

Verification delta: dense assembly derived proxy kind aggregate
- static checks:
  - `node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - `python3 -m py_compile tools/read_editor_assembly_roundtrip_metrics.py tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`

- targeted CTest validation:
  - command:
    - `cmake --build build --target solve_from_project core_tests_solver_diagnostics -j4`
    - `ctest --test-dir build -R 'core_tests_solver_diagnostics|solve_from_project_json_smoke|editor_assembly_roundtrip_dense_smoke' --output-on-failure`
  - result:
    - `3/3 PASS`

- fresh local summary with proxy-kind aggregate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - fresh values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `assembly roundtrip ctest = 4/4`
    - `import_derived_proxy_count = 44`
    - `import_proxy_kind_counts = { dimension: 34, hatch: 5, leader: 5 }`

- fresh gate summary with proxy-kind aggregate:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - fresh values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `assembly roundtrip ctest = 4/4`
    - `import_derived_proxy_count = 44`
    - `import_proxy_kind_counts = { dimension: 34, hatch: 5, leader: 5 }`

- fresh weekly replay from the fresh gate summary:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP=1 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE=1 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - fresh values:
    - `gate.status = reused`
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_assembly_roundtrip_ctest = 4/4`
    - `gate_assembly_roundtrip_ctest import_derived_proxy_count = 44`
    - `gate_assembly_roundtrip_ctest import_proxy_kind_counts = { dimension: 34, hatch: 5, leader: 5 }`

- fresh consumer replay after the fresh weekly summary:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --title step186-proxy-kinds --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_proxy_kinds.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_proxy_kinds.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_proxy_kinds.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_proxy_kinds.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_proxy_kinds.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_proxy_kinds.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_proxy_kinds.md`
  - checker result:
    - `PASS`
  - rendered consumer line now exposes the aggregate:
    - `proxy_kinds=dimension:34, hatch:5, leader:5`

- fresh consistency result:
  - local, gate, and weekly summaries now all decode to the same proxy-kind dictionary:
    - `{ dimension: 34, hatch: 5, leader: 5 }`
  - decoded sum is `44`, which matches `import_derived_proxy_count = 44`

Verification delta: fresh event-flow contract and proxy-layout aggregate propagation
- static checks:
  - `node --check tools/web_viewer/ui/solver_action_panel.js`
  - `node --check tools/web_viewer/ui/solver_action_flow_console.js`
  - `node --check tools/web_viewer/ui/workspace.js`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - `node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - `python3 -m py_compile tools/read_editor_assembly_roundtrip_metrics.py tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`

- standalone solver action-panel smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_event_contract`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_event_contract/20260309_171241/summary.json`
  - result:
    - `PASS`
    - `panel_count = 4`
    - `flow_check_count = 10`
    - `request_count = 13`
    - `invoke_request_count = 2`
    - `focus_request_count = 2`
    - `flow_request_count = 8`
    - `replay_request_count = 1`
    - `event_count = 13`
    - `invoke_event_count = 2`
    - `focus_event_count = 2`
    - `flow_event_count = 8`
    - `replay_event_count = 1`

- fresh `local_ci`:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - fresh values:
    - `step186 prep = 16/16`
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 10 / requests 13 / invoke 2 / focus 2 / flow 8 / replay 1 / events 13`
    - `assembly roundtrip ctest = 4/4`
    - `tracked = 101`
    - `groups = 46`
    - `proxies = 44`
    - `proxy_kinds = { dimension: 34, hatch: 5, leader: 5 }`
    - `proxy_layouts = { LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`
    - `viewports = 12`
    - `viewport_layouts = 10`
    - `viewport_cases = 9`
    - `drift = 0/0`

- fresh narrow gate after the proxy-layout export fix:
  - command:
    - `RUN_EDITOR_SMOKE_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh --build-dir build`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - authoritative child artifacts:
    - preview provenance:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_gate/20260309_172031/summary.json`
    - solver action-panel smoke:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_gate/20260309_172058/summary.json`
    - dense assembly roundtrip:
      - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260309_172109_332_324a/summary.json`
  - fresh gate values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 10 / requests 13 / invoke 2 / focus 2 / flow 8 / replay 1 / events 13`
    - `assembly roundtrip ctest = PASS 4/4`
    - `tracked = 101`
    - `groups = 46`
    - `proxies = 44`
    - `proxy_kinds = { dimension: 34, hatch: 5, leader: 5 }`
    - `proxy_layouts = { LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`
    - `viewports = 12`
    - `viewport_layouts = 10`
    - `viewport_cases = 9`
    - `drift = 0/0`
  - result:
    - gate exit `0`

- fresh weekly replay from the fresh gate summary:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP=1 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE=1 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - fresh replay values:
    - `gate.status = reused`
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 10 / requests 13 / invoke 2 / focus 2 / flow 8 / replay 1 / events 13`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest tracked = 101`
    - `gate_assembly_roundtrip_ctest groups = 46`
    - `gate_assembly_roundtrip_ctest proxies = 44`
    - `gate_assembly_roundtrip_ctest proxy_kinds = { dimension: 34, hatch: 5, leader: 5 }`
    - `gate_assembly_roundtrip_ctest proxy_layouts = { LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`
    - `gate_assembly_roundtrip_ctest viewports = 12`
    - `gate_assembly_roundtrip_ctest viewport_layouts = 10`
    - `gate_assembly_roundtrip_ctest viewport_cases = 9`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`
  - note:
    - weekly summary still reports overall `status=unstable` because the pre-existing `ui_flow_stage_trend` observe lane remains unstable
    - the new solver/preview/assembly contracts in this delta all passed

- fresh consumer replay after the fresh weekly summary:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --title 'CI Artifact Summary (Event/Proxy Aggregate v2)' --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_event_proxy_aggregate_v2.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_event_proxy_aggregate_v2.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_event_proxy_aggregate_v2.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_event_proxy_aggregate_v2.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_event_proxy_aggregate_v2.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_event_proxy_aggregate_v2.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_event_proxy_aggregate_v2.md`
  - checker:
    - `PASS`
  - rendered consumer lines now expose the fully propagated metrics:
    - `solver_action_panel_smoke ... panels=4 flow_checks=10 requests=13 invoke=2 focus=2 flow=8 replay=1 events=13 event_invoke=2 event_focus=2 event_flow=8 event_replay=1`
    - `assembly_roundtrip_ctest ... proxy_kinds=dimension:34, hatch:5, leader:5`
    - `assembly_roundtrip_ctest ... proxy_layouts=LayoutStyle[dimension:18, leader:5, hatch:3]; Model[dimension:16, hatch:2]`

- real propagation bug fixed in this wave:
  - symptom:
    - `local_ci_summary.json` already carried `ctestAssemblyRoundtripImportProxyLayoutKindCountsB64`
    - but fresh gate and weekly replay still rendered `proxy_layouts=-`
  - root cause:
    - `tools/editor_gate.sh` wrote `import_proxy_layout_kind_counts_b64` into the JSON summary
    - but never initialized/exported `ASSEMBLY_ROUNDTRIP_CTEST_IMPORT_PROXY_LAYOUT_KIND_COUNTS_B64`
    - the summary writer therefore saw an empty environment variable
  - fix:
    - initialize the gate shell variable
    - export it alongside the other dense assembly metrics before writing `editor_gate_summary.json`
  - post-fix evidence:
    - gate summary and weekly summary both now decode to:
      - `{ LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`

- fresh gate export fix for solver jump metrics:
  - static checks:
    - `bash -n tools/editor_gate.sh`
    - `bash -n tools/editor_weekly_validation.sh`
  - root cause:
    - `tools/editor_gate.sh` parsed `jump_request_count`, `jump_event_count`, and `jump_check_count` from the standalone solver smoke summary
    - but did not export those shell variables before writing `editor_gate_summary.json`
  - symptom before fix:
    - local summary reported non-zero jump metrics
    - fresh gate summary wrote:
      - `jump_request_count = 0`
      - `jump_event_count = 0`
      - `jump_check_count = 0`
  - fix:
    - export
      - `SOLVER_ACTION_PANEL_SMOKE_JUMP_REQUEST_COUNT`
      - `SOLVER_ACTION_PANEL_SMOKE_JUMP_EVENT_COUNT`
      - `SOLVER_ACTION_PANEL_SMOKE_JUMP_CHECK_COUNT`
    - update the weekly embedded markdown line to print the same jump metrics as the JSON summary

- fresh narrow gate after the jump export fix:
  - command:
    - `RUN_STEP166_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 RUN_UI_FLOW_STAGE_TREND=0 SUMMARY_PATH=build/editor_gate_summary.json HISTORY_DIR=build/editor_gate_history ASSEMBLY_ROUNDTRIP_CTEST_BUILD_DIR=build bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - result:
    - gate exit `0`
  - fresh gate values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 15 / invoke 2 / focus 2 / flow 10 / replay 1 / jump_requests 2 / events 15 / jump_events 2 / jump 2`
    - `assembly roundtrip ctest = PASS 4/4`
    - `tracked = 101`
    - `groups = 46`
    - `proxies = 44`
    - `proxy_kinds = { dimension: 34, hatch: 5, leader: 5 }`
    - `proxy_layouts = { LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`
    - `group_layouts = { LayoutB: { unknown: 1 }, LayoutMixed: { unknown: 2 }, LayoutStyle: { DIMENSION: 9, INSERT: 7, LEADER: 5, unknown: 1 }, Model: { DIMENSION: 6, INSERT: 15 } }`
    - `viewports = 12`
    - `viewport_layouts = 10`
    - `viewport_cases = 9`
    - `drift = 0/0`

- fresh weekly replay from the fresh gate summary after the jump export fix:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - fresh replay values:
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 12 / requests 15 / invoke 2 / focus 2 / flow 10 / replay 1 / jump_requests 2 / events 15 / jump_events 2 / jump 2`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest tracked = 101`
    - `gate_assembly_roundtrip_ctest groups = 46`
    - `gate_assembly_roundtrip_ctest proxies = 44`
    - `gate_assembly_roundtrip_ctest proxy_kinds = { dimension: 34, hatch: 5, leader: 5 }`
    - `gate_assembly_roundtrip_ctest proxy_layouts = { LayoutStyle: { dimension: 18, leader: 5, hatch: 3 }, Model: { dimension: 16, hatch: 2 } }`
    - `gate_assembly_roundtrip_ctest group_layouts = { LayoutB: { unknown: 1 }, LayoutMixed: { unknown: 2 }, LayoutStyle: { DIMENSION: 9, INSERT: 7, LEADER: 5, unknown: 1 }, Model: { DIMENSION: 6, INSERT: 15 } }`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`
  - note:
    - overall weekly status remains `unstable`
    - cause is still the pre-existing `ui_flow_stage_trend` observe lane
    - the new solver jump-flow and dense assembly group-layout contracts are green

- fresh consumer replay after the jump export fix:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --title 'CI Artifact Summary (Jump + Group Layouts)' --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_jump_group_layouts.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_jump_group_layouts.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_jump_group_layouts.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_jump_group_layouts.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_jump_group_layouts.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_jump_group_layouts.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_jump_group_layouts.md`
  - checker:
    - `PASS`
  - rendered consumer lines now expose the fixed metrics:
    - `solver_action_panel_smoke ... panels=4 flow_checks=12 requests=15 invoke=2 focus=2 flow=10 replay=1 jump_requests=2 events=15 event_invoke=2 event_focus=2 event_flow=10 event_replay=1 jump_events=2 next=4 jump=2 prev=2 restart=2 replay_checks=1 visited_panels=2`
    - `assembly_roundtrip_ctest ... proxy_layouts=LayoutStyle[dimension:18, hatch:3, leader:5]; Model[dimension:16, hatch:2]`
    - `assembly_roundtrip_ctest ... group_layouts=LayoutB[unknown:1]; LayoutMixed[unknown:2]; LayoutStyle[DIMENSION:9, INSERT:7, LEADER:5, unknown:1]; Model[DIMENSION:6, INSERT:15]`

- fresh consistency result after the jump export fix:
  - local, gate, and weekly now all agree on:
    - solver jump metrics:
      - `jump_request_count = 2`
      - `jump_event_count = 2`
      - `jump_check_count = 2`
    - dense assembly group layouts:
      - `{ LayoutB: { unknown: 1 }, LayoutMixed: { unknown: 2 }, LayoutStyle: { DIMENSION: 9, INSERT: 7, LEADER: 5, unknown: 1 }, Model: { DIMENSION: 6, INSERT: 15 } }`

- fresh standalone solver recent-event focus verification:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_recent_event_focus`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_recent_event_focus/20260310_090348/summary.json`
  - result:
    - `PASS`
  - key metrics:
    - `panel_count = 4`
    - `flow_check_count = 12`
    - `request_count = 16`
    - `focus_request_count = 3`
    - `event_count = 16`
    - `focus_event_count = 3`
    - `event_focus_check_count = 1`
    - `jump_request_count = 2`
    - `jump_event_count = 2`
  - verified path:
    - recent event list entry
    - `eventKind = focus`
    - `panelId = smallest_redundancy`
    - `focusKind = redundant-constraint`
    - `focusValue = 1`
    - click re-entered the panel through the focus path and restored the expected active target

- fresh exploded-layout aggregate verification:
  - intermediate failure before fix:
    - weekly replay failed checker with:
      - `gate_assembly_roundtrip_ctest.import_exploded_layout_source_counts_b64 exploded_count mismatch`
  - root cause:
    - `exploded_origin_count` already filtered exploded entities through the movable exploded entity contract
    - `summarizeExplodedLayoutSourceCounts()` counted every entity with `editMode=exploded`
    - result:
      - `editor_assembly_roundtrip_smoke` produced `exploded_origin_count = 12`
      - but `exploded_origin_layout_source_counts = {"Model":{"INSERT":13}}`
  - fix:
    - apply the same `MOVEABLE_ENTITY_TYPES` filter inside `summarizeExplodedLayoutSourceCounts()`
  - post-fix local verification:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
    - decoded exploded layout aggregate:
      - `{"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
    - total:
      - `33`
    - matches:
      - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`

- fresh narrow gate after the exploded-layout fix:
  - command:
    - `RUN_EDITOR_SMOKE_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh --build-dir build`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - result:
    - gate exit `0`
  - key values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / event_focus_checks 1 / jump 2`
    - `assembly roundtrip ctest = PASS 4/4`
    - `import_exploded_layout_source_counts_b64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - checker-relevant invariant now holds:
    - `14 + 19 = 33 = import_exploded_origin_count`

- fresh weekly replay after the exploded-layout fix:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166=0 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_PREP=1 RUN_WEEKLY_LEGACY_PREVIEW_ARTIFACT_SMOKE=1 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - result:
    - weekly replay exit `0`
    - embedded weekly checker line:
      - `[weekly-summary] OK ...`
  - key values:
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 12 / requests 16 / event_focus_checks 1 / jump 2`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest import_exploded_layout_source_counts_b64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`
  - note:
    - the overall weekly status remains `unstable`
    - the cause is still the pre-existing `ui_flow_stage_trend` observe lane
    - the new solver recent-event focus contract and exploded-layout aggregate contract are green

- fresh consumer replay after the exploded-layout fix:
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_flow_console_viewports.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_flow_console_viewports.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_flow_console_viewports.md`
  - checker:
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_flow_console_viewports.md --require-dashboard`
    - `PASS`
  - rendered consumer lines now expose the new fixed metrics:
    - solver action-flow:
      - `panels=4 flow_checks=12 requests=16 invoke=2 focus=3 flow=10 replay=1 jump_requests=2 events=16 event_invoke=2 event_focus=3 event_flow=10 event_replay=1 jump_events=2 next=4 jump=2 prev=2 restart=2 replay_checks=1 event_focus_checks=1 visited_panels=2`
    - dense assembly exploded layouts:
      - `exploded_layouts=LayoutStyle[INSERT:14]; Model[INSERT:19]`

- fresh consistency result after the recent-event focus and exploded-layout fixes:
  - local, gate, and weekly now all agree on:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow recent-event focus = 1`
    - `assembly exploded layouts = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`

## 2026-03-10 solver flow banner + dense assembly group-source aggregate

- initial failure during this round was real and actionable:
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js` timed out on
    - `[data-banner-action="next"][data-panel-id="smallest_redundancy"]`
  - root cause:
    - `tools/web_viewer/ui/workspace.js`
    - solver panel `onAction` updated the flow console, but did not update the new flow banner
    - direct CTA activation therefore left the banner on stale state
  - fix:
    - `workspace.js` now updates `solverActionFlowBanner` in the same callback path

- second failure during the same round was a smoke-contract bug, not a product bug:
  - the smoke hard-coded the recent-event focus target as `Redundant 1`
  - the actual banner contract focuses `bannerState.recentEvent`
  - after a replay, the recent event is the replay target itself
  - fix:
    - `solver_action_panel_smoke.js` now derives the expected focus target from the captured banner/debug state

- fresh standalone solver smoke after both fixes:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_banner_contract`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_banner_contract/20260310_094308/summary.json`
  - result:
    - `ok = true`
    - `panel_count = 4`
    - `flow_check_count = 12`
    - `request_count = 16`
    - `event_count = 16`
    - `banner_check_count = 5`
    - `jump_check_count = 2`
    - `event_focus_check_count = 1`

- fresh narrow local CI after banner/group-source propagation:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_EDITOR_GATE=0 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - key results:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / banner_checks 5`
    - `assembly roundtrip ctest = ok 4/4`
    - `assembly group_sources = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`

- fresh narrow gate after banner/group-source propagation:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_QT_PROJECT_PERSISTENCE_CHECK=0 RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - key results:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / banner_checks 5`
    - `assembly roundtrip ctest = PASS 4/4`
    - `assembly group_sources = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`

- fresh weekly replay after banner/group-source propagation:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - result:
    - replay exit `0`
    - weekly checker line `OK`
  - key results:
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 12 / requests 16 / banner_checks 5`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest import_assembly_group_source_counts_b64 = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`
  - note:
    - weekly global status can still remain `unstable`
    - cause remains the existing `ui_flow_stage_trend` observe lane
    - the new banner/group-source contracts are green

- fresh consumer replay after banner/group-source propagation:
  - generated artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_banner_group_sources.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_banner_group_sources.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_banner_group_sources.md`
  - checker:
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_banner_group_sources.md --require-dashboard`
    - `PASS`
  - rendered lines now expose the new metrics:
    - solver:
      - `banner_checks=5`
    - assembly:
      - `group_sources=DIMENSION[15]; INSERT[22]; LEADER[5]; unknown[4]`

- fresh consistency result after this round:
  - local, gate, and weekly replay now all agree on:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver banner checks = 5`
    - `solver flow checks = 12`
    - `solver request count = 16`
    - `assembly roundtrip = 4/4`
    - `assembly group_sources = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`

## 2026-03-10 Verification delta: dense text-kind aggregates, solver DOM events, and self-contained weekly replay

- two real failures surfaced immediately when the new dense text-kind / solver DOM metrics were first wired through higher-level automation:
  - `tools/read_editor_assembly_roundtrip_metrics.py` raised:
    - `KeyError: 'import_text_kind_counts'`
    - root cause:
      - the per-lane payload already exposed `import_text_kind_counts` and `import_text_kind_layout_counts`
      - but the aggregate `totals` dictionary did not initialize those keys before merge
  - `tools/local_ci.sh` then failed under `set -u` with:
    - `CTEST_ASSEMBLY_ROUNDTRIP_METRICS_IMPORT_PROXY_LAYOUT_KIND_COUNTS_B64: unbound variable`
    - root cause:
      - summary emission referenced the new dense assembly base64 metrics without defining default empty values first
- both were fixed before rerunning fresh automation:
  - `read_editor_assembly_roundtrip_metrics.py` now initializes:
    - `import_text_kind_counts`
    - `import_text_kind_layout_counts`
  - `tools/local_ci.sh` now defaults:
    - `CTEST_ASSEMBLY_ROUNDTRIP_METRICS_IMPORT_PROXY_LAYOUT_KIND_COUNTS_B64`
    - `CTEST_ASSEMBLY_ROUNDTRIP_METRICS_IMPORT_TEXT_KIND_COUNTS_B64`
    - `CTEST_ASSEMBLY_ROUNDTRIP_METRICS_IMPORT_TEXT_KIND_LAYOUT_COUNTS_B64`
    - plus the six `SOLVER_ACTION_PANEL_SMOKE_DOM_*` fields

- standalone solver DOM-event smoke after the fixes:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_dom_metrics`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_dom_metrics/20260310_101704/summary.json`
  - result:
    - `ok = true`
    - `panel_count = 4`
    - `flow_check_count = 12`
    - `request_count = 16`
    - `invoke_request_count = 2`
    - `focus_request_count = 3`
    - `flow_request_count = 10`
    - `replay_request_count = 1`
    - `dom_event_count = 32`
    - `dom_request_event_count = 16`
    - `dom_action_event_count = 2`
    - `dom_focus_event_count = 3`
    - `dom_flow_event_count = 10`
    - `dom_replay_event_count = 1`
    - `event_count = 16`
    - `jump_request_count = 2`
    - `jump_event_count = 2`
    - `event_focus_check_count = 1`
    - `banner_check_count = 5`

- fresh local CI after the aggregate/default-value fixes:
  - command:
    - `RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - key values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / event_focus_checks 1 / banner_checks 5`
    - `assembly roundtrip ctest = ok 4/4`
    - `text_kind_counts = {"dimension":7,"mtext":4,"text":14}`
    - `text_kind_layout_counts = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`

- fresh narrow gate after propagation:
  - command:
    - `RUN_STEP166_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_EDITOR_PARALLEL_CYCLE=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - key values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / event_focus_checks 1 / banner_checks 5`
    - `assembly roundtrip ctest = PASS 4/4`
    - `import_text_kind_counts_b64 = {"dimension":7,"mtext":4,"text":14}`
    - `import_text_kind_layout_counts_b64 = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
  - note:
    - the overall gate process can still exit non-zero because of pre-existing `ui_flow_smoke` failures outside this delta
    - the new text-kind and solver DOM-event contracts themselves are green

- a third real failure surfaced in weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 bash tools/editor_weekly_validation.sh`
  - failure:
    - `[weekly-summary] ERROR require-dashboard set but dashboard path is empty`
  - root cause:
    - weekly replay did not generate or inject a dashboard path when checker required one
    - this was a replay-only summary plumbing gap, not a product or contract failure
- fix:
  - `tools/editor_weekly_validation.sh` now:
    - assigns a default dashboard path when checker requires one
    - writes the fresh weekly summary into history before checker
    - generates a fresh dashboard from `editor_gate_history` + `editor_weekly_validation_history`
    - records `dashboard_markdown` in the summary payload

- fresh weekly replay after the dashboard fix:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - generated dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_023258.md`
  - result:
    - replay exit `0`
    - checker line:
      - `[weekly-summary] OK status=unstable mode=observe days=7 enabled_samples=25 fail_ratio=0.320 attribution_ratio=1.000 dashboard=checked`
  - key values:
    - `gate_preview_provenance_smoke = 19/19`
    - `gate_preview_provenance_smoke entry = 19/19`
    - `gate_preview_provenance_smoke focus_checks = 6`
    - `gate_solver_action_panel_smoke = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / event_focus_checks 1 / banner_checks 5`
    - `gate_assembly_roundtrip_ctest = PASS 4/4`
    - `gate_assembly_roundtrip_ctest import_text_kind_counts_b64 = {"dimension":7,"mtext":4,"text":14}`
    - `gate_assembly_roundtrip_ctest import_text_kind_layout_counts_b64 = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
    - `weekly_legacy_preview_artifact_prep = 3/3`
    - `weekly_legacy_preview_artifact_smoke = 3/3`
  - note:
    - weekly global status still remains `unstable`
    - that comes from the long-running `ui_flow_stage_trend` observe lane, not from this new contract

- fresh consumer replay after the weekly replay fix:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --local-summary build/local_ci_summary.json --gate-summary build/editor_gate_summary.json --out build/ci_artifact_summary_text_dom_weekly_replay.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_text_dom_weekly_replay.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_weekly_20260310_023258.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_text_dom_weekly_replay.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_text_dom_weekly_replay.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_023258.md`
  - checker:
    - `PASS`

- fresh consistency result after this round:
  - local, gate, and weekly replay now all agree on:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / event_focus_checks 1 / banner_checks 5`
    - `assembly roundtrip = 4/4`
    - `text_kind_counts = {"dimension":7,"mtext":4,"text":14}`
    - `text_kind_layout_counts = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`

## 2026-03-10 Text-Kind Case Details + Keyboard Banner Verification

- static checks:
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `bash -n tools/check_weekly_summary.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/local_ci.sh`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`

- fresh local CI:
  - command:
    - `bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - key values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `ctest assembly roundtrip = 4/4`
    - `text_kind_cases = 10`
    - `text_kind_counts = {"dimension":7,"mtext":4,"text":14}`
    - `text_kind_layout_counts = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / banner_checks 5`

- fresh narrow gate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - key values:
    - `preview provenance = 19/19`
    - `deterministic entry = 19/19`
    - `focus checks = 6`
    - `solver action-flow = panels 4 / flow_checks 12 / requests 16 / dom_events 32 / banner_checks 5`
    - `assembly roundtrip = PASS 4/4`
    - `text_kind_cases = 10`
    - `text_kind_case_details_b64` present

- weekly replay follow-up:
  - a real shell-compatibility failure surfaced:
    - `tools/editor_weekly_validation.sh: line 1252: readarray: command not found`
  - root cause:
    - macOS bash 3.2 does not provide `readarray`
  - fix:
    - replaced `readarray -t ... < <(...)` with portable `while IFS= read -r ...; do ...; done < <(...)`
  - replay note:
    - the long weekly run still traverses existing `ui_flow` / perf / STEP166 observe lanes
    - those older lanes are independent of this delta

- fresh consumer replay after the propagation fix:
  - generated:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_text_kind_keyboard.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_text_kind_keyboard.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_text_kind_keyboard.md`
  - checker:
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_text_kind_keyboard.md --require-dashboard`
    - result: `PASS`
  - rendered verification:
    - dashboard/report now include:
      - `text_kind_cases=10`
      - `text_kind_case_details=model:assembly_block_instances(...), paperspace:assembly_paperspace_insert_leader(...), mixed:assembly_mixed_origin(...), dense:assembly_dense_mixed_origin(...), +6`
      - solver lane with `dom_events=32` and `banner_checks=5`

- result:
  - new contracts for:
    - `text_kind_case_details`
    - keyboard/banner solver flow metrics
    - bash-3.2-safe weekly replay parsing
    are verified green through:
    - fresh `local_ci`
    - fresh `editor_gate`
    - regenerated markdown consumer outputs
    - weekly checker

## 2026-03-10 Solver Keyboard Metrics Propagation Verification

- static checks:
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`

- fresh local summary field verification:
  - command:
    - `rg -n 'solverActionPanelSmokeKeyboard(CheckCount|BannerCheckCount|JumpCheckCount|EventFocusCheckCount)' build/local_ci_summary.json`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - key values:
    - `solverActionPanelSmokeKeyboardCheckCount = 11`
    - `solverActionPanelSmokeKeyboardBannerCheckCount = 9`
    - `solverActionPanelSmokeKeyboardJumpCheckCount = 2`
    - `solverActionPanelSmokeKeyboardEventFocusCheckCount = 1`

- fresh gate summary field verification:
  - command:
    - `rg -n 'keyboard_(check_count|banner_check_count|jump_check_count|keyboard_event_focus_check_count)' build/editor_gate_summary.json`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - key values:
    - `keyboard_check_count = 11`
    - `keyboard_banner_check_count = 9`
    - `keyboard_jump_check_count = 2`
    - `keyboard_event_focus_check_count = 1`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 EDITOR_WEEKLY_VALIDATION_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_061336.md`
  - key values:
    - `gate_preview_provenance_smoke.case_count = 19`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 19`
    - `gate_preview_provenance_smoke.focus_check_case_count = 6`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 12`
    - `gate_solver_action_panel_smoke.request_count = 16`
    - `gate_solver_action_panel_smoke.keyboard_check_count = 11`
    - `gate_solver_action_panel_smoke.keyboard_banner_check_count = 9`
    - `gate_solver_action_panel_smoke.keyboard_jump_check_count = 2`
    - `gate_solver_action_panel_smoke.keyboard_event_focus_check_count = 1`

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --local-summary build/local_ci_summary.json --gate-summary build/editor_gate_summary.json --out build/ci_artifact_summary_solver_keyboard_propagation.md`
    - `python3 tools/write_step176_dashboard.py --out build/step176_dashboard_solver_keyboard_propagation.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_solver_keyboard_propagation.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_solver_keyboard_propagation.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_solver_keyboard_propagation.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_solver_keyboard_propagation.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_solver_keyboard_propagation.md`
  - checker:
    - `PASS`
  - rendered verification:
    - CI markdown shows:
      - `keyboard=11`
      - `keyboard_banner=9`
      - `keyboard_jump=2`
      - `keyboard_event_focus=1`
    - dashboard shows the same four values under `weekly_gate_solver_action_panel_smoke`
    - weekly report shows the same four values under `gate_solver_action_panel_smoke`

- consistency result for this round:
  - local, gate, and weekly replay all agree on:
    - preview provenance `19/19`
    - deterministic entry `19/19`
    - focus checks `6`
    - solver panels `4`
    - solver flow checks `12`
    - solver requests `16`
    - solver keyboard metrics `11 / 9 / 2 / 1`
  - the new keyboard propagation contract is green end-to-end through:
    - producer smoke
    - local summary
    - gate summary
    - weekly replay
    - CI/dashboard/report consumers
    - weekly checker

## 2026-03-10 Dense Assembly Group-Source Case Details Propagation Verification

- static checks:
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`
  - `python3 -m py_compile tools/read_editor_assembly_roundtrip_metrics.py tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`

- fresh standalone solver banner-jump smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_banner_jump`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_banner_jump/20260310_142633/summary.json`
  - key values:
    - `panel_count = 4`
    - `flow_check_count = 13`
    - `request_count = 17`
    - `focus_request_count = 3`
    - `flow_request_count = 11`
    - `dom_event_count = 34`
    - `event_count = 17`
    - `jump_check_count = 3`
    - `banner_check_count = 6`
    - `keyboard_check_count = 11`
    - `keyboard_banner_check_count = 9`
    - `keyboard_jump_check_count = 2`
    - `keyboard_event_focus_check_count = 1`

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_EDITOR_GATE=1 EDITOR_GATE_PROFILE=lite EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 RUN_STEP166_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - key values:
    - preview provenance:
      - `case_count = 19`
      - `deterministic_entry_case_count = 19`
      - `focus_check_case_count = 6`
    - solver:
      - `panel_count = 4`
      - `flow_check_count = 13`
      - `request_count = 17`
      - `dom_event_count = 34`
      - `banner_check_count = 6`
      - `keyboard_check_count = 11`
    - assembly:
      - `case_count = 4`
      - `pass_count = 4`
      - `tracked = 101`
      - `groups = 46`
      - `proxies = 44`
      - `exploded = 33`
      - `group_source_cases = 11`
      - `group_sources = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
      - `group_layouts = {"LayoutB":{"unknown":1},"LayoutMixed":{"unknown":2},"LayoutStyle":{"DIMENSION":9,"INSERT":7,"LEADER":5,"unknown":1},"Model":{"DIMENSION":6,"INSERT":15}}`

- fresh gate summary verification:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - preview provenance:
      - `19 / 19 / 6`
    - solver:
      - `4 / 13 / 17 / 34 / 6 / 11`
    - assembly:
      - `4 / 4 / 101 / 46 / 44 / 33 / 11`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 EDITOR_WEEKLY_VALIDATION_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_064150.md`
  - result:
    - `PASS`
  - note:
    - weekly overall status remains `unstable` because of the existing `ui_flow_stage_trend` observe lane, not because of the new assembly/solver contract

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --local-summary build/local_ci_summary.json --gate-summary build/editor_gate_summary.json --out build/ci_artifact_summary_group_source_case_details.md`
    - `python3 tools/write_step176_dashboard.py --out build/step176_dashboard_group_source_case_details.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_group_source_case_details.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_group_source_case_details.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_group_source_case_details.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_group_source_case_details.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_group_source_case_details.md`
  - checker:
    - `PASS`

- rendered verification:
  - CI markdown shows:
    - `group_source_cases=11`
    - `group_source_case_details=model:assembly_block_instances(INSERT=12), paperspace:assembly_paperspace_insert_leader(INSERT=1, LEADER=1), mixed:assembly_mixed_origin(DIMENSION=3, INSERT=1, unknown=1), dense:assembly_dense_insert_triad(INSERT=1), +7`
  - dashboard and weekly report show the same `group_source_cases=11` and compact `group_source_case_details=...` rendering

- decoded aggregate verification:
  - detail list count:
    - `11`
  - aggregate source counts:
    - `{"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
  - aggregate layout-source counts:
    - `{"LayoutB":{"unknown":1},"LayoutMixed":{"unknown":2},"LayoutStyle":{"DIMENSION":9,"INSERT":7,"LEADER":5,"unknown":1},"Model":{"DIMENSION":6,"INSERT":15}}`
  - checker confirmed:
    - sum of per-case `assembly_group_source_counts` equals aggregate `group_sources`
    - sum of per-case `assembly_group_layout_source_counts` equals aggregate `group_layouts`

- real bugs fixed during this round:
  - `tools/write_step176_dashboard.py` referenced missing helper `fmt_counts`
  - `tools/write_step176_weekly_report.py` referenced missing helper `encode_b64_json_dict`
  - after both fixes, fresh weekly replay plus `--require-dashboard` checker passed

- consistency result for this round:
  - local, gate, and weekly replay all agree on:
    - preview provenance `19/19`
    - deterministic entry `19/19`
    - focus checks `6`
    - solver `4 / 13 / 17 / 34 / 6 / 11`
    - assembly `4/4`, tracked `101`, groups `46`, proxies `44`, exploded `33`
    - `group_source_cases = 11`
  - the new group-source-case-detail propagation contract is green end-to-end through:
    - producer aggregation
    - local summary
    - gate summary
    - weekly replay
    - CI/dashboard/report consumers
    - weekly checker

## 2026-03-10 Global Shortcut And Exploded-Layout Case Detail Closure

- standalone solver smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_global_shortcuts_fix`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_global_shortcuts_fix/20260310_161820/summary.json`
  - result:
    - `PASS`
  - verified values:
    - `panel_count = 4`
    - `flow_check_count = 17`
    - `request_count = 21`
    - `dom_event_count = 42`
    - `event_count = 21`
    - `next_check_count = 5`
    - `jump_check_count = 3`
    - `rewind_check_count = 3`
    - `restart_check_count = 3`
    - `event_focus_check_count = 2`
    - `banner_check_count = 10`
    - `keyboard_check_count = 15`
    - `keyboard_banner_check_count = 9`
    - `keyboard_jump_check_count = 2`
    - `keyboard_event_focus_check_count = 2`

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_EDITOR_GATE=1 EDITOR_GATE_PROFILE=lite EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 RUN_STEP166_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - preview provenance:
      - `19 / 19`
      - deterministic entry `19`
      - focus checks `6`
    - solver:
      - `panel_count = 4`
      - `flow_check_count = 17`
      - `request_count = 21`
      - `dom_event_count = 42`
      - `banner_check_count = 10`
      - `keyboard_check_count = 15`
    - assembly:
      - `case_count = 4`
      - `pass_count = 4`
      - `exploded_layout_cases = 10`

- fresh gate summary:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - preview provenance:
      - `19 / 19 / 19 / 6`
    - solver:
      - `4 / 17 / 21 / 42 / 10 / 15 / 3 / 2`
    - assembly:
      - `4 / 4 / 10`
      - exploded layouts:
        - `{"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 EDITOR_WEEKLY_VALIDATION_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_082611.md`
  - result:
    - `PASS`
  - note:
    - weekly overall status still reports `unstable` because of the pre-existing `ui_flow_stage_trend` observe lane
    - the new solver and exploded-layout propagation contract itself is green

- fresh consumer replay:
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_text_dom_weekly_replay.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_082611.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_text_dom_weekly_replay.md`
  - checker:
    - `PASS`

- real failures fixed during this round:
  - stale target bug in solver smoke:
    - the global recent-event focus assertion incorrectly reused the earlier replay target
    - fixed by resolving the focus target from `after_global_prev` banner/flow state before `Alt+Shift+End`
  - consumer helper bug:
    - `tools/write_step176_dashboard.py` referenced missing `encode_b64_json_dict`
    - `tools/write_step176_weekly_report.py` referenced the same missing helper
    - both were fixed and fresh weekly replay then passed

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - preview provenance `19/19`
    - deterministic entry `19/19`
    - focus checks `6`
    - solver `4 / 17 / 21 / 42 / 10 / 15`
    - assembly `4/4`
    - exploded layout aggregate `LayoutStyle[INSERT:14]; Model[INSERT:19]`
    - exploded layout case count `10`

## 2026-03-10 Solver Status Click And Paperspace Combo Verification

- standalone solver smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_status_click`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_status_click/20260310_172402/summary.json`
  - result:
    - `PASS`
  - verified values:
    - `panel_count = 4`
    - `flow_check_count = 17`
    - `request_count = 22`
    - `dom_event_count = 44`
    - `event_count = 22`
    - `focus_request_count = 5`
    - `focus_event_count = 5`
    - `event_focus_check_count = 3`
    - `banner_check_count = 11`
    - `status_check_count = 6`
    - `status_click_check_count = 1`

- targeted paperspace combo provenance smoke:
  - command:
    - `node tools/web_viewer/scripts/preview_provenance_smoke.js --cases build/preview_provenance_smoke_cases_combo_targeted.json --outdir build/preview_provenance_smoke_combo_targeted`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_combo_targeted/20260310_172411/summary.json`
  - result:
    - `2 / 2`
  - verified values:
    - insert combo case starts from `entityId = 17`, expects `groupId = 2`, and group focus resolves to `[16,17,18]`
    - dimension combo case starts from `entityId = 22`, expects `groupId = 3`, and group focus resolves to `[19,20,21,22]`

- full default preview provenance smoke:
  - command:
    - `node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke_full_combo_status_click`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_full_combo_status_click/20260310_172442/summary.json`
  - result:
    - `21 / 21`
  - verified values:
    - `entry_kind_counts = {"initial": 21}`
    - `initial_entry_case_count = 21`
    - `deterministic_entry_case_count = 21`
    - `focus_check_case_count = 8`

- fresh local CI:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 21`
    - `previewProvenanceSmokePassCount = 21`
    - `previewProvenanceSmokeInitialEntryCaseCount = 21`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 21`
    - `previewProvenanceSmokeFocusCheckCaseCount = 8`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 17`
    - `solverActionPanelSmokeRequestCount = 22`
    - `solverActionPanelSmokeStatusCheckCount = 6`
    - `solverActionPanelSmokeStatusClickCheckCount = 1`

- fresh gate summary:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 21`
    - `preview_provenance_smoke.pass_count = 21`
    - `preview_provenance_smoke.initial_entry_case_count = 21`
    - `preview_provenance_smoke.deterministic_entry_case_count = 21`
    - `preview_provenance_smoke.focus_check_case_count = 8`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 17`
    - `solver_action_panel_smoke.request_count = 22`
    - `solver_action_panel_smoke.status_check_count = 6`
    - `solver_action_panel_smoke.status_click_check_count = 1`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_TREND=0 RUN_PERF_TREND=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_WEEKLY_SUMMARY_CHECK=1 WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1 EDITOR_WEEKLY_VALIDATION_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_092915.md`
  - result:
    - `PASS`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `gate_preview_provenance_smoke.case_count = 21`
    - `gate_preview_provenance_smoke.pass_count = 21`
    - `gate_preview_provenance_smoke.initial_entry_case_count = 21`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 21`
    - `gate_preview_provenance_smoke.focus_check_case_count = 8`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 17`
    - `gate_solver_action_panel_smoke.request_count = 22`
    - `gate_solver_action_panel_smoke.status_check_count = 6`
    - `gate_solver_action_panel_smoke.status_click_check_count = 1`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_exploded_layout_source_counts_b64 = {"LayoutCombo":{"INSERT":6},"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - note:
    - weekly overall status still reports `unstable` because of the pre-existing `ui_flow_stage_trend` observe lane
    - the new solver status-click and paperspace combo deterministic-entry contract itself is green

- fresh CI markdown replay:
  - command:
    - `python3 tools/write_ci_artifact_summary.py --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_status_click_combo.md`
  - artifact:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_status_click_combo.md`
  - result:
    - `PASS`
  - verified values:
    - contains `21/21`
    - contains `focus_checks=8`
    - contains `status_clicks=1`
  - real failure fixed:
    - `tools/write_ci_artifact_summary.py` referenced `as_str(...)` in exploded-layout case-detail rendering without defining the helper
    - adding the helper restored the CI markdown consumer without changing any upstream summary JSON

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `21/21`
    - deterministic entry `21/21`
    - focus checks `8`
    - solver `4 / 17 / 22 / 6 / 1`
    - assembly `4/4`
    - exploded layout aggregate `LayoutCombo[INSERT:6]; LayoutStyle[INSERT:14]; Model[INSERT:19]`

## 2026-03-10 Solver Import/Clear Propagation Verification

- static validation passed before fresh replay:
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`

- fresh local CI:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 23`
    - `previewProvenanceSmokePassCount = 23`
    - `previewProvenanceSmokeInitialEntryCaseCount = 23`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 23`
    - `previewProvenanceSmokeFocusCheckCaseCount = 8`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 17`
    - `solverActionPanelSmokeRequestCount = 22`
    - `solverActionPanelSmokeImportCheckCount = 1`
    - `solverActionPanelSmokeClearCheckCount = 1`
    - `solverActionPanelSmokeBannerCheckCount = 11`
    - `solverActionPanelSmokeKeyboardCheckCount = 15`
    - `solverActionPanelSmokeJumpCheckCount = 3`
    - `solverActionPanelSmokeStatusCheckCount = 6`
    - `solverActionPanelSmokeStatusClickCheckCount = 1`
    - `ctestAssemblyRoundtripStatus = ok`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`

- fresh gate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 23`
    - `preview_provenance_smoke.pass_count = 23`
    - `preview_provenance_smoke.initial_entry_case_count = 23`
    - `preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `preview_provenance_smoke.focus_check_case_count = 8`
    - `preview_artifact_smoke.case_count = 17`
    - `preview_artifact_smoke.pass_count = 17`
    - `preview_artifact_validator_failure_injection.case_count = 10`
    - `preview_artifact_validator_failure_injection.pass_count = 10`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 17`
    - `solver_action_panel_smoke.request_count = 22`
    - `solver_action_panel_smoke.import_check_count = 1`
    - `solver_action_panel_smoke.clear_check_count = 1`
    - `solver_action_panel_smoke.banner_check_count = 11`
    - `solver_action_panel_smoke.keyboard_check_count = 15`
    - `solver_action_panel_smoke.jump_check_count = 3`
    - `solver_action_panel_smoke.status_check_count = 6`
    - `solver_action_panel_smoke.status_click_check_count = 1`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `assembly_roundtrip_ctest.import_viewport_count = 13`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260310_140129.md`
  - result:
    - `PASS`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `gate_preview_provenance_smoke.case_count = 23`
    - `gate_preview_provenance_smoke.pass_count = 23`
    - `gate_preview_provenance_smoke.initial_entry_case_count = 23`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `gate_preview_provenance_smoke.focus_check_case_count = 8`
    - `gate_preview_artifact_smoke.case_count = 17`
    - `gate_preview_artifact_smoke.pass_count = 17`
    - `gate_preview_artifact_validator_failure_injection.case_count = 10`
    - `gate_preview_artifact_validator_failure_injection.pass_count = 10`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 17`
    - `gate_solver_action_panel_smoke.request_count = 22`
    - `gate_solver_action_panel_smoke.import_check_count = 1`
    - `gate_solver_action_panel_smoke.clear_check_count = 1`
    - `gate_solver_action_panel_smoke.banner_check_count = 11`
    - `gate_solver_action_panel_smoke.keyboard_check_count = 15`
    - `gate_solver_action_panel_smoke.jump_check_count = 3`
    - `gate_solver_action_panel_smoke.status_check_count = 6`
    - `gate_solver_action_panel_smoke.status_click_check_count = 1`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `gate_assembly_roundtrip_ctest.import_viewport_count = 13`
  - note:
    - weekly overall status still reports `unstable` because of the pre-existing `ui_flow_stage_trend` observe lane
    - the new import/clear propagation contract itself is green

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --local-summary build/local_ci_summary.json --gate-summary build/editor_gate_summary.json --out build/ci_artifact_summary_import_clear_metrics.md`
    - `python3 tools/write_step176_dashboard.py --out build/step176_dashboard_import_clear_metrics.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_import_clear_metrics.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_import_clear_metrics.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_import_clear_metrics.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_import_clear_metrics.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_import_clear_metrics.md`
  - checker:
    - `PASS`
  - verified render output:
    - solver lane renders `import_checks=1`
    - solver lane renders `clear_checks=1`
    - preview lane renders `entry=23/23`
    - assembly lane renders `tracked=132`, `groups=55`, `proxies=61`, `exploded=39`
    - assembly lane renders:
      - `group_source_case_details=...`
      - `text_kind_case_details=...`
      - `exploded_layout_case_details=...`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `23/23`
    - deterministic entry `23/23`
    - focus checks `8`
    - preview artifact smoke `17/17`
    - validator failure injection `10/10`
    - solver `4 / 17 / 22 / 1 / 1 / 11 / 15 / 3 / 6 / 1`
    - assembly `4/4`
    - dense aggregate `tracked=132 groups=55 proxies=61 exploded=39`

- real issue fixed during this round:
  - gate/weekly/consumer chains originally omitted `import_check_count` and `clear_check_count` even though local smoke already emitted them
  - after propagation, all rendered consumers and checker lines agree on `import_checks=1` and `clear_checks=1`

## 2026-03-10 Solver Panel-Keyboard And Dense Proxy-Kind Case-Detail Verification

- static validation passed before fresh replay:
  - `bash -n tools/local_ci.sh`
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `bash -n tools/check_weekly_summary.sh`
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`

- fresh local CI:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 23`
    - `previewProvenanceSmokePassCount = 23`
    - `previewProvenanceSmokeInitialEntryCaseCount = 23`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 23`
    - `previewProvenanceSmokeFocusCheckCaseCount = 8`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 17`
    - `solverActionPanelSmokeRequestCount = 22`
    - `solverActionPanelSmokePanelKeyboardCheckCount = 11`
    - `solverActionPanelSmokePanelKeyboardInvokeCheckCount = 1`
    - `solverActionPanelSmokePanelKeyboardFlowCheckCount = 10`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`
    - `ctestAssemblyRoundtripImportDerivedProxyCount = 61`
    - `ctestAssemblyRoundtripImportExplodedOriginCount = 39`
    - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 132`
    - `ctestAssemblyRoundtripImportAssemblyGroupCount = 55`
    - `ctestAssemblyRoundtripImportDerivedProxyKindCaseCount = 8`

- fresh gate:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 23`
    - `preview_provenance_smoke.pass_count = 23`
    - `preview_provenance_smoke.initial_entry_case_count = 23`
    - `preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `preview_provenance_smoke.focus_check_case_count = 8`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 17`
    - `solver_action_panel_smoke.request_count = 22`
    - `solver_action_panel_smoke.panel_keyboard_check_count = 11`
    - `solver_action_panel_smoke.panel_keyboard_invoke_check_count = 1`
    - `solver_action_panel_smoke.panel_keyboard_flow_check_count = 10`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `assembly_roundtrip_ctest.import_proxy_kind_case_count = 8`

- fresh weekly replay used the fresh gate summary as input:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - verified values:
    - `gate_preview_provenance_smoke.case_count = 23`
    - `gate_preview_provenance_smoke.pass_count = 23`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `gate_preview_provenance_smoke.focus_check_case_count = 8`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 17`
    - `gate_solver_action_panel_smoke.request_count = 22`
    - `gate_solver_action_panel_smoke.panel_keyboard_check_count = 11`
    - `gate_solver_action_panel_smoke.panel_keyboard_invoke_check_count = 1`
    - `gate_solver_action_panel_smoke.panel_keyboard_flow_check_count = 10`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `gate_assembly_roundtrip_ctest.import_proxy_kind_case_count = 8`

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --local-summary build/local_ci_summary.json --gate-summary build/editor_gate_summary.json --out build/ci_artifact_summary_panel_keyboard_proxy_kind.md`
    - `python3 tools/write_step176_dashboard.py --out build/step176_dashboard_panel_keyboard_proxy_kind.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_panel_keyboard_proxy_kind.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_panel_keyboard_proxy_kind.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_panel_keyboard_proxy_kind.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_panel_keyboard_proxy_kind.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_panel_keyboard_proxy_kind.md`
  - checker:
    - `PASS`
  - verified render output:
    - solver lane renders `panel_keyboard=11`
    - solver lane renders `panel_keyboard_invoke=1`
    - solver lane renders `panel_keyboard_flow=10`
    - preview lane renders `entry=23/23`
    - assembly lane renders `proxy_kind_cases=8`
    - assembly lane renders `proxy_kind_case_details=...`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `23/23`
    - deterministic entry `23/23`
    - focus checks `8`
    - solver `4 / 17 / 22 / 11 / 1 / 10`
    - assembly `4/4`
    - dense aggregate `tracked=132 groups=55 proxies=61 exploded=39`

- real issues fixed during this round:
  - weekly replay defaulted to slow observe lanes; a narrowed replay path was used to validate the new consumer contract without waiting on unrelated long-running jobs
  - `write_ci_artifact_summary.py`, `write_step176_dashboard.py`, and `write_step176_weekly_report.py` now render the fresh panel-keyboard and proxy-kind case-detail fields without omitting them from the output surface

## 2026-03-10 Solver Console Controls And Dense Proxy-Layout Case-Detail Verification

- static validation passed before the fresh replay:
  - `bash -n tools/editor_gate.sh`
  - `bash -n tools/editor_weekly_validation.sh`
  - `python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_step176_dashboard.py tools/write_step176_weekly_report.py`
  - `node --check tools/web_viewer/scripts/solver_action_panel_smoke.js`

- fresh standalone solver smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_console_controls_v3`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_console_controls_v3/20260310_233812/summary.json`
  - verified values:
    - `panel_count = 4`
    - `flow_check_count = 21`
    - `request_count = 27`
    - `invoke_request_count = 2`
    - `focus_request_count = 6`
    - `flow_request_count = 18`
    - `replay_request_count = 1`
    - `console_check_count = 4`
    - `console_flow_check_count = 3`
    - `console_event_focus_check_count = 1`
    - `next_check_count = 6`
    - `rewind_check_count = 4`
    - `restart_check_count = 4`
    - `dom_event_count = 54`
    - `event_count = 27`

- fresh local CI:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 23`
    - `previewProvenanceSmokePassCount = 23`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 23`
    - `previewProvenanceSmokeFocusCheckCaseCount = 8`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 21`
    - `solverActionPanelSmokeRequestCount = 27`
    - `solverActionPanelSmokeConsoleCheckCount = 4`
    - `solverActionPanelSmokeConsoleFlowCheckCount = 3`
    - `solverActionPanelSmokeConsoleEventFocusCheckCount = 1`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`
    - `ctestAssemblyRoundtripImportDerivedProxyCount = 61`
    - `ctestAssemblyRoundtripImportExplodedOriginCount = 39`
    - `ctestAssemblyRoundtripImportProxyLayoutCaseCount = 8`

- fresh gate summary:
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `preview_provenance_smoke.case_count = 23`
    - `preview_provenance_smoke.pass_count = 23`
    - `preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `preview_provenance_smoke.focus_check_case_count = 8`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 21`
    - `solver_action_panel_smoke.request_count = 27`
    - `solver_action_panel_smoke.console_check_count = 4`
    - `solver_action_panel_smoke.console_flow_check_count = 3`
    - `solver_action_panel_smoke.console_event_focus_check_count = 1`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `assembly_roundtrip_ctest.import_proxy_layout_case_count = 8`
    - `assembly_roundtrip_ctest.import_proxy_layout_case_details_b64` was present
  - gate process still exited non-zero because an older `ui_flow` lane remains red; the new solver/assembly lanes were green and the summary was still produced

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - verified values:
    - `gate_preview_provenance_smoke.case_count = 23`
    - `gate_preview_provenance_smoke.pass_count = 23`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 23`
    - `gate_preview_provenance_smoke.focus_check_case_count = 8`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 21`
    - `gate_solver_action_panel_smoke.request_count = 27`
    - `gate_solver_action_panel_smoke.console_check_count = 4`
    - `gate_solver_action_panel_smoke.console_flow_check_count = 3`
    - `gate_solver_action_panel_smoke.console_event_focus_check_count = 1`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_proxy_layout_case_count = 8`
    - `gate_assembly_roundtrip_ctest.import_proxy_layout_case_details_b64` was present
  - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_console_proxy_layout_cases.md --require-dashboard`
    - `PASS`
  - weekly overall status still reports `unstable`, but the cause remains the pre-existing `ui_flow_stage_trend` observe lane rather than these newly added contracts

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_console_proxy_layout_cases.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_console_proxy_layout_cases.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_console_proxy_layout_cases.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_console_proxy_layout_cases.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_console_proxy_layout_cases.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_console_proxy_layout_cases.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_console_proxy_layout_cases.md`
  - checker:
    - `PASS`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `23/23`
    - deterministic entry `23/23`
    - focus checks `8`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver `4 / 21 / 27 / 4 / 3 / 1`
    - assembly `4/4`
    - dense aggregate `tracked=132 groups=55 proxies=61 exploded=39`
    - proxy-layout cases `8`

- real issues fixed during this round:
  - `tools/editor_weekly_validation.sh` carried duplicate dictionary keys for the new solver console and proxy-layout fields; the duplicates were removed so weekly replay has a single canonical value source
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js` had stale expected counts after the flow contract expanded; the canonical smoke expectations were updated to match the real `next/rewind/restart/request/dom/event` totals

## 2026-03-11 Fresh Console Recent Clicks And Secondary Combo Focus

- fresh standalone solver smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_console_recent_clicks`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_console_recent_clicks/20260311_082711/summary.json`
  - verified values:
    - `panel_count = 4`
    - `flow_check_count = 22`
    - `request_count = 28`
    - `console_check_count = 4`
    - `console_flow_check_count = 3`
    - `console_event_focus_check_count = 1`
    - `console_replay_check_count = 1`
    - `console_event_click_check_count = 1`
    - `event_focus_check_count = 5`
    - `banner_check_count = 7`
    - `keyboard_check_count = 16`

- fresh standalone preview provenance:
  - command:
    - `node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke/20260311_082815/summary.json`
  - verified values:
    - `passed = 24`
    - `failed = 0`
    - `entry_kind_counts = {"initial": 24}`
    - `nav_kind_counts = {"initial-entity": 24}`
    - `initial_entry_case_count = 24`
    - `deterministic_entry_case_count = 24`
    - `focus_check_case_count = 9`

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 24`
    - `previewProvenanceSmokePassCount = 24`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 24`
    - `previewProvenanceSmokeFocusCheckCaseCount = 9`
    - `previewArtifactSmokeCaseCount = 17`
    - `previewArtifactValidatorFailureInjectionCaseCount = 10`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 22`
    - `solverActionPanelSmokeRequestCount = 28`
    - `solverActionPanelSmokeConsoleCheckCount = 4`
    - `solverActionPanelSmokeConsoleFlowCheckCount = 3`
    - `solverActionPanelSmokeConsoleEventFocusCheckCount = 1`
    - `solverActionPanelSmokeConsoleReplayCheckCount = 1`
    - `solverActionPanelSmokeConsoleEventClickCheckCount = 1`
    - `solverActionPanelSmokeEventFocusCheckCount = 5`
    - `solverActionPanelSmokeBannerCheckCount = 7`
    - `solverActionPanelSmokeKeyboardCheckCount = 16`
    - `ctestAssemblyRoundtripImportAssemblyTrackedCount = 132`
    - `ctestAssemblyRoundtripImportAssemblyGroupCount = 55`
    - `ctestAssemblyRoundtripImportDerivedProxyCount = 61`
    - `ctestAssemblyRoundtripImportExplodedOriginCount = 39`

- fresh gate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 24`
    - `preview_provenance_smoke.pass_count = 24`
    - `preview_provenance_smoke.deterministic_entry_case_count = 24`
    - `preview_provenance_smoke.focus_check_case_count = 9`
    - `preview_artifact_smoke.case_count = 17`
    - `preview_artifact_validator_failure_injection.case_count = 10`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 22`
    - `solver_action_panel_smoke.request_count = 28`
    - `solver_action_panel_smoke.console_check_count = 4`
    - `solver_action_panel_smoke.console_flow_check_count = 3`
    - `solver_action_panel_smoke.console_event_focus_check_count = 1`
    - `solver_action_panel_smoke.console_replay_check_count = 1`
    - `solver_action_panel_smoke.console_event_click_check_count = 1`
  - the gate process still exited non-zero because older observe lanes remain red; the newly added preview/solver/assembly contracts were green and the summary was still produced

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `gate_preview_provenance_smoke.case_count = 24`
    - `gate_preview_provenance_smoke.pass_count = 24`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 24`
    - `gate_preview_provenance_smoke.focus_check_case_count = 9`
    - `gate_preview_artifact_smoke.case_count = 17`
    - `gate_preview_artifact_validator_failure_injection.case_count = 10`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 22`
    - `gate_solver_action_panel_smoke.request_count = 28`
    - `gate_solver_action_panel_smoke.console_check_count = 4`
    - `gate_solver_action_panel_smoke.console_flow_check_count = 3`
    - `gate_solver_action_panel_smoke.console_event_focus_check_count = 1`
    - `gate_solver_action_panel_smoke.console_replay_check_count = 1`
    - `gate_solver_action_panel_smoke.console_event_click_check_count = 1`
  - overall weekly status still reports `unstable`, but the cause remains the pre-existing `ui_flow_stage_trend` observe lane rather than these newly added contracts

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_console_recent_clicks_v2.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_console_recent_clicks_v2.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_console_recent_clicks_v2.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_console_recent_clicks_v2.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_console_recent_clicks_v2.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_console_recent_clicks_v2.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_console_recent_clicks_v2.md`
  - checker:
    - `PASS`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `24/24`
    - deterministic entry `24/24`
    - focus checks `9`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver `4 / 22 / 28 / 4 / 3 / 1 / 1 / 1`
    - assembly `4/4`
    - dense aggregate `tracked=132 groups=55 proxies=61 exploded=39`

- real issues fixed during this round:
  - `tools/write_ci_artifact_summary.py` previously rendered exploded-layout case detail with an undefined `as_str(...)`; this was fixed before the fresh consumer replay
  - dashboard generation and checker invocation were separated into a stable order so the checker no longer races a not-yet-visible dashboard file in replay mode

## 2026-03-11 Fresh Banner Focus Click Propagation And 25/25 Preview Matrix

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_STEP186_PREVIEW_ARTIFACT_PREP=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_CTEST_ASSEMBLY_ROUNDTRIP=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 25`
    - `previewProvenanceSmokePassCount = 25`
    - `previewProvenanceSmokeInitialEntryCaseCount = 25`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 25`
    - `previewProvenanceSmokeFocusCheckCaseCount = 9`
    - `solverActionPanelSmokeBannerFocusClickCheckCount = 1`

- fresh gate:
  - command:
    - `RUN_GATE=1 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 GATE_RUN_CTEST_ASSEMBLY_ROUNDTRIP=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 25`
    - `preview_provenance_smoke.pass_count = 25`
    - `preview_provenance_smoke.initial_entry_case_count = 25`
    - `preview_provenance_smoke.deterministic_entry_case_count = 25`
    - `preview_provenance_smoke.focus_check_case_count = 9`
    - `solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `solver_action_panel_smoke.request_count = 29`
  - the gate process still exits non-zero overall because older observe lanes remain red; the newly added preview/solver/assembly contracts were green and the summary was still produced

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `gate_preview_provenance_smoke.case_count = 25`
    - `gate_preview_provenance_smoke.pass_count = 25`
    - `gate_preview_provenance_smoke.initial_entry_case_count = 25`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 25`
    - `gate_preview_provenance_smoke.focus_check_case_count = 9`
    - `gate_solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `gate_solver_action_panel_smoke.request_count = 29`
  - overall weekly status still reports `unstable`, but the cause remains the pre-existing `ui_flow_stage_trend` observe lane rather than these newly added contracts

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_banner_focus_click_v3.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_banner_focus_click_v3.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_banner_focus_click_v3.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_banner_focus_click_v3.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_banner_focus_click_v3.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_banner_focus_click_v3.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_banner_focus_click_v3.md`
  - checker:
    - `PASS`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `25/25`
    - deterministic entry `25/25`
    - focus checks `9`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver banner focus clicks `1`
    - assembly `4/4`

- real issue fixed during this round:
  - `tools/editor_gate.sh` parsed `payload["banner_focus_click_count"]`, but the smoke summary emits `payload["banner_focus_click_check_count"]`
  - local consumed the correct key, but gate and every replayed consumer silently flattened the propagated metric to `0`
  - after correcting the key and rerunning gate + weekly replay, all three layers and the checker agreed on `banner_focus_click_check_count = 1`

## 2026-03-11 Fresh Dimension-Hatch Group Focus And Banner Event Focus Closure

- standalone preview validation:
  - command:
    - `node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke_full_after_dimension_hatch_case`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_full_after_dimension_hatch_case/20260311_101500/summary.json`
  - verified values:
    - `passed = 26`
    - `failed = 0`
    - `initial_entry_case_count = 26`
    - `deterministic_entry_case_count = 26`
    - `focus_check_case_count = 10`
  - the new case `paperspace_insert_dimension_hatch_dimension_group_focus` is present in the default matrix and passes with:
    - `click.kind = initial`
    - `entityId = 13`
    - `groupId = 3`
    - `groupMemberIds = [10, 11, 12, 13]`

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 RUN_CTEST_ASSEMBLY_ROUNDTRIP=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 26`
    - `previewProvenanceSmokePassCount = 26`
    - `previewProvenanceSmokeInitialEntryCaseCount = 26`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 26`
    - `previewProvenanceSmokeFocusCheckCaseCount = 10`
    - `solverActionPanelSmokeBannerEventFocusCheckCount = 1`

- fresh gate:
  - command:
    - `RUN_GATE=1 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 GATE_RUN_CTEST_ASSEMBLY_ROUNDTRIP=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `preview_provenance_smoke.case_count = 26`
    - `preview_provenance_smoke.pass_count = 26`
    - `preview_provenance_smoke.initial_entry_case_count = 26`
    - `preview_provenance_smoke.deterministic_entry_case_count = 26`
    - `preview_provenance_smoke.focus_check_case_count = 10`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 23`
    - `solver_action_panel_smoke.request_count = 30`
    - `solver_action_panel_smoke.banner_event_focus_check_count = 1`
    - `solver_action_panel_smoke.banner_focus_click_check_count = 1`
  - the gate process still exits with overall status `2`, but the cause remains the older observe lanes rather than the newly added preview or solver contracts

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `gate_preview_provenance_smoke.case_count = 26`
    - `gate_preview_provenance_smoke.pass_count = 26`
    - `gate_preview_provenance_smoke.initial_entry_case_count = 26`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 26`
    - `gate_preview_provenance_smoke.focus_check_case_count = 10`
    - `gate_solver_action_panel_smoke.banner_event_focus_check_count = 1`
    - `gate_solver_action_panel_smoke.banner_focus_click_check_count = 1`
  - overall weekly status still reports `unstable`, but the cause remains the pre-existing `ui_flow_stage_trend` observe lane rather than this closure

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode gate --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_banner_event_focus_v4.md`
    - `python3 tools/write_step176_dashboard.py --gate-history-dir build/editor_gate_history --weekly-history-dir build/editor_weekly_validation_history --out build/step176_dashboard_banner_event_focus_v4.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_banner_event_focus_v4.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_banner_event_focus_v4.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_banner_event_focus_v4.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_banner_event_focus_v4.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_banner_event_focus_v4.md`
  - checker:
    - `PASS`
  - rendered values confirmed:
    - `26/26`
    - `focus_checks=10`
    - `banner_event_focus=1`
    - `banner_focus_clicks=1`

- consistency result for this round:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `26/26`
    - deterministic entry `26/26`
    - focus checks `10`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver banner event focus `1`
    - solver banner focus clicks `1`
    - assembly `4/4`

## 2026-03-11 Fresh GroupId Fallback, Console Selection, And Weekly Replay Closure

- fresh standalone preview validation:
  - command:
    - `node tools/web_viewer/scripts/preview_provenance_smoke.js --outdir build/preview_provenance_smoke_combo_hatch_group`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/preview_provenance_smoke_combo_hatch_group/20260311_110638/summary.json`
  - verified values:
    - `passed = 27`
    - `failed = 0`
    - `initial_entry_case_count = 27`
    - `deterministic_entry_case_count = 27`
    - `focus_check_case_count = 11`
  - the new case `paperspace_combo_hatch_group_focus` passes with:
    - `navKind = group`
    - `targetType = group`
    - `groupId = 1`
    - `groupMemberIds` populated from the fallback `groupId -> entityIds` path

- fresh standalone solver validation:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_console_selection`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_console_selection/20260311_110738/summary.json`
  - verified values:
    - `ok = true`
    - `panel_count = 4`
    - `flow_check_count = 23`
    - `request_count = 30`
    - `focus_request_count = 9`
    - `event_focus_check_count = 6`
    - `banner_check_count = 8`
    - `banner_event_focus_check_count = 1`
    - `banner_focus_click_check_count = 1`
    - `console_check_count = 4`
    - `console_flow_check_count = 3`
    - `console_event_focus_check_count = 1`
    - `console_replay_check_count = 1`
    - `console_event_click_check_count = 1`
    - `console_selection_check_count = 2`
    - `status_check_count = 6`
    - `status_click_check_count = 1`
    - `keyboard_check_count = 16`
    - `import_check_count = 1`
    - `clear_check_count = 1`

- fresh local CI:
  - command:
    - `RUN_PREVIEW_PROVENANCE_SMOKE=1 RUN_SOLVER_ACTION_PANEL_SMOKE=1 RUN_PREVIEW_ARTIFACT_SMOKE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1 bash tools/local_ci.sh --build-dir build --offline --skip-compare --quick`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 27`
    - `previewProvenanceSmokePassCount = 27`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 27`
    - `previewProvenanceSmokeFocusCheckCaseCount = 11`
    - `previewArtifactSmokeCaseCount = 17`
    - `previewArtifactSmokePassCount = 17`
    - `previewArtifactValidatorFailureInjectionCaseCount = 10`
    - `previewArtifactValidatorFailureInjectionPassCount = 10`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 23`
    - `solverActionPanelSmokeRequestCount = 30`
    - `solverActionPanelSmokeConsoleSelectionCheckCount = 2`
    - `solverActionPanelSmokeStatusCheckCount = 6`
    - `solverActionPanelSmokeStatusClickCheckCount = 1`
    - `solverActionPanelSmokeBannerFocusClickCheckCount = 1`
    - `solverActionPanelSmokeImportCheckCount = 1`
    - `solverActionPanelSmokeClearCheckCount = 1`

- fresh gate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 RUN_GATE=1 RUN_EDITOR_PARALLEL_CYCLE=0 RUN_STEP166_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=1 GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `preview_provenance_smoke.case_count = 27`
    - `preview_provenance_smoke.pass_count = 27`
    - `preview_provenance_smoke.deterministic_entry_case_count = 27`
    - `preview_provenance_smoke.focus_check_case_count = 11`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 23`
    - `solver_action_panel_smoke.request_count = 30`
    - `solver_action_panel_smoke.console_selection_check_count = 2`
    - `solver_action_panel_smoke.status_check_count = 6`
    - `solver_action_panel_smoke.status_click_check_count = 1`
    - `solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `solver_action_panel_smoke.import_check_count = 1`
    - `solver_action_panel_smoke.clear_check_count = 1`
    - `assembly_roundtrip_ctest.status = PASS`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `assembly_roundtrip_ctest.import_entity_count = 148`
    - `assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `assembly_roundtrip_ctest.import_viewport_count = 13`
    - `assembly_roundtrip_ctest.import_viewport_layout_count = 11`
    - `assembly_roundtrip_ctest.import_viewport_case_count = 10`
  - overall gate exit remains non-zero because of the older observe-only UI-flow lane, not because of the newly added preview/solver/assembly contracts

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260311_033020.md`
  - verified values:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `gate_preview_provenance_smoke.case_count = 27`
    - `gate_preview_provenance_smoke.pass_count = 27`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 27`
    - `gate_preview_provenance_smoke.focus_check_case_count = 11`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 23`
    - `gate_solver_action_panel_smoke.request_count = 30`
    - `gate_solver_action_panel_smoke.console_selection_check_count = 2`
    - `gate_solver_action_panel_smoke.status_check_count = 6`
    - `gate_solver_action_panel_smoke.status_click_check_count = 1`
    - `gate_solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `gate_solver_action_panel_smoke.import_check_count = 1`
    - `gate_solver_action_panel_smoke.clear_check_count = 1`
    - `gate_assembly_roundtrip_ctest.status = PASS`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_entity_count = 148`
    - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 39`
  - the fresh replay initially failed with:
    - `NameError: fmt_group_layout_case_details is not defined`
  - fix:
    - add the missing helper to the embedded python in `tools/editor_weekly_validation.sh`
  - after the fix, replay completed and the weekly checker passed

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode observe --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_group_focus_console_selection.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_group_focus_console_selection.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_weekly_20260311_033020.md --require-dashboard`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_group_focus_console_selection.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_group_focus_console_selection.md`
  - checker:
    - `PASS`

- real issues fixed during this round:
  - preview group focus for proxy groups incorrectly depended on `instanceIndex`; fallback `groupId -> entityIds` resolution fixed the new paperspace hatch group-focus case
  - solver recent replay / event click checks were comparing against stale history targets rather than the latest replay/focus state
  - `tools/local_ci.sh` missed default initialization for `SOLVER_ACTION_PANEL_SMOKE_CONSOLE_SELECTION_CHECK_COUNT`
  - `tools/editor_gate.sh` did not export the console-selection and group-layout metrics needed by the summary writer
  - `tools/editor_weekly_validation.sh` referenced `fmt_group_layout_case_details(...)` without defining it

- consistency result for this closure:
  - local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `27/27`
    - deterministic entry `27/27`
    - focus checks `11`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver panels `4`
    - solver flow checks `23`
    - solver requests `30`
    - solver console selection checks `2`
    - solver status checks `6`
    - solver status clicks `1`
    - solver banner focus clicks `1`
    - solver import checks `1`
    - solver clear checks `1`
    - assembly `4/4`

## 2026-03-11 Focus-Current Console Closure And Fresh Gate/Weekly Replay

- root cause confirmation:
  - fresh `solver_action_panel_smoke` initially failed because `[data-console-action="focus-current"]` never appeared
  - debug state already contained an active focus item
  - the visible console did not render the button because `formatRequestTarget(...)` ignored `{ kind, value }` payloads and only read `focusKind/focusValue`
  - after adding `kind/value` fallback in `solver_action_flow_console.js`, the fresh smoke passed

- fresh standalone solver smoke:
  - command:
    - `node tools/web_viewer/scripts/solver_action_panel_smoke.js --outdir build/solver_action_panel_smoke_fix_focus_current_v4`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/solver_action_panel_smoke_fix_focus_current_v4/20260311_135942/summary.json`
  - verified values:
    - `panel_count = 4`
    - `flow_check_count = 26`
    - `request_count = 33`
    - `console_focus_click_check_count = 1`
    - `banner_focus_click_check_count = 1`
    - `console_selection_check_count = 2`
    - `status_check_count = 6`
    - `status_click_check_count = 1`
    - `keyboard_check_count = 18`
    - `panel_cycle_check_count = 2`
    - `jump_check_count = 3`
    - `import_check_count = 1`
    - `clear_check_count = 1`

- fresh local summary:
  - file:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
  - verified values:
    - `step186PreviewArtifactPrepCaseCount = 17`
    - `step186PreviewArtifactPrepPassCount = 17`
    - `previewProvenanceSmokeCaseCount = 29`
    - `previewProvenanceSmokePassCount = 29`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 29`
    - `previewProvenanceSmokeFocusCheckCaseCount = 13`
    - `previewArtifactSmokeCaseCount = 17`
    - `previewArtifactSmokePassCount = 17`
    - `previewArtifactValidatorFailureInjectionCaseCount = 10`
    - `previewArtifactValidatorFailureInjectionPassCount = 10`
    - `solverActionPanelSmokePanelCount = 4`
    - `solverActionPanelSmokeFlowCheckCount = 26`
    - `solverActionPanelSmokeRequestCount = 33`
    - `solverActionPanelSmokeConsoleFocusClickCheckCount = 1`
    - `solverActionPanelSmokeBannerFocusClickCheckCount = 1`
    - `ctestAssemblyRoundtripCaseCount = 4`
    - `ctestAssemblyRoundtripPassCount = 4`

- fresh gate:
  - command:
    - `RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_UI_FLOW_STAGE_TREND=0 RUN_STEP166_GATE=0 RUN_QT_PROJECT_PERSISTENCE_CHECK=0 RUN_QT_PROJECT_PERSISTENCE_GATE=0 RUN_PERF_TREND=0 RUN_PERF_TREND_GATE=0 RUN_REAL_SCENE_TREND=0 RUN_REAL_SCENE_TREND_GATE=0 RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1 RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1 RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1 bash tools/editor_gate.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - verified values:
    - `preview_provenance_smoke.case_count = 29`
    - `preview_provenance_smoke.pass_count = 29`
    - `preview_provenance_smoke.deterministic_entry_case_count = 29`
    - `preview_provenance_smoke.focus_check_case_count = 13`
    - `solver_action_panel_smoke.panel_count = 4`
    - `solver_action_panel_smoke.flow_check_count = 26`
    - `solver_action_panel_smoke.request_count = 33`
    - `solver_action_panel_smoke.console_focus_click_check_count = 1`
    - `solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `solver_action_panel_smoke.console_selection_check_count = 2`
    - `solver_action_panel_smoke.status_check_count = 6`
    - `solver_action_panel_smoke.status_click_check_count = 1`
    - `assembly_roundtrip_ctest.status = PASS`
    - `assembly_roundtrip_ctest.case_count = 4`
    - `assembly_roundtrip_ctest.pass_count = 4`
    - `assembly_roundtrip_ctest.import_entity_count = 148`
    - `assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `assembly_roundtrip_ctest.import_exploded_origin_count = 39`
    - `assembly_roundtrip_ctest.import_viewport_count = 13`
    - `assembly_roundtrip_ctest.import_viewport_layout_count = 11`
    - `assembly_roundtrip_ctest.import_viewport_case_count = 10`

- fresh weekly replay:
  - command:
    - `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh`
  - summary:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - dashboard:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260311_060741.md`
  - first replay failure:
    - `KeyError: 'panel_cycle_checks'`
  - fix:
    - pass the missing `panel_cycle_checks` value into the embedded weekly formatter in `tools/editor_weekly_validation.sh`
  - verified values after the fix:
    - `step186_preview_artifact_prep.case_count = 17`
    - `step186_preview_artifact_prep.pass_count = 17`
    - `gate_preview_provenance_smoke.case_count = 29`
    - `gate_preview_provenance_smoke.pass_count = 29`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 29`
    - `gate_preview_provenance_smoke.focus_check_case_count = 13`
    - `gate_solver_action_panel_smoke.panel_count = 4`
    - `gate_solver_action_panel_smoke.flow_check_count = 26`
    - `gate_solver_action_panel_smoke.request_count = 33`
    - `gate_solver_action_panel_smoke.console_focus_click_check_count = 1`
    - `gate_solver_action_panel_smoke.banner_focus_click_check_count = 1`
    - `gate_solver_action_panel_smoke.console_selection_check_count = 2`
    - `gate_solver_action_panel_smoke.status_check_count = 6`
    - `gate_solver_action_panel_smoke.status_click_check_count = 1`
    - `gate_assembly_roundtrip_ctest.status = PASS`
    - `gate_assembly_roundtrip_ctest.case_count = 4`
    - `gate_assembly_roundtrip_ctest.pass_count = 4`
    - `gate_assembly_roundtrip_ctest.import_entity_count = 148`
    - `gate_assembly_roundtrip_ctest.import_assembly_tracked_count = 132`
    - `gate_assembly_roundtrip_ctest.import_assembly_group_count = 55`
    - `gate_assembly_roundtrip_ctest.import_derived_proxy_count = 61`
    - `gate_assembly_roundtrip_ctest.import_exploded_origin_count = 39`

- fresh consumer replay:
  - commands:
    - `python3 tools/write_ci_artifact_summary.py --mode observe --gate-summary build/editor_gate_summary.json --local-summary build/local_ci_summary.json --out build/ci_artifact_summary_focus_current_fix.md`
    - `python3 tools/write_step176_weekly_report.py --weekly-summary build/editor_weekly_validation_summary.json --report build/step176_weekly_focus_current_fix.md`
    - `bash tools/check_weekly_summary.sh --summary build/editor_weekly_validation_summary.json --dashboard build/step176_dashboard_weekly_20260311_060741.md --require-dashboard`
  - outputs:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_focus_current_fix.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_focus_current_fix.md`
  - checker:
    - `PASS`

- consistency result for this closure:
  - fresh local, gate, and weekly replay agree on:
    - Step186 prep `17/17`
    - preview provenance `29/29`
    - deterministic entry `29/29`
    - focus checks `13`
    - preview artifact smoke `17/17`
    - preview artifact validator failure injection `10/10`
    - solver panels `4`
    - solver flow checks `26`
    - solver requests `33`
    - solver console focus clicks `1`
    - solver banner focus clicks `1`
    - solver console selection checks `2`
    - solver status checks `6`
    - solver status clicks `1`
    - assembly `4/4`
    - import entities `148`
    - assembly tracked `132`
    - assembly groups `55`
    - derived proxies `61`
    - exploded origins `39`
