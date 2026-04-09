# Step374: Full Text Fields Extraction

## Goal

Extract the full-text field builder from:

- `tools/web_viewer/ui/property_panel_entity_fields.js`

The purpose is to isolate:

- `buildFullTextEditFieldDescriptors(...)`

without changing field labels, names, patch payloads, or update messages.

## Scope

In scope:

- Extract:
  - `buildFullTextEditFieldDescriptors(...)`
- Keep field ordering unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged

Out of scope:

- `buildInsertProxyTextFieldDescriptors(...)`
- `buildSingleEntityEditFieldDescriptors(...)`
- render callback behavior

## Constraints

- Keep `buildFullTextEditFieldDescriptors(...)` public contract unchanged.
- Preserve exact field labels, names, ordering, and update messages.
- Preserve `primary.type === 'text'` guard behavior.
- Only extract full-text field assembly into a dedicated helper module.
- Keep `property_panel_entity_fields.js` re-exporting `buildFullTextEditFieldDescriptors(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_full_text_fields.js`

Expected responsibility split:

- helper: `buildFullTextEditFieldDescriptors(...)`
- `property_panel_entity_fields.js`: insert-proxy fields, single-entity fields, re-export

## Acceptance

Accept Step374 only if:

- `property_panel_entity_fields.js` no longer defines `buildFullTextEditFieldDescriptors(...)` inline
- focused tests cover extracted full-text field behavior directly
- existing entity field tests stay green
- `git diff --check` stays clean
