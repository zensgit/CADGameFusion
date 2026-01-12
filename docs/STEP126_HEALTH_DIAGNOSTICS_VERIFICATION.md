# Step 126: Router Health Diagnostics - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Router Health
```bash
ROUTER_PORT=9027
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root build_vcpkg/plm_service_runs_step126
```

```bash
curl -s "http://127.0.0.1:9027/health"
```
Observed:
- `build_time`, `hostname`, `pid`, `version`, `commit`, `uptime_seconds`, `error_codes` present.

## Web Demo
Open:
- `http://127.0.0.1:9027/tools/plm_web_demo/`

Expected:
- Router info panel shows Build time, Host, PID, and refreshes every 60s.
- Router card border highlights error/unreachable states.

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
