# Step237: Editor Imported INSERT Attribute Proxy Verification

## Commands

From `deps/cadgamefusion`:

```bash
cmake -S . -B build
cmake --build build --target test_dxf_insert_attributes cadgf_dxf_importer_plugin convert_cli -j4
./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input ./tests/plugin_data/step237_insert_attributes_sample.dxf --out ./build/step237_insert_attributes_preview_a
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
cd build && ctest --output-on-failure -R test_dxf_insert_attributes_run
cd ..
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- real imported attached `ATTRIB` carries `source_type = INSERT`, `edit_mode = exploded`, `proxy_kind = insert`, `block_name`, and `text_kind = attrib`
- real imported inserted `ATTDEF` carries the same insert provenance with `text_kind = attdef`
- both import into the editor as `INSERT / text / proxy`
- both expose only `value` in the property panel
- both reject geometry edits while preserving insert-group workflows
- full insert-group selection still expands from the text proxy to the matching instance members

## Verification Notes

- `cmake -S . -B build`: PASS
- `cmake --build build --target test_dxf_insert_attributes cadgf_dxf_importer_plugin convert_cli -j4`: PASS
- `./build/tools/convert_cli ... step237_insert_attributes_sample.dxf ...`: PASS
- `node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js`: PASS
- `node --check tools/web_viewer/adapters/cadgf_document_adapter.js`: PASS
- `node --check tools/web_viewer/tests/editor_commands.test.js`: PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`273/273`)
- `ctest --output-on-failure -R test_dxf_insert_attributes_run`: PASS
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`: PASS
- `git diff --check`: PASS

## Importer Artifact

The real preview artifact is written to:

- [step237_insert_attributes_preview_a document.json](../build/step237_insert_attributes_preview_a/document.json)

Key facts confirmed in that artifact:

- entity `1` is imported `ATTRIB`
  - `group_id = 1`
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `block_name = AttribBlock`
  - `text_kind = attrib`
- entity `4` is the matching `AttribBlock` line
  - `group_id = 1`
- entity `3` is imported inserted `ATTDEF`
  - `group_id = 2`
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `block_name = AttdefBlock`
  - `text_kind = attdef`
- entity `2` is the matching `AttdefBlock` line
  - `group_id = 2`

So both real text cases are grouped with their insert geometry before the editor even loads.

## Command-Layer Results

The new unit coverage confirms:

- imported real-style `ATTRIB` text promotes to `sourceType = INSERT`, `editMode = proxy`, `proxyKind = text`
- imported real-style `ATTDEF` text promotes to the same editor contract
- `selection.propertyPatch` updates only `value`
- geometry patch such as `position` still returns `UNSUPPORTED_READ_ONLY`
- export preserves:
  - `source_type = INSERT`
  - `edit_mode = proxy`
  - `proxy_kind = text`
  - original `text_kind = attrib / attdef`
  - original `group_id`
  - original `block_name`

## Browser Artifact

The real browser artifact is written to:

- [editor_insert_attribute_smoke summary.json](../build/editor_insert_attribute_smoke/20260324_233325/summary.json)

Key browser assertions to confirm in that artifact:

- `before_attrib_edit.details.items["origin"] == "INSERT / text / proxy"`
- `before_attrib_edit.details.items["group-id"] == "1"`
- `before_attrib_edit.details.items["block-name"] == "AttribBlock"`
- `before_attrib_edit.property.meta["text-kind"] == "attrib"`
- `before_attrib_edit.property.fields["value"] == "ATTRIB_INSERT_OVERRIDE"`
- `before_attrib_edit.property.fields` does not include geometry keys such as `position.x` or `height`
- `after_attrib_edit.entity.value == "ATTRIB_PROXY_EDITED"`
- `after_attrib_group.selectionIds` expands to the two-member insert group
- `before_attdef_edit.details.items["origin"] == "INSERT / text / proxy"`
- `before_attdef_edit.details.items["group-id"] == "2"`
- `before_attdef_edit.details.items["block-name"] == "AttdefBlock"`
- `before_attdef_edit.property.meta["text-kind"] == "attdef"`
- `after_attdef_edit.entity.value == "ATTDEF_PROXY_EDITED"`
- `after_attdef_group.selectionIds` expands to the matching two-member insert group

## Notes

This slice intentionally stops at the real imported text-proxy bridge:

- it proves the importer and editor can now meet on real inserted `ATTRIB / ATTDEF`
- it does not claim full attribute-schema support
- later work can add attribute semantics only when importer/exporter provide real authoritative fields for them
