# Step240: Editor Insert Attribute Flag Behavior Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
cd build && ctest --output-on-failure -R test_dxf_insert_attributes_run
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- imported `ATTRIB / ATTDEF` still promote to `INSERT / text / proxy`
- `attributeConstant = true` blocks direct in-place `value` edits
- `attributeInvisible = true` hides the proxy from default visible-entity queries
- hidden insert text remains reachable only through `Select Insert Text` / `instext` / `inserttext`
- hidden editable insert text still accepts value-only edits
- hidden constant insert text rejects value-only edits with `UNSUPPORTED_READ_ONLY`
- hidden insert text keeps insert-group context instead of dropping the overlay after focus or edit
- `ATTDEF` default/prompt split from Step239 remains intact

## Node Test Coverage

`tools/web_viewer/tests/editor_commands.test.js` now covers:

- imported invisible constant insert text:
  - imported as `visible = false`
  - excluded from `document.listVisibleEntities()`
  - reachable via `selection.insertSelectText`
  - rejects `selection.propertyPatch({ value })` with `UNSUPPORTED_READ_ONLY`
- imported invisible editable insert text:
  - imported as `visible = false`
  - excluded from `document.listVisibleEntities()`
  - reachable via `selection.insertSelectText`
  - accepts `selection.propertyPatch({ value })`
  - preserves `attribute_invisible` and `attribute_constant` on export
- legacy editor restore:
  - hidden insert text stays hidden even when older snapshots omit explicit `visible`

## Browser Smoke Assertions

Artifact:

- [summary.json](../build/editor_insert_attribute_smoke/20260325_140320/summary.json)

The real browser smoke confirms:

- hidden constant insert text:
  - `entity-visibility == Hidden`
  - `attribute-modes == Invisible / Constant`
  - no `value` field is rendered
  - `hidden_const_patch.error_code == "UNSUPPORTED_READ_ONLY"`
  - `insertGroupFrame.groupId == 3`
- hidden editable insert text:
  - `entity-visibility == Hidden`
  - `attribute-modes == Invisible`
  - `value == "HIDDEN_EDITABLE_OVERRIDE"` before edit
  - `entity.value == "HIDDEN_EDITABLE_PROXY_EDITED"` after edit
  - selection remains on `[7]` after edit
  - `insertGroupFrame.groupId == 4` before and after edit
  - the text stays absent from visible-entity queries even after the value override

## Command Results

- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `278/278 PASS`
- `ctest --output-on-failure -R test_dxf_insert_attributes_run`
  - PASS
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
- `git diff --check`
  - PASS

## Notes

This slice deliberately keeps the editor conservative:

- hidden insert text is now intentionally reachable, not globally visible
- constant insert text remains importer-authored until release
- Step237-239 insert-text proxy boundaries remain intact while the flags now drive real behavior
