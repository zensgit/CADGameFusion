# Step373: Layer Actions Mainline Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step373-layer-actions-mainline-cadgf`

## Static Checks

```bash
node --check tools/web_viewer/ui/property_panel_layer_mainline_actions.js
node --check tools/web_viewer/ui/property_panel_layer_actions.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/property_panel_layer_mainline_actions.test.js \
  tools/web_viewer/tests/property_panel_layer_actions.test.js
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
