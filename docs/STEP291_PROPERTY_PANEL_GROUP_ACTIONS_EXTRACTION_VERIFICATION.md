# Step291 Property Panel Group Actions Extraction Verification

## Scope

Verify that:

- source-group, insert-group, and released-insert property-panel actions now come from [property_panel_group_actions.js](../tools/web_viewer/ui/property_panel_group_actions.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js) still renders the same action rows
- brittle action labels and end-to-end UI flows remain stable

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_group_actions.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_group_actions.test.js
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `property_panel_group_actions.test.js`: `3/3` pass
- `editor_commands.test.js`: `297/297` pass

Coverage confirmed:

- source-group dimension action labels remain stable
- insert-group peer and editable-text action labels remain stable
- released-insert peer navigation and group action labels remain stable

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_classic_leader_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_table_smoke.js
bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step291
```

Artifacts:

- [editor_selection_summary summary.json](../build/editor_selection_summary_smoke/20260329_011515/summary.json)
- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_011515/summary.json)
- [editor_insert_attribute summary.json](../build/editor_insert_attribute_smoke/20260329_011515/summary.json)
- [editor_classic_leader summary.json](../build/editor_classic_leader_smoke/20260329_011515/summary.json)
- [editor_table summary.json](../build/editor_table_smoke/20260329_011515/summary.json)
- editor_ui_flow summary.json: `/tmp/editor-ui-flow-step291/summary.json`

Confirmed:

- selection-summary/property-panel action availability remains stable
- source-group and insert-text workflows remain green
- classic LEADER and TABLE source-action workflows remain green
- broader editor UI flow remains green after action-builder extraction

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
