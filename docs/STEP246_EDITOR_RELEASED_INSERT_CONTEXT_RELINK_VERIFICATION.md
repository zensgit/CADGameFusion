# Step246: Editor Released Insert Context Relink Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- released insert text still clears the live imported insert contract and edits like plain text
- `releasedInsertArchive` preserves the original imported `groupId` as `groupId`
- property/selection UI expose archived original-group context as read-only metadata
- relink only targets a surviving imported insert group that still matches the archived id
- fit uses the same insert-group bounds contract as the live `Fit Insert Group` path
- if the original group no longer survives, the archive remains visible but relink/fit are disabled
- CADGF export does not serialize archive-only relink metadata

## Results

- `node --check tools/web_viewer/insert_group.js`
  - PASS
- `node --check tools/web_viewer/state/documentState.js`
  - PASS
- `node --check tools/web_viewer/commands/command_registry.js`
  - PASS
- `node --check tools/web_viewer/ui/selection_presenter.js`
  - PASS
- `node --check tools/web_viewer/ui/property_panel.js`
  - PASS
- `node --check tools/web_viewer/ui/workspace.js`
  - PASS
- `node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
- `node --check tools/web_viewer/tests/editor_commands.test.js`
  - PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `286/286 PASS`
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
  - artifact:
    - [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260325_195025/summary.json)
- `git diff --check`
  - PASS

## Confirmed Artifact Facts

From [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260325_195025/summary.json):

- `after_attdef_release_edit`
  - property actions include `select-released-insert-group`
  - property actions include `fit-released-insert-group`
  - property metadata shows `released-group-id = 2`
  - property metadata keeps `released-from = INSERT / text / proxy`

- `after_attdef_fit_released_group`
  - status is `Fit Released Insert Group: AttdefBlock`
  - debug view changes from:
    - `zoom = 4.392156862745098`
    - `pan = (-31.84313725490199, 669.7254901960785)`
  - to:
    - `zoom = 16`
    - `pan = (88, 1507.5)`

- `after_attdef_select_released_group`
  - `selectionIds = [2]`
  - selected entity stays live imported geometry with `origin = INSERT / insert / exploded`
  - selected entity shows `group-id = 2`
  - selected entity shows `block-name = AttdefBlock`
  - status is `Selected released insert group (1 entities)`

That confirms Step246 closes the loop from released plain text back to the surviving imported insert context without reviving live attribute semantics on the released entity itself.
