# Step235: Editor Imported TABLE Proxy Verification

## Commands

From `deps/cadgamefusion`:

```bash
./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input ./tests/plugin_data/step186_table_sample.dxf --out ./build/step235_table_preview_a
node --check tools/web_viewer/scripts/editor_table_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
ctest --test-dir build --output-on-failure -R 'test_dxf_table_metadata_run'
node tools/web_viewer/scripts/editor_table_smoke.js
node tools/web_viewer/scripts/editor_mleader_smoke.js
git diff --check
```

## Expected Contract

- real imported `TEXT + text_kind=table` is inferred as `TABLE / proxy / table`
- adapter assigns a stable synthetic single-entity `groupId` when the imported payload has none
- imported `TABLE` keeps `text_kind=table` while gaining `sourceTextPos / sourceTextRotation`
- direct property edits keep proxy provenance intact
- `srcplace` restores the imported placement
- `srcedit` releases the note to native editable text and strips source/group provenance while keeping `text_kind=table`
- text-only `TABLE` exposes a minimal self-anchor guide, but does not invent driver/elbow/landing actions

## Real Import Artifact

In [step235_table_preview_a/document.json](../build/step235_table_preview_a/document.json):

- entity `1` is real imported `type=7` text
- `text_kind = table`
- there is no explicit `source_type / edit_mode / proxy_kind / group_id` yet in preview output
- the editor upgrade therefore happens on import, not in the importer

## Verification Notes

- `node --check tools/web_viewer/scripts/editor_table_smoke.js`: PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`270/270`)
- `ctest -R test_dxf_table_metadata_run`: PASS
- `node tools/web_viewer/scripts/editor_table_smoke.js`: PASS
- `node tools/web_viewer/scripts/editor_mleader_smoke.js`: PASS
- `git diff --check`: PASS

## Key Results

Command-layer regression confirmed:

- adapter import maps real imported `table` text to `sourceType=TABLE`, `editMode=proxy`, `proxyKind=table`
- synthetic single-entity group is stable (`groupId = 1` for the real fixture)
- direct patch updates `value / position / rotation` while preserving proxy provenance
- `selection.sourceResetTextPlacement` returns the note to `24,12`
- `selection.sourceEditGroupText` releases a single imported `TABLE` proxy with message `Released source group and selected source text (1 of 1 entities)`

Browser artifacts:

- [editor_table_smoke summary.json](../build/editor_table_smoke/20260324_200758/summary.json)
- [editor_mleader_smoke summary.json](../build/editor_mleader_smoke/20260324_200758/summary.json)

Key browser assertions from `editor_table_smoke`:

- `before.details.items["group-source"] == "TABLE / table"`
- `before.property.meta["text-kind"] == "table"`
- `after_proxy_edit.entity.value == "TABLE_PROXY_EDITED"`
- `after_reset.entity.position == { "x": 24, "y": 12 }`
- `after_fit.statusText == "Fit Source Group: TABLE 1"`
- `after_release_edit.statusText == "Released source group and selected source text (1 of 1 entities)"`
- `after_released_patch.entity.value == "TABLE_RELEASED_EDIT"`

The concurrent `editor_mleader_smoke` pass confirms the broadened direct-editable source-text contract did not regress the existing imported `MLEADER` path.
