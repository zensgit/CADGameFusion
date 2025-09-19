# Exporter v0.3.0 Roadmap (Design Skeleton)

Status: Draft
Owner: @zensgit
Target: v0.3.0

## 1. Goals
- Richer downstream integration while preserving backward compatibility
- Clear, documented evolution of JSON + glTF outputs (minimal breakage)
- Deterministic, validated outputs with strict CI guards

## 2. Scope
- Multi‑mesh segmentation (per group / per ring classification)
- Material/metadata stubs (mapping groups → default materials)
- Optional normals/UV placeholders (safe flat defaults)
- Precision/scaling policy (float32 vs optional quantization)
- Extended meta fields (pipelineVersion, source, exportTime)

Out of scope (v0.3.0):
- Complex materials or PBR graphs
- Full mesh topology changes requiring golden overhaul without design sign‑off

## 3. Backward Compatibility
- JSON: Additive fields only; legacy consumers may ignore unknown keys
- glTF: Keep existing accessors; add optional buffers/accessors guarded by flags
- Provide migration notes and versioned meta: `meta.pipelineVersion`

## 4. JSON/glTF Shape Proposals
### 4.1 JSON additions
- `meta.pipelineVersion: "0.3.0"`
- `meta.source: "cli|qt|unity"`
- `meta.exportTime: ISO8601 UTC`
- `materials: [{ id, name, color? }]` (optional)
- `groups[*].materialId` or top‑level mapping

### 4.2 glTF additions (optional)
- Add normals accessor (all (0,0,1) for flat geometry)
- Add UV accessor (all (0,0))
- Node extras/meta: `{ "groupId": N, "materialId": M }`

Guard via flags:
- `--emit-normals`, `--emit-uvs`, `--emit-materials-stub`

## 5. Multi‑Mesh Segmentation
Options:
- Per ring → separate primitive
- Per role (outer vs holes) → grouped primitives
- Per logical group → single mesh with multiple primitives

Decision criteria:
- Consumer expectations, draw calls (minimize), semantic clarity
- Keep default as current single‑mesh; add opt‑in flags for segmentation

## 6. Precision & Scaling
- Keep float32 positions; document unit scaling policy
- Optional quantization (future): gated behind `--quantize` with strict CI validation

## 7. Validation & CI
- Extend field‑level comparisons to account for new accessors/material stubs (counts‑only checks when appropriate)
- Schema updates for new JSON fields (materials/meta)
- New tests:
  - C++: presence/types of new meta and material mappings
  - Python: schema validation for extended JSON
  - Optional: normals/UVs structural checks
- Trial workflow(s) for opt‑in features; not required gates until stabilized

## 8. Migration & Goldens
- Keep default behavior identical to v0.2.x for strict gates
- Introduce new features behind flags → trial workflows
- Once adopted, refresh goldens + tag new baseline (ci‑baseline‑YYYY‑MM‑DD)

## 9. Risks & Mitigations
- Risk: Golden churn → use flags + trial workflows first
- Risk: Consumer breakage → additive changes + docs + deprecation grace
- Risk: CI time growth → keep Quick Check minimal; strict gates selective

## 10. Acceptance Criteria
- Docs: README + Release Notes + verification report updated
- Tests: New unit/integration tests passing on Linux/macOS; Windows non‑blocking until stable
- CI: Strict workflows green; trial workflows demonstrate new features
- No regressions in existing strict validations

## 11. Task Breakdown (Initial)
- [ ] Design sign‑off (this doc)
- [ ] JSON schema update for materials/meta
- [ ] CLI flags for normals/uvs/material stubs
- [ ] glTF writer: optional normals/uvs accessors
- [ ] JSON writer: materials + mapping
- [ ] Tests: C++ (meta/materials), Python (schema)
- [ ] Trial workflows for new flags
- [ ] Docs & Release Notes

## 12. Timeline (Tentative)
- Week 1: Design/flags/schema
- Week 2: Writers (JSON/glTF) + unit tests
- Week 3: Trial workflows + docs
- Week 4: Review → decide on goldens/strict adoption windows

