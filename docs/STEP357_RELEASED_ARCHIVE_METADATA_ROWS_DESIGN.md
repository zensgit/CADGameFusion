# Step357: Released Archive Metadata Rows Extraction

## Goal

Extract shared released-archive metadata row assembly into a dedicated leaf helper used by:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/released_insert_selection_rows.js`

The purpose is to remove duplicated released-archive identity and attribute row formatting while preserving current keys, labels, ordering, and wording.

## Scope

In scope:

- Extract shared released-archive identity rows.
- Extract shared released-archive attribute rows.
- Adopt the new helper in both single-selection and multi-selection released archive paths.
- Add focused helper tests for the extracted row assembly.

Out of scope:

- released peer row formatting
- group info rows
- selection presentation contract changes
- note-plan or property-panel behavior

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Keep `buildReleasedInsertArchiveSelectionRows(...)` behavior unchanged.
- Preserve exact keys, labels, values, and row ordering.
- Preserve `commonModes` override behavior in multi-selection released archive rows.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new cycle through either caller.

## Expected Shape

Introduce a new leaf helper:

- `tools/web_viewer/ui/released_archive_metadata_rows.js`

Expected responsibility split:

- shared helper: released archive identity + attribute rows
- callers: choose when to append peer rows or selection-member rows

## Acceptance

Accept Step357 only if:

- the new helper is leaf-level and cycle-safe
- both callers preserve their exact output contracts
- focused tests cover helper behavior and ordering
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
