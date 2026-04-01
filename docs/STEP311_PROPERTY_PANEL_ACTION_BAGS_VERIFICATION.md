# Step311 Property Panel Action Bags Verification

## Scope

Verified action-bag normalization into:

- `tools/web_viewer/ui/property_panel_action_bags.js`

Updated modules:

- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/property_panel_collaborators.js`
- `tools/web_viewer/ui/workspace.js`

Added unit coverage:

- `tools/web_viewer/tests/property_panel_action_bags.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_action_bags.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_collaborators.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_action_bags.test.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_action_bags.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_collaborators.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_100639/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_100639/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_100639/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_100639/summary.json`

Observed existing unrelated red signal:

- `/tmp/editor-ui-flow-step311/summary.json`

`editor_ui_flow_smoke.sh` returned the same prior failure signature seen before this step:

- step: `selection_provenance_summary`
- error: `page.waitForFunction: Timeout 15000ms exceeded.`

Step311 action-bag normalization did not introduce a new `editor_ui_flow` failure mode.

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`

## Notes

This step keeps backward compatibility for callers that still pass flat callbacks directly into `createPropertyPanel(...)`.
