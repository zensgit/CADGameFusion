# Step294 Property Panel Entity Fields Extraction Design

## Goal

Extract the property-panel entity edit field assembly for text and geometry entities out of [property_panel.js](../tools/web_viewer/ui/property_panel.js), while keeping the render shell and patch execution behavior unchanged.

This follows the same local-descriptor pattern used in Steps 291 to 293:

- dedicated local modules build descriptors
- property panel renders those descriptors
- command execution and branch sequencing stay local

## Problem

Before this step, [property_panel.js](../tools/web_viewer/ui/property_panel.js) still inlined:

- full text edit fields
- INSERT proxy text field variants
- line geometry fields
- polyline closed toggle
- circle and arc geometry fields

This mixed:

- visible field labels and names
- read-only escape-hatch field selection
- patch message wording
- entity-type branching

in the main render function.

## Design

### 1. Add a dedicated entity-fields module

Create [property_panel_entity_fields.js](../tools/web_viewer/ui/property_panel_entity_fields.js) with descriptor builders:

- `buildFullTextEditFieldDescriptors(...)`
- `buildInsertProxyTextFieldDescriptors(...)`
- `buildSingleEntityEditFieldDescriptors(...)`

These builders accept:

- the current entity
- `patchSelection(...)`
- `buildPatch(...)`

and return plain field/toggle descriptors.

### 2. Keep property_panel as the render shell

[property_panel.js](../tools/web_viewer/ui/property_panel.js) still owns:

- `addField(...)`
- `addToggle(...)`
- `patchSelection(...)`
- read-only / released / locked / default branch sequencing

It now uses `appendFieldDescriptors(...)` to render descriptor lists, instead of inlining the field assembly logic.

### 3. Preserve field contracts

This step intentionally preserves the existing field names and labels that smoke depends on:

- `value`
- `position.x`
- `position.y`
- `height`
- `rotation`
- `start.x`, `start.y`, `end.x`, `end.y`
- `center.x`, `center.y`, `radius`
- `startAngle`, `endAngle`
- `Closed`
- `Default Text`

## Files

- [property_panel_entity_fields.js](../tools/web_viewer/ui/property_panel_entity_fields.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [property_panel_entity_fields.test.js](../tools/web_viewer/tests/property_panel_entity_fields.test.js)

## Why This Is The Right Cut

This is the next natural split after actions and no-selection defaults:

1. Steps 291-292 extracted action builders
2. Step293 extracted no-selection defaults
3. Step294 extracts entity edit fields

After this, [property_panel.js](../tools/web_viewer/ui/property_panel.js) is mostly left with:

- branch orchestration
- metadata rendering
- common style fields

which is a much cleaner end state for the next refactor step.
