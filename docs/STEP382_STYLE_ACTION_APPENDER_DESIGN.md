# Step382: Style Action Appender Extraction

## Goal

Extract the style action appender from:

- `tools/web_viewer/ui/property_panel_glue_style_layer_actions.js`

The purpose is to isolate:

- `appendStyleActions(...)`

without changing action ordering, dependency threading, or style reset behavior.

## Scope

In scope:

- Extract:
  - `appendStyleActions(...)`
- Keep `addActionRow(...)` threading unchanged
- Keep `patchSelection(...)` threading unchanged

Out of scope:

- `appendLayerActions(...)`

## Constraints

- Keep `createStyleLayerActionAppenders(...)` public contract unchanged.
- Preserve exact action ordering and click behavior.
- Only extract the style action appender into a dedicated helper module.
- Keep `property_panel_glue_style_layer_actions.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_style_action_appender.js`

Expected responsibility split:

- helper: `appendStyleActions(...)`
- `property_panel_glue_style_layer_actions.js`: factory, remaining layer appender, returned object

## Acceptance

Accept Step382 only if:

- `property_panel_glue_style_layer_actions.js` no longer defines `appendStyleActions(...)` inline
- focused tests cover extracted style action appender behavior directly
- existing glue style/layer tests stay green
- `git diff --check` stays clean
