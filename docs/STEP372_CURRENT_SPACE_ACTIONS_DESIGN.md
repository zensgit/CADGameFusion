# Step372: Current Space Actions Extraction

## Goal

Extract the current-space action builder from:

- `tools/web_viewer/ui/property_panel_layer_actions.js`

The purpose is to isolate:

- `buildCurrentSpaceActions(...)`

without changing action ids, labels, status semantics, or layout normalization behavior.

## Scope

In scope:

- Extract:
  - `buildCurrentSpaceActions(...)`
- Keep current-space action ordering unchanged
- Keep `setCurrentSpaceContext(...)` / `setStatus(...)` threading unchanged

Out of scope:

- `buildLayerActions(...)`
- layer action behavior
- property panel glue facade wiring

## Constraints

- Keep `buildCurrentSpaceActions(...)` public contract unchanged.
- Preserve exact action ids, labels, and status behavior.
- Preserve action ordering.
- Preserve `normalizeLayoutName(...)` behavior.
- Only extract current-space action assembly into a dedicated helper module.
- Keep `property_panel_layer_actions.js` re-exporting `buildCurrentSpaceActions(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_current_space_actions.js`

Expected responsibility split:

- helper: `buildCurrentSpaceActions(...)`
- `property_panel_layer_actions.js`: `buildLayerActions(...)` plus re-export

## Acceptance

Accept Step372 only if:

- `property_panel_layer_actions.js` no longer defines `buildCurrentSpaceActions(...)` inline
- focused tests cover extracted current-space action behavior directly
- existing layer action tests stay green
- `git diff --check` stays clean
