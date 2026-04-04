# Step359: Selection Line Style Rows Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step359-selection-line-style-rows`

## Static Checks

```bash
node --check tools/web_viewer/ui/selection_line_style_rows.js
node --check tools/web_viewer/ui/selection_detail_facts.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/selection_line_style_rows.test.js \
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
