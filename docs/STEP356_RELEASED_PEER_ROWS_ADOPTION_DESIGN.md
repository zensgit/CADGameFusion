# Step356: Released Peer Rows Adoption

## Goal

Adopt the existing shared peer-summary helper in the last remaining single-selection released-peer path inside:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to remove the remaining hand-written `released-peer-*` row assembly and route it through `peer_summary_rows.js`, matching the Step355 helper seam.

## Scope

In scope:

- Replace manual released-peer row assembly in `buildSelectionDetailFacts(...)` with `buildPeerSummaryRows(..., { released: true })`.
- Remove now-unused `formatPeerContext(...)` / `formatPeerTarget(...)` imports from `selection_detail_facts.js`.
- Add focused test coverage for single-selection released peer rows.

Out of scope:

- released archive metadata row extraction
- multi-selection released archive rows
- group info row behavior
- selection presentation contract changes

## Constraints

- Keep `buildSelectionDetailFacts(...)` behavior unchanged.
- Preserve exact released-peer keys, labels, values, and ordering.
- Preserve `Archived / N` wording when the current peer is not found.
- Do not change `buildReleasedInsertArchiveSelectionRows(...)` behavior.
- Do not introduce a new dependency cycle.

## Expected Shape

Use the existing helper:

- `tools/web_viewer/ui/peer_summary_rows.js`

Expected responsibility split:

- `peer_summary_rows.js`: build peer summary rows
- `selection_detail_facts.js`: decide when released peer rows should be appended

## Acceptance

Accept Step356 only if:

- `selection_detail_facts.js` no longer hand-builds released peer rows
- released peer output remains byte-for-byte compatible at the fact level
- focused tests cover the single-selection released peer path
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
