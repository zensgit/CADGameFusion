CADGameFusion – Developer Overview
=================================

This repository contains the CADGameFusion core, export tooling, and auxiliary scripts
for validation, CI parity, and offline iteration.

Quick Links
-----------
- Offline / Subset Validation Guide: `OFFLINE_MODE.md`
- Manual Qt Editor Test Guide: `MANUAL_TEST_GUIDE.md`
- One‑Command Quick Check: `tools/quick_check.sh` or `make quick`/`make strict`

Fast Start (Export & Validate)
------------------------------
```
# Fast offline smoke (single sample scene)
bash tools/local_ci.sh --offline --skip-compare --scenes sample --clean-exports --summary-json
cat build/local_ci_summary.json
```

Quick Subset
------------
```
# Use quick scene set from tools/ci_scenes.conf
bash tools/local_ci.sh --offline --quick --clean-exports --summary-json
```

One-Command Health Check
------------------------
```
# Offline quick subset + health check (allow offline)
bash tools/local_ci.sh --offline --quick --clean-exports --summary-json && \
  bash tools/check_local_summary.sh --offline-allowed

# Strict exit (non-offline) with summary check
bash tools/local_ci.sh --quick --clean-exports --summary-json --strict-exit && \
  bash tools/check_local_summary.sh
```

Reverify Field Tolerances
-------------------------
```
bash tools/reverify_fields.sh --scenes sample,complex --rtol-set 1e-6,1e-5 --summary-json
cat build/reverify_summary.json
```

Directory Highlights
--------------------
Path | Purpose
---- | -------
core/ | Core geometry & serialization logic
tools/export_cli.cpp | Main scene/spec export binary
tools/local_ci.sh | Local CI parity + flexible subset runner
tools/reverify_fields.sh | Post-export tolerance experiments
tools/ci_scenes.conf | Central scene/spec list configuration
tools/quick_check.sh | One-command subset run + health check
tools/check_local_summary.sh | Quick health checker for build/local_ci_summary.json
tools/setup_hooks.sh | Install pre-push hook for strict quick check
sample_exports/ | Baseline reference exports for comparisons
schemas/ or docs/schemas/ | JSON schema definitions (if present)

Strict vs Offline Modes
-----------------------
- Strict: full structure + field comparisons (default when not skipping) for all configured scenes.
- Offline: skip pip & schema; optionally skip all comparisons to just confirm export health.

Adding a New Scene
------------------
1. Add implementation/spec as needed (e.g. under `tools/specs/`).
2. Update `tools/ci_scenes.conf` required list.
3. Run `tools/local_ci.sh --scenes new_scene --clean-exports` to validate.
4. Add baseline under `sample_exports/scene_new_scene` if it should participate in strict diffs.

Notes
-----
- `--quick` flag consumes the `quick=` list in `tools/ci_scenes.conf` to run a smaller, faster subset.

Make Targets
------------
- `make quick` – Offline quick subset health check (uses `tools/quick_check.sh`).
- `make strict` – Strict quick subset health check (non‑offline, fails on issues).

Git Hooks
--------
- Install pre‑push hook to run strict quick check automatically:
  - `bash tools/setup_hooks.sh`
  - Hook source: `tools/git-hooks/pre-push.example`

Summary JSON Fields (local_ci)
------------------------------
Field | Meaning
----- | -------
validationOkCount | Basic directory validations passed
validationFailCount | Basic validations failed
missingScenes | Requested but not validated scenes
skipCompare / skipFields / skipStruct | Comparison phase skip flags

Fallback JSON Parsing
---------------------
`core/src/serialize_v2.cpp` attempts Qt JSON → nlohmann/json → legacy parser. This allows offline builds
without full Qt JSON headers.

Contributing
------------
- Keep tooling changes minimal & additive.
- Update `OFFLINE_MODE.md` if introducing new workflow flags.

License
-------
Internal / project specific (add details if needed).
