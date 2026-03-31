# Step336 Property Panel Selection Presentation Verification

## Scope

To verify Step336 after implementation, validate:

- `tools/web_viewer/ui/property_panel_selection_presentation.js`
- `tools/web_viewer/ui/property_panel_selection_context.js`
- `tools/web_viewer/tests/property_panel_selection_presentation.test.js`
- updated selection-context tests

## Static Checks

Expected commands:

- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_selection_presentation.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_selection_context.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_presentation.test.js`

## Unit Tests

Minimum expected commands:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_presentation.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_context_state.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_resolution.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_context.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_pipeline.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_deps.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_branch_execution.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_branch_state.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shell_state.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shells.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shell_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`
- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Expected commands:

- `mkdir -p /tmp/editor-current-layer-step336 /tmp/editor-selection-summary-step336 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js --outdir /tmp/editor-current-layer-step336 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js --outdir /tmp/editor-selection-summary-step336`
- `PATH="/Users/huazhou/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step336`

Expected gate:

- `ok: true` for current-layer smoke
- `ok: true` for selection-summary smoke
- `gate_ok: true`
- `selection_provenance_summary_ok: true`

## Diff Sanity

Expected command:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check`

## Reviewer Focus

When validating Claude Code output, check these failure modes first:

- presentation helper starts doing resolution or classification work
- `resolvePropertyPanelSelectionContext(...)` changes public return fields
- `buildSelectionPresentation(...)` argument order or helper bag changes
- step expands into presenter behavior changes instead of staying in wiring
