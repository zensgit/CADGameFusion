# Local CI Verification Report (Template)

Use this template to capture results from running local strict validation.

1) How to run
- Build + refresh goldens (full topology):
  - cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF -DCADGF_USE_NLOHMANN_JSON=ON -DCADGF_SORT_RINGS=ON -G Ninja
  - cmake --build build --target export_cli -j
  - bash tools/refresh_golden_samples.sh
- Local CI (strict gates):
  - bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full

2) Run context
- Date:
- OS / Arch:
- Compiler:
- CMake generator:
- CADGF_USE_NLOHMANN_JSON: ON
- CADGF_SORT_RINGS: ON

3) Exporter flags
- glTF holes mode: full
- Scenes generated: sample, holes, multi, units, complex, specs (concave, nested_holes)

4) Summary (overall status)
- Normalization (Python): PASSED / FAILED
- Normalization (C++): PASSED / FAILED
- Schema validation: PASSED / FAILED
- Structure compare (critical scenes): PASSED / FAILED
- Field-level compare (full + meta): PASSED / FAILED

5) Normalization checks output (paste)
```
<output from tools/test_normalization.py and test_normalization_cpp>
```

6) Schema validation output (paste)
```
<selected lines from validate_export.py runs>
```

7) Structure comparison notes
- Any mismatches and scenes impacted:

8) Field-level reports (paste JSON excerpts)
- build/field_sample.json: status/errors summary
- build/field_holes.json: status/errors summary
- build/field_complex.json: status/errors summary
- build/field_spec_complex.json: status/errors summary
- build/field_concave.json: status/errors summary
- build/field_nested_holes.json: status/errors summary
- build/field_units.json: status/errors summary (allowed glTF mismatch)
- build/field_multi.json: status/errors summary (allowed glTF mismatch)

9) Consistency stats (paste key lines)
- build/consistency_stats.txt
```
<stats excerpt>
```

10) Diffs to goldens (if any)
- Files changed under sample_exports/...
- Rationale (normalization/glTF full topology refresh/etc.)

11) Next actions
- [ ] Commit refreshed sample_exports
- [ ] Re-run local CI after commit
- [ ] Run strict exports CI (use_vcpkg=false, then true)
- [ ] If green, make strict-exports required

Notes
- If any failures remain, check README Contributing / PR Checklist and docs/Troubleshooting.md
- Inspect artifacts under build/ (field_*.json, consistency_stats.txt)
