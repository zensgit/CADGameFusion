# Step355: Peer Summary Rows Extraction

## Goal

Extract shared peer-summary row assembly into a dedicated leaf helper used by:

- `tools/web_viewer/ui/group_info_rows.js`
- `tools/web_viewer/ui/released_insert_selection_rows.js`

The purpose is to remove duplicated peer row formatting while preserving current keys, labels, ordering, and archived wording.

## Scope

In scope:

- Extract shared peer row assembly into a new helper module.
- Cover:
  - peer instance row
  - peer count row
  - peer layouts row
  - peer targets row
- Support both normal peer wording and released-archive peer wording.

Out of scope:

- group identity rows
- group member count rows
- group bounds rows
- released archive non-peer rows
- selection presentation contract changes

## Constraints

- Keep `buildInsertGroupInfoRows(...)` behavior unchanged.
- Keep `buildReleasedInsertArchiveSelectionRows(...)` behavior unchanged.
- Preserve exact keys, labels, values, and row ordering.
- Preserve `Archived / N` released-peer wording.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new cycle through `group_info_rows.js` or `released_insert_selection_rows.js`.

## Expected Shape

Introduce a new leaf helper, expected name:

- `tools/web_viewer/ui/peer_summary_rows.js`

Expected responsibility:

- build common peer-summary rows from a `peerSummary` object
- allow released-archive mode for the released peer labels/instance wording

## Acceptance

Accept Step355 only if:

- the shared helper is leaf-level and cycle-safe
- both callers preserve their exact output contracts
- focused tests cover normal and released peer row variants
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
