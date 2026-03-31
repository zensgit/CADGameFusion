# Step327 Property Panel Selection Renderer Split Design

## Goal

Move DOM-only selection shell renderers out of `property_panel_selection_shells.js` into a dedicated renderer module, while keeping wrapper exports and render behavior unchanged.

## Problem

After Step326, `property_panel_selection_shells.js` had cleaner branch dispatch, but it still owned both:

- wrapper responsibilities such as document resolution and dataset normalization
- DOM-only branch rendering for empty, multiple, and single selection shells

That kept one module spanning both normalization and presentation rendering.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_shell_renderers.js`

Move the DOM-only helpers there:

- `appendEmptySelectionShell(...)`
- `appendMultipleSelectionShell(...)`
- `appendSingleSelectionShell(...)`

Keep badge/fact DOM builders private inside the new renderer module:

- `renderSelectionBadgeRow(...)`
- `renderSelectionFactList(...)`

Keep `property_panel_selection_shells.js` as the wrapper layer that:

- resolves `document`
- normalizes `presentation` input
- writes `dataset.*`
- dispatches to empty/multiple/single renderers

## Boundaries

This step does not change:

- `renderPropertySelectionShells(...)` export contract
- `setPropertySelectionSummary(...)` export contract
- `setPropertySelectionDetails(...)` dataset contract
- `property_panel_render.js` wiring
- selection copy, badge order, or fact order
- `describeSelectionOrigin(...)` behavior

## Expected Outcome

- wrapper and renderer responsibilities are separated by file
- branch DOM assertions can move to a dedicated renderer test
- `property_panel_selection_shells.js` becomes closer to pure normalization plus dispatch
