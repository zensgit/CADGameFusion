# Step238: Editor Imported INSERT Attribute Metadata Design

## Goal

Surface authoritative imported attribute metadata for real `ATTRIB / ATTDEF` insert text proxies without widening the Step237 editing contract.

## Why This Slice

- Step237 already established the narrow imported `INSERT / text / proxy` value-only edit path.
- The remaining gap is metadata fidelity: importer, export, and editor should carry the real attribute schema fields instead of collapsing them into a plain text proxy.
- The safe contract is read-only surfacing of authoritative metadata, not attribute-authoring behavior.

## Contract

Real imported inserted `ATTRIB / ATTDEF` text keeps the Step237 value-only edit contract unchanged:

- `value` remains editable
- `position`, `height`, and `rotation` remain read-only
- mixed geometry patches remain unsupported
- insert-group selection and release workflows remain unchanged

In addition, the importer/export/editor now surface these authoritative fields on the imported text proxy:

- `attribute_tag`
- `attribute_prompt`
- `attribute_flags`

The UI decodes `attribute_flags` into read-only mode indicators:

- `invisible`
- `constant`
- `verify`
- `preset`
- `lock-position`

These mode indicators are derived from flags only. They do not introduce new edit affordances or alter the import provenance contract.

Bit mapping stays explicit and importer-authored:

- bit `1` -> `invisible`
- bit `2` -> `constant`
- bit `4` -> `verify`
- bit `8` -> `preset`
- bit `16` -> `lock-position`

## Importer Scope

This slice is intentionally narrow:

- real imported `ATTRIB` attached to `INSERT` carries authoritative tag/prompt/flags metadata through the importer
- real imported `ATTDEF` emitted through inserted block explosion carries the same metadata through the importer/export path
- adapter promotion preserves the metadata on the imported `INSERT / text / proxy` representation

The importer should not invent schema for blocks that do not actually provide attribute metadata.

## UI Semantics

For real imported inserted `ATTRIB / ATTDEF` text:

- selection/property UI surfaces `attribute_tag`, `attribute_prompt`, and `attribute_flags` read-only
- flags are shown as read-only derived modes, not editable toggles
- the proxy still presents as a text correction target, not as a full attribute editor
- Step237 value-only editing remains the only direct mutation path

That keeps the proxy honest: the user can inspect what the importer knew, but only the text value is editable in place.

## Implementation Notes

- `plugins/dxf_importer_plugin.cpp`
  - parses authoritative DXF attribute schema fields during import for attached `ATTRIB` and exploded `ATTDEF`
  - writes `attribute_tag / attribute_prompt / attribute_flags` plus decoded boolean mode metadata into CADGF entity metadata
- `tools/convert_cli.cpp`
  - emits the authoritative attribute fields into preview `document.json` so editor fixtures and browser runs see the same contract as importer tests
- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - promotes the imported metadata onto the editor-side `INSERT / text / proxy` contract
  - preserves both raw flags and decoded booleans across import/export
- `tools/web_viewer/state/documentState.js`
  - keeps the attribute metadata alive through `document.restore`, instead of dropping it during editor snapshot normalization
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks the command/property/export contract for imported attribute metadata
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - verifies the browser-visible metadata surface for real imported `ATTRIB / ATTDEF`

## Out Of Scope

- editing `attribute_tag`
- editing `attribute_prompt`
- editing `attribute_flags`
- creating new attribute definitions in the editor
- synchronizing attribute schema changes back into the DXF authoring pipeline
- changing the Step237 value-only insert text proxy contract
