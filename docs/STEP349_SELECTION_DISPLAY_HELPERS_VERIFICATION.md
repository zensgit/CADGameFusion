# Step349 Selection Display Helpers Verification

## Required Checks

Run:

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_display_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_detail_facts.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_panel_info_rows.js
/opt/homebrew/bin/node --check tools/web_viewer/tests/selection_display_helpers.test.js
```

Run focused tests:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_display_helpers.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_detail_facts.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/property_panel_info_rows.test.js
```

Run integration:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/editor_commands.test.js
```

Run diff hygiene:

```bash
git diff --check
```

## Expected Outcome

- all `node --check` commands pass
- focused tests pass without changing public behavior
- `editor_commands.test.js` passes unchanged
- `git diff --check` exits cleanly

## Notes

- This step does not require browser smoke runs unless a broader behavior change is introduced.
- If a new helper test file is added, keep it focused on the shared formatting logic rather than row/fact assembly.
