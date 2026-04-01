# Step303 Property Panel Controller Design

## Goal

Continue shrinking `property_panel.js` by extracting the narrowest remaining controller-style helpers without changing selection wiring, DOM behavior, or patch semantics.

## Problem

After Step302, `property_panel.js` was mostly orchestration, but it still owned three construction-time bridge helpers:

- `resolveSelectionActionContext(...)`
- `renderCurrentLayerDefaults(...)`
- `patchSelection(...)`

These functions are not branch rendering, not DOM primitives, and not patch-building logic. They are thin controller bridges between injected dependencies and existing helper modules.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_controller.js`

The module exports:

- `createPropertyPanelController(...)`

The controller owns exactly three responsibilities:

- bridge `documentState.listEntities()` into `buildSelectionActionContext(...)`
- bridge current-layer providers plus DOM sinks into `renderNoSelectionSection(...)`
- bridge `commandBus.execute('selection.propertyPatch', ...)` into status reporting

`property_panel.js` now instantiates the controller once and delegates:

- `controller.resolveSelectionActionContext(...)`
- `controller.renderCurrentLayerDefaults()`
- `controller.patchSelection(...)`

## Boundaries

`property_panel_controller.js` is responsible for:

- action-context lookup wiring
- no-selection current-layer default rendering wiring
- property-patch command execution and status mapping

`property_panel.js` remains responsible for:

- selection lifecycle and `render()` orchestration
- summary/details presentation
- branch composition
- glue facade and DOM adapter wiring

Existing helper modules remain unchanged in scope:

- `property_panel_section_shells.js`
- `selection_presenter.js`
- `property_panel_glue_facade.js`
- `property_panel_patch_helpers.js`

## Non-Goals

- no change to action ids, field order, or note copy
- no change to `selection.propertyPatch` payload shape
- no change to selection-summary / property-panel rendering branches
- no broader controller or renderer refactor

## Expected Outcome

`property_panel.js` gets closer to a pure branch composer, while the last remaining controller bridges become directly testable in isolation.
