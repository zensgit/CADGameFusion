# Step379: Source Text Field Appender Extraction Verification

Run from:

- `/Users/huazhou/Downloads/Github/VemCAD/.worktrees/step379-source-text-field-appender-cadgf`

## Static Checks

```bash
node --check tools/web_viewer/ui/property_panel_source_text_field_appender.js
node --check tools/web_viewer/ui/property_panel_glue_field_appenders.js
```

## Focused Tests

```bash
node --test \
  tools/web_viewer/tests/property_panel_source_text_field_appender.test.js \
  tools/web_viewer/tests/property_panel_glue_field_appenders.test.js
```

## Integration

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

## Diff Hygiene

```bash
git diff --check
```

## Expected Report

Report:

- syntax status
- focused test totals
- `editor_commands.test.js` total
- `git diff --check` result

Do not claim browser smoke coverage unless it was actually rerun.
