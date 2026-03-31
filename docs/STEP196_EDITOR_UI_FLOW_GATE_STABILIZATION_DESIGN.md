# STEP196 Editor UI Flow Gate Stabilization Design

## Background

By Step195, the editor had already closed several benchmark-sized product gaps:

- fillet/chamfer preselection and curve-pair behavior
- layer focus vs current layer separation
- `laymcur` style current-layer workflow
- layer-aware property/selection summaries

The remaining drag on iteration speed was no longer product capability. It was the browser gate itself.

`editor_ui_flow_smoke.sh` had drifted into a mixed mode:

- some steps protected real interaction contracts
- some later steps protected geometry semantics
- some failures were caused by stale screen picks, implicit selection state, or summary parsing bugs

That made the gate noisy in exactly the place where it should be strict.

## Benchmark Reading

Against `AutoCAD` / `BricsCAD` / `LibreCAD`, users judge the product by:

1. whether the edit command does the right thing
2. whether failure is explainable and recoverable
3. whether follow-up commands continue to work without hidden state corruption

They do **not** care whether our internal smoke used one pixel path or another.

So the correct “surpass benchmark” move is:

- keep real browser interaction coverage where it verifies a unique UX contract
- move late-stage geometry/history assertions onto deterministic command-surface checks
- expose minimal debug hooks so the browser smoke can verify editor state directly instead of scraping fragile incidental behavior

This is stricter than many reference projects because it separates:

- UI behavior regressions
- geometry/command regressions
- test harness regressions

## Product Goal

Make `editor_ui_flow_smoke.sh` a trustworthy gate again:

1. no false red from selection-summary parsing bugs
2. no false red from stale preselection or stale canvas coordinates
3. polyline trim/extend failure-continuation behavior verified deterministically
4. endpoint snap assertion validated against the actual workspace snap resolver
5. summary artifacts stay useful for triage even when the gate fails

## Non-goals

- do not weaken coverage by deleting interaction scenarios entirely
- do not rewrite the whole smoke runner into a new framework
- do not move core command semantics out of `command_registry.js`
- do not broaden browser debug hooks into public API

## Design

### 1. Fix gate-level parsing bugs first

`editor_ui_flow_smoke.sh` had multiple regexes that accidentally matched escaped parentheses instead of the actual selection summary format.

That produced fake timeouts even when the UI already showed `1 selected (line)`.

Those parsing helpers must match the real summary text before any later smoke result is trustworthy.

### 2. Keep browser UI coverage where it adds unique value

These steps remain meaningful as browser interaction tests:

- toggle hotkeys and toolbar toggles
- grip hover and grip lifecycle
- layer panel/current-layer workflow
- line/polyline creation interaction
- line-based trim/extend boundary persistence

These are the places where pointer routing, keyboard handling, toolbar state, and status messaging matter.

### 3. Move late polyline trim/extend semantics to command-surface validation

Several late smoke failures were not product regressions. They came from:

- ambiguous pick points
- preselection drift
- boundary clicks that were only testing the smoke harness

For polyline trim/extend steps, the real contract is:

- failure returns stable error code
- next valid operation still succeeds
- geometry ends up at the correct boundary/intersection
- undo/redo replays only the last successful operation

That should be verified by `window.__cadDebug.runCommand(...)` plus geometry reads, not by repeated pixel guessing.

### 4. Add minimal debug hooks for deterministic state control

New debug hooks are intentionally narrow:

- `setSelection(ids, primaryId)`
- `screenToWorld(point)`
- `resolveSnappedPoint(point, opts)`

These hooks let the browser smoke:

- force selection state without synthetic selection clicks
- convert near-canvas offsets into exact world queries
- verify the active workspace snap resolver directly

They are internal-only and enabled only under `?debug=1`.

### 5. Endpoint snap should assert resolver truth, not a brittle second line creation path

For the endpoint snap slice, the stable contract is:

- snap toggles/hotkeys wire up correctly
- endpoint snap is enabled
- a near-endpoint query resolves to the line endpoint with kind `END`

The line tool itself already uses `toolContext.resolveSnappedPoint(...)`.

So when the browser gate verifies the live workspace resolver returns `END` at the correct point, it is testing the actual snap contract more directly than a flaky second synthetic line click.

## Files

- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/tests/editor_commands.test.js`

## Acceptance Criteria

- selection-summary parsing in the gate matches current UI text
- polyline trim failure-continue step is deterministic
- polyline extend endpoint and failure-continue steps are deterministic
- browser smoke can explicitly control debug selection when needed
- browser smoke can inspect live snap resolution in the active workspace
- verification artifacts clearly show the latest real blocker when the gate is still red
