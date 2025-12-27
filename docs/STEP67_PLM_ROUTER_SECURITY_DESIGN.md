# Step 67: PLM Router Security - Design

## Goal
Add a minimal security/guardrail layer to the PLM router service.

## Controls
- **Auth token**: `Authorization: Bearer <token>` when `--auth-token` or `CADGF_ROUTER_AUTH_TOKEN` is set.
- **CORS allowlist**: `--cors-origins` or `CADGF_ROUTER_CORS_ORIGINS`.
- **Upload limit**: `--max-bytes` or `CADGF_ROUTER_MAX_BYTES`.
- **Path allowlists**: `--plugin-allowlist` / `--cli-allowlist` (or env equivalents).

## Behavior
- `POST /convert` and `GET /status/<id>` require auth when configured.
- `OPTIONS` responds to preflight and includes CORS headers.
- Disallowed plugins/convert_cli paths return 403.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/README.md`
- `docs/STEP67_PLM_ROUTER_SECURITY_DESIGN.md`
- `docs/STEP67_PLM_ROUTER_SECURITY_VERIFICATION.md`
