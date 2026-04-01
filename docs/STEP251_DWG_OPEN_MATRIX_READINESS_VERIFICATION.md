# Step251: DWG Open Matrix Readiness Verification

## Scope

Verify that the current DWG-open business path is green across the promoted real-DWG matrix, not only on a single sample.

## Commands

From repo root:

```bash
python3 deps/cadgamefusion/tools/plm_dwg_open_matrix_smoke.py --outdir deps/cadgamefusion/build/step251_dwg_open_matrix_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. DWG matrix smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_matrix_smoke.py --outdir deps/cadgamefusion/build/step251_dwg_open_matrix_smoke`

- PASS
- fresh artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step251_dwg_open_matrix_smoke/20260325_151951/summary.json`

Key verified facts:

- `case_count = 44`
- `pass_count = 44`
- `fail_count = 0`
- `validator_ok_count = 88`
- `dwg_convert_ok_count = 44`
- `router_ok_count = 44`
- `convert_ok_count = 44`
- `viewer_ok_count = 44`
- `first_failed_case = ""`
- every case completed with `attempt_count = 1`

Representative cases from the same run:

- light case:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step251_dwg_open_matrix_smoke/20260325_151951/cases/layout_blank/attempt_01/20260325_231951/summary.json`
  - verifies a minimal layout-oriented DWG still completes `dwg_convert -> router -> viewer -> validators`
- dense case:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step251_dwg_open_matrix_smoke/20260325_151951/cases/carrier_wheel_v2/attempt_01/20260325_232239/summary.json`
  - verifies a heavier preview still reaches `viewer_status=200` and validator pass

This matters because Step251 is no longer an anecdotal "one drawing opens" claim.
It is a corpus-level proof that the current DWG-open path is stable across the promoted 44-case business sample set.

### 2. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step251 is verified because the promoted 44-case real-DWG matrix passed `44/44`, with router, convert, viewer, and validator checks all green. Combined with Step250 desktop direct-plugin proof, this is enough to say that as of `2026-03-25` the repo can already open DWG normally on a configured development machine.
