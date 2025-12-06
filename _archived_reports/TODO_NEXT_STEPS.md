TODO Checklist (Resumable)

CI Actions
- [ ] Run strict-exports (quick): use_vcpkg=false, rtol=1e-6
- [ ] Run strict-exports (full): use_vcpkg=true, rtol=1e-6
- [ ] Review artifacts: normalization (Python+C++), schema, structure, field comparisons all passed
- [ ] Make strict-exports a required PR check (optionally add build-tests)

Golden Samples
- [ ] Run Maintenance - Refresh Golden Samples workflow
- [ ] Review diffs; commit updated sample_exports (ensure mesh_group_*.bin and glTF buffer lengths match exporter)
- [ ] Re-run strict-exports (quick + full) after commit to confirm zero drift

Exporter Options
- [ ] Decide default for `--gltf-holes` (outer|full)
- [ ] If switching default to full: refresh goldens, update CI mapping and docs

Tests
- [ ] Add C++ unit test to verify meta.normalize flags (orientation/start/sortRings) are emitted
- [ ] Optional: add deterministic test for triangulation/ordering when CADGF_SORT_RINGS is ON

vcpkg Toolchain
- [ ] Verify full run logs show pinned commit (c9fa965c…) and x-gha cache hits

Docs & DevEx
- [ ] Update README and Troubleshooting for `--gltf-holes`, dual spec formats (rings and flat_pts), normalization policy
- [ ] Add CI badges for strict-exports and build-tests
- [ ] Update PR template with checklist items for trial workflow and golden refresh

Known Follow-ups
- [ ] Regenerate and replace sample_exports binaries to align with updated glTF headers (e.g., scene_sample bin size)

