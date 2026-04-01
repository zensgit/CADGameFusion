# Step315 Property Panel Active Render Design

## Goal

Extract the active-selection render pipeline from `property_panel.js` into one narrow helper, without changing any runtime behavior.

## Problem

After Step314, `property_panel.js` was already down to a small orchestrator, but the active-selection path still inlined one pure pipeline:

1. assemble render state
2. build render callbacks
3. run branch composer

That sequence was wiring-heavy and forced the main file to import three more modules than necessary.

## Design

Add:

- `tools/web_viewer/ui/property_panel_active_render.js`

The helper:

- receives `entities`, `primary`, `documentState`, `controller`, `glueFacade`, `selectionInfoHelpers`, `branchContextHelper`, and `addReadonlyNote`
- internally calls:
  - `assemblePropertyPanelRenderState(...)`
  - `createPropertyPanelRenderCallbacks(...)`
  - `renderPropertyPanelSelectionBranches(...)`
- returns a tiny status object for tests/debugging

`property_panel.js` now delegates the entire active-selection path to that helper.

## Boundaries

This step does not change:

- selection-context resolution
- current-layer defaults path
- branch behavior
- callback semantics
- DOM behavior

It only moves the active render pipeline into a dedicated module.

## Expected Outcome

`property_panel.js` gets closer to a pure orchestrator, and the active-selection render sequence gains a direct unit-test seam.
