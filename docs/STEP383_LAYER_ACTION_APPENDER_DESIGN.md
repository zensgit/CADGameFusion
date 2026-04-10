# Step383: Layer Action Appender Extraction

## Goal

Extract the layer action appender from:

- `tools/web_viewer/ui/property_panel_glue_style_layer_actions.js`

The purpose is to isolate:

- `appendLayerActions(...)`

without changing action ordering, dependency threading, or layer action behavior.

## Scope

In scope:

- Extract:
  - `appendLayerActions(...)`
- Keep `addActionRow(...)` threading unchanged
- Keep layer action dependency threading unchanged

Out of scope:

- `appendStyleActions(...)`

## Constraints

- Keep `createStyleLayerActionAppenders(...)` public contract unchanged.
- Preserve exact action ordering and click behavior.
- Only extract the layer action appender into a dedicated helper module.
- Keep `property_panel_glue_style_layer_actions.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_layer_action_appender.js`

Expected responsibility split:

- helper: `appendLayerActions(...)`
- `property_panel_glue_style_layer_actions.js`: factory, style appender, returned object

## Acceptance

Accept Step383 only if:

- `property_panel_glue_style_layer_actions.js` no longer defines `appendLayerActions(...)` inline
- focused tests cover extracted layer action appender behavior directly
- existing glue style/layer tests stay green
- `git diff --check` stays clean
