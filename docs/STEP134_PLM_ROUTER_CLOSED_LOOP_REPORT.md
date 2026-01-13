# STEP134 PLM Router Closed Loop Report

## Summary
- Added `tools/plm_router_smoke.py` to exercise the router upload → convert → preview URL loop.
- Documented the helper in the web viewer readme for quick local usage.

## Implementation Notes
- Uses standard library `urllib` to send multipart form-data and poll `/status` when async is requested.
- Prints JSON payloads plus the resolved `viewer_url` for quick copy/paste into the web viewer.

## Files Updated
- `tools/plm_router_smoke.py`
- `tools/web_viewer/README.md`
