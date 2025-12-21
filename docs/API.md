# Core C API — Reference

Version: 0.1 (kept in sync with source)

Headers and binaries
- Header: `core/include/core/core_c_api.h`
- Shared library target: `core_c` (Windows: core_c.dll; macOS: libcore_c.dylib; Linux: libcore_c.so)
- Preferred exported symbol prefix: `cadgf_*` (`core_*` is kept as a compatibility alias)

Conventions
- Memory: callers allocate buffers; use two-call query-then-fill where sizes are unknown.
- Coordinates: double-precision in world units. 2D only in this MVP.
- Polylines: boolean/offset expect closed rings (first equals last). Triangulation accepts unique vertices or closed; API normalizes internally.
- Return values: 1 = success, 0 = failure.

Types
- `typedef uint64_t cadgf_entity_id;`
- `typedef core_vec2 cadgf_vec2;` (`double x, y`)
- `typedef core_document cadgf_document;` (opaque)

Document lifecycle
- `cadgf_document* cadgf_document_create();`
- `void cadgf_document_destroy(cadgf_document* doc);`
 - `double cadgf_document_get_unit_scale(const cadgf_document* doc);`
 - `int cadgf_document_set_unit_scale(cadgf_document* doc, double unit_scale);`

Entities (demo scope)
- `cadgf_entity_id cadgf_document_add_polyline(cadgf_document* doc, const cadgf_vec2* pts, int n);`
  - Adds a polyline entity; n points. Returns entity id (>0) or 0 on failure.
- `int cadgf_document_remove_entity(cadgf_document* doc, cadgf_entity_id id);`
  - Removes entity by id. Returns 1 on success.
- `int cadgf_document_alloc_group_id(cadgf_document* doc);`
  - Allocates a new group id (>=1) for entity grouping. Returns -1 on failure.

Triangulation
- `int cadgf_triangulate_polygon(const cadgf_vec2* pts, int n, unsigned int* indices, int* index_count);`
  - Two-call pattern: query with `indices=NULL` to get `index_count` (3*k), then fill.
  - Uses earcut when available (USE_EARCUT), else convex-fan fallback (demo only).

Boolean and Offset (single-contour helpers)
- `int cadgf_boolean_op_single(const cadgf_vec2* subj, int subj_n, const cadgf_vec2* clip, int clip_n, int op, cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);`
  - op: 0=union, 1=difference, 2=intersection, 3=xor.
  - Two-call pattern: query to get sizes, then allocate and fill. Requires Clipper2.
- `int cadgf_offset_single(const cadgf_vec2* poly, int n, double delta, cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);`
  - Positive delta offsets outward. Same two-call pattern.

Examples
```c
// Triangulation example
cadgf_vec2 rect[5] = {{0,0},{100,0},{100,60},{0,60},{0,0}};
int idxCount = 0;
if (cadgf_triangulate_polygon(rect, 5, NULL, &idxCount) && idxCount > 0) {
    unsigned int* idx = (unsigned int*)malloc(sizeof(unsigned int)*idxCount);
    if (cadgf_triangulate_polygon(rect, 5, idx, &idxCount)) {
        // use triangles
    }
    free(idx);
}

// Boolean union example
cadgf_vec2 A[] = {{0,0},{100,0},{100,100},{0,100},{0,0}};
cadgf_vec2 B[] = {{50,50},{150,50},{150,150},{50,150},{50,50}};
int poly_count=0, total_pts=0;
if (cadgf_boolean_op_single(A,5,B,5,0,NULL,NULL,&poly_count,&total_pts) && poly_count>0) {
    cadgf_vec2* out_pts = (cadgf_vec2*)malloc(sizeof(cadgf_vec2)*total_pts);
    int* counts = (int*)malloc(sizeof(int)*poly_count);
    if (cadgf_boolean_op_single(A,5,B,5,0,out_pts,counts,&poly_count,&total_pts)) {
        // iterate rings with counts[i]
    }
    free(out_pts); free(counts);
}
```

Unity (C#) via P/Invoke
- Bindings: `adapters/unity/CoreBindings.cs`
```csharp
var pts = new CADGameFusion.UnityAdapter.CoreBindings.Vec2[]{ new(){x=0,y=0}, new(){x=1,y=0}, new(){x=1,y=1}, new(){x=0,y=0} };
int n = pts.Length, count = 0;
if (CADGameFusion.UnityAdapter.CoreBindings.cadgf_triangulate_polygon(pts, n, IntPtr.Zero, ref count) != 0 && count > 0) {
    var indices = new uint[count];
    CADGameFusion.UnityAdapter.CoreBindings.cadgf_triangulate_polygon(pts, n, indices, ref count);
}
```

Notes
- Versioning & features
  - `int cadgf_get_abi_version();` returns ABI level (compare against `CADGF_ABI_VERSION`).
  - `const char* cadgf_get_version();` returns semantic version string (e.g., "0.1.0").
  - `unsigned int cadgf_get_feature_flags();` bit 0 = USE_EARCUT, bit 1 = USE_CLIPPER2.
- Validate sizes before allocation; check return codes.
- Ensure rings are valid for boolean/offset; winding rules may apply.
- Thread-safety: not guaranteed; use per-thread docs or synchronize.
- Use `cadgf_get_abi_version()` for runtime ABI checks.

Host bootstrap snippet:

```c
int abi = cadgf_get_abi_version();
if (abi != CADGF_ABI_VERSION) {
    fprintf(stderr, "cadgf ABI mismatch (expected %d, got %d)\n", CADGF_ABI_VERSION, abi);
    return EXIT_FAILURE;
}
printf("cadgf version: %s\n", cadgf_get_version());
unsigned int feats = cadgf_get_feature_flags();
printf("features: earcut=%s clipper2=%s\n",
       (feats & CADGF_FEATURE_EARCUT)?"on":"off",
       (feats & CADGF_FEATURE_CLIPPER2)?"on":"off");
```
