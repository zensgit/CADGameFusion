# Step325 Property Panel Selection Shell Consolidation Design

## Goal

Thin `property_panel_render.js` by collapsing the last pair of summary/detail shell writes into one helper call, without changing selection branching or DOM output.

## Problem

After Step324, `property_panel_render.js` still separately invoked:

- `setPropertySelectionSummary(...)`
- `setPropertySelectionDetails(...)`

That meant the render shell still owned a tiny but duplicated presentation seam even though both responsibilities already lived in `property_panel_selection_shells.js`.

## Design

Add a thin wrapper in `property_panel_selection_shells.js`:

- `renderPropertySelectionShells(summaryElement, detailsElement, presentation)`

`property_panel_render.js` now calls that single shell helper before its existing `empty` / `active` / `missing` branching.

While touching the same module, the repeated badge-row and fact-list DOM builders inside `setPropertySelectionDetails(...)` were also collapsed into file-private helpers:

- `renderSelectionBadgeRow(...)`
- `renderSelectionFactList(...)`

These helpers do not change the export surface.

## Boundaries

This step does not change:

- selection-context resolution
- empty-state fallback to current-layer defaults
- active-selection payload assembly
- active render behavior
- badge/fact copy, ordering, or dataset contracts

It only consolidates selection-shell wiring and removes local DOM duplication inside the shells module.

## Expected Outcome

- `property_panel_render.js` becomes a thinner branch shell
- summary/detail wiring is expressed as one helper call
- badge/fact DOM generation is centralized inside `property_panel_selection_shells.js`
