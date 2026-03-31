# Step295 Property Panel Common Fields Extraction Verification

## Scope

Verify that:

- common property fields now come from [property_panel_common_fields.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_common_fields.js)
- style reset actions now come from the same module
- `use-layer-*` actions and proxy/released field flows remain stable

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_common_fields.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_common_fields.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_entity_fields.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_current_layer_defaults.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `property_panel_common_fields.test.js`: `3/3` pass
- `property_panel_entity_fields.test.js`: `4/4` pass
- `property_panel_current_layer_defaults.test.js`: `3/3` pass
- `editor_commands.test.js`: `297/297` pass

Coverage confirmed:

- common field labels and names remain stable
- imported layer promotion behavior remains stable
- style reset action labels and patch messages remain stable

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step295
```

Artifacts:

- [editor_selection_summary summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_014405/summary.json)
- [editor_insert_group summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_014405/summary.json)
- [editor_insert_attribute summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_014405/summary.json)
- [editor_ui_flow summary.json](/tmp/editor-ui-flow-step295/summary.json)

Confirmed:

- `use-layer-color`, `use-layer-line-type`, `use-layer-line-weight`, and `use-default-line-type-scale` still appear and execute correctly
- proxy/released text flows still preserve their field visibility contracts
- broader editor UI flow remains green after common-field extraction

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
