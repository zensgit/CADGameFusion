# Step343: Selection Action Context Extraction

## Goal

Extract `buildSelectionActionContext(...)` from
`tools/web_viewer/ui/selection_presenter.js` into a dedicated helper module
while keeping behavior and public exports unchanged.

## Why This Step

After Step342, `selection_presenter.js` still owns:

- selection action context assembly
- property panel note helpers
- selection presentation assembly

`buildSelectionActionContext(...)` is the narrowest next seam because it is a
distinct data-shaping function used by property-panel actions and does not own
rendering or user-facing note copy.

## Scope

In scope:

- create a new helper module for selection action context assembly
- move the implementation of `buildSelectionActionContext(...)` into that module
- keep `selection_presenter.js` importing and re-exporting
  `buildSelectionActionContext(...)`
- add focused tests for the new helper module

Out of scope:

- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelReleasedArchiveNote(...)`
- `buildPropertyPanelLockedLayerNote(...)`
- `buildPropertyPanelNotePlan(...)`
- `buildSelectionPresentation(...)`
- property panel rendering changes

## Target Files

Expected new file:

- `tools/web_viewer/ui/selection_action_context.js`

Expected touched files:

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/tests/selection_action_context.test.js`

## Required Behavior

The extraction must preserve all current `buildSelectionActionContext(...)`
behavior:

- same public return shape
- same `selectionIds` normalization
- same `sourceGroup` payload
- same `insertGroup` payload
- same `releasedInsert` payload
- same `peerTargets` ordering
- same `selectionMatches*` semantics
- same insert peer scope handling

`selection_presenter.js` must continue exporting
`buildSelectionActionContext(...)` so downstream imports do not change.

## Dependency Rules

The new helper may import from leaf/shared modules and existing insert-group
helpers, but it must not import from `selection_presenter.js`.

No new cycle back into `selection_presenter.js` is allowed.

## Acceptance

Step343 is complete when:

1. `buildSelectionActionContext(...)` lives outside `selection_presenter.js`
2. `selection_presenter.js` re-exports it without behavior drift
3. focused tests cover source-group, insert-group, released-insert, and null input
4. existing integration tests remain green
