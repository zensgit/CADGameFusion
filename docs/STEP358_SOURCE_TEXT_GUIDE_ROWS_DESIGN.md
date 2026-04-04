# Step358: Source Text Guide Rows Extraction

## Goal

Extract the source-text and leader-guide detail-fact assembly from:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to isolate the last source-text guide row block into a dedicated helper without changing any fact keys, values, or ordering.

## Scope

In scope:

- Extract source text position row assembly.
- Extract source text rotation row assembly.
- Extract source anchor / leader guide / source offset row assembly.
- Keep the extracted helper leaf-level and cycle-safe.

Out of scope:

- origin/layer/style fact rows
- source/insert group rows
- released archive metadata rows
- released peer rows
- selection presentation contract changes

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Preserve exact keys, labels, values, and row ordering for:
  - `source-text-pos`
  - `source-text-rotation`
  - `source-anchor`
  - `leader-landing`
  - `leader-elbow`
  - `leader-landing-length`
  - `source-anchor-driver`
  - `source-offset`
  - `current-offset`
- Do not change `resolveSourceTextGuide(...)` behavior.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/source_text_guide_rows.js`

Expected responsibility split:

- helper: append source-text and leader-guide rows
- `selection_detail_facts.js`: decide when guide rows should be included

## Acceptance

Accept Step358 only if:

- `selection_detail_facts.js` no longer hand-builds source-text guide rows
- output remains fact-for-fact compatible
- focused tests cover the extracted guide row paths
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
