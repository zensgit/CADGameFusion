# Step360: Selection Base Facts Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step360-selection-base-facts`

## Static Checks

```bash
node --check tools/web_viewer/ui/selection_base_facts.js
node --check tools/web_viewer/ui/selection_detail_facts.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/selection_base_facts.test.js \
  tools/web_viewer/tests/selection_detail_facts.test.js
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
