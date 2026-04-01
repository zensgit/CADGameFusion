# Step332 Property Panel Render Pipeline Design

## Goal

Extract the orchestration sequence from `property_panel_render.js` into a dedicated pipeline helper, without changing dependency resolution, branch-state behavior, branch-execution behavior, or render order.

## Why This Step

After Step331:

- dependency resolution already lives in `property_panel_render_deps.js`
- branch policy already lives in `property_panel_render_branch_state.js`
- branch execution already lives in `property_panel_render_branch_execution.js`

The only remaining logic in `property_panel_render.js` is the orchestration pipeline itself.

## Problem

`renderPropertyPanel(context, deps)` still directly sequences:

- clear form
- resolve selection context
- build branch state
- render selection shells
- execute branch

That is now a clean seam and can be isolated without expanding scope.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_pipeline.js`

Export one helper:

- `runPropertyPanelRenderPipeline(context, resolvedDeps)`

Behavior:

1. `context.form.innerHTML = ''`
2. `selectionContext = resolvedDeps.resolveSelectionContext(...)`
3. `branchState = resolvedDeps.buildBranchState(selectionContext)`
4. `resolvedDeps.renderSelectionShells(context.summary, context.details, branchState.presentation)`
5. `return resolvedDeps.executeBranch(context, branchState, resolvedDeps.rawDeps || {})`

`resolvePropertyPanelRenderDeps(...)` should remain unchanged.

`property_panel_render.js` should then:

1. resolve collaborators with `resolvePropertyPanelRenderDeps(deps)`
2. call `runPropertyPanelRenderPipeline(context, resolvedDeps)`

## Boundaries

This step must not change:

- `renderPropertyPanel(...)` export contract
- `resolvePropertyPanelRenderDeps(...)` behavior
- `buildPropertyPanelRenderBranchState(...)` behavior
- `executePropertyPanelRenderBranch(...)` behavior
- selection shell rendering order
- returned `{ rendered, kind }` semantics

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_render_pipeline.test.js`

Cover:

- pipeline clears form before rendering
- pipeline calls collaborators in order
- pipeline passes `branchState.presentation` to shell render
- pipeline passes `context` and `branchState` to branch execution
- pipeline returns branch execution result unchanged

Keep `property_panel_render.test.js` focused on entrypoint integration only.

## Expected Outcome

- `property_panel_render.js` becomes a true entrypoint wrapper
- orchestration order becomes unit-testable in isolation
- next cleanup can target entrypoint/bootstrap concerns without reopening render behavior
