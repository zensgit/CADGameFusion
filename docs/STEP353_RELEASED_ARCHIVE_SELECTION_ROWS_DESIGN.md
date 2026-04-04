# Step353 Released Archive Selection Rows Design

## Goal

Extract the duplicated released-archive multi-selection row assembly that is currently repeated in:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/property_panel_info_rows.js`

This step should make one shared leaf helper the canonical source while preserving all row keys, labels, order, and text behavior.

## Scope

Create a dedicated shared helper module for released-archive multi-selection rows.

Likely target:

- `tools/web_viewer/ui/released_insert_selection_rows.js`

Canonical logic to share:

- released archive summary rows
- released attribute rows
- released peer rows for multi-peer selections

Adopt that helper in:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/property_panel_info_rows.js`

Compatibility requirements:

- `buildMultiSelectionDetailFacts(...)` must keep returning the same `key/label/value` rows
- `buildReleasedInsertArchiveSelectionInfoRows(...)` must remain exported from `property_panel_info_rows.js`
- wrappers may delegate to the new helper, but public behavior must stay unchanged

## Non-Goals

Do not change:

- single-entity released archive facts in `selection_detail_facts.js`
- `formatReleasedInsertArchiveOrigin(...)`
- `formatReleasedInsertArchiveModes(...)`
- `summarizeReleasedInsertArchiveSelection(...)`
- property panel rendering flow
- selection presentation orchestration
- row object shapes, keys, labels, or ordering

Do not bundle unrelated presenter cleanup into this step.

## Constraints

- No behavior changes.
- No new dependency cycles.
- Keep the new helper leaf-level and row-oriented.
- Preserve the `commonModes || formatReleasedInsertArchiveModes(archive)` fallback semantics.
- Preserve the `Archived / N` peer instance wording.

## Acceptance

Step353 is complete when:

1. the duplicated released-archive multi-selection row assembly exists in one canonical helper
2. `selection_detail_facts.js` and `property_panel_info_rows.js` both use it
3. `buildReleasedInsertArchiveSelectionInfoRows(...)` remains compatible
4. focused released-row/detail/property-row tests still pass
5. `editor_commands.test.js` still passes
6. `git diff --check` is clean
