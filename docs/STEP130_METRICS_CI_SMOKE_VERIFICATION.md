# Step 130: Metrics CI Smoke - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Smoke Script
```bash
tools/plm_error_codes_smoke.sh
```
Observed:
- `plm error code smoke OK`
- `/metrics` includes `cadgf_router_info`, `cadgf_router_uptime_seconds`, `cadgf_router_queue_depth`.

## Metrics Auth On
```bash
CADGF_ROUTER_METRICS_AUTH=1 tools/plm_error_codes_smoke.sh
```
Observed:
- `plm error code smoke OK`
