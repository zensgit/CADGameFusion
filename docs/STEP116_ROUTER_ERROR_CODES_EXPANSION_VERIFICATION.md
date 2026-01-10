# Step 116: Router Error Codes Expansion - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router (Auth Enabled)
```bash
ROUTER_PORT=9021
OUT_DIR=build_vcpkg/plm_service_runs_step116
mkdir -p "$OUT_DIR"
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root "$OUT_DIR" --auth-token testtoken
```

## Unauthorized (GET /projects)
```bash
curl -s "http://127.0.0.1:9021/projects"
```
Observed:
- `status` = `error`
- `error_code` = `AUTH_REQUIRED`

## Missing Task (GET /status/{id})
```bash
curl -s -H "Authorization: Bearer testtoken" \
  "http://127.0.0.1:9021/status/not-a-task"
```
Observed:
- `status` = `error`
- `error_code` = `TASK_NOT_FOUND`

## Missing Plugin (POST /convert)
```bash
curl -s -X POST "http://127.0.0.1:9021/convert" \
  -H "Authorization: Bearer testtoken" \
  -F "file=@README.md"
```
Observed:
- `status` = `error`
- `error_code` = `MISSING_PLUGIN`

## Shutdown
```bash
kill <router_pid>
```
