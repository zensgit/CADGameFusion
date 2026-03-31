# Step281 Editor Import Shared Normalization Verification

## Scope

Verify that:

- shared import-normalization helpers now back both `documentState` and the CADGF adapter
- the new helper extraction does not break editor import/runtime flows
- the perf smoke no longer false-fails on paper-space fixtures after import

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/import_normalization.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js
```

## Targeted Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/import_normalization.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_import_adapter.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `import_normalization.test.js`: `2/2` pass
- `editor_import_adapter.test.js`: `4/4` pass
- `editor_commands.test.js`: `290/290` pass

Coverage confirmed:

- shared color/bool/text-kind normalization semantics stay stable
- legacy ATTDEF default derivation works for both editor-style and CADGF-style payloads
- the Step280 shared import adapter still restores convert-cli and editor envelope payloads correctly
- broader editor behavior remains green after the helper extraction

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```

Artifacts:

- [editor_selection_summary summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260328_235812/summary.json)
- [editor_source_group summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260328_235812/summary.json)
- [editor_insert_attribute summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260328_235812/summary.json)

Confirmed:

- `?cadgf=` runtime import still works
- provenance/effective-style summaries still work after helper extraction
- source-group workflows still work
- imported insert-attribute workflows still work

## Perf Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step281 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- [editor_real_scene_perf summary.json](/tmp/editor-real-scene-perf-step281/20260328_155747/summary.json)

Confirmed:

- run status is `PASS`
- `gate_would_fail=false`
- import, pick, box query, and drag phases all execute without the prior `DRAG_EXEC_FAIL=1`

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
