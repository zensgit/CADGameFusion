# STEP93 Local CI Quick + PLM Smoke Verification

## Scope
- Run local quick CI plus PLM smoke check from `tools/local_ci.sh`.

## Command
```bash
RUN_PLM_SMOKE=1 bash tools/local_ci.sh --build-dir build_vcpkg --quick
```

## Results
- Configure/build succeeded (Release).
- Scenes exported: sample, units, complex, scene_complex_spec.
- Validation: OK=4, FAIL=0.
- Structure compare: 0 failures.
- Field compare: 0 failures.
- PLM smoke: OK (convert + annotate returned status=ok).

## Artifacts
- Summary JSON: `build_vcpkg/local_ci_summary.json`
- Log: `build_vcpkg/local_ci_output.log`
- Exports: `build_vcpkg/exports/*`
- PLM runs: `build_vcpkg/plm_service_runs/*`

## Notes
- One warning from stb_image_write about deprecated `sprintf` during build.
