# Step299 Property Panel Selection Shells Design

## Goal

Continue shrinking `property_panel.js` toward pure wiring by extracting the remaining selection-summary/details shell and branch-context shell.

## Problem

After Steps 291-298, `property_panel.js` still directly owned two heavy UI assembly blocks:

- the `selection summary/details` DOM shell
- the `appendBranchContext(...)` shell that assembles metadata rows, layer/group info, and group actions for read-only or locked branches

These are not policy decisions and not descriptor-generation boundaries. They are still UI shell glue.

## Design

Introduce two local modules:

- `tools/web_viewer/ui/property_panel_selection_shells.js`
- `tools/web_viewer/ui/property_panel_branch_context.js`

`property_panel_selection_shells.js` exports:

- `setPropertySelectionSummary(...)`
- `setPropertySelectionDetails(...)`

`property_panel_branch_context.js` exports:

- `renderPropertyBranchContext(...)`

## Boundaries

`property_panel_selection_shells.js` is responsible for:

- writing summary text
- building the empty / multiple / single selection details DOM shell
- rendering hero, badges, and fact rows from the existing selection presentation contract

`property_panel_branch_context.js` is responsible for:

- rendering metadata rows for the current primary entity
- rendering layer actions for single selection
- rendering source/insert/released info rows for grouped selections
- appending source/insert/released action groups in the established order

`property_panel.js` remains responsible for:

- computing selection/presentation state
- branch wiring and early-return decisions
- patch execution
- field/action handler glue

## Non-Goals

- no change to selection presentation contract
- no change to note policy
- no change to field, action, or info-row contracts
- no new DOM abstraction layer beyond this local extraction

## Expected Outcome

`property_panel.js` gets materially thinner while selection shell rendering and branch-context rendering become individually testable and reusable.
