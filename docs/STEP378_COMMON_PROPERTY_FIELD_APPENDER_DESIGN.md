# Step378: Common Property Field Appender Extraction

## Goal

Extract the common-property field appender from:

- `tools/web_viewer/ui/property_panel_glue_field_appenders.js`

The purpose is to isolate:

- `appendCommonPropertyFields(...)`

without changing descriptor ordering, dependency threading, or imported-layer promotion behavior.

## Scope

In scope:

- Extract:
  - `appendCommonPropertyFields(...)`
- Keep `appendFieldDescriptors(...)` threading unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` / `getLayer(...)` / `ensureLayer(...)` threading unchanged

Out of scope:

- `appendSourceTextFields(...)`
- `appendInsertProxyTextFields(...)`
- `appendSingleEntityFields(...)`

## Constraints

- Keep `createPropertyPanelGlueFieldAppenders(...)` public contract unchanged.
- Preserve exact descriptor ordering and update behavior.
- Preserve `displayedColor` and `promoteImportedColorSource` threading.
- Only extract the common-property field appender into a dedicated helper module.
- Keep `property_panel_glue_field_appenders.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_common_field_appender.js`

Expected responsibility split:

- helper: `appendCommonPropertyFields(...)`
- `property_panel_glue_field_appenders.js`: factory, remaining appenders, returned object

## Acceptance

Accept Step378 only if:

- `property_panel_glue_field_appenders.js` no longer defines `appendCommonPropertyFields(...)` inline
- focused tests cover extracted common-property appender behavior directly
- existing glue field appender tests stay green
- `git diff --check` stays clean
