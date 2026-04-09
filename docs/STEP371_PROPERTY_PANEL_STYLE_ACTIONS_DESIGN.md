# Step371: Property Panel Style Actions Extraction

## Goal

Extract the style action builder from:

- `tools/web_viewer/ui/property_panel_common_fields.js`

The purpose is to isolate:

- `buildStyleActionDescriptors(...)`

without changing action ids, labels, patch payloads, or reset semantics.

## Scope

In scope:

- Extract:
  - `buildStyleActionDescriptors(...)`
- Keep style reset action ordering unchanged
- Keep `patchSelection(...)` threading unchanged

Out of scope:

- `buildCommonPropertyFieldDescriptors(...)`
- glue facade wiring
- layer action behavior
- render callback behavior

## Constraints

- Keep `buildStyleActionDescriptors(...)` public contract unchanged.
- Preserve exact action ids, labels, patch payloads, and messages.
- Preserve action ordering.
- Only extract style action descriptor assembly into a dedicated helper module.
- Keep `property_panel_common_fields.js` re-exporting `buildStyleActionDescriptors(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_style_actions.js`

Expected responsibility split:

- helper: `buildStyleActionDescriptors(...)`
- `property_panel_common_fields.js`: `buildCommonPropertyFieldDescriptors(...)` plus re-export

## Acceptance

Accept Step371 only if:

- `property_panel_common_fields.js` no longer defines `buildStyleActionDescriptors(...)` inline
- focused tests cover extracted style action behavior directly
- existing common fields tests stay green
- `git diff --check` stays clean
