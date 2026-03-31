# Step280 Editor Import Normalization Verification

## Scope

Verify that:

- external import normalization moved out of `DocumentState.restore()`
- editor import runtime still works through real browser entrypoints
- provenance-heavy editor flows still pass after the import boundary change

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/editor_import_adapter.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/document_json_adapter.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js
```

## Targeted Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_import_adapter.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `editor_import_adapter.test.js`: `4/4` pass
- `editor_commands.test.js`: `290/290` pass

Coverage added by the new targeted test:

- convert-cli payloads normalize into editor snapshots before restore
- editor envelope payloads restore document/selection/snap/view state through the shared adapter
- `hydrateDocument(...)` now normalizes convert-cli payloads before restore
- `DocumentState.restore()` rejects raw `CADGF` and raw `convert_cli` payloads

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```

Artifacts:

- [editor_selection_summary summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260328_235028/summary.json)
- [editor_source_group summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260328_235028/summary.json)
- [editor_insert_attribute summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260328_235028/summary.json)

Confirmed:

- real `?cadgf=` editor import path still works
- provenance/effective-style summary still works
- source-group workflows still work
- imported insert-attribute workflows still work

## Additional Probe

Executed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js --mode observe --doc /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json --outdir /tmp/editor-real-scene-perf-step280 --pick-samples 100 --box-samples 50 --drag-samples 20
```

Artifact:

- [editor_real_scene_perf summary.json](/tmp/editor-real-scene-perf-step280/20260328_155100/summary.json)

Result:

- import path ran far enough for `pick` and `box_query` metrics to populate
- the run ended with `DRAG_EXEC_FAIL=1`

This probe was not used as the acceptance gate for Step280 because the failure is in the drag stage, not in import normalization.

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
