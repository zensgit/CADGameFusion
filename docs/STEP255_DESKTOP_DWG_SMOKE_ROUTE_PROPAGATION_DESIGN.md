# Step255: Desktop DWG Smoke Route Propagation Design

## Goal

Make the real desktop DWG smoke prove the same route contract that the live desktop workflow already consumes.

## Problem

After Step254, two separate truths existed:

- the live desktop viewer could show the actual DWG route used by `Open CAD File`
- the real Electron `--smoke-dwg` summary still exposed route facts only under `prepared`

That left a small but real gap in the evidence chain. The smoke could prove that the open plan chose
`direct-plugin`, but not that the final successful convert result preserved the same route/plugin facts.

## Contract

### 1. Smoke-mode convert result carries route facts

`maybeRunSmokeDwgMode()` now applies the same `attachDwgOpenFacts(...)` merge used by
`vemcad:open-cad-file` before writing `summary.convert`.

Protected fields:

- `route`
- `dwg_plugin_path`
- `router_plugin`

### 2. Python smoke validates route continuity

`tools/plm_dwg_open_desktop_smoke.py` now adds a dedicated `route_contract` validator.

It checks:

- `convert.route == prepared.route`
- for `direct-plugin`, `convert.dwg_plugin_path == prepared.dwg_plugin_path`

This moves route propagation into the same artifact-first verification lane as preview and manifest validation.

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/plm_dwg_open_desktop_smoke.py`

## Non-Goals

Step255 does not:

- change route selection policy
- change DWG import geometry behavior
- change live viewer UI or desktop settings UX
- replace the wider DWG matrix proof from Step251

## Acceptance

Step255 is complete when:

- real desktop smoke `summary.convert` includes route/plugin facts
- Python smoke fails if those facts drift away from `prepared`
- artifacts prove route continuity without manual log inspection
