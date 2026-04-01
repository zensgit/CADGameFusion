# Step304 Property Panel Selection Info Helpers Design

## Goal

Continue shrinking `property_panel.js` by extracting the narrowest remaining section-bridge helpers without changing selection behavior, info-row content, or layer-action wiring.

## Problem

After Step303, `property_panel.js` still owned two local helpers that only adapt already-computed orchestration state into existing section renderers:

- `appendSingleSelectionInfo(primary, primaryLayer)`
- `appendGroupedSelectionInfo(primary, sourceGroupSummary, insertGroupSummary, releasedInsertArchiveSelection, actionContext)`

These helpers do not introduce policy. They only bridge `documentState`, info-row sinks, and layer-action sinks into:

- `renderSingleSelectionSection(...)`
- `renderGroupedSelectionSection(...)`

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_info_helpers.js`

The module exports:

- `createPropertyPanelSelectionInfoHelpers(...)`

The factory owns exactly two responsibilities:

- bridge single-selection entity metadata plus layer-action wiring into `renderSingleSelectionSection(...)`
- bridge grouped-selection source/insert/released rows into `renderGroupedSelectionSection(...)`

`property_panel.js` now instantiates the helper after `glueFacade` and delegates:

- `selectionInfoHelpers.appendSingleSelectionInfo(...)`
- `selectionInfoHelpers.appendGroupedSelectionInfo(...)`

## Boundaries

`property_panel_selection_info_helpers.js` is responsible for:

- `documentState.getLayer(...)` and `documentState.listEntities()` bridge wiring for section renderers
- forwarding `appendInfoRows`
- forwarding `appendLayerActions` for the single-selection case

`property_panel.js` remains responsible for:

- selection lifecycle and `render()` orchestration
- branch sequencing
- computing `actionContext`, `notePlan`, `releasedInsertArchiveSelection`
- `appendBranchContext(...)`

## Non-Goals

- no change to metadata fact generation
- no change to source/insert/released info-row content
- no change to layer action ids or ordering
- no extraction of `appendBranchContext(...)` in this step

## Expected Outcome

`property_panel.js` loses another pair of local bridge helpers, while single/grouped selection info rendering becomes directly testable as an isolated boundary.
