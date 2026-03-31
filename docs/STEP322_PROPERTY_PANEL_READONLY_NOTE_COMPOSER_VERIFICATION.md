# Step322 Property Panel Readonly Note Callback Consolidation Verification

## Scope

Verified readonly-note callback consolidation in:

- `tools/web_viewer/ui/property_panel_render_callbacks.js`
- `tools/web_viewer/ui/property_panel_active_render.js`
- `tools/web_viewer/ui/property_panel_branch_composer.js`
- `tools/web_viewer/ui/property_panel_branch_renderers.js`

Updated coverage:

- `tools/web_viewer/tests/property_panel_render_callbacks.test.js`
- `tools/web_viewer/tests/property_panel_active_render.test.js`
- `tools/web_viewer/tests/property_panel_branch_composer.test.js`
- `tools/web_viewer/tests/property_panel_branch_renderers.test.js`

## Static Checks

Passed:

- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_branch_renderers.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_branch_composer.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_render_callbacks.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_active_render.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_renderers.test.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_composer.test.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_callbacks.test.js`

## Unit Tests

Passed:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_composer.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_callbacks.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`

Observed result:

- `19/19` passing

Additional broad regression:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

Observed result:

- `297/297` passing

## Browser Smoke

Passed:

- `/tmp/editor-current-layer-step322/20260329_163417/summary.json`
- `/tmp/editor-selection-summary-step322/20260329_163419/summary.json`
- `/tmp/editor-ui-flow-step322-path2/summary.json`

## Notes

- A raw `editor_ui_flow_smoke.sh` invocation from the restarted shell first failed on missing `npx` and then on missing `playwright-cli` because this environment did not include `~/.npm-global/bin` on `PATH`.
- Re-running with `PATH="/Users/huazhou/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"` produced a green `editor_ui_flow` gate. The final summary recorded `gate_ok: true` and `selection_provenance_summary_ok: true`.

## Diff Sanity

Passed:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`

## Review Input

Both parallel reviewers aligned on keeping Step322 narrow:

- Claude Code CLI favored removing the separate readonly-note threading without widening into a larger render refactor.
- The explorer subagent independently identified the same safe seam around `active_render -> branch_composer -> branch_renderers`, while also warning against pulling note-plan assembly into this step.
