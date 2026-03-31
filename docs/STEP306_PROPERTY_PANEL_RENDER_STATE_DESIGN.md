# Step306 Property Panel Render State Design

## Goal

Reduce the remaining render-scope state assembly inside `property_panel.js` without changing branch behavior, selection presentation, or patch semantics.

## Problem

After Step305, `property_panel.js` still assembled a dense block of render-local derived state before running the branch renderers:

- `promoteImportedColorSource`
- `readOnlyCount`
- `lockedCount`
- `primaryLayer`
- `displayedColor`
- `selectionIds`
- `actionContext`
- `notePlan`
- `sourceGroupSummary`
- `insertGroupSummary`
- `releasedInsertArchive`
- `releasedInsertArchiveSelection`
- `branchContext`

These values are tightly related and consumed only within `render()`. They form an implicit struct already, but were still computed inline.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_render_state.js`

The module exports:

- `assemblePropertyPanelRenderState(entities, primary, { documentState, controller })`

The helper owns only pure render-scope derivation:

- layer / color resolution
- read-only / locked counts
- selection action-context lookup
- note-plan assembly
- source/insert/released selection summaries
- `branchContext` struct assembly

`property_panel.js` now calls the helper once per populated render and destructures the returned state object.

## Boundaries

`property_panel_render_state.js` is responsible for:

- render-local derived state only
- preserving existing helper usage:
  - `resolveEffectiveEntityColor(...)`
  - `shouldPromoteImportedColorSource(...)`
  - `buildPropertyPanelNotePlan(...)`
  - `summarizeReleasedInsertArchiveSelection(...)`
  - `controller.resolveSelectionActionContext(...)`

`property_panel.js` remains responsible for:

- DOM clearing and empty-selection short-circuit
- selection presentation summary/details
- branch execution ordering
- wiring branch helpers and glue facade

## Non-Goals

- no change to branch ordering
- no change to note-plan behavior
- no change to promoted-color-source semantics
- no change to action-context shape

## Expected Outcome

`property_panel.js` gets closer to a pure render composer, while the full render-scope derived state becomes a directly testable contract.
