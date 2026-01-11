# Step 120: Error Code Smoke in CI - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Local Smoke
```bash
tools/plm_error_codes_smoke.sh
```

Observed:
- `plm error code smoke OK`

## CI
- Workflow: `Quick Check - Verification + Lint`
- Step: `Router error code smoke`
