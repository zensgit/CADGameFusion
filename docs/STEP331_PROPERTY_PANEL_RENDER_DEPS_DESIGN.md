# Step331 Property Panel Render Deps Design

## Goal

Extract collaborator resolution from `property_panel_render.js` into a dedicated helper, without changing orchestration order or any render behavior.

## Why This Step

After Step330, `property_panel_render.js` is already a thin orchestration shell. The only non-trivial local work left is resolving its collaborators from `deps` or real imports.

That makes dependency resolution the narrowest next seam.

## Problem

`renderPropertyPanel(context, deps)` still directly resolves:

- `renderPropertySelectionShells`
- `resolvePropertyPanelSelectionContext`
- `buildPropertyPanelRenderBranchState`
- `executePropertyPanelRenderBranch`

This is small, but it is still a local policy block inside the orchestration shell.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_deps.js`

Export one helper:

- `resolvePropertyPanelRenderDeps(deps = {})`

It should return a normalized collaborator object containing:

- `renderSelectionShells`
- `resolveSelectionContext`
- `buildBranchState`
- `executeBranch`

Each field should preserve the exact current fallback behavior:

- injected `deps.*` first
- otherwise real imported implementation

`property_panel_render.js` should then:

1. call `resolvePropertyPanelRenderDeps(deps)`
2. clear `context.form`
3. resolve selection context
4. build branch state
5. render selection shells
6. execute branch

## Boundaries

This step must not change:

- `renderPropertyPanel(...)` export contract
- render order
- selection context resolution behavior
- branch-state behavior
- branch-execution behavior
- any return value semantics

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_render_deps.test.js`

Cover:

- empty `deps` resolves all real collaborators
- injected collaborators override real ones independently
- returned collaborator key names match the render shell’s expected names

Keep `property_panel_render.test.js` focused on orchestration behavior only.

## Expected Outcome

- `property_panel_render.js` becomes a pure sequence shell
- collaborator fallback policy becomes unit-testable in isolation
- next refactor can target shell bootstrap/factory concerns without reopening render behavior
