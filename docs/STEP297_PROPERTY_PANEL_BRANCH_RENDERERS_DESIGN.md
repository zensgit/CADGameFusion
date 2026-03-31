# Step297 Property Panel Branch Renderers Design

## Goal

Shrink the remaining orchestration weight inside `property_panel.js` by extracting the top-level selection branch flow without changing user-visible property behavior.

## Problem

After Steps 291-296, `property_panel.js` still contained one long `render()` function that directly encoded:

- read-only branch notes and early-return behavior
- released archive note gating
- locked-layer branch notes and early-return behavior
- editable branch sequencing for single vs multi selection

The file had already offloaded actions, fields, defaults, and info rows, but the branch control itself was still inline.

## Design

Extract branch sequencing into a new local orchestration module:

- `tools/web_viewer/ui/property_panel_branch_renderers.js`

The module exports four narrow helpers:

- `renderReadOnlySelectionBranch(...)`
- `renderReleasedInsertArchiveNote(...)`
- `renderLockedSelectionBranch(...)`
- `renderEditableSelectionBranch(...)`

These helpers do not create DOM directly. Instead they call handler callbacks supplied by `property_panel.js`.

## Boundary Choice

This step intentionally does not move:

- note policy generation
- info row generation
- field descriptor generation
- action descriptor generation

Those contracts were already stabilized in earlier steps. Step297 only moves the sequencing logic that decides which of those pieces should render and when rendering should stop.

## Handler Model

`property_panel.js` now provides thin handlers such as:

- `appendBranchContext(...)`
- `appendSingleSelectionInfo(...)`
- `appendGroupedSelectionInfo(...)`
- `appendCommonSelectionActions(...)`
- `appendCommonPropertyFields(...)`
- `appendSourceTextFields(...)`
- `appendInsertProxyTextFields(...)`
- `appendSingleEntityFields(...)`

This keeps `property_panel_branch_renderers.js` focused on branch order and blocking behavior, while `property_panel.js` remains the DOM shell.

## Expected Outcome

- shorter `render()` body
- clearer read-only / locked / editable branch responsibilities
- unit-testable branch sequencing without scraping DOM
