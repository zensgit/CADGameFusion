# Reference Code Comparison Plan (CADGameFusion)

This plan defines a deep code-to-code comparison between CADGameFusion and the
reference repositories under `references/`. It records the scan targets, the
comparison axes, and the expected outputs.

## Scope and Reference Set

Primary focus (requested):
- `references/freecad/`
- `references/librecad/`
- `references/threejs/`

Secondary context (for IO/kernel/viewer choices):
- `references/cadquery/`
- `references/libdxfrw/`
- `references/manifold/`
- `references/solvespace/`
- `references/xeokit-sdk/`
- `references/OPENCASCADE_GUIDE.md`

## CADGameFusion Baseline (What We Compare Against)

Key surfaces and data flow:

- Stable ABI: `core/include/core/core_c_api.h`
- Plugin ABI: `core/include/core/plugin_abi_c_v1.h`
- Document model: `core/include/core/document.hpp`
- 2D ops: `core/include/core/ops2d.hpp`, `core/src/ops2d.cpp`
- Solver stub: `core/include/core/solver.hpp`, `core/src/solver.cpp`
- Conversion pipeline: `tools/convert_cli.cpp`, `tools/plm_convert.py`
- Plugins: `plugins/dxf_importer_plugin.cpp`, `plugins/json_importer_plugin.cpp`
- Editor projection (Qt): `editor/qt/src/canvas.cpp`, `editor/qt/src/mainwindow.cpp`

## Comparison Axes (Detailed)

1. Data model
   - Entity taxonomy (line/arc/spline/mesh vs polyline-only)
   - Layer/visibility/metadata coverage
   - Instance/transform/blocks (if any)
   - ID stability and undo/redo affordances
   - Document properties and change signals

2. Geometry kernel
   - 2D polygon boolean robustness
   - 3D topology (B-Rep vs mesh vs polyline)
   - Offset, triangulation, tessellation
   - Precision and tolerance controls

3. Constraint solving
   - Constraint types supported
   - Solver math strategy (LM, least squares, NLOPT/CasADi)
   - Degrees-of-freedom and redundancy handling

4. Import/export and format coverage
   - DXF/DWG entities, STEP/IGES/IFC, SVG, glTF
   - Metadata mapping (layers, colors, blocks, attributes)
   - Incremental/partial export support

5. Extensibility and ABI strategy
   - Plugin registration model
   - ABI stability practices
   - Bindings and language adapters

6. Rendering and web/mobile pipeline
   - glTF pipeline details (buffers, metadata, extensions)
   - Viewer architecture (scene graph, metadata, picking)
   - Streaming / LOD / tiling support

7. Performance and robustness
   - Parallelization (TBB, SIMD)
   - Manifold guarantees or repair strategies
   - Failure modes and error reporting

8. Licensing and distribution constraints
   - Copyleft vs permissive
   - Impact on plugin or server-side isolation

## Deep Scan Targets by Repo

### cadquery (OCCT-backed parametric CAD)

Focus areas:
- Core modeling: `references/cadquery/cadquery/cq.py`,
  `references/cadquery/cadquery/assembly.py`
- OCC bindings: `references/cadquery/cadquery/occ_impl/shapes.py`,
  `references/cadquery/cadquery/occ_impl/geom.py`
- Constraints (3D): `references/cadquery/cadquery/occ_impl/solver.py`
- Sketch constraints (2D): `references/cadquery/cadquery/occ_impl/sketch_solver.py`
- Import/export: `references/cadquery/cadquery/occ_impl/importers/`,
  `references/cadquery/cadquery/occ_impl/exporters/`

Extract:
- Shape taxonomy and parametric workflow
- Constraint definitions and solver strategy
- Import/export fidelity (DXF/SVG/STEP)

### libdxfrw (DXF/DWG)

Focus areas:
- Entity taxonomy: `references/libdxfrw/src/drw_entities.h`
- Parse callback API: `references/libdxfrw/src/drw_interface.h`
- Layer/line-type data: `references/libdxfrw/src/drw_header.h`

Extract:
- DXF entity coverage vs CADGameFusion plugin
- Mapping requirements for layers, colors, blocks, text, dims

### FreeCAD (LGPL, OCCT-based CAD platform)

Focus areas:
- Document model + properties: `references/freecad/src/App/Document.h`
- Object model: `references/freecad/src/App/DocumentObject.h`
- Property system: `references/freecad/src/App/PropertyContainer.h`,
  `references/freecad/src/App/PropertyStandard.h`
- Sketcher constraints: `references/freecad/src/Mod/Sketcher/App/Constraint.h`

Extract:
- Document + property system structure
- Constraint taxonomy and persistence approach
- Extensibility boundaries (App/Gui/Mod separation)

### LibreCAD (GPL 2D CAD)

Focus areas:
- Document abstraction: `references/librecad/librecad/src/lib/engine/document/rs_document.h`
- Entity base: `references/librecad/librecad/src/lib/engine/document/entities/rs_entity.h`
- Layers: `references/librecad/librecad/src/lib/engine/document/layers/rs_layerlist.h`
- Undo: `references/librecad/librecad/src/lib/engine/undo/rs_undo.h`

Extract:
- 2D entity taxonomy and layer/block handling
- Undo/redo and modification tracking

### three.js (MIT Web renderer)

Focus areas:
- glTF loader: `references/threejs/examples/jsm/loaders/GLTFLoader.js`
- BufferGeometry pipeline: `references/threejs/src/core/BufferGeometry.js`
- Scene graph: `references/threejs/src/core/Object3D.js`

Extract:
- glTF feature coverage and extensions (KHR/EXT)
- Metadata mapping (`extras`, unknown extensions -> `userData`)
- Geometry/memory layout expectations for exports

### manifold (mesh boolean kernel)

Focus areas:
- Core API: `references/manifold/include/manifold/manifold.h`
- Mesh representation: `MeshGLP` and property channels
- Cross-section and boolean operations (in `references/manifold/src/`)
- Bindings (WASM/Python): `references/manifold/bindings/`

Extract:
- Robust mesh boolean approach and constraints
- Mesh metadata mapping to glTF (EXT_mesh_manifold)

### solvespace (constraint-based CAD)

Focus areas:
- System solver and equations: `references/solvespace/src/solvespace.h`
- Constraint definitions: `references/solvespace/src/constraint.cpp`
- Sketch/model data: `references/solvespace/src/sketch.*`

Extract:
- Constraint taxonomy and solving pipeline
- DOF/rank analysis and redundancy handling

### xeokit-sdk (web viewer)

Focus areas:
- Viewer + scene graph: `references/xeokit-sdk/src/viewer/Viewer.js`
- Plugin system: `references/xeokit-sdk/src/plugins/`
- Metadata model: `references/xeokit-sdk/src/viewer/metadata/`

Extract:
- Web viewer feature set for CAD/BIM
- Streaming/metadata/picking patterns

### OPENCASCADE guide

Focus areas:
- Conversion strategies (server-side OCCT)
- Tessellation and boolean guidance

## Planned Outputs

1. Comparison matrix: CADGameFusion vs each reference along the axes above.
2. Gap list: what is missing in CADGameFusion for each axis, with file-level evidence.
3. Prioritized recommendations: short/medium/long term, with licensing notes.
4. Suggested adoption map: where to learn patterns vs where to avoid code reuse.

## Notes (Initial Findings in Progress)

- CADGameFusion core is polyline-centric and 2D-first; reference CAD kernels
  (cadquery/OCCT, solvespace) emphasize B-Rep/constraints.
- The current DXF importer is a minimal LWPOLYLINE parser; libdxfrw supports
  broader entity coverage but is GPL-licensed.
- Manifold provides robust mesh booleans and strong language bindings that map
  well to future 2.5D/3D goals and WASM/web use cases.
- xeokit is a mature web viewer but AGPL licensed; adoption depends on the
  licensing model of the product.
- FreeCAD and LibreCAD illustrate mature Document/Entity and constraint systems
  but are LGPL/GPL; use them as architectural references, not as code imports.
