# Step353 Released Archive Selection Rows Verification

## Required Checks

Run:

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/released_insert_selection_rows.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_detail_facts.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_panel_info_rows.js
```

Run focused tests:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/released_insert_selection_rows.test.js
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
- focused released-row/detail/property-row tests pass unchanged
- `editor_commands.test.js` passes unchanged
- `git diff --check` exits cleanly

## Notes

- No browser smoke runs are required for this step unless broader behavior is introduced.
- Keep this step narrowly about released-archive multi-selection rows only.
