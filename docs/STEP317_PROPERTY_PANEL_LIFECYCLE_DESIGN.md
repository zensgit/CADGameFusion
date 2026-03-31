# Step317 Property Panel Lifecycle Design

## Goal

Make `property_panel.js` a cleaner composition root by moving subscription and first-render wiring into a dedicated lifecycle helper.

## Problem

After Step316, the main file was already reduced to composition and render dispatch, but it still owned one small lifecycle block:

- subscribe `selectionState` to `render`
- subscribe `documentState` to `render`
- perform initial render
- return `{ render }`

That logic was not render semantics and not collaborator assembly. It was lifecycle wiring.

## Design

Add:

- `tools/web_viewer/ui/property_panel_lifecycle.js`

The module exports:

- `attachPropertyPanelLifecycle({ selectionState, documentState, render, autoRender })`

It owns:

- attaching `change` listeners to selection/document state
- running the initial render when `autoRender !== false`
- returning `{ render, dispose }`

`createPropertyPanel(...)` now delegates lifecycle setup to this helper and returns the helper result.

## Boundaries

This step does not change:

- selection/render semantics
- controller/collaborator assembly
- summary/details rendering
- branch behavior

It only extracts lifecycle plumbing and adds teardown support.

## Behavior Improvement

The new `dispose()` closes a real gap: if the property panel is recreated, old listeners can now be removed instead of remaining attached to `selectionState` and `documentState`.

## Expected Outcome

`property_panel.js` gets closer to a pure composition root, and panel lifecycle becomes directly testable as a focused helper.
