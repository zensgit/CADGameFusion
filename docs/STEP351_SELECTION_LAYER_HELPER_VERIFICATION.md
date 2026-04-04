# Step351 Selection Layer Helper Verification

## Required Checks

Run:

```bash
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_layer_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_editability_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_meta_helpers.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_contract.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_detail_facts.js
/opt/homebrew/bin/node --check tools/web_viewer/ui/selection_presentation.js
```

Run focused tests:

```bash
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_editability_helpers.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_contract.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_detail_facts.test.js
/opt/homebrew/bin/node --test tools/web_viewer/tests/selection_presentation.test.js
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
- Keep this step narrowly about layer helper deduplication only.
