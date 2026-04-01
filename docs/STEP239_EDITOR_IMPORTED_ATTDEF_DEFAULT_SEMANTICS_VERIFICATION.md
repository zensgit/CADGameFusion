# Step239: Editor Imported ATTDEF Default Semantics Verification

## Commands

From `deps/cadgamefusion`:

```bash
cmake -S . -B build
cmake --build build --target test_dxf_insert_attributes cadgf_dxf_importer_plugin convert_cli -j4
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
cd build && ctest --output-on-failure -R test_dxf_insert_attributes_run
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- real imported attached `ATTRIB` still promotes to `INSERT / text / proxy`
- real imported inserted `ATTDEF` still promotes to `INSERT / text / proxy`
- Step237 value-only editing still applies unchanged
- `attribute_tag`, `attribute_default`, `attribute_prompt`, and `attribute_flags` appear in the selection/property UI as read-only metadata
- `attribute_default` is the semantic value behind the ATTDEF value field
- `attribute_prompt` stays read-only metadata and does not collapse into the editable value
- `attribute_flags` decode into read-only mode labels `invisible / constant / verify / preset / lock-position`
- property edits continue to allow only `value`
- geometry edits such as `position`, `height`, and `rotation` remain rejected
- export preserves the authoritative metadata so the proxy does not lose ATTDEF schema on round-trip
- legacy ATTDEF payloads that only carry mixed `text.value = default + "\n" + prompt` are upgraded to the same split contract on import/restore

## Browser Smoke Assertions

- imported `ATTDEF` selection details show separate `attribute-default` and `attribute-prompt` facts
- imported `ATTDEF` property metadata shows separate `attribute-default` and `attribute-prompt` fields
- the `value` input is present and represents default text semantics
- editing the `value` input updates the ATTDEF default text without changing prompt metadata
- the browser smoke keeps `INSERT` provenance intact while the split remains visible

## Test Coverage

- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js` covers the browser-visible split
- `tools/web_viewer/tests/editor_commands.test.js` covers import, restore, property patch, and export round-trip behavior for separate ATTDEF default and prompt metadata
- the restore path is explicitly covered so older cached editor snapshots do not regress back to mixed default/prompt strings

## Notes

This slice stays narrower than a full attribute editor:

- it confirms importer-authoritative ATTDEF metadata survives into the editor
- it preserves the Step237 edit boundary
- it does not add attribute-authorship or schema editing behavior
