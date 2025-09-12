# 两周实施方案说明（M1/M2）

版本：0.1（草案）  日期：2025-09-12

目标概述
- 达成一个“可用、可验证”的端到端闭环：在 Qt 编辑器完成 2D 编辑 → 核心运算（洞/多环三角化、布尔、偏移）→ 导出 glTF 网格与碰撞 JSON → Unity 侧自动热重载查看结果。
- 提升编辑器核心体验（吸附、测量），并用单元测试保障几何稳定性。

范围（本周期覆盖）
- 核心算法：
  - 三角化支持洞/多环输入（earcut 多 ring 输入）
  - 布尔/偏移参数化（JoinType、MiterLimit、容差策略）
  - 输入规范化（闭合、去重、方向、退化过滤）
- C API：
  - 新增洞/多环三角化接口；多环布尔/偏移接口（两段式 Query→Fill 模式）
  - 版本/特性查询已就绪（core_get_version/core_get_feature_flags）
- 导出：
  - glTF 网格导出器（面向三角网）
  - 碰撞/导航 JSON（多边形 rings，含外环/洞）
  - 简易 CLI 工具（core_c 驱动）与编辑器菜单入口
- Unity：
  - FileWatcher 热重载（监视导出目录，自动加载 glTF/JSON）
  - Mesh/Collider 构建示例
- 编辑器：
  - 吸附（网格/端点/中点）与视觉提示
  - 测量（点到点/段长），状态栏显示
- 质量与 CI：
  - Catch2 单元测试（黄金用例 + 轻量 fuzz）
  - CI 运行单测、产物上传

交付物
- 二进制：`core_c`、`editor_qt`（包含导出菜单）
- 示例：Unity 热重载脚本与样例场景
- 文档：导出格式规范（glTF/JSON）、使用说明、测试报告摘要

架构与设计要点
- 容差与规范化策略（2D）：
  - 近零长度边、重复点在 ε（默认 1e-9~1e-7）内合并/剔除
  - 输入闭合：rings 首尾相同；若非闭合则自动闭合
  - 方向：外环 CCW、洞环 CW（统一后交给 Clipper2/FIllRule 处理）
- 三角化（earcut）：
  - 接口接收多环：`[outer, hole1, hole2, ...]` 多 ring；生成单一索引数组
- 布尔/偏移（Clipper2）：
  - 布尔：Union/Diff/Inter/Xor，可选 FillRule（NonZero/EvenOdd）
  - 偏移：JoinType（Miter/Round/Bevel）、MiterLimit（默认 2.0~4.0）、Delta（世界单位）

C API 变更（草案）
- 三角化（多环）：
  - `int core_triangulate_polygon_rings(const core_vec2* pts, const int* ring_counts, int ring_count, unsigned int* indices, int* index_count);`
    - 输入：按顺序平铺的点数组 + 每个 ring 点数数组（含闭合点）
    - 两段式：`indices=NULL` 先取大小，再填充
- 布尔（多环-多环）：
  - `int core_boolean_op_multi(const core_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
    const core_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
    int op, int fill_rule,
    core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);`
- 偏移（多环集合）：
  - `int core_offset_multi(const core_vec2* pts, const int* ring_counts, int ring_count, double delta, int join_type, double miter_limit,
    core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);`
- 备注：仍采用 Query→Fill，两段式返回；所有输入将做规范化处理（闭合/去重/方向）。

导出格式
- glTF（网格）：
  - 每个输出网格一个节点；单位按 `DocumentSettings.unit_scale`
  - POSITION/INDICES，法线可选重建；命名按实体/组
  - 路径：`exports/scene_xxx/mesh_*.gltf`（支持 .glb 作为后续优化）
- 碰撞/导航 JSON：
  - 版本头：`{"version":"1.0","unit":1.0}`
  - 数组：`{"polygons":[{"outer":[[x,y],...],"holes":[[...],[...]]}, ...]}`
  - 路径：`exports/scene_xxx/collision.json`

Unity 热重载方案
- 监视 `exports/scene_xxx/` 目录，发现新 glTF/JSON 即加载/替换当前对象
- glTF → Mesh：读取 POSITION/INDICES 构建 `Mesh`
- JSON → Collider：外环 + 洞 → 2D/3D Collider（示例先 2D PolygonCollider 或 3D MeshCollider）
- 失败回退：日志提示 + 保持上一次可用资源

编辑器增强
- 吸附：
  - 网格：按栅格间距对齐
  - 端点：Kd-tree/哈希空间索引查找最近端点
  - 中点：当前选中段的中点提示
  - 视觉：高亮吸附类型（端点/中点/网格）
- 测量：
  - 点到点距离、段长、矩形宽高；状态栏与 HUD 显示

测试与 CI
- 单测（Catch2）：
  - 三角化：无洞/单洞/多洞、共线、细长多边形
  - 布尔：并/差/交/xor；退化/重叠/共享边
  - 偏移：正/负 delta；圆角/直角；锐角 miter 限制
- 黄金数据：固定输入/期望输出点集与索引
- 轻量 fuzz：随机扰动点坐标，断言不崩溃且基本性质满足
- CI：新增 `core-tests` 任务，跑单测并上传失败日志；保留 `core_c` 产物上传

时间计划
- Week 1（M1 强化）
  - 核心：多环三角化、偏移 JoinType/MiterLimit、输入规范化与容差
  - 单测：三角化/布尔/偏移黄金用例 + 轻 fuzz
  - 编辑器：吸附（网格/端点/中点）与基本提示
- Week 2（导出与互通）
  - 导出：glTF + 碰撞 JSON；编辑器菜单“导出…”
  - Unity：FileWatcher 热重载；Mesh/Collider 构建
  - 编辑器：测量工具；状态栏显示

验收标准
- 算法：
  - 三角化能正确处理带洞多边形（耳切版本）；布尔/偏移在黄金集合上稳定
- 导出：
  - 可导出并在 Unity 成功加载与显示；热重载在 2 秒内更新
- 编辑器：
  - 吸附与测量可用、直观；删除/分组/缩放等现有功能不回退
- 测试与 CI：
  - CI 单测通过；`core_c` 产物可供 Unity 使用

风险与对策
- 几何鲁棒性：增加输入清洗与公差，使用 Clipper2/earcut 组合；建立回归集
- 性能：命中测试与吸附使用空间索引；三角化/布尔大输入时做分片
- 跨平台：CI 矩阵覆盖 macOS/Windows/Linux；导出文件名及大小写统一

超出范围（本周期不做）
- 3D B-Rep 高精布尔；高阶约束求解；DWG 支持；工程图

附录（实现落点）
- 代码结构：
  - `core/include/core/ops2d.hpp` / `src/ops2d.cpp`：补多环 API 与参数化实现
  - `core/include/core/core_c_api.h` / `src/core_c_api.cpp`：新增多环 C API
  - `editor/qt/`：吸附与测量工具；导出菜单与调用
  - `adapters/unity/` 与 `adapters/unity-sample/`：热重载脚本与样例
  - `tests/core/`：Catch2 单测（新目录）
- 文档：更新 `docs/API.md`、`docs/Unity-Guide.md` 与新增导出格式说明

