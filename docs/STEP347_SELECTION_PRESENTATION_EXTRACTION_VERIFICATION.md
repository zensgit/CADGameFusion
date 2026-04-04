# Step347 Selection Presentation Extraction Verification

## Required Checks

Run `node --check` on:

- `tools/web_viewer/ui/selection_presentation.js`
- `tools/web_viewer/ui/selection_presenter.js`
- the new focused helper test file

Run focused tests:

- the new selection presentation helper test file

Run integration guard:

- `tools/web_viewer/tests/editor_commands.test.js`

Run formatting guard:

- `git diff --check`

## Suggested Commands

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presentation.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/selection_presentation.test.js

/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_presentation.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js

git diff --check
```

## Expected Reporting

Report:

- changed files
- focused helper test result
- `editor_commands.test.js` result
- `git diff --check` result

Browser smoke is not required for this seam unless the implementation unexpectedly
changes render flow beyond the presentation helper itself.
