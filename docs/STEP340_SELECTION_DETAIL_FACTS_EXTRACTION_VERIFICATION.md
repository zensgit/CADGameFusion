# Step340 Selection Detail Facts Extraction Verification

## Scope

To verify Step340 after implementation, validate:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/tests/selection_detail_facts.test.js`

## Static Checks

Expected commands:

- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/ui/selection_detail_facts.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/ui/selection_presenter.js`
- `/opt/homebrew/bin/node --check /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/selection_detail_facts.test.js`

## Unit Tests

Minimum expected commands:

- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/selection_detail_facts.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/selection_meta_helpers.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/selection_overview.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/selection_badges.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_presentation.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_context_state.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_resolution.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_context.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_shell_state.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_shells.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_selection_shell_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_render_pipeline.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_render_deps.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_render_branch_execution.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_render_branch_state.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_render.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_active_render.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel_branch_renderers.test.js /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/property_panel.test.js`
- `/opt/homebrew/bin/node --test /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/tests/editor_commands.test.js`

## Browser Smoke

Expected commands:

- `mkdir -p /tmp/editor-current-layer-step340 /tmp/editor-selection-summary-step340 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/scripts/editor_current_layer_smoke.js --outdir /tmp/editor-current-layer-step340 && /opt/homebrew/bin/node /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/scripts/editor_selection_summary_smoke.js --outdir /tmp/editor-selection-summary-step340`
- `PATH="/Users/huazhou/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" bash /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step340`

Expected gate:

- `ok: true` for current-layer smoke
- `ok: true` for selection-summary smoke
- `gate_ok: true`
- `interaction_checks.selection_provenance_summary_ok: true`

## Local Environment Note

On this machine, `editor_ui_flow_smoke.sh` may fail at open-time because the stock Playwright wrapper shells through `npx` and can hit local cache rename races.

If that happens, rerun the same smoke with a temporary `CODEX_HOME` whose `skills/playwright/scripts/playwright_cli.sh` directly execs `/Users/huazhou/.npm-global/bin/playwright-cli`. Treat a clean-wrapper rerun as the authoritative Step340 gate on this machine.

## Diff Sanity

Expected command:

- `git -C /Users/huazhou/Downloads/Github/VemCAD/.worktrees/step340-selection-detail-facts diff --check`

## Reviewer Focus

When validating Claude Code output, check these failure modes first:

- `buildSelectionDetailFacts(...)` behavior changes or fact ordering drifts
- `buildSelectionPresentation(...)` stops using the same single-vs-multi detail fact split
- `selection_presenter.js` stops re-exporting `buildSelectionDetailFacts(...)`
- `buildPropertyMetadataFacts(...)` drifts because it no longer wraps `buildSelectionDetailFacts(...)` identically
