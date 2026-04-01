# Step283 Editor Attribute Metadata Normalization Verification

## Scope

Verify that:

- imported attribute/text metadata now comes from one shared object-level helper
- editor snapshot restore semantics remain intact
- CADGF import still honors legacy ATTDEF default derivation and attribute-flag fallbacks
- broader editor import/runtime flows stay green

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

- `entity_import_normalization.test.js`: `4/4` pass
- `import_normalization.test.js`: `2/2` pass
- `editor_import_adapter.test.js`: `5/5` pass
- `editor_commands.test.js`: `290/290` pass

Coverage confirmed:

- editor-style aliases honor explicit attribute booleans
- CADGF snake_case input still derives attribute booleans from flags when booleans are absent
- ATTDEF legacy default derivation still works through the shared helper
- import-boundary behavior from Step280-282 remains green

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```

Artifacts:

- [editor_selection_summary summary.json](../build/editor_selection_summary_smoke/20260329_000848/summary.json)
- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_000848/summary.json)
- [editor_insert_attribute summary.json](../build/editor_insert_attribute_smoke/20260329_000848/summary.json)

Confirmed:

- provenance/effective-style summary still works
- source-group flows still work
- insert-attribute flows, including ATTDEF-specific behavior, still work

## Perf Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step283 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- editor_real_scene_perf summary.json: `/tmp/editor-real-scene-perf-step283/20260328_160847/summary.json`

Confirmed:

- run status is `PASS`
- `gate_would_fail=false`
- import, pick, box query, and drag stages all stay green after the metadata extraction

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
