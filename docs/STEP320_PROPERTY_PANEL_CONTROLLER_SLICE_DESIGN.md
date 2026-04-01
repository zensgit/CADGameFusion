# Step320 Property Panel Controller Slice Design

## Goal

Keep reducing `property_panel.js` toward a pure exported entrypoint by removing the last inline controller projection object.

## Problem

After Step319, the main file still hand-built a tiny adapter object:

- `{ patchSelection: controller.patchSelection, buildPatch: buildPropertyPanelPatch }`

This projection existed only to narrow the surface passed into collaborators. It was local glue, not panel behavior.

## Design

Add:

- `tools/web_viewer/ui/property_panel_controller_slice.js`

The module exports:

- `buildPropertyPanelControllerSlice(controller, { buildPatch })`

It owns:

- projecting `patchSelection` from the controller
- projecting `buildPatch` from the patch helper dependency

`property_panel.js` now delegates that small adapter step instead of constructing the object inline.

## Boundaries

This step does not change:

- controller behavior
- collaborator behavior
- patch semantics
- render semantics
- lifecycle or DOM root wiring

It only removes one remaining inline projection from the entrypoint.

## Expected Outcome

`property_panel.js` becomes slightly closer to a pure exported entrypoint, and the controller-to-collaborator surface is testable as a dedicated helper.
