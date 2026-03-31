# Step245: Editor Released Insert Archive Provenance Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- released insert text continues to clear live imported insert and active `attribute_*` fields
- released text keeps `releasedInsertArchive` in editor state
- selection/property UI expose released provenance under dedicated read-only `released-*` facts
- released text still edits like plain text after further value edits
- CADGF export does not reintroduce cleared live attribute fields

## Results

- `node --check tools/web_viewer/ui/selection_presenter.js`
  - PASS
- `node --check tools/web_viewer/ui/property_panel.js`
  - PASS
- `node --check tools/web_viewer/state/documentState.js`
  - PASS
- `node --check tools/web_viewer/commands/command_registry.js`
  - PASS
- `node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
- `node --check tools/web_viewer/tests/editor_commands.test.js`
  - PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `285/285 PASS`
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
  - artifact:
    - [summary.json](../build/editor_insert_attribute_smoke/20260325_193906/summary.json)
- `git diff --check`
  - PASS

## Artifact Checks

The browser artifact confirms these facts:

- released `ATTDEF` text shows:
  - `released-from = INSERT / text / proxy`
  - `released-block-name = AttdefBlock`
  - `released-text-kind = attdef`
  - `released-attribute-tag = ATTDEF_TAG`
  - `released-attribute-default = ATTDEF_PROXY_EDITED`
  - `released-attribute-prompt = ATTDEF_PROMPT`
  - `released-attribute-modes = Verify / Preset`
- released hidden constant text shows:
  - `released-attribute-tag = HIDDEN_CONST_TAG`
  - `released-attribute-modes = Invisible / Constant`
- released entities no longer expose live property metadata such as:
  - `attribute-tag`
  - `text-kind`
- subsequent detached edits keep `releasedInsertArchive` intact

## Confirmed Artifact Facts

From [summary.json](../build/editor_insert_attribute_smoke/20260325_193906/summary.json):

- `after_attdef_release_edit`
  - `entity.sourceType == null`
  - `entity.releasedInsertArchive.sourceType == INSERT`
  - `entity.releasedInsertArchive.attributeTag == ATTDEF_TAG`
  - `entity.releasedInsertArchive.attributeDefault == ATTDEF_PROXY_EDITED`
  - `details.released-from == INSERT / text / proxy`
  - `details.released-attribute-modes == Verify / Preset`
  - `property.released-text-kind == attdef`
  - property note explains archived ATTDEF provenance stays visible while detached text edits like plain text
  - live `attribute-tag` and live `text-kind` are absent from property metadata

- `hidden_const_after_release_edit`
  - `entity.releasedInsertArchive.attributeTag == HIDDEN_CONST_TAG`
  - `entity.releasedInsertArchive.attributeConstant == true`
  - `details.released-attribute-modes == Invisible / Constant`
  - `property.released-attribute-modes == Invisible / Constant`
  - live `attribute-tag` is absent from property metadata

- `hidden_const_after_detached_edit`
  - `entity.value == HIDDEN_CONST_RELEASED_EDITED`
  - `entity.releasedInsertArchive.attributeTag == HIDDEN_CONST_TAG`
  - property metadata still shows `released-from / released-block-name / released-text-kind / released-attribute-*`

That means Step244 remains true, but Step245 adds durable archived provenance instead of making released insert text lose all historical context.
