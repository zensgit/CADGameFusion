# Step302 Property Panel Patch Helpers Design

## Goal

Continue shrinking `property_panel.js` by extracting the remaining patch-building and value-coercion helpers into a local module without changing field semantics, patch shape, or selection wiring.

## Problem

After Step301, `property_panel.js` was mostly orchestration, but it still owned one concentrated block of edit semantics:

- boolean coercion for property inputs
- number coercion and clamping
- entity-type-specific patch construction for line, polyline, circle, arc, and text
- imported color-source promotion detection

These helpers are not DOM work and not branch policy. They are edit-patch semantics, so they deserve their own focused boundary.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_patch_helpers.js`

The module exports:

- `buildPropertyPanelPatch(entity, key, rawValue)`
- `shouldPromoteImportedColorSource(entities)`

Internal coercion remains local to the helper module:

- boolean parsing
- number parsing

`property_panel.js` stops owning this logic and simply passes `buildPropertyPanelPatch` into `property_panel_glue_facade.js`.

## Boundaries

`property_panel_patch_helpers.js` is responsible for:

- coercing raw field input values
- clamping numeric patch values where current behavior already clamps them
- preserving per-entity patch shape for line, polyline, circle, arc, and text edits
- detecting imported color-source cases that require explicit-color promotion on layer reassignment

`property_panel.js` remains responsible for:

- calling `patchSelection(...)`
- computing selection/presentation state
- branch orchestration
- DOM adapter and facade wiring

`property_panel_glue_facade.js` remains responsible for:

- forwarding patch helper usage into field builders
- preserving field/action row order

## Non-Goals

- no change to patch key names or patch payload shape
- no change to line weight / line type scale clamping rules
- no change to imported color promotion behavior
- no change to field labels or action behavior

## Expected Outcome

`property_panel.js` gets closer to a pure orchestration shell, and patch semantics become directly testable without going through the full panel or browser smoke.
