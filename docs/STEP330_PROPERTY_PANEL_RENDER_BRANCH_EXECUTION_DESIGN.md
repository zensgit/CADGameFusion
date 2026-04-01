# Step330 Property Panel Render Branch Execution Design

## Goal

Extract the render-branch execution logic from `property_panel_render.js` into a dedicated helper, without changing render order, branch-state semantics, or active render payload assembly.

## Why This Step

After Step329:

- branch decision policy already lives in `property_panel_render_branch_state.js`
- `property_panel_render.js` still directly executes the branch outcomes:
  - run current-layer defaults
  - return non-rendered
  - build active input and run active render

That execution path is now the narrowest remaining seam in the render shell.

## Problem

`renderPropertyPanel(context, deps)` still mixes:

- collaborator resolution
- selection shell rendering
- branch execution side effects

The branch policy is separated, but the branch action execution is not.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_branch_execution.js`

Export one helper:

- `executePropertyPanelRenderBranch(context, branchState, deps)`

The helper should accept:

- `context`
- `branchState`
- `buildPropertyPanelActiveSelectionInput`
- `renderPropertyPanelActiveSelection`

Behavior:

- if `branchState.shouldRenderCurrentLayerDefaults`:
  - call `context.controller.renderCurrentLayerDefaults()`
  - return `{ rendered: true, kind: branchState.kind }`
- else if `!branchState.shouldRenderActiveSelection`:
  - return `{ rendered: false, kind: branchState.kind }`
- else:
  - build active render input from `context` and `branchState.selectionContext`
  - return `renderPropertyPanelActiveSelection(...)`

`property_panel_render.js` should then:

1. clear `context.form`
2. resolve `selectionContext`
3. build `branchState`
4. render selection shells
5. delegate the rest to `executePropertyPanelRenderBranch(...)`

## Boundaries

This step must not change:

- `renderPropertyPanel(...)` export contract
- `buildPropertyPanelRenderBranchState(...)` behavior
- `resolvePropertyPanelSelectionContext(...)` behavior
- `buildPropertyPanelActiveSelectionInput(...)` contract
- `renderPropertyPanelActiveSelection(...)` contract
- current-layer-default side effects
- returned `{ rendered, kind }` semantics

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_render_branch_execution.test.js`

Cover:

- defaults branch calls `renderCurrentLayerDefaults`
- non-rendered branch returns correct payload and avoids side effects
- active branch builds input from `branchState.selectionContext`
- active branch delegates to active render

Keep `property_panel_render.test.js` focused on integration behavior only.

## Expected Outcome

- `property_panel_render.js` becomes closer to a pure orchestration shell
- branch execution becomes unit-testable in isolation
- next render cleanup can target collaborator resolution without reopening branch behavior
