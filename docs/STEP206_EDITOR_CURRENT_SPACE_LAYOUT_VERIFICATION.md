# STEP206 Editor Current Space/Layout Verification

## Scope

This verification covers Step206's current `space / layout` session closure:

- the editor now resolves and stores an active current session
- render and hit-test filter to that session
- drafted entities inherit the active `space / layout`
- status bar, command bar, and no-selection property panel can switch sessions
- existing drafting smokes still behave correctly after current-session inheritance was added to debug fallback paths

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `206/206 PASS`

Relevant coverage added or extended in:

- `create tools use current layer for new entities`
  - now also asserts drafted entities inherit `space = 1` / `layout = Layout-A` when the harness current session is paper-space
- `resolveCurrentSpaceLayoutContext prefers model when available and falls back to paper layouts`
  - locks session resolution rules for mixed model/paper documents
- `document state current space/layout filters renderable entities`
  - locks render/query filtering to the active session

### 2. Syntax / diff hygiene

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/space_layout.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_space_layout_smoke.js
git -C deps/cadgamefusion diff --check
```

Result:

- all passed

## Browser Smoke Verification

### 1. New current space/layout smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_space_layout_smoke.js
```

Artifact:

- [summary.json](../build/editor_space_layout_smoke/20260323_145101/summary.json)

Key assertions from the artifact:

- initial import resolves:
  - `Space: Model`
  - visible entity ids = `[1]`
  - discovered paper layouts = `Layout-A`, `Layout-B`
- after `layout Layout-A`:
  - status becomes `Space: Paper / Layout-A`
  - visible entity ids = `[2]`
  - property panel exposes `Use Model Space` and the remaining paper layout action
- created line in `Layout-A` stores:
  - `space = 1`
  - `layout = Layout-A`
- selection facts for that new entity show:
  - `Space = Paper`
  - `Layout = Layout-A`
- after property-panel switch to `Layout-B`:
  - visible entity ids = `[3]`
  - created line stores `space = 1`, `layout = Layout-B`
- after `Use Model Space`:
  - status returns to `Space: Model`
  - visible entity ids = `[1]`
  - created model line stores `space = 0`, `layout = Model`

This is the primary Step206 proof: visibility, picking, and creation all follow the same current-session contract.

### 2. Selection summary smoke regression

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- [summary.json](../build/editor_selection_summary_smoke/20260323_145101/summary.json)

Result:

- passed unchanged on top of Step206

This confirms imported paper-space provenance still renders correctly after render/query filtering moved into `DocumentState`.

### 3. Current-layer smoke regression

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- [summary.json](../build/editor_current_layer_smoke/20260323_145101/summary.json)

Result:

- passed

This confirms current-layer creation still works when browser fallback creation now also inherits current `space / layout`.

### 4. Layer-session smoke regression

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Artifact:

- [summary.json](../build/editor_layer_session_smoke/20260323_145101/summary.json)

Result:

- passed

This confirms lock/freeze fallback drafting still preserves the current session instead of silently reverting to model-space metadata.

## Result

Step206 is verified as green:

- unit/integration suite passed
- new current space/layout browser smoke passed
- selection-summary, current-layer, and layer-session browser regressions all passed

The editor now treats `space / layout` as an actual drafting session, not just imported provenance, which is a material benchmark-quality improvement for mixed model/paper drawings.
