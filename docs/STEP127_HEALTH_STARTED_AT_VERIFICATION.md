# Step 127: Router Health Started At - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Router Health
```bash
ROUTER_PORT=9028
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root build_vcpkg/plm_service_runs_step127
```

```bash
curl -s "http://127.0.0.1:9028/health"
```
Observed:
- `started_at`, `uptime_seconds`, `version`, `commit`, `build_time`, `hostname`, `pid`, `error_codes` present.

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
