# Step246: Editor Released Insert Context Relink Design

## Goal

Keep released imported insert text on plain-text editing semantics while letting archived provenance jump back to the surviving imported insert group, including view fit, when that source group still exists.

## Why This Slice

- Step244 removed the live imported-attribute contract from released insert text.
- Step245 preserved the release history as read-only editor context.
- The remaining gap is navigation, not editability:
  - a released text entity can still tell us where it came from
  - but the archive cannot yet drive the user back to the live imported insert group
  - without the archived `groupId`, that jump is not deterministic

This step closes that loop while keeping the released entity itself plain text.

## Contract

When imported insert text is released through:

- `selection.insertEditText`
- `selection.insertReleaseGroup`

the resulting text entity follows two rules at once.

### 1. Live released text stays plain

Released text continues to clear the active imported insert contract:

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

So the released entity still edits like native text and does not regain insert-group behavior.

### 2. Archived provenance keeps a relink key

`releasedInsertArchive` remains the editor-only provenance object, and it now preserves the original imported insert group identity as:

- `groupId`

This archive still carries the rest of the release history:

- original import context:
  - `sourceType`
  - `editMode`
  - `proxyKind`
- original insert context:
  - `blockName`
  - `textKind`
- original attribute facts when present:
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

Selection and property UI should expose archived release context as read-only facts, not as live insert semantics.

For a released insert text whose archive still resolves to a live imported insert group:

- show the archived original group id
- expose a read-only `Relink Insert Group` action
- expose a matching `Fit Insert Group` action for the relink target

Those actions do not convert the released text back into imported proxy mode. They only navigate to the surviving imported insert group referenced by the archive.

If the archived `groupId` no longer resolves to a surviving imported insert group:

- the entity remains plain text
- the archive still remains visible as read-only context
- relink/fit actions are absent or disabled

## State And Export Boundary

`releasedInsertArchive` remains editor-state metadata, not CADGF document contract.

- editor state normalization preserves it
- property/selection UI can consume it
- later plain-text edits do not strip it
- CADGF export does not write it back out

The archived `groupId` follows the same boundary:

- it is preserved for editor-side relink only
- it is not a document-export field
- exporting a released entity must not serialize archive-only relink state

That keeps release behavior stable while avoiding accidental reactivation of imported insert semantics in CADGF output.

## Implementation Notes

- `tools/web_viewer/commands/command_registry.js`
  - `buildReleasedInsertEntity()` captures the original live `groupId` into `releasedInsertArchive.groupId`
  - relink/focus helpers resolve the surviving imported insert group by archived id only

- `tools/web_viewer/state/documentState.js`
  - `normalizeEntityMetadata()` preserves `releasedInsertArchive.groupId`

- `tools/web_viewer/ui/selection_presenter.js`
  - adds released-group formatting helpers
  - exposes archived relink context in single-select details

- `tools/web_viewer/ui/property_panel.js`
  - surfaces matching read-only released provenance rows
  - adds contextual relink and fit actions when the archived group still exists

- `tools/web_viewer/ui/workspace.js`
  - routes the relink/fit commands to the surviving imported insert group
  - reuses the existing insert-group bounds contract for camera fit

- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - continues to omit archive-only state from CADGF export

## Out Of Scope

- reviving released text as a live imported insert proxy
- editing the original imported group from the released text entity
- persisting archive-only relink metadata in CADGF
- changing release semantics for non-`INSERT` source bundles
