# Step344 Property Panel Note Helpers Extraction Design

## Goal

Extract the property-panel note builders from `tools/web_viewer/ui/selection_presenter.js`
into a dedicated helper module while keeping all public behavior stable.

Target functions:

- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelReleasedArchiveNote(...)`
- `buildPropertyPanelLockedLayerNote(...)`

Suggested new module:

- `tools/web_viewer/ui/property_panel_note_helpers.js`

## Why This Seam

After Step343, `selection_presenter.js` still carries a dense property-panel note cluster:

- read-only note wording
- released-archive note wording
- locked-layer note wording

These helpers are used by `buildPropertyPanelNotePlan(...)`, but they are logically separate
from selection summary / badges / detail facts / action context assembly.

This is the narrowest next seam that:

- shrinks `selection_presenter.js`
- keeps `buildPropertyPanelNotePlan(...)` unchanged
- avoids mixing note-plan orchestration with presentation extraction

## Required Scope

Move only the three note builders into the new helper module.

`selection_presenter.js` must continue to re-export them so the public surface remains stable.

`buildPropertyPanelNotePlan(...)` must keep the same call shape and behavior.

## Allowed Private Helper Movement

If needed to avoid importing back through `selection_presenter.js`, the new module may define
or own only the minimal private helpers required by the moved note builders, for example:

- layer lookup / layer label formatting helpers
- note-only text normalization helpers
- note-only insert text position editability helper logic

These private helpers must not broaden the scope into note-plan or presentation refactors.

## Explicit Non-Goals

Do not change:

- `buildPropertyPanelNotePlan(...)`
- `buildSelectionPresentation(...)`
- `buildSelectionActionContext(...)`
- `buildPropertyMetadataFacts(...)`
- `buildSelectionContract(...)`
- `buildSelectionDetailFacts(...)`
- badge / overview / property fact ordering

Do not change:

- note wording
- read-only semantics
- locked-layer semantics
- released-archive semantics
- direct insert/source text edit allowances inferred by note-plan

## Dependency Rules

The new module must not import `selection_presenter.js`.

Preferred dependency direction:

- `property_panel_note_helpers.js` imports from leaf/shared modules such as:
  - `insert_group.js`
  - `selection_meta_helpers.js`
  - `selection_released_archive_helpers.js`
  - any minimal local private helpers placed directly in the new module
- `selection_presenter.js` imports/re-exports from `property_panel_note_helpers.js`

No new cycle back into `selection_presenter.js` is allowed.

## Testing Expectations

Add a focused test file for the new helper module, covering:

- single read-only INSERT ATTDEF text proxy wording
- full source-group read-only wording
- released archive ATTDEF wording
- locked single-entity wording

Keep existing `editor_commands.test.js` assertions unchanged as the integration guard.

## Done Criteria

Step344 is done when:

1. the three note helpers live in a dedicated module
2. `selection_presenter.js` only imports/re-exports them
3. no new dependency cycle exists
4. focused tests pass
5. `editor_commands.test.js` still passes unchanged
