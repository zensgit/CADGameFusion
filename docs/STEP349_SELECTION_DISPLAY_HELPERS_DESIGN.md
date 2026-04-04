# Step349 Selection Display Helpers Design

## Goal

Extract the duplicated selection display/formatting helpers that currently live in both:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/property_panel_info_rows.js`

The objective is to create one leaf/shared helper module so both files consume the same formatting logic without changing any user-visible behavior.

## Scope

This step is intentionally narrow. It only targets the duplicated formatting/display helpers used to build human-readable strings for selection metadata and property-panel info rows.

Expected shared helpers include:

- compact numeric formatting
- point formatting
- peer context formatting
- peer target formatting
- source-group formatting

The new shared module should remain a leaf module and must not import `selection_presenter.js`.

## Non-Goals

Do not change:

- `buildSelectionDetailFacts(...)`
- `buildMultiSelectionDetailFacts(...)`
- `buildEntityMetadataInfoRows(...)`
- `buildReleasedInsertArchiveSelectionInfoRows(...)`
- `buildSourceGroupInfoRows(...)`
- `buildInsertGroupInfoRows(...)`
- property-panel rendering behavior
- fact ordering
- row ordering
- labels, keys, or text semantics

Do not change the output object shapes in either `selection_detail_facts.js` or `property_panel_info_rows.js`.

## Intended Structure

Create a dedicated helper module under:

- `tools/web_viewer/ui/selection_display_helpers.js`

It should export only the shared string-formatting helpers. Keep any row-shape-specific helpers such as `pushFact(...)` or `pushInfo(...)` local to their respective files.

Then update:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/property_panel_info_rows.js`

to import from the new shared helper module instead of defining duplicate local helpers.

## Constraints

- Preserve exact behavior for existing tests and editor integration assertions.
- Avoid introducing any new dependency cycle.
- Keep the new helper module as a leaf module with minimal dependencies.
- Prefer the existing behavior already shared by both call sites rather than inventing a new abstraction.

## Acceptance

Step349 is complete when:

1. duplicated display helper logic is removed from both target files
2. both files use the new shared helper module
3. all focused tests and `editor_commands.test.js` still pass
4. `git diff --check` is clean
