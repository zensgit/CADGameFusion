# Step 125: Router Health Metadata - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Router Health
```bash
ROUTER_PORT=9026
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root build_vcpkg/plm_service_runs_step125
```

```bash
curl -s "http://127.0.0.1:9026/health"
```
Observed:
- `version`, `commit`, `uptime_seconds`, `error_codes` present.

## Web Demo
Open:
- `http://127.0.0.1:9026/tools/plm_web_demo/`

Expected:
- Router info panel shows Version, Commit, Uptime, Default convert_cli, Error codes.

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
