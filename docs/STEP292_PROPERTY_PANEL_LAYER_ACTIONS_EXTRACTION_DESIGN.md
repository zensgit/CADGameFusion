# Step292 Property Panel Layer Actions Extraction Design

## Goal

Extract the remaining `layer` and `current space/layout` action assembly out of [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js), and close the released-insert property-panel click gap in smoke coverage.

This step keeps the same architectural rule used in Step291:

- presenter still owns selection facts and note policy
- property panel still owns DOM rendering and branch sequencing
- dedicated builder modules own action descriptor assembly

## Problem

After Step291, the group-based actions were modularized, but [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still embedded two more large action clusters:

- no-selection `current space/layout` actions
- selected-layer actions such as `Make Current`, `Lock Layer`, `Restore Layers`, and `Thaw Layers`

There was also one test gap:

- [editor_insert_attribute_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js) asserted that `select-released-insert-group` existed, but did not actually click the property-panel button

## Design

### 1. Add a dedicated layer-actions module

Create [property_panel_layer_actions.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_layer_actions.js) with pure builders:

- `buildCurrentSpaceActions(...)`
- `buildLayerActions(...)`

These builders:

- accept already-known layer/current-space state
- accept callback dependencies such as `setCurrentSpaceContext`, `useLayer`, `lockLayer`, `restoreLayerIsolation`
- return plain `{ id, label, onClick }` descriptors

### 2. Keep property_panel as the render shell

[property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still owns:

- `addActionRow(...)`
- current-layer info rows and editable current-layer style fields
- branch sequencing and note handling

It now delegates action assembly to:

- [property_panel_group_actions.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_group_actions.js)
- [property_panel_layer_actions.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_layer_actions.js)

### 3. Close the released-insert property-panel click gap

Update [editor_insert_attribute_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js) so released ATTDEF coverage no longer stops at action presence.

The smoke now clicks:

- `select-released-insert-group`

and verifies that the property-panel action reselects the surviving released insert group member, instead of only validating the command path.

## Files

- [property_panel_layer_actions.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_layer_actions.js)
- [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js)
- [property_panel_layer_actions.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_layer_actions.test.js)
- [editor_insert_attribute_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js)

## Why This Is The Right Cut

This completes the action-extraction pattern for the highest-value remaining local action clusters without changing user-facing behavior:

1. Step291 extracted group/released actions
2. Step292 extracts layer/current-space actions

That leaves [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) noticeably closer to a render shell plus edit-field host, which is the right setup before splitting fields or metadata into separate local modules.
