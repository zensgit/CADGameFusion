# STEP191 Editor Selection Quicklook Verification

## Scope

This verification closes the editor-side single-selection quicklook contract introduced in Step191:

- shared selection presentation helper
- richer `#cad-selection-details` browser surface
- stable `data-selection-field` / `data-selection-badge` hooks
- imported color provenance promotion reflected in quicklook after property edits

## Static checks

Executed from `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/scripts/editor_selection_summary_smoke.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
git diff --check
```

Result: PASS.

## Node regression

Executed:

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

Result: `171 / 171 PASS`.

Newly protected areas include:

- compact selection contract formatting
- single-selection quicklook badges/facts
- shared status formatting for multi-select with read-only entities

## Browser verification

Executed a targeted real-browser smoke against the imported fixture path:

```bash
node tools/web_viewer/scripts/editor_selection_summary_smoke.js --base-url http://127.0.0.1:8125/
```

Artifact:

- `build/editor_selection_summary_smoke/20260322_151754/summary.json`

Result: PASS.

Observed browser facts before property edit:

- `mode = single`
- `primaryType = line`
- `origin-caption = INSERT / fragment`
- `origin = INSERT / fragment`
- `effective-color = #808080`
- `color-source = BYLAYER`
- `color-aci = 8`
- `space = Paper`
- `layout = Layout-A`
- `line-type = HIDDEN2`
- `line-weight = 0.55`
- `line-type-scale = 1.7`
- badges:
  - `type = line`
  - `space = Paper`
  - `layout = Layout-A`
  - `color-source = BYLAYER`

Observed after editing `Layer ID`:

- quicklook `color-source` changed to `TRUECOLOR`
- quicklook badges changed to `color-source = TRUECOLOR`
- selected entity became:
  - `layerId = 2`
  - `color = #808080`
  - `colorSource = TRUECOLOR`

Browser diagnostics:

- `console_messages = []`
- `page_errors = []`

## Notes

- The large `editor_ui_flow_smoke.sh` contract was updated to consume the new quicklook DOM surface and passes shell syntax validation.
- Full `editor_ui_flow_smoke.sh` was not used as the primary verification path for this step because that flow still has unrelated historical instability later in the run (`snap_kinds_extra`). Step191 verification therefore uses the dedicated imported-fixture smoke that directly exercises the changed product surface.
