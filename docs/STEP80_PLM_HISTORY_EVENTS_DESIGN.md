# Step 80: PLM History Event Types - Design

## Goal
Expose an explicit `event` type on history entries so clients can distinguish conversions from annotations.

## Router changes
- Default history entries to `event: "convert"`.
- Normalize missing/invalid event fields to `"convert"`.

## Web demo changes
- Show the event field in history cards and document version cards.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/app.js`
- `docs/STEP80_PLM_HISTORY_EVENTS_DESIGN.md`
- `docs/STEP80_PLM_HISTORY_EVENTS_VERIFICATION.md`
