# Step227: Editor LEADER Landing Fit Verification

## Commands
From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/ui/canvas_view.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_source_group_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_source_group_smoke.js
node tools/web_viewer/scripts/editor_insert_group_smoke.js
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
git diff --check
```

## Results
- `node --check` passed for `insert_group.js`, `canvas_view.js`, `property_panel.js`, `workspace.js`, and `editor_source_group_smoke.js`
- `node --test tools/web_viewer/tests/editor_commands.test.js` passed with `251/251`
- `node tools/web_viewer/scripts/editor_source_group_smoke.js` passed
- `node tools/web_viewer/scripts/editor_insert_group_smoke.js` passed
- `node tools/web_viewer/scripts/editor_selection_summary_smoke.js` passed
- `git diff --check` passed

## Key Browser Assertions
Artifact: `build/editor_source_group_smoke/20260324_075709/summary.json`

- `leader_after_select_text.details.items["leader-landing"] == "56, 6"`
- `leader_after_select_text.details.items["leader-elbow"] == "50, 0"`
- `leader_after_select_text.details.items["leader-landing-length"] == "8.485"`
- `leader_after_select_text.property.actions` contains `fit-leader-landing`
- `leader_after_landing_fit.statusText` contains `Fit Leader Landing: LEADER 702`
- `leader_after_landing_fit.overlay.anchor == { "x": 56, "y": 6 }`
- `leader_after_landing_fit.overlay.landingPoint == { "x": 56, "y": 6 }`
- `leader_after_landing_fit.overlay.elbowPoint == { "x": 50, "y": 0 }`
- `leader_after_landing_fit.overlay.landingLength == 8.48528137423857`

Additional regression artifacts:
- `build/editor_insert_group_smoke/20260324_075729/summary.json`
- `build/editor_selection_summary_smoke/20260324_075729/summary.json`
