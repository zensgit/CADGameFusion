# Step341: Selection Contract Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step341-selection-contract`

## Static Checks

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_contract.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/selection_contract.test.js
```

## Focused Tests

```bash
/opt/homebrew/bin/node --test \
  tools/web_viewer/tests/selection_contract.test.js \
  tools/web_viewer/tests/selection_badges.test.js \
  tools/web_viewer/tests/selection_overview.test.js \
  tools/web_viewer/tests/selection_detail_facts.test.js \
  tools/web_viewer/tests/selection_released_archive_helpers.test.js
```

## Integration Gate

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js
git diff --check
```

## Optional Smoke

Only rerun smoke if the helper extraction unexpectedly affects selection summary wiring.
If you do rerun smoke, report exact `summary.json` paths.

## Expected Result

- syntax checks pass
- focused tests pass
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
- no new dependency cycle back into `selection_presenter.js`
