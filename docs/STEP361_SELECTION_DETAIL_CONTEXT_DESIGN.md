# Step361: Selection Detail Context Extraction

## Goal

Extract the remaining detail-context resolution from:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to isolate the non-rendering preparation work that resolves layer/style context, entity lists, group summaries, released peer summaries, and source-text guide data before rows are appended.

## Scope

In scope:

- Extract context resolution for:
  - `getLayer`
  - `listEntities`
  - `layer`
  - `effectiveStyle`
  - `effectiveColor`
  - `styleSources`
  - `entities`
  - `sourceGroupSummary`
  - `insertGroupSummary`
  - `insertPeerSummary`
  - `releasedInsertPeerSummary`
  - `sourceTextGuide`
  - `releasedInsertArchive`
- Keep the extracted helper leaf-level and cycle-safe.

Out of scope:

- base fact rows
- released archive row helpers
- group row helpers
- peer summary row helpers
- line-style row helpers
- source-text guide row helpers
- multi-selection released archive rows
- overall row append order

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Keep `buildMultiSelectionDetailFacts(...)` behavior unchanged.
- Preserve current selection summary semantics, peer summary semantics, and source-text guide resolution behavior.
- Do not change row keys, labels, values, swatches, or ordering.
- Do not change `resolveReleasedInsertArchive(...)`, `resolveSourceTextGuide(...)`, or the summary helpers.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/selection_detail_context.js`

Expected responsibility split:

- helper: resolve the single-selection detail context object
- `selection_detail_facts.js`: append rows using the resolved context plus existing row helpers

## Acceptance

Accept Step361 only if:

- `selection_detail_facts.js` no longer hand-builds the detail context object
- output remains fact-for-fact compatible
- focused tests cover plain entities, source groups, insert groups, released inserts, and listEntities/getLayer fallbacks
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
