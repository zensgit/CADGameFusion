# Step375: Insert Proxy Fields Extraction

## Goal

Extract the insert-proxy field builder from:

- `tools/web_viewer/ui/property_panel_entity_fields.js`

The purpose is to isolate:

- `buildInsertProxyTextFieldDescriptors(...)`

without changing field labels, names, patch payloads, update messages, or position-edit gating.

## Scope

In scope:

- Extract:
  - `buildInsertProxyTextFieldDescriptors(...)`
- Keep field ordering unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged
- Keep `allowPositionEditing` semantics unchanged

Out of scope:

- `buildFullTextEditFieldDescriptors(...)`
- `buildSingleEntityEditFieldDescriptors(...)`
- render callback behavior

## Constraints

- Keep `buildInsertProxyTextFieldDescriptors(...)` public contract unchanged.
- Preserve exact field labels, names, ordering, and update messages.
- Preserve `primary.type === 'text'` guard behavior.
- Preserve `attdef` label switching behavior.
- Preserve the dependency guard that returns `[]` unless both `patchSelection` and `buildPatch` are functions.
- Only extract insert-proxy field assembly into a dedicated helper module.
- Keep `property_panel_entity_fields.js` re-exporting `buildInsertProxyTextFieldDescriptors(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_insert_proxy_fields.js`

Expected responsibility split:

- helper: `buildInsertProxyTextFieldDescriptors(...)`
- `property_panel_entity_fields.js`: re-export insert-proxy builder, keep single-entity builder

## Acceptance

Accept Step375 only if:

- `property_panel_entity_fields.js` no longer defines `buildInsertProxyTextFieldDescriptors(...)` inline
- focused tests cover extracted insert-proxy field behavior directly
- existing entity field tests stay green
- `git diff --check` stays clean
