# STEP197 Editor Layoff Workflow Verification

## Scope

This verification records the low-level layer-off/on contract added in Step197.

## Expected Coverage

- selection-based layer target resolution for `LAYOFF`
- reversible layer visibility sessions
- safe fallback when turning off the current layer
- rejection when no fallback layer is available
- optional layer-panel / property-panel hook exposure

## Verification Commands

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Expected outcome:

- `resolveSelectionLayerOffLayers` returns unique layer ids from the current selection
- `activateLayerOff` hides selected layers and provides a fallback current-layer hint
- `restoreLayerOff` restores saved visibility state
- `activateLayerOff` rejects the only visible editable current layer with `NO_FALLBACK_LAYER`

```bash
git -C deps/cadgamefusion diff --check
```

Expected outcome:

- clean patch formatting

## Notes

This step intentionally avoids workspace wiring and browser smoke edits. Those can be added later once the command/UI contract is ready to consume the new helper surface.
