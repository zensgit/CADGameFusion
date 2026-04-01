# Step321 Property Panel Readonly Note Bag Design

## Goal

Remove the last direct `domBindings.*` leak from `property_panel.js` without changing branch-render behavior.

## Problem

After Step320, the main file still directly reached into the DOM adapter bag for one field:

- `domBindings.addReadonlyNote`

That value was only forwarded into render helpers. The entrypoint no longer needed to know about this individual method.

## Design

Keep the change narrow:

- `property_panel.js` now passes the whole `domBindings` bag into `renderPropertyPanel(...)`
- `property_panel_render.js` resolves `addReadonlyNote` from `context.domBindings.addReadonlyNote`
- legacy fallback to `context.addReadonlyNote` stays in place so render tests and older call patterns remain valid

No branch or active-render contracts are otherwise changed.

## Boundaries

This step does not change:

- branch renderer logic
- readonly note copy
- active render orchestration
- lifecycle handling
- controller/collaborator assembly

It only moves readonly-note bag lookup out of the entrypoint and into the render-side helper.

## Expected Outcome

`property_panel.js` no longer directly dereferences `domBindings`, and render-side bag resolution becomes explicitly testable.
