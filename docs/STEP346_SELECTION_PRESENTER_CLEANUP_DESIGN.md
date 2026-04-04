# Step346 Selection Presenter Cleanup Design

## Goal

Clean up `tools/web_viewer/ui/selection_presenter.js` after the Step339-Step345
extractions by removing private helpers and imports that are no longer used by the
facade, while keeping behavior unchanged.

## Why This Seam

After Step345, `selection_presenter.js` is already a thin facade for:

- selection meta helpers
- overview helpers
- released archive helpers
- selection contract/detail/property metadata/action-context helpers
- property-panel note helpers and note-plan helper
- selection badges

What remains beyond the facade surface is:

- `buildSelectionPresentation(...)`
- a small number of local helpers that it still needs
- several private helpers left behind by earlier extractions that are no longer
  used by the file

This makes Step346 the safest next seam:

- it shrinks `selection_presenter.js` further without introducing new modules
- it does not broaden scope into `buildSelectionPresentation(...)`
- it reduces maintenance noise before any later presentation-level extraction

## Required Scope

Remove only the private helpers and now-unused imports that are no longer needed by
`selection_presenter.js`.

This cleanup may include helpers such as:

- `normalizeText(...)`
- `pushFact(...)`
- `insertFactsAfterFirstKey(...)`
- `formatCompactNumber(...)`
- `formatPoint(...)`
- `formatPeerContext(...)`
- `formatPeerTarget(...)`
- `formatSourceGroup(...)`
- `formatAttributeModes(...)`

if and only if they are truly unused by the post-Step345 facade.

## Explicit Non-Goals

Do not change:

- `buildSelectionPresentation(...)`
- `supportsInsertTextPositionEditing(...)`
- any existing public re-export
- `selection_badges.js`
- `selection_overview.js`
- `selection_detail_facts.js`
- `selection_contract.js`
- `property_metadata_facts.js`
- `selection_action_context.js`
- `property_panel_note_helpers.js`
- `property_panel_note_plan.js`

Do not change:

- summary text
- status text
- badge order or content
- detail fact ordering or semantics
- property panel behavior

## Dependency Rules

Step346 is a cleanup-only seam. It must not introduce any new module and must not
change dependency direction.

In particular:

- no new import from `selection_presenter.js` is allowed anywhere else
- no new helper extraction is required
- no new cycle is allowed

## Testing Expectations

There may be no new test file for this step if the change is strictly dead-helper
removal.

At minimum, keep the existing presentation coverage green:

- `tools/web_viewer/tests/editor_commands.test.js`

If the cleanup touches any direct presentation seam, also run the focused test file
that already exercises the presenter contract.

## Done Criteria

Step346 is done when:

1. `selection_presenter.js` no longer contains dead private helpers from earlier seams
2. related dead imports are removed
3. public exports remain stable
4. existing tests pass unchanged
5. `git diff --check` stays clean
