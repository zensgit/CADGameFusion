# Functional Design – CADGameFusion

## Purpose & Scope
Define the minimal-but-usable feature set for a light CAD/level-editing platform built on the existing core C++ library, Qt editor shell, and Unity adapter. Focus on robust 2D geometry, safe C API, an initial constraint solver MVP, and export/validation flows.

## Target Use Cases
- 2D sketch editing: draw/modify polylines, apply offsets/booleans, triangulate for visualization/export.
- Constraint-driven tweaks: horizontal/vertical/distance/angle/parallel/perpendicular/length-equal; detect conflicts.
- Export for downstream tools: JSON + GLTF meshes with schema validation; Unity-side consumption through C# P/Invoke.

## Architecture (functional view)
- Core Geometry: polyline/ring utilities, triangulation (earcut-backed), boolean/offset (Clipper2-backed), mesh helpers.
- Constraint Solver: variable store + GN/LM pipeline, conflict detection, binding callbacks for host apps.
- C API Layer: two-phase query/fill functions with error codes; stable ABI for Qt/Unity.
- Validation & Exports: schema-driven JSON, GLTF export, golden-sample comparison, stats reporting.
- Frontends: Qt editor (interactive), Unity adapter (runtime/editor-time ops).

## Canonical Data Structures & Interfaces (proposed)
### Geometry & Topology (C++)
```cpp
struct Vec2 { double x{}, y{}; };
struct Ring { std::vector<Vec2> points; }; // closed if front==back
struct PolyRegion { Ring outer; std::vector<Ring> holes; };
struct TriMesh2D { std::vector<Vec2> vertices; std::vector<uint32_t> indices; };

TriMesh2D triangulate_polygon(const Ring& outer, const std::vector<Ring>& holes);
std::vector<PolyRegion> boolean_op(const std::vector<PolyRegion>& subj,
                                   const std::vector<PolyRegion>& clip,
                                   BoolOp op,
                                   Tolerance tol = {});
std::vector<PolyRegion> offset(const std::vector<PolyRegion>& polys,
                               double delta,
                               OffsetParams params = {});
```

### Constraint Solver (C++)
```cpp
enum class ConstraintType { Horizontal, Vertical, Distance, Angle,
                            Parallel, Perpendicular, EqualLength, Fixed };
struct VarRef { std::string entity; std::string key; }; // e.g. ("p1","x")
struct ConstraintSpec {
    ConstraintType type;
    std::vector<VarRef> vars;         // ordered by type contract
    std::optional<double> value;      // distance/angle/etc.
    double weight{1.0};
    bool active{true};
};
struct SolveResult {
    bool ok;
    int iterations;
    double final_error;
    std::vector<int> conflict_indices; // unsatisfied constraint indices
    std::string message;
};
class ISolver {
public:
    virtual void set_max_iterations(int) = 0;
    virtual void set_tolerance(double) = 0;
    virtual SolveResult solve(std::vector<ConstraintSpec>&,
        const std::function<double(const VarRef&, bool&)>& get,
        const std::function<void(const VarRef&, double)>& set) = 0;
};
```

### C API (C, two-phase query/fill with error codes)
```c
typedef struct { double x, y; } core_vec2;
typedef struct { core_vec2* pts; int count; } core_ring;
typedef struct { core_ring outer; core_ring* holes; int hole_count; } core_region;
typedef enum {
    CORE_OK = 0,
    CORE_ERR_INVALID_ARG,
    CORE_ERR_NO_BACKEND,
    CORE_ERR_INSUFFICIENT_BUFFER,
    CORE_ERR_FAIL
} core_status;

core_status core_triangulate_rings(const core_ring* rings, int ring_count,
                                   unsigned* indices, int* index_count);
/* call-1: indices=null -> index_count out; call-2: fill */

core_status core_boolean_regions(const core_region* subj, int subj_count,
                                 const core_region* clip, int clip_count,
                                 int op /*0=union..3=xor*/,
                                 core_region* out, int* out_count,
                                 int* total_pts);
/* out=null -> sizes only; otherwise fill within caller buffers */
```

### JSON/Export (shape of outputs)
```json
{
  "version": "0.2.0",
  "feature_flags": ["earcut", "clipper2"],
  "tolerance": { "scale": 1000, "eps": 1e-9 },
  "regions": [ { "outer": [[x,y],...], "holes": [[[x,y],...]] } ],
  "mesh": { "vertices": [[x,y,z]], "indices": [0,1,2] },
  "meta": { "generated_by": "export_cli", "rtol": 1e-6 }
}
```

### Unity Adapter (C# P/Invoke surface)
```csharp
[DllImport("core_c")]
static extern CoreStatus core_triangulate_polygon(core_vec2[] pts, int n,
    uint[] indices, ref int indexCount);

public Result<TriMesh> Triangulate(Vector2[] poly) {
    var count = 0;
    var status = core_triangulate_polygon(toCore(poly), poly.Length, null, ref count);
    if (status != CoreStatus.OK) return Result.Fail(status);
    var idx = new uint[count];
    status = core_triangulate_polygon(toCore(poly), poly.Length, idx, ref count);
    ...
}
```

## Functional Requirements by Module
### Geometry & Topology
- Triangulation: `triangulate_polygon` and `triangulate_rings` preserve outer/holes; fallback fan only for trivial convex, otherwise fail with error code.
- Boolean/Offset: accept multiple rings per operand; return structured result `{outer, holes[]}` not flattened polylines. Configurable tolerance/scale; support fill rules (NonZero, EvenOdd) and join types (Miter/Round/Bevel).
- Normalization: closing rings, orientation (outer CCW, holes CW), de-dup near points (`eps`), min edge length guard, overflow-aware scaling.

### Constraint Solver
- ConstraintSpec: enum type + args (vars, value, weight, active flag). Supported types: horizontal, vertical, distance, angle, parallel, perpendicular, equal_length, fixed.
- Variable Store: typed values (double), frozen flag, unit scale, optional bounds. Lookup by (entity_id, key).
- Solve Engine: GN/LM with damping, step size control, stop criteria (residual, gradient, step, iter cap), conflict set extraction (highest residual constraints).
- Bindings: `solveWithBindings` uses callbacks to read/write host values; thread-unsafe by default but reentrant per instance.

### C API (core_c)
- Two-phase pattern: first call with null outputs to query sizes (`index_count`, `poly_count`, `total_pts`), second call fills buffers.
- Error codes: `CORE_OK`, `CORE_ERR_INVALID_ARG`, `CORE_ERR_NO_BACKEND`, `CORE_ERR_INSUFFICIENT_BUFFER`, `CORE_ERR_FAIL`.
- Functions: polygon/ring triangulation, boolean (single/multi), offset (single/multi), solver entry (feed constraints + bindings shims), version/features. All validate pointers/counts; never write past caller-provided capacity.
- ABI stability: plain C structs, no STL in signatures; document ownership/lifetime.

### Validation & Exports
- JSON schema versioned in `schemas/`; exports include metadata (feature flags, tool versions, tolerances).
- GLTF export includes normals, tangents optional; validate manifoldness/lightweight checks (degenerate triangles, NaN).
- Tools: `validate_export.py`, `test_normalization.py`, `compare_fields.py`, `check_verification.sh` stay in sync with schema; add GLTF sanity checks (vertex count, bounds).

### Qt Editor
- Features: select/move/rotate/scale polylines; apply constraints; run boolean/offset; visualize triangulation; error/conflict panel; undo/redo.
- Persistence: load/save project JSON with constraints; import/export GLTF.
- Diagnostics: show backend feature flags, validation status, last error code.

### Unity Adapter
- Safe wrapper over C API: size-check helpers, span-based marshaling, error-to-exception helper optional.
- Sample behaviours: load scene, run boolean/offset, triangulate to Mesh, basic validation HUD.
- Threading note: recommend main-thread usage unless core proven thread-safe.

## Non-Functional Requirements
- Determinism: same inputs → same outputs given fixed tolerance/scale and feature flags.
- Performance: target <50 ms for medium scenes (≤10k verts) triangulation/boolean/offset on desktop Release; solver: <20 ms for 100-variable sketches typical cases.
- Portability: Linux/macOS/Windows; Ninja preferred. Optional deps detected gracefully; stubs return `CORE_ERR_NO_BACKEND` not empty success.

## Testing & Acceptance
- Geometry: golden scenes with holes/overlaps/degenerates; asserts on area, orientation, hole count; fuzz small random polygons with tolerance guards.
- API Safety: negative tests for null pointers, undersized buffers, mismatched counts; ensure no writes out of bounds (ASAN/UBSAN runs).
- Solver: suite of satisfiable, overconstrained, conflicting sketches with thresholds on residual and iteration count; regression on conflict set output.
- Frontends: Qt smoke (recorded macro), Unity sample scene playmode; export/import round-trip tests (JSON+GLTF).
- CI: matrix with earcut/Clipper2 on/off, Release/Debug, sanitizers optional; warnings-as-errors baseline clean.

## Milestones (tie to tasks)
- M1: Geometry robustness + API errors + tests (earcut/Clipper2 enabled).  
- M2: Solver MVP (GN/LM) + constraint DSL + conflict reporting + tests/bench.  
- M3: Structured outputs (outer+holes) across API + GLTF validation + doc updates.  
- M4: Qt/Unity safe wrappers + sample flows + UX for errors/conflicts.  
- M5: Publish docs/changelog, enforce CI gates, tag baseline.
