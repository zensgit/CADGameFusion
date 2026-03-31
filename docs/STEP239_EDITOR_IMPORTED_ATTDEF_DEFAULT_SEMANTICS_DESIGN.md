# Step239: Editor Imported ATTDEF Default Semantics Design

## Goal

Separate imported `ATTDEF` default text from prompt metadata while keeping the Step237/238 insert-text proxy contract narrow.

## Why This Slice

- Step237 established the narrow imported `INSERT / text / proxy` value-only edit path.
- Step238 surfaced authoritative attribute metadata, but imported `ATTDEF` still needed a real split between default text and prompt.
- The safe contract is read-only prompt metadata and editable default text only through the existing `value` field.

## Contract

Real imported inserted `ATTDEF` text keeps the Step237/238 value-only edit contract unchanged:

- `value` remains the only editable field
- `position`, `height`, and `rotation` remain read-only
- mixed geometry patches remain unsupported
- insert-group selection and release workflows remain unchanged

In addition, the importer/export/editor surface these authoritative fields on the imported `ATTDEF` proxy:

- `attribute_tag`
- `attribute_default`
- `attribute_prompt`
- `attribute_flags`

Semantics stay separated:

- `attribute_default` is the authoritative imported ATTDEF default text
- `attribute_prompt` is authoritative read-only metadata
- the editor `value` field semantically edits the ATTDEF default text
- `attribute_prompt` does not get conflated into the displayed or editable value
- `attribute_flags` stay read-only mode metadata
- legacy payloads that still encode `default + "\n" + prompt` in `text.value` are upgraded on import/restore into the same split contract

Real imported attached `ATTRIB` text keeps the same narrow value-only proxy contract, but the default/prompt split is only meaningful for imported `ATTDEF`.

## Importer Scope

This slice is intentionally narrow:

- real imported `ATTRIB` attached to `INSERT` keeps the existing value-only proxy contract
- real imported `ATTDEF` emitted through inserted block explosion carries authoritative tag/default/prompt/flags metadata
- adapter promotion preserves `attribute_default` and `attribute_prompt` separately on the imported `INSERT / text / proxy` representation
- legacy cached payloads that omit `attribute_default` are backfilled from `text.value` plus `attribute_prompt` before the proxy reaches editor state
- exporter round-trips both fields without recombining them into a single value

The importer should not invent schema for blocks that do not actually provide ATTDEF metadata.

## UI Semantics

For real imported inserted `ATTDEF` text:

- selection/property UI surfaces `attribute_tag`, `attribute_default`, `attribute_prompt`, and `attribute_flags` read-only
- the `value` field remains the only direct mutation path and edits ATTDEF default text semantics
- prompt remains metadata only, not an editor target
- flags are still shown as read-only derived modes, not editable toggles
- the proxy still presents as a text correction target, not as a full attribute editor

That keeps the proxy honest: the user can inspect what the importer knew, but only the default text semantics are editable in place.

## Implementation Notes

- `plugins/dxf_importer_plugin.cpp`
  - parses authoritative DXF ATTDEF fields during import
  - writes `attribute_tag / attribute_default / attribute_prompt / attribute_flags` plus decoded boolean mode metadata into CADGF entity metadata
- `tools/convert_cli.cpp`
  - emits the authoritative ATTDEF fields into preview `document.json` so editor fixtures and browser runs see the same contract as importer tests
- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - promotes the imported metadata onto the editor-side `INSERT / text / proxy` contract
  - preserves both default text and prompt across import/export
- `tools/web_viewer/state/documentState.js`
  - keeps the ATTDEF metadata alive through `document.restore`, instead of dropping it during editor snapshot normalization
- `tools/web_viewer/ui/property_panel.js`
  - keeps the ATTDEF value field aligned with default text semantics while prompt remains read-only metadata
- `tools/web_viewer/ui/selection_presenter.js`
  - surfaces default text and prompt as separate facts
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - verifies the browser-visible split for real imported `ATTDEF`
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks the command/property/export contract for imported ATTDEF default semantics

## Out Of Scope

- editing `attribute_tag`
- editing `attribute_prompt`
- editing `attribute_flags`
- creating new attribute definitions in the editor
- synchronizing ATTDEF schema changes back into the DXF authoring pipeline
- changing the Step237 value-only insert text proxy contract
