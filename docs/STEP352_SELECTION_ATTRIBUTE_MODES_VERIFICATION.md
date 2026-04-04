# Step352 Selection Attribute Modes Verification

## Required Checks

Run:

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_attribute_mode_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_released_archive_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_detail_facts.js
```

Run focused tests:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_attribute_mode_helpers.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_released_archive_helpers.test.js
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
- focused helper/archive/detail/property-row tests pass unchanged
- `editor_commands.test.js` passes unchanged
- `git diff --check` exits cleanly

## Notes

- No browser smoke runs are required for this step unless broader behavior is introduced.
- Keep this step narrowly about shared attribute-mode formatting only.
