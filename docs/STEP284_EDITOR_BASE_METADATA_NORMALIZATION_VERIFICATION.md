# Step284 Editor Base Metadata Normalization Verification

## Scope

Verify that:

- imported base entity metadata now comes from one shared object-level helper
- editor snapshot restore semantics remain intact
- CADGF import still preserves `layout_name` fallback and own-property `space` handling
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

- `entity_import_normalization.test.js`: `6/6` pass
- `import_normalization.test.js`: `2/2` pass
- `editor_import_adapter.test.js`: `5/5` pass
- `editor_commands.test.js`: `290/290` pass

Coverage confirmed:

- editor-style aliases normalize base metadata into canonical fields
- CADGF snake_case aliases still normalize correctly
- `layout_name` fallback remains available through helper configuration
- `space` is still skipped when CADGF payload lacks an own `space` key
- import-boundary behavior from Step280-283 remains green

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```

Artifacts:

- [editor_selection_summary summary.json](../build/editor_selection_summary_smoke/20260329_001411/summary.json)
- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_001411/summary.json)
- [editor_insert_attribute summary.json](../build/editor_insert_attribute_smoke/20260329_001411/summary.json)

Confirmed:

- provenance/effective-style summary still works
- source-group workflows still work
- insert-attribute workflows still work after the base metadata extraction

## Perf Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step284 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- editor_real_scene_perf summary.json: `/tmp/editor-real-scene-perf-step284/20260328_161410/summary.json`

Confirmed:

- run status is `PASS`
- `gate_would_fail=false`
- import, pick, box query, and drag stages all stay green

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
