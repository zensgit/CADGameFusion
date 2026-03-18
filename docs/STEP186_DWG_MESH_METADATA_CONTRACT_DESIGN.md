# STEP186 DWG Mesh Metadata Contract Design

## Goal
Strengthen the PLM preview artifact contract for `2D DWG` as the mainline input format without changing `manifest.json` schema shape.

The fast path is:
- keep `manifest.json` stable and emit it directly from `convert_cli`;
- keep `document.json` as the editable and internal truth;
- enrich `mesh_metadata.json` as the preview-oriented sidecar for normalized summary, layout, and viewport information.

This keeps the current pipeline compatible with existing router, desktop, and web consumers while making DWG-derived preview data easier to validate and consume.

## Constraints
- No top-level `manifest.json` schema bump.
- No new manifest artifact kinds in MVP.
- Preserve existing `mesh_metadata.json` keys:
  - `gltf`
  - `bin`
  - `entities`
  - `line_entities`
- Derive enriched sidecar data from metadata that already exists in `document.json` when possible.

## Current State
Current conversion artifacts already expose most source facts, but they are fragmented:
- raw `convert_cli` output now emits a schema-compatible `manifest.json` with real file hashes, sizes, and timestamps;
- `document.json.metadata.meta` contains DXF/DWG-derived keys such as:
  - `dxf.default_space`
  - `dxf.viewport.count`
  - `dxf.viewport.{i}.*`
  - `dxf.entity.{id}.space`
- `dxf.entity.{id}.layout` for paper-space entities when attribution is safe
- `mesh_metadata.json` already contains preview slice entries in:
  - `entities`
  - `line_entities`
- web preview already understands:
  - `space=model|paper`
  - `layout=<name>`
  - `paper_viewport=1`

The gap is that consumers must reconstruct summary, layout, and viewport facts by re-parsing flat metadata keys instead of reading a normalized sidecar structure.

## Implemented Contract
`mesh_metadata.json` remains the sidecar referenced by `manifest.json`, and raw `convert_cli` output now always emits a matching `manifest.json`. Step186 adds three normalized top-level sections:
- `summary`
- `layouts`
- `viewports`
- per-entity `layout` propagation into `document.json` and `mesh_metadata` when importer can attribute paper-space ownership safely

### Stable Required Keys
```json
{
  "gltf": "mesh.gltf",
  "bin": "mesh.bin",
  "entities": [],
  "line_entities": []
}
```

### Step186 Example
```json
{
  "gltf": "mesh.gltf",
  "bin": "mesh.bin",
  "summary": {
    "document_entity_count": 842,
    "mesh_entity_count": 230,
    "line_entity_count": 612,
    "default_space": 1,
    "layout_count": 2,
    "viewport_count": 2,
    "spaces": [
      {
        "space": 0,
        "document_entity_count": 610,
        "mesh_entity_count": 180,
        "line_entity_count": 401
      },
      {
        "space": 1,
        "document_entity_count": 232,
        "mesh_entity_count": 50,
        "line_entity_count": 211
      }
    ]
  },
  "layouts": [
    {
      "name": "Model",
      "space": 0,
      "is_default": false,
      "synthetic": true,
      "viewport_count": 0,
      "document_entity_count": 610,
      "mesh_entity_count": 180,
      "line_entity_count": 401
    },
    {
      "name": "布局1",
      "space": 1,
      "is_default": true,
      "synthetic": false,
      "viewport_count": 2,
      "document_entity_count": 232,
      "mesh_entity_count": 50,
      "line_entity_count": 211
    }
  ],
  "viewports": [
    {
      "index": 0,
      "id": 1,
      "layout": "布局1",
      "space": 1,
      "center_x": 128.5,
      "center_y": 97.5,
      "width": 222.18,
      "height": 418.873017,
      "view_center_x": 128.5,
      "view_center_y": 97.5,
      "view_height": 222.18,
      "twist_deg": 0.0
    }
  ],
  "entities": [],
  "line_entities": []
}
```

## Section Semantics

### `summary`
Purpose:
- provide a fast normalized header for web, router, and QA use;
- avoid repeated flat-key scans in consumers;
- serve as the primary target for smoke validation.

Step186 fields:
- `document_entity_count`: number of entities in `document.json`
- `mesh_entity_count`: number of triangle or mesh slices in `mesh_metadata.entities`
- `line_entity_count`: number of line overlay slices in `mesh_metadata.line_entities`
- `default_space`: `0` for model, `1` for paper
- `layout_count`: number of emitted `layouts`
- `viewport_count`: number of emitted `viewports`
- `spaces`: per-space rollup of document, mesh, and line counts

### `layouts`
Purpose:
- expose model and paper partitions at document level;
- support layout selectors without reverse engineering entity metadata.

Step186 fields:
- `name`
- `space`
- `is_default`
- `synthetic`
- `viewport_count`
- `document_entity_count`
- `mesh_entity_count`
- `line_entity_count`

Notes:
- model space is emitted explicitly as synthetic `name="Model"` when model-space content is present;
- paper layouts are derived from `dxf.viewport.{i}.layout`;
- if multiple paper layouts share the same paper-space bucket, per-layout entity counts are intentionally omitted because current importer metadata is space-scoped, not layout-scoped.

### `viewports`
Purpose:
- provide a normalized structure for paper-space preview logic;
- mirror `dxf.viewport.{i}.*` keys in a JSON-native form.

Step186 fields:
- `index`
- `id`
- `layout`
- `space`
- `center_x`
- `center_y`
- `width`
- `height`
- `view_center_x`
- `view_center_y`
- `view_height`
- `twist_deg`

## Data Sources
The enriched sidecar is built from existing metadata first.

Primary sources:
- `document.json.metadata.meta`
- entity-level `space` already emitted into `document.json`
- slice-level `space` already emitted into `mesh_metadata.json`
- flat viewport metadata already stored in document metadata

This avoids a second parser and keeps the converter as the only aggregation point.

## Compatibility Rules
- Existing consumers that only read `entities` and `line_entities` continue to work unchanged.
- New consumers prefer normalized `summary`, `layouts`, and `viewports` when present.
- `web_viewer/preview_app.js` now prefers Step186 sidecar `summary.default_space` and `viewports` before falling back to flat document metadata.
- `manifest.json` continues to list the same four artifact files only.
- `convert_cli` now emits a schema-compatible `manifest.json` directly, so fresh converter output directories can be consumed by viewer and router without an extra Python wrapper.
- when `convert_cli` receives `--project-id`, `--document-label`, or `--document-id`, it now persists those optional identity fields directly into `manifest.json`, matching the viewer/router fallback contract used by `plm_convert.py`.
- `document.json` remains the internal and editable truth; `mesh_metadata.json` is a derived sidecar for preview and validation.
- `line_entities` is always emitted as an array, including the empty-array case, to stabilize downstream validation.

## Non-Goals For Step186
- No attempt to make `mesh_metadata.json` the source of truth for editing.
- No DWG-native edit model.
- No manifest-level schema revision just to expose preview-only metadata.
- No unsupported-object or block inventory normalization in this step.

## Why This Split Is Correct
For `2D DWG` mainline, the product pressure is on import compatibility and preview correctness, not on turning the internal core into a DWG database.

Keeping the richer contract in `mesh_metadata.json` is the pragmatic boundary because it:
- preserves current ABI and schema expectations;
- improves web and router consumption immediately;
- provides normalized layout and viewport handling without changing the core document model;
- keeps future schema versioning optional instead of forced.

## Expected File Touches
Implementation for this design stays concentrated in:
- `tools/convert_cli.cpp`
- `tools/web_viewer/preview_app.js`
- `plugins/dxf_importer_plugin.cpp`
- `tools/validate_plm_preview_artifacts.py`
- `cmake/RunConvertCliMeshMetadata.cmake`

No manifest schema change is required in Step186.

## Incremental Extension: Origin Metadata For Derived DWG Objects
To keep `2D DWG` preview-first workflows explainable without switching the core to a DWG-native model, Step186 now also preserves object-origin metadata on derived entities.

New optional entity fields in both `document.json.entities[*]` and `mesh_metadata.{entities,line_entities}[*]`:
- `source_type`
  - `INSERT` for exploded block-reference geometry
  - `DIMENSION` for dimension text / block-derived geometry
  - `HATCH` for hatch boundaries and emitted pattern lines
- `edit_mode`
  - `exploded` for insert-derived editable primitives
  - `proxy` for dimension and hatch derived geometry
- `proxy_kind`
  - `insert`
  - `dimension`
  - `hatch`
- `block_name`
  - original DXF block name for `INSERT` / `DIMENSION`
- `hatch_id`
  - stable importer-local hatch ordinal for a single document
- `hatch_pattern`
  - original hatch pattern name such as `ANSI31`

Why this split is useful:
- viewer/property-panel code can explain why geometry exists without reparsing DXF;
- validator can assert origin stability across `document.json` and `mesh_metadata.json`;
- importer can keep `INSERT` editable-by-explosion while still marking `DIMENSION` and `HATCH` as derived proxy geometry.

Implementation boundary:
- `plugins/dxf_importer_plugin.cpp` writes these fields into entity metadata at import time.
- `tools/convert_cli.cpp` forwards them into `document.json` and `mesh_metadata.json`.
- `tools/validate_plm_preview_artifacts.py` treats them as optional-but-typed contract fields.

## Incremental Consumer Parity: Preview Selection Provenance
Step186 sidecar/data-contract work is only useful if preview consumers surface the fields consistently.

The preview-side selection panel now reads provenance directly from existing entity/slice fields:
- `source_type`
- `edit_mode`
- `proxy_kind`
- `block_name`
- `hatch_id`
- `hatch_pattern`
- `text_kind`
- `dim_type`
- `dim_style`
- `space`
- `layout`

Consumer behavior:
- keep existing mesh/layer/color rows unchanged;
- add a concise `Origin` row:
  - `HATCH/hatch | proxy`
  - `DIMENSION/dimension | proxy`
  - `INSERT/insert | exploded`
- add a short note for:
  - `edit_mode=proxy`: derived proxy, preview only
  - `edit_mode=exploded`: exploded source fragment, provenance retained
- do not introduce any new schema fields; this is a pure consumer-side rendering change over Step186 data already emitted by converter/importer.

Why this belongs in Step186:
- it closes the contract loop between producer and preview consumer;
- it keeps preview and editor provenance language aligned;
- it makes `2D DWG` proxy/exploded behavior explainable without re-parsing DXF/DWG in the browser.

## Incremental Consumer Parity: Line Overlay Selection
Preview provenance parity is incomplete if only mesh slices are selectable.

The preview-side line overlay now participates in selection using the same metadata contract:
- each emitted `LineSegments2` overlay object carries:
  - `cadgfSlice`
  - `cadgfEntity`
- the preview hit resolver now accepts:
  - direct line-overlay hits through `cadgfSlice`
  - mesh-face hits through grouped `cadgfSlices`
- the selectable-object list is rebuilt after metadata application so hidden/filtered meshes and line overlays stay in sync with actual pick targets.

Expected behavior:
- `mesh=0` preview mode still allows selecting line-derived entities from `mesh_metadata.line_entities`.
- line-only picks render the same provenance rows as mesh picks:
  - `Origin`
  - `Hatch ID`
  - `Hatch Pattern`
  - `Space`
- no schema or artifact changes are required; this is a pure preview-consumer hit-testing improvement over existing Step186 fields.

## Incremental Consumer Parity: Document-Only Manifest Text Selection
Step186 preview support must not assume `mesh_gltf` exists.

Producer reality:
- some fresh converter outputs intentionally contain only `document.json`;
- `step186_origin_dimension/manifest.json` is one such case, carrying DWG/DXF-derived `TEXT` entities with `DIMENSION` provenance and no mesh artifact.

Consumer additions:
- `tools/web_viewer/preview_app.js` now accepts manifests that contain `document_json` but omit `mesh_gltf`;
- preview creates an empty scene, frames the camera from text-entry bounds, and still renders the existing text overlay pipeline;
- text entries now retain a pointer to their source entity plus screen-space bounds computed during overlay rendering;
- pointer handling falls back from raycast hits to text-overlay bounds, so document-only `TEXT` and `DIMENSION` annotations participate in the same selection panel as mesh and line entities.

Expected behavior:
- `document-only manifest` loads as a first-class preview input, not as an error path;
- selecting a dimension text entry shows the same provenance rows already used for mesh/line selections:
  - `Origin`
  - `Block Name`
  - `Text Kind`
  - `Dim Type`
  - `Dim Style`
  - `Space`
- no new schema fields are introduced; this is a preview-consumer completion of the existing Step186 data contract.

## Incremental Contract Coverage: Json-Only Validator + Exploded Insert Smoke
Step186 contract coverage should follow the same artifact shapes the preview now accepts.

Validator additions:
- `tools/validate_plm_preview_artifacts.py` now accepts `json-only` manifests that omit:
  - `mesh_gltf`
  - `mesh_bin`
  - `mesh_metadata`
- when `manifest.outputs=["json"]`, the validator still requires:
  - `document_json`
  - content-hash and artifact-size correctness for any declared artifact
- mesh-side validation becomes conditional:
  - full preview outputs still validate `mesh_metadata`
  - json-only outputs report `mesh_metadata absent; json-only preview contract`

Provenance field coverage additions:
- artifact validator now validates and aligns the following optional per-entity fields across `document.json` and `mesh_metadata.json` when present:
  - `source_type`
  - `edit_mode`
  - `proxy_kind`
  - `block_name`
  - `hatch_id`
  - `hatch_pattern`
  - `text_kind`
  - `dim_type`
  - `dim_style`
  - `layout`
  - `space`

Smoke additions:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now covers three preview-consumer paths:
  - `INSERT/insert | exploded`
  - `DIMENSION/dimension | proxy`
  - `HATCH/hatch | proxy`

Why this matters:
- Step186 contract verification now covers both full preview outputs and json-only outputs;
- exploded insert provenance is no longer implicitly trusted from importer tests alone; it is visible and browser-verified in preview;
- producer and consumer coverage now line up with the actual 2D DWG fallback modes used in the repository.

## Incremental CI Wiring: Self-Hosted Preview Provenance Smoke
Preview provenance coverage should be runnable by automation without ad hoc local server setup.

Script changes:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now starts a temporary static server by default, rooted at `deps/cadgamefusion`;
- the script still accepts `--base-url` for external servers, but the default path is now self-contained;
- the script now emits:
  - `run_id=...`
  - `run_dir=...`
  - `summary_json=...`
  so shell-based gate runners can parse stable outputs without scraping JSON blocks.

CI/gate consumer changes:
- `tools/editor_gate.sh` now runs preview provenance smoke in gate mode by default;
- `tools/editor_gate.sh` now also runs a preview provenance failure-injection case set against deliberately bad preview inputs;
- `tools/editor_gate.sh` now also runs a positive real-artifact preview smoke set against known-good converter outputs;
- `tools/editor_gate.sh` now also runs preview artifact validator failure injection against deliberately bad preview artifact sets;
- `tools/local_ci.sh` now exposes:
  - `RUN_PREVIEW_PROVENANCE_SMOKE=1`
  - `RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1`
- `tools/editor_weekly_validation.sh` now carries the gate-side `preview_provenance_smoke` section into weekly summary payloads.

Expected behavior:
- provenance coverage is exercised in the same automation layer that already owns editor smoke and STEP166;
- preview provenance failures become first-class gate failures instead of “manual browser notes”;
- preview artifact validator failures become first-class gate failures even when JSON is syntactically valid but semantically drifted;
- the produced summary JSONs (`editor_gate_summary.json`, `local_ci_summary.json`, weekly summary) now expose explicit preview provenance / artifact-validator status and artifact paths.

## Incremental Consumer Hardening: Manifest Artifact Failures Must Not Fall Back
Manifest-driven preview should fail closed when declared artifacts do not load.

Bug observed:
- when `manifest` loading failed after the viewer page booted, `bootstrapScene()` still fell through to the default `gltf-url` input value from `index.html`;
- that caused a bad manifest to show `Loaded successfully.` by accidentally loading the sample scene, masking the real manifest failure.

Consumer fix:
- `tools/web_viewer/preview_app.js` now:
  - rethrows rejected `document_json` / `mesh_metadata` loads from `loadManifestArtifacts()`;
  - clears `gltfUrlInput.value` and returns immediately after `setStatus("Failed to load manifest.", true)` in the manifest error path.

Contract additions around smoke cases:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now accepts `--cases <json>`;
- the default three positive cases moved into `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json`;
- a repo-local negative case set now exists at:
  - `tools/web_viewer/tests/fixtures/preview_provenance_failure_cases.json`
- failure-injection fixtures now cover:
  - `tools/web_viewer/tests/fixtures/preview_bad_manifest_missing_document.json`
  - `tools/web_viewer/tests/fixtures/preview_bad_manifest_invalid_json.json`
  - `tools/web_viewer/tests/fixtures/preview_bad_manifest_invalid_mesh_metadata.json`
  - `tools/web_viewer/tests/fixtures/preview_bad_mesh_metadata_invalid.json`

Expected behavior:
- a manifest that declares a missing `document_json` now yields `Failed to load manifest.`;
- preview no longer silently falls back to the sample scene after a manifest error;
- gate automation can verify both positive provenance rendering and negative manifest rejection using the same smoke runner.

## Artifact Validator Failure Injection
Browser smoke only catches consumer-visible failures. Step186 also adds a validator-side red-path runner for preview artifact contracts.

New runner:
- `tools/validate_plm_preview_artifacts_failure_injection.py`

New negative case set:
- `tools/web_viewer/tests/fixtures/preview_artifact_validator_failure_cases.json`

Negative fixtures now cover:
- invalid `mesh_metadata` JSON via:
  - `tools/web_viewer/tests/fixtures/preview_bad_manifest_invalid_mesh_metadata.json`
  - `tools/web_viewer/tests/fixtures/preview_bad_mesh_metadata_invalid.json`
- provenance drift between `document.json` and `mesh_metadata.json` via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_provenance_mismatch/`
- layout / viewport metadata drift via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_layout_viewport_mismatch/`
- `summary.spaces[*]` count drift via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_summary_space_mismatch/`
- duplicate layout names / multiple default layouts via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_layout_duplicate_default/`
- `source_type` semantic mismatch for derived DWG proxy/exploded entities via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_source_semantic_mismatch/`
- `color_source` semantic mismatch for style-precedence metadata via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_color_source_semantic_mismatch/`
- style-precedence drift between `document.json` and `mesh_metadata.json` via:
  - `tools/web_viewer/tests/fixtures/preview_bad_artifact_style_precedence_mismatch/`

Validator-side style-precedence invariants now include:
- `color_source` is restricted to the current exported set:
  - `BYLAYER`
  - `BYBLOCK`
  - `INDEX`
  - `TRUECOLOR`
- `color_source=INDEX` requires `color_aci`
- `color_source=TRUECOLOR` requires resolved `color`
- when `color_source=BYLAYER` and both `color` and `layer_color` are present in `mesh_metadata`, they must match
- style fields stay aligned between `document.json` and `mesh_metadata.json` when both sides expose them:
  - `line_type`
  - `line_weight`
  - `line_type_scale`

Expected behavior:
- validator failure injection passes only when each negative case fails for the expected reason;
- `local_ci` and `editor_gate` both surface the validator failure-injection summary as machine-readable output;
- weekly aggregation can carry the same gate-side section without rerunning the validator locally.

## Incremental Positive Coverage: Real-Artifact Smoke + Mixed Origin Fixture
Red-path coverage is not enough. Step186 also needs a stable positive runner over real converter outputs.

New positive runner:
- `tools/validate_plm_preview_artifacts_smoke.py`

New positive case set:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases.json`

Current case mix:
- `build/step186_origin_blocks`
- `build/step186_origin_dimension/manifest.json`
- `build/step186_origin_hatch`
- `build/step186_origin_mixed`
- `build/step186_multi_layout`
- `build/step186_paperspace_insert_styles`
- `build/step186_viewport_sample`

Optional legacy-only case mix:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`

Why add `step186_origin_mixed`:
- the earlier Step186 smoke set proved `INSERT`, `DIMENSION`, `HATCH`, and viewport/layout metadata separately;
- a real mixed converter output is needed to ensure these fields still compose correctly when they coexist in one artifact directory;
- the mixed sample also exposed a real contract gap during development:
  - importer already carried `dxf.entity.*.dim_type` / `dim_style` for dimension-derived geometry;
  - `convert_cli` only projected those fields for `TEXT` entities;
  - positive smoke over a mixed real artifact caught that omission immediately.

Mixed origin fixture:
- source DXF:
  - `tests/plugin_data/step186_mixed_origin_sample.dxf`
- expected output:
  - `build/step186_origin_mixed`

Fixture intent:
- exploded `INSERT` provenance remains editable (`edit_mode=exploded`);
- `DIMENSION` proxy provenance is preserved on both text and derived geometry (`dim_type`, `dim_style`);
- `HATCH` proxy provenance remains present;
- paper-layout viewport metadata remains available through `mesh_metadata.layouts` / `mesh_metadata.viewports`.

Why add `step186_multi_layout`:
- the mixed single-layout sample proved paper-space recovery in one layout, but not per-layout recovery;
- a stricter real DXF is needed where:
  - one paper layout (`LayoutA`) survives through top-level `ENTITIES`; and
  - another paper layout (`LayoutB`) exists only inside a root `*Paper_Space1` block;
- this is the exact shape that exposed a layout-selective importer bug:
  - once any top-level `space=1` entity existed, root paper-space block emission was globally disabled;
  - `LayoutA` survived and `LayoutB` was silently dropped.

Multi-layout fixture:
- source DXF:
  - `tests/plugin_data/step186_multi_layout_sample.dxf`
- expected output:
  - `build/step186_multi_layout`

Fixture intent:
- preserve model-space entities and both paper layouts in one converter artifact;
- validate that `LayoutA` and `LayoutB` both survive into `document.json`;
- validate that `mesh_metadata.layouts` keeps:
  - synthetic `Model` counts sourced from `space=0`;
  - non-synthetic `LayoutA` / `LayoutB` counts sourced from their real `layout` names;
- validate that no real paper layout is marked default when multiple paper layouts exist.

Automation hardening:
- `tools/local_ci.sh` now defaults preview smoke/failure-injection outdirs under `build/...` instead of forwarding empty strings;
- `tools/validate_plm_preview_artifacts_smoke.py`, `tools/validate_plm_preview_artifacts_failure_injection.py`, and `tools/web_viewer/scripts/preview_provenance_smoke.js` now treat empty `--outdir` / case-path inputs as “use default”, preventing accidental summary writes into the repo root.
- `tools/prepare_step186_preview_artifacts.py` regenerates the default seven Step186 artifacts from local DXF fixtures before preview smoke runs;
- `tools/local_ci.sh` and `tools/editor_gate.sh` execute that prep stage automatically, so the default smoke set no longer depends on stale build directories or legacy large samples.

## Incremental Design: Surface Style-Precedence Metadata In Preview Selection
The contract already exported style-precedence metadata on real Step186 artifacts:
- `line_type`
- `line_weight`
- `line_type_scale`
- `color_source`

Until now that metadata was only visible in `document.json` / `mesh_metadata.json` and validator output.
The preview consumer now surfaces those fields directly in the selection panel for:
- mesh selections;
- line-overlay selections; and
- document-only text selections when the entity carries the fields.

This closes a consumer visibility gap for real exploded `INSERT` fragments:
- the importer/exporter already preserved the effective style values;
- browser smoke could only assert provenance fields like `Origin` and `Block Name`;
- style-precedence regressions therefore remained machine-detectable only in artifact validators, not in the user-facing preview path.

Expected preview selection shape for the existing `step186_origin_blocks` real artifact:
- `Line Type / PHANTOM`
- `Line Weight / 0.9`
- `Line Type Scale / 0.4`
- `Color Source / BYBLOCK`
- `Origin / INSERT/insert | exploded`
- `Block Name / BlockF`

## Incremental Design: Import Paper-Space Block Entities In Mixed DXF
A real mixed DXF revealed a structural importer gap:
- model-space entities were imported from top-level `ENTITIES`;
- paper-space geometry authored through `LayoutMixed` lived inside `*Paper_Space*` blocks in the DXF `BLOCKS` section;
- when top-level model entities existed, the importer did not emit those paper-space block entities, so the artifact kept viewport/layout metadata but lost real `space=1` entities.

The importer now emits entity-bearing `*Paper_Space*` root blocks when:
- the DXF reports paper-space content;
- the selected import mode includes `space=1`; and
- top-level parsed entities do not already provide `space=1` geometry.

Design constraints:
- keep the existing `INSERT` block expansion path unchanged;
- avoid duplicate emission by tracking emitted root blocks;
- preserve current `space` and `layout` metadata propagation through the existing `emit_block(...)` path;
- keep behavior deterministic by sorting paper-space block names before root emission.

This closes the exact gap observed in `tests/plugin_data/step186_mixed_origin_sample.dxf` without weakening existing mixed-space filtering.

To make browser provenance smoke deterministic, the same mixed fixture now includes a visible paper-space text entity:
- value: `PAPER NOTE`
- layout: `LayoutMixed`
- space: `1`

That text gives preview-level automation a stable click target for the real mixed artifact.

## Incremental Design: Layout Count Presence Validation
The mixed paper-space bug also exposed a validator blind spot:
- `mesh_metadata.layouts[*].document_entity_count`, `mesh_entity_count`, and `line_entity_count` were only checked when the corresponding layout already appeared in exported entity collections;
- a layout could therefore claim non-zero paper-space counts even when all paper-space entities were silently missing.

The validator now treats absent layout-backed entities as count `0` and validates:
- `mesh_metadata.layouts[*].document_entity_count`
- `mesh_metadata.layouts[*].mesh_entity_count`
- `mesh_metadata.layouts[*].line_entity_count`

## Incremental Design: Real Paper-Space Insert Style Sample + Weekly Legacy Lane
The existing `step186_origin_blocks` fixture proved exploded `INSERT` provenance and style precedence in model space, but it did not cover the same behavior inside a real paper layout.

The new fixture closes that gap:
- source DXF:
  - `tests/plugin_data/step186_paperspace_insert_styles_sample.dxf`
- expected output:
  - `build/step186_paperspace_insert_styles`

Fixture intent:
- keep a real paper layout (`LayoutStyle`) with visible paper-space text (`LAYOUT STYLE NOTE`);
- emit an exploded paper-space block insert whose fragments retain:
  - `source_type=INSERT`
  - `edit_mode=exploded`
  - `proxy_kind=insert`
  - `block_name=PaperStyledBlock`
- preserve effective style precedence on the exploded paper-space fragments:
  - `color_source`
  - `line_type`
  - `line_weight`
  - `line_type_scale`

This is paired with:
- importer regression:
  - `tests/tools/test_dxf_paperspace_insert_styles.cpp`
- browser provenance smoke coverage:
  - `paperspace_insert_style`

Expected preview selection for the BYBLOCK fragment:
- `Color Source / BYBLOCK`
- `Line Type / CENTER`
- `Line Weight / 0.5`
- `Line Type Scale / 0.25`
- `Origin / INSERT/insert | exploded`
- `Block Name / PaperStyledBlock`

This sample also exposed a real importer propagation bug:
- nested insert recursion inside root paper-space blocks kept `space/layout/style` fields;
- but when the root paper-space emission did not originate from an actual `INSERT`, recursive emission passed a null origin insert;
- exploded entities therefore lost provenance fields even though the style values were correct.

The importer now falls back to the currently expanded nested insert as the provenance origin in that path, so paper-space exploded fragments keep both provenance and resolved style metadata.

Operational split:
- default prep / gate / local CI now use the seven Step186 artifacts produced by `tools/prepare_step186_preview_artifacts.py`;
- legacy large preview artifacts stay in `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`;
- `tools/editor_weekly_validation.sh` runs that legacy set on a separate weekly-only lane so default gate cost stays flat while weekly history still captures the heavier samples.

## Incremental Design: Weekly Summary / Dashboard Contract For Preview Lanes
The preview contract is no longer confined to gate JSON or ad-hoc smoke logs.
Weekly artifacts now carry the same preview lane status into the human-readable reporting path.

Covered weekly summary sections:
- `gate_preview_provenance_smoke`
- `gate_preview_provenance_failure_injection`
- `gate_preview_artifact_smoke`
- `gate_preview_artifact_validator_failure_injection`
- `weekly_legacy_preview_artifact_smoke`

Contract rules:
- when a lane is `enabled=true`, weekly summary must carry:
  - run identity
  - case/pass/fail counts
  - first failed case
  - summary artifact path, unless the lane is explicitly skipped for a documented reason
- `tools/check_weekly_summary.sh` validates those sections and checks the referenced `summary_json` files exist;
- `tools/write_step176_dashboard.py` surfaces the same preview lanes under `Latest Weekly Artifact`, so weekly dashboards and contract checks read the same source of truth.

This closes a visibility gap:
- preview lanes were already machine-enforced in gate/local CI;
- weekly JSON already carried some of the data;
- but weekly contract checking and dashboard rendering did not require those fields, so regressions could disappear from human review while staying green elsewhere.

This makes layout-level count claims fail closed instead of silently skipping when a layout has no actual entity rows.

## Incremental Design: Recover Secondary Paper Layout Root Blocks
`tests/plugin_data/step186_multi_layout_sample.dxf` exposed a stricter paper-space import gap:
- `LayoutA` paper text came from top-level `ENTITIES`;
- `LayoutB` paper text lived only inside `*Paper_Space1` in `BLOCKS`;
- the importer previously guarded root paper-space emission with a single global `count_space1 == 0` condition;
- that meant the presence of any top-level paper-space entity blocked recovery of every secondary paper-space root block.

The importer now emits root paper-space blocks per missing layout, not once per document:
- collect top-level paper layouts already represented by parsed `space=1` entities;
- emit entity-bearing root paper blocks only for layouts that are still missing;
- keep duplicate suppression via emitted-root-block tracking;
- preserve deterministic ordering by sorting root paper blocks before emission.

This keeps `LayoutA` single-sourced while restoring `LayoutB`.

The same multi-layout artifact also tightened sidecar semantics:
- synthetic `Model` layout counts must validate against actual `space=0` totals, not a literal `layout=\"Model\"` label;
- when multiple real paper layouts exist, none of them should be marked `is_default=true` unless a unique default paper layout can be proven.

Expected multi-layout artifact shape:
- `Model`: `synthetic=true`, counts sourced from `space=0`
- `LayoutA`: `synthetic=false`, `is_default=false`
- `LayoutB`: `synthetic=false`, `is_default=false`

This gives the browser-side provenance smoke a second real paper-layout click path:
- `tools/web_viewer/index.html?manifest=build/step186_multi_layout/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutB`
- expected selection includes:
  - `Value / LAYOUT B NOTE`
  - `Space / 1`
  - `Layout / LayoutB`

## Incremental Design: Real Text-Kind Artifact + Text-Label Provenance Fallback
The importer already carries real text-kind metadata for:
- `TEXT`
- `MTEXT`
- `ATTRIB`
- `ATTDEF`

That coverage existed in importer regression, but it was still missing from the default Step186 artifact/gate/browser path.
This left a gap against the P1 entity-coverage direction in `REFERENCE_COMPARISON_ACTIONS.md`:
- `ATTRIB / ATTDEF / MTEXT` were import-tested;
- but they were not exercised as real `convert_cli` artifacts;
- and preview provenance smoke still assumed mesh-or-line backed click targets.

The default Step186 artifact set now includes:
- source DXF:
  - `tests/plugin_data/step186_text_kinds_sample.dxf`
- generated artifact:
  - `build/step186_text_kinds`

Why this artifact matters:
- it is `json-only`, so it proves the document-only preview path on non-dimension text;
- it exercises three distinct text kinds in one real converter output:
  - `attrib`
  - `attdef`
  - `mtext`
- it keeps the existing `dimension`-only text artifact separate, instead of overloading one sample with all text semantics.

The validator contract is tightened accordingly:
- `text_kind` must be one of:
  - `text`
  - `mtext`
  - `attrib`
  - `attdef`
  - `dimension`
  - `mleader`
  - `table`
- `text_kind=dimension` now requires:
  - `source_type=DIMENSION`
  - `edit_mode=proxy`
  - `proxy_kind=dimension`

Preview provenance smoke is also hardened for text-only artifacts:
- previous selection probing used only viewport grid clicks;
- that was good enough for mesh / line / large paper-text targets;
- but it was too coarse for dense text-only pages where all click targets are lightweight overlay labels.

The smoke runner now uses a two-stage selection strategy:
1. try the existing canvas grid search;
2. if it fails and the expected selection contains a `Value / ...` row, locate the matching `.text-label` in the DOM and click its screen center.

This keeps the smoke generic while making text-only browser coverage deterministic.

Expected default Step186 counts after this addition:
- preview artifact prep: `8`
- preview artifact smoke: `8`
- preview provenance smoke: `9`
- preview artifact validator failure injection: `10`

## Incremental Design: Weekly Legacy Artifact Regeneration Before Strict Smoke
The legacy weekly preview lane previously validated two large build directories in place:
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`

That was no longer sufficient once Step186 tightened `text_kind=dimension` semantics:
- the current importer / `convert_cli` pipeline emits `source_type/edit_mode/proxy_kind` for dimension-derived text;
- but those legacy directories were stale historical outputs that predated the newer provenance contract;
- weekly therefore started failing for the wrong reason: stale artifacts, not a real regression in the current chain.

The fix is explicit regeneration, not validator weakening:
- `tools/prepare_legacy_preview_artifacts.py` reads each legacy target's existing `manifest.json`;
- it reuses the recorded `input` / `outputs`, prefers the current built DXF importer plugin, and reruns `tools/plm_convert.py --clean` into the same target directory;
- only after regeneration does the weekly lane run `tools/validate_plm_preview_artifacts_smoke.py`.

Contract implications:
- default Step186 / gate / local CI stay strict and unchanged;
- legacy compatibility is handled as data refresh, not schema relaxation;
- weekly summary now exposes a dedicated `weekly_legacy_preview_artifact_prep` lane before `weekly_legacy_preview_artifact_smoke`.

`weekly_legacy_preview_artifact_prep` carries:
- `status`
- `run_id`
- `summary_json`
- `case_count`
- `pass_count`
- `fail_count`
- `missing_input_count`
- `missing_manifest_count`

This keeps the legacy lane useful:
- it still covers the larger real-world artifacts weekly;
- but it now proves they were regenerated by the current converter before being judged against the current Step186 contract.

## Incremental Design: Text-Only Annotation Closure for MLEADER and TABLE
`MLEADER` and `TABLE` were already listed as legal `text_kind` values in the Step186 validator, but they were not yet backed by real Step186 artifacts, importer regression tests, or browser provenance coverage.

The design choice here stays intentionally narrow:
- do not introduce first-class `mleader` or `table` document entities yet;
- reuse the existing text-only contract for json-only preview artifacts;
- close the gap with real fixtures, importer tests, default artifact prep, and browser provenance smoke.

That means:
- `MLEADER` remains a `CADGF_ENTITY_TYPE_TEXT` entity with `text_kind=mleader`;
- `TABLE` remains a `CADGF_ENTITY_TYPE_TEXT` entity with `text_kind=table`;
- both artifacts are emitted as `json-only` manifests so they exercise the document-only preview path instead of piggybacking on mesh slices.

New default Step186 fixtures:
- `tests/plugin_data/step186_mleader_sample.dxf`
- `tests/plugin_data/step186_table_sample.dxf`

New default Step186 artifacts:
- `build/step186_mleader/manifest.json`
- `build/step186_table/manifest.json`

New importer regression tests:
- `tests/tools/test_dxf_mleader_metadata.cpp`
- `tests/tools/test_dxf_table_metadata.cpp`

Contract implications:
- default Step186 artifact prep now covers ten artifacts instead of eight;
- positive artifact smoke now covers those same ten artifacts;
- browser provenance smoke now covers eleven stable cases, adding `MLEADER` and `TABLE` text-only preview selection.

A real importer bug also had to be fixed for `TABLE`:
- DXF `0/TABLE` was being consumed unconditionally as a `TABLES`-section marker before entity dispatch;
- in `ENTITIES`, that prevented the `TABLE` entity branch from ever executing;
- the fix narrows section-table handling to `current_section == DxfSection::Tables`, allowing `TABLE` entities to flow through the existing text importer path.

This keeps the scope disciplined:
- Step186 gains real annotation coverage for `MLEADER` and `TABLE` now;
- first-class leader geometry or table cell models stay out of this increment.

## Incremental Design: Promote `plm_preview_j0225034_layoutfix_meta` into Weekly Legacy Coverage
The legacy preview lane previously covered two regenerated large artifacts:
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`

A probe on `build/plm_preview_j0225034_layoutfix_meta` showed that the current regeneration path and strict Step186 validator now pass without any schema relaxation.

Design consequence:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json` now includes `build/plm_preview_j0225034_layoutfix_meta` as a third weekly-only legacy case;
- the lane remains weekly-only, so default gate/local CI cost does not increase;
- the promotion criterion stays strict: regenerate first, then validate under the same contract as current artifacts.

This is the right expansion mechanism:
- coverage grows through regenerated real artifacts;
- validator semantics stay unchanged;
- weekly history becomes more representative without weakening the contract.

## Incremental Design: LEADER Provenance Closure
`LEADER` sat in an awkward middle state after `DIMENSION`, `HATCH`, `MLEADER`, and `TABLE` were already carried through the Step186 contract:
- importer geometry already had a natural line/polyline fallback path;
- preview and validator already understood provenance-bearing proxy entities;
- but there was no real artifact, regression test, or browser smoke case proving that classic DXF `LEADER` survives import -> manifest -> preview selection.

This increment keeps scope disciplined:
- do not add a new first-class `leader` entity type to `core::Document`;
- reuse the existing polyline payload as display geometry;
- stamp `LEADER`-specific provenance so consumers can distinguish it from generic polylines.

Contract shape:
- importer emits a polyline-backed proxy with:
  - `source_type=LEADER`
  - `edit_mode=proxy`
  - `proxy_kind=leader`
- positive artifact prep now includes:
  - `tests/plugin_data/step186_leader_sample.dxf`
  - `build/step186_leader`
- validator semantics now treat `LEADER` as a typed proxy invariant, not just free-form metadata.

Why this is the right scope:
- it closes a real annotation gap without bloating the core entity taxonomy;
- it reuses the same preview/read-only path already proven for `DIMENSION` and `HATCH`;
- it creates a stable stepping stone toward richer annotation graphs later.

Expected default counts after adding `LEADER`:
- preview artifact prep: `11`
- preview artifact smoke: `11`
- preview provenance smoke: `12`
- preview artifact validator failure injection: `10`

## Incremental Design: Surface Step186 Prep in Weekly Contract
`tools/editor_gate.sh` already emits a `step186_preview_artifact_prep` section, but real weekly payloads only carried the downstream smoke lanes:
- `gate_preview_provenance_smoke`
- `gate_preview_artifact_smoke`
- `gate_preview_artifact_validator_failure_injection`
- weekly legacy refresh lanes

That created an avoidable contract gap:
- docs and gate summaries could point at the prep lane;
- weekly summary / dashboard / checker could not assert it;
- a broken prep stage could be hidden behind stale artifacts if only downstream lanes were inspected.

This increment promotes the prep lane into the weekly contract itself:
- `tools/editor_weekly_validation.sh` now copies `step186_preview_artifact_prep` out of `editor_gate_summary.json`;
- `tools/check_weekly_summary.sh` validates it like the other preview lanes;
- `tools/write_step176_dashboard.py` and `tools/write_step176_weekly_report.py` render it explicitly.

Contract implication:
- weekly is now honest about the full Step186 chain:
  - generate current artifacts
  - smoke them
  - red-path them
  - refresh legacy large artifacts separately

## Reference-Driven Next Phase: Parallel Lanes Beyond Entity Coverage
The reference comparison now points to two higher-value lanes than “one more DXF entity”.

### Lane A: Structured `BLOCK/INSERT` instance graph
Why this is next:
- current importer preserves `block_name` and exploded provenance, but still flattens instances into display geometry;
- `REFERENCE_COMPARISON_ACTIONS.md` Phase P2 already calls for assembly/instance data;
- LibreCAD/libdxfrw show block semantics, while xeokit/cadquery show why stable instance/property graphs matter for PLM and viewer metadata.

Current code pressure points:
- `core/include/core/document.hpp`
- `core/include/core/core_c_api.h`
- `plugins/dxf_importer_plugin.cpp`
- `tools/convert_cli.cpp`
- `tools/web_viewer/preview_app.js`

Minimal first milestone:
- add document-level block definitions and block-instance records beside exploded display entities;
- keep current exploded preview path for compatibility;
- export instance graph metadata into `document.json` and `mesh_metadata.json` so preview can show “instance vs exploded fragment” explicitly.

Target outcome:
- Step186 stops being “provenance on flattened geometry only”;
- the repo gains a stable foundation for `ATTRIB/ATTDEF`, property sets, and later PLM assembly semantics.

### Lane B: Typed constraint graph and diagnostics
Why this is next:
- `core/src/solver.cpp` is still a minimal LM-style residual solver with stringly-typed constraints and no rank/DOF diagnostics;
- `REFERENCE_COMPARISON_ACTIONS.md` Phase P2 explicitly points at SolveSpace-style DOF/rank checks;
- the existing `ElementRef` hook in `core/include/core/document.hpp` is already enough to start moving from loose variable bindings to typed sub-entity references.

Current code pressure points:
- `core/include/core/solver.hpp`
- `core/src/solver.cpp`
- `core/include/core/document.hpp`
- `schemas/project.schema.json`
- `tools/solve_from_project.cpp`
- `tools/web_viewer/commands/command_registry.js`

Minimal first milestone:
- replace free-form constraint strings in persisted/project-facing paths with a typed enum-backed schema layer;
- add solver-side diagnostics payload for unsupported, redundant, and rank-deficient constraint sets;
- keep the numeric solve minimal, but make failure states explicit and machine-checkable.

Target outcome:
- the system moves from “importer/viewer with some editable geometry” toward CAD-grade sketch semantics;
- future UI work can reason about blocked edits and over-constrained states instead of treating solve failures as opaque numeric errors.

## Incremental Design: Structured Block/Instance Sidecar Contract
The first executable milestone for Lane A keeps the existing exploded preview path intact and adds an explicit instance/block sidecar on top of it.

Producer changes:
- `tools/convert_cli.cpp` now preserves `group_id` on exported entities and mesh slices when `cadgf_entity_info_v2.groupId` is available.
- `mesh_metadata.json` now optionally emits:
  - `summary.instance_count`
  - `summary.block_count`
  - `instances[]`
  - `blocks[]`
- `document.json.entities[*]`, `mesh_metadata.entities[*]`, and `mesh_metadata.line_entities[*]` may now carry `group_id`.

Sidecar shape:
- `instances[]` groups exploded fragments back into a stable block-reference record:
  - `group_id`
  - `block_name`
  - `source_type`
  - `edit_mode`
  - `proxy_kind`
  - `space`
  - `document_entity_count`
  - `mesh_entity_count`
  - `line_entity_count`
  - `entity_ids[]`
- `blocks[]` summarizes block definitions across the exported artifact:
  - `name`
  - `instance_count`
  - `document_entity_count`
  - `mesh_entity_count`
  - `line_entity_count`
  - `proxy_entity_count`

Contract intent:
- keep Step186 backward compatible for current preview consumers that only understand flattened geometry;
- let new consumers distinguish:
  - a block instance as a logical object (`instances[]`)
  - a block definition as reusable content (`blocks[]`)
  - individual exploded fragments as display/edit entities (`entities[]`, `line_entities[]`)
- provide a stable bridge toward later native `BLOCK/INSERT/ATTRIB` modeling without breaking current `exploded` provenance semantics.

Validation rules in this milestone:
- `tools/validate_plm_preview_artifacts.py` treats `group_id`, `instances[]`, and `blocks[]` as optional-but-typed;
- when present, `group_id` must match between `document.json` and `mesh_metadata.json`;
- `summary.instance_count` / `summary.block_count` must match the emitted list lengths;
- instance records must reference exported entity ids and carry a non-empty `block_name`.

Preview-consumer completion in the same milestone:
- `tools/web_viewer/preview_app.js` now indexes `mesh_metadata.instances[]` by `group_id` and `mesh_metadata.blocks[]` by `name`;
- selection details surface three new rows when data is available:
  - `Group ID`
  - `Instance Summary`
  - `Block Summary`
- this keeps preview backward compatible for non-block artifacts while making exploded `INSERT` fragments explainable as members of a logical instance, not just isolated line/mesh slices.

Non-goals of this increment:
- no native block-edit graph in `core/document.hpp` yet;
- no change to manifest schema;
- no tree/assembly browser yet; the preview only surfaces instance/block summaries in the existing selection panel.

## Incremental Design: Typed Constraint Diagnostics v1
The first executable milestone for Lane B does not attempt SolveSpace-grade rank analysis yet. It replaces opaque stringly-typed failure with explicit, machine-checkable diagnostics.

Implemented surface:
- `core/include/core/solver.hpp` now defines:
  - `ConstraintKind`
  - `ConstraintDiagnosticCode`
  - `ConstraintDiagnostic`
- `SolveResult` now carries `diagnostics[]`.
- `core/src/solver.cpp` validates constraints before numeric solve and reports:
  - `unsupported_type`
  - `wrong_arity`
  - `missing_value`
  - `unexpected_value`
  - `unbound_variable`
- `schemas/project.schema.json` now encodes a typed minimum contract:
  - refs must match `entity.key`
  - geometric constraints have fixed arity
  - dimensional constraints require `value`
- `tools/solve_from_project.cpp` now supports `--json` and returns structured diagnostics suitable for tooling and CI.

Design intent:
- move failure handling out of ad hoc console text and into a stable result payload;
- let project-facing tooling reject malformed constraint sets before LM iteration begins;
- align with the reference-comparison direction from FreeCAD/SolveSpace, where constraint taxonomy is explicit even before advanced DOF/rank work is complete.

Representative JSON shape:
```json
{
  "ok": false,
  "message": "Constraint validation failed",
  "diagnostics": [
    {
      "constraint_index": 0,
      "type": "broken",
      "kind": "unknown",
      "code": "unsupported_type",
      "detail": "unsupported constraint type"
    }
  ]
}
```

Why this is the right first cut:
- it gives CI and future UI a typed contract immediately;
- it tightens project schema without changing the existing numeric residual path for valid cases;
- it creates a safe foundation for later work on redundancy, rank deficiency, and DOF reporting instead of mixing those concerns into free-form parse failures.

Non-goals of this increment:
- no DOF/rank/redundancy math yet;
- no persistent UI/editor constraint authoring changes yet;
- no migration of document-level references beyond current `VarRef` / `entity.key` strings.

## Incremental Design: Preview Instance Drill-Down
The first block/instance milestone already surfaced `Group ID`, `Instance Summary`, and `Block Summary`. The next increment makes the same contract more actionable without introducing a new panel or schema.

Consumer-side extension:
- `tools/web_viewer/preview_app.js` now also renders:
  - `Instance Fragment Count`
  - `Instance Entity IDs`
  - `Block Instance Count`
- the data comes directly from existing Step186 sidecar fields:
  - `instances[].entity_ids`
  - `blocks[].instance_count`

Why this is the right next step:
- it stays within the existing Step186 artifact contract;
- it gives users and smoke tests a direct way to see whether one visible exploded fragment belongs to a one-piece or multi-piece instance;
- it moves the selection panel closer to an assembly inspector without forcing a full tree UI yet.

Design constraints:
- no new schema fields;
- no new manifest files;
- keep rendering cheap by formatting precomputed arrays/counts rather than traversing the scene graph at selection time.

## Incremental Design: Duplicate Constraint Diagnostics
The reference plan calls for SolveSpace-style redundancy handling, but the next safe step is an exact-duplicate detector rather than premature rank algebra.

Implemented scope:
- `ConstraintDiagnosticCode` now includes `DuplicateConstraint`.
- `ConstraintDiagnostic` now carries `relatedConstraintIndex` so tooling can point back to the first equivalent constraint.
- validation computes a normalized key for structurally valid constraints and flags later exact duplicates.
- `SolveResult` now also carries a small `analysis` summary with:
  - `constraintCount`
  - `referencedVariableCount`
  - `boundVariableCount`
  - `wellFormedConstraintCount`
  - `uniqueConstraintCount`
  - `duplicateConstraintCount`
  - `structuralDiagnosticCount`
  - `bindingDiagnosticCount`
- `tools/solve_from_project --json` now emits that `analysis` object so CI and future UI do not need to infer redundancy state by scraping free-form diagnostics.

Normalization policy in this increment:
- conservative only;
- symmetric two-ref constraints (`horizontal`, `vertical`, `equal`, `concentric`, `coincident`) sort refs before comparing;
- other constraint kinds keep their declared order.

Why this is valuable even before rank/DOF work:
- duplicate constraints are the lowest-risk subset of redundancy;
- they already create noisy failures and misleading solver inputs in project files;
- the CLI/UI can now explain “this repeats constraint #N” instead of collapsing everything into a generic failed solve;
- the new analysis summary gives a stable bridge toward rank/DOF work without pretending today’s solver already computes full independence or rank.

Non-goals of this increment:
- no geometric equivalence detection beyond exact normalized duplicates;
- no rank-deficiency or DOF counts yet;
- no automatic deduplication, only diagnosis.

## Incremental Design: Linked Instance Highlighting
The first instance-graph milestone exposed block/instance summaries in the selection panel. The next step is to make those summaries spatially actionable for exploded inserts.

Consumer-side behavior:
- when the selected entity is an exploded `INSERT` fragment, preview builds a lightweight `highlightInfo` object from existing Step186 sidecar fields:
  - `group_id`
  - `instances[].entity_ids`
  - visible mesh/line/text slices in the current scene
- preview then highlights:
  - the selected fragment as the primary object;
  - same-`group_id` sibling fragments as secondary objects;
  - same-`group_id` text entries through the text overlay state.
- the selection panel now surfaces a machine-checkable row:
  - `Highlighted Sibling Count`

Why this is the right next step:
- it stays inside the current Step186 contract and does not require a new schema;
- it turns block provenance into a usable instance-inspector behavior rather than a passive metadata dump;
- it is directly aligned with the reference P2 direction around assembly/instance data, while remaining much cheaper than a full instance tree UI.

Why this exceeds the previous target:
- the original contract work only required artifact emission and validation;
- this increment makes instance linkage visible and interactive in preview, including text-only fragments and line-only fragments;
- smoke tests can now assert linked instance behavior from the rendered UI instead of only inspecting JSON.

Non-goals of this increment:
- no tree widget or nested inspector yet;
- no persistent selection model across multiple instance groups;
- no editing of grouped instance fragments yet.

### Incremental extension: Clickable sibling drill-down
The first linked-highlight cut only exposed sibling counts. The next increment makes that information navigable from the existing selection card.

Consumer-side extension:
- the selection card now renders `Highlighted Sibling IDs` as clickable chips;
- clicking a chip routes selection to the corresponding visible mesh, line fragment, or text entry;
- preview exposes the same action through `window.__cadgfPreviewDebug.selectEntityById(id)` for smoke/debug automation.

Why this matters:
- it turns instance linkage into a real inspector workflow instead of a passive summary;
- it stays aligned with the reference plan's assembly/instance direction without requiring a new tree panel;
- it exceeds the old preview target because the UI can now traverse instance members directly, not just report counts.

## Incremental Design: Jacobian Rank / DOF Analysis v1
The duplicate-constraint detector is useful but still too binary. The next safe extension is to expose coarse structural solve information from the numerical Jacobian that the minimal LM solver already computes.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `evaluableConstraintCount`
  - `jacobianRowCount`
  - `jacobianColumnCount`
  - `jacobianRank`
  - `dofEstimate`
  - `redundantConstraintEstimate`
- analysis is computed only for constraint kinds that already have a numeric residual implementation:
  - `horizontal`
  - `vertical`
  - `parallel`
  - `perpendicular`
  - `equal`
  - `distance`
- `angle`, `concentric`, and `coincident` remain typed/validated but are excluded from Jacobian rank estimation until they have real residual equations.
- `tools/solve_from_project --json` now emits the full analysis block so CI and future UI can consume rank/DOF estimates without parsing free-form text.

Why this is the right first rank/DOF cut:
- it reuses the existing numerical Jacobian path instead of inventing a second solver model;
- it keeps the analysis conservative by only counting evaluable constraints;
- it gives a machine-readable bridge toward SolveSpace-style rank/redundancy reporting without pretending the current solver is already a full symbolic sketch kernel.

Reference alignment:
- this is the minimal credible step toward the `rank/dof/redundancy/conflict diagnostics` direction called out in the reference comparison work;
- it is intentionally narrower than SolveSpace, but broader than the previous repo state because the CLI now exports explicit structural analysis instead of only pass/fail diagnostics.

Non-goals of this increment:
- no symbolic rank analysis;
- no full independence detection beyond the Jacobian estimate;
- no UI constraint editor wiring yet.

### Incremental extension: Duplicate redundancy groups
The duplicate detector now emits a grouped summary instead of only one diagnostic per duplicate tail.

Implemented scope:
- `SolveResult` now carries `redundancyGroups`;
- each group records:
  - `anchorConstraintIndex`
  - `kind`
  - `type`
  - `constraintIndices`
- `ConstraintAnalysis` now also exposes:
  - `duplicateConstraintGroupCount`
  - `largestDuplicateConstraintGroupSize`
- `solve_from_project --json` emits `redundancy_groups[]` with:
  - `anchor_constraint_index`
  - `constraint_indices`
  - `group_size`
  - `redundant_count`

Reference alignment:
- this is still intentionally narrower than SolveSpace's full independence graph;
- however it directly follows the reference requirement around redundancy handling by moving from flat duplicate diagnostics to grouped structural summaries;
- it also improves the instance of CI/tooling consumption because downstream checks can now reason about duplicate clusters, not only individual repeated constraints.

### Incremental extension: Clickable instance-member drill-down with fit-to-fragment
The sibling-chip drill-down proved that instance linkage is navigable. The next step is to let preview traverse the logical instance membership itself, not just same-group highlights.

Consumer-side extension:
- the selection card now renders `Instance Member IDs` as clickable chips in addition to the plain `Instance Entity IDs` summary row;
- chip clicks reuse the same entity-navigation path as sibling chips, so mesh fragments, line-only slices, and text entries all route through one selection API;
- after navigation, preview frames the selected target with a conservative fit-to-fragment helper:
  - text entries use their screen-space anchor and text bounds;
  - line slices use the exported line-geometry positions and the slice index span;
  - mesh fragments fall back to the existing object-level framing path.

Why this matters:
- it moves preview closer to a real instance inspector rather than a metadata readout;
- it stays aligned with `REFERENCE_COMPARISON_ACTIONS.md` Phase P2, which calls for assembly/instance graph work;
- it exceeds the old target because the UI can now traverse and frame logical instance members directly from the Step186 sidecar, without introducing a new tree panel.

Non-goals of this increment:
- no persistent multi-selection across instance members yet;
- no editable instance graph yet;
- no separate assembly browser widget.

### Incremental extension: Structural state summary on top of Jacobian analysis
The first Jacobian cut exposed raw counts (`rank`, `dofEstimate`, `redundantConstraintEstimate`). The next safe extension is to classify those counts into a machine-readable structural state that tooling can reason about directly.

Implemented scope:
- `ConstraintAnalysis` now also carries `structuralState`;
- `tools/solve_from_project --json` emits:
  - `analysis.structural_state`
  - `structural_summary.state`
  - `structural_summary.dof_estimate`
  - `structural_summary.redundant_constraint_estimate`
  - `structural_summary.duplicate_constraint_group_count`
  - `structural_summary.largest_duplicate_constraint_group_size`
- the state is intentionally conservative:
  - `unknown` when no evaluable Jacobian exists;
  - `underconstrained` when `dofEstimate > 0` and redundancy estimate is zero;
  - `overconstrained` when redundancy estimate is non-zero and `dofEstimate == 0`;
  - `mixed` when both `dofEstimate > 0` and redundancy estimate is non-zero;
  - `well_constrained` when the evaluable Jacobian is full rank and neither under- nor over-constraint is indicated.

Why this is the right next step:
- it follows the SolveSpace-style reference direction around rank/DOF/redundancy without claiming symbolic independence analysis that the current solver does not have;
- it upgrades CI/CLI consumers from “numbers only” to a stable structural classification;
- it creates a cleaner bridge toward later `rank deficiency / conflict grouping / redundancy subset` work.

Non-goals of this increment:
- no symbolic DOF derivation;
- no conflict graph yet;
- no UI solve-diagnostics panel yet.

### Incremental extension: Focus-state observability for instance-member navigation
Clickable instance-member chips are useful, but the next practical problem is proving that navigation really reframes the scene around the new fragment instead of only swapping selection text.

Implemented scope:
- preview now records `lastFocusState` whenever `focusSelectionEntityId(...)` successfully frames a target;
- `window.__cadgfPreviewDebug.getLastFocusState()` exposes:
  - `navKind`
  - `targetType`
  - `entityId`
  - `groupId`
  - `box`
  - `cameraBefore`
  - `cameraAfter`
- the recorded focus box is conservative and matches the existing preview framing rules:
  - text targets use text-entry bounds;
  - line targets use slice-derived bounds from exported line geometry;
  - mesh targets use object bounds.

Why this matters:
- it turns fit-to-fragment from an implicit side effect into a machine-checkable behavior;
- it gives browser smoke and ad-hoc debug tooling a stable way to verify framing changes without scraping internal Three.js state;
- it pushes the instance-inspector lane beyond “selection changed” into “selection changed and the viewport re-focused correctly”.

Reference alignment:
- this is still inside the P2 assembly/instance direction from `REFERENCE_COMPARISON_ACTIONS.md`;
- it is cheaper than a full assembly tree but already gives the repo a verifiable instance-navigation contract.

### Incremental extension: Structural groups over the Jacobian graph
The global structural state is useful, but it still collapses disconnected solve regions into one summary. The next higher-value step is to surface structural groups per connected component of the evaluable constraint-variable graph.

Implemented scope:
- `SolveResult` now carries `structuralGroups`;
- each `ConstraintStructuralGroup` contains:
  - `anchorConstraintIndex`
  - `constraintIndices`
  - `variableKeys`
  - `jacobianRowCount`
  - `jacobianColumnCount`
  - `jacobianRank`
  - `dofEstimate`
  - `redundantConstraintEstimate`
  - `structuralState`
- `ConstraintAnalysis` now also counts structural groups by state:
  - `structuralGroupCount`
  - `unknownGroupCount`
  - `underconstrainedGroupCount`
  - `wellConstrainedGroupCount`
  - `overconstrainedGroupCount`
  - `mixedGroupCount`
- `solve_from_project --json` now exports:
  - aggregate group counts in `analysis`
  - mirrored counts in `structural_summary`
  - full `structural_groups[]`

How grouping works:
- only constraints with numeric residual implementations participate;
- a group is a connected component over evaluable constraints and referenced variables;
- each group reuses the already-computed Jacobian submatrix for its local rank/DOF/redundancy estimate;
- disconnected components therefore retain their own structural classification instead of being flattened into the top-level state.

Why this is the right next step:
- it follows the SolveSpace-style reference direction around rank/redundancy/conflict work without pretending the solver already has symbolic independence analysis;
- it is materially more useful than one global `mixed`/`underconstrained` label because tooling can now identify which subset of constraints and variables causes each structural condition;
- it exceeds the previous target by making structural diagnostics compositional, not only aggregate.

Non-goals of this increment:
- no minimal conflict set extraction yet;
- no automatic fix suggestions;
- no UI constraint browser yet.

### Incremental extension: Automated focus checks in preview provenance smoke
The previous increment added `lastFocusState`, but it still relied on ad-hoc browser probes. The next step is to make focus-state verification part of the normal Step186 provenance smoke contract.

Implemented scope:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now accepts an optional per-case `focusCheck` block;
- a case-level focus check can declare:
  - `clickEntityId`
  - `clickNavKind`
  - `expectNavKind`
  - `expectEntityId`
  - `expectGroupId`
  - `expectSelection[]`
  - `requireTargetChange`
- the smoke runner:
  - performs the normal initial selection by grid/text hit;
  - clicks the requested chip inside `#selection-info`;
  - reads `window.__cadgfPreviewDebug.getLastFocusState()`;
  - fails the case if the chip navigation succeeds visually but violates the declared focus contract.

Why this matters:
- the preview lane no longer depends on one-off manual Playwright probes for fit-to-fragment verification;
- the existing gate/local smoke pipeline benefits automatically because it already runs the same script;
- this pushes the repo beyond “debug-only focus observability” into “focus behavior is part of the checked artifact contract”.

### Incremental extension: Problematic constraint subset summary
Structural groups explain where under- or over-constraint occurs, but downstream tooling still has to infer which constraint indices deserve immediate attention. The next safe increment is to export a conservative problematic subset.

Implemented scope:
- `SolveResult` now also carries `problematicConstraintIndices`;
- `ConstraintAnalysis` now exposes `problematicConstraintCount`;
- the problematic subset is defined conservatively as the union of constraint indices from structural groups whose state is:
  - `mixed`
  - `overconstrained`
- `tools/solve_from_project --json` now emits:
  - `analysis.problematic_constraint_count`
  - `structural_summary.problematic_constraint_count`
  - top-level `problematic_constraint_indices`

Why this is useful:
- it is simpler for CI/UI consumers than walking every structural group just to find the problematic region;
- it does not over-promise a true minimal conflict set;
- it still follows the SolveSpace-style direction by surfacing a machine-readable “start here” subset for redundancy/conflict analysis.

Non-goals of this increment:
- no minimal unsat core;
- no automatic removal or ranking of problematic constraints;
- no solver-side repair suggestions.

### Incremental extension: Multi-hop focus sequences in preview provenance smoke
One checked chip click is enough to prove the mechanism exists, but it is not enough to prove the instance inspector supports real navigation workflows. The next step is to let one case express a short focus sequence and assert that the selection card, focus state, and fitted camera all update at each hop.

Implemented scope:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now accepts either:
  - one legacy `focusCheck` object, or
  - a new ordered `focusChecks[]` array;
- each focus step reuses the same contract:
  - `clickEntityId`
  - `clickNavKind`
  - `expectNavKind`
  - `expectEntityId`
  - `expectGroupId`
  - `expectSelection[]`
  - `requireTargetChange`
- the runner executes focus checks sequentially after the initial grid/text hit and records every step in `summary.json`.

Why this matters:
- the Step186 preview lane can now validate round-trip navigation within one real instance group instead of only one-way chip clicks;
- `Highlighted Sibling IDs` and `Instance Member IDs` are both covered as true navigation affordances, not static labels;
- this moves the instance inspector closer to the reference direction around assembly/instance graph inspection rather than stopping at metadata display.

Non-goals of this increment:
- no persistent breadcrumb/history stack;
- no batch navigation across groups;
- no dedicated inspector sidebar yet.

### Incremental extension: Conflict groups + redundancy subsets
`problematic_constraint_indices` is useful as a coarse “look here first” export, but downstream tooling still needs structure to separate a problematic connected component from the narrower subset that appears redundant. The next safe increment is to export both.

Implemented scope:
- `SolveResult` now also carries:
  - `conflictGroups[]`
  - `redundancySubsets[]`
- `ConstraintAnalysis` now also exposes:
  - `conflictGroupCount`
  - `largestConflictGroupSize`
  - `redundancySubsetCount`
  - `redundantConstraintCandidateCount`
- `conflictGroups[]` is defined conservatively as the subset of `structuralGroups[]` whose state is:
  - `mixed`
  - `overconstrained`
- `redundancySubsets[]` is derived per structural component with a greedy rank-increase pass over the local Jacobian rows:
  - rows that increase local rank join `basisConstraintIndices`
  - rows that do not increase local rank join `redundantConstraintIndices`

`solve_from_project --json` now emits:
- `analysis.conflict_group_count`
- `analysis.largest_conflict_group_size`
- `analysis.redundancy_subset_count`
- `analysis.redundant_constraint_candidate_count`
- mirrored fields in `structural_summary`
- top-level:
  - `conflict_groups[]`
  - `redundancy_subsets[]`

Why this is the right next step:
- it stays aligned with the SolveSpace-style direction around rank/redundancy/conflict diagnostics without claiming an exact symbolic conflict solver;
- it is more actionable than a flat problematic index list because consumers can distinguish:
  - the problematic connected region;
  - the narrower greedy redundant subset inside that region;
- it exceeds the previous repo state by making structural diagnostics closer to something a UI inspector or CI report can surface directly.

Non-goals of this increment:
- no guaranteed minimal redundancy subset;
- no symbolic unsat core;
- no automatic constraint repair or suggestion engine.

### Incremental extension: Group-level focus in preview instance inspector
The instance inspector already supported member-level navigation through `Instance Member IDs` and `Highlighted Sibling IDs`, but that still forced the user and the smoke runner to reason one fragment at a time. The next useful increment is group-level focus that can frame the whole exploded insert fragment set with one click.

Implemented scope:
- `tools/web_viewer/preview_app.js` now exposes:
  - `focusSelectionGroupId(groupId, navKind = "group")`
  - `window.__cadgfPreviewDebug.focusGroupById(groupId, navKind = "debug-group")`
- the existing framing path was generalized from single-target focus to:
  - `frameSelectionTargets(targets, navKind, options)`
  - `frameSelectionTarget(target, navKind)` now delegates to the multi-target implementation;
- the `Group ID` row in the selection card is now a clickable chip, not only text;
- the recorded `lastFocusState` now carries group-level metadata:
  - `targetType = "group"`
  - `groupMemberIds = [...]`
  - a unioned bounding box for the full group.

Why this matters:
- it moves the preview side closer to a real assembly/instance inspector instead of stopping at isolated fragment jumps;
- it lets the smoke runner prove that group navigation changes the fitted camera target and not only the selected label;
- it matches the reference-driven direction around instance graph inspection better than a metadata-only selection card.

Non-goals of this increment:
- no dedicated tree sidebar for instance graphs;
- no persistent focus history/breadcrumb UI;
- no cross-group graph traversal yet.

### Incremental extension: Free-variable candidates in structural diagnostics
The earlier structural diagnostics already exported `rank`, `DOF`, `conflictGroups`, and greedy `redundancySubsets`, but underconstrained components still required consumers to infer which variables were likely unconstrained. The next safe increment is to name conservative free-variable candidates directly from each local Jacobian block.

Implemented scope:
- `ConstraintStructuralGroup` now also exports:
  - `basisVariableKeys`
  - `freeVariableKeys`
- `ConstraintConflictGroup` now also exports:
  - `basisVariableKeys`
  - `freeVariableKeys`
- `ConstraintAnalysis` now also exports:
  - `freeVariableCandidateCount`
- `solve_from_project --json` mirrors these fields in:
  - `analysis.free_variable_candidate_count`
  - `structural_summary.free_variable_candidate_count`
  - `structural_groups[]`
  - `conflict_groups[]`

Method:
- the solver reuses the local numeric Jacobian already built for each connected structural group;
- it runs a conservative greedy column pass:
  - a variable column joins `basisVariableKeys` if adding it increases local rank;
  - otherwise it joins `freeVariableKeys`.

Why this is useful:
- it makes underconstrained and mixed groups directly actionable without requiring downstream tools to compute their own nullspace approximations;
- it complements `problematic_constraint_indices` and `redundancy_subsets[]` by naming likely unconstrained directions rather than only problematic rows;
- it stays aligned with the SolveSpace-style direction while remaining intentionally conservative and machine-readable.

Non-goals of this increment:
- no exact symbolic nullspace basis;
- no formal guarantee that `freeVariableKeys` is the minimal free basis;
- no UI solver inspector yet.

### Incremental extension: Second real group-focus case in default preview smoke
The first group-level focus proof was intentionally built around `step186_paperspace_insert_styles`, because that sample already had a stable two-fragment exploded insert in paper space. That was enough to prove the mechanism, but not enough to prove the behavior generalizes to another real insert sample with different styling and a different block/instance summary.

Implemented scope:
- `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json` now adds a second real group-focus case:
  - `insert_blocka_group_focus`
  - manifest: `build/step186_origin_blocks/manifest.json`
- the case covers a real two-member exploded insert for `BlockA`:
  - initial hit on entity `2`
  - `Highlighted Sibling IDs -> 3`
  - `Group ID -> 1`
- the case asserts both metadata and camera behavior:
  - `Instance Fragment Count = 2`
  - `Instance Entity IDs = 2, 3`
  - `Instance Member IDs = 2, 3`
  - `targetType = group`
  - `groupMemberIds = [2, 3]`

Why this matters:
- it proves the group-focus contract is not special-cased to one paper-space sample;
- it covers a different styling mix:
  - `BYBLOCK -> CENTER / 0.5 / 0.25`
  - `BYLAYER -> CONTINUOUS / 0.05 / 3.0`
- it moves the preview lane closer to a reusable instance-inspector regression matrix instead of a single demo path.

Non-goals of this increment:
- no exhaustive focus coverage for every insert sample yet;
- no separate preview inspector panel for instance groups;
- no keyboard navigation across instance members yet.

### Incremental extension: Third real group-focus case for `BlockMixed`
With `BlockA` and `PaperStyledBlock` already covered, the next useful increment is one more real insert sample whose geometry is line-only and whose block summary differs from the previous two. This avoids overfitting the preview group-focus contract to one mesh-backed case and one paper-space case.

Implemented scope:
- `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json` now also adds:
  - `mixed_block_group_focus`
  - manifest: `build/step186_origin_mixed/manifest.json`
- the case targets:
  - `BlockMixed`
  - `group_id = 2`
  - `entity_ids = [8, 9]`
- checked navigation sequence:
  - initial hit on entity `8`
  - `Highlighted Sibling IDs -> 9`
  - `Group ID -> 2`

Why this matters:
- it gives the default preview smoke three different real group-focus regressions:
  - model-space mesh-backed exploded insert
  - paper-space exploded insert
  - model-space line-only exploded insert
- it reduces the chance that the focus contract accidentally depends on one rendering path or one sample topology.

Non-goals of this increment:
- no per-block fixture generation pipeline;
- no automatic discovery of focus-capable samples;
- no group-level keyboard navigation yet.

### Incremental extension: Group-focus coverage for a real DIMENSION proxy group
The previous preview regressions all focused on exploded insert groups. That proved the instance-inspector path, but it still left one meaningful gap: grouped proxy geometry such as derived DIMENSION fragments. The next useful increment is to cover a real dimension proxy group with the same navigation contract.

Implemented scope:
- `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json` now also adds:
  - `mixed_dimension_group_focus`
  - manifest: `build/step186_origin_mixed/manifest.json`
- the case targets the real `*D1` proxy group:
  - `group_id = 3`
  - `source_type = DIMENSION`
  - `proxy_kind = dimension`
- checked navigation sequence:
  - initial hit on one proxy fragment
  - `Highlighted Sibling IDs`
  - `Group ID`

Why this matters:
- it proves group-level focus is not only for exploded inserts;
- it extends the preview contract into grouped derived proxy geometry, which is closer to the product's current DIMENSION/HATCH reality;
- it exceeds the earlier target by making the instance/group inspector a more general provenance-group inspector.

Non-goals of this increment:
- no dedicated proxy-group sidebar;
- no separate navigation model for text members inside the dimension block;
- no DIMENSION editing, only focus/inspection.

### Incremental extension: Priority-ranked conflict groups and redundancy subsets
The earlier solver export already exposed:
- `conflictGroups[]`
- `redundancySubsets[]`
- `problematicConstraintIndices`

That was useful, but consumers still had to decide which problematic region to show first and which redundancy subset was the smallest or most actionable. The next safe increment is to make that ordering explicit without changing the LM solve path.

Implemented scope:
- `ConstraintStructuralGroup` now also carries:
  - `priorityScore`
- `ConstraintConflictGroup` now also carries:
  - `priorityScore`
- `ConstraintRedundancySubset` now also carries:
  - `witnessConstraintCount`
  - `priorityScore`
- `ConstraintAnalysis` now also exposes:
  - `primaryConflictAnchorConstraintIndex`
  - `primaryConflictPriorityScore`
  - `primaryRedundancySubsetAnchorConstraintIndex`
  - `primaryRedundancyPriorityScore`

Ranking policy:
- structural/conflict groups use a conservative severity score based on:
  - structural state bias
  - `redundantConstraintEstimate`
  - group size
  - `freeVariableKeys` count
  - `dofEstimate`
- redundancy subsets use a conservative priority score that prefers:
  - more redundant candidates first
  - smaller witness size second

`solve_from_project --json` now mirrors this in:
- `analysis.*`
- `structural_summary.*`
- `conflict_groups[].priority_score`
- `redundancy_subsets[].witness_constraint_count`
- `redundancy_subsets[].priority_score`

Why this is the right increment:
- it gives CI/UI a deterministic “start here” answer without requiring downstream sorting heuristics;
- it stays conservative and machine-readable;
- it exceeds the previous state by turning the solver output from a flat dump into a ranked structural diagnostic surface.

Non-goals of this increment:
- no exact minimal unsat core;
- no symbolic conflict explanation;
- no auto-fix or repair suggestions.

### Incremental extension: Direct primary conflict/redundancy index exports
Priority-ranked anchors are useful, but a downstream consumer still has to look up the first conflict group or redundancy subset to recover the actual constraint indices. The next small but high-value increment is to export those direct index lists alongside the ranked anchors.

Implemented scope:
- `SolveResult` now also carries:
  - `primaryConflictConstraintIndices`
  - `primaryRedundancyBasisConstraintIndices`
  - `primaryRedundantConstraintIndices`
- `solve_from_project --json` now emits:
  - `primary_conflict_constraint_indices`
  - `primary_redundancy_basis_constraint_indices`
  - `primary_redundant_constraint_indices`

Selection policy:
- `primary_conflict_constraint_indices` mirrors the highest-ranked `conflictGroups[0]`
- `primary_redundancy_basis_constraint_indices` and `primary_redundant_constraint_indices` mirror the highest-ranked `redundancySubsets[0]`

Why this is useful:
- CI and future UI consumers no longer need a second lookup to get the first actionable subset;
- it keeps the export deterministic and machine-readable;
- it pushes the solver output another step beyond a descriptive dump toward a directly consumable diagnostics contract.

Non-goals of this increment:
- no nested “explanation graph” for why a row is primary;
- no multi-level ranking policy configuration;
- no symbolic proof that the exported subset is minimal.

### Incremental extension: Smallest redundancy subset direct export
The previous increment exported:
- the highest-ranked redundancy subset;
- its direct basis/redundant indices.

That is useful for triage, but it is not the same as the smallest witness a downstream UI might want to show first. The next increment is to export the smallest redundancy witness explicitly, even when it differs from the highest-ranked subset.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `smallestRedundancySubsetAnchorConstraintIndex`
  - `smallestRedundancyWitnessConstraintCount`
- `SolveResult` now also carries:
  - `smallestRedundancyBasisConstraintIndices`
  - `smallestRedundantConstraintIndices`
- `solve_from_project --json` now emits:
  - `smallest_redundancy_subset_anchor_constraint_index`
  - `smallest_redundancy_witness_constraint_count`
  - `smallest_redundancy_basis_constraint_indices`
  - `smallest_redundant_constraint_indices`

Selection policy:
- choose the redundancy subset with the smallest `witnessConstraintCount`;
- tie-break by:
  - larger redundant count first;
  - lower anchor index second.

Why this matters:
- it separates two different consumer questions:
  - “what is the most severe redundancy region?”
  - “what is the smallest witness I can show or remove first?”
- it pushes the solver diagnostics one step beyond ranked summaries toward directly usable remediation views.

Non-goals of this increment:
- no proof of global minimality;
- no solver-side delete/fix suggestions;
- no symbolic equivalence reasoning.

### Incremental extension: Stable DIMENSION proxy group-focus via text anchor
The previous attempt to cover a real `DIMENSION` proxy group in preview smoke failed for the wrong reason: the contract fields were present, but a pure grid hit on sparse line fragments was too brittle. The right fix is not to weaken the contract; it is to anchor the smoke on a visible dimension text label and then exercise the same group-level navigation contract from there.

Implemented scope:
- the default preview provenance fixture now anchors `mixed_dimension_group_focus` on the visible dimension text (`Value = 20`);
- once selected, the case still validates real preview navigation through the existing `Group ID` chip;
- the expected focused group now reflects the actually resolvable visible targets in preview:
  - `groupMemberIds = [11, 12, 13, 14]`
  - primary selected entity remains the visible dimension text `14`.

Why this is the right contract:
- it is still a real user-visible path:
  - select a visible annotation label;
  - inspect provenance;
  - click the group chip;
- it avoids making default gate coverage depend on fragile pixel-grid luck for sparse proxy lines;
- it keeps the smoke authoritative for what the preview actually resolves into selectable targets.

Non-goals of this increment:
- no promise that every derived line fragment in a proxy-only dimension group is directly hittable from an arbitrary initial text selection;
- no change to preview selection semantics for hidden or unresolved fragments.

### Incremental extension: Smallest conflict group direct export
The solver already exported:
- ranked `conflict_groups[]`;
- `primary_conflict_constraint_indices`;
- smallest redundancy witness exports.

That still left one asymmetry: consumers could ask “what is the highest-priority conflict?” but not “what is the smallest conflict witness I can show first?” The next increment is to export that smallest conflict group directly, using the same philosophy as the smallest redundancy subset export.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `smallestConflictGroupAnchorConstraintIndex`
  - `smallestConflictGroupSize`
- `SolveResult` now also carries:
  - `smallestConflictConstraintIndices`
- `solve_from_project --json` now emits:
  - `smallest_conflict_group_anchor_constraint_index`
  - `smallest_conflict_group_size`
  - `smallest_conflict_constraint_indices`

Selection policy:
- choose the conflict group with the smallest `constraintIndices.size()`;
- tie-break by:
  - higher `priorityScore`;
  - lower anchor index.

Why this matters:
- it separates two consumer questions cleanly:
  - “what is the most severe conflict region?”
  - “what is the smallest conflict witness I can surface first?”
- it keeps the diagnostics machine-readable and conservative;
- it makes the conflict side symmetric with the existing smallest redundancy witness export.

Non-goals of this increment:
- no exact unsat-core minimization;
- no symbolic explanation for why a smaller group is chosen;
- no edit/delete recommendation engine.

### Incremental extension: Fourth real group-focus sample via `BlockTriad`
The previous three real group-focus regressions covered:
- `BlockA`
- `BlockMixed`
- `PaperStyledBlock`

That still left the default preview regression matrix thin for model-space exploded inserts with more than two fragments. The next controlled increment is to add a small real Step186 DXF sample whose insert expands into three distinct line fragments with mixed style provenance.

Implemented scope:
- new real sample:
  - `tests/plugin_data/step186_insert_triad_sample.dxf`
- new default prep artifact:
  - `build/step186_insert_triad`
- new preview provenance smoke case:
  - `triad_group_focus`
- new artifact smoke target:
  - `insert_triad_modelspace_group_focus`

Contract shape of the sample:
- `source_type = INSERT`
- `edit_mode = exploded`
- `proxy_kind = insert`
- `block_name = BlockTriad`
- one real instance group with:
  - `group_id = 1`
  - `entity_ids = [1, 2, 3]`
  - `document_entity_count = 3`
  - `mesh_entity_count = 3`
  - `line_entity_count = 3`

Why this is useful:
- it adds a fourth real insert group-focus sample instead of reusing legacy or synthetic cases;
- it exercises a denser multi-fragment group than the two-member samples;
- it keeps the preview contract grounded in directly inspectable geometry and provenance.

Non-goals of this increment:
- no nested block graph yet;
- no additional layout semantics;
- no dependence on legacy large samples.

### Incremental extension: Priority breakdown export
The solver already exported ranked conflict/redundancy outputs and, after the previous increment, the smallest conflict/redundancy witnesses. The remaining gap was explainability: downstream consumers could see the chosen score, but not the score components.

Implemented scope:
- `ConstraintConflictGroup` now also carries:
  - `priorityStateBias`
  - `priorityRedundantConstraintContribution`
  - `priorityConstraintCountContribution`
  - `priorityFreeVariableContribution`
  - `priorityDofContribution`
- `ConstraintRedundancySubset` now also carries:
  - `priorityRedundantConstraintContribution`
  - `priorityWitnessPenalty`
- `solve_from_project --json` now emits:
  - `conflict_groups[].priority_breakdown`
  - `redundancy_subsets[].priority_breakdown`

Why this matters:
- it turns ranked diagnostics from a black-box score into a machine-readable explanation surface;
- it lets CI/UI show *why* one conflict group outranks another;
- it keeps the policy explicit without changing the underlying conservative heuristics.

Non-goals of this increment:
- no symbolic proof of minimality;
- no user-facing natural-language explanation generator;
- no configurable weighting policy.

### Incremental extension: Stable initial selection for line-only/paper-space preview cases
The previous preview provenance contract still had one fragile entry point: some real paper-space, line-only cases depended on a sparse grid hit before the rest of the checked focus chain could run. That meant the contract for `paperspace_insert_style` was correct, but the smoke entry path could still fail for reasons unrelated to the provenance model itself.

Implemented scope:
- `tools/web_viewer/scripts/preview_provenance_smoke.js` now accepts:
  - `initialEntityId`
  - `initialGroupId`
  - `initialNavKind`
- when one of those fields is present, the smoke runner uses `window.__cadgfPreviewDebug` to establish the initial selection deterministically before running the normal `focusChecks[]`.
- `paperspace_insert_style` now uses:
  - `initialEntityId = 3`
  - `initialNavKind = initial-entity`

Why this matters:
- it removes a runner-level flake without weakening the contract;
- it keeps the case grounded in the real preview state and the same selection/focus code path;
- it creates a reusable pattern for future line-only and paper-space Step186 cases.

Non-goals of this increment:
- no hidden backdoor around the selection UI;
- no removal of grid/text hit probing for ordinary cases;
- no change to the preview provenance schema itself.

### Incremental extension: Analysis-level priority breakdown summaries
The previous increment exported `priority_breakdown` only inside `conflict_groups[]` and `redundancy_subsets[]`. That was useful, but downstream consumers still had to locate the chosen primary/smallest group or subset and then re-read the nested breakdown from that array member.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `primaryConflictPriorityBreakdown`
  - `smallestConflictPriorityBreakdown`
  - `primaryRedundancyPriorityBreakdown`
  - `smallestRedundancyPriorityBreakdown`
- `solve_from_project --json` now emits those summaries in both:
  - `analysis`
  - `structural_summary`

Design rule:
- these summaries are copied directly from the already-selected primary/smallest conflict group or redundancy subset;
- they do not add a second ranking path;
- they do not change solver behavior.

Why this matters:
- CI and future UI layers can explain the chosen primary/smallest diagnostics without chasing arrays;
- it keeps the ranking explanation symmetric with the existing anchor-index exports;
- it moves the solver output closer to a usable diagnostics API, not just a raw debug dump.

Non-goals of this increment:
- no new ranking heuristic;
- no natural-language explanation synthesis;
- no exact unsat-core or minimal witness algorithm.

### Incremental extension: Deterministic initial selection for real insert group-focus cases
After the previous initial-selection work proved out on `paperspace_insert_style`, the remaining default real insert group-focus cases still entered through sparse grid hits. Those cases were already green, but they still depended on a brittle discovery step instead of a deterministic preview selection path.

Implemented scope:
- the following real Step186 cases now declare explicit initial selection:
  - `insert_blocka_group_focus`
  - `mixed_block_group_focus`
  - `triad_group_focus`
- each now uses:
  - `initialEntityId`
  - `initialNavKind = initial-entity`

Why this matters:
- it removes unnecessary hit-test variance from the default browser regression matrix;
- it makes the Step186 insert group-focus lane deterministic across:
  - model-space exploded inserts;
  - mixed-origin exploded inserts;
  - denser three-fragment exploded inserts;
- it reuses the same preview selection/focus code path instead of inventing a special test-only route.

Non-goals of this increment:
- no change to group/member/sibling focus semantics;
- no new preview metadata fields;
- no weakening of the checked selection contract.

### Incremental extension: Analysis-level selection-policy summaries
The previous breakdown export made the chosen scores inspectable, but consumers still had to know the implicit sort policy for:
- the primary conflict group;
- the smallest conflict witness;
- the primary redundancy subset;
- the smallest redundancy witness.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `primaryConflictSelectionPolicy`
  - `smallestConflictSelectionPolicy`
  - `primaryRedundancySelectionPolicy`
  - `smallestRedundancySelectionPolicy`
- `solve_from_project --json` now exports those arrays in:
  - `analysis`
  - `structural_summary`

Policy shape:
- primary conflict:
  - `priority_score_desc`
  - `constraint_count_desc`
  - `anchor_constraint_index_asc`
- smallest conflict:
  - `constraint_count_asc`
  - `priority_score_desc`
  - `anchor_constraint_index_asc`
- primary redundancy:
  - `priority_score_desc`
  - `witness_constraint_count_asc`
  - `anchor_constraint_index_asc`
- smallest redundancy:
  - `witness_constraint_count_asc`
  - `redundant_constraint_count_desc`
  - `anchor_constraint_index_asc`

Why this matters:
- it exposes the actual ranking rules directly at analysis level;
- it makes the diagnostics API more self-describing for CI and later UI consumers;
- it keeps the implementation explainable without changing any ranking behavior.

Non-goals of this increment:
- no weighted-policy tuning;
- no user-facing prose generation;
- no exact optimal subset explanation.

### Incremental extension: Deterministic initial selection for text-only and line-only real cases
After stabilizing the real insert group-focus cases, the remaining default preview matrix still had several real cases that entered through hit-testing even though their target entities were already known from the generated artifacts.

Implemented scope:
- the following real cases now declare explicit initial selection:
  - `insert_exploded`
  - `mixed_dimension_group_focus`
  - `dimension_doc_only`
  - `hatch_line_only`
  - `leader_line_only`
  - `mixed_paperspace_text`
  - `multi_layout_layout_b_text`
  - `text_kind_attrib`
  - `text_kind_attdef`
  - `text_kind_mtext`
  - `text_kind_mleader`
  - `text_kind_table`
- each uses:
  - `initialEntityId`
  - `initialNavKind = initial-entity`

Why this matters:
- it removes unnecessary click-grid variance from text-only, line-only, paper-space text, and proxy-text coverage;
- it turns more of the Step186 preview contract into deterministic selection/focus verification instead of probabilistic hit-test discovery;
- it keeps the browser smoke aligned with the actual preview selection API rather than with incidental viewport layout.

Non-goals of this increment:
- no change to entity metadata or preview rendering;
- no new debug-only selection path;
- no reduction in checked provenance assertions after the initial selection is made.

### Incremental extension: Analysis-level selection explanations
The previous solver increment exported `selection_policy` arrays, which made the ordering rules machine-readable, but consumers still needed a stable higher-level label to explain the chosen primary/smallest result without rendering the whole policy array.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `primaryConflictSelectionExplanation`
  - `smallestConflictSelectionExplanation`
  - `primaryRedundancySelectionExplanation`
  - `smallestRedundancySelectionExplanation`
- `solve_from_project --json` now exports those labels in:
  - `analysis`
  - `structural_summary`

Current explanation labels:
- primary conflict:
  - `highest_priority_conflict_group`
- smallest conflict:
  - `smallest_conflict_witness`
- primary redundancy:
  - `highest_priority_redundancy_subset`
- smallest redundancy:
  - `smallest_redundancy_witness`

Why this matters:
- it gives UI and CI a stable explanation surface above the raw sort keys;
- it keeps the diagnostics API explainable without forcing downstream code to reverse-engineer solver internals;
- it moves the solver contract one step closer to a user-facing diagnostics layer while preserving the current ranking behavior.

Non-goals of this increment:
- no new ranking heuristic;
- no natural-language synthesis;
- no claim of exact minimal witness/conflict extraction.

### Incremental extension: Deterministic entry coverage summary
After converting the default real preview matrix to explicit `initialEntityId` entry points, the smoke runner still only reported per-case click payloads. That made it hard for CI to answer a higher-level question: how much of the matrix is still relying on hit-testing?

Implemented scope:
- `preview_provenance_smoke.js` now writes run-level summary counters:
  - `entry_kind_counts`
  - `nav_kind_counts`
  - `initial_entry_case_count`
  - `deterministic_entry_case_count`
  - `focus_check_case_count`

Why this matters:
- it turns “we think the default matrix is deterministic now” into a machine-readable contract;
- CI and weekly summaries can now track whether grid/text fallback is creeping back into the default matrix;
- it gives a cleaner success metric for the preview lane than only checking `passed/failed`.

Non-goals of this increment:
- no change to preview behavior;
- no new selection strategy;
- no dashboard integration in this step.

### Incremental extension: Analysis-level selection summaries
The previous solver increment exported stable explanation labels, but a consumer still had to combine the label with several separate fields to present something useful to a human.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `primaryConflictSelectionSummary`
  - `smallestConflictSelectionSummary`
  - `primaryRedundancySelectionSummary`
  - `smallestRedundancySelectionSummary`
- those summaries are exported by `solve_from_project --json` in:
  - `analysis`
  - `structural_summary`

Current summary shape:
- primary conflict:
  - `highest_priority_conflict_group(state=...,constraints=...,score=...,anchor=...)`
- smallest conflict:
  - `smallest_conflict_witness(state=...,constraints=...,score=...,anchor=...)`
- primary redundancy:
  - `highest_priority_redundancy_subset(redundant=...,witness=...,score=...,anchor=...)`
- smallest redundancy:
  - `smallest_redundancy_witness(redundant=...,witness=...,score=...,anchor=...)`

Why this matters:
- it gives UI and CI a directly renderable explanation surface above raw labels and sort keys;
- it keeps the contract deterministic and versionable because the summary is still derived from explicit numeric fields;
- it pushes the solver output further toward an explainable diagnostics API instead of a debug-only dump.

Non-goals of this increment:
- no natural-language prose generation;
- no new ranking policy;
- no exact minimal conflict proof.

### Incremental extension: Analysis-level selection tags
The previous solver increment exported policy arrays, explanation labels, and human-readable summaries. That still left one gap for downstream consumers: UI and CI often want a short, stable tag that can be rendered or filtered without parsing either a summary string or a policy array.

Implemented scope:
- `ConstraintAnalysis` now also carries:
  - `primaryConflictSelectionTag`
  - `smallestConflictSelectionTag`
  - `primaryRedundancySelectionTag`
  - `smallestRedundancySelectionTag`
- `solve_from_project --json` exports those tags in:
  - `analysis`
  - `structural_summary`

Current tag set:
- primary conflict:
  - `conflict-primary-priority`
- smallest conflict:
  - `conflict-smallest-witness`
- primary redundancy:
  - `redundancy-primary-priority`
- smallest redundancy:
  - `redundancy-smallest-witness`

Why this matters:
- it gives UI/CI a compact, versionable contract that is easier to consume than summaries or raw ranking policies;
- it keeps explanation labels and summaries human-facing while preserving a short machine-facing selector;
- it continues moving solver diagnostics toward a structured consumer API instead of a debug dump.

Non-goals of this increment:
- no new ranking heuristic;
- no new witness extraction algorithm;
- no change to LM solve behavior.

### Incremental extension: Preview entry metrics propagation
Once the preview smoke runner exported deterministic-entry counters, those metrics still stopped at the raw `summary.json`. That was insufficient because gate, local CI, dashboard, and weekly report consumers could still silently drop the new contract.

Implemented scope:
- `editor_gate.sh` now reads and exports:
  - `initial_entry_case_count`
  - `deterministic_entry_case_count`
  - `focus_check_case_count`
  into `editor_gate_summary.json`
- `local_ci.sh` now writes the same metrics into `local_ci_summary.json`
- reporting consumers now surface them:
  - `write_ci_artifact_summary.py`
  - `write_step176_dashboard.py`
  - `write_step176_weekly_report.py`
  - `check_weekly_summary.sh`

Rendered surface:
- CI markdown:
  - `entry=<deterministic>/<cases>`
  - `focus_checks=<count>`
- weekly dashboard:
  - `entry=<deterministic>/<cases>`
  - `focus_checks=<count>`
- weekly report:
  - `entry=<deterministic>/<cases>`
  - `focus_checks=<count>`

Important implementation note:
- this increment also fixed a real pipeline bug in `editor_gate.sh`: the three new preview provenance metrics were parsed from the smoke summary but were not included in the gate export list, so the gate JSON always emitted zeros. The contract is now exported correctly.

Why this matters:
- it turns deterministic-entry coverage into a first-class CI/weekly signal rather than a hidden detail inside smoke output;
- it allows regressions such as “one default case fell back from deterministic entry to no entry” to appear immediately in gate artifacts and dashboards;
- it validates that the consumer chain is actually honoring the new contract, not just the producer.

Non-goals of this increment:
- no new preview behavior;
- no change to case selection policy;
- no claim of a fresh full weekly rerun in this step.

### Incremental extension: Preview initial-target readiness + paperspace leader sample
The previous deterministic-entry work made the default preview provenance matrix much more stable, but it still had one real gap: `insert_exploded` could fail in gate-only runs because the runner tried to resolve the requested entity before the preview-side selection registry had fully populated.

Implemented scope:
- `window.__cadgfPreviewDebug` now also exposes:
  - `hasEntityId(entityId)`
  - `hasGroupId(groupId)`
- `preview_provenance_smoke.js` now waits for the requested initial target to become visible in that registry before issuing the initial selection action.
- a new real Step186 sample was added:
  - `tests/plugin_data/step186_paperspace_insert_leader_sample.dxf`
- that sample is wired into:
  - `tools/prepare_step186_preview_artifacts.py`
  - `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases.json`
  - `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json`
  - `tests/tools/test_dxf_paperspace_insert_leader.cpp`

Sample contract:
- source layout:
  - `LayoutStyle`
- expected paperspace entities:
  - one `LEADER` proxy
  - one paperspace note text
  - one exploded `INSERT` group for `PaperStyledBlock`
  - one viewport metadata entry
- expected provenance:
  - leader entity:
    - `source_type=LEADER`
    - `edit_mode=proxy`
    - `proxy_kind=leader`
    - `space=1`
    - `layout=LayoutStyle`
  - insert fragments:
    - `source_type=INSERT`
    - `edit_mode=exploded`
    - `proxy_kind=insert`
    - `block_name=PaperStyledBlock`
    - `space=1`
    - `layout=LayoutStyle`

Why this matters:
- it fixes a real gate-only race instead of only improving standalone smoke behavior;
- it broadens the real Step186 matrix with a richer paperspace combination: viewport + leader proxy + note text + exploded insert;
- it continues the reference-driven P2 path around assembly/instance data and richer proxy coverage without weakening the current contract.

Reference-driven follow-on gap:
- `REFERENCE_COMPARISON_ACTIONS.md` still calls out:
  - `tests/core/test_constraints_basic.cpp`
  - `tests/core/test_assembly_roundtrip.cpp`
- the current increment improves the preview/proxy side of P2, but those two remain the clearest next structural gaps for the solver and assembly lanes.

Non-goals of this increment:
- no new preview selection mode;
- no new solver behavior;
- no native editable leader entity model;
- no claim that all future gate flakes are solved without similar readiness checks.

### Incremental extension: Basic constraints regression + editor assembly roundtrip contract
The remaining P2 items called out in `REFERENCE_COMPARISON_ACTIONS.md` were:
- `tests/core/test_constraints_basic.cpp`
- `tests/core/test_assembly_roundtrip.cpp`

This increment closes the first item directly and addresses the second through a stronger, real editor-path smoke instead of inventing a fake core-only serializer roundtrip.

Implemented scope:
- new solver regression:
  - `tests/core/test_constraints_basic.cpp`
  - registered in `tests/core/CMakeLists.txt`
- editor entity metadata contract widened so the editor model can actually carry assembly/provenance fields instead of only preserving them incidentally through raw base JSON:
  - `group_id -> groupId`
  - `space -> space`
  - `layout/layout_name -> layout`
  - implemented in:
    - `tools/web_viewer/adapters/cadgf_document_adapter.js`
    - `tools/web_viewer/state/documentState.js`
    - adapter round-trip assertions in `tools/web_viewer/tests/editor_commands.test.js`
- editor roundtrip semantics widened:
  - `editor_roundtrip_smoke.js` now captures grouped entities on import and validates after export/re-import:
    - per-entity metadata preservation for `groupId/blockName/sourceType/editMode/proxyKind/space/layout`
    - group membership preservation by `groupId -> entityIds[]`
  - exported summary field:
    - `results[*].export.assembly_roundtrip_semantics`
- real CMake smoke added:
  - `cmake/RunEditorAssemblyRoundtrip.cmake`
  - `editor_assembly_roundtrip_smoke` in root `CMakeLists.txt`
  - source artifact:
    - `build/convert_cli_block_instances_smoke/document.json`

Solver basic-regression contract:
- taxonomy mapping must stay stable:
  - `classifyConstraintKind()`
  - `constraintKindName()`
- success-path solve coverage now exists for the currently numerically implemented basics:
  - `horizontal`
  - `vertical`
  - `equal`
  - `distance`
  - `parallel`
  - `perpendicular`
- each case must remain:
  - `ok=true`
  - `diagnostics.empty()`
  - `analysis.evaluableConstraintCount == constraintCount`
  - `analysis.structuralState == underconstrained`

Assembly roundtrip contract:
- grouped entities are tracked when `groupId` is finite
- preserved subset:
  - `groupId`
  - `blockName`
  - `sourceType`
  - `editMode`
  - `proxyKind`
  - `space`
  - `layout`
- roundtrip succeeds only if:
  - no grouped entity is missing after editor re-import
  - no grouped entity metadata drifts
  - every source group preserves the same `entityIds[]` membership set

Important implementation notes:
- a real logic bug surfaced while adding the assembly contract:
  - `summarizeAssemblyGroups()` expects tracked records, but the first implementation passed raw editor entities, which made every group appear drifted even when individual metadata was intact
  - fixed by normalizing `document.listEntities()` through `captureAssemblyTrackedEntities()` before summarizing
- a real CMake invocation bug also surfaced:
  - `editor_assembly_roundtrip_smoke` received quoted `-Drepo/-Dinputdoc/-Doutdir` values
  - `RunEditorAssemblyRoundtrip.cmake` now strips surrounding quotes before `execute_process()`

Why this matters:
- it turns the reference-driven “assembly roundtrip” gap into a real editor-path contract, which is stronger than a narrow core serialization test;
- it stops relying on base-CADGF passthrough as an accidental preservation mechanism and makes assembly metadata part of the editor entity model;
- it gives the solver lane a stable, low-level regression floor separate from the heavier diagnostics/ranking tests.

Non-goals of this increment:
- no new assembly UI surface in preview/editor;
- no native block-instance object model yet;
- no full `tests/core/test_assembly_roundtrip.cpp` core-only harness;
- no fresh full `local_ci` or weekly run claimed in this step.

### Incremental extension: richer paperspace assembly smoke + read-only offset hardening

Reference-driven gap addressed in this increment:
- the earlier assembly roundtrip smoke only covered the model-space block-instance artifact;
- it did not exercise the editor command path against a mixed paper-space case containing:
  - a leader-derived proxy group,
  - a paper-space note text entity,
  - an exploded insert group,
  - viewport/layout metadata.

New real sample and contract:
- source DXF:
  - `tests/plugin_data/step186_paperspace_insert_leader_sample.dxf`
- importer regression:
  - `tests/tools/test_dxf_paperspace_insert_leader.cpp`
- richer editor-path smoke:
  - `cmake/RunEditorAssemblyRoundtripPaperspace.cmake`
  - `editor_assembly_roundtrip_paperspace_smoke` in root `CMakeLists.txt`
- expected import-side shape:
  - `derived_proxy_count = 1`
  - `exploded_origin_count = 2`
  - `assembly_tracked_count = 4`
  - `assembly_group_count = 2`
- expected provenance fields in the converted source document:
  - leader proxy:
    - `source_type = LEADER`
    - `edit_mode = proxy`
    - `proxy_kind = leader`
    - `layout = LayoutStyle`
    - `space = 1`
    - `group_id = 1`
  - exploded insert fragments:
    - `source_type = INSERT`
    - `edit_mode = exploded`
    - `proxy_kind = insert`
    - `block_name = PaperStyledBlock`
    - `layout = LayoutStyle`
    - `space = 1`
    - `group_id = 2`

Real bug found by the richer smoke:
- `selection.offset` did not honor `isReadOnlyEntity(entity)`;
- `move/copy/delete/rotate/propertyPatch` already rejected or skipped read-only proxies, but `offset` still tried to create geometry from them;
- on the paper-space leader sample this allowed `offset-polyline` to succeed on a `LEADER/proxy` entity, which then polluted the roundtrip result and caused:
  - `assembly_roundtrip_semantics.ok = false`
  - `group_drift_count = 1`.

Design change:
- `runOffsetSelection()` in `tools/web_viewer/commands/command_registry.js` now follows the same contract style as other edit commands:
  - all selected entities read-only:
    - return `ok=false`
    - `error_code = UNSUPPORTED_READ_ONLY`
    - `message = Selected entities are read-only proxies`
  - mixed selection:
    - offset only editable entities
    - skip read-only entities
    - report the skip count in the success message
- new command-level regression coverage in `tools/web_viewer/tests/editor_commands.test.js`:
  - `selection.offset rejects derived proxy entity by editMode`
  - `selection.offset skips read-only proxy in mixed selection`

Smoke-script design correction:
- `RunEditorAssemblyRoundtripPaperspace.cmake` originally looked for per-entity provenance strings inside the roundtrip summary JSON;
- that was the wrong layer: the summary contract carries semantic counts and pass/fail results, not full entity payloads;
- the script now validates:
  - summary JSON for semantic outcomes:
    - `derived_proxy_semantics`
    - `exploded_origin_editability`
    - `assembly_roundtrip_semantics`
    - zero drift counts
  - source converted `document.json` for concrete provenance fields:
    - `source_type`
    - `proxy_kind`
    - `block_name`
    - `layout`
    - `space`
    - `group_id`

Why this matters:
- it closes a real editor-path contract hole, not a synthetic test gap;
- it proves the Step186 provenance/assembly contract survives an actual paper-space mix of:
  - proxy group,
  - exploded insert group,
  - text edit,
  - editable geometry edits;
- it raises the assembly roundtrip lane from “grouped model-space fragments survive” to “mixed paper-space proxy + insert groups survive without accidental edits”.

### Incremental extension: created-entity provenance stripping + dense mixed assembly smoke

Reference-driven gap addressed in this increment:
- the paper-space smoke proved read-only proxies could not be edited directly;
- it still left a denser assembly problem uncovered:
  - editable grouped entities created from imported geometry could spawn new entities through `copy`/`offset`,
  - and those new entities inherited imported assembly provenance.

Real mixed sample used to expose the issue:
- source DXF:
  - `tests/plugin_data/step186_mixed_origin_sample.dxf`
- existing Step186 artifact:
  - `build/step186_origin_mixed/document.json`
- grouped import shape:
  - `derived_proxy_count = 9`
  - `exploded_origin_count = 2`
  - `assembly_tracked_count = 14`
  - `assembly_group_count = 5`
- representative grouped entities:
  - paper-space layout cluster:
    - `group_id = 1`
    - `space = 1`
    - `layout = LayoutMixed`
  - exploded insert cluster:
    - `group_id = 2`
    - `source_type = INSERT`
    - `edit_mode = exploded`
    - `proxy_kind = insert`
    - `block_name = BlockMixed`
  - dimension proxy clusters:
    - `group_id = 3/4/5`
    - `source_type = DIMENSION`
    - `edit_mode = proxy`
    - `proxy_kind = dimension`
    - `dim_style = Standard`

Second real bug found by the denser mixed smoke:
- `selection.offset` and `selection.copy` created new entities by cloning the source entity;
- when the source entity carried imported assembly provenance, the new entity incorrectly kept:
  - `groupId`
  - `sourceType`
  - `editMode`
  - `proxyKind`
  - `blockName`
  - dimension/hatch provenance fields
- on the mixed sample, offsetting a grouped editable line in `group_id = 1` created a new line that also belonged to `group_id = 1`;
- this polluted the original imported group and caused `assembly_roundtrip_semantics` to drift even though the original source members were still present.

Design change:
- new helper in `tools/web_viewer/commands/command_registry.js`:
  - `stripImportedProvenanceForCreatedEntity(entity)`
- applied to created entities in:
  - `selection.copy`
  - `selection.offset`
- preserved on created entities:
  - normal geometric/document placement fields such as:
    - `layerId`
    - `space`
    - `layout`
    - line style/color payload
- stripped on created entities:
  - `groupId`
  - `sourceType`
  - `editMode`
  - `proxyKind`
  - `blockName`
  - `hatchId`
  - `hatchPattern`
  - `dimType`
  - `dimStyle`
  - `dimTextPos`
  - `dimTextRotation`

Command-level regression additions:
- `tools/web_viewer/tests/editor_commands.test.js`
  - `selection.copy clears imported assembly provenance on created entity`
  - `selection.offset clears imported assembly provenance on created entity`
- these tests intentionally keep `space/layout` while clearing imported provenance, because new user-created geometry should stay in the same paper/model context but no longer claim membership in the original imported assembly group.

New dense mixed editor-path smoke:
- `cmake/RunEditorAssemblyRoundtripMixed.cmake`
- `editor_assembly_roundtrip_mixed_smoke` in root `CMakeLists.txt`
- this smoke validates:
  - summary semantic counts for the mixed artifact:
    - `derived_proxy_semantics`
    - `exploded_origin_editability`
    - `assembly_roundtrip_semantics`
    - `derived_proxy_count = 9`
    - `exploded_origin_count = 2`
    - `assembly_tracked_count = 14`
    - `assembly_group_count = 5`
  - source converted `document.json` for representative mixed provenance:
    - `source_type = HATCH`
    - `proxy_kind = hatch`
    - `source_type = DIMENSION`
    - `proxy_kind = dimension`
    - `dim_style = Standard`
    - `source_type = INSERT`
    - `block_name = BlockMixed`
    - `layout = LayoutMixed`
    - `space = 1`
    - `group_id = 3`
    - `group_id = 5`

Why this matters:
- it closes the second real assembly/editor contract hole found by richer Step186 samples;
- it makes a clear semantic distinction between:
  - editing an imported entity in place: provenance stays
  - creating a new entity from imported geometry: provenance is detached
- it upgrades the assembly roundtrip lane from simple model-space + one paper-space sample to a denser mixed proxy/insert/layout document.

### Incremental extension: assembly roundtrip CTest lane propagation through local/gate/weekly

Reference-driven gap addressed in this increment:
- the assembly/instance roundtrip contract was already real at the editor-path level:
  - model-space block instances,
  - paper-space proxy + insert groups,
  - dense mixed proxy/insert/layout samples;
- but visibility still stopped at targeted `ctest` output and ad hoc manual summaries;
- higher-level automation layers (`local_ci`, `editor_gate`, weekly summary, dashboard/report/checker) did not yet expose that assembly roundtrip contract as a first-class machine-readable lane.

Design change:
- `tools/local_ci.sh` now treats the three editor assembly CTests as one aggregate lane:
  - `editor_assembly_roundtrip_smoke`
  - `editor_assembly_roundtrip_paperspace_smoke`
  - `editor_assembly_roundtrip_mixed_smoke`
- `local_ci` writes flat summary fields for that lane:
  - `ctestAssemblyRoundtripStatus`
  - `ctestAssemblyRoundtripCaseCount`
  - `ctestAssemblyRoundtripPassCount`
  - `ctestAssemblyRoundtripFailCount`
  - `ctestAssemblyRoundtripMissingCount`
  - `ctestAssemblyRoundtripFirstFailedCase`
  - `ctestAssemblyRoundtripModelStatus`
  - `ctestAssemblyRoundtripPaperspaceStatus`
  - `ctestAssemblyRoundtripMixedStatus`
- `tools/editor_gate.sh` now runs the same three CTests as a dedicated gate lane:
  - `assembly_roundtrip_ctest`
  - exported as an object in `editor_gate_summary.json`
  - with `enabled/status/build_dir/case_count/pass_count/fail_count/missing_count/first_failed_case/model_status/paperspace_status/mixed_status`
- `tools/editor_weekly_validation.sh` now lifts that gate object into weekly payloads as:
  - `gate_assembly_roundtrip_ctest`
- consumer layers were extended to display and validate it:
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

Two real pipeline hardening fixes were required to make this propagation reliable:
- `tools/local_ci.sh` now initializes preview provenance deterministic-entry counters to zero even when preview provenance smoke is disabled;
  - without that initialization, `local_ci_summary.json` generation could terminate with an `unbound variable` failure before the new assembly lane was written;
- `tools/write_ci_artifact_summary.py` now renders disabled gate-side preview provenance smoke as `SKIPPED` rather than `FAIL`;
  - this was a consumer bug caused by gate payloads exposing `enabled=false` and `ok=false` without a dedicated `status` field.

Why this matters:
- it promotes the assembly roundtrip contract from “targeted CTest coverage exists” to “gate/local/weekly automation surfaces it as a first-class health lane”;
- it gives the richer Step186 assembly samples the same operational visibility as preview provenance, preview artifact smoke, and validator failure injection;
- it closes a real automation robustness hole:
  - skipped preview lanes no longer break `local_ci` summary emission,
  - disabled preview lanes no longer pollute markdown consumers with false `FAIL` states;
- it raises the engineering bar beyond the original reference checklist by making the roundtrip contract both stricter and more observable.

### Incremental extension: aggregate assembly roundtrip metrics as first-class automation contract

Reference-driven gap addressed in this increment:
- `REFERENCE_COMPARISON_ACTIONS.md` Phase P2 explicitly called out:
  - `tests/core/test_constraints_basic.cpp`
  - `tests/core/test_assembly_roundtrip.cpp`
- the codebase already exceeded the literal `test_assembly_roundtrip.cpp` target by validating the editor-path roundtrip across:
  - model-space block instances,
  - paper-space insert + proxy groups,
  - dense mixed Step186 artifacts;
- but until this increment, higher-level automation only knew the lane was pass/fail; it did not expose the shape of the assembly contract itself.

Design change:
- `tools/read_editor_assembly_roundtrip_metrics.py` is now the single aggregation point for the three editor-path assembly smokes:
  - `build/editor_assembly_roundtrip_smoke`
  - `build/editor_assembly_roundtrip_paperspace_smoke`
  - `build/editor_assembly_roundtrip_mixed_smoke`
- it resolves the newest `summary.json` in each lane and emits stable aggregate counts:
  - `summary_json_count`
  - `import_entity_count`
  - `import_unsupported_count`
  - `import_derived_proxy_count`
  - `import_exploded_origin_count`
  - `import_assembly_tracked_count`
  - `import_assembly_group_count`
  - `export_derived_proxy_checked_count`
  - `export_exploded_checked_count`
  - `export_assembly_checked_count`
  - `export_assembly_group_count`
  - `export_metadata_drift_count`
  - `export_group_drift_count`
  - per-lane summary paths and case names for `model`, `paperspace`, and `mixed`
- `tools/local_ci.sh` now consumes those metrics and writes them into `local_ci_summary.json`.
- `tools/editor_gate.sh` now consumes the same metrics and lifts them into `assembly_roundtrip_ctest` in `editor_gate_summary.json`.
- `tools/editor_weekly_validation.sh` now forwards the enriched gate object into weekly payloads as `gate_assembly_roundtrip_ctest`.
- consumer/reporting layers now render and validate the same aggregate shape:
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

Design invariants:
- `summary_json_count` must match `case_count` whenever the lane is green and `missing_count = 0`.
- import-side counts are bounded by `import_entity_count`.
- export-side checked counts are bounded by the corresponding import-side tracked counts.
- drift counts are bounded by the corresponding checked counts.
- per-lane summary JSONs and case names are treated as contract artifacts, not optional debugging crumbs.

Operational hardening required for this propagation:
- both `tools/local_ci.sh` and `tools/editor_gate.sh` were using bash-4 uppercase expansion (`${name^^}`), which fails on the macOS bash 3.2 runtime actually used here;
  - that was replaced with `tr '[:lower:]' '[:upper:]'` so the new aggregate lane works on the real host shell, not only on newer CI shells.
- `tools/editor_gate.sh` now explicitly exports the new aggregate assembly variables before spawning the summary-writing Python process;
  - without that export, the lane could pass but still write zeros into `editor_gate_summary.json`.

Why this matters:
- this turns assembly roundtrip from a low-level smoke into a measurable product contract:
  - how many grouped entities were tracked,
  - how many exploded origins survived,
  - how many derived proxies were preserved,
  - whether export drift stayed at zero;
- it goes beyond the original reference checklist by operationalizing assembly semantics rather than stopping at “roundtrip exists”.

### Incremental extension: direct variable-focus exports for explainable solver diagnostics

Reference-driven gap addressed in this increment:
- Phase P2 also called for `DOF/rank checks (solvespace pattern)`.
- the solver already exceeded the minimal target with:
  - structural groups,
  - conflict groups,
  - redundancy subsets,
  - priority rankings,
  - explanation labels/tags/summaries;
- but consumers still had to inspect nested group objects to know which variables the chosen primary/smallest conflict or redundancy explanations actually referred to.

Design change:
- `core/include/core/solver.hpp` now exposes direct analysis-level variable-focus vectors:
  - `primaryConflictVariableKeys`
  - `primaryConflictFreeVariableKeys`
  - `smallestConflictVariableKeys`
  - `smallestConflictFreeVariableKeys`
  - `primaryRedundancyVariableKeys`
  - `smallestRedundancyVariableKeys`
- `core/src/solver.cpp` now fills those vectors directly from the selected ranked groups/subsets.
- `tools/solve_from_project.cpp` now emits them in both:
  - `analysis`
  - `structural_summary`

Design intent:
- UI and automation should be able to say:
  - “the primary conflict is about `p4.x/p5.x/p6.x`”
  - “the smallest witness is about `p0.x/p1.x`”
  without re-implementing solver selection logic in a downstream consumer.
- the direct vectors are derived views of already-ranked groups;
  - they do not change solver behavior,
  - they reduce consumer coupling,
  - they keep the explanation contract stable even if group internals grow later.

Why this matters:
- it pushes the solver past “machine-readable diagnostics exist” into “machine-readable diagnostics are directly consumable”.
- that is a stronger and more operationally useful result than the original Phase P2 wording.

### Incremental extension: dense assembly roundtrip lane and solver action-hint exports

Reference-driven gap addressed in this increment:
- `REFERENCE_COMPARISON_ACTIONS.md` Phase P2 still points at two practical directions rather than one-off tests:
  - make assembly/instance roundtrip observable across richer real samples,
  - keep moving solver diagnostics from raw structure toward consumer-ready guidance.
- previous increments already had:
  - model / paperspace / mixed editor-path assembly roundtrip CTests,
  - ranked conflict / redundancy diagnostics with tags, summaries, policies, and variable focus;
- the remaining gap was:
  - the dense mixed assembly path was not yet a first-class high-level lane,
  - solver consumers still had to translate ranking output into action language on their own.

Design change: dense assembly lane
- a new CTest lane, `editor_assembly_roundtrip_dense_smoke`, was added to validate a richer two-case bundle:
  - `assembly_dense_mixed_origin`
  - `assembly_dense_paperspace_insert_leader`
- the dense lane intentionally combines:
  - mixed model/paper-space insert + hatch + dimension provenance,
  - paper-space insert + leader proxy semantics,
  into one higher-density editor-path roundtrip contract.
- `tools/read_editor_assembly_roundtrip_metrics.py` was extended so lane aggregation is no longer “one summary per lane”:
  - it now understands four lanes:
    - `model`
    - `paperspace`
    - `mixed`
    - `dense`
  - and it aggregates every `results[]` entry inside each lane summary rather than assuming a single case.
- aggregate assembly metrics therefore become a stable contract across four summaries:
  - `summary_json_count`
  - `import_entity_count`
  - `import_unsupported_count`
  - `import_derived_proxy_count`
  - `import_exploded_origin_count`
  - `import_assembly_tracked_count`
  - `import_assembly_group_count`
  - `export_derived_proxy_checked_count`
  - `export_exploded_checked_count`
  - `export_assembly_checked_count`
  - `export_assembly_group_count`
  - `export_metadata_drift_count`
  - `export_group_drift_count`
  - per-lane summary JSONs and case names for `model`, `paperspace`, `mixed`, and `dense`
- the dense lane and its metrics are now propagated all the way through:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

Design invariants for the dense lane:
- `case_count = 4` and `summary_json_count = 4` when the full assembly bundle is green.
- `dense_status` must be reported separately from `model/paperspace/mixed`; it is not inferred.
- dense lane counts participate in the same aggregate totals as the other three lanes.
- `metadata_drift_count = 0` and `group_drift_count = 0` remain the hard acceptance criteria for the aggregate lane.

Design change: solver action-hint exports
- `ConstraintAnalysis` now exports stable action-hint strings at analysis level:
  - `primaryConflictActionHint`
  - `smallestConflictActionHint`
  - `primaryRedundancyActionHint`
  - `smallestRedundancyActionHint`
- `tools/solve_from_project.cpp` emits these in both:
  - `analysis`
  - `structural_summary`
- these hints are derived from already-ranked conflict groups and redundancy subsets; they do not change solving behavior.
- the purpose is to eliminate downstream guesswork:
  - consumers no longer need to synthesize “what should the user do next?” from tags + scores + summaries.

Design intent:
- preview/assembly automation should surface richer editor-path provenance as a first-class product lane, not only a test implementation detail.
- solver automation should expose not just:
  - what ranked first,
  - why it ranked first,
  but also:
  - what the next corrective action is likely to be.

Why this matters:
- the dense lane raises the bar above the original reference checklist because it validates a richer, more failure-prone editor-path bundle instead of a thin per-sample smoke.
- the action-hint export raises solver diagnostics above “explainable ranking” into “directly actionable ranking”.

### Incremental extension: dense styles bundle, action labels, and fresh consumer convergence

Reference-driven gap addressed in this increment:
- Phase P2 still has two practical pressures:
  - keep enriching the real assembly/instance roundtrip bundle rather than freezing it at the first dense lane,
  - keep reducing downstream solver interpretation work so UI/reporting code does not need to reconstruct next-step guidance.
- the previous increment already had:
  - a four-lane aggregate assembly contract (`model`, `paperspace`, `mixed`, `dense`),
  - analysis-level solver action hints;
- the remaining gaps were:
  - the dense lane still only covered two dense subcases,
  - consumers that wanted short button-like wording still had to derive it from longer action hints,
  - the docs still reflected the older aggregate totals before the richer dense bundle landed.

Design change: dense lane expanded with a styles-rich third subcase
- `editor_assembly_roundtrip_dense_smoke` now validates a three-case dense sub-bundle:
  - `assembly_dense_mixed_origin`
  - `assembly_dense_paperspace_insert_leader`
  - `assembly_dense_paperspace_insert_styles`
- the aggregate assembly contract still reports four top-level lanes:
  - `model`
  - `paperspace`
  - `mixed`
  - `dense`
- but the dense lane now intentionally carries a richer paper-space insert style scenario, so the fresh aggregate totals move to:
  - `summary_json_count = 4`
  - `import_entity_count = 60`
  - `import_derived_proxy_count = 20`
  - `import_exploded_origin_count = 22`
  - `import_assembly_tracked_count = 52`
  - `import_assembly_group_count = 28`
  - `export_assembly_checked_count = 52`
  - `export_assembly_group_count = 28`
  - `export_metadata_drift_count = 0`
  - `export_group_drift_count = 0`

Design invariants for the refreshed dense bundle:
- aggregate lane contract remains:
  - `case_count = 4`
  - `summary_json_count = 4`
  - `dense_status` reported independently
- dense sub-bundle contract is now:
  - three real editor-path cases under the dense lane case-name string
  - no metadata drift
  - no group drift
- local, gate, weekly, dashboard, and report consumers must all converge on the same aggregate totals above.

Design change: solver action labels
- `ConstraintAnalysis` now exports stable short action labels in addition to detailed hints:
  - `primaryConflictActionLabel`
  - `smallestConflictActionLabel`
  - `primaryRedundancyActionLabel`
  - `smallestRedundancyActionLabel`
- `tools/solve_from_project.cpp` emits them in both:
  - `analysis`
  - `structural_summary`
- current contract values are intentionally concise and UI-safe:
  - `Relax primary conflict`
  - `Inspect smallest conflict witness`
  - `Suppress primary redundancy`
  - `Trim smallest redundancy witness`

Design intent:
- action hints stay as longer operator guidance;
- action labels become the short, stable surface for buttons, badges, or inspector rows;
- downstream consumers should not need to collapse hint text into a shorter label themselves.

Why this matters:
- the dense lane is no longer just “present”; it now covers a denser real paper-space insert style bundle and establishes fresh aggregate totals across the full automation stack.
- solver diagnostics now export both:
  - detailed next-step guidance (`action_hint`)
  - short UI-ready labels (`action_label`)
- this pushes the implementation beyond the original reference checklist by making both assembly and solver contracts more operational for product consumers rather than only for tests.

### Incremental extension: dense triad subcase and solver action-panel exports

Reference-driven gap addressed in this increment:
- after the previous dense/action-label increment, two remaining gaps were still practical:
  - the dense assembly lane still topped out at three dense subcases and did not include a compact pure-model insert-group sample,
  - downstream consumers still had to stitch together `action_label`, `action_hint`, `selection_policy`, `summary`, and variable focus fields into a usable action card.
- the next step to exceed the reference target was therefore:
  - enrich the dense assembly lane with one more real grouped insert sample,
  - export solver diagnostics as pre-assembled action-panel objects instead of scattered fields.

Design change: dense lane expanded with `insert_triad`
- `editor_assembly_roundtrip_dense_smoke` now validates a four-case dense sub-bundle:
  - `assembly_dense_insert_triad`
  - `assembly_dense_mixed_origin`
  - `assembly_dense_paperspace_insert_leader`
  - `assembly_dense_paperspace_insert_styles`
- the top-level aggregate lane contract remains unchanged:
  - `model`
  - `paperspace`
  - `mixed`
  - `dense`
- but the dense lane itself now intentionally mixes:
  - model-space grouped insert fragments,
  - paper-space insert + leader proxy semantics,
  - paper-space insert + style inheritance semantics,
  - mixed proxy/editable grouped semantics.

Fresh aggregate totals with the triad subcase:
- `summary_json_count = 4`
- `import_entity_count = 63`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 20`
- `import_exploded_origin_count = 25`
- `import_assembly_tracked_count = 55`
- `import_assembly_group_count = 29`
- `export_derived_proxy_checked_count = 20`
- `export_exploded_checked_count = 25`
- `export_assembly_checked_count = 55`
- `export_assembly_group_count = 29`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`

Dense-lane design invariants after the triad addition:
- aggregate contract remains:
  - `case_count = 4`
  - `summary_json_count = 4`
  - `dense_status` tracked independently
- dense-lane inner contract now means:
  - four real editor-path subcases under the dense case-name string,
  - no metadata drift,
  - no group drift,
  - grouped insert provenance remains isolated from created entities after edit commands.

Design change: solver action-panel objects
- `tools/solve_from_project.cpp` now exports four pre-assembled action objects in both:
  - `analysis`
  - `structural_summary`
- exported objects:
  - `primary_conflict_action`
  - `smallest_conflict_action`
  - `primary_redundancy_action`
  - `smallest_redundancy_action`

Each action-panel object carries:
- `label`
- `hint`
- `tag`
- `summary`
- `selection_explanation`
- `anchor_constraint_index`
- `priority_score`
- `variable_keys`
- `free_variable_keys`
- `selection_policy`

Current contract intent:
- `label` is the short UI-safe surface;
- `hint` is the operator-facing next-step guidance;
- `tag` is the stable machine-readable discriminator;
- `summary` carries the compact ranked witness description;
- `variable_keys` and `free_variable_keys` eliminate the need for consumers to walk back into nested groups;
- `selection_policy` exposes the ranking rule so the action card is not a black box.

Why this matters:
- the dense assembly lane is now thick enough to act like a realistic grouped-editor bundle instead of a thin smoke wrapper;
- the solver side no longer asks UI/reporting code to synthesize an action card from low-level fields;
- together these changes push the implementation further beyond the original reference checklist by making both assembly and solver outputs directly consumable at product level rather than only test level.

### Incremental extension: dense paper-space dimension sample and solver `action_panels[]`

Reference-driven gap addressed in this increment:
- after the previous dense/action-panel increment, two practical gaps still remained:
  - the dense assembly lane still lacked a real paper-space sample that combined viewport, exploded insert fragments, plain text, `MTEXT`, and `DIMENSION` proxy geometry in one editor-path bundle,
  - solver consumers still had to read four separate action objects instead of a single ordered action-panel list.
- the next step to exceed the reference target was therefore:
  - add one more real Step186 paper-space bundle to the dense lane,
  - promote the scattered solver action objects into a first-class `action_panels[]` contract in both `analysis` and `structural_summary`.

Design change: dense lane expanded with `paperspace_insert_dimension`
- `editor_assembly_roundtrip_dense_smoke` now validates a five-case dense sub-bundle:
  - `assembly_dense_insert_triad`
  - `assembly_dense_mixed_origin`
  - `assembly_dense_paperspace_insert_dimension`
  - `assembly_dense_paperspace_insert_leader`
  - `assembly_dense_paperspace_insert_styles`
- the top-level aggregate lane contract remains unchanged:
  - `model`
  - `paperspace`
  - `mixed`
  - `dense`
- but the dense lane itself now intentionally mixes:
  - model-space grouped insert fragments,
  - paper-space insert + leader proxy semantics,
  - paper-space insert + style inheritance semantics,
  - paper-space insert + dimension proxy semantics,
  - mixed proxy/editable grouped semantics.

New sample contract: `step186_paperspace_insert_dimension_sample.dxf`
- source path:
  - `tests/plugin_data/step186_paperspace_insert_dimension_sample.dxf`
- output path under Step186 prep:
  - `build/step186_paperspace_insert_dimension`
- intended import semantics:
  - default paper space (`default_space = 1`)
  - `LayoutStyle` paper-space layout
  - one viewport (`viewport_count = 1`)
  - one `LEADER` proxy
  - one exploded `INSERT` group from `PaperStyledBlock`
  - one plain `TEXT`
  - one `MTEXT`
  - one `DIMENSION` text/proxy bundle with `dim_style = Standard`
- the sample is deliberately built on top of the existing stable paper-space leader sample so that the dense lane grows by augmentation rather than by introducing a wholly synthetic importer path.

Fresh dense aggregate totals with the dimension subcase:
- `summary_json_count = 4`
- `import_entity_count = 75`
- `import_unsupported_count = 1`
- `import_derived_proxy_count = 27`
- `import_exploded_origin_count = 27`
- `import_assembly_tracked_count = 66`
- `import_assembly_group_count = 34`
- `export_derived_proxy_checked_count = 27`
- `export_exploded_checked_count = 27`
- `export_assembly_checked_count = 66`
- `export_assembly_group_count = 34`
- `export_metadata_drift_count = 0`
- `export_group_drift_count = 0`

Dense-lane design invariants after the dimension addition:
- aggregate contract remains:
  - `case_count = 4`
  - `summary_json_count = 4`
  - `dense_status` tracked independently
- dense-lane inner contract now means:
  - five real editor-path subcases under the dense case-name string,
  - no metadata drift,
  - no group drift,
  - grouped insert provenance remains isolated from created entities after edit commands,
  - paper-space grouped proxy semantics survive editor roundtrip in the same lane as exploded insert semantics.

Design change: solver `action_panels[]`
- `tools/solve_from_project.cpp` now exports an ordered `action_panels[]` array in both:
  - `analysis`
  - `structural_summary`
- companion counts are exported as:
  - `action_panel_count`
- current panel ids are:
  - `primary_conflict`
  - `smallest_conflict`
  - `primary_redundancy`
  - `smallest_redundancy`

Each action-panel item carries:
- `id`
- `category`
- `scope`
- `enabled`
- `constraint_indices`
- `basis_constraint_indices`
- `redundant_constraint_indices`
- `label`
- `hint`
- `tag`
- `summary`
- `selection_explanation`
- `anchor_constraint_index`
- `priority_score`
- `variable_keys`
- `free_variable_keys`
- `selection_policy`

Current contract intent:
- `label` is the short UI-safe surface;
- `hint` is the operator-facing next-step guidance;
- `tag` is the stable machine-readable discriminator;
- `summary` carries the compact ranked witness description;
- `constraint_indices` / `basis_constraint_indices` / `redundant_constraint_indices` expose the exact witness slice without forcing consumers to reverse-engineer nested group structures;
- `variable_keys` and `free_variable_keys` keep the variable-focus information adjacent to the action card;
- `selection_policy` exposes the ranking rule so the action card is not a black box.

Why this matters:
- the dense assembly lane is now thick enough to act like a realistic paper-space grouped-editor bundle instead of a thin smoke wrapper;
- solver consumers no longer need to stitch together separate `primary_*` / `smallest_*` fields into action cards;
- together these changes push the implementation beyond the original reference checklist by making both assembly and solver outputs directly consumable at product level rather than only at test level.

## Incremental extension: dense paper-space dimension+hatch lane and action-panel UI contract

This increment extends the dense Step186 editor-path lane with one more real paper-space sample:
- `tests/plugin_data/step186_paperspace_insert_dimension_hatch_sample.dxf`

The sample is intentionally built by augmenting the existing stable paper-space dimension sample instead of creating a wholly synthetic importer path. Its contract is:
- default space remains paper-space (`default_space = 1`)
- layout is `LayoutStyle`
- one viewport is present
- one `LEADER` proxy is preserved
- one `HATCH` proxy is preserved with `hatch_pattern = SOLID` and `hatch_id = 1`
- one exploded `INSERT` group from `PaperStyledBlock` is preserved
- one plain `TEXT`
- one `MTEXT`
- one `DIMENSION` text/proxy bundle with `dim_style = Standard`

Step186 prep and artifact-smoke now include:
- `paperspace_insert_dimension_hatch`

The dense assembly lane now contains six real editor-path subcases:
- `assembly_dense_insert_triad`
- `assembly_dense_mixed_origin`
- `assembly_dense_paperspace_insert_dimension`
- `assembly_dense_paperspace_insert_dimension_hatch`
- `assembly_dense_paperspace_insert_leader`
- `assembly_dense_paperspace_insert_styles`

The top-level assembly aggregate lane remains a four-lane contract:
- `model`
- `paperspace`
- `mixed`
- `dense`

Fresh dense aggregate totals after the dimension+hatch addition are:
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

Design intent of the dense aggregate after this expansion:
- paper-space grouped proxy semantics and exploded insert semantics are validated inside the same editor-path lane
- each added dense subcase increases grouped/proxy coverage without weakening the zero-drift contract
- dense aggregate numbers are propagated upward to `local_ci`, `editor_gate`, weekly summary, dashboard, weekly report, and weekly checker

This increment also upgrades solver JSON from a flat explainable diagnostic surface to a directly consumable UI contract. `solve_from_project --json` now exports action panels with nested UI metadata under:
- `analysis.action_panels[]`
- `structural_summary.action_panels[]`

Each action-panel item now carries:
- `id`
- `category`
- `scope`
- `enabled`
- `constraint_indices`
- `basis_constraint_indices`
- `redundant_constraint_indices`
- `label`
- `hint`
- `tag`
- `summary`
- `selection_explanation`
- `anchor_constraint_index`
- `priority_score`
- `variable_keys`
- `free_variable_keys`
- `selection_policy`
- `ui.title`
- `ui.subtitle`
- `ui.description`
- `ui.badge_label`
- `ui.severity`
- `ui.cta_label`
- `ui.recommended`
- `ui.display_order`

Current UI-facing action panel mapping is:
- `primary_conflict`
  - `ui.title = "Relax primary conflict"`
  - `ui.badge_label = "Conflict"`
  - `ui.severity = "warning"`
  - `ui.recommended = true`
  - `ui.display_order = 0`
- `smallest_conflict`
  - `ui.title = "Inspect smallest conflict witness"`
  - `ui.badge_label = "Conflict"`
  - `ui.severity = "notice"`
  - `ui.recommended = false`
  - `ui.display_order = 1`
- `primary_redundancy`
  - `ui.title = "Suppress primary redundancy"`
  - `ui.badge_label = "Redundancy"`
  - `ui.severity = "info"`
  - `ui.recommended = true`
  - `ui.display_order = 2`
- `smallest_redundancy`
  - `ui.title = "Trim smallest redundancy witness"`
  - `ui.badge_label = "Redundancy"`
  - `ui.severity = "notice"`
  - `ui.recommended = false`
  - `ui.display_order = 3`

Why this matters:
- the dense Step186 lane now covers `viewport + insert + text + mtext + leader proxy + dimension proxy + hatch proxy` in the same paper-space editor path
- assembly metrics are no longer trapped in CTest-only output and now function as a persistent contract surface
- solver consumers no longer need to synthesize action cards from scattered fields; the JSON already contains an ordered, typed action-panel model

## Incremental extension: annotation bundle dense lane and direct solver action-panel consumer

This increment raises two product-level contracts at the same time:
- the dense assembly lane gains a richer real paper-space annotation bundle instead of another synthetic one-off sample;
- the existing solver `action_panels[]` JSON becomes directly consumable by the web editor, so downstream UI no longer has to reconstruct cards from raw analysis fields.

Design change: dense lane expanded with `paperspace_annotation_bundle`
- new real sample:
  - `tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf`
- new importer regression:
  - `tests/tools/test_dxf_paperspace_annotation_bundle.cpp`
- new Step186 prep case:
  - `paperspace_annotation_bundle`
- new dense assembly subcase:
  - `assembly_dense_paperspace_annotation_bundle`

The annotation-bundle sample is intentionally built as a dense paper-space grouped bundle. Its contract is:
- `default_space = 1`
- `layout = LayoutStyle`
- one viewport is preserved
- one exploded `INSERT` group from `PaperStyledBlock` is preserved
- one `LEADER` proxy is preserved with `source_type = LEADER`, `proxy_kind = leader`
- one `HATCH` proxy is preserved with `source_type = HATCH`, `proxy_kind = hatch`, `hatch_pattern = SOLID`
- one `DIMENSION` proxy/text bundle is preserved with `source_type = DIMENSION`, `proxy_kind = dimension`, `dim_style = Standard`
- one plain `TEXT`
- one `MTEXT`
- grouped editor metadata remains stable through the editor roundtrip path

The dense assembly lane now intentionally contains seven real editor-path subcases:
- `assembly_dense_insert_triad`
- `assembly_dense_mixed_origin`
- `assembly_dense_paperspace_annotation_bundle`
- `assembly_dense_paperspace_insert_dimension`
- `assembly_dense_paperspace_insert_dimension_hatch`
- `assembly_dense_paperspace_insert_leader`
- `assembly_dense_paperspace_insert_styles`

Fresh aggregate totals after the annotation-bundle addition move to:
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

Design change: direct solver action-panel consumer in the web editor
- new consumer module:
  - `tools/web_viewer/ui/solver_action_panel.js`
- integration points:
  - `tools/web_viewer/ui/workspace.js`
  - `tools/web_viewer/index.html`
  - `tools/web_viewer/style.css`

Consumer contract:
- the editor reads `analysis.action_panels[]` first and falls back to `structural_summary.action_panels[]`
- each card is normalized into a stable UI model with:
  - `id`, `category`, `scope`, `enabled`
  - `label`, `hint`, `tag`, `summary`, `selectionExplanation`
  - `anchorConstraintIndex`, `priorityScore`
  - `constraintIndices`, `basisConstraintIndices`, `redundantConstraintIndices`
  - `variableKeys`, `freeVariableKeys`, `selectionPolicy`
  - `ui.title`, `ui.subtitle`, `ui.description`, `ui.badgeLabel`, `ui.severity`, `ui.ctaLabel`, `ui.recommended`, `ui.displayOrder`
- disabled or partial slots still render predictably because title fallback is:
  - `ui.title || label || id`

Editor-level debug and consumption contract:
- `workspace.js` mounts a dedicated `#cad-solver-actions` panel in editor mode
- `?solver=...` / `?solver_json=...` can load a solver JSON payload into the panel
- `window.__cadDebug` exposes:
  - `getSolverDiagnostics()`
  - `getSolverActionPanels()`
  - `setSolverDiagnostics(payload)`
  - `clearSolverDiagnostics()`

Consumption note:
- when serving the repo over a local HTTP root, `solver_json` must be passed as a root-relative path such as `/build/solver_action_panel/solver_ui.json`; a path relative to `/tools/web_viewer/` resolves incorrectly and will 404.

Why this matters:
- the dense assembly lane is no longer just a paper-space dimension/leader/style bundle; it now carries a denser real annotation bundle with grouped insert, text, leader, hatch, and dimension semantics in one editor-path case
- the aggregate assembly contract has moved from `80 tracked / 39 groups` to `100 tracked / 45 groups` without introducing drift
- solver explainability has crossed from “exported by CLI” to “directly consumed by the editor”, which is a stronger product contract than the original reference checklist required

## Incremental extension: annotation-bundle provenance focus and interactive solver action panel

This increment tightens two product-facing contracts:
- the default preview provenance matrix gains a real paper-space annotation-bundle group-focus case;
- the direct solver action-panel consumer becomes interactive instead of read-only.

Design change: annotation-bundle provenance focus case
- new default preview provenance case:
  - `paperspace_annotation_bundle_dimension_group_focus`
- target artifact:
  - `build/step186_paperspace_annotation_bundle/manifest.json`
- deterministic entry contract:
  - `initialEntityId = 14`
  - `initialNavKind = initial-entity`
- initial selection contract:
  - `Entity ID = 14`
  - `Group ID = 3`
  - `Origin = DIMENSION/dimension | proxy`
  - `Block Name = *D1`
  - `Dim Style = Standard`
  - `Layout = LayoutStyle`
- focus contract:
  - clicking `Group ID = 3` must yield:
    - `navKind = group`
    - `targetType = group`
    - `groupMemberIds = [14, 15, 16, 17]`
    - a different `cameraAfter.target` than the initial entity focus

This case matters because it anchors group focus on a visible paper-space dimension proxy instead of a sparse geometric hit. That makes the preview contract closer to the actual annotation-review path than the earlier insert-only group cases.

Design change: interactive solver action panel
- new smoke runner:
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
- `tools/web_viewer/ui/solver_action_panel.js` now supports:
  - `onAction`
  - `getState()`
  - `invoke(panelId)`
  - `clearActiveAction()`
- the mounted editor panel now guarantees:
  - CTA button per card
  - active-card state
  - active CTA state
  - status-message update after invocation
  - event emission via `cad:solver-action`

Debug and automation contract:
- `workspace.js` exposes, in debug mode:
  - `window.__cadDebug.getSolverActionState()`
  - `window.__cadDebug.invokeSolverActionPanel(id)`
  - `window.__cadDebug.clearSolverActionSelection()`
- the returned state includes:
  - `activePanelId`
  - `lastInvokedPanelId`
  - `invocationCount`
  - `activePanel`
  - `lastInvokedPanel`
  - `availablePanelIds`

UI-consumer contract:
- the editor still reads `analysis.action_panels[]` first and falls back to `structural_summary.action_panels[]`;
- each card remains fully typed and ordered, but is now also directly invocable in product UI:
  - `ui.title`
  - `ui.subtitle`
  - `ui.description`
  - `ui.badgeLabel`
  - `ui.severity`
  - `ui.ctaLabel`
  - `ui.recommended`
  - `ui.displayOrder`

Operational impact:
- the default preview provenance matrix now contains `18` deterministic-entry real cases, including `6` focus-check cases;
- the fresh local/gate/weekly summaries converge on the same Step186 totals:
  - `step186 prep = 16/16`
  - `preview provenance = 18/18`
  - `deterministic entry = 18/18`
  - `focus checks = 6`
  - `artifact smoke = 16/16`
  - `validator failure injection = 10/10`
  - `assembly roundtrip ctest = 4/4`
- solver explainability has crossed one more boundary: downstream UI no longer just renders ranked advice, it can now expose and track user interaction against that advice.

## Incremental extension: dense multi-layout lane and solver chip-focus action flow

Design change: dense multi-layout assembly lane
- the existing real sample `tests/plugin_data/step186_multi_layout_sample.dxf` now participates in the dense editor-path roundtrip lane as:
  - `assembly_dense_multi_layout`
- target lane:
  - `editor_assembly_roundtrip_dense_smoke`
- target contract for this subcase:
  - `entity_count = 4`
  - `assembly_tracked_count = 1`
  - `assembly_group_count = 1`
  - `derived_proxy_count = 0`
  - `exploded_origin_count = 0`
  - `checked_count = 1`
  - `metadata_drift_count = 0`
  - `group_drift_count = 0`
- source-level invariants:
  - at least one entity with `layout = LayoutA`
  - at least one entity with `layout = LayoutB`
  - at least one entity with `space = 1`
  - grouped paper-space text anchored by `group_id = 1`
  - stable visible text payload `value = LAYOUT B NOTE`

Dense lane composition now becomes:
- `assembly_dense_insert_triad`
- `assembly_dense_mixed_origin`
- `assembly_dense_multi_layout`
- `assembly_dense_paperspace_annotation_bundle`
- `assembly_dense_paperspace_insert_dimension`
- `assembly_dense_paperspace_insert_dimension_hatch`
- `assembly_dense_paperspace_insert_leader`
- `assembly_dense_paperspace_insert_styles`

Operational effect:
- the dense lane stops being "paperspace-heavy but single-layout" and now exercises a real multi-layout paper-space roundtrip path through the editor;
- fresh high-level aggregate totals move to:
  - `tracked = 101`
  - `groups = 46`
  - `proxies = 44`
  - `exploded = 33`
  - `checked = 101`
  - `drift = 0/0`

Design change: solver chip-focus action flow
- `tools/web_viewer/ui/solver_action_panel.js` now treats solver chips as first-class action targets instead of passive labels.
- new focus state contract:
  - `activeFocus.panelId`
  - `activeFocus.kind`
  - `activeFocus.value`
- new panel methods:
  - `invokeFocus(panelId, kind, value)`
  - `clearActiveFocus()`
- state transition rules:
  - clicking a panel CTA activates that panel and clears any earlier chip focus;
  - clicking an actionable chip inside the active panel sets `activeFocus`;
  - switching to another panel clears the previous `activeFocus`;
  - the focus summary is rendered at the panel root through `.cad-solver-panel__focus`

Debug and automation contract:
- `workspace.js` exposes, in debug mode:
  - `window.__cadDebug.getSolverActionState()`
  - `window.__cadDebug.invokeSolverActionPanel(id)`
  - `window.__cadDebug.invokeSolverActionFocus(panelId, kind, value)`
  - `window.__cadDebug.clearSolverActionFocus()`
  - `window.__cadDebug.clearSolverActionSelection()`
- returned state now includes:
  - `activePanelId`
  - `lastInvokedPanelId`
  - `invocationCount`
  - `activeFocus`
  - `activePanel`
  - `lastInvokedPanel`
  - `availablePanelIds`

UI-consumer contract:
- the editor continues to read `analysis.action_panels[]` first and `structural_summary.action_panels[]` as fallback;
- each action panel remains fully typed and ordered, but now also supports chip-level focus interaction against:
  - `constraint`
  - `basis-constraint`
  - `redundant-constraint`
  - `variable`
  - `free-variable`

Operational impact:
- the action-panel consumer has crossed from "click card to show summary" into "click card, then click variable or constraint chip to focus the suggested next object";
- fresh local, gate, and weekly summaries now converge on the same dense aggregate and preview-contract totals:
  - `step186 prep = 16/16`
  - `preview provenance = 18/18`
  - `deterministic entry = 18/18`
  - `focus checks = 6`
  - `artifact smoke = 16/16`
  - `validator failure injection = 10/10`
  - `assembly roundtrip ctest = 4/4`

Design change: solver action-flow lane propagation
- `solver_action_panel_smoke` is now treated as a first-class high-level lane rather than a local/manual browser-only smoke.
- the lane contract is stable across local, gate, and weekly summaries:
  - `enabled`
  - `mode`
  - `run_id`
  - `summary_json`
  - `ok`
  - `exit_code`
  - `panel_count`
  - `flow_check_count`
  - `visited_panel_count`
- propagation path:
  - producer:
    - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - local summary:
    - `tools/local_ci.sh`
  - gate summary:
    - `tools/editor_gate.sh`
  - weekly summary:
    - `tools/editor_weekly_validation.sh`
  - human-readable consumers:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
  - contract checker:
    - `tools/check_weekly_summary.sh`

Fresh propagated contract:
- local summary must expose:
  - `solverActionPanelSmokeStatus`
  - `solverActionPanelSmokeRunId`
  - `solverActionPanelSmokeSummaryJson`
  - `solverActionPanelSmokePanelCount`
  - `solverActionPanelSmokeFlowCheckCount`
  - `solverActionPanelSmokeVisitedPanelCount`
- gate and weekly summaries must expose:
  - `solver_action_panel_smoke`
  - `gate_solver_action_panel_smoke`
  with the same normalized counts and a valid `summary_json`
- dashboard and weekly report must render:
  - `panels=...`
  - `flow_checks=...`
  - `visited_panels=...`

Design fix: summary consumer disabled-lane handling
- `write_ci_artifact_summary.py` now short-circuits solver-lane rendering when:
  - `enabled=false`
  - no `run_id`
  - no `summary_json`
- this prevents disabled lanes from being misrendered as `FAIL`.

Design fix: gate export contract
- `tools/editor_gate.sh` now exports the solver lane metrics before invoking the Python summary writer.
- without that export boundary, the gate run could execute the lane successfully but still serialize zero/empty values in `editor_gate_summary.json`.

Fresh operating totals after propagation:
- preview contract:
  - `preview provenance = 18/18`
  - `deterministic entry = 18/18`
  - `focus checks = 6`
- assembly contract:
  - `assembly roundtrip ctest = 4/4`
  - `tracked = 101`
  - `groups = 46`
  - `proxies = 44`
  - `exploded = 33`
  - `drift = 0/0`
- solver action-flow contract:
  - `panel_count = 4`
  - `flow_check_count = 4`
  - `visited_panel_count = 2`

Design delta: solver action-flow full contract
- `solver_action_panel_smoke.js` no longer stops at a single CTA or a single `next` hop.
- the stable contract now validates two real flows:
  - `primary_conflict`: `cta -> next -> prev -> next -> restart`
  - `smallest_redundancy`: `cta -> next -> prev -> next -> restart`
- new run-level fields:
  - `next_check_count`
  - `rewind_check_count`
  - `restart_check_count`
  - `flow_action_history`
  - `after_primary_prev`
  - `after_primary_restart`
  - `after_smallest_redundancy_prev`
  - `after_smallest_redundancy_restart`
- stable expected totals for the current contract:
  - `panel_count = 4`
  - `flow_check_count = 10`
  - `next_check_count = 4`
  - `rewind_check_count = 2`
  - `restart_check_count = 2`
  - `visited_panel_count = 2`

Design delta: solver action-flow metric propagation
- the new action-flow counts are now propagated as first-class high-level metrics rather than remaining browser-smoke-only details.
- local summary fields:
  - `solverActionPanelSmokePanelCount`
  - `solverActionPanelSmokeFlowCheckCount`
  - `solverActionPanelSmokeNextCheckCount`
  - `solverActionPanelSmokeRewindCheckCount`
  - `solverActionPanelSmokeRestartCheckCount`
  - `solverActionPanelSmokeVisitedPanelCount`
- gate and weekly normalized lane fields:
  - `panel_count`
  - `flow_check_count`
  - `next_check_count`
  - `rewind_check_count`
  - `restart_check_count`
  - `visited_panel_count`
- consumer rendering now includes:
  - `panels=...`
  - `flow_checks=...`
  - `next=...`
  - `prev=...`
  - `restart=...`
  - `visited_panels=...`
- the propagation path now includes:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

Design fix: deterministic dense lane scope
- `step186_viewport_sample` remains in Step186 preview artifact prep and artifact smoke because it exercises `space/layout/viewports` contract fields.
- it is intentionally not added to dense editor assembly roundtrip aggregation:
  - it does not contribute meaningful assembly semantics such as `group_id`, `source_type`, `proxy_kind`, or `block_name`
  - including it in dense assembly aggregates would dilute the `assembly roundtrip` contract instead of strengthening it

Design fix: gate export boundary for solver action-flow metrics
- `tools/editor_gate.sh` now exports the new action-flow counters before invoking the Python summary writer.
- without that export boundary, the gate lane could execute successfully while serializing empty counters into `editor_gate_summary.json`.

Design note: weekly exit semantics
- the fresh narrow weekly run can still return non-zero because of existing UI-flow gate failures that are outside this solver action-flow delta.
- the solver action-flow contract is considered healthy when:
  - `local_ci_summary.json`
  - `editor_gate_summary.json`
  - `editor_weekly_validation_summary.json`
  all expose matching `panel/flow/next/prev/restart/visited` counts, and
  the dashboard/report/checker replay also stays green.

Design delta: solver request-contract and viewport deterministic matrix
- `tools/web_viewer/ui/solver_action_panel.js` now treats solver CTA interaction as a typed request surface instead of an unstructured click callback.
- every emitted action carries a stable request payload produced by `buildSolverActionRequest(...)`:
  - `requestKind`
    - `invoke`
    - `focus`
    - `flow`
  - `target`
    - typed focus target for:
      - constraint
      - variable
      - basis-constraint
      - redundant-constraint
      - free-variable
  - `panelId`
  - `category`
  - `scope`
  - `tag`
  - `flowAction`
  - `flowStepIndex`
  - `flowStepCount`
- the panel runtime also keeps a machine-readable request history:
  - `requestCount`
  - `invokeRequestCount`
  - `focusRequestCount`
  - `flowRequestCount`
  - `lastRequest`
- `tools/web_viewer/ui/workspace.js` exposes that state through debug hooks so browser smokes and later UI automation do not need to scrape DOM text to recover request semantics.
- `tools/web_viewer/scripts/solver_action_panel_smoke.js` now prints:
  - `run_id=...`
  - `run_dir=...`
  - `summary_json=...`
  before the large JSON payload.
- rationale:
  - shell parsers in `local_ci` and `editor_gate` should not depend on end-of-stream markers after a large JSON body;
  - emitting the structured markers first makes the smoke contract stable even when JSON output grows.

Design delta: propagated request metrics
- local summary now persists:
  - `solverActionPanelSmokeRequestCount`
  - `solverActionPanelSmokeInvokeRequestCount`
  - `solverActionPanelSmokeFocusRequestCount`
  - `solverActionPanelSmokeFlowRequestCount`
- gate and weekly normalized lane fields now persist:
  - `request_count`
  - `invoke_request_count`
  - `focus_request_count`
  - `flow_request_count`
- consumer renderers now show the full request breakdown:
  - `requests=...`
  - `invoke=...`
  - `focus=...`
  - `flow=...`
- this propagation path now includes:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

Design delta: viewport sample enters the deterministic default preview matrix
- `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json` now includes `viewport_sample_paperspace_line_only`.
- the case uses explicit deterministic entry:
  - `initialEntityId = 2`
  - `initialNavKind = initial-entity`
  - query:
    - `tools/web_viewer/index.html?manifest=build/step186_viewport_sample/manifest.json&mesh=0&space=1&layout=PaperSpace`
- expected selection contract:
  - `Entity ID = 2`
  - `Color Source = BYLAYER`
  - `Line Type Scale = 1`
  - `Space = 1`
  - `Layout = PaperSpace`
- this upgrades the default deterministic preview matrix from:
  - `18/18`
  to:
  - `19/19`
- `focus_check_case_count` remains `6`; the viewport case is intended to harden deterministic entry, not to add another group-focus flow.

Design reaffirmation: viewport sample stays out of dense assembly roundtrip
- `build/step186_viewport_sample` is intentionally part of:
  - Step186 preview artifact prep
  - preview artifact smoke
  - default preview provenance smoke
- it remains intentionally excluded from dense editor assembly aggregation because it primarily exercises:
  - `space`
  - `layout`
  - `viewports`
  and does not materially strengthen assembly semantics such as:
  - `group_id`
  - `source_type`
  - `proxy_kind`
  - `block_name`

Design delta: weekly summary replay from an existing gate summary
- `tools/editor_weekly_validation.sh` now preserves an externally provided `GATE_SUMMARY` when `RUN_GATE=0`.
- when a caller supplies:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  weekly summary/report/checker generation can replay against a known-good gate payload without paying the cost of rerunning the whole gate.
- this is a consumer-contract improvement, not a testing shortcut:
  - gate execution is still validated separately;
  - weekly replay can now validate markdown/report/checker propagation independently from gate runtime.
- replayed weekly summaries mark the gate envelope as:
  - `status = reused`
  - `exit_code = 0`
  which makes the source of the weekly payload explicit while keeping downstream consumers fully typed.

Current fresh target values for this contract are:
- preview provenance:
  - `19/19`
  - deterministic entry `19/19`
  - focus checks `6`
- solver action request lane:
  - `panel_count = 4`
  - `flow_check_count = 10`
  - `request_count = 12`
  - `invoke_request_count = 2`
  - `focus_request_count = 2`
  - `flow_request_count = 8`
- Step186 prep / preview artifact smoke:
  - `16/16`

Design delta: visible solver action-flow console and viewport-bearing dense assembly metrics
- `tools/web_viewer/ui/solver_action_flow_console.js` turns the solver action-panel request/debug contract into a visible workspace consumer instead of a smoke-only side channel.
- the console is mounted under `#cad-solver-action-flow` from `tools/web_viewer/ui/workspace.js` and is refreshed from the same normalized action state used by the interactive solver panel.
- the visible console state is intentionally machine-readable and matches the request contract:
  - `panelCount`
  - `activePanelId`
  - `activePanelTitle`
  - `activeFocusKind`
  - `activeFocusValue`
  - `activeFlowStepIndex`
  - `activeFlowStepCount`
  - `requestCount`
  - `invokeRequestCount`
  - `focusRequestCount`
  - `flowRequestCount`
  - `lastRequestKind`
  - `lastRequestPanelId`
  - `lastRequestTargetLabel`
  - `recentRequestLabels`
- `window.__cadDebug.getSolverActionFlowState()` is the public debug hook for this console contract. The smoke runner no longer needs to infer console state from free-form DOM text or panel internals.
- `tools/web_viewer/scripts/solver_action_panel_smoke.js` now validates the console directly:
  - primary conflict invoke writes `lastRequestKind=invoke` and `lastRequestTargetLabel=Constraint 2`
  - flow advance writes `lastRequestKind=flow`
  - chip focus writes `lastRequestKind=focus`
  - the rendered console text contains the active panel title so consumer regressions are visible in screenshots and markdown artifacts

Design delta: viewport-bearing dense assembly metrics
- the dense editor assembly lane already contained real subcases with viewport semantics:
  - `assembly_dense_paperspace_annotation_bundle`
  - `assembly_dense_paperspace_insert_dimension_hatch`
  - `assembly_dense_multi_layout`
- instead of diluting the lane with `viewport_sample`, the roundtrip contract now promotes viewport-bearing assembly semantics from these existing dense cases.
- `tools/web_viewer/scripts/editor_roundtrip_smoke.js` summarizes source viewport metadata directly from imported CADGF document metadata:
  - `viewport_count`
  - `viewport_layout_count`
  - `viewport_layouts`
- `tools/read_editor_assembly_roundtrip_metrics.py` now aggregates these into dense lane metrics:
  - `import_viewport_count`
  - `import_viewport_layout_count`
  - `import_viewport_case_count`
- these metrics are now first-class consumers in:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`
- the contract intent is explicit:
  - dense assembly keeps measuring assembly semantics (`group_id`, `source_type`, `proxy_kind`, `block_name`, zero drift)
  - but it now also exposes how much real viewport-bearing paper-space data those assembly cases actually carry
- this is stronger than adding `viewport_sample` to the dense lane because the resulting totals remain assembly-centric while still surfacing paper-space/viewports at the aggregate level

Design fix: local CI consumer mapping for viewport-bearing assembly metrics
- `tools/write_ci_artifact_summary.py` originally consumed the new viewport-bearing assembly metrics only from gate/weekly payloads.
- the local summary already exported:
  - `ctestAssemblyRoundtripImportViewportCount`
  - `ctestAssemblyRoundtripImportViewportLayoutCount`
  - `ctestAssemblyRoundtripImportViewportCaseCount`
  but the local markdown renderer did not map them into `local_ctest_assembly_roundtrip`.
- the consumer fix now maps those three local fields into the same `append_ctest_lane_line(...)` payload shape used by gate/weekly, so:
  - local markdown
  - gate markdown
  - weekly dashboard
  - weekly report
  all render the same viewport-bearing dense totals.

Current fresh target values for this extended contract are:
- preview provenance:
  - `19/19`
  - deterministic entry `19/19`
  - focus checks `6`
- solver action-flow console:
  - `panel_count = 4`
  - `flow_check_count = 10`
  - `request_count = 12`
  - `invoke_request_count = 2`
  - `focus_request_count = 2`
  - `flow_request_count = 8`
  - `visited_panel_count = 2`
- dense assembly aggregate:
  - `tracked = 101`
  - `groups = 46`
  - `proxies = 44`
  - `exploded = 33`
  - `viewports = 12`
  - `viewport_layouts = 10`
  - `viewport_cases = 9`
  - `checked = 101`
  - `drift = 0/0`

Design delta: dense assembly derived proxy kind aggregate
- dense editor roundtrip cases already exported `derived_proxy_count`, but that scalar was no longer sufficient once the dense lane began mixing:
  - dimension-derived proxy geometry
  - hatch-derived proxy geometry
  - leader-derived proxy geometry
- `tools/web_viewer/scripts/editor_roundtrip_smoke.js` now emits a case-level `derived_proxy_kind_counts` object under each import summary.
- keys are normalized `metadata.proxyKind` values and values are positive integer counts.
- the current dense lane intentionally expects these keys to remain assembly-relevant:
  - `dimension`
  - `hatch`
  - `leader`
- `tools/read_editor_assembly_roundtrip_metrics.py` aggregates those per-case maps into a lane-level dictionary and exports it as `import_proxy_kind_counts_b64`.
- the aggregate contract is:
  - every decoded value must be an integer `>= 0`
  - the sum of all decoded counts must equal `import_derived_proxy_count`
  - missing keys are interpreted as `0`, not as schema failure
- this propagation path is now first-class:
  - case import summary
  - `read_editor_assembly_roundtrip_metrics.py`
  - `local_ci.sh`
  - `editor_gate.sh`
  - `editor_weekly_validation.sh`
  - `write_ci_artifact_summary.py`
  - `write_step176_dashboard.py`
  - `write_step176_weekly_report.py`
  - `check_weekly_summary.sh`
- the reason for promoting this to a lane metric is concrete:
  - dense lane growth should stay explainable
  - a future increase from `44 -> 60` proxies is not actionable unless consumers can see whether the growth came from `dimension`, `leader`, or `hatch`
- fresh target values for this contract are:
  - `import_derived_proxy_count = 44`
  - `import_proxy_kind_counts = { dimension: 34, hatch: 5, leader: 5 }`
  - decoded sum `= 44`
- this remains assembly-centric:
  - `viewport_sample` still stays out of the dense assembly lane
  - `space/layout/viewports` continue to be measured separately
  - `proxy kind` aggregate only summarizes the imported proxy-bearing assembly cases already in the lane

Design delta: solver event-flow metrics and assembly proxy-layout propagation
- the solver action-flow contract now distinguishes request traffic from emitted UI events.
- `tools/web_viewer/ui/solver_action_panel.js` records typed events in addition to typed requests:
  - `invoke`
  - `focus`
  - `flow`
  - `replay`
- `tools/web_viewer/ui/workspace.js` exposes these through the debug hook:
  - `window.__cadDebug.getSolverActionEventState()`
  - `window.__cadDebug.clearSolverActionEvents()`
- `tools/web_viewer/ui/solver_action_flow_console.js` renders the event stream explicitly, including:
  - total event count
  - per-kind event counts
  - last event card
  - recent event labels
- `tools/web_viewer/scripts/solver_action_panel_smoke.js` now treats event flow as a first-class contract. The stable target values are:
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
- these event metrics are now propagated end-to-end through:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

- dense assembly now promotes not only proxy-kind totals, but layout-aware proxy-kind totals:
  - case-level field: `derived_proxy_layout_kind_counts`
  - lane aggregate field: `import_proxy_layout_kind_counts_b64`
- the aggregate is a nested layout-to-proxy-kind map. Fresh target values are:
  - `LayoutStyle -> { dimension: 18, leader: 5, hatch: 3 }`
  - `Model -> { dimension: 16, hatch: 2 }`
- invariant:
  - the nested decoded counts sum to `import_derived_proxy_count`
  - for the current dense lane that total remains `44`
- this propagation is intentionally assembly-centric:
  - layout-aware proxy totals are derived only from dense editor roundtrip cases that already satisfy assembly provenance requirements
  - `viewport_sample` remains outside the dense assembly lane because it contributes `space/layout/viewports` coverage but not meaningful assembly provenance

- a real propagation bug was fixed in `tools/editor_gate.sh`:
  - summary writer already consumed `ASSEMBLY_ROUNDTRIP_CTEST_IMPORT_PROXY_LAYOUT_KIND_COUNTS_B64`
  - but the variable was never initialized/exported in the gate shell
  - effect: local summary showed `proxy_layouts`, while gate and weekly replay collapsed to `-`
  - fix:
    - initialize `ASSEMBLY_ROUNDTRIP_CTEST_IMPORT_PROXY_LAYOUT_KIND_COUNTS_B64`
    - export it alongside the other assembly metrics before writing `editor_gate_summary.json`

Design delta: solver jump-flow metrics and dense assembly group-layout aggregate
- the solver action-flow contract now treats `jump` as a first-class flow action instead of folding it into the generic `flow` bucket.
- `tools/web_viewer/ui/solver_action_panel.js` exposes jump-capable steps through the existing action panel flow:
  - `data-flow-action="jump"`
  - `data-flow-step-index`
  - `jumpFlow(stepIndex)`
- `tools/web_viewer/scripts/solver_action_panel_smoke.js` now validates two explicit jump transitions:
  - `primary_conflict -> jump-7`
  - `smallest_redundancy -> jump-4`
- the stable action-flow target for the current ranked solver payload is now:
  - `panel_count = 4`
  - `flow_check_count = 12`
  - `request_count = 15`
  - `invoke_request_count = 2`
  - `focus_request_count = 2`
  - `flow_request_count = 10`
  - `replay_request_count = 1`
  - `jump_request_count = 2`
  - `event_count = 15`
  - `invoke_event_count = 2`
  - `focus_event_count = 2`
  - `flow_event_count = 10`
  - `replay_event_count = 1`
  - `jump_event_count = 2`
  - `next_check_count = 4`
  - `jump_check_count = 2`
  - `rewind_check_count = 2`
  - `restart_check_count = 2`
  - `replay_check_count = 1`
  - `visited_panel_count = 2`
- these jump metrics are now propagated end-to-end through:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

- dense assembly now carries a second layout-aware aggregate:
  - case-level source: `assembly_group_layout_source_counts`
  - lane aggregate: `import_assembly_group_layout_source_counts_b64`
- unlike `proxy_layouts`, this aggregate is assembly-source centric rather than proxy centric.
- the decoded aggregate answers a different question:
  - which layouts contribute tracked assembly groups
  - and which imported source types dominate those groups
- the fresh decoded target map is:
  - `LayoutB -> { unknown: 1 }`
  - `LayoutMixed -> { unknown: 2 }`
  - `LayoutStyle -> { DIMENSION: 9, INSERT: 7, LEADER: 5, unknown: 1 }`
  - `Model -> { DIMENSION: 6, INSERT: 15 }`
- the reason to promote this to a lane metric is concrete:
  - `tracked=101` and `groups=46` are no longer sufficient once dense assembly spans model space, styled paper space, multi-layout paper space, and dimension/leader-derived proxy groups
  - the consumer needs to distinguish layout-driven growth from source-type-driven growth without decoding individual case summaries
- propagation path:
  - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - `tools/read_editor_assembly_roundtrip_metrics.py`
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

- a second real propagation bug was fixed in `tools/editor_gate.sh`:
  - jump metrics were parsed from the standalone solver smoke summary
  - but the shell never exported:
    - `SOLVER_ACTION_PANEL_SMOKE_JUMP_REQUEST_COUNT`
    - `SOLVER_ACTION_PANEL_SMOKE_JUMP_EVENT_COUNT`
    - `SOLVER_ACTION_PANEL_SMOKE_JUMP_CHECK_COUNT`
  - effect:
    - local summary showed correct jump counts
    - fresh gate summary collapsed those three fields to `0`
    - weekly replay and consumer markdown inherited the incorrect zero values
  - fix:
    - export the three jump variables alongside the rest of the solver action-flow metrics before writing `editor_gate_summary.json`
  - post-fix contract:
    - local, gate, and weekly now all report `jump_requests=2`, `jump_events=2`, `jump=2`

- `tools/editor_weekly_validation.sh` also now renders the jump metrics in its embedded human-readable weekly summary line so that the raw weekly markdown remains consistent with the JSON summary and the external consumer scripts.

- recent-event focus contract:
  - `tools/web_viewer/ui/solver_action_flow_console.js` now promotes recent solver events from passive log rows into actionable entries.
  - each recent event item carries:
    - `historyIndex`
    - `panelId`
    - `focusKind`
    - `focusValue`
    - `flowAction`
  - `tools/web_viewer/ui/workspace.js` now routes those items back through the existing solver action panel entrypoints:
    - `invoke(panelId)` when there is no typed focus target
    - `invokeFocus(panelId, focusKind, focusValue)` when the event represents a previously emitted focus target
  - this is intentionally a distinct contract from:
    - raw request replay
    - direct chip focus
    - flow-step navigation
  - because the consumer is explicitly asking to re-enter a historical event, not to construct a new focus request from scratch.
  - smoke metric added for this path:
    - `event_focus_check_count`

- exploded-layout aggregate contract tightening:
  - dense assembly summaries now export `exploded_origin_layout_source_counts`.
  - the nested layout/source aggregate must count the same semantic population as `exploded_origin_count`.
  - this population is narrower than "all entities with `editMode=exploded`".
  - it is:
    - `editMode == exploded`
    - and entity type belongs to the movable exploded entity contract
  - `tools/web_viewer/scripts/editor_roundtrip_smoke.js` therefore applies the same `MOVEABLE_ENTITY_TYPES` filter in both places.
  - without that alignment, the nested aggregate can drift even when the lane is otherwise healthy.
- fresh expected decoded aggregate:
  - `LayoutStyle -> { INSERT: 14 }`
  - `Model -> { INSERT: 19 }`
- required invariant:
  - `14 + 19 = 33 = import_exploded_origin_count`

- propagation target for the new contracts:
  - local summary:
    - `previewProvenanceSmokeEventFocusCheckCount = 1`
    - `ctestAssemblyRoundtripImportExplodedOriginCount = 33`
    - `ctestAssemblyRoundtripImportExplodedLayoutSourceCountsB64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - gate summary:
    - `solver_action_panel_smoke.event_focus_check_count = 1`
    - `assembly_roundtrip_ctest.import_exploded_layout_source_counts_b64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - weekly summary:
    - `gate_solver_action_panel_smoke.event_focus_check_count = 1`
    - `gate_assembly_roundtrip_ctest.import_exploded_layout_source_counts_b64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - consumer surfaces:
    - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

## 2026-03-10 solver flow banner + dense assembly group-source aggregate

- solver action-flow now has a visible banner contract in addition to the existing panel/console contracts.
  - renderer:
    - `tools/web_viewer/ui/solver_action_flow_banner.js`
  - host wiring:
    - `tools/web_viewer/ui/workspace.js`
  - surface:
    - active panel title/subtitle/description/badge
    - current focus kind/value
    - flow progress
    - request/event counters
    - navigation controls: `Prev`, `Next`, `Restart`
    - recent-event focus button
- important sync rule:
  - solver panel `onAction` callbacks must update both:
    - flow console
    - flow banner
  - updating the console alone leaves the banner on stale panel state after direct CTA invocation.
- smoke contract for the banner:
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - metric:
    - `banner_check_count`
  - fresh expected value:
    - `banner_check_count = 5`
  - checked interactions:
    - `smallest_redundancy:next`
    - `smallest_redundancy:prev`
    - `smallest_redundancy:next-revisit`
    - `smallest_redundancy:restart`
    - `recent-event focus`
- recent-event focus semantics are intentionally:
  - focus the current `bannerState.recentEvent`
  - not an arbitrary older event from the console history
  - smoke must therefore derive the expected focus target from the banner/debug state, not hard-code `Redundant 1`.

- dense assembly roundtrip now exports a flat group-source aggregate in addition to layout/source nesting.
  - source:
    - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - collector:
    - `tools/read_editor_assembly_roundtrip_metrics.py`
  - shell/base64 field:
    - `import_assembly_group_source_counts_b64`
- semantics:
  - this is a flat source-type histogram over tracked assembly groups.
  - it complements:
    - `import_assembly_group_layout_source_counts_b64`
  - it does not replace the nested layout-aware view.
- fresh expected decoded aggregate:
  - `DIMENSION = 15`
  - `INSERT = 22`
  - `LEADER = 5`
  - `unknown = 4`
- propagation target for the new metrics:
  - local summary:
    - `solverActionPanelSmokeBannerCheckCount = 5`
    - `ctestAssemblyRoundtripImportAssemblyGroupSourceCountsB64 = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
  - gate summary:
    - `solver_action_panel_smoke.banner_check_count = 5`
    - `assembly_roundtrip_ctest.import_assembly_group_source_counts_b64 = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
  - weekly summary:
    - `gate_solver_action_panel_smoke.banner_check_count = 5`
    - `gate_assembly_roundtrip_ctest.import_assembly_group_source_counts_b64 = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
  - consumer surfaces:
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

## 2026-03-10 dense text-kind aggregates, solver DOM-event metrics, and self-contained weekly replay

- dense assembly roundtrip now exports text-kind aggregates in addition to the existing proxy/source/layout aggregates.
  - source:
    - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - collector:
    - `tools/read_editor_assembly_roundtrip_metrics.py`
  - shell/base64 fields:
    - `import_text_kind_counts_b64`
    - `import_text_kind_layout_counts_b64`
- semantics:
  - these fields summarize only imported text-bearing assembly entities already covered by the dense lane.
  - they complement, not replace:
    - `import_proxy_kind_counts_b64`
    - `import_proxy_layout_kind_counts_b64`
    - `import_assembly_group_source_counts_b64`
  - fresh expected decoded aggregates:
    - `text_kind_counts = {"dimension":7,"mtext":4,"text":14}`
    - `text_kind_layout_counts = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`

- solver action-flow now exports a global DOM-event contract in addition to request/action/debug state.
  - emitter:
    - `tools/web_viewer/ui/solver_action_panel.js`
  - consumer/debug state:
    - `tools/web_viewer/ui/workspace.js`
  - smoke:
    - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - events are dispatched both on the panel root and on `window`:
    - `cad:solver-action-request`
    - `cad:solver-action`
    - `cad:solver-action-focus`
    - `cad:solver-action-flow-step`
    - `cad:solver-action-replay`
  - workspace keeps a machine-readable `solverActionDomEventState` so downstream consumers do not need to scrape UI text.
  - expected fresh smoke metrics:
    - `dom_event_count = 32`
    - `dom_request_event_count = 16`
    - `dom_action_event_count = 2`
    - `dom_focus_event_count = 3`
    - `dom_flow_event_count = 10`
    - `dom_replay_event_count = 1`

- propagation target for the new contracts:
  - local summary:
    - `previewProvenanceSmokeCaseCount = 19`
    - `previewProvenanceSmokeDeterministicEntryCaseCount = 19`
    - `previewProvenanceSmokeFocusCheckCaseCount = 6`
    - `solverActionPanelSmokeDomEventCount = 32`
    - `solverActionPanelSmokeBannerCheckCount = 5`
    - `ctestAssemblyRoundtripImportTextKindCountsB64 = {"dimension":7,"mtext":4,"text":14}`
    - `ctestAssemblyRoundtripImportTextKindLayoutCountsB64 = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
  - gate summary:
    - `preview_provenance_smoke.case_count = 19`
    - `preview_provenance_smoke.deterministic_entry_case_count = 19`
    - `preview_provenance_smoke.focus_check_case_count = 6`
    - `solver_action_panel_smoke.dom_event_count = 32`
    - `solver_action_panel_smoke.banner_check_count = 5`
    - `assembly_roundtrip_ctest.import_text_kind_counts_b64 = {"dimension":7,"mtext":4,"text":14}`
    - `assembly_roundtrip_ctest.import_text_kind_layout_counts_b64 = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
  - weekly summary:
    - `gate_preview_provenance_smoke.case_count = 19`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count = 19`
    - `gate_preview_provenance_smoke.focus_check_case_count = 6`
    - `gate_solver_action_panel_smoke.dom_event_count = 32`
    - `gate_solver_action_panel_smoke.banner_check_count = 5`
    - `gate_assembly_roundtrip_ctest.import_text_kind_counts_b64 = {"dimension":7,"mtext":4,"text":14}`
    - `gate_assembly_roundtrip_ctest.import_text_kind_layout_counts_b64 = {"LayoutA":{"text":1},"LayoutB":{"text":1},"LayoutMixed":{"text":2},"LayoutStyle":{"dimension":3,"mtext":4,"text":9},"Model":{"dimension":4,"text":1}}`
  - consumer surfaces:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- weekly replay contract tightening:
  - `tools/editor_weekly_validation.sh` now makes `RUN_GATE=0 + GATE_SUMMARY=...` self-contained when `WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=1`.
  - if no dashboard path is supplied:
    - it allocates a default `build/step176_dashboard_weekly_<ts>.md`
    - writes the fresh weekly summary into `build/editor_weekly_validation_history/...`
    - generates the dashboard from current gate/weekly history before invoking `check_weekly_summary.sh`
  - summary payload now records:
    - `dashboard_markdown`
  - this closes the replay-only contract gap where checker required `--dashboard` but weekly replay had no generated dashboard path to hand over.

## 2026-03-10 Text-Kind Case Details + Keyboard Banner Contract

- dense assembly aggregate is now split into three layers:
  - total text-kind counts:
    - `import_text_kind_counts_b64`
  - layout-aware text-kind counts:
    - `import_text_kind_layout_counts_b64`
  - case-aware text-kind details:
    - `import_text_kind_case_count`
    - `import_text_kind_case_details_b64`
- each `text_kind_case_details` item is a compact case payload:
  - `lane`
  - `summary_json`
  - `case_name`
  - `text_kind_counts`
  - `text_kind_layout_counts`
  - `assembly_tracked_count`
  - `assembly_group_count`
  - `derived_proxy_count`
  - `derived_proxy_kind_counts`
  - `derived_proxy_layout_kind_counts`
- consumer surfaces must render this third layer explicitly instead of reducing everything back to totals:
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`
- checker contract for `text_kind_case_details`:
  - rendered dashboard/report line must contain `text_kind_cases=...`
  - rendered dashboard/report line must contain `text_kind_case_details=...` when case count is non-zero
  - decoded detail count must equal `import_text_kind_case_count`
  - the sum of per-case `text_kind_counts` must match `import_text_kind_counts_b64`
  - the sum of per-case `text_kind_layout_counts` must match `import_text_kind_layout_counts_b64`

- solver banner contract is now keyboard-safe and machine-verifiable:
  - `ArrowLeft` => previous step
  - `ArrowRight` => next step
  - `Home` => restart flow
  - `End` => recent-event focus
- banner/root contract:
  - focusable root
  - action availability in dataset / ARIA state
  - smoke-visible metrics:
    - `banner_check_count`
    - `keyboard_check_count`
    - `keyboard_banner_check_count`
    - `keyboard_jump_check_count`
    - `keyboard_event_focus_check_count`
- propagation target for this round:
  - local summary
  - gate summary
  - weekly summary / replay
  - CI markdown / dashboard / weekly report
  - weekly checker

- a new shell-compatibility constraint is now explicit:
  - `tools/editor_weekly_validation.sh` must remain compatible with macOS bash 3.2
  - `readarray`/`mapfile` are not portable here
  - portable `while IFS= read -r ...; do ...; done < <(...)` is the required pattern

## 2026-03-10 Solver Keyboard Metrics Propagation

- solver banner/keyboard contract is now treated as a first-class propagated metric set, not as smoke-only debug output.
- canonical metrics:
  - `keyboard_check_count`
  - `keyboard_banner_check_count`
  - `keyboard_jump_check_count`
  - `keyboard_event_focus_check_count`
- producer remains:
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
- propagation path for this round:
  - local summary:
    - `solverActionPanelSmokeKeyboardCheckCount`
    - `solverActionPanelSmokeKeyboardBannerCheckCount`
    - `solverActionPanelSmokeKeyboardJumpCheckCount`
    - `solverActionPanelSmokeKeyboardEventFocusCheckCount`
  - gate summary lane:
    - `solver_action_panel_smoke.keyboard_check_count`
    - `solver_action_panel_smoke.keyboard_banner_check_count`
    - `solver_action_panel_smoke.keyboard_jump_check_count`
    - `solver_action_panel_smoke.keyboard_event_focus_check_count`
  - weekly summary lane:
    - `gate_solver_action_panel_smoke.keyboard_check_count`
    - `gate_solver_action_panel_smoke.keyboard_banner_check_count`
    - `gate_solver_action_panel_smoke.keyboard_jump_check_count`
    - `gate_solver_action_panel_smoke.keyboard_event_focus_check_count`
  - rendered consumers:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- two propagation bugs were part of this round's design boundary:
  - `editor_gate.sh` parsed the new keyboard metrics but did not export them to the summary-writer subprocess
  - weekly replay needed to stay checker-safe under `RUN_GATE=0 + GATE_SUMMARY=...` and produce a dashboard path that downstream checker/consumer tooling could consume
- required invariants after the fix:
  - local, gate, and weekly replay must agree on the four keyboard metric values
  - rendered CI/dashboard/report lines must show:
    - `keyboard=...`
    - `keyboard_banner=...`
    - `keyboard_jump=...`
    - `keyboard_event_focus=...`
  - `check_weekly_summary.sh --require-dashboard` must pass using the fresh weekly replay output

- expected fresh values for this round:
  - preview provenance:
    - `case_count = 19`
    - `deterministic_entry_case_count = 19`
    - `focus_check_case_count = 6`
  - solver action panel:
    - `panel_count = 4`
    - `flow_check_count = 12`
    - `request_count = 16`
    - `keyboard_check_count = 11`
    - `keyboard_banner_check_count = 9`
    - `keyboard_jump_check_count = 2`
    - `keyboard_event_focus_check_count = 1`
  - weekly replay dashboard artifact:
    - `build/step176_dashboard_weekly_20260310_061336.md`

## 2026-03-10 Dense Assembly Group-Source Case Details Propagation

- dense assembly roundtrip metrics are no longer limited to aggregate source counts.
- this round adds propagated case-level detail:
  - `import_assembly_group_source_case_count`
  - `import_assembly_group_source_case_details_b64`
- canonical producer remains:
  - `tools/read_editor_assembly_roundtrip_metrics.py`
- each decoded case-detail item carries:
  - `case_name`
  - `assembly_group_source_counts`
  - `assembly_group_layout_source_counts`
  - `assembly_tracked_count`
  - `assembly_group_count`
  - `derived_proxy_count`
  - `derived_proxy_kind_counts`
  - `exploded_origin_count`
  - `lane`
  - `summary_json`

- propagation path for this round:
  - local summary:
    - `ctestAssemblyRoundtripImportGroupSourceCaseCount`
    - `ctestAssemblyRoundtripImportGroupSourceCaseDetailsB64`
  - gate summary lane:
    - `assembly_roundtrip_ctest.import_group_source_case_count`
    - `assembly_roundtrip_ctest.import_group_source_case_details_b64`
  - weekly summary lane:
    - `gate_assembly_roundtrip_ctest.import_group_source_case_count`
    - `gate_assembly_roundtrip_ctest.import_group_source_case_details_b64`
  - rendered consumers:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- rendered consumer contract for this round:
  - CI/dashboard/report must now show:
    - `group_source_cases=...`
    - `group_source_case_details=...`
  - the detail string is intentionally compact:
    - `model:assembly_block_instances(INSERT=12), paperspace:assembly_paperspace_insert_leader(INSERT=1, LEADER=1), mixed:assembly_mixed_origin(DIMENSION=3, INSERT=1, unknown=1), dense:assembly_dense_insert_triad(INSERT=1), +7`

- checker invariants are now explicit:
  - decoded detail list length must equal `import_assembly_group_source_case_count`
  - every detail item must include `case_name`
  - the sum of all item `assembly_group_source_counts` must equal aggregate `import_assembly_group_source_counts_b64`
  - the sum of all item `assembly_group_layout_source_counts` must equal aggregate `import_assembly_group_layout_source_counts_b64`

- two real consumer bugs define this round's design boundary:
  - `tools/write_step176_dashboard.py` used a nonexistent helper `fmt_counts`
  - `tools/write_step176_weekly_report.py` used a nonexistent helper `encode_b64_json_dict`
  - both consumers now render case-detail counts inline and are part of the propagation contract

- companion solver/banner state for this round is also treated as part of the same propagated contract:
  - `panel_count = 4`
  - `flow_check_count = 13`
  - `request_count = 17`
  - `jump_check_count = 3`
  - `banner_check_count = 6`

- expected fresh values for this round:
  - preview provenance:
    - `case_count = 19`
    - `deterministic_entry_case_count = 19`
    - `focus_check_case_count = 6`
  - solver action panel:
    - `panel_count = 4`
    - `flow_check_count = 13`
    - `request_count = 17`
    - `dom_event_count = 34`
    - `banner_check_count = 6`
    - `keyboard_check_count = 11`
  - dense assembly:
    - `case_count = 4`
    - `pass_count = 4`
    - `tracked = 101`
    - `groups = 46`
    - `proxies = 44`
    - `exploded = 33`
    - `group_source_cases = 11`
    - `group_sources = {"DIMENSION":15,"INSERT":22,"LEADER":5,"unknown":4}`
    - `group_layouts = {"LayoutB":{"unknown":1},"LayoutMixed":{"unknown":2},"LayoutStyle":{"DIMENSION":9,"INSERT":7,"LEADER":5,"unknown":1},"Model":{"DIMENSION":6,"INSERT":15}}`

## 2026-03-10 Global Shortcut And Exploded-Layout Case Detail Closure

- solver action-flow smoke now treats workspace-global shortcuts as first-class contract:
  - `Alt+Shift+Home`
  - `Alt+Shift+ArrowRight`
  - `Alt+Shift+ArrowLeft`
  - `Alt+Shift+End`
- the important design correction is that global recent-event focus must resolve against the current banner recent event after the preceding global flow actions, not against the stale replay-era target.
- this round keeps the implementation unchanged in `tools/web_viewer/ui/workspace.js`; the fix is in smoke semantics and propagation.

- canonical solver smoke expectations for the fresh contract are now:
  - `panel_count = 4`
  - `flow_check_count = 17`
  - `request_count = 21`
  - `focus_request_count = 4`
  - `flow_request_count = 14`
  - `replay_request_count = 1`
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

- dense assembly metrics now expose case-level exploded-layout provenance, in addition to the already-landed aggregate:
  - `import_exploded_layout_source_case_count`
  - `import_exploded_layout_source_case_details_b64`
- each decoded case-detail item carries:
  - `case_name`
  - `exploded_origin_layout_source_counts`
  - `exploded_origin_count`
  - `assembly_tracked_count`
  - `assembly_group_count`
  - `derived_proxy_count`
  - `derived_proxy_kind_counts`
  - `lane`
  - `summary_json`
- checker invariants for this closure:
  - decoded detail count must equal `import_exploded_layout_source_case_count`
  - the sum of all item `exploded_origin_layout_source_counts` must equal aggregate `import_exploded_layout_source_counts_b64`
  - the sum of all item `exploded_origin_count` must equal aggregate `import_exploded_origin_count`

- fresh aggregate expectation for exploded layouts is now explicit and semantically aligned with movable exploded entities only:
  - `import_exploded_origin_count = 33`
  - `import_exploded_layout_source_counts_b64 = {"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - `import_exploded_layout_source_case_count = 10`

- propagation path closed in this round:
  - producer:
    - `tools/read_editor_assembly_roundtrip_metrics.py`
  - local summary:
    - `ctestAssemblyRoundtripImportExplodedLayoutSourceCaseCount`
    - `ctestAssemblyRoundtripImportExplodedLayoutSourceCaseDetailsB64`
  - gate summary lane:
    - `assembly_roundtrip_ctest.import_exploded_layout_source_case_count`
    - `assembly_roundtrip_ctest.import_exploded_layout_source_case_details_b64`
  - weekly summary lane:
    - `gate_assembly_roundtrip_ctest.import_exploded_layout_source_case_count`
    - `gate_assembly_roundtrip_ctest.import_exploded_layout_source_case_details_b64`
  - rendered consumers:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- real consumer failures define the design boundary for this round:
  - `tools/write_step176_dashboard.py` referenced `encode_b64_json_dict(...)` but did not define it
  - `tools/write_step176_weekly_report.py` had the same missing helper
  - both files now carry the helper locally instead of relying on accidental transitive availability

- weekly replay remains intentionally supported with:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
- this mode is part of the contract, not just a convenience path; it is how dashboard/report/checker consumer changes are validated without rerunning gate.

## 2026-03-10 Solver Status Click And Paperspace Combo Deterministic Entry Closure

- solver status text is now a real interaction surface, not just a passive summary field:
  - `#cad-status-solver` exposes mouse click plus `Enter` / `Space`
  - `tools/web_viewer/ui/statusbar.js` owns the interactive affordance
  - `tools/web_viewer/ui/workspace.js` owns the activation rule
- the activation rule is intentionally simple and stable:
  - first, focus the current recent solver event
  - if no recent event exists, fall back to invoking the active solver panel
  - the visible status text continues to come from the same solver-status source of truth; the click path does not introduce a second rendering model
- smoke contract for this closure adds:
  - `status_click_check_count`
  - the status-click action must increase both request and event totals
  - the resulting focus target must match the recent-event target shown in the banner/console
- canonical fresh solver smoke expectations for this contract are now:
  - `panel_count = 4`
  - `flow_check_count = 17`
  - `request_count = 22`
  - `status_check_count = 6`
  - `status_click_check_count = 1`
  - `banner_check_count = 11`

- the default Step186 preview provenance matrix now closes the real paper-space combo gap with two deterministic cases:
  - `paperspace_combo_insert_group_focus`
  - `paperspace_combo_dimension_group_focus`
- both cases intentionally use explicit `initialEntityId` entry, not viewport-grid hit scanning:
  - insert path starts from entity `17`, expects group `2`, and focuses the group union `[16,17,18]`
  - dimension path starts from entity `22`, expects group `3`, and focuses the group union `[19,20,21,22]`
- this lifts the default matrix to:
  - preview provenance `21 / 21`
  - deterministic entry `21 / 21`
  - focus checks `8`
- `step186_preview_artifact_prep` also moves to `17 / 17`, because the combo sample is part of the default artifact-prep lane.

- fresh assembly aggregate expectations relevant to this closure are:
  - `import_exploded_layout_source_counts_b64 = {"LayoutCombo":{"INSERT":6},"LayoutStyle":{"INSERT":14},"Model":{"INSERT":19}}`
  - `assembly_roundtrip_ctest.case_count = 4`
  - `assembly_roundtrip_ctest.pass_count = 4`
- the important design boundary is unchanged:
  - preview provenance uses combo cases to strengthen deterministic paper-space selection and group-focus behavior
  - dense assembly roundtrip remains a separate contract and continues to report through `local_ci`, `editor_gate`, and weekly replay

- propagation path closed in this round:
  - producer/smoke:
    - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
    - `tools/web_viewer/tests/fixtures/preview_provenance_smoke_cases.json`
  - local summary:
    - `solverActionPanelSmokeStatusClickCheckCount`
    - `previewProvenanceSmokeCaseCount`
    - `previewProvenanceSmokeDeterministicEntryCaseCount`
    - `previewProvenanceSmokeFocusCheckCaseCount`
  - gate summary lane:
    - `solver_action_panel_smoke.status_click_check_count`
    - `preview_provenance_smoke.case_count`
    - `preview_provenance_smoke.deterministic_entry_case_count`
    - `preview_provenance_smoke.focus_check_case_count`
  - weekly replay lane:
    - `gate_solver_action_panel_smoke.status_click_check_count`
    - `gate_preview_provenance_smoke.case_count`
    - `gate_preview_provenance_smoke.deterministic_entry_case_count`
    - `gate_preview_provenance_smoke.focus_check_case_count`
  - rendered consumers/checker:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`
- a real consumer defect surfaced after the fresh summaries were already green:
  - `tools/write_ci_artifact_summary.py` rendered exploded-layout case details with `as_str(...)` but did not define the helper
  - the CI markdown writer therefore crashed even though local/gate/weekly JSON had already propagated correctly
  - the contract now explicitly treats CI markdown replay as a first-class consumer check, not just a derived convenience artifact

## 2026-03-10 Solver Import/Clear Metric Propagation

- solver action-flow smoke now treats visible diagnostics import/clear as first-class propagated metrics, not smoke-only debug details.
- producer contract:
  - `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - summary fields:
    - `import_check_count`
    - `clear_check_count`
- the intent is narrow and stable:
  - `import_check_count` records a verified import-path interaction against visible solver diagnostics
  - `clear_check_count` records a verified clear/reset-path interaction
  - both are counted independently from generic request, flow, keyboard, or banner checks
  - both must survive propagation without recomputation by downstream consumers

- propagation path closed in this round:
  - local summary:
    - `solverActionPanelSmokeImportCheckCount`
    - `solverActionPanelSmokeClearCheckCount`
  - gate summary lane:
    - `solver_action_panel_smoke.import_check_count`
    - `solver_action_panel_smoke.clear_check_count`
  - weekly replay lane:
    - `gate_solver_action_panel_smoke.import_check_count`
    - `gate_solver_action_panel_smoke.clear_check_count`
  - rendered consumers/checker:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- fresh canonical expectations for this closure are now:
  - Step186 prep `17 / 17`
  - preview provenance `23 / 23`
  - deterministic entry `23 / 23`
  - focus checks `8`
  - preview artifact smoke `17 / 17`
  - preview artifact validator failure injection `10 / 10`
  - assembly roundtrip ctest `4 / 4`
  - solver action-flow:
    - `panel_count = 4`
    - `flow_check_count = 17`
    - `request_count = 22`
    - `import_check_count = 1`
    - `clear_check_count = 1`
    - `banner_check_count = 11`
    - `keyboard_check_count = 15`
    - `jump_check_count = 3`
    - `status_check_count = 6`
    - `status_click_check_count = 1`

- fresh dense assembly aggregate remains part of the same rendered contract surface and is expected to stay aligned while solver metrics grow:
  - `tracked = 132`
  - `groups = 55`
  - `proxies = 61`
  - `exploded = 39`
  - `group_sources = {"INSERT":24,"DIMENSION":21,"LEADER":6,"unknown":4}`
  - `proxy_kinds = {"dimension":46,"hatch":8,"leader":7}`
  - `text_kinds = {"text":18,"dimension":9,"mtext":6}`
  - `viewports = 13`

- the important design correction surfaced by this round is in consumer propagation, not producer logic:
  - local smoke already emitted `import_check_count` and `clear_check_count`
  - local summary writer already persisted them
  - but gate/weekly/consumer layers had to be updated so that rendered markdown and checker lines did not silently omit them
- consumer lines are now expected to render:
  - `import_checks=1`
  - `clear_checks=1`
  alongside the existing solver flow metrics

- weekly replay remains part of the intended validation path:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - this mode is explicitly relied upon to validate consumer changes without forcing a second gate execution

## 2026-03-10 Solver Panel-Keyboard And Dense Proxy-Kind Case Details

- solver action-flow now has a second keyboard surface in addition to banner/global shortcuts:
  - active panel cards are focusable
  - `Enter`/`Space` invokes the focused panel
  - `ArrowRight`/`ArrowLeft` advances and rewinds the active panel flow
  - `Home` restarts the active panel flow
  - `End` jumps to the last step of the active panel flow
- the important boundary is that this is not a separate solver semantics model:
  - producer remains `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - the new contract only records an additional interaction surface for the same request/event stream
- propagated solver metrics are:
  - `panel_keyboard_check_count`
  - `panel_keyboard_invoke_check_count`
  - `panel_keyboard_flow_check_count`
- current canonical expectations are:
  - `panel_keyboard_check_count = 11`
  - `panel_keyboard_invoke_check_count = 1`
  - `panel_keyboard_flow_check_count = 10`
- propagation path closed in this round:
  - local summary:
    - `solverActionPanelSmokePanelKeyboardCheckCount`
    - `solverActionPanelSmokePanelKeyboardInvokeCheckCount`
    - `solverActionPanelSmokePanelKeyboardFlowCheckCount`
  - gate summary lane:
    - `solver_action_panel_smoke.panel_keyboard_check_count`
    - `solver_action_panel_smoke.panel_keyboard_invoke_check_count`
    - `solver_action_panel_smoke.panel_keyboard_flow_check_count`
  - weekly replay lane:
    - `gate_solver_action_panel_smoke.panel_keyboard_check_count`
    - `gate_solver_action_panel_smoke.panel_keyboard_invoke_check_count`
    - `gate_solver_action_panel_smoke.panel_keyboard_flow_check_count`
  - rendered consumers/checker:
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`

- dense assembly aggregate now exposes per-case proxy-kind detail, not just total proxy-kind counts:
  - `import_proxy_kind_case_count`
  - `import_proxy_kind_case_details_b64`
- each case-detail item carries:
  - `case_name`
  - `derived_proxy_kind_counts`
  - `derived_proxy_layout_kind_counts`
  - `assembly_tracked_count`
  - `assembly_group_count`
  - `derived_proxy_count`
  - `exploded_origin_count`
  - `lane`
  - `summary_json`
- this matters because the dense lane is no longer only explainable by aggregate totals:
  - the consumer layer can now show which concrete case contributed `dimension`, `leader`, or `hatch` growth
  - checker can validate that the case-detail sum equals the aggregate `import_proxy_kind_counts_b64`
- fresh dense aggregate expectations for this closure are:
  - `tracked = 132`
  - `groups = 55`
  - `proxies = 61`
  - `exploded = 39`
  - `proxy_kinds = {"dimension":46,"hatch":8,"leader":7}`
  - `proxy_kind_cases = 8`
- the fresh rendered replay artifacts for this contract are:
  - `build/ci_artifact_summary_panel_keyboard_proxy_kind.md`
  - `build/step176_dashboard_panel_keyboard_proxy_kind.md`
  - `build/step176_weekly_panel_keyboard_proxy_kind.md`

## 2026-03-10 Solver Console Controls And Dense Proxy-Layout Case Details

- solver action-flow contract now includes a console-control surface in addition to banner, keyboard, and panel-card interactions:
  - `console_check_count`
  - `console_flow_check_count`
  - `console_event_focus_check_count`
- this is still the same solver flow model:
  - producer stays `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - the new counters only measure an additional visible interaction surface for the same request/event stream
- the canonical fresh expectations for the solver lane are now:
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
- producer-side smoke expectations were tightened to match the real interaction contract:
  - `next_check_count = 6`
  - `rewind_check_count = 4`
  - `restart_check_count = 4`
  - `dom_event_count = 54`
  - `event_count = 27`
- dense assembly contract now also exposes proxy-layout case detail, not only aggregate proxy-layout totals:
  - `import_proxy_layout_case_count`
  - `import_proxy_layout_case_details_b64`
- each proxy-layout case-detail item carries:
  - `case_name`
  - `derived_proxy_layout_kind_counts`
  - `derived_proxy_kind_counts`
  - `assembly_tracked_count`
  - `assembly_group_count`
  - `derived_proxy_count`
  - `exploded_origin_count`
  - `lane`
  - `summary_json`
- this closes the remaining explainability gap between:
  - aggregate `import_proxy_layout_kind_counts_b64`
  - per-case dense lane growth
- local, gate, and weekly replay are now expected to agree on the following fresh top-level values:
  - Step186 prep `17 / 17`
  - preview provenance `23 / 23`
  - deterministic entry `23 / 23`
  - focus checks `8`
  - preview artifact smoke `17 / 17`
  - preview artifact validator failure injection `10 / 10`
  - assembly roundtrip ctest `4 / 4`
- fresh dense assembly expectations for this closure are:
  - `tracked = 132`
  - `groups = 55`
  - `proxies = 61`
  - `exploded = 39`
  - `proxy_layout_cases = 8`
- a small but important design hygiene fix was made in `tools/editor_weekly_validation.sh`:
  - duplicated dictionary keys for solver console and proxy-layout fields were removed
  - weekly replay now has a single canonical source for those fields
- weekly replay remains an intended validation path for this closure:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - this mode is used to validate dashboard/report/checker propagation without forcing a second gate execution
- the fresh rendered replay artifacts for this contract are:
  - `build/ci_artifact_summary_console_proxy_layout_cases.md`
  - `build/step176_dashboard_console_proxy_layout_cases.md`
  - `build/step176_weekly_console_proxy_layout_cases.md`

## 2026-03-11 Console Recent Clicks And Secondary Combo Focus

- the default Step186 preview provenance matrix now includes an additional real deterministic case:
  - `paperspace_combo_dimension_group_focus_secondary`
- the case uses:
  - `manifest=build/step186_paperspace_combo/manifest.json`
  - `mesh=0`
  - `space=1`
  - `initialEntityId=31`
  - `initialNavKind=initial-entity`
- the intent of this case is to close the second paper-space dimension group-focus path in the same bundle:
  - initial selection is a real dimension proxy text/value entry
  - focus check clicks `Group ID 7`
  - expected group members are `[28, 29, 30, 31]`
- with that addition, the canonical fresh preview provenance expectations for this closure are:
  - Step186 prep `17 / 17`
  - preview provenance `24 / 24`
  - deterministic entry `24 / 24`
  - focus checks `9`
  - preview artifact smoke `17 / 17`
  - preview artifact validator failure injection `10 / 10`
  - assembly roundtrip ctest `4 / 4`

- solver action-flow now includes recent-console replay and recent-event click as first-class contract surfaces:
  - `console_replay_check_count`
  - `console_event_click_check_count`
- these are intentionally separate from:
  - `console_check_count`
  - `console_flow_check_count`
  - `console_event_focus_check_count`
- the distinction is:
  - `console_check_count` covers visible console sections
  - `console_flow_check_count` covers flow-console progression
  - `console_event_focus_check_count` covers passive focus reflection from the console
  - `console_replay_check_count` covers an explicit replay click on recent requests
  - `console_event_click_check_count` covers an explicit click on a recent event that refocuses the active panel
- the canonical fresh solver expectations for this closure are:
  - `panel_count = 4`
  - `flow_check_count = 22`
  - `request_count = 28`
  - `invoke_request_count = 2`
  - `focus_request_count = 7`
  - `flow_request_count = 18`
  - `replay_request_count = 1`
  - `dom_event_count = 56`
  - `event_count = 28`
  - `console_check_count = 4`
  - `console_flow_check_count = 3`
  - `console_event_focus_check_count = 1`
  - `console_replay_check_count = 1`
  - `console_event_click_check_count = 1`
  - `event_focus_check_count = 5`
  - `banner_check_count = 7`
  - `keyboard_check_count = 16`

- weekly replay remains the preferred propagation validator for this closure:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - `bash tools/editor_weekly_validation.sh`
- the replay is expected to generate its own weekly summary, markdown, history row, and dashboard without rerunning gate
- the fresh rendered replay artifacts for this closure are:
  - `build/ci_artifact_summary_console_recent_clicks_v2.md`
  - `build/step176_dashboard_console_recent_clicks_v2.md`
  - `build/step176_weekly_console_recent_clicks_v2.md`

- one real consumer-side timing pitfall was confirmed and intentionally handled:
  - dashboard generation can race checker invocation if the dashboard path is validated before the file is visible
  - the canonical validation order for this closure is therefore:
    - write CI markdown
    - write dashboard
    - write weekly report
    - run `check_weekly_summary.sh`

## 2026-03-11 Banner Focus Click Propagation And Fresh 25x25 Preview Closure

- solver action-flow now treats banner current-focus clicks as a first-class propagated metric:
  - `banner_focus_click_check_count`
- this field belongs to the same request/event surface as the existing banner metrics:
  - producer remains `tools/web_viewer/scripts/solver_action_panel_smoke.js`
  - propagation targets are:
    - `tools/local_ci.sh`
    - `tools/editor_gate.sh`
    - `tools/editor_weekly_validation.sh`
    - `tools/write_ci_artifact_summary.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_step176_weekly_report.py`
    - `tools/check_weekly_summary.sh`
- the real defect fixed in this round was not in the smoke producer:
  - the gate parser read `payload["banner_focus_click_count"]`
  - the smoke summary emits `payload["banner_focus_click_check_count"]`
  - local already consumed the correct key, but gate and every replayed consumer silently flattened the metric to `0`
- the design boundary for this closure is therefore:
  - producer metric names must be propagated verbatim across local, gate, weekly replay, and rendered consumers
  - checker-visible markdown is part of the contract, not a derived convenience artifact

- the default Step186 preview provenance matrix also closes one more real deterministic gap in this round:
  - Step186 prep `17 / 17`
  - preview provenance `25 / 25`
  - deterministic entry `25 / 25`
  - focus checks `9`
  - preview artifact smoke `17 / 17`
  - preview artifact validator failure injection `10 / 10`
  - assembly roundtrip ctest `4 / 4`

- the canonical fresh solver expectations for this closure are:
  - `panel_count = 4`
  - `flow_check_count = 22`
  - `request_count = 29`
  - `banner_check_count = 7`
  - `banner_focus_click_check_count = 1`
  - `console_check_count = 4`
  - `console_flow_check_count = 3`
  - `console_event_focus_check_count = 1`
  - `console_replay_check_count = 1`
  - `console_event_click_check_count = 1`
  - `status_check_count = 6`
  - `status_click_check_count = 1`
  - `keyboard_check_count = 16`

- weekly replay remains the preferred propagation validator for this closure:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - `bash tools/editor_weekly_validation.sh`
- the fresh rendered consumer artifacts for this closure are:
  - `build/ci_artifact_summary_banner_focus_click_v3.md`
  - `build/step176_dashboard_banner_focus_click_v3.md`
  - `build/step176_weekly_banner_focus_click_v3.md`

## 2026-03-11 Dimension-Hatch Group Focus And Banner Event Focus Propagation

- the default Step186 preview provenance matrix now contains one more real deterministic paperspace case:
  - `paperspace_insert_dimension_hatch_dimension_group_focus`
- this case is intentionally anchored on the dimension text entity rather than a sparse line hit:
  - query: `tools/web_viewer/index.html?manifest=build/step186_paperspace_insert_dimension_hatch/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutStyle`
  - `initialEntityId = 13`
  - `initialNavKind = initial-entity`
  - expected group focus:
    - `groupId = 3`
    - `groupMemberIds = [10, 11, 12, 13]`
- with this addition, the preview provenance contract for the default matrix becomes:
  - preview provenance `26 / 26`
  - deterministic entry `26 / 26`
  - focus checks `10`

- solver action-flow now treats banner recent-event focus as a first-class propagated metric:
  - `banner_event_focus_check_count`
- this metric belongs to the existing solver smoke producer and must propagate verbatim through:
  - `tools/local_ci.sh`
  - `tools/editor_gate.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

- the canonical fresh solver expectations for this closure are:
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
  - `status_check_count = 6`
  - `status_click_check_count = 1`
  - `keyboard_check_count = 16`

- weekly replay remains the preferred propagation validator for this closure:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - `bash tools/editor_weekly_validation.sh`
- the canonical fresh rendered consumer artifacts for this closure are:
  - `build/ci_artifact_summary_banner_event_focus_v4.md`
  - `build/step176_dashboard_banner_event_focus_v4.md`
  - `build/step176_weekly_banner_event_focus_v4.md`

## 2026-03-11 GroupId Fallback, Console Selection, And Weekly Replay Closure

- preview group focus now has an explicit fallback path for proxy-bearing groups that have a valid `groupId` but no usable instance index:
  - `resolveSelectionTargetsByGroupId(groupId)` first tries instance-index resolution
  - if that path is unavailable, it now falls back to `collectGroupEntityIds(...)`
  - the fallback is required for paperspace proxy groups such as `paperspace_combo_hatch_group_focus`
  - this keeps the preview provenance contract aligned with the real Step186 proxy/import model instead of forcing synthetic instance metadata into proxy groups

- the default Step186 preview provenance matrix for this closure is intentionally fully deterministic:
  - preview provenance `27 / 27`
  - deterministic entry `27 / 27`
  - focus checks `11`
  - all cases enter through explicit `initialEntityId` or equivalent deterministic entry, not sparse hit-grid guessing

- solver flow console selection now follows the latest replay/focus state rather than the originally clicked row:
  - `lastRequestHistoryIndex` is set from the latest replay request
  - `lastEventHistoryIndex` is set from the latest focus event
  - this prevents stale-selection drift after:
    - recent replay
    - recent event click
  - the console selection contract therefore reflects the active solver flow state instead of the historical click origin

- the canonical solver action-flow contract for this closure is:
  - `panel_count = 4`
  - `flow_check_count = 23`
  - `request_count = 30`
  - `invoke_request_count = 2`
  - `focus_request_count = 9`
  - `flow_request_count = 18`
  - `replay_request_count = 1`
  - `event_count = 30`
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

- local/gate/weekly replay propagation for this closure requires four implementation details to stay aligned:
  - `tools/local_ci.sh` must initialize every newly added summary field up front
  - `tools/editor_gate.sh` must export every parsed field before calling the summary writer
  - `tools/editor_weekly_validation.sh` must define the same formatting helpers used by the standalone consumer scripts
  - consumer renderers must render missing-data states explicitly rather than silently flattening them to `0` or `-`

- this round fixed four real propagation bugs:
  - `tools/local_ci.sh` had no default for `SOLVER_ACTION_PANEL_SMOKE_CONSOLE_SELECTION_CHECK_COUNT`, causing an `unbound variable` failure in a fresh run
  - `tools/editor_gate.sh` did not export `SOLVER_ACTION_PANEL_SMOKE_CONSOLE_SELECTION_CHECK_COUNT`
  - `tools/editor_gate.sh` also missed `ASSEMBLY_ROUNDTRIP_CTEST_IMPORT_ASSEMBLY_GROUP_LAYOUT_SOURCE_CASE_COUNT` and `...CASE_DETAILS_B64`
  - the embedded python in `tools/editor_weekly_validation.sh` referenced `fmt_group_layout_case_details(...)` without defining it

- weekly replay remains the preferred propagation validator for this closure:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - `bash tools/editor_weekly_validation.sh`
  - this validates the report/dashboard/checker layer against a fresh gate summary without paying the cost of rerunning gate logic again

- the canonical fresh rendered consumer artifacts for this closure are:
  - `build/ci_artifact_summary_group_focus_console_selection.md`
  - `build/step176_dashboard_weekly_20260311_033020.md`
  - `build/step176_weekly_group_focus_console_selection.md`

## 2026-03-11 Focus-Current Console Closure And Fresh Gate/Weekly Replay

- the root cause of the fresh solver regression was not in the flow state itself but in the console label formatting path:
  - `solver_action_flow_console.js` stored active focus in `{ kind, value }`
  - `formatRequestTarget(...)` and `formatEventTarget(...)` only read `focusKind/focusValue`
  - the active focus label therefore rendered as empty
  - the `focus-current` console action never appeared even though debug state and recent history were already correct

- the fix intentionally broadened the target formatter contract instead of special-casing the smoke:
  - `formatRequestTarget(...)` now falls back to `request.kind / request.value`
  - `formatEventTarget(...)` now falls back to `event.kind / event.value`
  - this keeps the visible solver console aligned with the internal request/event model rather than teaching the smoke to accept a missing button

- the smoke contract was also tightened to avoid double-counting the console focus-click path:
  - `focus-current:console` remains part of `flow_action_history`
  - counters now increment only after the real post-click checks complete
  - fresh expectations for `event_focus_check_count`, `dom_event_count`, and `dom_request_event_count` were updated to match the actual request/event semantics instead of the old over-counted totals

- the canonical fresh solver action-flow contract for this closure is:
  - `panel_count = 4`
  - `flow_check_count = 26`
  - `request_count = 33`
  - `invoke_request_count = 4`
  - `focus_request_count = 10`
  - `flow_request_count = 18`
  - `replay_request_count = 1`
  - `event_count = 33`
  - `event_focus_check_count = 6`
  - `banner_check_count = 8`
  - `banner_focus_click_check_count = 1`
  - `console_check_count = 5`
  - `console_flow_check_count = 3`
  - `console_event_focus_check_count = 1`
  - `console_replay_check_count = 1`
  - `console_event_click_check_count = 1`
  - `console_focus_click_check_count = 1`
  - `console_selection_check_count = 2`
  - `status_check_count = 6`
  - `status_click_check_count = 1`
  - `keyboard_check_count = 18`
  - `panel_cycle_check_count = 2`
  - `panel_keyboard_check_count = 11`
  - `panel_keyboard_invoke_check_count = 1`
  - `panel_keyboard_flow_check_count = 10`
  - `jump_check_count = 3`
  - `jump_request_count = 3`
  - `jump_event_count = 3`
  - `import_check_count = 1`
  - `clear_check_count = 1`

- fresh Step186 / preview / assembly closure values are:
  - `step186 preview artifact prep = 17 / 17`
  - `preview provenance = 29 / 29`
  - `deterministic entry = 29 / 29`
  - `focus checks = 13`
  - `preview artifact smoke = 17 / 17`
  - `preview artifact validator failure injection = 10 / 10`
  - `assembly roundtrip ctest = 4 / 4`
  - `import_entity_count = 148`
  - `import_assembly_tracked_count = 132`
  - `import_assembly_group_count = 55`
  - `import_derived_proxy_count = 61`
  - `import_exploded_origin_count = 39`
  - `import_viewport_count = 13`
  - `import_viewport_layout_count = 11`
  - `import_viewport_case_count = 10`

- this round also closed a fresh weekly replay consumer bug:
  - `tools/editor_weekly_validation.sh` referenced `panel_cycle_checks` in its embedded weekly formatter
  - the variable was not passed into the format call
  - a fresh `RUN_GATE=0 GATE_SUMMARY=build/editor_gate_summary.json bash tools/editor_weekly_validation.sh` run therefore failed with `KeyError: 'panel_cycle_checks'`
  - the weekly replay path now defines and passes that formatter argument, so the replay, dashboard, report, and checker stay aligned with the fresh gate summary

- the preferred propagation validator for this closure remains weekly replay over a fresh gate summary:
  - `RUN_GATE=0`
  - `GATE_SUMMARY=build/editor_gate_summary.json`
  - `bash tools/editor_weekly_validation.sh`
  - this validates the weekly/dashboard/report/checker layer without paying for another full gate execution

- the canonical fresh artifacts for this closure are:
  - `build/local_ci_summary.json`
  - `build/editor_gate_summary.json`
  - `build/editor_weekly_validation_summary.json`
  - `build/ci_artifact_summary_focus_current_fix.md`
  - `build/step176_dashboard_weekly_20260311_060741.md`
  - `build/step176_weekly_focus_current_fix.md`
