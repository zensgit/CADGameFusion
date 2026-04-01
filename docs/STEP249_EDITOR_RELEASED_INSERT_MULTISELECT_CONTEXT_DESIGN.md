# Step249: Editor Released Insert Multi-Select Context Design

## Goal

Expose common archived insert context for detached multi-select released text, so the user can inspect what family the selection came from before jumping back into surviving peer instances.

This extends the Step248 released peer workflow:

- released text stays plain editable text
- archived peer navigation still comes from `releasedInsertArchive`
- multi-select quicklook/property no longer collapse to an empty state when every member shares the same archived insert identity

## Why This Slice

Step248 made released `DoorNotes` text scope survive peer navigation, but the UI still had an explainability gap:

- property metadata could show the common archived context
- quicklook stayed empty for the same multi-select
- the browser smoke had actions, but not a stable multi-select provenance contract

That left detached released text operationally correct but visually weaker than the imported live insert path. Step249 closes that gap by making shared archived context first-class for multi-select released text.

## Contract

### 1. Only common released insert context is surfaced

The shared multi-select contract appears only when all selected entities resolve to the same released insert archive family:

- `sourceType = INSERT`
- common archived `groupId`
- common archived `blockName`

If that common identity is missing, the UI keeps the existing generic multi-select behavior and does not invent archive facts.

### 2. Quicklook and property panel match

When the selection has a common released insert archive, both quicklook and property metadata surface the same shared facts:

- `released-from`
- `released-group-id`
- `released-block-name`
- `released-selection-members`
- `released-peer-instance`
- `released-peer-instances`
- `released-peer-layouts`
- `released-peer-targets`

Attribute- or text-specific archive facts are only surfaced when they are truly common across the released selection.

### 3. Multi-select remains detached plain text

The new context is descriptive only. It does not restore live insert semantics.

- released members remain plain text
- no `sourceType / editMode / proxyKind` are reactivated on the detached entities
- peer actions still intentionally jump from archived text into surviving live peer context only when the user invokes them

### 4. Peer facts stay archive-driven

Peer summaries still come from the archived released family, not from the current detached geometry.

For the `DoorNotes` smoke path:

- released `[21,22]` reports `released-peer-instance = 1 / 3`
- peer targets remain `Layout-A | Layout-B | Layout-C`
- the same released selection can still route to live peer text `[27,28]` or `[24,25]`

This keeps UI explanation aligned with the Step248 navigation contract.

## Key Files

- `tools/web_viewer/ui/selection_presenter.js`
  - summarizes common released insert archive context for multi-select
  - emits shared quicklook detail facts and compact summary rows

- `tools/web_viewer/ui/property_panel.js`
  - renders the same shared released context in multi-select property metadata
  - stops treating released multi-select as an empty provenance state

- `tools/web_viewer/scripts/editor_insert_group_smoke.js`
  - asserts the real browser quicklook/property contract for released `DoorNotes` multi-select before peer navigation

- `tools/web_viewer/tests/editor_commands.test.js`
  - locks the selection-presentation contract for common released insert multi-select context

## Out Of Scope

Step249 does not add:

- new released edit actions
- new export fields
- revived live insert semantics on detached text
- synthetic archive facts for heterogeneous selections

## Acceptance

Step249 is complete when:

- released multi-select `INSERT` text shows shared archived context in quicklook
- the property panel shows the same shared facts
- peer-instance and peer-target facts remain archive-driven
- the released entities remain detached plain text
- the real browser smoke proves the contract on the released `DoorNotes` path
