# Step359: Selection Line Style Rows Extraction

## Goal

Extract the line-style detail-fact assembly from:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to isolate the last line-style row block into a dedicated helper without changing any fact keys, values, ordering, or conditional omissions.

## Scope

In scope:

- Extract:
  - `line-type`
  - `line-type-source`
  - `line-weight`
  - `line-weight-source`
  - `line-type-scale`
  - `line-type-scale-source`
- Keep the extracted helper leaf-level and cycle-safe.

Out of scope:

- effective color rows
- origin/layer/space/layout rows
- group rows
- released archive rows
- source-text guide rows
- selection presentation contract changes

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Preserve exact keys, labels, values, and row ordering.
- Preserve the current `line-weight` omission rule:
  - include when `lineWeightSource === 'EXPLICIT'`
  - or when `effectiveStyle.lineWeight > 0`
- Preserve the current `line-type-scale` omission rule.
- Do not change effective-style resolution or style-source resolution.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/selection_line_style_rows.js`

Expected responsibility split:

- helper: append line-style rows from `effectiveStyle` and `styleSources`
- `selection_detail_facts.js`: decide where the style-row block appears

## Acceptance

Accept Step359 only if:

- `selection_detail_facts.js` no longer hand-builds line-style rows
- output remains fact-for-fact compatible
- focused tests cover omission and ordering rules
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
