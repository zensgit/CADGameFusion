# Step338 Selection Overview Extraction Design

## Goal

Extract selection summary and status formatting from `selection_presenter.js` into a dedicated helper module, without changing output text, fallback rules, or any selection presentation contract.

## Why This Step

After Step337:

- badge assembly already lives behind its own helper seam
- `property_panel_selection_context.js` is already thin
- `property_panel_render.js` is already thin

The next stable presenter seam is the compact textual overview layer:

- `formatSelectionSummary(...)`
- `formatSelectionStatus(...)`

These functions are semantically separate from:

- badge assembly
- detail fact assembly
- property metadata augmentation

They are also consumed by higher-level presentation builders, so extracting them reduces the remaining responsibility of `selection_presenter.js` without reopening the heavy `detailFacts` path.

## Problem

`selection_presenter.js` still directly owns two kinds of top-level presentation text:

- human-readable selection summary
- compact selection status line

That keeps the presenter file responsible for one more standalone subdomain than necessary, even though the behavior is already stable and independently testable.

## Design

Introduce a dedicated helper module:

- `tools/web_viewer/ui/selection_overview.js`

Move these functions there:

- `formatSelectionSummary(...)`
- `formatSelectionStatus(...)`

`selection_presenter.js` should then:

1. import these helpers
2. keep exporting them from the same public surface
3. keep `buildSelectionContract(...)` and `buildSelectionPresentation(...)` behavior unchanged

The extracted module may depend on existing presenter exports/helpers where needed, but it must not take ownership of:

- badges
- detail facts
- property notes
- property metadata facts

## Boundaries

This step must not change:

- `formatSelectionSummary(...)` output
- `formatSelectionStatus(...)` output
- `buildSelectionPresentation(...)` public contract
- `buildSelectionContract(...)` public contract
- `buildSelectionBadges(...)`
- `buildSelectionDetailFacts(...)`
- any property panel selection/render behavior

This step should remain a pure extraction. No wording changes, no new states, no fallback rewrites.

## Test Plan

Add:

- `tools/web_viewer/tests/selection_overview.test.js`

Cover at least:

- empty summary
- empty status
- single-selection status with provenance detail
- multi-selection status with read-only count
- primary fallback behavior
- summary type listing behavior

Keep existing integration assertions in `editor_commands.test.js` unchanged.

## Expected Outcome

- `selection_presenter.js` gets thinner at another real semantic seam
- summary/status behavior becomes unit-testable in isolation
- the remaining presenter mass is more clearly concentrated in detail-fact assembly and property-note logic
