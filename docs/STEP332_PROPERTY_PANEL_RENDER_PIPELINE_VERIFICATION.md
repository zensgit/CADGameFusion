# Step332 Property Panel Render Pipeline Verification

## Scope

To verify Step332 after implementation, validate:

- `tools/web_viewer/ui/property_panel_render_pipeline.js`
- `tools/web_viewer/ui/property_panel_render.js`
- `tools/web_viewer/tests/property_panel_render_pipeline.test.js`
- updated render tests

## Static Checks

Expected commands:

- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_render_pipeline.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel_render.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_pipeline.test.js`

## Unit Tests

Minimum expected commands:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_pipeline.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_deps.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_branch_execution.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render_branch_state.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shell_state.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shells.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_selection_shell_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_active_render.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel_branch_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/property_panel.test.js`
- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Expected commands:

- `mkdir -p /tmp/editor-current-layer-step332 /tmp/editor-selection-summary-step332 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js --outdir /tmp/editor-current-layer-step332 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js --outdir /tmp/editor-selection-summary-step332`
- `PATH="/Users/huazhou/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step332`

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

- pipeline helper changes collaborator call order
- `renderPropertyPanel(...)` stops being a thin entrypoint wrapper
- `resolvedDeps.rawDeps` or equivalent transport mutates execution behavior
- step expands into dependency resolution or branch behavior changes instead of staying in orchestration sequencing
