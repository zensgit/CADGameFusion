# Step376: Single Entity Fields Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step376-single-entity-fields-cadgf`

## Static Checks

```bash
node --check tools/web_viewer/ui/property_panel_single_entity_fields.js
node --check tools/web_viewer/ui/property_panel_entity_fields.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/property_panel_single_entity_fields.test.js \
  tools/web_viewer/tests/property_panel_entity_fields.test.js
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
