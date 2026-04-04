# Step356: Released Archive Metadata Rows Extraction

## Goal

Extract shared released-archive metadata row assembly into a dedicated leaf helper used by:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/released_insert_selection_rows.js`

Peer-summary rows are already shared after Step355. This step covers only the released-archive metadata rows that still duplicate keys, labels, ordering, and formatting.

## Scope

In scope:

- Extract shared released-archive metadata row assembly into a new helper module.
- Cover:
  - `released-from`
  - `released-group-id`
  - `released-block-name`
  - `released-text-kind`
  - `released-attribute-tag`
  - `released-attribute-default`
  - `released-attribute-prompt`
  - `released-attribute-flags`
  - `released-attribute-modes`
- Preserve the extra `released-selection-members` row in `released_insert_selection_rows.js`.

Out of scope:

- released peer-summary rows
- group rows
- property metadata rows
- selection presentation contract changes

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Keep `buildReleasedInsertArchiveSelectionRows(...)` behavior unchanged.
- Preserve exact keys, labels, values, and ordering.
- Preserve `commonModes || formatReleasedInsertArchiveModes(archive)` behavior for released multi-selection rows.
- Do not change `released-selection-members`.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new cycle through `selection_detail_facts.js` or `released_insert_selection_rows.js`.

## Expected Shape

Introduce a new leaf helper, expected name:

- `tools/web_viewer/ui/released_archive_metadata_rows.js`

Expected responsibility:

- append/build the released archive metadata rows from an archive object
- support an optional precomputed modes string for the multi-selection path

## Acceptance

Accept Step356 only if:

- the new helper is leaf-level and cycle-safe
- both callers preserve exact output contracts
- focused tests cover single-entity and released-selection adoption
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
