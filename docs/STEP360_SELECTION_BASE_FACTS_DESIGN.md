# Step360: Selection Base Facts Extraction

## Goal

Extract the remaining base single-selection fact assembly from:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to isolate the pre-released-archive, pre-group, pre-line-style, pre-guide fact block into a dedicated helper without changing any fact keys, values, ordering, or omission rules.

## Scope

In scope:

- Extract:
  - `origin`
  - `layer`
  - `layer-color`
  - `layer-state`
  - `entity-visibility`
  - `effective-color`
  - `color-source`
  - `color-aci`
  - `space`
  - `layout`
  - `group-id`
  - `group-source`
  - `source-bundle-id`
  - `block-name`
  - `text-kind`
  - `attribute-tag`
  - `attribute-default`
  - `attribute-prompt`
  - `attribute-flags`
  - `attribute-modes`
- Keep the extracted helper leaf-level and cycle-safe.

Out of scope:

- released archive rows
- group rows
- released peer rows
- line-style rows
- source-text guide rows
- multi-selection released archive rows

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Preserve exact keys, labels, values, swatches, and row ordering.
- Preserve current omission rules for optional values.
- Do not change layer resolution, effective-color resolution, or attribute-mode formatting behavior.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/selection_base_facts.js`

Expected responsibility split:

- helper: append base single-selection rows
- `selection_detail_facts.js`: orchestrate base rows plus extracted released/group/style/guide helpers

## Acceptance

Accept Step360 only if:

- `selection_detail_facts.js` no longer hand-builds the base fact block
- output remains fact-for-fact compatible
- focused tests cover ordering, swatch propagation, and omission rules
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
