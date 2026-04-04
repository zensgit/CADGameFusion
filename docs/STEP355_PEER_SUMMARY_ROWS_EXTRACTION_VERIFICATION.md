# Step355: Peer Summary Rows Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step355-peer-summary-rows`

## Static Checks

```bash
node --check tools/web_viewer/ui/peer_summary_rows.js
node --check tools/web_viewer/ui/group_info_rows.js
node --check tools/web_viewer/ui/released_insert_selection_rows.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/peer_summary_rows.test.js \
  tools/web_viewer/tests/group_info_rows.test.js \
  tools/web_viewer/tests/released_insert_selection_rows.test.js
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
