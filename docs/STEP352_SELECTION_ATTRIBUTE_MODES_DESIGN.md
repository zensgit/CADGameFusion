# Step352 Selection Attribute Modes Design

## Goal

Extract the duplicated attribute-mode formatting logic that is currently split between:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/selection_released_archive_helpers.js`

This step should make one shared leaf helper the canonical source while preserving all existing text, ordering, and public behavior.

## Scope

Create a dedicated shared helper module for attribute-mode formatting.

Likely target:

- `tools/web_viewer/ui/selection_attribute_mode_helpers.js`

Canonical logic to share:

- detect whether attribute metadata exists
- format the ordered mode string
- preserve the `attributeFlags: 0 => "None"` behavior

Adopt that helper in:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/selection_released_archive_helpers.js`

Compatibility requirement:

- `formatReleasedInsertArchiveModes(...)` must remain exported from `selection_released_archive_helpers.js`
- it may become a wrapper around the shared helper, but its public behavior must stay unchanged

## Non-Goals

Do not change:

- `buildSelectionDetailFacts(...)`
- `buildMultiSelectionDetailFacts(...)`
- `summarizeReleasedInsertArchiveSelection(...)`
- `buildPropertyMetadataFacts(...)`
- `buildSelectionPresentation(...)`
- `property_panel_info_rows.js`
- any row ordering, fact keys, labels, note text, or UI behavior

Do not bundle unrelated display-helper cleanup into this step.

## Constraints

- No behavior changes.
- No new dependency cycles.
- Keep the new helper leaf-level and generic.
- Preserve current public exports from `selection_released_archive_helpers.js`.
- Preserve mode ordering exactly:
  - `Invisible`
  - `Constant`
  - `Verify`
  - `Preset`
  - `Lock Position`

## Acceptance

Step352 is complete when:

1. the duplicated attribute-mode formatter exists in one canonical helper
2. `selection_detail_facts.js` and `selection_released_archive_helpers.js` both use it
3. `formatReleasedInsertArchiveModes(...)` remains compatible
4. focused helper/detail/archive tests still pass
5. `editor_commands.test.js` still passes
6. `git diff --check` is clean
