# Step243: Editor Insert Editable Text Selection Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- `selection.insertSelectText`
  - still selects every insert text member
- `selection.insertSelectEditableText`
  - narrows to directly editable insert text only
  - skips constant text proxies
  - returns `GROUP_HAS_NO_EDITABLE_TEXT` when the insert group has no directly editable text
- `instextedit`
  - replays the same editable-text narrowing path from the command bar
- mixed imported insert-attribute groups
  - surface both `Select Insert Text` and `Select Editable Insert Text`
  - keep the insert-group overlay while narrowed to editable text

## Node Test Coverage

`tools/web_viewer/tests/editor_commands.test.js` should cover:

- peer selection preserves the new `editable-text` scope across insert peers
- mixed insert groups distinguish:
  - all insert text
  - editable insert text only
- groups with only constant text fail with `GROUP_HAS_NO_EDITABLE_TEXT`

## Browser Smoke Assertions

`tools/web_viewer/scripts/editor_insert_attribute_smoke.js` should prove:

- a generated mixed imported insert-attribute group exposes both actions
- `Select Insert Text` selects both mixed text proxies
- `Select Editable Insert Text` narrows to the editable text proxy only
- `instextedit` lands on that same editable text proxy from the command bar
- the constant text proxy stays out of the narrowed editable selection

## Results

- `node --check tools/web_viewer/insert_group.js`
  - PASS
- `node --check tools/web_viewer/commands/command_registry.js`
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
  - `284/284 PASS`
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
  - artifact:
    - [summary.json](../build/editor_insert_attribute_smoke/20260325_153836/summary.json)
- `git diff --check`
  - PASS

## Confirmed Artifact Facts

The browser artifact confirms:

- mixed imported insert-attribute driver selection exposes both:
  - `select-insert-text`
  - `select-editable-insert-text`
- `Select Insert Text` selects `[9, 10]`
- `Select Editable Insert Text` narrows to `[9]`
- the narrowed editable proxy reports:
  - `attribute-tag = MIXED_EDITABLE_TAG`
- command-line `instextedit` also narrows to `[9]`
