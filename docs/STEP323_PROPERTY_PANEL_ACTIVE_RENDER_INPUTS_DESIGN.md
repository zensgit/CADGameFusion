# Step323 Property Panel Active Render Inputs Design

## Goal

Thin `property_panel_active_render.js` by extracting the two render-state projection literals it still owned, without changing any selection, note, or branch behavior.

## Problem

After Step322, `property_panel_active_render.js` still assembled two wide inline payloads:

- the callbacks input passed into `createPropertyPanelRenderCallbacks(...)`
- the branch input passed into `renderPropertyPanelSelectionBranches(...)`

Those payloads were pure projection logic, but they kept the active-render shell wider than necessary and harder to read.

## Design

Introduce a small helper module:

- `buildPropertyPanelActiveRenderCallbacksInput(context, renderState)`
- `buildPropertyPanelActiveBranchInput(context, renderState)`

`property_panel_active_render.js` now:

- assembles render state
- delegates the two input projections to the helper
- invokes callbacks creation and branch rendering exactly as before

## Boundaries

This step does not change:

- render-state assembly
- branch note sequencing
- read-only or locked blocking rules
- callback behavior
- render result shape

It only extracts deterministic input projection from the active-render shell.

## Expected Outcome

`property_panel_active_render.js` becomes easier to scan and closer to a composition shell, while the extracted helper gets direct focused tests.
