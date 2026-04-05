# Step364: Selection Shell Hero Extraction

## Goal

Extract the single-selection hero DOM builder from:

- `tools/web_viewer/ui/property_panel_selection_shell_renderers.js`

The purpose is to isolate the single-selection hero fragment without changing shell wording, DOM shape, datasets, swatch fallback behavior, or hero append order.

## Scope

In scope:

- Extract the single-selection hero renderer:
  - swatch block
  - title block
  - origin caption block

Out of scope:

- badge row rendering
- fact list rendering
- empty shell wording
- multiple-selection wording
- single vs multiple shell dispatch behavior
- selection presentation behavior

## Constraints

- Keep `appendSingleSelectionShell(...)` behavior unchanged.
- Keep `appendEmptySelectionShell(...)` behavior unchanged.
- Keep `appendMultipleSelectionShell(...)` behavior unchanged.
- Preserve exact class names, dataset keys, swatch fallback behavior, and DOM append order.
- Do not change `describeSelectionOrigin(...)` behavior.
- Only extract the single-selection hero renderer into a dedicated helper module.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_selection_hero_renderer.js`

Expected responsibility split:

- helper: build/append the single-selection hero fragment
- `property_panel_selection_shell_renderers.js`: empty shell, multiple shell, and high-level single-shell composition

## Acceptance

Accept Step364 only if:

- `property_panel_selection_shell_renderers.js` no longer hand-builds the single-selection hero
- output remains DOM-for-DOM compatible
- focused tests cover swatch fallback, title rendering, origin caption rendering, and no-caption behavior
- existing property panel selection shell tests stay green
- `git diff --check` stays clean
