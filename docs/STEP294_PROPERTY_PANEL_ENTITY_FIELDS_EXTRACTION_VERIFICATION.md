# Step294 Property Panel Entity Fields Extraction Verification

## Scope

Verify that:

- text and geometry field assembly now comes from [property_panel_entity_fields.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_entity_fields.js)
- read-only text escape hatches still expose the same field sets
- geometry/text property-panel flows remain green

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_entity_fields.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_entity_fields.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_current_layer_defaults.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_layer_actions.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `property_panel_entity_fields.test.js`: `4/4` pass
- `property_panel_current_layer_defaults.test.js`: `3/3` pass
- `property_panel_layer_actions.test.js`: `3/3` pass
- `editor_commands.test.js`: `297/297` pass

Coverage confirmed:

- full text-edit field labels and names remain stable
- ATTDEF insert-proxy field labels and optional position fields remain stable
- line/arc geometry field labels remain stable
- polyline closed toggle still forwards the same patch and message

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_table_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_mleader_smoke.js
bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step294
```

Artifacts:

- [editor_insert_group summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_013316/summary.json)
- [editor_insert_attribute summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_013316/summary.json)
- [editor_table summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_table_smoke/20260329_013316/summary.json)
- [editor_mleader summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_mleader_smoke/20260329_013316/summary.json)
- [editor_ui_flow summary.json](/tmp/editor-ui-flow-step294/summary.json)

Confirmed:

- INSERT proxy text still withholds or exposes `position.x`/`rotation` exactly as before
- released ATTDEF text still exposes the full text edit field set
- TABLE and MLEADER source-text proxy fields remain green
- broader editor UI flow remains green after entity-field extraction

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
