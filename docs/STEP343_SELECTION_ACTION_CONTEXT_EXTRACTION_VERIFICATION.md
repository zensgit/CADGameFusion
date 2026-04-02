# Step343: Selection Action Context Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step343-selection-action-context`

## Static Checks

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_action_context.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/selection_action_context.test.js
```

## Focused Tests

```bash
/opt/homebrew/bin/node --test \
  tools/web_viewer/tests/selection_action_context.test.js \
  tools/web_viewer/tests/property_metadata_facts.test.js \
  tools/web_viewer/tests/selection_detail_facts.test.js \
  tools/web_viewer/tests/selection_released_archive_helpers.test.js
```

## Integration Gate

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js
git diff --check
```

## Optional Smoke

Only rerun smoke if the extraction unexpectedly affects property-panel action
wiring. If smoke is rerun, report exact `summary.json` paths.

## Expected Result

- syntax checks pass
- focused tests pass
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
- no new dependency cycle back into `selection_presenter.js`
