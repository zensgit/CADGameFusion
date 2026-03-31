# Step295 Property Panel Common Fields Extraction Design

## Goal

Extract the remaining common property fields and style reset actions out of [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js), so the property panel moves closer to a pure branch/render shell.

This step follows the same pattern as Steps 291 to 294:

- dedicated local modules build descriptors
- property panel renders descriptors
- command execution behavior stays unchanged

## Problem

Before this step, [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still inlined the last large cross-entity field cluster:

- `Layer ID`
- `Color Override (#RRGGBB)`
- `Visible`
- `Line Type Override`
- `Line Weight Override`
- `Line Type Scale Override`

and it still inlined the style reset actions:

- `Use Layer Color`
- `Use Layer Line Type`
- `Use Layer Line Weight`
- `Use Default Line Type Scale`

That meant the main render path still mixed:

- field labels and names
- imported-layer promotion behavior
- style-source reset decisions
- patch/status wording

## Design

### 1. Add a dedicated common-fields module

Create [property_panel_common_fields.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_common_fields.js) with:

- `buildCommonPropertyFieldDescriptors(...)`
- `buildStyleActionDescriptors(...)`

`buildCommonPropertyFieldDescriptors(...)` returns field/toggle descriptors for:

- `layerId`
- `color`
- `visible`
- `lineType`
- `lineWeight`
- `lineTypeScale`

`buildStyleActionDescriptors(...)` returns action descriptors for the four style reset buttons.

### 2. Keep property_panel as the render shell

[property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still owns:

- `patchSelection(...)`
- `appendFieldDescriptors(...)`
- `addActionRow(...)`
- render ordering and branch sequencing

It now delegates common field and style action assembly to the new module.

### 3. Preserve common-field contracts

This step intentionally preserves the existing field names, labels, and style-action ids used by smoke:

- `layerId`
- `color`
- `Visible`
- `lineType`
- `lineWeight`
- `lineTypeScale`
- `use-layer-color`
- `use-layer-line-type`
- `use-layer-line-weight`
- `use-default-line-type-scale`

## Files

- [property_panel_common_fields.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_common_fields.js)
- [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js)
- [property_panel_common_fields.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_common_fields.test.js)

## Why This Is The Right Cut

This finishes the last big cross-entity field cluster:

1. Step293 extracted no-selection current-layer defaults
2. Step294 extracted entity-specific edit fields
3. Step295 extracts common property/style fields

After this, [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) is mostly branch orchestration plus a thin render shell, which is the right stopping point before any deeper UI-level redesign.
