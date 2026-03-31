# Step238: Editor Imported INSERT Attribute Metadata Verification

## Commands

From `deps/cadgamefusion`:

```bash
cmake -S . -B build
cmake --build build --target test_dxf_insert_attributes cadgf_dxf_importer_plugin convert_cli -j4
./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input ./tests/plugin_data/step237_insert_attributes_sample.dxf --out ./build/step238_insert_attributes_preview_a
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
cd build && ctest --output-on-failure -R test_dxf_insert_attributes_run
cd ..
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- real imported attached `ATTRIB` and inserted `ATTDEF` still promote to `INSERT / text / proxy`
- Step237 value-only editing still applies unchanged
- `attribute_tag`, `attribute_prompt`, and `attribute_flags` appear in the selection/property UI as read-only metadata
- `attribute_flags` decode into read-only mode labels `invisible / constant / verify / preset / lock-position`
- property edits continue to allow only `value`
- geometry edits such as `position`, `height`, and `rotation` remain rejected
- export preserves the authoritative metadata so the proxy does not lose attribute schema on round-trip

## Verification Notes

- `cmake -S . -B build`: PASS
- `cmake --build build --target test_dxf_insert_attributes cadgf_dxf_importer_plugin convert_cli -j4`: PASS
- `./build/tools/convert_cli ... step237_insert_attributes_sample.dxf ...`: PASS
- `node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js`: PASS
- `node --check tools/web_viewer/adapters/cadgf_document_adapter.js`: PASS
- `node --check tools/web_viewer/state/documentState.js`: PASS
- `node --check tools/web_viewer/ui/property_panel.js`: PASS
- `node --check tools/web_viewer/ui/selection_presenter.js`: PASS
- `node --check tools/web_viewer/tests/editor_commands.test.js`: PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`273/273`)
- `ctest --output-on-failure -R test_dxf_insert_attributes_run`: PASS
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`: PASS
- `git diff --check`: PASS

## Importer Artifact

The real preview artifact is written to:

- [step238_insert_attributes_preview_a document.json](../build/step238_insert_attributes_preview_a/document.json)

Key facts confirmed in that artifact:

- entity `1` is imported attached `ATTRIB`
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `text_kind = attrib`
  - `attribute_tag = ATTRIB_TAG`
  - `attribute_flags = 16`
  - `attribute_lock_position = true`
- entity `3` is imported inserted `ATTDEF`
  - `source_type = INSERT`
  - `edit_mode = exploded`
  - `proxy_kind = insert`
  - `text_kind = attdef`
  - `attribute_tag = ATTDEF_TAG`
  - `attribute_prompt = ATTDEF_PROMPT`
  - `attribute_flags = 12`
  - `attribute_verify = true`
  - `attribute_preset = true`

So the authoritative attribute schema is present before the editor even loads.

## Command-Layer Results

The updated unit coverage confirms:

- imported `ATTRIB / ATTDEF` still promote to `INSERT / text / proxy`
- Step237 value-only patching still works unchanged
- imported `attributeTag / attributePrompt / attributeFlags` survive adapter import
- derived booleans `attributeInvisible / attributeConstant / attributeVerify / attributePreset / attributeLockPosition` survive adapter import
- export preserves:
  - `attribute_tag`
  - `attribute_prompt`
  - `attribute_flags`
  - `attribute_invisible`
  - `attribute_constant`
  - `attribute_verify`
  - `attribute_preset`
  - `attribute_lock_position`

## Browser Artifact

The real browser artifact is written to:

- [editor_insert_attribute_smoke summary.json](../build/editor_insert_attribute_smoke/20260325_080852/summary.json)

Key browser assertions confirmed in that artifact:

- `before_attrib_edit.details.items["origin"] == "INSERT / text / proxy"`
- `before_attrib_edit.details.items["attribute-tag"] == "ATTRIB_TAG"`
- `before_attrib_edit.details.items["attribute-flags"] == "16"`
- `before_attrib_edit.details.items["attribute-modes"] == "Lock Position"`
- `before_attrib_edit.property.meta["attribute-tag"] == "ATTRIB_TAG"`
- `before_attrib_edit.property.meta["attribute-flags"] == "16"`
- `before_attrib_edit.property.meta["attribute-modes"] == "Lock Position"`
- `before_attdef_edit.details.items["attribute-tag"] == "ATTDEF_TAG"`
- `before_attdef_edit.details.items["attribute-prompt"] == "ATTDEF_PROMPT"`
- `before_attdef_edit.details.items["attribute-flags"] == "12"`
- `before_attdef_edit.details.items["attribute-modes"] == "Verify / Preset"`
- `before_attdef_edit.property.meta["attribute-tag"] == "ATTDEF_TAG"`
- `before_attdef_edit.property.meta["attribute-prompt"] == "ATTDEF_PROMPT"`
- `before_attdef_edit.property.meta["attribute-flags"] == "12"`
- `before_attdef_edit.property.meta["attribute-modes"] == "Verify / Preset"`
- both proxies still expose only `value` in `property.fields`
- both still keep `Select Insert Group`
- `after_attrib_edit.entity.value == "ATTRIB_PROXY_EDITED"`
- `after_attdef_edit.entity.value == "ATTDEF_PROXY_EDITED"`

## Notes

This slice is intentionally narrower than a full attribute editor:

- it confirms importer-authoritative metadata survives into the editor
- it preserves the Step237 edit boundary
- it does not add attribute-authorship or schema editing behavior
