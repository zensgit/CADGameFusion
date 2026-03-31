# Step308 Property Panel Render Callbacks Design

## Goal

Remove the remaining callback-assembly clutter from `property_panel.js` without changing render-state derivation, branch ordering, or DOM behavior.

## Problem

After Step307, `property_panel.js` was already thin, but `render()` still owned the full per-render callback wiring:

- `appendBranchContext(...)`
- `appendFullTextFields()`
- `appendInsertProxyTextFields(...)`
- `appendSingleSelectionInfo()`
- `appendGroupedSelectionInfo()`
- `appendCommonSelectionActions()`
- `appendCommonPropertyFields()`
- `appendStyleActions()`
- `appendSingleEntityFields()`

These closures were stable glue, but they still obscured the actual render flow.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_callbacks.js`

The module exports:

- `createPropertyPanelRenderCallbacks(...)`

It takes the already-derived render-time data:

- `primary`
- `primaryLayer`
- `actionContext`
- `branchContext`
- `displayedColor`
- `insertGroupSummary`
- `promoteImportedColorSource`
- `releasedInsertArchiveSelection`
- `sourceGroupSummary`

and the already-constructed collaborators:

- `glueFacade`
- `selectionInfoHelpers`
- `branchContextHelper`

It returns the exact callback surface consumed by the branch renderers.

## Boundaries

`property_panel_render_callbacks.js` is responsible only for:

- wiring render-time closures to existing collaborators
- preserving the callback signatures expected by branch renderers
- keeping grouped vs single-selection callback argument binding stable

`property_panel.js` remains responsible for:

- selection/context resolution
- render-state assembly
- note/branch execution ordering
- event subscriptions and initial render

## Non-Goals

- no change to `assemblePropertyPanelRenderState(...)`
- no change to branch renderer control flow
- no change to DOM adapter behavior
- no change to patch semantics

## Expected Outcome

`property_panel.js` gets closer to a pure render composer, while callback wiring becomes directly testable as a dedicated contract.
