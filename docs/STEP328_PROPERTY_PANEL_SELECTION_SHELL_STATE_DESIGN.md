# Step328 Property Panel Selection Shell State Design

## Goal

Extract selection-shell state projection from `property_panel_selection_shells.js` into a dedicated helper module, without changing wrapper exports or DOM output.

## Why This Step

After Step327:

- `property_panel_selection_shells.js` already delegates DOM-only rendering to `property_panel_selection_shell_renderers.js`
- the remaining non-trivial logic in the wrapper is state normalization and `dataset` projection

That makes state projection the narrowest next seam.

## Problem

`setPropertySelectionDetails(...)` still directly computes:

- `mode`
- `primary`
- `primaryLayer`
- `badges`
- `detailFacts`
- `readOnly`
- all `dataset.*` values

So one wrapper function still owns both:

- input normalization
- DOM target mutation policy

## Design

Introduce a new helper module:

- `tools/web_viewer/ui/property_panel_selection_shell_state.js`

Export one helper:

- `buildPropertyPanelSelectionShellState(presentation)`

This helper should return a normalized state object containing:

- `mode`
- `primary`
- `primaryLayer`
- `badges`
- `detailFacts`
- `isReadOnly`
- `dataset`

Where `dataset` contains the exact keys currently written by `setPropertySelectionDetails(...)`:

- `mode`
- `entityCount`
- `primaryType`
- `readOnly`
- `layerId`
- `layerName`
- `layerLocked`
- `layerFrozen`
- `layerPrintable`
- `layerConstruction`

`property_panel_selection_shells.js` should then:

1. resolve `document`
2. clear `innerHTML`
3. call `buildPropertyPanelSelectionShellState(...)`
4. copy `dataset` fields onto the element
5. dispatch to empty/multiple/single renderer helpers

## Boundaries

This step must not change:

- `renderPropertySelectionShells(...)` export contract
- `setPropertySelectionSummary(...)` export contract
- `setPropertySelectionDetails(...)` export contract
- DOM structure or copy produced by `property_panel_selection_shell_renderers.js`
- `property_panel_render.js` wiring
- selection presenter behavior

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_selection_shell_state.test.js`

Move dataset-focused assertions there.

Keep `property_panel_selection_shells.test.js` focused on wrapper contract:

- summary write
- summary+details write
- one dispatch-level smoke assertion at most

Keep renderer DOM-detail assertions in:

- `tools/web_viewer/tests/property_panel_selection_shell_renderers.test.js`

## Expected Outcome

- `property_panel_selection_shells.js` becomes a thin wrapper over:
  - document resolution
  - dataset application
  - branch dispatch
- state projection becomes unit-testable in isolation
- next steps can thin wrapper/application glue further without touching DOM renderer code
