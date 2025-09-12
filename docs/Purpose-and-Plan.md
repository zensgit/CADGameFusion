Title: CADGameFusion — Purpose and Plan
Version: 0.1

1. Purpose
- Build a shared Core (C++ + C API) for geometry/constraints/ops that can be reused by both a desktop design editor (Qt) and game engines (Unity/Unreal/adapters).
- Maximize code and data reuse: one document/command/ops model, multiple frontends.
- De-risk by starting with a 2D MVP to validate end‑to‑end flow (edit → triangulate/boolean/offset → export/interop), then expand to 3D (sketch → features).

2. Non‑Goals (initial phases)
- Full CAD B‑Rep robustness at runtime (use offline meshing / SDF/voxel for realtime when needed).
- DWG proprietary support (start with internal doc + glTF; DWG via ODA is out‑of‑scope now).
- Heavy CAE (FEM/CFD) in runtime; focus on editor-time visualization and lightweight ops.

3. Users and Platforms
- Design editor users: precise layout/modeling with desktop UX (Windows/macOS; Qt)
- Game runtime users: import/export or runtime interop via C API (Unity first, Unreal later)

4. Tech Stack
- Core: C++17, C API wrapper, optional pybind/C# later
- 2D ops: earcut (triangulation), Clipper2 (boolean/offset) via vcpkg
- Editor: Qt Widgets (canvas, tools, gizmos), CMake build
- Adapters: Unity (C# P/Invoke), Unreal (planned C++ module)
- Formats: internal JSON/doc; glTF for meshes; simple JSON for collision/nav (later)

5. Current State (Sep 2025)
- Repo skeleton: core + C API (core_c), Qt editor, Unity adapter and sample
- Build: CMake, vcpkg manifest, CI (core + qt) with artifacts upload (core_c)
- Editor: canvas (pan/zoom, cosmetic lines), add/triangulate/boolean/offset, selection, group delete, clear all
- Core ops: triangulate_polygon (earcut when available), boolean/offset (Clipper2 when available)

6. Milestones & Timeline (indicative)
- M0 (done): Skeleton + CI + vcpkg + Unity sample + Qt canvas basics
- M1 (2–3 weeks): 2D MVP
  - Robust 2D ops (holes/multi-rings), snapping (grid/end/mid), command stack persistence, export glTF + collision JSON
- M2 (3–4 weeks): Editor UX & Engine Interop
  - Selection/transform gizmos, numeric input, multi-select, Unity editor window + hot reload
- M3 (4–6 weeks): 3D Primer
  - Sketch planes + 2D constraints, features: extrude/revolve (via OCCT or lightweight mesh ops), 3D view
- M4 (4–6 weeks): Stabilization + Extensibility
  - Undo/redo across frontends, plugin/script API (Python), packaging and releases

7. Deliverables per Milestone
- Binaries (editor, core_c), sample projects (Unity), docs (usage + API), CI artifacts
- Demos: videos/gifs showing editor ops and engine interop

8. Risks & Mitigations
- Geometric robustness (boolean/offset): use Clipper2; pre‑normalize inputs; unit tests; tolerances
- Topology identity across edits: introduce stable references later; start with group/IDs
- Cross‑platform packaging: automate CI (artifacts), later add installers/notarization

9. KPIs
- Build health (CI pass rate), crash‑free sessions, operation latency (<50ms median simple ops)
- Interop time (edit → engine preview round‑trip), user ops/minute in editor tasks

10. Next Steps
- Wire earcut/clipper2 fully (holes, join styles) and add export pipeline
- Add Unity mesh preview tool + hot reload; plan Unreal adapter skeleton
- Expand tests (golden geometry, fuzz for booleans)

