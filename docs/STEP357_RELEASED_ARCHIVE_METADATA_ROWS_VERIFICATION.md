# Step357: Released Archive Metadata Rows Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step357-released-archive-metadata-rows`

## Static Checks

```bash
node --check tools/web_viewer/ui/released_archive_metadata_rows.js
node --check tools/web_viewer/ui/selection_detail_facts.js
node --check tools/web_viewer/ui/released_insert_selection_rows.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/released_archive_metadata_rows.test.js \
  tools/web_viewer/tests/selection_detail_facts.test.js \
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
