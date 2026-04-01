# Step307 Property Panel Selection Context Design

## Goal

Reduce the remaining selection-resolution and presentation-preparation logic inside `property_panel.js` without changing summary/details behavior or branch ordering.

## Problem

After Step306, `property_panel.js` still owned the full pre-branch selection bootstrap:

- reading `selectionState.entityIds`
- resolving selected entities from `documentState`
- handling three cases:
  - empty selection
  - missing entities
  - active selection
- computing selection presentation for summary/details
- choosing the fallback primary entity when `primaryId` is stale

This logic is self-contained and purely preparatory, but it still lived inline in `render()`.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_context.js`

The module exports:

- `resolvePropertyPanelSelectionContext(selectionState, documentState)`

The helper returns a small struct:

- `kind`
- `selectionIds`
- `entities`
- `primary`
- `presentation`

`property_panel.js` now:

- clears the form
- resolves selection context once
- applies `setPropertySelectionSummary(...)` and `setPropertySelectionDetails(...)`
- branches only on `kind`

## Boundaries

`property_panel_selection_context.js` is responsible for:

- selection id normalization
- entity lookup
- stale primary fallback
- delegating to `buildSelectionPresentation(...)`
- preserving empty/missing/active semantics

`property_panel.js` remains responsible for:

- DOM clearing
- current-layer defaults for true empty selection
- render-state assembly for active selection
- branch execution ordering

## Non-Goals

- no change to `setPropertySelectionSummary(...)`
- no change to `setPropertySelectionDetails(...)`
- no change to empty-selection copy
- no change to how active-selection branch rendering works

## Expected Outcome

`property_panel.js` gets closer to a pure render orchestrator, while selection bootstrap semantics become directly testable as a dedicated contract.
