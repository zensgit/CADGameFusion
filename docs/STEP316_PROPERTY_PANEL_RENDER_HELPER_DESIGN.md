# Step316 Property Panel Render Helper Design

## Goal

Make `property_panel.js` a cleaner composition root by moving the entire `render()` body into a dedicated helper, without changing render semantics.

## Problem

After Step315, the main file was already small, but it still hosted one full render dispatcher:

- clear form
- resolve selection context
- update summary/details shells
- branch to empty/missing/active
- delegate active selection rendering

That logic was cohesive enough to stand as its own helper.

## Design

Add:

- `tools/web_viewer/ui/property_panel_render.js`

The module exports:

- `renderPropertyPanel(context, deps = {})`

It owns:

- `form.innerHTML = ''`
- `resolvePropertyPanelSelectionContext(...)`
- `setPropertySelectionSummary(...)`
- `setPropertySelectionDetails(...)`
- empty-selection routing to `controller.renderCurrentLayerDefaults()`
- active-selection routing to `renderPropertyPanelActiveSelection(...)`

`property_panel.js` now just builds collaborators and calls `renderPropertyPanel(...)`.

## Boundaries

This step does not change:

- selection-context semantics
- active-selection rendering semantics
- subscriptions
- controller/collaborator assembly

It only moves the render dispatcher into its own module.

## Expected Outcome

`property_panel.js` becomes a near-pure composition root, while render dispatch gains a dedicated test seam.
