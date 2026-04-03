# Step345 Property Panel Note Plan Extraction Verification

## Required Checks

Run `node --check` on:

- `tools/web_viewer/ui/property_panel_note_plan.js`
- `tools/web_viewer/ui/selection_presenter.js`
- the new focused helper test file

Run focused tests:

- the new property-panel note plan helper test file
- `tools/web_viewer/tests/property_panel_render_state.test.js`

Run integration guard:

- `tools/web_viewer/tests/editor_commands.test.js`

Run formatting guard:

- `git diff --check`

## Suggested Commands

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_panel_note_plan.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presenter.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/property_panel_note_plan.test.js

/opt/homebrew/bin/node --test tools/web_viewer/tests/property_panel_note_plan.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/property_panel_render_state.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js

git diff --check
```

## Expected Reporting

Report:

- changed files
- focused helper test result
- `property_panel_render_state.test.js` result
- `editor_commands.test.js` result
- `git diff --check` result

Browser smoke is not required for this seam unless the implementation unexpectedly
touches render flow beyond the note-plan helper itself.
