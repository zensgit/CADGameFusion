# Step322 Property Panel Readonly Note Callback Consolidation Design

## Goal

Remove the last separate `addReadonlyNote` threading path between active render, branch composer, and branch renderers without changing note order, note copy, or branch blocking behavior.

## Problem

After Step321, `property_panel.js` no longer dereferenced `domBindings.addReadonlyNote`, but the active selection path still split readonly-note handling away from the main callback surface:

- `property_panel_active_render.js` passed `{ addReadonlyNote, callbacks }`
- `property_panel_branch_composer.js` then rethreaded `handlers.addReadonlyNote` and `handlers.callbacks.*`
- branch renderers consumed that split shape even though readonly notes belonged to the same render-time callback contract

That extra split made the branch contract wider than necessary.

## Design

Keep the step narrow and behavior-safe:

- `createPropertyPanelRenderCallbacks(...)` now accepts and returns `addReadonlyNote`
- `property_panel_active_render.js` passes a single callbacks bag into `renderPropertyPanelSelectionBranches(...)`
- `property_panel_branch_composer.js` forwards that unified callbacks surface directly into branch renderers
- branch renderers keep calling `addReadonlyNote(...)` at their original execution points

This preserves DOM order:

- read-only note still renders before branch context and direct text-edit escape fields
- released-insert note still renders before locked-note handling
- locked note still renders before locked branch context

## Boundaries

This step does not change:

- note copy or CSS classes
- active-render state assembly order
- read-only or locked blocking rules
- source-text or insert-proxy fallback behavior
- editable branch sequencing

It only consolidates readonly-note delivery into the same callbacks surface already used by the rest of branch rendering.

## Expected Outcome

The branch contract becomes smaller and easier to reason about:

- active render passes one callbacks bag instead of a split note-plus-callbacks shape
- composer no longer peels `addReadonlyNote` off into a dedicated handler channel
- renderer behavior remains externally unchanged
