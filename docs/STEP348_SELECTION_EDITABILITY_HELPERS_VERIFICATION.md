# Step348 Selection Editability Helpers Verification

## Required Checks

Run `node --check` on:

- `tools/web_viewer/ui/selection_editability_helpers.js`
- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel_note_helpers.js`
- `tools/web_viewer/ui/property_panel_note_plan.js`
- the new focused helper test file

Run focused tests:

- the new selection editability helper test file
- `tools/web_viewer/tests/property_panel_note_helpers.test.js`
- `tools/web_viewer/tests/property_panel_note_plan.test.js`

Run integration guard:

- `tools/web_viewer/tests/editor_commands.test.js`

Run formatting guard:

- `git diff --check`

## Suggested Commands

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_editability_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_panel_note_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_panel_note_plan.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/selection_editability_helpers.test.js

/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_editability_helpers.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/property_panel_note_helpers.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/property_panel_note_plan.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js

git diff --check
```

## Expected Reporting

Report:

- changed files
- focused helper test result
- `property_panel_note_helpers.test.js` result
- `property_panel_note_plan.test.js` result
- `editor_commands.test.js` result
- `git diff --check` result

Browser smoke is not required for this seam unless the implementation unexpectedly
touches broader render behavior.
