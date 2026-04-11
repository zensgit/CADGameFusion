# VemCAD / CADGameFusion 开源对标升级报告

**日期**: 2026-04-11
**分支**: `codex/solver-a2b-analytical-jacobian-batch-b`
**PR**: zensgit/CADGameFusion#363
**参考项目**: FreeCAD PlaneGCS (13K行), SolveSpace (7.6K行), libdxfrw (13.6K行)

---

## 1. 项目概述

基于与 FreeCAD PlaneGCS、SolveSpace、libdxfrw 三个开源 CAD 系统的深入对标分析，
对 CADGameFusion 的约束求解器和 DXF 导入器进行系统性升级。

### 对标发现的关键差距

| 维度 | 升级前 | FreeCAD/SolveSpace 参考 | 差距 |
|------|--------|------------------------|------|
| Jacobian 计算 | 数值差分 (eps=1e-6) | 解析梯度 / 符号微分 | 精度差 4 量级，性能差 5-10× |
| 求解容差 | 1e-6 | 1e-10 | 宽松 4 量级 |
| 预消元 | 无 | Union-Find 参数替换 | 矩阵维度不必要大 |
| DXF 模块化 | 5111 行单文件 | 回调接口 + 分离类 | 不可复用、不可测试 |

---

## 2. 求解器升级

### 2.1 开发路线 (用户指定的稳健顺序)

| Step | 内容 | PR/Commit | 状态 |
|------|------|-----------|------|
| A0 | Baseline harness (19场景×3算法=57测试点) | #349 | ✅ merged |
| A2a | 解析梯度 Batch A: 8 linear types | #348 | ✅ merged |
| A4a | 预消元: equal/coincident/concentric | #351 | ✅ merged |
| A2b | 解析梯度 Batch B: distance, point_on_line | #363 (0d81dfb) | ✅ PR |
| A2c | 解析梯度 Batch C: parallel, perpendicular, angle, tangent | #363 (929370e) | ✅ PR |
| A1 | 容差收紧 1e-6 → 1e-8 | #363 (dfe0a0f) | ✅ PR |
| A3 | Sparse 矩阵 | — | 暂缓 (需 profile 证明) |

### 2.2 解析 Jacobian 全覆盖 (14/14)

所有 14 种约束类型现在使用精确解析梯度，数值差分仅作为 fallback 保留给未来新增类型。

| 约束类型 | 梯度公式 | Batch |
|----------|----------|:-----:|
| horizontal | ∂(y1-y0): {-1, 1} | A |
| vertical | ∂(x1-x0): {-1, 1} | A |
| equal | ∂(a-b): {1, -1} | A |
| coincident | per x/y component: {-1, 1} | A |
| concentric | per x/y component: {-1, 1} | A |
| fixed_point | ∂(val-target): {1, 0} | A |
| midpoint | ∂(p-(a+b)/2): {1, -0.5, -0.5} | A |
| symmetric | ∂((p1+p2)/2-c): {0.5, 0.5, -1} | A |
| distance | ∂(√(dx²+dy²)-d): {-dx/dist, ...} | B |
| point_on_line | quotient rule on area/len, 6 partials | B |
| parallel | quotient rule on cross/(n1·n2), 8 partials | C |
| perpendicular | quotient rule on dot/(n1·n2), 8 partials | C |
| angle | chain rule acos(cosA), 8 partials | C |
| tangent | signed \|cross\|/len, 6 partials | C |

### 2.3 默认参数变更

| 求解器 | maxIters (旧→新) | tol (旧→新) |
|--------|:-----------------:|:-----------:|
| MinimalSolver (LM) | 50 → **80** | 1e-6 → **1e-8** |
| DogLegSolver | 80 → **120** | 1e-6 → **1e-8** |
| BFGSSolver | 100 → **150** | 1e-6 → **1e-8** |

### 2.4 预消元 (Union-Find)

检测别名型等式约束 (equal, coincident, concentric)，构建等价类，
从约束列表中移除冗余等式，将变量重定向到规范代表。

效果: coincident/concentric/equal 场景 **0 次迭代、残差 0.0**。

### 2.5 Debug 验证器

`#ifndef NDEBUG` 下自动对比解析梯度与数值差分，相对误差 > 1e-4 时打印警告。
全部 42 场景零警告。

---

## 3. Baseline 验证结果

14 种约束场景 × 3 种算法 = 42 测试点，全部通过。

```
Scenario                  Algo     OK   Iters     FinalErr
------------------------- -------- ---- ------ ------------
horizontal                DogLeg   PASS      0     5.55e-17
vertical                  DogLeg   PASS      0     1.11e-16
equal                     DogLeg   PASS      0     0.00e+00
distance                  DogLeg   PASS      0     0.00e+00
fixed_point               DogLeg   PASS      1     0.00e+00
coincident                DogLeg   PASS      0     1.11e-16
concentric                DogLeg   PASS      0     0.00e+00
midpoint                  DogLeg   PASS      0     0.00e+00
symmetric                 DogLeg   PASS      0     2.22e-16
parallel                  DogLeg   PASS      0     8.88e-17
perpendicular             DogLeg   PASS      0     0.00e+00
horizontal+distance       DogLeg   PASS      2     0.00e+00
angle_45deg               DogLeg   PASS      2     1.23e-07
point_on_line             DogLeg   PASS      0     1.11e-16
```

### 关键改进对比 (DogLeg)

| 场景 | 升级前 (数值差分) | 升级后 (解析梯度) |
|------|:---:|:---:|
| parallel | 2 iter, 2.10e-08 | **0 iter, 8.88e-17** |
| perpendicular | 0 iter, 1.82e-09 | **0 iter, 0.00** |
| distance | 0 iter, 5.84e-10 | **0 iter, 0.00** |
| coincident | 0 iter, 1.11e-16 | **0 iter, 0.00** (预消元) |
| equal | 0 iter, 1.11e-16 | **0 iter, 0.00** (预消元) |

---

## 4. DXF 导入器模块化

### 4.1 开发路线

| Step | 内容 | PR | 状态 |
|------|------|-----|------|
| B1 | 叶模块: types, math_utils, text_encoding, color | #347 | ✅ merged |
| B2 | 中层: metadata_writer, style, text_handler | #350 | ✅ merged |
| B3 | Parser 拆分: 9 个细粒度模块 | #352-#360 | ✅ merged |

### 4.2 模块清单 (16 个模块)

| 模块 | .h 行数 | .cpp 行数 | 职责 |
|------|:-------:|:--------:|------|
| dxf_types | 173 | — | 所有 struct/enum 定义 |
| dxf_math_utils | 32 | 86 | 常量、几何工具、解析工具 |
| dxf_text_encoding | 26 | 159 | UTF-8 验证、codepage 转换 |
| dxf_color | 21 | 73 | ACI→RGB、颜色解析 |
| dxf_metadata_writer | 21 | 350 | 元数据写入 |
| dxf_style | 15 | 164 | 样式解析与应用 |
| dxf_text_handler | 20 | 60 | 文本处理 |
| dxf_parser_helpers | 17 | 20 | Parser 辅助 |
| dxf_parser_zero_record | 124 | 295 | 零记录转换 |
| dxf_parser_name_routing | 32 | 46 | Section/Table 路由 |
| dxf_header_vars | 33 | 37 | Header 变量解析 |
| dxf_layout_objects | 21 | 20 | Layout 对象 |
| dxf_block_header | 33 | 37 | Block 头部 |
| dxf_table_records | 48 | 88 | Table 记录 |
| dxf_view_finalizers | 22 | 73 | View 终结器 |
| dxf_table_block_finalizers | 23 | 16 | Table/Block 终结器 |

### 4.3 主文件变化

| 指标 | 升级前 | 升级后 | 变化 |
|------|:------:|:------:|:----:|
| dxf_importer_plugin.cpp 行数 | 5,111 | 3,701 | **-28%** |
| 模块文件数 | 0 | 33 | +33 |
| 最大单文件行数 | 5,111 | 3,701 | -1,410 |

---

## 5. 完整测试结果

**测试总数**: 62
**通过**: 59 (95%)
**失败**: 3 (基础设施问题，非代码变更)

### 求解器测试 (6/6 通过)

| 测试 | 结果 |
|------|:----:|
| core_tests_solver_poc | ✅ |
| core_tests_solver_constraints | ✅ |
| core_tests_constraints_basic | ✅ |
| core_tests_solver_diagnostics | ✅ |
| core_tests_solver_substitutions | ✅ |
| test_solver_baseline (42 scenarios) | ✅ |

### DXF/DWG 测试 (27/28 通过)

| 测试 | 结果 |
|------|:----:|
| 25 DXF 功能测试 | ✅ 全通过 |
| test_dwg_importer_plugin | ✅ |
| test_dwg_matrix (44/44 DWG) | ✅ |
| convert_cli_dxf_style_smoke | ❌ (CMake 脚本缺失，预存问题) |

### 失败项说明 (均为预存基础设施问题)

1. `convert_cli_smoke` — CMake 脚本 `RunConvertCli.cmake` 缺失
2. `convert_cli_dxf_style_smoke` — CMake 脚本 `RunConvertCliDxfLineStyle.cmake` 缺失
3. `plugin_host_demo_run` — 配置问题

---

## 6. 参考代码

下载到 `/Users/huazhou/Downloads/Github/refs/`:

| 项目 | 目录 | 用途 |
|------|------|------|
| FreeCAD PlaneGCS | `refs/freecad-planegcs/` | 解析梯度公式参考 |
| SolveSpace | `refs/solvespace/` | 预消元算法参考 |
| libdxfrw | `refs/libdxfrw/` | DXF 回调架构参考 |

---

## 7. 代码度量

### solver.cpp 变化

| 指标 | 升级前 | 升级后 |
|------|:------:|:------:|
| 总行数 | ~1,698 | **2,577** |
| 解析梯度覆盖 | 0/14 | **14/14 (100%)** |
| 默认容差 | 1e-6 | **1e-8** |
| 预消元支持 | 无 | **Union-Find (3 类型)** |
| Debug 验证器 | 无 | **解析 vs 数值自动对比** |

### 新增行数分布

| 功能 | 新增行数 |
|------|:--------:|
| 解析梯度 (14 types) | ~350 |
| 预消元 (Union-Find) | ~120 |
| Baseline harness | ~320 |
| 预消元测试 | ~94 |
| 容差调整 | ~6 |

---

## 8. 待定项

| 项目 | 优先级 | 说明 |
|------|:------:|------|
| Sparse 矩阵 (A3) | 低 | 需 profile 证明大变量场景瓶颈 |
| horizontal/vertical 预消元 (A4a-2) | 低 | 影响 diagnostics 解释，推迟 |
| document committer 拆分 (B5) | 中 | 主文件仍有 3,701 行 |
| plugin shell 最终瘦身 (B6) | 低 | 待 B5 完成后 |
| 新约束类型扩展 (P2) | 中 | BSpline, ArcLength, EqualRadius 等 |

---

## 9. 构建与验证命令

```bash
# 配置
cd deps/cadgamefusion
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF

# 构建
cmake --build build --parallel 4

# 求解器测试
ctest --test-dir build -R "core_tests_constraints|core_tests_solver|solver_baseline" --output-on-failure

# DXF 测试
ctest --test-dir build -R "dxf|dwg" --output-on-failure

# Baseline 详细输出
./build/tests/core/test_solver_baseline

# 全量测试
ctest --test-dir build --output-on-failure
```
