# Step 118: Web Demo Annotation Error UI - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router
```bash
ROUTER_PORT=9022
OUT_DIR=build_vcpkg/plm_service_runs_step118
mkdir -p "$OUT_DIR"
python3 tools/plm_router_service.py --port "$ROUTER_PORT" --out-root "$OUT_DIR"
```

## Annotation Error Response
```bash
curl -s -X POST "http://127.0.0.1:9022/annotate" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample"}'
```
Observed:
- `status` = `error`
- `error_code` = `MISSING_ANNOTATIONS`

## UI Check (Manual)
Open:
- `http://127.0.0.1:9022/tools/plm_web_demo/`

Expected:
- When posting annotations without text, the annotation section shows a red error line with the code.

## Shutdown
```bash
kill <router_pid>
```
