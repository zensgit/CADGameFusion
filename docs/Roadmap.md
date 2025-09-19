# CADGameFusion — Roadmap

 Version: 0.2 (living document)

Guiding principles
- Ship tangible, reusable pieces each milestone (Core lib + Editor + Adapter).
- Keep risks isolated; validate end-to-end early (edit → ops → export → engine).
- Prefer pragmatic, robust algorithms (Clipper2/earcut) before deeper research.

Milestones overview
- M0 — Skeleton & CI [done]
- v0.2.0 — Strict CI baseline & exporter options [done]
- v0.3.0 — Exporter evolution (materials/normals/UVs, segmentation) [planning]
- M1 — 2D MVP (ops + editor + exporter) [~3 weeks]
- M2 — UX & Engine Interop (Unity tooling) [~4 weeks]
- M3 — 3D Primer (sketch → features) [~6 weeks]
- M4 — Stabilization & Extensibility [~6 weeks]

Owner legend
- [C] Core/algorithms
- [E] Editor/UI/UX
- [A] Adapters/engine
- [R] Release/CI/tooling

## M0 — Skeleton & CI [done]
Scope
- [C] Core lib + C API skeleton
- [E] Qt editor project + canvas prototype
- [A] Unity bindings + sample
- [R] vcpkg manifest + CI (core/qt) + artifacts
Deliverables
- `core_c` shared lib, `editor_qt`, Unity sample scripts
Acceptance
- Builds on macOS/Windows/Linux in CI (core succeeds; qt on macOS/Windows)

## M1 — 2D MVP (3 weeks)
Scope
- [C] 2D ops: boolean/offset (Clipper2), triangulation (earcut) with holes
- [E] Editor tools: select/transform gizmos (move/rotate/scale), snap (grid/end/mid)
- [E] Grouping/undo/redo; status bar metrics; cosmetic pens and themes
- [R] Export: glTF (mesh), JSON (collision/nav), simple scene packer
Tasks
- [C] Hole-aware triangulation input; join styles (miter/round) and miter limit
- [C] Tolerance handling; input normalization and ring orientation checks
- [E] Multi-select, marquee/lasso; delete/group-delete shortcuts; simple numeric input
- [R] Export CLI tool using core_c; doc examples + unit tests
Acceptance
- Boolean/offset pass gold tests; hole polygon triangulates correctly
- Editor: snap works; can export a sample scene; importable in Unity

## M2 — UX & Engine Interop (4 weeks)
Scope
- [E] Better gizmos, transform pivot, align/distribute panels
- [A] Unity EditorWindow: live preview + hot reload; mesh/collider builder
- [R] CI artifacts: zipped `core_c` per platform; sample Unity project template
Tasks
- [A] File watcher or IPC (named pipe/socket) for live updates
- [E] Measurement tools; rulers and guides; per-layer visibility/lock
- [R] Signed/nightly artifacts; versioning scheme for `core_c`
Acceptance
- Unity demo: edit in Qt, auto-updates in Unity in <2s for small scenes
- Usability: core editing flows are smooth and discoverable

## M3 — 3D Primer (6 weeks)
Scope
- [C] Sketch planes; 2D constraints for sketches; references to planes/axes
- [C] Features: Extrude/Revolve (start as mesh-ops; later swap OCCT)
- [E] 3D viewport: orbit/pan/zoom, selection, section view
- [A] Unity/Unreal adapters plan; start Unreal skeleton
Tasks
- [C] Constraint solver (subset): horizontal/vertical/equal/parallel/perp/dimension
- [E] Sketch editing UX and dimension input; feature tree updates
- [A] Export triangulated solids to glTF; basic materials
Acceptance
- Simple parts with 2–3 features build successfully; edits recompute deterministically

## M4 — Stabilization & Extensibility (6 weeks)
Scope
- [C] Robustness passes; fuzz for booleans; error reporting and recovery
- [E] Undo/redo across frontends; preferences; theme; i18n
- [A] Plugin/Scripting (Python) for batch ops; minimal SDK docs
- [R] Packaging: installers, notarization, crash reporting pipeline
Acceptance
- Stability: crash-free smoke sessions; ops latency budget (<50ms median simple ops)
- Distribution: downloadable installers + plugin API samples

## Cross-cutting
- Testing: golden geometry sets; CI fuzz seeds for booleans/offset
- Performance: incremental rebuilds, dirty-prop, spatial indices
- Docs: API reference, usage, examples, troubleshooting guide
 - Exporter roadmap: see `docs/exporter/roadmap_v0_3_0.md` and `docs/exporter/design_decisions.md`

## Risk register
- Boolean robustness on tricky inputs → normalize inputs, use tolerances, add fuzz
- Topology identity across recompute → introduce stable IDs later, constrain MVP features
- Cross-platform packaging complexity → stage in CI, test on real machines

## Timeline (indicative)
- Week 0: M0 done
- Weeks 1–3: M1
- Weeks 4–7: M2
- Weeks 8–13: M3
- Weeks 14–19: M4

## Ownership (placeholders)
- Core: Owner TBD (@core-dev)
- Editor: Owner TBD (@editor-dev)
- Adapters: Owner TBD (@adapter-dev)
- Tooling/CI: Owner TBD (@devops)
