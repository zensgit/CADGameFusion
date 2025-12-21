# CADGameFusion 架构演进设计文档 v0.6.0+

> 版本: 1.2 (Reality-aligned)
> 日期: 2025-12-19
> 状态: 修订草案（对齐仓库现状）

**重要声明（稳定边界 / Stability Boundary）**：
- 对外承诺的稳定边界仅包含 **C ABI**：
  - `core/include/core/core_c_api.h`（`cadgf_*` C API；`cadgf_document*` 为不透明句柄）
  - `core/include/core/plugin_abi_c_v1.h`（插件 ABI：C 函数表 `cadgf_plugin_api_v1`）
- `core/include/core/document.hpp` 的 `core::Document` 属于 **内部 C++ API**：不承诺跨 DLL/跨编译器 ABI 稳定；若未来要作为对外 C++ SDK，再评估 Pimpl/导出策略。
- 运行时兼容性：使用 `cadgf_get_abi_version()` 校验 ABI 级别，使用 `cadgf_get_feature_flags()` 判断编译特性。

---

## 目录

1. [概述](#1-概述)
2. [当前架构分析](#2-当前架构分析)
3. [目标架构](#3-目标架构)
4. [模块化策略](#4-模块化策略)
5. [阶段实施计划](#5-阶段实施计划)
6. [详细设计](#6-详细设计)
7. [插件系统设计](#7-插件系统设计)
8. [编辑器增强设计](#8-编辑器增强设计)
9. [约束系统增强](#9-约束系统增强)
10. [测试策略](#10-测试策略)
11. [风险与缓解](#11-风险与缓解)
12. [参考资料](#12-参考资料)

---

## 1. 概述

### 1.1 文档目的

本文档定义 CADGameFusion 从 v0.5.0 向 v0.8.0 演进的架构设计，包括：
- 模块化改造（`core`/`core_c` 目标拆分与稳定边界）
- 插件系统设计（以 **C ABI 函数表**为主，避免 C++ 虚函数 ABI 地狱）
- 编辑器功能增强
- 约束系统完善

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **渐进式演进** | 不破坏现有功能，逐步重构 |
| **接口稳定性** | C API 保持向后兼容 |
| **轻量级依赖** | 避免引入重量级库（如 OpenCASCADE） |
| **可测试性** | 每个模块独立可测 |
| **跨平台一致** | Windows/macOS/Linux 行为一致 |

### 1.3 非目标

- 微服务化（桌面应用不适用，优先 IPC 隔离）
- 完整 B-Rep 内核（保持 2D 为主）
- 大规模 API 重设计（保持兼容）

---

## 2. 当前架构分析

### 2.1 现有模块结构

```
CADGameFusion/
├── core/                 # 几何核心（C++ 实现）+ C ABI wrapper（稳定边界）
│   ├── include/core/
│   │   ├── document.hpp      # 文档模型（内部 C++ API；暴露 STL）
│   │   ├── geometry2d.hpp    # 2D 几何原语
│   │   ├── ops2d.hpp         # 2D 操作
│   │   ├── solver.hpp        # 约束求解器
│   │   ├── commands.hpp      # 命令系统
│   │   ├── core_c_api.h      # C API（稳定边界；cadgf_* 推荐，core_* 兼容别名）
│   │   └── plugin_abi_c_v1.h # 插件 ABI（稳定边界；C 函数表）
│   └── src/
│
├── editor/qt/            # Qt 编辑器
│   ├── src/
│   │   ├── mainwindow.cpp    # 主窗口（紧耦合 Document）
│   │   ├── canvas.cpp        # 画布（已有 Snap）
│   │   └── ...
│   └── include/
│
└── tools/                # CLI 工具
    └── export_cli.cpp
```

### 2.2 当前问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| `core::Document` 暴露 STL | **仅当**把 C++ API 当成跨 DLL/跨编译器边界时才危险；当前策略是把稳定边界收敛到 C API | 中 |
| MainWindow 紧耦合 Document | 难以复用 Document | 中 |
| 文档误导：插件=虚函数 | 与仓库现状不符；当前已有 `plugin_abi_c_v1`（C ABI 函数表） | 中 |
| Editor 数据模型“双轨制” | **已显著收敛**：编辑/删除/导出均落到 Document；Canvas 仅保留投影缓存与命中测试 | 低 |
| API 命名通用性 | 已引入 cadgf_ 作为推荐前缀，core_ 仅兼容 | 低 |

### 2.3 依赖关系图（当前）

```
┌─────────────────────────────────────────────────────┐
│                    editor_qt                         │
│              (QMainWindow, QWidget)                  │
└──────────────────────┬──────────────────────────────┘
                       │ 直接依赖
                       ▼
┌─────────────────────────────────────────────────────┐
│                  core (SHARED)                       │
│    Document, Solver, Ops2D, Geometry2D              │
│         暴露 std::vector<Layer>, std::string        │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌────────┐    ┌──────────┐   ┌─────────┐
   │Clipper2│    │  Earcut  │   │ Eigen3  │
   └────────┘    └──────────┘   └─────────┘
```

---

## 3. 目标架构

### 3.1 架构愿景（v0.8.0）

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontends                               │
│   ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐ │
│   │ Qt Editor│  │  Unity   │  │   CLI   │  │ Web (未来)  │ │
│   └─────┬────┘  └────┬─────┘  └────┬────┘  └──────┬──────┘ │
└─────────┼────────────┼─────────────┼──────────────┼────────┘
          │            │             │              │
          └────────────┴──────┬──────┴──────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                     Plugin Layer                             │
│   ┌───────────────────────┐  ┌───────────────────────┐      │
│   │ Exporter ABI (C v1)   │  │ Importer ABI (C v1)   │      │
│   └───────────────────────┘  └───────────────────────┘      │
│   Host: tools/plugin_registry.hpp (dlopen/LoadLibrary)        │
│   Note: Editor UI tools 插件化属于 editor-only ABI（后置）      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C API (稳定 ABI)                       │
│                    core_c (SHARED)                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ cadgf_document_* cadgf_solver_* cadgf_triangulate_* │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C++ (SHARED)                           │
│                    core (SHARED)                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ Document │  │  Solver  │  │  Ops2D   │  │ Commands │   │
│   │ (internal│  │          │  │          │  │          │   │
│   │  C++ API)│  │          │  │          │  │          │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    Dependencies                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│   │ Clipper2 │  │  Earcut  │  │  Eigen3  │  │ TinyGLTF  │  │
│   └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 关键变更摘要

| 组件 | 当前 | 目标 | 变更类型 |
|------|------|------|----------|
| core 库 | SHARED（`core`）+ C ABI wrapper（`core_c`） | SHARED（保持） | 构建系统 |
| API 前缀 | `core_`（兼容）/ `cadgf_`（推荐） | `cadgf_` | 接口重构 |
| Document | 暴露 STL（内部 C++ API） | 若未来对外发布 C++ SDK，再评估 Pimpl/导出策略 | API 策略 |
| C API | 基础操作 | 完整覆盖 | API 扩展 |

---

## 4. 模块化策略

### 4.1 为什么不微服务化？

| 因素 | 分析 | 结论 |
|------|------|------|
| 应用类型 | 桌面 CAD，非 Web 服务 | 不适用 |
| 性能要求 | 毫秒级几何运算响应 | 网络延迟不可接受 |
| 数据耦合 | 几何数据需共享内存访问 | 序列化开销过高 |
| 扩展需求 | 本地插件足够 | 无需服务拆分 |

*建议*：如果需要进程隔离（防止崩溃），优先使用**本地 IPC (Inter-Process Communication)** 模式运行 Worker 进程，而不是网络微服务。

### 4.2 模块化层次

```
Level 3: 动态插件 (.so/.dll)
         - 运行时加载
         - 第三方扩展

Level 2: 共享库 (SHARED)
         - 跨语言绑定 (Python/C#)
         - ABI 稳定

Level 1: 静态库 (STATIC)
         - 内部链接
         - 编译时优化

Level 0: 头文件模块
         - 接口定义
         - 零开销抽象
```

### 4.3 边界定义

| 边界 | 接口类型 | 稳定性 |
|------|----------|--------|
| Host ↔ 外部语言 | C API（`cadgf_*`） | 高（ABI 兼容） |
| Host ↔ Plugins | 插件 ABI（`plugin_abi_c_v1`：C 函数表） | 高（ABI 兼容；append-only within v1） |
| Core ↔ Editor | C++ 内部接口（`core::Document`） | 低（仅源码级；不承诺跨 DLL ABI） |
| Editor ↔ UI Tools | 先内置（Qt 内部扩展点） | 低（后续可单独设计 editor-only ABI） |
| 内部模块 | 直接调用 | 低（可变） |

---

## 5. 阶段实施计划

### 5.1 总体时间线

```
2025-12                    2026-01                    2026-02
    │                          │                          │
    ├── Phase 1 ──────────────►├── Phase 2 ──────────────►├── Phase 3 ──►
    │   v0.6.0                 │   v0.7.0                 │   v0.8.0
    │   Core 模块化             │   编辑器增强              │   约束系统
    │   2 周                    │   3 周                   │   4 周
    │                          │                          │
```

### 5.2 Phase 1: Core 模块化（v0.6.0）— 2 周

**目标**: 将 Core 转换为可动态加载的共享库，并统一 API 命名。

| 周 | 任务 | 交付物 | 验收标准 |
|----|------|--------|----------|
| W1 | SHARED 库构建 | `core` + `core_c`（CMake） | 三平台构建通过，输出 `core`/`core_c` |
| W1 | API 命名与兼容 | `core_c_api.h` | `cadgf_*` 为推荐 ABI；`core_*` 兼容别名可用 |
| W1 | Windows 导出策略 | CMake + `CORE_BUILD` | `core` 可用（`WINDOWS_EXPORT_ALL_SYMBOLS`）；`core_c` 导出 C API |
| W2 | （可选/后置）C++ ABI 稳定 | Pimpl/导出策略评估 | 仅在“要对外发布 C++ SDK”时才做 |
| W2 | C API 扩展 | Layer/Solver API | 单元测试通过 |

### 5.3 Phase 2: 编辑器增强（v0.7.0）— 3 周

**目标**: 完善编辑器交互，引入插件架构

| 周 | 任务 | 交付物 | 验收标准 |
|----|------|--------|----------|
| W3 | 框选功能 | BoxSelect 实现 | 左→右/右→左 行为正确 |
| W3 | Snap 重构 | SnapManager 类 | Grid/Endpoint/Midpoint 工作 |
| W4 | 插件 ABI v1 | `plugin_abi_c_v1.h` + 文档 | `cadgf_plugin_get_api_v1` 可被 host 加载并通过校验 |
| W4 | LineTool | 直线绘制工具 | 可绘制直线 |
| W5 | Rect/Circle Tool | 更多绘图工具 | 基础图形绘制 |
| W5 | 示例导出插件 | SVG Exporter | 可导出 SVG |

### 5.4 Phase 3: 约束系统（v0.8.0）— 4 周

**目标**: 完善约束求解器和 UI 集成

| 周 | 任务 | 交付物 | 验收标准 |
|----|------|--------|----------|
| W6 | 约束面板 UI | ConstraintPanel | 可添加/删除约束 |
| W6 | 约束可视化 | ConstraintRenderer | 约束符号正确显示 |
| W7 | 求解器集成 | Solver UI 绑定 | 点击求解按钮生效 |
| W7 | 冲突检测 | ConflictInfo 结构 | 冲突约束高亮 |
| W8 | 尺寸约束输入 | DimensionInput 控件 | 可输入尺寸值 |
| W9 | 草图模式原型 | SketchMode 类 | 进入/退出草图 |

---

## 6. 详细设计

### 6.1 符号导出与 ABI 边界（现状对齐）

当前仓库选择把“稳定性成本”集中在 **C ABI**，避免在 Windows 上为 C++ 跨 DLL ABI 稳定付出高昂代价。

- C API 导出：`core/include/core/core_c_api.h`
  - 使用 `CORE_API` / `CADGF_API` 宏；
  - 构建 `core_c` 时定义 `CORE_BUILD` 以导出符号。
- C++ core（`core`）导出：
  - `core/CMakeLists.txt` 在 Windows 上使用 `WINDOWS_EXPORT_ALL_SYMBOLS ON`（便于 editor/内部使用）。
  - **不承诺** `core::Document` 跨 DLL/跨编译器 ABI 稳定。
- 插件导出：`core/include/core/plugin_abi_c_v1.h`
  - `CADGF_PLUGIN_EXPORT` 用于导出插件入口符号 `cadgf_plugin_get_api_v1`。

### 6.2 CMake 构建配置（现状对齐）

以 v0.6.x 现有代码为准：

- `core`：C++ 实现库（SHARED）
- `core_c`：C ABI wrapper（SHARED，链接到 `core`，避免同进程双份 core 实现）
- 目标拆分的动机与推荐图谱：`docs/CMAKE_TARGET_SPLIT_v0.6.md`
- 依赖建议统一走 vcpkg manifest：`vcpkg.json`（Eigen3/Clipper2/TinyGLTF/Earcut）

### 6.3 Document Pimpl（后置）

`core::Document` 当前被定位为内部 C++ API（editor/内部工具同编译器同 CRT 场景使用）。
只有在“要对外发布 C++ SDK / 跨 DLL”成为明确目标时，才考虑引入 Pimpl 与更严格的导出策略。

### 6.4 API 命名规范与迁移策略

为了避免 `core_` 前缀过于通用导致的冲突，v0.6.0 将引入 `cadgf_` 前缀作为标准 ABI。

| 组件 | C++ 命名空间 | C API 前缀 | 库名称 (Target) |
|------|--------------|------------|-----------------|
| Core (C++ API) | `core::`     | N/A | `core` |
| C Wrapper (C ABI) | N/A | `cadgf_`（推荐），`core_`（兼容） | `core_c` |
| Plugins | N/A | `cadgf_` | `(plugin_name)` |

**迁移计划：**
1.  **v0.6.0**: `core_c` 导出 `cadgf_*` 作为标准 ABI；`core_*` 继续保留为兼容别名（同一动态库内薄转发）。
2.  **v0.7.0**: 更新所有官方示例和工具（Unity, CLI）默认使用 `cadgf_*`。
3.  **v0.8.0+**: 视生态情况再决定是否 deprecate/移除 `core_*`（不强行承诺时间点）。

---

## 7. 插件系统设计（C ABI 函数表）

插件系统以 **C ABI function-table** 为稳定边界，避免 C++ 虚函数/RTTI/异常/STL 跨 DLL 引发的 ABI 与 CRT 兼容问题。

### 7.1 入口符号与版本检查

- 插件共享库必须导出一个入口符号：`cadgf_plugin_get_api_v1`
- 返回 `const cadgf_plugin_api_v1*`，由 host 做以下检查：
  - `api != NULL`
  - `api->abi_version == CADGF_PLUGIN_ABI_V1`
  - `api->size >= sizeof(cadgf_plugin_api_v1_min)`（v1 追加字段的兼容保障）

最小示意：

```c
/* plugin_abi_c_v1.h */
extern "C" CADGF_PLUGIN_EXPORT const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void);
```

### 7.2 Host 侧加载流程（现状）

- 加载：`tools/shared_library.hpp`
- 注册/校验/枚举 exporter/importer：`tools/plugin_registry.hpp`
- 插件与文档交互：仅允许通过 `core/include/core/core_c_api.h` 的 `cadgf_*` C API（不跨边界传递 STL）

### 7.3 参考实现与规范

- ABI 头文件：`core/include/core/plugin_abi_c_v1.h`
- 设计文档：`docs/PLUGIN_ABI_C_V1.md`
- 示例插件：`plugins/sample_exporter_plugin.cpp`

> 注：Editor 的 UI 工具类插件（ITool/交互/渲染）与 Qt 强耦合，建议后置单独设计 editor-only ABI；v0.6–v0.8 先聚焦 core-level importer/exporter。

---

## 8. 编辑器增强设计（对齐现状 + 后续方向）

### 8.1 统一数据模型：Document 为真相，Canvas 为投影（优先级高）

现状进展（v0.6.0+）：
- **编辑/删除/导出均基于 Document**（含插件导出），Canvas 仅作为渲染投影。
- Canvas 保留命中测试与渲染缓存，选择状态已上收到 MainWindow 层统一维护。

建议方向：
- **Document 作为 Single Source of Truth**：所有编辑操作先落到 Document（或命令系统），再通知 Canvas 更新渲染投影。
- Canvas 只做：
  - 视口/坐标变换
  - 命中测试（可缓存加速）
  - 临时交互态（rubber band / preview），但不持久化业务数据

渐进迁移建议：
1. 新功能（约束、撤销）全部基于 Document 实现，不再扩展 Canvas 的持久状态。
2. 将 Canvas 的持久数据逐步替换为从 Document 派生的缓存/投影（允许一段时间“双写”，但要集中到单个同步层）。
3. 最终删除 Canvas 的业务持久容器，仅保留渲染缓存。

## 9. 约束系统增强 (内容同前，略)

## 10. 测试策略 (内容同前，略)

## 11. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Pimpl 性能损耗 | 低 | 低 | 对热点路径（如渲染循环）保留内联访问或批量 API |
| 插件 ABI 不兼容 | 高 | 高 | 严格的 API 版本检查；提供 C 接口作为兜底 |
| Windows DLL 地狱 | 中 | 高 | 使用 vcpkg 统一管理所有依赖的 CRT 版本 |
| 迁移到 cadgf_ 破坏现有代码 | 高 | 中 | 保留 core_ 转发层至少一个大版本 |

---

## 12. 参考资料

- [C++ Pimpl Idiom](https://cpppatterns.com/patterns/pimpl.html)
- [Qt Plugin System](https://doc.qt.io/qt-6/plugins-howto.html)
- [TinyGLTF](https://github.com/syoyo/tinygltf)
- [Eigen](https://eigen.tuxfamily.org/)
