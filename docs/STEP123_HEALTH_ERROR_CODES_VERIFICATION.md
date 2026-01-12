# Step 123: Router Health Error Codes - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Router Health
```bash
ROUTER_PORT=9025
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root build_vcpkg/plm_service_runs_step123
```

```bash
curl -s "http://127.0.0.1:9025/health"
```
Observed:
- `error_codes` array present.

## Web Demo
Open:
- `http://127.0.0.1:9025/tools/plm_web_demo/`

Expected:
- Router info panel shows a comma-separated list of error codes.

## Docs
- `docs/API.md` contains an error-code table.

## Shutdown
```bash
kill <router_pid>
```
