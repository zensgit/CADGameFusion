# 功能设计说明：带洞多边形三角化与导出加载闭环（Qt → Core → Unity）

版本：1.0.0   作者：AI 助手   日期：2025-09-12

1. 背景与目标
- 背景：2D 编辑场景经常包含带洞（多环）多边形（如“甜甜圈”、带挖空的区域）。需要统一在桌面编辑器、导出格式与游戏引擎中正确表示与渲染。
- 目标：
  - 在 Core 中提供多环三角化能力（基于 earcut），通过 C API 暴露。
  - Qt 导出器将多环数据导出为 JSON 与最小 glTF（POSITION/INDICES）。
  - Unity 端支持两条路径：优先 glTF 加载；若失败则 JSON + C API 三角化生成网格。
- 非目标：通用 glTF 全量特性解析、材质/法线/纹理坐标；复杂拓扑的鲁棒修复（后续规划）。

2. 需求与用例
- 用例：
  - 关卡/地图编辑中挖洞区域；UI 蒙版；复杂区域碰撞体。
  - Given：画布上存在多环折线；When：导出→加载；Then：Unity 中看到带洞网格。
- 验收标准：
  - glTF/JSON 导出结构正确；Unity 显示洞（非实心）。
  - 缺少 earcut 时发出降级提示并仅显示外环。

3. 方案概述
- 数据流：Canvas 多环折线 → Exporter 生成 flat_pts/ring_counts/ring_roles 与 glTF（通过 C API rings 三角化） → Unity WatchAndReload 监控目录，优先 glTF 加载；否则 JSON + CoreBindings.TriangulateRings → Mesh。
- 版本/特性：cadgf_get_version()/cadgf_get_feature_flags() 支持运行时判定 EARCUT/CLIPPER2。

4. 详细设计
- 数据结构/文件格式
  - JSON（group_#.json）：
    - flat_pts: [{x,y}...]
    - ring_counts: [int,...]（每个 ring 点数；包含首尾一致的输入）
    - ring_roles: [0/1,...]（0=外环/CCW，1=洞/CW，基于导出侧有向面积判断）
  - glTF（mesh_group_#.gltf + .bin）：
    - POSITION float32 VEC3（Z=0）、indices uint32；单 buffer、两个 bufferView、两个 accessor、单 mesh/node/scene。
- Core & C API
  - triangulate_rings(rings): 使用 earcut，将多环转换为 indices。
  - C API：cadgf_triangulate_polygon_rings(flatPts, ringCounts, ringCount, indices, indexCount)。
- 导出器（Qt）
  - 写 JSON：flat_pts/ring_counts/ring_roles 与 legacy polygons；unitScale 参与坐标缩放。
  - 写 glTF：调用 C API rings 三角化构建 POSITION/INDICES；写出最小 glTF + bin。
  - 校验：asset 版本、bin 大小匹配、POSITION/indices accessor 基本属性、bufferView 范围。
- Unity 端
  - preferGltf 开关；MinimalGltfLoader 加载 glTF 最小子集；控制台输出顶点/三角统计。
  - JSON 路径：调用 CoreBindings.TriangulateRings 组 Mesh，失败则外环扇形降级。

5. 兼容性与迁移
- 兼容：保留 JSON 旧字段（polygons.outer/holes 简化）；新增字段向后兼容。
- 迁移：Unity 可切换 preferGltf 或 JSON 路径；默认优先 glTF。

6. 安全与鲁棒性
- 容错：缺少 earcut 时降级；文件缺失/损坏时日志告警并跳过。
- 性能：多环三角化复杂度与顶点数成正比；大输入建议分组导出。

7. 测试计划
- 单元测试（Core）：
  - 单洞/多洞/凸多边形带洞；退化点去重；环方向纠正。
- 集成测试（端到端）：
  - Qt 导出后校验报告 glTF/JSON 均 ok；Unity 自动加载显示洞；统计顶点/三角数与预期一致。
- 回归：CI 运行 core_tests；导出器结构校验通过。

8. 风险与方案对比
- 风险：
  - 输入异常（自交/退化）导致三角化失败→输入规范化与告警。
  - 大规模网格加载性能→Unity 端按需合批或拆分。
- 替代方案：纯 JSON + 运行时三角化（已作为回退），glTF 全量库（后续可接入）。

9. 交付与落地
- 验收清单：
  - glTF/JSON 校验通过；Unity 显示洞；降级路径日志正确。
- 文档：Unity-Guide、Build-From-Source、API 更新；本设计文档归档。
- 发布：CI 产物 core_c；Unity 示例工程脚本。

10. 后续工作
- 完整洞支持的样式/材质；大网格分块；更多导出元数据；更丰富的 glTF 属性（法线/颜色）。
