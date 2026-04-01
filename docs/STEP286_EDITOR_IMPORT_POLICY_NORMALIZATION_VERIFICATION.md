# Step286 Editor Import Policy Normalization Verification

## Scope

Verify that:

- imported text-value resolution now uses one shared policy helper
- imported visibility resolution now uses one shared policy helper
- editor snapshot restore keeps its strict-boolean visibility and explicit-first text policy
- CADGF import keeps its bool-int visibility and text-first fallback policy
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

- `entity_import_normalization.test.js`: `10/10` pass
- `import_normalization.test.js`: `2/2` pass
- `editor_import_adapter.test.js`: `5/5` pass
- `editor_commands.test.js`: `290/290` pass

Coverage confirmed:

- legacy ATTDEF defaults still override later text-value candidates
- editor snapshot restore still prefers explicit value ahead of imported text payload
- CADGF import can still prefer text payload ahead of explicit fallback
- editor snapshot visibility still hides only on strict `false`
- CADGF visibility still honors `true/false` and `1/0`
- insert-text-proxy `attributeInvisible` fallback remains intact

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_classic_leader_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_table_smoke.js
```

Artifacts:

- [editor_insert_attribute summary.json](../build/editor_insert_attribute_smoke/20260329_002908/summary.json)
- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_002908/summary.json)
- [editor_classic_leader summary.json](../build/editor_classic_leader_smoke/20260329_002908/summary.json)
- [editor_table summary.json](../build/editor_table_smoke/20260329_002908/summary.json)

Confirmed:

- attribute import and insert-text proxy flows remain green
- source-group import/runtime behavior remains green
- leader and dimension-adjacent metadata flows remain green
- table proxy/text flows remain green

## Perf Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step286 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- editor_real_scene_perf summary.json: `/tmp/editor-real-scene-perf-step286/20260328_162907/summary.json`

Confirmed:

- run status is `PASS`
- `gate_would_fail=false`
- import, pick, box query, and drag stages remain green

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
