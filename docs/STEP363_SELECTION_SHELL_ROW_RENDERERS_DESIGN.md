# Step363: Selection Shell Row Renderers Extraction

## Goal

Extract the shared badge-row and fact-list DOM renderers from:

- `tools/web_viewer/ui/property_panel_selection_shell_renderers.js`

The purpose is to isolate the reusable selection shell row rendering logic without changing shell wording, DOM shape, datasets, class names, or swatch behavior.

## Scope

In scope:

- Extract:
  - badge row rendering
  - fact list rendering
- Keep the extracted helper leaf-level and cycle-safe.

Out of scope:

- single-selection hero rendering
- empty shell wording
- multiple-selection wording
- single vs multiple shell dispatch behavior
- selection presentation behavior

## Constraints

- Keep `appendEmptySelectionShell(...)` behavior unchanged.
- Keep `appendMultipleSelectionShell(...)` behavior unchanged.
- Keep `appendSingleSelectionShell(...)` behavior unchanged.
- Preserve exact class names, dataset keys, swatch behavior, and DOM append order.
- Do not change `describeSelectionOrigin(...)` behavior.
- Only extract the shared badge/fact row renderers into a dedicated helper module.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_selection_row_renderers.js`

Expected responsibility split:

- helper: render badge row and fact list fragments
- `property_panel_selection_shell_renderers.js`: empty shell, multiple shell, hero shell, and orchestration

## Acceptance

Accept Step363 only if:

- `property_panel_selection_shell_renderers.js` no longer hand-builds badge/fact row fragments
- output remains DOM-for-DOM compatible
- focused tests cover badge tone classes, fact swatches, empty/null guard behavior, and shell integration
- existing property panel selection shell tests stay green
- `git diff --check` stays clean
