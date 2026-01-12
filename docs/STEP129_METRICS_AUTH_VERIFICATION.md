# Step 129: Metrics Auth - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Metrics Auth Off
```bash
tools/plm_error_codes_smoke.sh
```
Observed:
- `plm error code smoke OK`

## Metrics Auth On
```bash
CADGF_ROUTER_METRICS_AUTH=1 tools/plm_error_codes_smoke.sh
```
Observed:
- `plm error code smoke OK`

## Manual Check
```bash
ROUTER_PORT=9032 CADGF_ROUTER_METRICS_AUTH=1 python3 tools/plm_router_service.py \
  --port 9032 --auth-token testtoken --metrics-auth

curl -i http://127.0.0.1:9032/metrics
curl -i -H "Authorization: Bearer testtoken" http://127.0.0.1:9032/metrics
```
Expected:
- First request returns 401, second returns 200.
