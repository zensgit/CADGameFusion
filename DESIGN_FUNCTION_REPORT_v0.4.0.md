# CADGameFusion v0.4.0 功能与架构升级报告

**日期**: 2025年12月16日  
**状态**: 已完成 (Completed)  
**版本**: v0.4.0-robust

## 1. 概述 (Executive Summary)

v0.4.0 版本的核心目标是**消除技术债务**并引入**工业级依赖**，从而将项目从“原型”提升为“生产级”基础架构。

我们成功替换了两个关键的手写模块（glTF 导出器和矩阵求解器），引入了经受过实战考验的开源库 `TinyGLTF` 和 `Eigen`。这不仅消除了数百行脆弱的代码，还显著提升了系统的数值稳定性和文件兼容性。

---

## 2. 关键升级 (Key Features & Upgrades)

### 2.1 稳健的 3D 导出 (Robust glTF Export)
*   **背景**：之前的 glTF 导出是通过字符串拼接 JSON 实现的，容易产生格式错误，且难以支持二进制 (`.glb`) 或高级特性（纹理、动画）。
*   **方案**：全面集成 **TinyGLTF** (MIT)。
*   **成果**：
    *   **标准化**：自动处理 BUFFER 对齐、accessor 步长和 JSON 结构，符合 glTF 2.0 规范。
    *   **扩展性**：为未来支持纹理 (Texture)、材质 (PBR) 和多节点层级打下了 API 基础。
    *   **无头化**：CLI 工具 (`export_cli`) 与编辑器 (`editor`) 共享同一套稳健的导出逻辑。

### 2.2 数值稳定的求解器 (Numerically Stable Solver)
*   **背景**：原有的几何约束求解器使用手写的 Gauss-Newton 算法和简易的矩阵求逆，对于复杂或病态（ill-conditioned）约束系统容易发散。
*   **方案**：引入 **Eigen 3** (MPL2) 线性代数库。
*   **成果**：
    *   **算法升级**：使用 `LDLT` 分解求解线性方程组 ($Ax=b$)，相比直接求逆 ($A^{-1}$) 速度更快且数值更稳定。
    *   **代码精简**：移除了大量手写的矩阵乘法/转置循环，代码可读性大幅提升。
    *   **隐私封装**：通过 `CMake` 的 `PRIVATE` 链接属性，确保 `Eigen` 头文件不泄露到 `core` 库的公共接口中，保持了 ABI 的整洁。

### 2.3 验证体系增强 (Enhanced Validation)
*   **DXF 验证**：扩展了 `validate_export.py`，现在能自动检测 DXF 文件的结构完整性（HEADER/ENTITIES/EOF）和实体内容。
*   **一致性检查**：自动验证 JSON、glTF 和 DXF 输出之间的一致性（如 Group ID 是否匹配），确保管线输出的可靠性。

---

## 3. 架构演进 (Architecture Evolution)

### 依赖管理 (Dependency Management)
项目现在通过 `vcpkg` 管理所有核心算法库，确保了跨平台的一致构建环境：

| 库 (Library) | 用途 (Usage) | 引入版本 |
| :--- | :--- | :--- |
| **Clipper2** | 2D 布尔运算、偏移 | v0.1 |
| **Earcut** | 多边形三角剖分 | v0.1 |
| **TinyGLTF** | 3D 模型导出/加载 | **v0.4** |
| **Eigen** | 线性代数与求解器 | **v0.4** |

### 构建系统 (Build System)
*   修复了 `CMake` 中 `find_path` 的 `NO_DEFAULT_PATH` 问题，使其能正确感知 `vcpkg` 工具链环境。
*   实现了模块化的构建配置，`core`、`editor` 和 `tools` 各自管理其私有依赖。

---

## 4. v0.5.0 规划建议 (Roadmap to v0.5.0)

基于 v0.4.0 建立的坚实底层，v0.5.0 应转向**用户可见的功能增强**。

### 4.1 图层与属性系统 (Layers & Properties)
*   **目标**：摆脱单一图层限制，支持 CAD 标准的图层管理。
*   **计划**：
    *   在 `Document` 模型中引入 `Layer` 概念（名称、颜色、可见性）。
    *   将 `Layer` 映射到 DXF 的 `LAYER` 表和 glTF 的 `Node` 结构。
    *   在编辑器中添加“图层面板”。

### 4.2 撤销/重做系统的重构 (Undo/Redo 2.0)
*   **目标**：支持更细粒度的操作回滚。
*   **计划**：
    *   目前基于 Qt 的 `QUndoStack`。建议将其逻辑下沉到 `core` 或 `editor` 的非 UI 层，以便 CLI 工具也能利用撤销栈进行“试错”操作。
    *   实现“事务 (Transaction)”机制，将多个微小修改（如拖拽过程中的中间态）合并为一个撤销步。

### 4.3 交互体验优化 (Interaction Polish)
*   **目标**：对标 QCAD/LibreCAD 的操作手感。
*   **计划**：
    *   **对象捕捉 (Object Snap)**：实现端点、中点、圆心捕捉。
    *   **框选 (Box Selection)**：实现从左往右（包含）和从右往左（相交）的不同选择逻辑。

---

**结论**：v0.4.0 是一个“内功修炼”的版本。虽然界面上看不出巨大变化，但引擎盖下的动力系统已焕然一新，为承载复杂的 CAD 业务逻辑做好了准备。
