# Step376: Single Entity Fields Extraction

## Goal

Extract the single-entity field builder from:

- `tools/web_viewer/ui/property_panel_entity_fields.js`

The purpose is to isolate:

- `buildSingleEntityEditFieldDescriptors(...)`

without changing field labels, names, toggle semantics, patch payloads, update messages, or text delegation behavior.

## Scope

In scope:

- Extract:
  - `buildSingleEntityEditFieldDescriptors(...)`
- Keep field ordering unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged
- Keep text delegation to `buildFullTextEditFieldDescriptors(...)` unchanged

Out of scope:

- `buildFullTextEditFieldDescriptors(...)`
- `buildInsertProxyTextFieldDescriptors(...)`
- render callback behavior

## Constraints

- Keep `buildSingleEntityEditFieldDescriptors(...)` public contract unchanged.
- Preserve exact field labels, names, ordering, and update messages.
- Preserve polyline toggle semantics.
- Preserve text delegation behavior.
- Preserve the dependency guard that returns `[]` unless both `patchSelection` and `buildPatch` are functions.
- Only extract single-entity field assembly into a dedicated helper module.
- Keep `property_panel_entity_fields.js` re-exporting `buildSingleEntityEditFieldDescriptors(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_single_entity_fields.js`

Expected responsibility split:

- helper: `buildSingleEntityEditFieldDescriptors(...)`
- `property_panel_entity_fields.js`: re-export single-entity builder and other field helpers

## Acceptance

Accept Step376 only if:

- `property_panel_entity_fields.js` no longer defines `buildSingleEntityEditFieldDescriptors(...)` inline
- focused tests cover extracted single-entity field behavior directly
- existing entity field tests stay green
- `git diff --check` stays clean
