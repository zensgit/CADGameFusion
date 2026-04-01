# Step326 Property Panel Selection Branch Renderers Design

## Goal

Thin `property_panel_selection_shells.js` by extracting the three detail-branch renderers into file-local helpers, without changing exports or render contracts.

## Problem

After Step325, `property_panel_selection_shells.js` still inlined the DOM assembly for:

- empty selection
- multiple selection
- single selection

That left `setPropertySelectionDetails(...)` responsible for both dataset normalization and branch-specific DOM rendering.

## Design

Keep all exports and file boundaries unchanged for this step.

Within `property_panel_selection_shells.js`, introduce file-local helpers:

- `appendEmptySelectionShell(...)`
- `appendMultipleSelectionShell(...)`
- `appendSingleSelectionHero(...)`
- `appendSingleSelectionShell(...)`

`setPropertySelectionDetails(...)` now does three things only:

- normalize presentation fields and dataset attributes
- resolve read-only state
- dispatch to `empty` / `multiple` / `single` helpers

## Boundaries

This step does not change:

- `renderPropertySelectionShells(...)` export surface
- `setPropertySelectionSummary(...)` export surface
- summary/detail DOM copy
- badge/fact order
- selection presenter behavior
- `property_panel_render.js` call sites

## Expected Outcome

- clearer split between dataset normalization and branch DOM rendering
- safer follow-up extraction to a separate renderer module
- unchanged wrapper contract for render shell callers
