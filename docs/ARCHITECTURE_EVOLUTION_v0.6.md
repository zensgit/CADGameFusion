# CADGameFusion 架构演进设计文档 v0.6.0+

> 版本: 1.1 (Revised)
> 日期: 2025-12-17
> 状态: 草案

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
- 模块化改造（SHARED 库、Pimpl 模式）
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
│   │   └── core_c_api.h      # C API (cadgf_* preferred; core_* compat)
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
| Document 暴露 STL | 跨 DLL 边界不安全（Windows） | 高 |
| MainWindow 紧耦合 Document | 难以复用 Document | 中 |
| 无插件架构 | 扩展需修改源码 | 中 |
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
│   ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│   │ IExporter │  │   ITool   │  │ IImporter │               │
│   └───────────┘  └───────────┘  └───────────┘               │
│                  PluginManager                               │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C API (稳定 ABI)                       │
│                    cadgf_core_c.so / dll                     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ cadgf_document_* cadgf_solver_* cadgf_triangulate_* │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                  Core C++ (SHARED)                           │
│                    cadgf_core.so / dll                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ Document │  │  Solver  │  │  Ops2D   │  │ Commands │   │
│   │ (Pimpl)  │  │          │  │          │  │          │   │
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
| Document | 暴露 STL | Pimpl 隐藏实现 | API 重构 |
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
| Core ↔ 外部语言 | C API (cadgf_*) | 高（ABI 兼容） |
| Core ↔ Editor | C++ 接口（Pimpl） | 中（源码兼容） |
| Editor ↔ Plugin | 虚函数接口 | 中 |
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
| W1 | SHARED 库构建 | CMakeLists.txt 修改 | 三平台构建通过，输出 `cadgf_core` |
| W1 | API 重命名 | cadgf_api.h | 提供 `cadgf_` 接口，保留 `core_` 兼容 |
| W1 | 符号导出宏 | export.hpp | Windows DLL 无警告 |
| W2 | Document Pimpl | document.hpp 重构 | sizeof(Document) == sizeof(void*) |
| W2 | C API 扩展 | Layer/Solver API | 单元测试通过 |

### 5.3 Phase 2: 编辑器增强（v0.7.0）— 3 周

**目标**: 完善编辑器交互，引入插件架构

| 周 | 任务 | 交付物 | 验收标准 |
|----|------|--------|----------|
| W3 | 框选功能 | BoxSelect 实现 | 左→右/右→左 行为正确 |
| W3 | Snap 重构 | SnapManager 类 | Grid/Endpoint/Midpoint 工作 |
| W4 | 插件接口 | IPlugin/ITool/IExporter | 接口定义完成（使用 cadgf_ 风格） |
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

### 6.1 符号导出宏

```cpp
// core/include/core/export.hpp

#pragma once

// 平台检测
#if defined(_WIN32) || defined(_WIN64)
    #define CORE_PLATFORM_WINDOWS
#elif defined(__APPLE__)
    #define CORE_PLATFORM_MACOS
#elif defined(__linux__)
    #define CORE_PLATFORM_LINUX
#endif

// 符号可见性
#ifdef CORE_PLATFORM_WINDOWS
    #ifdef CORE_EXPORTS
        #define CORE_API __declspec(dllexport)
    #else
        #define CORE_API __declspec(dllimport)
    #endif
    #define CORE_LOCAL
#else
    #ifdef CORE_EXPORTS
        #define CORE_API __attribute__((visibility("default")))
        #define CORE_LOCAL __attribute__((visibility("hidden")))
    #else
        #define CORE_API
        #define CORE_LOCAL
    #endif
#endif

// C 导出辅助
#ifdef __cplusplus
    #define CORE_EXTERN_C extern "C"
    #define CORE_EXTERN_C_BEGIN extern "C" { 
    #define CORE_EXTERN_C_END }
#else
    #define CORE_EXTERN_C
    #define CORE_EXTERN_C_BEGIN
    #define CORE_EXTERN_C_END
#endif
```

### 6.2 CMake 构建配置

```cmake
# core/CMakeLists.txt

cmake_minimum_required(VERSION 3.16)

# 源文件列表
set(CORE_SOURCES
    src/geometry2d.cpp
    src/document.cpp
    src/document_impl.cpp
    src/commands.cpp
    src/ops2d.cpp
    src/solver.cpp
)

set(CORE_HEADERS
    include/core/export.hpp
    include/core/geometry2d.hpp
    include/core/document.hpp
    include/core/commands.hpp
    include/core/ops2d.hpp
    include/core/solver.hpp
    include/core/plugin.hpp
)

# ============================================ 
# 静态库（内部使用）
# ============================================ 
add_library(core_static STATIC ${CORE_SOURCES})
target_include_directories(core_static PUBLIC include)
target_compile_features(core_static PUBLIC cxx_std_17)
set_property(TARGET core_static PROPERTY POSITION_INDEPENDENT_CODE ON)
target_compile_definitions(core_static PRIVATE CORE_STATIC_BUILD)

# ============================================ 
# 共享库（外部使用）
# ============================================ 
add_library(core SHARED ${CORE_SOURCES})
target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_17)
target_compile_definitions(core PRIVATE CORE_EXPORTS)

# 符号可见性（非 Windows）
if(NOT MSVC)
    target_compile_options(core PRIVATE -fvisibility=hidden)
    target_compile_options(core PRIVATE -fvisibility-inlines-hidden)
endif()

# 设置输出名（ABI 前缀标准化）
set_target_properties(core PROPERTIES
    OUTPUT_NAME "cadgf_core"
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}
)

# ============================================ 
# C API 共享库
# ============================================ 
add_library(core_c SHARED src/core_c_api.cpp)
#
# 注意：为避免在同一进程内出现“两份 core 实现”（尤其 editor 同时链接 core + core_c 的情况下），
# 推荐让 core_c 仅作为薄封装并链接到 SHARED 的 core，而不是静态嵌入 core_static。
# 详细建议见：docs/CMAKE_TARGET_SPLIT_v0.6.md
target_link_libraries(core_c PRIVATE core)
target_include_directories(core_c PUBLIC include)
target_compile_definitions(core_c PRIVATE CORE_EXPORTS)

set_target_properties(core_c PROPERTIES
    OUTPUT_NAME "cadgf_core_c"
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}
)

# ============================================ 
# 依赖配置（保持现有逻辑）
# ============================================ 
# Earcut
find_path(EARCUT_INCLUDE_DIR NAMES mapbox/earcut.hpp)
if(EARCUT_INCLUDE_DIR)
    target_compile_definitions(core PUBLIC USE_EARCUT)
    target_compile_definitions(core_static PUBLIC USE_EARCUT)
    target_include_directories(core PRIVATE ${EARCUT_INCLUDE_DIR})
    target_include_directories(core_static PRIVATE ${EARCUT_INCLUDE_DIR})
    message(STATUS "Earcut found")
endif()

# Clipper2
find_path(CLIPPER2_INCLUDE_DIR NAMES clipper2/clipper.h)
if(CLIPPER2_INCLUDE_DIR)
    target_compile_definitions(core PUBLIC USE_CLIPPER2)
    target_compile_definitions(core_static PUBLIC USE_CLIPPER2)
    target_include_directories(core PRIVATE ${CLIPPER2_INCLUDE_DIR})
    target_include_directories(core_static PRIVATE ${CLIPPER2_INCLUDE_DIR})
    message(STATUS "Clipper2 found")
endif()

# Eigen3
find_package(Eigen3 CONFIG REQUIRED)
target_link_libraries(core PRIVATE Eigen3::Eigen)
target_link_libraries(core_static PRIVATE Eigen3::Eigen)

# ============================================ 
# 安装规则
# ============================================ 
install(TARGETS core core_c core_static
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

install(FILES ${CORE_HEADERS} DESTINATION include/core)
```

### 6.3 Document Pimpl 实现 (内容同前，略)

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

```cpp
// core/include/core/plugin.hpp

#pragma once

#include "export.hpp"
#include "document.hpp"

namespace core {

// ... (IPlugin, ITool, IExporter, IImporter 接口定义同前) ...

// ============================================ 
// 插件入口点宏（标准化 cadgf_ 前缀）
// ============================================ 

/// 插件必须导出的函数
#define CORE_PLUGIN_ENTRY(PluginClass)                          \
    CORE_EXTERN_C CORE_API IPlugin* cadgf_plugin_create() {     \
        return new PluginClass();                               \
    }                                                           \
    CORE_EXTERN_C CORE_API void cadgf_plugin_destroy(IPlugin* p) { \
        delete p;                                               \
    }                                                           \
    CORE_EXTERN_C CORE_API int cadgf_plugin_api_version() {     \
        return 1;                                               \
    }

} // namespace core
```

### 7.2 插件管理器 (内容同前，略)

### 7.3 示例：SVG 导出器插件 (内容同前，略)

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
