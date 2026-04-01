# Step228: Editor LEADER Landing Side Preset Verification

## Commands
From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_source_group_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_source_group_smoke.js
git diff --check
```

## Expected Contract
- `selection.leaderFlipLandingSide` mirrors `LEADER` proxy text across the transformed landing guide
- property panel exposes `Use Opposite Landing Side`
- command line exposes `leadflip` / `leaderflip`
- `sourceTextPos` remains preserved so `srcplace` can restore the imported placement

## Verification Notes
- `node --check` passed for `command_registry.js`, `property_panel.js`, `workspace.js`, and `editor_source_group_smoke.js`
- `node --test tools/web_viewer/tests/editor_commands.test.js` passed with `253/253`
- `node tools/web_viewer/scripts/editor_source_group_smoke.js` passed
- `node tools/web_viewer/scripts/editor_insert_group_smoke.js` passed
- `node tools/web_viewer/scripts/editor_selection_summary_smoke.js` passed
- `git diff --check` passed

## Key Results
Command-layer regression confirmed:
- canonical `LEADER` guide flips from `(58, 7)` to `(57, 8)`
- moved `LEADER` guide flips from `(61, 5)` to `(60, 6)`
- `sourceTextPos` remains unchanged in both cases

Browser artifacts:
- `build/editor_source_group_smoke/20260324_080428/summary.json`
- `build/editor_insert_group_smoke/20260324_080458/summary.json`
- `build/editor_selection_summary_smoke/20260324_080458/summary.json`

Key browser assertions from `editor_source_group_smoke`:
- `leader_after_select_text.property.actions` contains `flip-leader-landing-side`
- `leader_after_flip_landing_side.entity.position == { "x": 57, "y": 8 }`
- `leader_after_flip_landing_side.entity.sourceTextPos == { "x": 58, "y": 7 }`
- `leader_after_flip_landing_side.details.items["current-offset"] == "1, 2"`
- `leader_after_flip_landing_side.statusText` contains `Applied opposite LEADER landing side`
- `leader_after_reset_placement.entity.position == { "x": 58, "y": 7 }`
