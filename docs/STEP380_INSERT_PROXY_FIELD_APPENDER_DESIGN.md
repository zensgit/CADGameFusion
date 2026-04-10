# Step380: Insert Proxy Field Appender Extraction

## Goal

Extract the insert-proxy field appender from:

- `tools/web_viewer/ui/property_panel_glue_field_appenders.js`

The purpose is to isolate:

- `appendInsertProxyTextFields(...)`

without changing descriptor ordering, dependency threading, or `allowPositionEditing` behavior.

## Scope

In scope:

- Extract:
  - `appendInsertProxyTextFields(...)`
- Keep `appendFieldDescriptors(...)` threading unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged
- Keep `allowPositionEditing` passthrough unchanged

Out of scope:

- `appendCommonPropertyFields(...)`
- `appendSourceTextFields(...)`
- `appendSingleEntityFields(...)`

## Constraints

- Keep `createPropertyPanelGlueFieldAppenders(...)` public contract unchanged.
- Preserve exact descriptor ordering and update behavior.
- Preserve `allowPositionEditing` passthrough semantics.
- Only extract the insert-proxy field appender into a dedicated helper module.
- Keep `property_panel_glue_field_appenders.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_insert_proxy_field_appender.js`

Expected responsibility split:

- helper: `appendInsertProxyTextFields(...)`
- `property_panel_glue_field_appenders.js`: factory, remaining appenders, returned object

## Acceptance

Accept Step380 only if:

- `property_panel_glue_field_appenders.js` no longer defines `appendInsertProxyTextFields(...)` inline
- focused tests cover extracted insert-proxy appender behavior directly
- existing glue field appender tests stay green
- `git diff --check` stays clean
