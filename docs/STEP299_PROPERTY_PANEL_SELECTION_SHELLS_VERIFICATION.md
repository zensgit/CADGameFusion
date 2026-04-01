# Step299 Property Panel Selection Shells Verification

## Scope

Verified extraction into:

- `tools/web_viewer/ui/property_panel_selection_shells.js`
- `tools/web_viewer/ui/property_panel_branch_context.js`

Updated shell:

- `tools/web_viewer/ui/property_panel.js`

Added unit coverage:

- `tools/web_viewer/tests/property_panel_selection_shells.test.js`
- `tools/web_viewer/tests/property_panel_branch_context.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_selection_shells.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_branch_context.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shells.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_context.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_021038/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_021038/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_021038/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_021038/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_current_layer_smoke/20260329_021038/summary.json`

Observed existing unrelated red signal:

- `/tmp/editor-ui-flow-step299/summary.json`

`editor_ui_flow_smoke.sh` still fails at `selection_provenance_summary` with the same timeout already seen in prior steps. Step299 selection-shell extraction did not introduce a new `editor_ui_flow` failure mode.
