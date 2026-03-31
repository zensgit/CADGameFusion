# Step285 Editor Annotation Metadata Normalization Verification

## Scope

Verify that:

- imported annotation/proxy geometry metadata now finalizes through one shared helper
- editor snapshot restore still keeps its `explicit -> text -> dimension` fallback order
- CADGF dimension proxy import still keeps its `dimension -> text` fallback order
- broader editor import/runtime flows remain green

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/entity_import_normalization.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js
```

## Targeted Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/entity_import_normalization.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/import_normalization.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_import_adapter.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `entity_import_normalization.test.js`: `8/8` pass
- `import_normalization.test.js`: `2/2` pass
- `editor_import_adapter.test.js`: `5/5` pass
- `editor_commands.test.js`: `290/290` pass

Coverage confirmed:

- editor-style proxy fallback keeps text position ahead of dimension position
- CADGF dimension proxy fallback keeps dimension position ahead of text position
- anchor, landing, elbow, and source-anchor driver metadata still normalize correctly
- Step280-284 import-boundary behavior remains green

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_classic_leader_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_table_smoke.js
```

Artifacts:

- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_002433/summary.json)
- [editor_classic_leader summary.json](../build/editor_classic_leader_smoke/20260329_002433/summary.json)
- [editor_table summary.json](../build/editor_table_smoke/20260329_002433/summary.json)

Confirmed:

- DIMENSION source text metadata still behaves correctly
- classic LEADER anchor/landing/elbow/driver metadata still behaves correctly
- TABLE proxy text metadata still behaves correctly

## Perf Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step285 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- editor_real_scene_perf summary.json: `/tmp/editor-real-scene-perf-step285/20260328_162432/summary.json`

Confirmed:

- run status is `PASS`
- `gate_would_fail=false`
- import, pick, box query, and drag stages remain green

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
