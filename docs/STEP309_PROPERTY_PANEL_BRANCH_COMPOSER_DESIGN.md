# Step309 Property Panel Branch Composer Design

## Goal

Remove the last inline branch-composer glue from `property_panel.js` without moving selection-state derivation or changing branch-renderer behavior.

## Problem

After Step308, `property_panel.js` was already thin, but `render()` still owned the whole active-selection branch sequence:

- run read-only branch
- stop on read-only block
- render released-insert note
- run locked branch
- stop on locked block
- run editable branch

This code no longer derived state and no longer built DOM directly. It was only sequencing existing branch renderers.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_branch_composer.js`

The module exports:

- `renderPropertyPanelSelectionBranches(context, handlers)`

It imports and composes the existing branch renderers:

- `renderReadOnlySelectionBranch(...)`
- `renderReleasedInsertArchiveNote(...)`
- `renderLockedSelectionBranch(...)`
- `renderEditableSelectionBranch(...)`

The helper keeps the exact ordering and short-circuit semantics already used in `property_panel.js`.

## Boundaries

`property_panel_branch_composer.js` is responsible only for:

- sequencing branch-renderer calls
- preserving read-only and locked early returns
- forwarding the existing callback surface unchanged

`property_panel.js` remains responsible for:

- DOM setup and subscriptions
- selection-context resolution
- render-state assembly
- callback-factory creation

## Non-Goals

- no change to `assemblePropertyPanelRenderState(...)`
- no change to branch-renderer internals
- no change to callback factory behavior
- no change to DOM adapter or patch semantics

## Expected Outcome

`property_panel.js` gets closer to a pure orchestration shell, and branch sequencing becomes directly testable as an isolated contract.
