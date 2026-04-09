# Step373: Layer Actions Mainline Extraction

## Goal

Extract the remaining layer action builder from:

- `tools/web_viewer/ui/property_panel_layer_actions.js`

The purpose is to isolate:

- `buildLayerActions(...)`

without changing action ids, labels, ordering, or status semantics.

## Scope

In scope:

- Extract:
  - `buildLayerActions(...)`
- Keep layer action ordering unchanged
- Keep layer collaborator threading unchanged

Out of scope:

- `buildCurrentSpaceActions(...)`
- property panel glue facade wiring
- current-space action behavior

## Constraints

- Keep `buildLayerActions(...)` public contract unchanged.
- Preserve exact action ids, labels, ordering, and status messages.
- Preserve locked/visible/frozen gating semantics.
- Only extract layer action assembly into a dedicated helper module.
- Keep `property_panel_layer_actions.js` re-exporting `buildLayerActions(...)`.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_layer_mainline_actions.js`

Expected responsibility split:

- helper: `buildLayerActions(...)`
- `property_panel_layer_actions.js`: re-export facade for current-space + layer actions

## Acceptance

Accept Step373 only if:

- `property_panel_layer_actions.js` no longer defines `buildLayerActions(...)` inline
- focused tests cover extracted layer action behavior directly
- existing layer action tests stay green
- `git diff --check` stays clean
