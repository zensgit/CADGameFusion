# Step315 Property Panel Active Render Verification

## Scope

Verified active-selection render extraction in:

- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/property_panel_active_render.js`
- `tools/web_viewer/tests/property_panel_active_render.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_active_render.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `editor_selection_summary` summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_103931/summary.json`
- `editor_source_group` summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_103931/summary.json`
- `editor_insert_group` summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_103931/summary.json`
- `editor_insert_attribute` summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_103931/summary.json`

Observed existing unrelated red signal:

- `editor_ui_flow` clean rerun artifact at `/tmp/editor-ui-flow-step315-rerun/flow_result.json` still shows the prior `selection_provenance_summary` timeout signature

Additional note:

- the first observe run at `/tmp/editor-ui-flow-step315/flow_result.json` hit an early `#cad-clear-doc` click timeout, but the clean rerun returned to the prior long-standing signature

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`
