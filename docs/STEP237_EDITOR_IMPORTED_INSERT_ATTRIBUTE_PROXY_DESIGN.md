# Step237: Editor Imported INSERT Attribute Proxy Design

## Goal

Bridge real imported `ATTRIB / ATTDEF` text into the existing narrow `INSERT` text-proxy editing contract, so inserted attribute text can be corrected in place without detaching the instance or inventing unsupported attribute schema.

## Why This Slice

- Step236 already proved the editor-side `INSERT / text / proxy` workflow is safe when the provenance is explicit.
- The remaining gap was not the property panel. It was that real DXF importer output did not yet reach that contract.
- The safest next step is importer-authoritative metadata plus adapter promotion:
  - real imported `ATTRIB` attached to `INSERT`
  - real imported `ATTDEF` emitted through inserted block explosion
  - both promoted to the same value-only `INSERT` text proxy behavior

## Contract

Real imported text is now promoted to the direct-edit `INSERT` text proxy contract only when all of these facts are present:

- entity type is `TEXT`
- `source_type = INSERT`
- `edit_mode = exploded`
- `proxy_kind = insert`
- `block_name` is non-empty
- `text_kind` is `attrib` or `attdef`

When that contract matches, the editor promotes the text to:

- `sourceType = INSERT`
- `editMode = proxy`
- `proxyKind = text`
- preserved `groupId`
- preserved `blockName`
- preserved `textKind = attrib / attdef`

The promoted proxy allows:

- property-panel `value` edits
- `selection.propertyPatch` with `{ value }`
- existing insert-group selection/actions

It still rejects:

- `position`
- `height`
- `rotation`
- any mixed geometry patch

## Importer Scope

This slice adds one narrow importer behavior:

- attached top-level `ATTRIB` entities that immediately follow an `INSERT` are associated back to that `INSERT`
- the associated `ATTRIB` shares the same logical insert group as the exploded insert geometry

`ATTDEF` does not need a special parser path here because inserted block text already inherits insert provenance through block explosion.

## UI Semantics

For real imported inserted `ATTRIB / ATTDEF` text:

- quicklook shows `Origin = INSERT / text / proxy`
- property metadata keeps `Text Kind = attrib / attdef`
- read-only note explicitly says text value remains editable while instance geometry stays proxy-only
- `Select Insert Group` stays available
- full-group workflows remain instance-level until release

So the user gets a real imported attribute-text correction path, but not a fake “full attribute editor”.

## Implementation Notes

- `plugins/dxf_importer_plugin.cpp`
  - adds a narrow attached-`ATTRIB` association path for `INSERT ... ATTRIB ... SEQEND`
  - reuses a shared insert-local group tag so attached `ATTRIB` and exploded insert geometry stay in one logical group
- `tests/plugin_data/step237_insert_attributes_sample.dxf`
  - adds a minimal real DXF sample covering both inserted `ATTDEF` and attached `ATTRIB`
- `tests/tools/test_dxf_insert_attributes.cpp`
  - locks importer-side provenance and grouping
- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - promotes real imported `INSERT + attrib/attdef` text into the existing `INSERT / text / proxy` contract
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks adapter import + command + export behavior
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - verifies the real browser path against importer-generated fixture output

## Out Of Scope

- attribute-specific schema such as `tag / prompt / constant / invisible`
- editing attribute text geometry in place
- special command surfaces beyond the existing property-panel value edit
- suppressing or reinterpreting arbitrary block-local `TEXT`
- full attribute authoring or synchronization back to DXF attribute-definition semantics
