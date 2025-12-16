# CADGameFusion v0.3.2 设计功能与架构升级报告

**日期**: 2025年12月16日  
**状态**: 已完成 (Completed)  
**版本**: v0.3.2-accelerated

## 1. 概述 (Executive Summary)

本次迭代的核心目标是解决 CADGameFusion 在迈向“可用性”过程中的两个最大痛点：**编辑器在大规模图元下的交互卡顿** 以及 **缺乏工业标准数据交换 (DXF)**。

我们在不破坏核心 ABI (二进制接口) 和不引入重型依赖的前提下，完成了以下关键升级：
1.  **编辑器性能**：重构渲染管道，引入硬件加速变换与空间缓存，实现 10k+ 线段的流畅编辑。
2.  **互操作性**：原生支持 DXF (AutoCAD) 导出，打破了数据孤岛。
3.  **无头化 (Headless)**：CLI 工具链同步支持 DXF，强化了自动化管线能力。

---

## 2. 核心功能升级 (Key Features)

### 2.1 高性能渲染引擎 (High-Performance Rendering)

为了解决 `CanvasWidget` 在图元增多时 UI 卡顿的问题，我们实施了基于 `QPainter` 的现代优化策略。

*   **变换矩阵 (QTransform)**：
    *   *旧机制*：在 CPU 端对每个点进行 `worldToScreen` 计算 (O(N))。
    *   *新机制*：使用 `QPainter::setTransform` 配合 `QPen::setCosmetic(true)`。将坐标变换交给底层的绘制引擎（通常是 GPU 加速），大幅降低 CPU 负载。
*   **自适应网格 (Adaptive Grid)**：
    *   实现了基于 `log10` 的自适应网格系统。无论缩放级别如何（从 0.05x 到 5000x），屏幕上的网格密度始终保持在舒适的 25-80px 范围内，彻底解决了“无限缩小导致网格黑屏”的 Bug。
*   **缓存与拾取优化 (Caching & Hit Testing)**：
    *   **渲染缓存**：在 `PolyVis` 结构中缓存 `QPainterPath`。路径只在几何修改时重建，重绘时直接复用。
    *   **AABB 预过滤**：在鼠标点击检测中引入轴对齐包围盒 (AABB) 检查。只有鼠标落在图元包围盒内时，才进行昂贵的点线距离计算。这通过 `QTransform::inverted()` 将鼠标映射回世界坐标实现，避免了屏幕坐标系的误差。

### 2.2 工业级 DXF 导出 (Industrial DXF Export)

为了让 CADGameFusion 能接入 AutoCAD、LaserCut 等工业软件生态，我们实现了最小完备的 DXF 导出器。

*   **实现细节**：
    *   **零依赖**：手写 ASCII DXF 生成器，不依赖庞大的 `libdxfrw`。
    *   **实体支持**：主要支持 `LWPOLYLINE` (轻量多边形)，自动处理闭合/开口标志 (`Code 70`)。
    *   **坐标系适配**：自动处理屏幕坐标系 (Y-down) 到 CAD 坐标系 (Y-up) 的翻转 (`y = -y`)，确保在 AutoCAD 中打开方向正确。
*   **集成点**：
    *   **GUI**：`File -> Export Scene (DXF only)...`
    *   **CLI**：`tools/export_cli --dxf`

### 2.3 代码健壮性 (Code Hygiene)

*   **核心求解器修复**：修复了 `core/src/solver.cpp` 中一处高风险的“误导性缩进”警告，消除了数值求解逻辑中的潜在隐患。
*   **Qt 兼容性**：修复了 `PropertyPanel` 中对 Qt6 新信号 `checkStateChanged` 的不兼容调用，确保在旧版 Qt 环境下也能编译。

---

## 3. 架构分析 (Architecture Analysis)

本次修改严格遵循了 **"Core - Editor - Tools"** 的分层架构：

| 模块 | 修改内容 | 架构影响 |
| :--- | :--- | :--- |
| **Core** | `solver.cpp` (Fix) | **零侵入**。保持了核心库的纯净性，未引入任何 GUI 依赖。 |
| **Editor** | `CanvasWidget`, `Exporter` | **深度优化**。将渲染逻辑从“立即模式”转向“保留模式”雏形 (Cached Path)。 |
| **Tools** | `export_cli.cpp` | **功能对齐**。确保命令行工具拥有与 GUI 同等的数据导出能力，服务于自动化流水线。 |

### 依赖控制
我们成功抵制了引入 `GLM` 或 `libdxfrw` 的诱惑，继续保持了项目的轻量化：
*   **数学**：继续沿用 `core_vec2`，但在渲染层利用了 Qt 自身的数学库。
*   **DXF**：通过 <200 行的 C++ 代码实现了核心导出功能。

---

## 4. 后续规划 (Roadmap v0.4+)

基于当前坚实的基础，下一阶段的建议方向：

1.  **求解器工程化 (Solver Engineering)**：
    *   目前求解器虽然修复了警告，但仍处于 POC 阶段。下一步应引入 `Eigen` 作为后端，提升矩阵运算的数值稳定性。
2.  **图层与属性 (Layers & Properties)**：
    *   DXF 导出目前全部在 Layer 0。随着编辑器功能的丰富，需要支持图层管理和颜色/线型导出。
3.  **撤销/重做增强**：
    *   当前的 Undo 栈已工作，但对于复杂操作（如批量修改）的颗粒度控制还需优化。

---

**总结**：v0.3.2 版本已成功交付了预期的**“手感”提升**和**“数据通路”打通**。软件现在不仅“能画”，而且“好画”，并且画出来的东西“有用”（能进 AutoCAD）。
