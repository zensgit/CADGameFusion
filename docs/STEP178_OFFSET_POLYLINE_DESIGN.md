# STEP178 Offset(polyline) 设计与后续收口计划

## 背景
在 STEP177 中已经引入 `selection.offset` 命令与 `offset` 工具（支持 line/circle/arc）。Level B 的第一优先级是让 Offset 能覆盖更常见的 `polyline`，并且具备可解释失败、可回退（Undo/Redo 单步）与稳定的自动化验证。

本 STEP 落地 `polyline` 的 Offset（open + closed），同时给出下一步收口路线（concave 与复杂几何的失败检测与命令体验）。

## 目标
1. 支持 `polyline` 的 Offset（open 优先）
2. Corner join 策略可解释：
   - 默认 miter join
   - 极端 miter 自动降级为 bevel（避免近似平行段产生巨大尖角）
3. 行为稳定：
   - 不修改源实体，仅创建新实体
   - 通过 `withSnapshot(...)` 保证单步 Undo/Redo
4. 有自动化验证：
   - Node 命令级测试覆盖至少 1 个折线案例
   - `tools/ci_editor_light.sh` 作为轻门禁可复用

## 实现落点
- 偏移几何计算：
  - `tools/web_viewer/tools/geometry.js`
  - 入口：`computeOffsetEntity(entity, sidePoint, offsetDistance)`
- 命令：
  - `tools/web_viewer/commands/command_registry.js`
  - `selection.offset` 调用 `computeOffsetEntity(...)` 并创建新实体
- 工具交互：
  - `tools/web_viewer/tools/offset_tool.js`

## 几何算法（polyline v1）
输入：polyline 点列 `p[0..n-1]`，`closed` 标志，sidePoint，distance d。

1. 清洗点列：
   - 移除连续重复点（`EPSILON` 容差）
   - `closed==true` 且首尾重复时去掉尾点（闭合由 flag 表示）
2. 自交拒绝（输入）：
   - 若输入 polyline 已自交，则直接失败（返回 `SELF_INTERSECT`），避免生成不可恢复几何
2. 选择偏移侧：
   - 找到 sidePoint 距离最近的一段 segment
   - 用该段的单位法向 `normal` 计算 `sign = dot(sidePoint - closestPoint, normal) >= 0 ? +1 : -1`
   - 之后所有 segment 都使用同一个 `sign` 保持“同侧”
3. 构造每段的偏移线段：
   - 对每条 segment 计算 `delta = normal(segment) * d * sign`
   - 得到 `seg'[i] = (p[i]+delta, p[i+1]+delta)`
4. Corner join：
   - 相邻两段 `seg'[i-1]` 与 `seg'[i]` 用“无限延长线”求交点作为 join point（miter）
   - 若近似平行导致交点不存在，或交点距离过大（miterLimit，默认 `20*d`）：
     - 退化为 bevel：直接使用 `seg'[i].start`（与上一段末端形成倒角连接）
5. 输出点列：
   - open polyline：`out = [seg'[0].start] + joins + [seg'[last].end]`
   - closed polyline：`out = joins(环)`，点数与顶点数一致，`closed=true`
6. 自交拒绝（输出）：
   - 若输出 polyline 自交，则失败（返回 `SELF_INTERSECT`）

## 当前限制（明确不承诺）
- concave corner 的“最佳结果”：
  - 已有自交拒绝与 miter limit，但复杂凹角仍可能出现 bevel 退化或失败
  - 下一步将补更细的失败原因（例如 `NO_VALID_OFFSET`）与更接近 CAD 的 join 策略
- “当前图层/源图层”策略：目前新实体继承源实体属性（包含 layerId）；若需更接近 CAD 行为（新对象落当前层），需要单独设计

## 后续收口计划（建议 2 周）
1. closed polyline 支持：
   - 同算法扩展到闭合边界（join 点数 = 顶点数）
   - 失败检测：产生 NaN/Inf 或 join 大量退化时返回 `null`（由上层报 `UNSUPPORTED`/`INVALID_GEOMETRY`）
2. concave corner 更稳：
   - 增加 miter limit 与最小段长约束
   - 需要时引入简单自交检测（段段相交）并拒绝输出
3. 命令体验：
   - offset 连续执行（commit 后不退出，ESC 退出）
   - statusbar 提示更明确（Pick targets -> Pick side）
4. 验证增强：
   - Node tests 增加 concave 样例 + closed 样例
   - 将 offset polyline 样例加入 round-trip smoke fixtures（非必须，但推荐）

## 验证要求（门禁）
- `node --test tools/web_viewer/tests/editor_commands.test.js` 必须 PASS
- `bash tools/ci_editor_light.sh` 必须 PASS（作为 PR 的 light gate）
