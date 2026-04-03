# Step346 Selection Presenter Cleanup Verification

## Required Checks

Run `node --check` on:

- `tools/web_viewer/ui/selection_presenter.js`

Run focused tests:

- `tools/web_viewer/tests/editor_commands.test.js`

If the cleanup touches any presenter-focused test seam, also run that focused test
file.

Run formatting guard:

- `git diff --check`

## Suggested Commands

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js

/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js

git diff --check
```

## Expected Reporting

Report:

- changed files
- confirmation of which dead helpers/imports were removed
- `editor_commands.test.js` result
- `git diff --check` result

Browser smoke is not required for this cleanup-only seam unless the implementation
unexpectedly changes render behavior.
