# Step312 Property Panel Controller Inputs Design

## Goal

Continue shrinking the public `createPropertyPanel(...)` options surface by grouping non-action controller handlers, while preserving full backward compatibility.

## Problem

After Step311, action callbacks were already grouped into `actionHandlers`, but `createPropertyPanel(...)` still accepted a flat set of controller-facing handlers:

- `getCurrentLayer`
- `getCurrentSpaceContext`
- `setCurrentSpaceContext`
- `listPaperLayouts`
- `updateCurrentLayer`

These handlers belong to one domain: current layer and current space/layout defaults used by the no-selection controller path.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_controller_inputs.js`

The module exports:

- `resolvePropertyPanelControllerInputs(options)`

It supports two inputs:

1. new nested `controllerHandlers`
2. legacy flat top-level handlers

Nested `controllerHandlers` wins when both are provided.

Then:

- `property_panel.js` resolves controller inputs once and passes them to `createPropertyPanelController(...)`
- `workspace.js` now supplies a grouped `controllerHandlers` object

## Boundaries

`property_panel_controller_inputs.js` is responsible only for:

- normalizing the controller-facing handler surface
- preserving backward compatibility
- preferring nested controller handlers when present

`property_panel.js` remains responsible for:

- DOM setup
- controller creation
- collaborator creation
- render orchestration

`workspace.js` remains responsible for:

- concrete current-layer/current-space behavior
- status messaging
- document-state updates

## Non-Goals

- no change to controller behavior
- no change to action-handler grouping
- no change to render flow or property semantics
- no attempt to collapse top-level stateful dependencies like `documentState` or `selectionState`

## Expected Outcome

The property-panel public API becomes more layered: action handlers and controller handlers are both grouped, while old flat callers still keep working.
