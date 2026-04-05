# Step364: Selection Shell Hero Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step364-selection-shell-hero`

## Static Checks

```bash
node --check tools/web_viewer/ui/property_panel_selection_hero_renderer.js
node --check tools/web_viewer/ui/property_panel_selection_shell_renderers.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/property_panel_selection_hero_renderer.test.js \
  tools/web_viewer/tests/property_panel_selection_shell_renderers.test.js
```

## Integration

```bash
node --test tools/web_viewer/tests/property_panel_selection_shells.test.js
node --test tools/web_viewer/tests/editor_commands.test.js
```

## Diff Hygiene

```bash
git diff --check
```

## Expected Report

Report:

- syntax status
- focused test totals
- `property_panel_selection_shells.test.js` total
- `editor_commands.test.js` total
- `git diff --check` result

Do not claim browser smoke coverage unless it was actually rerun.
