# Step297 Property Panel Branch Renderers Verification

## Scope

Verified the extraction of property-panel branch orchestration into:

- `tools/web_viewer/ui/property_panel_branch_renderers.js`

Updated shell:

- `tools/web_viewer/ui/property_panel.js`

Added unit coverage:

- `tools/web_viewer/tests/property_panel_branch_renderers.test.js`

## Static Checks

Passed:

- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_branch_renderers.js`
- `node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`

## Unit Tests

Passed:

- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_renderers.test.js`
- `node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260329_015924/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260329_015924/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_015924/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_classic_leader_smoke/20260329_015924/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_table_smoke/20260329_015924/summary.json`

Observed existing unrelated red signal:

- `/tmp/editor-ui-flow-step297/summary.json`

`editor_ui_flow_smoke.sh` still fails at `selection_provenance_summary` with the same timeout already seen in prior steps. Step297 branch extraction did not introduce a new `editor_ui_flow` failure mode.

## Contract Notes

These flows remained intact after extraction:

- read-only source text branch still exposes direct source-text editing
- released insert archive note still renders under the same conditions
- locked-layer branch still blocks editing when required
- editable single-selection branch still appends common fields, style actions, and single-entity fields in order
- editable multi-selection branch still skips single-entity fields
