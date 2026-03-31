# Step244: Editor Released Insert Attribute Normalization Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- released insert text no longer carries active `attribute_*` or `textKind` fields
- detached text value edits work even when the original imported proxy was constant
- release/edit still keeps the remaining insert geometry grouped
- browser release/edit path still exposes real text editing fields after detachment

## Results

- `node --check tools/web_viewer/commands/command_registry.js`
  - PASS
- `node --check tools/web_viewer/tests/editor_commands.test.js`
  - PASS
- `node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `284/284 PASS`
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
  - artifact:
    - [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260325_153836/summary.json)
- `git diff --check`
  - PASS

## Confirmed Artifact Facts

The shared browser artifact confirms the detached hidden-constant path now behaves like plain text:

- `hidden_const_after_release_edit.entity.sourceType == null`
- `hidden_const_after_release_edit.property.fields.value == HIDDEN_CONST_DEFAULT`
- `hidden_const_after_release_edit.property.fields.position.x == 106`
- `hidden_const_after_release_edit.property.fields.rotation == 0`
- `hidden_const_after_detached_edit.entity.value == HIDDEN_CONST_RELEASED_EDITED`

That means the released text is no longer blocked by the original imported constant contract.
