# P3.2 Dependency Graph + Topological Recompute — Verification

## Date: 2026-03-28

## Goal
Implement a dependency graph with topological recompute, inspired by FreeCAD's `src/App/Document.cpp recompute()`. This is the foundation for parametric CAD: when an entity changes, all downstream dependents recompute in topological order.

## Architecture

### DependencyGraph class (`core/include/core/document.hpp`)
- Directed graph: `source → dependent` edges
- `forward_[source] = {dependents}`, `reverse_[dependent] = {sources}`
- **API**:
  - `addDependency(source, dependent)` — add edge (no-op for self-loops)
  - `removeDependency(source, dependent)` — remove single edge
  - `removeEntity(id)` — remove all edges involving entity
  - `dependentsOf(source)` / `sourcesOf(dependent)` — query
  - `wouldCycle(source, dependent)` — BFS cycle detection before adding edge
  - `topologicalOrder(roots, &hasCycle)` — Kahn's algorithm on reachable subgraph
  - `allEntities()`, `edgeCount()`, `empty()`, `clear()`

### Document integration
- `dependency_graph()` — access the graph
- `set_recompute_callback(cb)` — register `void(Document&, EntityId)` callback
- `recompute(changedIds)` — topo-sort downstream, call callback for each (skips roots)
- `recompute_all()` — find root entities (no sources), topo-sort everything
- Graph cleared in `Document::clear()`

## FreeCAD Reference
- `src/App/Document.cpp:recompute()` — topological sort via `boost::topological_sort`
- `src/App/Document.cpp:_rebuildDependencyList()` — builds DAG from object expressions/links
- CADGameFusion uses entity-level rather than object-level granularity

## Test Results

### Unit tests (6 cases)
```
depgraph: basic edges PASS
depgraph: cycle detection PASS
depgraph: topological order PASS
depgraph: remove entity PASS
depgraph: document recompute PASS
depgraph: recompute_all PASS
```

### Test scenarios
1. **Basic edges**: A→B→C, verify dependentsOf/sourcesOf
2. **Cycle detection**: A→B→C, verify wouldCycle(3,1)=true, wouldCycle(4,1)=false
3. **Topological order**: Diamond A→B,C→D, verify order respects all edges
4. **Remove entity**: Remove middle node, verify edges cleaned up
5. **Document recompute**: 3-entity chain, recompute from root, verify only dependents called in order
6. **Recompute all**: 2-entity chain, verify both visited

### Regression
- Solver: 77/77 pass, 14 types ✅
- JS editor: 290/290 pass ✅
- All C++ targets build clean ✅

## Commit
`efe53ab feat: dependency graph + topological recompute (P3.2)`

## Next Steps
- P3.3: Constraint visualization UI (uses dependency graph to show constraint relationships)
- P3.5: 3D constraint solver (uses dependency graph for assembly-level recompute)
- Wire constraint solver to dependency graph: when solver converges, trigger recompute cascade
