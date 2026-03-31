# STEP201 Editor BYLAYER Create Defaults Verification

## Scope

This verification covers the current-layer `BYLAYER` create-defaults work completed in Step201:

- shared creation helper for tool-authored entities
- current-layer create contract in unit tests
- browser verification for direct current-layer drawing and fallback drawing

## Commands

### Syntax and contracts

```bash
node --check deps/cadgamefusion/tools/web_viewer/tools/tool_context.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Observed result:

- `tool_context.js` syntax: PASS
- `editor_current_layer_smoke.js` syntax: PASS
- `editor_layer_session_smoke.js` syntax: PASS
- `editor_commands.test.js`: `194/194 PASS`

## Browser Smoke

Commands:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Observed result:

- `editor_current_layer_smoke.js`: PASS
  - artifact: `build/editor_current_layer_smoke/20260323_110927/summary.json`
- `editor_layer_session_smoke.js`: PASS
  - artifact: `build/editor_layer_session_smoke/20260323_110927/summary.json`

Observed browser contract from the artifacts:

- after `laymcur`, the created line:
  - lands on `1:PLOT`
  - color: `#808080`
  - `colorSource: BYLAYER`
- direct creation while current layer is `2:REDLINE`:
  - lands on layer `2`
  - color: `#ff0000`
  - `colorSource: BYLAYER`
- creation after locking current `2:REDLINE` and falling back to `1:PLOT`:
  - lands on layer `1`
  - color: `#808080`
  - `colorSource: BYLAYER`
- creation after `layfrz` fallback:
  - fallback entity `9` is on layer `1`
  - color: `#808080`
  - `colorSource: BYLAYER`
- creation after layer-panel freeze fallback:
  - fallback entity `10` is on layer `1`
  - color: `#808080`
  - `colorSource: BYLAYER`

## Notes

- This step intentionally improves only tool-authored create defaults.
- Direct low-level `entity.create` command calls remain unchanged unless the caller explicitly sets `colorSource`, which keeps command-level tests and import/export contracts narrow and predictable.
- Step200 remains the layer-lock workflow milestone; Step201 is the first step where current-layer fallback also carries visible style provenance instead of only a correct `layerId`.
