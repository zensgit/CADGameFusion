# Step368: Glue Group Action Appenders Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step368-glue-group-action-appenders-cadgf`

## Static Checks

```bash
node --check tools/web_viewer/ui/property_panel_glue_group_actions.js
node --check tools/web_viewer/ui/property_panel_glue_facade.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/property_panel_glue_group_actions.test.js \
  tools/web_viewer/tests/property_panel_glue_facade.test.js
```

## Integration

```bash
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
- `editor_commands.test.js` total
- `git diff --check` result

Do not claim browser smoke coverage unless it was actually rerun.
