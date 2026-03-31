# Step231: Editor Imported Classic LEADER Guide Metadata Verification

## Scope

Verify that real imported classic leader notes now carry explicit guide metadata from importer to browser, while grouped-source regressions remain green.

## Commands

From `deps/cadgamefusion`:

```bash
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_paperspace_combo test_dxf_paperspace_insert_leader test_dxf_paperspace_annotation_bundle test_dxf_mleader_metadata -j4
ctest --test-dir build --output-on-failure -R 'test_dxf_(paperspace_combo|paperspace_insert_leader|paperspace_annotation_bundle|mleader_metadata)_run'
node --test tools/web_viewer/tests/editor_commands.test.js
node --check tools/web_viewer/scripts/editor_classic_leader_smoke.js
build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/step186_paperspace_combo_sample.dxf --out build/step231_combo_preview_b --json
build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/step186_paperspace_insert_leader_sample.dxf --out build/step231_insert_leader_preview_b --json
build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf --out build/step231_annotation_bundle_preview_b --json
node tools/web_viewer/scripts/editor_classic_leader_smoke.js
node tools/web_viewer/scripts/editor_source_group_smoke.js
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C . diff --check
```

## Expected Results

### Importer / Preview Artifacts

On [step186_paperspace_combo_sample.dxf](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/plugin_data/step186_paperspace_combo_sample.dxf):

- exactly one note text remains the positive classic leader association target
- the target is still `THIRD NOTE`
- the target now also carries:
  - `source_anchor = [188, 150]`
  - `leader_landing = [188, 150]`
  - `leader_elbow = [204, 162]`
  - `source_anchor_driver_type = polyline`
  - `source_anchor_driver_kind = endpoint`

On [step186_paperspace_insert_leader_sample.dxf](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/plugin_data/step186_paperspace_insert_leader_sample.dxf) and [step186_paperspace_annotation_bundle_sample.dxf](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf):

- zero text entities become `source_type=LEADER`

### JS Contract Tests

`editor_commands.test.js` must prove:

- `resolveSourceTextGuide()` prefers explicit imported `LEADER` guide metadata over heuristic endpoint choice
- whole-group `move` carries explicit `sourceAnchor / leaderLanding / leaderElbow`
- adapter import/export preserves explicit guide metadata and still matches the real driver entity

### Browser Smoke

[editor_classic_leader_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_classic_leader_smoke.js) must prove:

- the imported note entity already contains `sourceAnchor / leaderLanding / leaderElbow / sourceAnchorDriverType / sourceAnchorDriverKind`
- quicklook and property rows show `Source Anchor / Leader Landing / Leader Elbow / Source Anchor Driver`
- `leadfit` overlay resolves the explicit importer path `188,150 -> 204,162`
- `srcdriver` selects the real leader polyline member
- proxy text edit, `srcplace`, `srcgrp`, `srctext`, and `srcedit` still work on the same real imported note

[editor_source_group_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js) and [editor_selection_summary_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js) must remain green, proving the shared grouped-source resolver still works for existing `DIMENSION` and synthetic source-group flows.

## Recorded Result

Node tests:

- `node --test tools/web_viewer/tests/editor_commands.test.js`: `258/258 PASS`

Importer tests:

- `test_dxf_mleader_metadata_run`: PASS
- `test_dxf_paperspace_insert_leader_run`: PASS
- `test_dxf_paperspace_annotation_bundle_run`: PASS
- `test_dxf_paperspace_combo_run`: PASS

Preview artifacts:

- [combo document.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step231_combo_preview_b/document.json)
- [insert leader document.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step231_insert_leader_preview_b/document.json)
- [annotation bundle document.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step231_annotation_bundle_preview_b/document.json)

Browser smoke artifacts:

- [editor_classic_leader_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_classic_leader_smoke/20260324_092244/summary.json)
- [editor_source_group_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260324_092244/summary.json)
- [editor_selection_summary_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260324_092244/summary.json)

Worktree hygiene:

- `git diff --check`: PASS
