# Step296 Property Panel Info Rows Extraction Verification

## Scope

Verified the extraction of property-panel info row builders into:

- `tools/web_viewer/ui/property_panel_info_rows.js`

Updated orchestration in:

- `tools/web_viewer/ui/property_panel.js`

Added unit coverage in:

- `tools/web_viewer/tests/property_panel_info_rows.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_info_rows.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_info_rows.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_015359/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_015225/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_015225/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_015225/summary.json`

Observed existing unrelated red signal:

- `/tmp/editor-ui-flow-step296/summary.json`

`editor_ui_flow_smoke.sh` still fails at `selection_provenance_summary`, matching the same pre-existing failure point already seen in `/tmp/editor-ui-flow-step295/summary.json`, `/tmp/editor-ui-flow-step294/summary.json`, and `/tmp/editor-ui-flow-step290/summary.json`. This Step296 extraction did not introduce a new `editor_ui_flow` regression.

## Contract Notes

The extraction preserved these downstream property metadata contracts:

- source group `group-id / group-bounds`
- insert group `block-name / peer-layouts / peer-targets`
- released insert archive `released-from / released-group-id / released-peer-targets`
- generic entity metadata rows forwarded from presenter facts
