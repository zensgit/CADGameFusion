# Step321 Property Panel Readonly Note Bag Verification

## Scope

Verified readonly-note bag resolution changes in:

- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/property_panel_render.js`

Updated render coverage:

- `tools/web_viewer/tests/property_panel_render.test.js`

## Static Checks

Passed:

- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_render.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render.test.js`

## Unit Tests

Passed:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_collaborators.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_controller_slice.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_lifecycle.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_controller.test.js`

Observed result:

- `21/21` passing

Additional broad regression:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`
- observed `297/297` passing

## Browser Smoke

Passed:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_current_layer_smoke/20260329_162104/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260329_162104/summary.json`

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`

## Notes

Claude Code CLI was used as a parallel read-only reviewer for this boundary. Its advice aligned with the implemented step in one key point:

- `addReadonlyNote` was the last direct `domBindings` leak worth moving out of `property_panel.js`

It also suggested a deeper future step: removing `addReadonlyNote` from the branch-composer / branch-renderer handler contract entirely. That was intentionally left for a later step to keep Step321 minimal.
