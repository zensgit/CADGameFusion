# Step314 Property Panel Controller Bags Design

## Goal

Continue shrinking `createPropertyPanel(...)` orchestration noise by making the controller contract explicitly bag-based, without changing runtime behavior.

## Problem

After Step312, `property_panel.js` already resolved a grouped `controllerInputs` bag, but immediately spread it back into `createPropertyPanelController(...)`. The controller also still accepted DOM callbacks as flat arguments:

- `addNote`
- `addActionRow`
- `appendFieldDescriptors`
- `appendInfoRows`

That kept both caller and callee noisier than necessary.

## Design

Update `createPropertyPanelController(...)` to accept two explicit bags:

- `controllerInputs`
- `domBindings`

Both bags remain backward compatible:

- nested bag entries win when present
- legacy flat arguments still work

Then update `property_panel.js` to pass:

- `controllerInputs` from `resolvePropertyPanelControllerInputs(...)`
- `domBindings` from `createPropertyPanelDomAdapter(...)`

## Boundaries

This step does not change:

- controller behavior
- render branching
- property patch semantics
- collaborator wiring

It only changes how controller dependencies are assembled.

## Expected Outcome

`property_panel.js` stops re-expanding controller and DOM dependencies, and `createPropertyPanelController(...)` has a clearer, more explicit API boundary.
