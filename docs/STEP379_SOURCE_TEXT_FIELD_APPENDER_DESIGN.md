# Step379: Source Text Field Appender Extraction

## Goal

Extract the source-text field appender from:

- `tools/web_viewer/ui/property_panel_glue_field_appenders.js`

The purpose is to isolate:

- `appendSourceTextFields(...)`

without changing descriptor ordering, dependency threading, or text update behavior.

## Scope

In scope:

- Extract:
  - `appendSourceTextFields(...)`
- Keep `appendFieldDescriptors(...)` threading unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged

Out of scope:

- `appendCommonPropertyFields(...)`
- `appendInsertProxyTextFields(...)`
- `appendSingleEntityFields(...)`

## Constraints

- Keep `createPropertyPanelGlueFieldAppenders(...)` public contract unchanged.
- Preserve exact descriptor ordering and update behavior.
- Only extract the source-text field appender into a dedicated helper module.
- Keep `property_panel_glue_field_appenders.js` responsible for the returned object shape.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_source_text_field_appender.js`

Expected responsibility split:

- helper: `appendSourceTextFields(...)`
- `property_panel_glue_field_appenders.js`: factory, remaining appenders, returned object

## Acceptance

Accept Step379 only if:

- `property_panel_glue_field_appenders.js` no longer defines `appendSourceTextFields(...)` inline
- focused tests cover extracted source-text appender behavior directly
- existing glue field appender tests stay green
- `git diff --check` stays clean
