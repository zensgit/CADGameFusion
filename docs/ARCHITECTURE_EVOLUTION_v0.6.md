# CADGameFusion 架构演进设计文档 v0.6.0+

> 版本: 1.2 (Code-aligned)
> 日期: 2025-12-18
> 状态: 草案（已对齐当前实现）

> 重要说明（稳定边界 / Stability Boundary）：
> - 对外稳定 ABI：`core_c` 的 C API（`cadgf_*`/`core_*`）与 `plugin_abi_c_v1` 的插件 C ABI（`cadgf_plugin_get_api_v1`）。
> - 内部实现细节：`core::Document` 等 C++ API 属于内部接口，不承诺跨 DLL/so 的 ABI 稳定；外部语言与插件应通过 C API 访问数据。

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
- 模块化改造（SHARED 库、稳定边界与可选 Pimpl）
- 插件系统设计
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
├── core/                 # 几何核心（SHARED + C ABI wrapper）
│   ├── include/core/
│   │   ├── document.hpp      # 文档模型（暴露 STL）
│   │   ├── geometry2d.hpp    # 2D 几何原语
│   │   ├── ops2d.hpp         # 2D 操作
│   │   ├── solver.hpp        # 约束求解器
│   │   ├── commands.hpp      # 命令系统
│   │   ├── core_c_api.h      # C API (cadgf_* preferred; core_* compat)
│   │   └── plugin_abi_c_v1.h # 插件 C ABI (function-table, v1)
│   └── src/
│
├── plugins/              # 示例插件（动态库，C ABI 函数表）
│   ├── sample_exporter_plugin.cpp
│   └── CMakeLists.txt
│
├── editor/qt/            # Qt 编辑器
│   ├── src/
│   │   ├── mainwindow.cpp    # 主窗口（紧耦合 Document）
│   │   ├── canvas.cpp        # 画布（已有 Snap）
│   │   └── ...
│   └── include/
│
└── tools/                # CLI 工具
    ├── export_cli.cpp
    ├── plugin_host_demo.cpp
    ├── plugin_registry.hpp
    └── shared_library.hpp
```

### 2.2 当前问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| Document 暴露 STL | **不作为稳定边界**；跨 DLL/so 不安全（Windows） | 高 |
| MainWindow 紧耦合 Document | 难以复用 Document | 中 |
| Editor 数据模型“双轨制” | Canvas 存一份、Document 存一份，影响撤销/序列化/约束 | 中 |
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
│                   Plugin Layer (C ABI)                       │
│   plugins: cadgf_plugin_get_api_v1 -> cadgf_plugin_api_v1     │
│   exporters/importers: cadgf_exporter_api_v1 / importer_api   │
│   Host: editor_qt / tools(plugin_registry.hpp)                │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C API (稳定 ABI)                       │
│                     core_c.so / dll                          │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ cadgf_document_* cadgf_solver_* cadgf_triangulate_* │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C++ (SHARED)                           │
│                      core.so / dll                           │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ Document │  │  Solver  │  │  Ops2D   │  │ Commands │   │
│   │ (internal) │  │          │  │          │  │          │   │
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
| Document | 暴露 STL（内部用） | **不承诺跨 DLL/so ABI**；如需跨边界再评估 Pimpl | 边界策略 |
| C API | 基础操作（已覆盖关键路径） | 逐步补齐缺口（保持向后兼容） | API 扩展 |

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
| Core ↔ 外部语言 | C API (cadgf_*) | 高（ABI 兼容） |
| Core ↔ Editor | C++ 接口（内部） | 中（源码兼容；不承诺 ABI） |
| Editor/Tools ↔ Plugin | 插件 C ABI（`plugin_abi_c_v1`） | 高（ABI 兼容） |
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
| W1 | SHARED 库构建 | CMakeLists.txt 修改 | 三平台构建通过，输出 `core` / `core_c` |
| W1 | C API 命名统一 | core_c_api.h | `cadgf_*` 为推荐入口；`core_*` 兼容保留 |
| W1 | C ABI 导出宏 | core_c_api.h / plugin_abi_c_v1.h | Windows DLL 无警告 |
| W2 | 稳定边界声明 | 文档/约定 | 明确：仅 C API + 插件 C ABI 承诺稳定 |
| W2 | Document Pimpl（可选） | document.hpp 重构 | **仅在需要跨 DLL/so 暴露 C++ API 时启动** |
| W2 | C API 扩展 | Layer/Solver API | 单元测试通过 |

### 5.3 Phase 2: 编辑器增强（v0.7.0）— 3 周

**目标**: 完善编辑器交互，引入插件架构

| 周 | 任务 | 交付物 | 验收标准 |
|----|------|--------|----------|
| W3 | 框选功能 | BoxSelect 实现 | 左→右/右→左 行为正确 |
| W3 | Snap 重构 | SnapManager 类 | Grid/Endpoint/Midpoint 工作 |
| W4 | 插件接口（C ABI） | plugin_abi_c_v1 | 示例插件 + Host 加载通过 |
| W4 | LineTool | 直线绘制工具 | 可绘制直线 |
| W5 | Rect/Circle Tool | 更多绘图工具 | 基础图形绘制 |
| W5 | 示例导出插件 | JSON Exporter（示例） | 可导出 JSON |

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

### 6.1 符号导出宏

当前实现将“稳定边界”的符号导出集中在 C ABI 头文件中：

- `core/include/core/core_c_api.h`：`CORE_API`/`CADGF_API`（Windows 下 `__declspec(dllexport/dllimport)`）
- `core/include/core/plugin_abi_c_v1.h`：`CADGF_PLUGIN_EXPORT`（插件入口点导出）

示例（节选）：

```c
// core/include/core/core_c_api.h
#ifdef _WIN32
#  ifdef CORE_BUILD
#    define CORE_API __declspec(dllexport)
#  else
#    define CORE_API __declspec(dllimport)
#  endif
#else
#  define CORE_API
#endif

#ifndef CADGF_API
#  define CADGF_API CORE_API
#endif
```

### 6.2 CMake 构建配置

当前仓库实现的要点是：`core` 为 SHARED，`core_c` 为**薄封装**并链接到 `core`，以避免同进程出现两份 Core 实现（详见 `docs/CMAKE_TARGET_SPLIT_v0.6.md`）。

```cmake
# core/CMakeLists.txt（节选，当前实现）
add_library(core SHARED
    src/geometry2d.cpp
    src/document.cpp
    src/commands.cpp
    src/ops2d.cpp
    src/solver.cpp
)

set_target_properties(core PROPERTIES WINDOWS_EXPORT_ALL_SYMBOLS ON)

add_library(core_c SHARED src/core_c_api.cpp)
target_link_libraries(core_c PRIVATE core)
target_include_directories(core_c PUBLIC include)
target_compile_definitions(core_c PRIVATE CORE_BUILD)
```

插件示例（节选）：

```cmake
# plugins/CMakeLists.txt（节选，当前实现）
add_library(cadgf_sample_plugin SHARED sample_exporter_plugin.cpp)
target_link_libraries(cadgf_sample_plugin PRIVATE core_c)
```

### 6.3 C++ API 稳定性（不承诺 ABI）

当前阶段**不以 C++ API（如 `core::Document`）作为跨 DLL/so 的稳定边界**，因此：

- `core::Document` 可以继续使用 STL 类型（`std::vector/std::string`），作为内部实现与 Editor 直接链接使用；
- 外部语言绑定与插件扩展只通过 `core_c` 的 C API 访问 `cadgf_document`；
- 如未来确需跨边界暴露 C++ API，再评估 Pimpl/句柄化（成本高，需慎重）。

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

## 7. 插件系统设计

### 7.1 插件接口定义

当前实现采用 **C ABI 函数表（Function Table）** 作为插件边界（避免 C++ 虚函数 ABI 地狱），接口定义位于：

- `core/include/core/plugin_abi_c_v1.h`

核心约定：

- 插件必须导出：`cadgf_plugin_get_api_v1()`（返回 `cadgf_plugin_api_v1*`）
- Host 通过 `size`/`abi_version` 做兼容性校验；在 v1 内**只允许追加字段**（append-only）

示例（节选）：

```c
// core/include/core/plugin_abi_c_v1.h（节选）
#define CADGF_PLUGIN_ABI_V1 1
typedef struct cadgf_plugin_api_v1 {
    int32_t size;
    int32_t abi_version;
    cadgf_plugin_desc_v1 (*describe)(void);
    int32_t (*initialize)(void);
    void (*shutdown)(void);
    int32_t (*exporter_count)(void);
    const cadgf_exporter_api_v1* (*get_exporter)(int32_t index);
    int32_t (*importer_count)(void);
    const cadgf_importer_api_v1* (*get_importer)(int32_t index);
} cadgf_plugin_api_v1;

typedef const cadgf_plugin_api_v1* (*cadgf_plugin_get_api_v1_fn)(void);
```

### 7.2 插件管理器（Host）

当前仓库提供了一个轻量 Host 实现用于加载/校验插件：

- `tools/shared_library.hpp`：跨平台 `dlopen/LoadLibrary` 封装
- `tools/plugin_registry.hpp`：加载 `cadgf_plugin_get_api_v1`，做 ABI 校验与 exporter/ importer 枚举
- `tools/plugin_host_demo.cpp`：最小可运行示例（加载插件并导出）

Editor 侧也已接入插件导出菜单（通过 `cadgf::PluginRegistry`）。

### 7.3 示例插件

当前提供示例导出插件（JSON）：

- `plugins/sample_exporter_plugin.cpp`

该插件仅通过 C API（`cadgf_document_*`）读取文档数据并写出文件，避免依赖 C++ 内部结构。

---

## 8. 编辑器增强设计 (内容同前，略)

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
