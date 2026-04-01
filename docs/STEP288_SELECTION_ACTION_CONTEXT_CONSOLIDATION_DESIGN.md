# Step288 Selection Action Context Consolidation Design

## Goal

Consolidate the remaining group/release action context so:

- [property_panel.js](../tools/web_viewer/ui/property_panel.js) stops recomputing source/insert/released selection summaries on its own
- source-group, insert-group, and released-insert actions all consume one presenter-side context contract
- action labels and click handlers stay local to property panel

## Problem

After Step287, metadata facts were already unified, but action enablement and counts still lived in a second local knowledge graph inside [property_panel.js](../tools/web_viewer/ui/property_panel.js):

- `resolveSourceGroupSummary(...)`
- `resolveInsertGroupSummary(...)`
- `resolveReleasedInsertGroupSummary(...)`
- `resolveSourceTextGuideInfo(...)`
- `resolveInsertPeerSummary(...)`
- `resolveReleasedInsertPeerSummary(...)`
- local `textMemberCount`, `resettableTextMemberCount`, peer scope and selection-match logic

That duplication was risky for the same reason Step287 was risky:

- presenter and property panel could drift on selection scope
- peer-navigation eligibility could diverge
- source-text and released-insert actions could read different counts from the same selection

## Design

### 1. Add a shared action-context builder in selection_presenter

Extend [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js) with:

- `buildSelectionActionContext(entity, selectionIds, options)`

It returns three grouped contexts:

- `sourceGroup`
- `insertGroup`
- `releasedInsert`

Each group owns the already-derived state that property-panel action rows need:

- summaries
- peer summaries
- source-text guide
- text-member id sets and counts
- resettable text counts
- selection-match booleans
- insert peer scope and peer-navigation eligibility

### 2. Keep property_panel as the action renderer

The builder does not return buttons.

[property_panel.js](../tools/web_viewer/ui/property_panel.js) still owns:

- button ids
- labels
- click handlers
- status messages

This keeps UI behavior local while moving the context derivation to one shared source.

### 3. Reuse the same context in multiple panel branches

The new action context is resolved once per render and reused across:

- read-only branch
- locked-layer branch
- normal single-select branch
- multi-select group/release branch

That removes the need for property panel to call summary/peer/guide helpers repeatedly.

## Files

- [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [editor_commands.test.js](../tools/web_viewer/tests/editor_commands.test.js)

## Why This Is The Right Cut

This finishes the presenter/property-panel overlap reduction in two clean passes:

1. Step287 unified metadata facts
2. Step288 unifies action context

What remains local in property panel is now mostly actual UI behavior:

- notes
- editing widgets
- action rows and click wiring

That is a better long-term boundary than duplicating selection semantics in two places.
