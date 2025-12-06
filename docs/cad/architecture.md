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

## Constraint Solver (PoC)

**当前状态**: 概念验证 (Proof of Concept) 实现，提供基础约束求解能力。后续将引入完整的 Gauss-Newton/Levenberg-Marquardt 算法与终止条件优化。

- Interfaces
  - `core/include/core/solver.hpp`
    - `struct VarRef { id, key }` — identifies a model variable (e.g., point id + component key `x|y`).
    - `struct ConstraintSpec { type, vars[], value? }` — declarative constraint spec.
    - `class ISolver` — API surface:
      - `setMaxIterations(int)`, `setTolerance(double)`
      - `solve(std::vector<ConstraintSpec>&)` — legacy no-binding entry（兼容用途）
      - `solveWithBindings(constraints, GetVar, SetVar)` — 基于回调的绑定式求解：
        - `GetVar(const VarRef&, bool& ok) -> double`
        - `SetVar(const VarRef&, double)`
        - 默认行为：若派生类未覆盖，将桥接回 `solve(...)`，确保向后兼容。

- Residual design (current PoC)
  - Supported: `horizontal`, `vertical`, `distance`, `parallel`, `perpendicular`, `equal`
  - Residuals map to zero targets:
    - horizontal: `y1 - y0 → 0`
    - vertical: `x1 - x0 → 0`
    - distance: `|p1 - p0| - d → 0`
    - parallel: `sin(angle(v1, v2)) → 0` (uses cross/norms)
    - perpendicular: `cos(angle(v1, v2)) → 0` (uses dot/norms)
    - equal: `a - b → 0`

- Update strategy (current PoC)
  - **当前实现**: MinimalSolver 提供占位实现，仅计算残差但不修改变量值
  - **计划升级**: 完整的 Gauss-Newton 算法实现，包括：
    - 有限差分雅可比矩阵计算 `J`
    - Levenberg-Marquardt 阻尼策略避免发散
    - 自适应步长与线搜索
    - 收敛判断与终止条件（残差范数、梯度范数、步长）
  - Tunables: `maxIters`, `tol`
  - **时间线**: v0.2 版本将包含完整数值优化实现

- Tests
  - `tests/core/test_solver_poc.cpp` — API smoke.
  - `tests/core/test_solver_constraints.cpp` — constraint residuals + simple convergence checks.
  - `tests/core/test_solver_conflicts.cpp` — 冲突/不一致约束测试（Trial工作流，非阻塞）：
    - 冲突的水平约束（同一点不能同时在不同y坐标）
    - 违反三角不等式的距离约束
    - 过定系统（约束数超过自由度）
  - 失败路径验证：不一致系统在 trial 工作流中进行验证，避免影响主门禁。

- Next steps
  - Add proper Jacobian assembly and damped Gauss–Newton; expose iteration stats.
  - Introduce typed model accessors (points/lines) to avoid stringly-typed `VarRef` at call sites.
  - Extend schema to encode constraint refs typing; generate `ConstraintSpec` from project JSON.

## Project Schema — Constraints (v1)

- Location: `schemas/project.schema.json`
- Constraint object fields (recommended):
  - `id: string`
  - `type: string` — one of `horizontal`, `vertical`, `distance`, `parallel`, `perpendicular`, `equal`, ...
  - `refs: string[]` — referenced entity ids or explicit components (e.g., `p1`, `p2` or `p1.x`)
  - `value: null | number` — null for no‑value constraints, numeric for valued constraints (e.g., `distance`)

Examples
```
// Horizontal: accept a line id (expanded to its endpoints' y) or two point ids
{"id":"c1","type":"horizontal","refs":["l1"],"value":null}

// Distance: accept two point ids; expanded to (x0,y0,x1,y1)
{"id":"c2","type":"distance","refs":["p1","p2"],"value":10.0}
```

Notes
- The schema accepts `refs` as the binding array (alias to internal `vars`), with `value` either `null` (no‑value constraints) or `number` (valued constraints).
- `tools/solve_from_project.cpp` expands ids to components for bindings and calls `ISolver::solveWithBindings(...)`.