# Step342: Property Metadata Facts Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step342-property-metadata-facts`

## Static Checks

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_metadata_facts.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/property_metadata_facts.test.js
```

## Focused Tests

```bash
/opt/homebrew/bin/node --test \
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

Only rerun smoke if the extraction unexpectedly affects selection/property-panel
wiring. If smoke is rerun, report exact `summary.json` paths.

## Expected Result

- syntax checks pass
- focused tests pass
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
- no new dependency cycle back into `selection_presenter.js`
