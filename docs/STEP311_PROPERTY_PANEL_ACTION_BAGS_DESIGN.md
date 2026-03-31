# Step311 Property Panel Action Bags Design

## Goal

Reduce the public action-callback surface around `createPropertyPanel(...)` without breaking existing callers or changing property-panel behavior.

## Problem

After Step310, `property_panel.js` was structurally small, but its options surface was still noisy:

- many layer action callbacks
- many source-group action callbacks
- many insert-group action callbacks

Those callbacks were already conceptually grouped, but the API still exposed them as a flat bag.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_action_bags.js`

The module exports:

- `resolvePropertyPanelActionBags(options)`

It produces three grouped action bags:

- `layer`
- `sourceGroup`
- `insertGroup`

The helper supports two inputs:

1. new nested `actionHandlers`
2. legacy flat callbacks on the top-level options object

Nested `actionHandlers` wins when both are provided.

Then:

- `property_panel.js` switches to `createPropertyPanel(options = {})`
- it resolves `actionBags` once
- `property_panel_collaborators.js` consumes grouped `actionBags` instead of dozens of flat callbacks
- `workspace.js` now passes a structured `actionHandlers` bag

## Boundaries

`property_panel_action_bags.js` is responsible only for:

- grouping callbacks by domain
- preserving legacy compatibility
- preferring nested handlers when present

`property_panel.js` remains responsible for:

- DOM setup
- controller creation
- selection/render orchestration

`workspace.js` remains responsible for:

- concrete command execution behavior
- status messaging
- fit/open/select side effects

## Non-Goals

- no change to actual action semantics
- no change to command names or status text
- no change to controller/render flow
- no attempt yet to shrink every top-level non-action option

## Expected Outcome

The property-panel API gets a cleaner domain shape, collaborator wiring becomes easier to read, and old flat callers remain compatible.
