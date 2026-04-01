# Step333 Property Panel Render Raw Deps Transport Design

## Goal

Remove the mutable `resolved.rawDeps = deps` transport from `property_panel_render.js` and replace it with an explicit raw-deps parameter on the pipeline helper.

## Why This Step

After Step332:

- `renderPropertyPanel(...)` is a thin entrypoint: resolve deps, mutate `resolved.rawDeps`, delegate to pipeline
- `runPropertyPanelRenderPipeline(...)` reads `resolvedDeps.rawDeps || {}` and forwards it to `executeBranch`

The mutable assignment `resolved.rawDeps = deps` is a transport hack — the resolved deps object is modified after construction. This makes the data flow implicit and prevents `resolvePropertyPanelRenderDeps` output from being treated as immutable.

## Problem

`renderPropertyPanel(...)` mutates the resolved deps object to attach `rawDeps`:

```js
const resolved = resolvePropertyPanelRenderDeps(deps);
resolved.rawDeps = deps;
return runPropertyPanelRenderPipeline(context, resolved);
```

And `runPropertyPanelRenderPipeline(...)` reads it back:

```js
return resolvedDeps.executeBranch(context, branchState, resolvedDeps.rawDeps || {});
```

This couples the pipeline to an implicitly-set property rather than an explicit parameter.

## Design

Change `runPropertyPanelRenderPipeline` signature to:

- `runPropertyPanelRenderPipeline(context, resolvedDeps, rawDeps = {})`

The pipeline should use the explicit `rawDeps` parameter instead of `resolvedDeps.rawDeps`:

```js
return resolvedDeps.executeBranch(context, branchState, rawDeps);
```

`renderPropertyPanel(...)` should then:

1. resolve collaborators
2. call `runPropertyPanelRenderPipeline(context, resolved, deps)`

No mutation of the resolved object.

## Boundaries

This step must not change:

- `renderPropertyPanel(...)` export contract
- `resolvePropertyPanelRenderDeps(...)` behavior
- `runPropertyPanelRenderPipeline(...)` orchestration order
- `buildPropertyPanelRenderBranchState(...)` behavior
- `executePropertyPanelRenderBranch(...)` behavior
- returned `{ rendered, kind }` semantics

## Test Plan

Update:

- `tools/web_viewer/tests/property_panel_render_pipeline.test.js`

Adjust rawDeps tests to pass rawDeps as the third argument instead of as a property on resolvedDeps.

Keep `property_panel_render.test.js` focused on entrypoint behavior only.

## Expected Outcome

- `resolvePropertyPanelRenderDeps` output is never mutated
- raw deps transport is explicit in the pipeline function signature
- data flow from entrypoint through pipeline to branch execution is fully traceable through parameters
