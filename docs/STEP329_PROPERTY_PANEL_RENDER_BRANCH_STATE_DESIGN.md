# Step329 Property Panel Render Branch State Design

## Goal

Extract the render-branch decision logic from `property_panel_render.js` into a dedicated helper, without changing render order, selection context resolution, or active render payload assembly.

## Why This Step

After Step328:

- `property_panel_selection_shells.js` is already reduced to wrapper work
- `property_panel_render.js` is small, but it still owns the last non-trivial branch policy:
  - when to render current-layer defaults
  - when to stop with `{ rendered: false }`
  - when active selection is eligible for active render

That branch policy is now the narrowest remaining seam in the render shell.

## Problem

`renderPropertyPanel(context, deps)` still directly decides:

- whether selection is `empty`
- whether the shell should return `rendered: false`
- whether active render should run

So one function still mixes:

- collaborator resolution
- shell rendering
- branch policy

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_branch_state.js`

Export one helper:

- `buildPropertyPanelRenderBranchState(selectionContext)`

The helper should return a normalized object containing:

- `kind`
- `presentation`
- `selectionContext`
- `shouldRenderCurrentLayerDefaults`
- `shouldRenderActiveSelection`

Where:

- `shouldRenderCurrentLayerDefaults` is true only for `kind === 'empty'`
- `shouldRenderActiveSelection` is true only when:
  - `kind === 'active'`
  - `entities.length > 0`
  - `primary` exists

`property_panel_render.js` should then:

1. clear `context.form`
2. resolve `selectionContext`
3. build `branchState`
4. render selection shells from `branchState.presentation`
5. branch only on `branchState.shouldRenderCurrentLayerDefaults` / `branchState.shouldRenderActiveSelection`

## Boundaries

This step must not change:

- `renderPropertyPanel(...)` export contract
- `resolvePropertyPanelSelectionContext(...)` behavior
- `buildPropertyPanelActiveSelectionInput(...)` contract
- `renderPropertyPanelActiveSelection(...)` contract
- empty-state current-layer-default behavior
- returned `{ rendered, kind }` semantics

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_render_branch_state.test.js`

Cover:

- empty context -> defaults branch
- missing context -> non-rendered branch
- active context with no entities -> non-rendered branch
- active context with primary -> active-render branch

Keep `property_panel_render.test.js` focused on integration:

- empty selection still routes through current-layer defaults
- active selection still delegates to active render
- missing selection still returns non-rendered

## Expected Outcome

- `property_panel_render.js` becomes closer to pure orchestration
- branch policy becomes unit-testable in isolation
- next render-shell cleanup can proceed without touching selection-context logic
