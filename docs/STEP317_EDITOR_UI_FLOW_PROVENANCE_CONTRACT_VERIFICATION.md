# Step317 Editor UI Flow Provenance Contract Verification

## Scope

Verified provenance contract alignment in:

- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`

## Static Checks

Passed:

- `bash -n /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh`

## Browser Smoke

Observed artifact:

- `editor_ui_flow` observe artifact at `/tmp/editor-ui-flow-step317/flow_result.json`

The updated artifact now records the runtime-derived target layer:

- `target_layer.id = 1`
- `target_layer.name = L1`
- `target_layer.color = #9ca3af`

And the step advances beyond the old failure site:

- `__error = null`
- `__step = snap_kinds_extra`

I also re-evaluated the embedded provenance gate conditions against the produced artifact. Result:

- `selection_provenance_summary_ok = true`

## Related Smoke Regressions

Passed:

- `node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`
  - summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_110000/summary.json`
- `node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - summary at `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_attribute_smoke/20260329_110000/summary.json`

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`
