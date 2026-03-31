# Step242: Editor Insert Attribute Position Lock Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/scripts/editor_insert_attribute_smoke.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
git diff --check
```

## Expected Contract

- generic imported `INSERT` text proxy still stays value-only
- imported `ATTRIB` with `attribute_lock_position = true` stays value-only
- imported `ATTDEF` with `attribute_lock_position = false` exposes `position.x / position.y`
- hidden unlocked imported attribute also exposes `position.x / position.y` once explicitly focused through insert-text selection
- direct position edits keep `INSERT / text / proxy` provenance intact
- `height / rotation` remain unavailable for imported insert attributes
- hidden unlocked attribute stays hidden from visible-entity queries even after position edits

## Node Test Coverage

`tools/web_viewer/tests/editor_commands.test.js` now covers:

- generic imported insert text proxy:
  - still rejects direct `position` patch
- real imported `ATTRIB` with `attribute_lock_position = true`:
  - accepts `value`
  - rejects `position`
- real imported `ATTDEF` with `attribute_lock_position = false`:
  - accepts `value`
  - accepts `position`
  - export preserves updated `text.pos`
- hidden unlocked imported attribute:
  - stays hidden
  - accepts both `value` and `position`
  - export preserves both updated value and updated `text.pos`

## Browser Smoke Assertions

Artifact:

- [summary.json](../build/editor_insert_attribute_smoke/20260325_151418/summary.json)

The real browser smoke confirms:

- lock-positioned imported `ATTRIB`
  - `attribute-modes = Lock Position`
  - only `value` is rendered
  - note explicitly says `position stays lock-positioned until release`
- unlocked imported `ATTDEF`
  - `attribute-modes = Verify / Preset`
  - `value`, `position.x`, and `position.y` are rendered
  - in-place position edit moves the proxy to `(29, 15)`
  - entity stays `sourceType = INSERT`, `editMode = proxy`
- hidden unlocked imported attribute
  - after `Select Insert Text`, `value`, `position.x`, and `position.y` are rendered
  - in-place edit keeps the entity hidden from visible-entity queries
  - value becomes `HIDDEN_EDITABLE_PROXY_EDITED`
  - position becomes `(149, 24)`
  - insert-group overlay remains on `groupId = 4`

## Results

- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `280/280 PASS`
- `node tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - PASS
  - run dir:
    - `build/editor_insert_attribute_smoke/20260325_151418`
- `git diff --check`
  - PASS
