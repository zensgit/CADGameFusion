# Step377: Common Property Fields Extraction

## Goal

Extract the common-property field builder from:

- `tools/web_viewer/ui/property_panel_common_fields.js`

The purpose is to isolate:

- `buildCommonPropertyFieldDescriptors(...)`

without changing field labels, names, ordering, patch payloads, update messages, or imported-layer promotion behavior.

## Scope

In scope:

- Extract:
  - `buildCommonPropertyFieldDescriptors(...)`
- Keep field ordering unchanged
- Keep `patchSelection(...)` / `buildPatch(...)` threading unchanged
- Keep imported-layer promotion behavior unchanged

Out of scope:

- `buildStyleActionDescriptors(...)`
- render callback behavior

## Constraints

- Keep `buildCommonPropertyFieldDescriptors(...)` public contract unchanged.
- Preserve exact field labels, names, ordering, patch payloads, and update messages.
- Preserve `promoteImportedColorSource` semantics.
- Preserve `getLayer(...)` / `ensureLayer(...)` behavior.
- Preserve the dependency guard that returns `[]` unless both `patchSelection` and `buildPatch` are functions.
- Only extract common-property field assembly into a dedicated helper module.
- Keep `property_panel_common_fields.js` re-exporting `buildCommonPropertyFieldDescriptors(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_common_property_fields.js`

Expected responsibility split:

- helper: `buildCommonPropertyFieldDescriptors(...)`
- `property_panel_common_fields.js`: re-export common-property builder and style actions

## Acceptance

Accept Step377 only if:

- `property_panel_common_fields.js` no longer defines `buildCommonPropertyFieldDescriptors(...)` inline
- focused tests cover extracted common-property field behavior directly
- existing common-field tests stay green
- `git diff --check` stays clean
