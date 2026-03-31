# Step287 Selection Property Fact Consolidation Verification

## Scope

Verify that:

- property metadata facts now come from the shared presenter-side builder
- selection summary facts and property metadata stay aligned on provenance/effective style
- panel-only metadata rows still appear for hatch/dimension/source-proxy scenarios
- editing actions and read-only flows stay unchanged

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `editor_commands.test.js`: `291/291` pass

Coverage confirmed:

- `buildPropertyMetadataFacts(...)` reuses shared provenance/style facts
- property-only rows still appear for `source-type`, `edit-mode`, `proxy-kind`
- hatch metadata rows remain visible
- dimension metadata and dimension-text placement rows remain visible
- existing selection presentation contracts stay green

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_classic_leader_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_table_smoke.js
```

Artifacts:

- [editor_selection_summary summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_003817/summary.json)
- [editor_source_group summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_003817/summary.json)
- [editor_classic_leader summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_classic_leader_smoke/20260329_003817/summary.json)
- [editor_table summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_table_smoke/20260329_003852/summary.json)

Confirmed:

- property panel metadata still matches selection-summary provenance/style rows during layer and style edits
- imported source-group metadata still renders correctly
- classic leader source-text/guide metadata still renders correctly
- table proxy metadata still renders correctly

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
