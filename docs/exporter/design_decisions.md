# Exporter v0.3.0 – Design Decisions Log

Status: Draft
Owner: @zensgit
Related: docs/exporter/roadmap_v0_3_0.md

## Purpose
Track decisions, alternatives, and rationale for the v0.3.0 exporter work. Keep entries short and actionable. Link to PRs/issues.

## Decision Entries

### D1: Backward compatibility policy
- Decision: Default behavior remains identical to v0.2.x; new features are opt‑in via flags.
- Rationale: Avoid golden churn and downstream breakage.
- Alternatives: Flip defaults and refresh goldens (rejected for now).
- Follow‑ups: Trial workflows; document migration.

### D2: JSON meta extensions
- Decision: Add meta.pipelineVersion, meta.source, meta.exportTime (optional, informational).
- Rationale: Improve traceability and downstream processing.
- Alternatives: Single combined version field (rejected – less explicit).
- Follow‑ups: Schema update; unit tests; docs.

### D3: Materials stub
- Decision: Introduce optional materials array and per‑group materialId mapping.
- Rationale: Prepare for future material workflows without committing to PBR.
- Alternatives: Full PBR schema now (rejected – scope creep).
- Follow‑ups: Schema shape; counts‑only comparisons for affected scenes.

### D4: Optional normals/UVs
- Decision: Provide flat normals (0,0,1) and UVs (0,0) behind flags; keep POSITION as is.
- Rationale: Enable simple shading/engine ingestion while preserving defaults.
- Alternatives: Always emit (rejected – affects goldens and perf).
- Follow‑ups: glTF writer changes; field/structure checks.

### D5: Multi‑mesh segmentation
- Decision: Keep single‑mesh default; add opt‑in segmentation strategies (per‑ring/per‑role) for trials.
- Rationale: Control draw call count and keep semantics clear per consumer.
- Alternatives: Force segmentation (rejected – breaks consumers and goldens).
- Follow‑ups: Trial workflows; consumer feedback.

## Open Questions
- Q1: Do we need per‑scene material palettes or global palette?
- Q2: Should pipelineVersion reflect exporter binary version or spec version?
- Q3: What trial metrics decide promotion to strict gates?

## References
- Roadmap: docs/exporter/roadmap_v0_3_0.md
- Issues: (to be populated when created)

## Change Log
- 2025‑09‑19: Initial draft created.
