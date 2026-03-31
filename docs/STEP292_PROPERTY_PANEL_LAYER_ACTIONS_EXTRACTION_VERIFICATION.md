# Step292 Property Panel Layer Actions Extraction Verification

## Scope

Verify that:

- `layer` and `current space/layout` property-panel actions now come from [property_panel_layer_actions.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_layer_actions.js)
- [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still renders the same action rows
- released ATTDEF property-panel selection now has a real click-path smoke, not just an action-presence assertion

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_layer_actions.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_layer_actions.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_group_actions.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `property_panel_layer_actions.test.js`: `3/3` pass
- `property_panel_group_actions.test.js`: `3/3` pass
- `editor_commands.test.js`: `297/297` pass

Coverage confirmed:

- current-space/model/layout button labels remain stable
- selected-layer action labels remain stable
- Step291 group/released action labels remain stable

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_space_layout_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step292
```

Artifacts:

- [editor_space_layout summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_space_layout_smoke/20260329_012011/summary.json)
- [editor_current_layer summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_current_layer_smoke/20260329_012011/summary.json)
- [editor_layer_session summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_layer_session_smoke/20260329_012011/summary.json)
- [editor_selection_summary summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_012011/summary.json)
- [editor_insert_attribute summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_012011/summary.json)
- [editor_ui_flow summary.json](/tmp/editor-ui-flow-step292/summary.json)

Confirmed:

- no-selection property panel still exposes `Use Model Space` and `Use Layout ...` actions correctly
- selected-layer property panel still exposes `Make Current`, lock/unlock, isolate/off/freeze, restore/thaw session actions correctly
- released ATTDEF property-panel flow now clicks `select-released-insert-group` and still reselects the surviving insert member correctly
- broader editor UI flow remains green after layer/current-space action extraction

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
