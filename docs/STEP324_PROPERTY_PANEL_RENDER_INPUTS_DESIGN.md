# Step324 Property Panel Render Inputs Design

## Goal

Thin `property_panel_render.js` by extracting the last active-selection payload assembly it still owned, without changing selection resolution, empty-state handling, or active render behavior.

## Problem

After Step323, `property_panel_render.js` still directly owned two small but distinct responsibilities:

- resolving the readonly-note handler from `domBindings` versus the legacy field
- assembling the active-selection payload passed into `renderPropertyPanelActiveSelection(...)`

Those were deterministic wiring concerns, not render-shell control flow.

## Design

Introduce a small helper module:

- `resolvePropertyPanelReadonlyNote(context)`
- `buildPropertyPanelActiveSelectionInput(context, selectionContext)`

`property_panel_render.js` now:

- resolves selection context
- keeps summary/detail writes and empty/missing branching
- delegates active payload assembly to `buildPropertyPanelActiveSelectionInput(...)`

## Boundaries

This step does not change:

- selection-context resolution
- summary/detail rendering
- empty-selection fallback to current-layer defaults
- active render behavior
- readonly note precedence semantics

It only extracts deterministic payload wiring from the render shell.

## Expected Outcome

`property_panel_render.js` becomes a thinner branch shell, while readonly-note resolution and active payload assembly gain direct focused test coverage.
