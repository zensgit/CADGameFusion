# Step 81: PLM History Event Filter - Design

## Goal
Filter `/history` by event type (e.g., convert vs annotation) and expose the filter in the web demo.

## Router changes
- `GET /history` accepts `event=convert|annotation`.
- History listing filters by `event` when provided.

## Web demo changes
- Add an Event filter in the history panel.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `docs/STEP81_PLM_HISTORY_EVENT_FILTER_DESIGN.md`
- `docs/STEP81_PLM_HISTORY_EVENT_FILTER_VERIFICATION.md`
