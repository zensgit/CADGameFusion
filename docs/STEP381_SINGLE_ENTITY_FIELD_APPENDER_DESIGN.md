# Step381: Single Entity Field Appender Extraction

## Goal

Extract the single-entity field appender from:

- `tools/web_viewer/ui/property_panel_glue_field_appenders.js`

The purpose is to isolate:

- `appendSingleEntityFields(...)`

without changing descriptor ordering, dependency threading, or single-entity edit behavior.

## Scope

In scope:

- Extract:
  - `appendSingleEntityFields(...)`
- Keep `appendFieldDescriptors(...)` threading unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged

Out of scope:

- `appendCommonPropertyFields(...)`
- `appendSourceTextFields(...)`
- `appendInsertProxyTextFields(...)`

## Constraints

- Keep `createPropertyPanelGlueFieldAppenders(...)` public contract unchanged.
- Preserve exact descriptor ordering and update behavior.
- Preserve line / polyline / circle / arc / text delegation behavior.
- Only extract the single-entity field appender into a dedicated helper module.
- Keep `property_panel_glue_field_appenders.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_single_entity_field_appender.js`

Expected responsibility split:

- helper: `appendSingleEntityFields(...)`
- `property_panel_glue_field_appenders.js`: factory, remaining appenders, returned object

## Acceptance

Accept Step381 only if:

- `property_panel_glue_field_appenders.js` no longer defines `appendSingleEntityFields(...)` inline
- focused tests cover extracted single-entity appender behavior directly
- existing glue field appender tests stay green
- `git diff --check` stays clean
