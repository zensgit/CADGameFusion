# Reference Comparison Report (CADGameFusion vs references)

This report compares CADGameFusion to the reference repos under
`references/` using the axes defined in
`docs/REFERENCE_COMPARISON_PLAN.md`.

## 1. Baseline Snapshot (CADGameFusion)

Core facts (code-backed):

- Data model: `core/include/core/document.hpp` is polyline-centric. Entities
  are `{id, type, name, layerId, payload, visible, groupId, color}`.
- Stable ABI: C API in `core/include/core/core_c_api.h`.
- Plugin ABI: C function table in `core/include/core/plugin_abi_c_v1.h`.
- Geometry: 2D triangulation and boolean ops in `core/src/ops2d.cpp`
  (Clipper2, Earcut).
- Constraints: `core/src/solver.cpp` is a minimal LM solver stub (limited set).
- Conversion: `tools/convert_cli.cpp` -> `document.json` + `mesh.gltf`.
- DXF import: `plugins/dxf_importer_plugin.cpp` only supports `LWPOLYLINE`.

## 2. Comparison Matrix (By Axis)

### 2.1 Data Model

| Repo | Data model traits | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | Polyline-only entities + layers | Minimal, good for 2D; lacks arcs/splines/blocks |
| cadquery | B-Rep shapes, assemblies, parametric features | Heavy OCCT; better for server-side conversion |
| freecad | App::Document with rich properties + signals; DocumentObject status + visibility | Strong document metadata + transaction/event model |
| libdxfrw | Full DXF entity taxonomy | Good mapping source for DXF layers, text, blocks |
| librecad | RS_Document + RS_EntityContainer + layer/block lists + undo | 2D CAD entity taxonomy + undo-centric workflow |
| manifold | Triangle mesh, MeshGLP with property channels | Ideal for 2.5D/3D mesh pipeline |
| solvespace | Entities + params + constraints + groups | Reference for parametric sketch system |
| threejs | Object3D scene graph + BufferGeometry | Viewer-level model, needs glTF-ready assets |
| xeokit | Scene graph + metadata | Viewer-level model, not CAD kernel |

#### 2.1.1 Eventing, Transactions, Undo

- FreeCAD: `App::Document` defines document-level property metadata plus signals
  for changes, undo/redo, and transactions (`references/freecad/src/App/Document.h`).
- FreeCAD: `DocumentObject` carries status flags (e.g., touched/recompute) and
  a visibility property (`references/freecad/src/App/DocumentObject.h`).
- LibreCAD: `RS_Document` derives from `RS_Undo` and owns layer/block/style lists,
  with explicit undo cycles (`references/librecad/librecad/src/lib/engine/document/rs_document.h`,
  `references/librecad/librecad/src/lib/engine/undo/rs_undo.h`).
- LibreCAD: `RS_Entity` tracks layer, pen, selection, highlight, and visibility
  (`references/librecad/librecad/src/lib/engine/document/entities/rs_entity.h`).

#### 2.1.2 Assemblies and Metadata

- cadquery: `Assembly` stores per-node metadata, color/material, and subshape
  name/layer mappings for export (`references/cadquery/cadquery/assembly.py`).
- xeokit: `MetaModel` carries project/revision/author/schema metadata and
  organizes `MetaObject` + `PropertySet` trees for BIM-style queries
  (`references/xeokit-sdk/src/viewer/metadata/MetaModel.js`).

### 2.2 Geometry Kernel

| Repo | Geometry features | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | 2D boolean + offset (Clipper2), 2D triangulation | Strong 2D base; no 3D kernel |
| cadquery | OCCT B-Rep; NURBS, booleans, fillets, lofts | Too heavy for client; good for server conversion |
| freecad | OCCT B-Rep + parametric modeling | Reference for document + property model |
| manifold | Robust manifold mesh booleans + mesh refinement | Strong candidate for 3D mesh boolean |
| librecad | 2D analytic geometry (line/arc/circle/ellipse) | Strong 2D entity taxonomy reference |
| threejs | Rendering only (no CAD kernel) | Consumer of glTF/BufferGeometry |
| solvespace | Parametric 2D/3D, limited kernel | Useful for constraint solver strategy |

Notes:
- Manifold's MeshGLP encodes merge vectors, run segments, and face IDs to keep
  topology and material provenance; recommends EXT_mesh_manifold for storage
  (`references/manifold/include/manifold/manifold.h`).

### 2.3 Constraint Solving

| Repo | Solver approach | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | Minimal LM solver with basic constraints | Needs full constraint taxonomy and rank handling |
| cadquery | CasADi-based assembly solver; NLOPT for sketches | Shows robust constraint modeling |
| freecad | Sketcher constraint enum with dimensional + geometric types | Constraint taxonomy reference (Coincident, Horizontal, Distance, Angle, etc) |
| librecad | No deep solver; focus on direct geometry edits | Not a constraint reference |
| solvespace | Equation system + rank + redundancy detection | Best reference for CAD-style constraints |

Notes:
- FreeCAD constraints are stored in a stable enum and appended at the end to keep
  project compatibility (`references/freecad/src/Mod/Sketcher/App/Constraint.h`).
- cadquery assembly constraints are validated with explicit marker/arity rules
  in a CasADi-based solver (`references/cadquery/cadquery/occ_impl/solver.py`).
- solvespace includes a broad constraint taxonomy and explicit redundancy checks
  when adding constraints (`references/solvespace/src/constraint.cpp`).

### 2.4 Import/Export

| Repo | IO coverage | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | JSON + glTF export; DXF import (LWPOLYLINE only) | Import/export limited |
| cadquery | STEP/DXF/SVG/3MF/STL export, OCCT importers | Server-side conversion candidate |
| freecad | Wide format support via OCCT + modules | Server-side reference only |
| libdxfrw | DXF read/write + limited DWG | Ideal for broader DXF import plugin (license) |
| librecad | DXF-centric I/O (libdxfrw) | Good 2D workflow reference |
| threejs | glTF/GLB + loaders for common formats | Good web viewer baseline |
| xeokit | Loads glTF, XKT, BIM formats | Web viewer pipeline |

Notes:
- libdxfrw enumerates a broad DXF entity set (ARC/CIRCLE/ELLIPSE/SPLINE/TEXT/DIM)
  that CADGameFusion currently does not map (`references/libdxfrw/src/drw_entities.h`).
- cadquery exports assemblies to STEP/GLTF and retains per-part metadata for
  downstream viewers (`references/cadquery/cadquery/assembly.py`).

### 2.5 Extensibility and ABI

| Repo | Extensibility | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | C ABI + plugin ABI tables | Stable boundary is already strong |
| manifold | C/C++ + JS/Python bindings | Good model for multi-language bindings |
| freecad | Module system (App/Gui/Mod separation) | Large plugin surface, heavy dependencies |
| librecad | Plugin + script system | 2D CAD extension reference |
| threejs | Loader/plugin ecosystem | Useful for viewer-level extensions |
| xeokit | Plugin-based viewer | Good model for web extension |

### 2.6 Web/Mobile Viewer

| Repo | Viewer strategy | Notes for CADGameFusion |
| --- | --- | --- |
| CADGameFusion | glTF export from CLI | Works for generic viewers |
| threejs | General-purpose WebGL viewer | MIT-licensed default choice; glTF extras map into `userData` |
| xeokit | Full BIM viewer with metadata | Strong baseline but AGPL license |

Notes:
- `GLTFLoader` assigns `extras` into `object.userData` and preserves unknown
  extensions for later use (`references/threejs/examples/jsm/loaders/GLTFLoader.js`).
- xeokit models BIM metadata via `MetaModel` + `MetaObject` trees and property
  sets, suggesting a richer PLM metadata export format
  (`references/xeokit-sdk/src/viewer/metadata/MetaModel.js`).

### 2.7 Licensing

| Repo | License | Implication |
| --- | --- | --- |
| cadquery | Apache 2.0 | Safe for commercial use |
| freecad | LGPL 2.1 | Reference only unless dynamic linking obligations are acceptable |
| libdxfrw | GPLv2+ | Only use as optional/external plugin |
| librecad | GPLv2 | Reference only unless open source |
| manifold | Apache 2.0 | Safe for commercial use |
| solvespace | GPLv3 | Reference only unless open source |
| threejs | MIT | Safe for commercial use |
| xeokit | AGPLv3 | Use only if product is open source or licensed |

### 2.8 Repo Highlights (Code-Backed)

FreeCAD (Document + constraints):
- `App::Document` exposes first-class metadata (Label, FileName, CreatedBy,
  UnitSystem, Meta, Material) and a rich signal set for change/undo/redo
  (`references/freecad/src/App/Document.h`).
- `DocumentObject` includes status flags (touched, recompute, error) and a
  built-in Visibility property (`references/freecad/src/App/DocumentObject.h`).
- Sketcher constraints are a stable enum with explicit compatibility guidance
  (`references/freecad/src/Mod/Sketcher/App/Constraint.h`).

LibreCAD (2D document model + undo):
- `RS_Document` owns layer/block/style lists and inherits undo cycles from
  `RS_Undo` (`references/librecad/librecad/src/lib/engine/document/rs_document.h`).
- `RS_LayerList` supports active layer, lock/print/freeze/construction toggles
  (`references/librecad/librecad/src/lib/engine/document/layers/rs_layerlist.h`).
- `RS_Entity` models selection/visibility/pen/layer state in the entity base
  (`references/librecad/librecad/src/lib/engine/document/entities/rs_entity.h`).
- `RS_Document` holds a `RS_GraphicView*` with a comment warning about UI
  coupling; keep CADGameFusion document headless.

three.js (viewer expectations for glTF metadata):
- `GLTFLoader` lists KHR/EXT extensions and maps `extras` into `userData`,
  preserving unknown extensions (`references/threejs/examples/jsm/loaders/GLTFLoader.js`).
- `BufferGeometry` expects indexed triangles via `index` and attribute buffers
  (`references/threejs/src/core/BufferGeometry.js`).
- `Object3D` provides UUID/name/transform/child graph, a natural target for
  CAD object metadata (`references/threejs/src/core/Object3D.js`).

cadquery (assemblies + export):
- `Assembly` nodes store per-part metadata, color/material, and subshape maps,
  enabling richer export metadata (`references/cadquery/cadquery/assembly.py`).
- Assembly exports include STEP/GLTF and preserve structure for downstream viewers
  (`references/cadquery/cadquery/occ_impl/exporters/assembly.py`).

solvespace (constraints + redundancy handling):
- Constraint insertion checks for redundancy and rank changes when adding new
  constraints (`references/solvespace/src/constraint.cpp`).

libdxfrw (DXF entity coverage):
- Entity enum includes ARC/CIRCLE/ELLIPSE/SPLINE/TEXT/DIMENSION/INSERT, etc.,
  indicating the breadth needed for full DXF import
  (`references/libdxfrw/src/drw_entities.h`).

manifold (mesh metadata for booleans):
- `MeshGLP` stores merge vectors and run/face IDs to preserve topology and
  material provenance; recommends EXT_mesh_manifold for transport
  (`references/manifold/include/manifold/manifold.h`).

xeokit (metadata tree for BIM/PLM):
- `MetaModel` carries project/revision/author/schema, and organizes
  MetaObject + PropertySet trees for metadata-driven selection and queries
  (`references/xeokit-sdk/src/viewer/metadata/MetaModel.js`).

## 3. Gap Analysis vs CADGameFusion

### 3.1 High-impact Gaps (Core)

- No native arc/circle/spline entities (DXF import currently LWPOLYLINE only).
- Constraint system is minimal and lacks DOF/rank handling.
- No 3D mesh boolean or tessellation pipeline (beyond 2D triangulation).
- Metadata model lacks line types, thickness, text/dimension entities.
- No block/instance or transform model (DXF blocks, assemblies).
- No document-level property system (labels, metadata, transactions) like FreeCAD.
- No document-level change signals/transaction hooks comparable to FreeCAD.
- Layer features are limited vs LibreCAD (lock/print/freeze/construction states).
- Web export lacks explicit glTF extension policy (three.js expects standard glTF).
- No assembly graph or per-part metadata export comparable to cadquery assemblies.

### 3.2 Pipeline Gaps (PLM/Web)

- Export pipeline is glTF + JSON only; no standard 2D outputs (SVG/PDF).
- Mesh metadata does not follow a standard extension (eg EXT_mesh_manifold).
- Viewer pipeline not defined (xeokit vs three.js vs custom).
- glTF metadata is not yet mapped into `extras`/`userData` conventions expected by three.js.
- No PLM-oriented property set model like xeokit MetaModel/PropertySet.

## 4. Recommendations (Prioritized)

### 4.1 Short Term (0-2 months)

- Extend Document entity taxonomy: line, arc, circle, spline, text, dimension.
- Expand DXF importer: map layers/colors/line types; consider optional
  libdxfrw-based plugin (external GPL module).
- Formalize mesh metadata schema and glTF extension strategy.
- Add document-level metadata (label/id/author/timestamps) inspired by FreeCAD.
- Add document-level change signals/transaction hooks for editor/view syncing.
- Add layer state flags (lock/print/freeze/construction) to match 2D CAD behavior.
- Map export metadata into glTF `extras` to preserve `userData` in three.js.
- Prototype a lightweight assembly tree (nodes + transform + metadata), even if
  CADGameFusion stays 2D-first.

### 4.2 Medium Term (2-6 months)

- Introduce a constraint subsystem inspired by solvespace (rank check, DOF).
- Add lightweight 3D mesh boolean via manifold (Apache 2.0), with bindings.
- Add a standard web viewer pipeline (prefer permissive license).
  - three.js is the simplest MIT option; xeokit needs AGPL/commercial license.
- Avoid UI coupling in the document model (LibreCAD has explicit UI pointer
  in RS_Document; CADGameFusion should keep the document headless).
- Define a PLM property-set schema (xeokit-style) for per-part attributes and
  revision metadata, even if stored separately from glTF.

### 4.3 Long Term (6-12 months)

- Server-side OCCT/CadQuery conversion for heavy CAD formats (STEP/IGES).
- Block/instance model and assembly relationships.
- LOD-driven tessellation for large assemblies.
- Adopt EXT_mesh_manifold (or a compatible schema) if manifold becomes the
  boolean core for 3D mesh output.

## 5. Suggested Next Actions

- Decide on acceptable licenses for optional plugins vs core.
- Pick the target viewer (xeokit vs three.js vs custom) based on license.
- Confirm whether to introduce manifold as a dependency for 3D mesh boolean.
- Define a minimal assembly/instance data model aligned with glTF nodes.
- Decide where PLM metadata lives (glTF `extras` vs sidecar JSON vs both).
