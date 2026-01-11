# Step 115: Router Error Codes for /convert - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router
```bash
ROUTER_PORT=9020
OUT_DIR=build_vcpkg/plm_service_runs_step115
mkdir -p "$OUT_DIR"
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root "$OUT_DIR"
```

## Missing Plugin Error
```bash
curl -s -X POST "http://127.0.0.1:9020/convert" -F "file=@README.md"
```
Observed:
- `status` = `error`
- `message` = `missing plugin`
- `error_code` = `MISSING_PLUGIN`

## Shutdown
```bash
kill <router_pid>
```
