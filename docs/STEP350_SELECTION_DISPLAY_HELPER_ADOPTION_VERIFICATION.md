# Step350 Selection Display Helper Adoption Verification

## Required Checks

Run:

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_display_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/property_metadata_facts.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_action_context.js
```

Run focused tests:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/property_metadata_facts.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_action_context.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_display_helpers.test.js
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
- focused tests pass with unchanged public behavior
- `editor_commands.test.js` passes unchanged
- `git diff --check` exits cleanly

## Notes

- No browser smoke runs are required for this step unless broader behavior is introduced.
- Keep this step stacked cleanly on top of Step349 only.
