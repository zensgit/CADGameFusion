# Step307 Property Panel Selection Context Verification

## Scope

Verified selection-context extraction into:

- `tools/web_viewer/ui/property_panel_selection_context.js`

Updated shell:

- `tools/web_viewer/ui/property_panel.js`

Added unit coverage:

- `tools/web_viewer/tests/property_panel_selection_context.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_selection_context.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_context.test.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_context.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_093933/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_093933/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_093933/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_093933/summary.json`

Observed existing unrelated red signal:

- `/tmp/editor-ui-flow-step307/summary.json`

Rerun with clean outdir restored the prior failure signature:

- `/tmp/editor-ui-flow-step307-rerun/summary.json`

`editor_ui_flow_smoke.sh` first hit a transient `#cad-clear-doc` click timeout, but the rerun returned the same prior `selection_provenance_summary` timeout signature seen before this step. Step307 selection-context extraction did not introduce a stable new `editor_ui_flow` failure mode.

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`

## Notes

This step intentionally preserved the distinction between:

- `empty`: no selected ids, so current-layer defaults render
- `missing`: stale selected ids with no surviving entities, so only summary/details reset
