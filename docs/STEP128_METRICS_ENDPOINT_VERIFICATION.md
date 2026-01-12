# Step 128: Metrics Endpoint - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Metrics Endpoint
```bash
ROUTER_PORT=9029
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root build_vcpkg/plm_service_runs_step128
```

```bash
curl -s "http://127.0.0.1:9029/metrics" | head -n 20
```
Observed:
- Prometheus text output with `cadgf_router_info`, `cadgf_router_uptime_seconds`, `cadgf_router_queue_depth`.

## Smoke Script
```bash
tools/plm_error_codes_smoke.sh
```
Observed:
- `plm error code smoke OK`

## Shutdown
```bash
kill <router_pid>
```
