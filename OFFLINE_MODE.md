# Offline & Subset Validation Guide

This guide explains how to run the export + validation toolchain locally in constrained or iterative scenarios
without executing the full strict comparison pipeline.

## 1. Quick Offline Fast Path

Minimal build + export + basic validation (no schema, no structure/field comparisons):
```bash
bash tools/local_ci.sh --offline --skip-compare --clean-exports --scenes sample --summary-json
```
Expected tail output contains:
```
[LOCAL-CI] OFFLINE_FAST_OK (exports + basic validate only)
```

Artifacts:
- `build/exports/scene_cli_<scene>` exported scene(s)
- `build/consistency_stats.txt` basic stats (one line per validated scene)
- `build/local_ci_summary.json` machine‑readable run summary

## 2. Key Flags (tools/local_ci.sh)

| Flag | Purpose | Typical Use |
|------|---------|-------------|
| `--offline` | Skip pip + schema validation | Air‑gapped / restricted network |
| `--skip-compare` | Skip structure + field comparisons | Pure geometry smoke test |
| `--no-fields` | Skip field comparisons only | Structure only check |
| `--no-struct-compare` | Skip structure compare only | Field numeric only diff |
| `--scenes a,b` | Restrict to subset scenes/specs | Faster iteration |
| `--quick` | Use `quick=` list from `tools/ci_scenes.conf` | One‑command small subset |
| `--clean-exports` | Remove previous exports before run | Avoid stale dirs |
| `--summary-json` | Emit JSON summary | Automation / dashboards |
| `--rtol <v>` | Field comparison tolerance | Tighten/relax numeric diff |

Scenes specified can include spec-based names (ending in `_spec`). The script automatically maps them to
`tools/specs/<name>.json` when present.

## 3. Interpreting local_ci_summary.json

Example:
```json
{
  "buildType": "Release",
  "rtol": "1e-6",
  "offline": true,
  "skipCompare": true,
  "skipFields": true,
  "skipStruct": true,
  "validationOkCount": 1,
  "validationFailCount": 0,
  "scenes": ["sample"],
  "missingScenes": [],
  "timestamp": "2025-10-09T02:18:14Z"
}
```
Notes:
- `validationOkCount` / `validationFailCount` come from basic directory validation (not field comparisons when skipped).
- `missingScenes` lists requested scenes with no stats line (export or validate skipped).

## 4. Re‑verifying Field Tolerances

Use after a full (or partial) export to experiment with numeric tolerances without rebuilding:
```bash
# Single tolerance
bash tools/reverify_fields.sh --scenes sample,complex --rtol 1e-6 --summary-json

# Multiple tolerances
bash tools/reverify_fields.sh --scenes sample,complex --rtol-set 1e-6,1e-5,5e-5 --summary-json
```
Output: `build/reverify_summary.json` (example):
```json
{
  "rtolSet": "1e-6,1e-5",
  "results": [
    { "scene": "sample",  "rtol": "1e-6", "status": "passed", "skipped": false },
    { "scene": "sample",  "rtol": "1e-5", "status": "passed", "skipped": false },
    { "scene": "complex", "rtol": "1e-6", "status": "skipped_export_missing", "skipped": true }
  ],
  "missingScenes": ["complex"],
  "totalCompared": 2,
  "totalSkipped": 1,
  "failCount": 0
}
```
Status meanings:
- `passed` – Field comparison succeeded under given tolerance.
- `failed` – Comparison script returned non‑zero.
- `skipped_export_missing` / `skipped_ref_missing` – Required directory absent.
- `unknown` – JSON lacked a `status` key (unexpected; treat as investigate).

### Strict missing handling
Add `--fail-on-missing` to count skipped scenes as failures (raises `failCount`).

## 5. Typical Workflows

### A. Fast geometry sanity (single sample scene)
```bash
bash tools/local_ci.sh --offline --skip-compare --scenes sample --clean-exports --summary-json
```

### B. Focused numeric diff on two scenes
```bash
bash tools/local_ci.sh --scenes sample,complex --no-struct-compare --summary-json
```

### B2. Quick subset (from config)
```bash
bash tools/local_ci.sh --offline --quick --clean-exports --summary-json
```

### C. Iterate export code then re‑tune tolerances
```bash
# First run (full compare on subset)
bash tools/local_ci.sh --scenes sample,complex --clean-exports --summary-json
# Adjust tolerance candidates
bash tools/reverify_fields.sh --scenes sample,complex --rtol-set 1e-6,2e-6,5e-6 --summary-json
```

### D. Strict subset gate (fail if any missing)
```bash
bash tools/local_ci.sh --scenes sample,complex --clean-exports --summary-json
bash tools/reverify_fields.sh --scenes sample,complex --rtol 1e-6 --summary-json --fail-on-missing
jq '.failCount' build/reverify_summary.json # expect 0
```

## 6. Troubleshooting
| Symptom | Cause | Action |
|---------|-------|--------|
| `skipped_export_missing` | Scene not exported in this run | Re-run with `--clean-exports` & include scene in `--scenes` |
| Stats file empty | All scenes skipped or export failed early | Check earlier `[WARN]` lines; ensure scene names correct |
| No `status` in field JSON | compare_fields output schema changed | Open file, adjust grep in scripts if needed |
| Qt JSON compile errors | Qt headers not fully available | Fallback now auto-uses nlohmann; ensure rebuild after patch |

## 7. Notes
- Subset runs intentionally ignore historical export directories when `--clean-exports` is used.
- Added scenes/specs can be centralized by editing `tools/ci_scenes.conf`.
- For automation, parse only JSON summaries; avoid relying on console formatting.

---
Last updated: $(date -u '+%Y-%m-%d %H:%M:%SZ')
