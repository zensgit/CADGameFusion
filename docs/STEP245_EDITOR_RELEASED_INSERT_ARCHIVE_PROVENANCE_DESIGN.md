# Step245: Editor Released Insert Archive Provenance Design

## Goal

Keep released imported insert text on plain-text editing semantics while preserving the original imported attribute provenance as read-only editor context.

## Why This Slice

- Step244 fixed the most important product boundary: released insert text stopped behaving like live imported attribute data.
- That fix intentionally cleared active `attribute_*`, `textKind`, and imported insert proxy fields.
- The remaining gap was usability, not editability:
  - after release, the text behaved correctly
  - but the user lost all trace of where that text came from
  - property/selection UI could no longer explain whether the detached text originated from an `ATTRIB`, `ATTDEF`, or generic insert text proxy

The right boundary is:

- live imported attribute semantics must stay cleared
- archived provenance may remain visible, but only as read-only editor metadata

## Contract

When imported insert text is released through:

- `selection.insertEditText`
- `selection.insertReleaseGroup`

the resulting text entity now follows two rules at once.

### 1. Live contract is cleared

Released text still clears active imported-insert fields:

- `sourceType`
- `editMode`
- `proxyKind`
- `groupId`
- `blockName`
- `textKind`
- `attributeTag`
- `attributeDefault`
- `attributePrompt`
- `attributeFlags`
- `attributeInvisible`
- `attributeConstant`
- `attributeVerify`
- `attributePreset`
- `attributeLockPosition`
- `sourceTextPos`
- `sourceTextRotation`

So the released text continues to edit like native text.

### 2. Archived provenance is preserved in editor state

Released text now keeps a new editor-only metadata object:

- `releasedInsertArchive`

This archive is read-only context and can include:

- original imported origin:
  - `sourceType`
  - `editMode`
  - `proxyKind`
- imported insert context:
  - `blockName`
  - `textKind`
- imported attribute facts when present:
  - `attributeTag`
  - `attributeDefault`
  - `attributePrompt`
  - `attributeFlags`
  - `attributeInvisible`
  - `attributeConstant`
  - `attributeVerify`
  - `attributePreset`
  - `attributeLockPosition`

## UI Semantics

Selection/property UI now exposes archived released-insert facts under dedicated read-only keys instead of reviving the live imported contract:

- `Released From`
- `Released Block Name`
- `Released Text Kind`
- `Released Attribute Tag`
- `Released Attribute Default`
- `Released Attribute Prompt`
- `Released Attribute Flags`
- `Released Attribute Modes`

This intentionally does not re-use the active imported keys:

- no live `attribute-tag`
- no live `text-kind`
- no live imported proxy edit rules

The user sees provenance, but the entity still behaves like plain text.

## State And Export Boundary

`releasedInsertArchive` is editor-state metadata, not CADGF document contract.

- editor state normalization preserves it
- property/selection UI can consume it
- later plain-text edits do not strip it
- CADGF export does not write it back out

That keeps release behavior stable while avoiding schema drift or accidental reactivation of imported attribute semantics.

## Implementation Notes

- `tools/web_viewer/commands/command_registry.js`
  - `buildReleasedInsertEntity()` now creates `releasedInsertArchive` before clearing live imported fields
- `tools/web_viewer/state/documentState.js`
  - `normalizeEntityMetadata()` now preserves `releasedInsertArchive` / `released_insert_archive`
- `tools/web_viewer/ui/selection_presenter.js`
  - adds released-archive formatting helpers
  - exposes released provenance in single-select details
- `tools/web_viewer/ui/property_panel.js`
  - surfaces matching read-only released provenance rows
  - adds a plain-language note explaining that archived provenance remains visible while the entity edits like plain text
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - locks the browser contract for both released `ATTDEF` and released hidden-constant attribute paths

## Out Of Scope

- exporting `releasedInsertArchive` to CADGF
- reviving released text as live imported attribute data
- changing release semantics for non-`INSERT` source bundles
- new attribute authoring flows
