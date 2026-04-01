# Step336 Property Panel Selection Presentation Design

## Goal

Extract presentation assembly from `property_panel_selection_context.js` into a dedicated helper, without changing selection resolution, context-state classification, or the returned public context contract.

## Why This Step

After Step335:

- lookup and normalization already live in `property_panel_selection_resolution.js`
- classification already lives in `property_panel_selection_context_state.js`
- `property_panel_selection_context.js` is now mostly:
  - resolution
  - context state
  - presentation assembly
  - final object return

That makes presentation assembly the narrowest remaining seam in this layer.

## Problem

`resolvePropertyPanelSelectionContext(...)` still directly calls `buildSelectionPresentation(...)` with:

- `contextState.presentationEntities`
- `contextState.presentationPrimaryId`
- `{ getLayer: resolution.getLayer, listEntities: resolution.listEntities }`

This means the wrapper still owns both:

- orchestration across helpers
- presentation assembly wiring

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_presentation.js`

Export one helper:

- `buildPropertyPanelSelectionPresentation(resolution, contextState)`

It should call `buildSelectionPresentation(...)` with the exact current wiring:

- entities: `contextState.presentationEntities`
- primary id: `contextState.presentationPrimaryId`
- helpers:
  - `getLayer: resolution.getLayer`
  - `listEntities: resolution.listEntities`

`property_panel_selection_context.js` should then:

1. build `resolution`
2. build `contextState`
3. build `presentation` through `buildPropertyPanelSelectionPresentation(...)`
4. return the same public context object as today

## Boundaries

This step must not change:

- `resolvePropertyPanelSelectionContext(...)` export contract
- `buildPropertyPanelSelectionResolution(...)` behavior
- `buildPropertyPanelSelectionContextState(...)` behavior
- `buildSelectionPresentation(...)` behavior
- returned `kind`, `selectionIds`, `entities`, `primary`, `presentation`

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_selection_presentation.test.js`

Cover:

- presentation builder passes presentation entities through unchanged
- presentation builder passes presentation primary id through unchanged
- presentation builder passes `getLayer` and `listEntities` through unchanged
- result passthrough from `buildSelectionPresentation(...)`

Keep `property_panel_selection_context.test.js` focused on public context contract and presentation behavior.

## Expected Outcome

- `property_panel_selection_context.js` becomes a thin wrapper over:
  - resolution
  - context state
  - presentation assembly
  - public return shape
- presentation wiring becomes unit-testable in isolation
- next cleanup can target the final public return assembly without reopening lower-level seams
