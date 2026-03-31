# Step293 Property Panel Current Layer Defaults Extraction Design

## Goal

Extract the no-selection `current layer / current space-layout` default content and editable current-layer field descriptors out of [property_panel.js](../tools/web_viewer/ui/property_panel.js), while keeping property panel as the render shell.

This continues the same local-module pattern used in Step291 and Step292:

- presenter owns selection facts and note policy
- dedicated local modules own descriptor assembly
- property panel owns DOM rendering and overall branch sequencing

## Problem

After Step292, [property_panel.js](../tools/web_viewer/ui/property_panel.js) still embedded one large no-selection block:

- current-layer note text
- current-space/current-layout/current-layer info rows
- current-layer color/line type/line weight field descriptors
- current-layer field status-message policy

That block was no longer action-heavy, but it still mixed:

- content assembly
- field default values
- update callback wiring
- status wording

in the main property-panel file.

## Design

### 1. Add a dedicated current-layer-defaults module

Create [property_panel_current_layer_defaults.js](../tools/web_viewer/ui/property_panel_current_layer_defaults.js) with two builders:

- `buildCurrentLayerDefaultContent(...)`
- `buildCurrentLayerFieldDescriptors(...)`

`buildCurrentLayerDefaultContent(...)` returns:

- the no-selection note descriptor
- the current-space/current-layout/current-layer info rows

`buildCurrentLayerFieldDescriptors(...)` returns field descriptors containing:

- field config for `addField(...)`
- `onChange` callbacks that call `updateCurrentLayer(...)`
- success/failure status wording

### 2. Keep property_panel as the render shell

[property_panel.js](../tools/web_viewer/ui/property_panel.js) still owns:

- `addNote(...)`
- `addInfo(...)`
- `addField(...)`
- no-selection render timing
- current-space action rendering via [property_panel_layer_actions.js](../tools/web_viewer/ui/property_panel_layer_actions.js)

The only change is that `renderCurrentLayerDefaults()` now consumes descriptors from the new module instead of building them inline.

### 3. Preserve current-layer field and info contracts

This step intentionally preserves:

- `current-layer-note`
- `current-space`
- `current-layout`
- `current-layer`
- `current-layer-color`
- `current-layer-state`
- the three field names `currentLayerColor`, `currentLayerLineType`, `currentLayerLineWeight`

Those keys are part of current smoke coverage and remain unchanged.

## Files

- [property_panel_current_layer_defaults.js](../tools/web_viewer/ui/property_panel_current_layer_defaults.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [property_panel_current_layer_defaults.test.js](../tools/web_viewer/tests/property_panel_current_layer_defaults.test.js)

## Why This Is The Right Cut

This is the natural follow-up to the action extractions:

1. Step291 extracted group/released action builders
2. Step292 extracted layer/current-space action builders
3. Step293 extracts no-selection default content and field descriptors

After this, [property_panel.js](../tools/web_viewer/ui/property_panel.js) is much closer to a pure orchestration and render file, which makes the next split around entity edit fields much cleaner.
