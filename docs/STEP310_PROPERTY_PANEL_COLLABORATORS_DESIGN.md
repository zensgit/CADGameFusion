# Step310 Property Panel Collaborators Design

## Goal

Remove the remaining collaborator-assembly glue from `property_panel.js` without changing controller creation, render-state derivation, or branch execution flow.

## Problem

After Step309, `property_panel.js` was already thin, but `createPropertyPanel(...)` still inlined three collaborator assemblies:

- `glueFacade`
- `selectionInfoHelpers`
- `branchContextHelper`

This block was mostly pass-through wiring of action callbacks, DOM appenders, and `documentState` lookups.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_collaborators.js`

The module exports:

- `createPropertyPanelCollaborators(...)`

It assembles and returns:

- `glueFacade`
- `selectionInfoHelpers`
- `branchContextHelper`

The helper owns the shared wiring between them:

- `appendLayerActions`
- `appendSourceGroupActions`
- `appendInsertGroupActions`
- `appendReleasedInsertArchiveActions`
- `appendInfoRows`
- `appendFieldDescriptors`

## Boundaries

`property_panel_collaborators.js` is responsible only for:

- collaborator creation and wiring
- passing through existing action callbacks
- bridging `documentState` and DOM appenders into the three collaborator objects

`property_panel.js` remains responsible for:

- DOM lookup
- controller creation
- selection-context resolution
- render-state assembly
- callback-factory creation
- branch composition and subscriptions

## Non-Goals

- no change to `createPropertyPanelController(...)`
- no change to `createPropertyPanelRenderCallbacks(...)`
- no change to branch sequencing or DOM adapter behavior
- no reduction of the public `createPropertyPanel(...)` argument surface yet

## Expected Outcome

`property_panel.js` gets closer to a true orchestration shell, while collaborator wiring becomes directly testable as one isolated contract.
