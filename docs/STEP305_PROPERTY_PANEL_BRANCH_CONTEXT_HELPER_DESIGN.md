# Step305 Property Panel Branch Context Helper Design

## Goal

Continue shrinking `property_panel.js` by extracting the last remaining branch-context bridge helper without changing branch behavior, info-row ordering, or action wiring.

## Problem

After Step304, `property_panel.js` still owned one local helper that only adapts render-scope selection state into an existing branch-context renderer:

- `appendBranchContext(...)`

This helper does not define policy. It only packages already-computed selection context and DOM/action sinks into `renderPropertyBranchContext(...)`.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_branch_context_helper.js`

The module exports:

- `createPropertyPanelBranchContextHelper(...)`

The helper factory owns exactly one responsibility:

- bridge render-scope branch context plus DOM/action sinks into `renderPropertyBranchContext(...)`

`property_panel.js` now:

- instantiates `branchContextHelper`
- builds a tiny `branchContext` object inside `render()`
- delegates `appendBranchContext(options)` to `branchContextHelper.appendBranchContext(branchContext, options)`

## Boundaries

`property_panel_branch_context_helper.js` is responsible for:

- wiring `documentState.getLayer(...)`
- wiring `documentState.listEntities()`
- forwarding `appendInfoRows`
- forwarding layer/source/insert/released action sinks
- preserving `showReleasedSelectionInfo`, `showReleasedActions`, and `preferSourceGroupFallback`

`property_panel.js` remains responsible for:

- selection lifecycle and `render()` orchestration
- computing `branchContext`
- branch sequencing
- read-only / locked / editable branch selection

`renderPropertyBranchContext(...)` remains unchanged and continues to own actual branch-context rendering.

## Non-Goals

- no change to metadata fact generation
- no change to group/released info-row ordering
- no change to action ids or action visibility
- no extraction of `render()` itself in this step

## Expected Outcome

`property_panel.js` loses its last remaining branch-context bridge helper and moves closer to a pure render orchestrator with only render-scope state assembly left inside.
