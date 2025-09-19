# CAD MVP v0.1 — Architecture Overview

## Modules
- Core Geometry Kernel Abstraction
  - Interface for 2D sketch entities, constraints, 3D BRep/mesh ops.
  - Impl strategy: Mesh-first prototype; plan migration path to OpenCascade.
- Sketch & Constraints
  - Entities: point/line/arc/circle/rect; Constraint Graph; Solver adapter.
- Feature & Rebuild Pipeline
  - Feature nodes (Extrude/Revolve/Boolean); dependency graph; deterministic rebuild.
- Data Model & IO
  - Project graph (scene, feature tree, resources), versioned format, import/export.
- UI (Qt)
  - Views, selection, commands, property panel, timeline/history; scripting hooks.
- Tools & CI
  - Unit/integration tests, scenario samples, reproducible benches.

## Key Interfaces
- IKernel2D, IKernel3D, IBooleanOps, IFeatureExecutor
- ISolver (constraints), IProjectStorage, IExporter/IImporter

## Flows
- Edit → Solve → Rebuild → Render → Persist → Export
- Deterministic rebuild ordering with change sets and cache invalidation.

## Risks & Mitigations
- Kernel complexity → abstraction boundary + migration plan
- Solver stability → constrain MVP constraints + fallback strategies
- Cross-platform deps → vcpkg + CI cache + retry

