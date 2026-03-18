# STEP179 Break / Join（Level B 编辑能力）设计

## 背景
Level B 的常用编辑命令中，`Break` 与 `Join` 属于高频操作。目标是在 Web editor 中先落地一个“可用、可回退、可验证”的 v1 版本，再逐步扩展到更多实体类型与更接近 CAD 的细节行为。

本 STEP 只覆盖：
- Break：`line` / `polyline`（open + closed）
- Join：`line` / open `polyline` 的 2+ 实体链式合并为 1 个 `polyline`

## 目标
1. 命令级实现：通过 CommandBus + `withSnapshot(...)` 实现单步 Undo/Redo
2. 交互：提供 `Break` 工具（pick target -> pick point），Join 先走命令行（`join`）
3. 行为可解释：失败返回明确 `error_code`
4. 自动化验证：Node tests 覆盖 + CI light gate 覆盖

## 接口与落点
### Command
- 文件：`tools/web_viewer/commands/command_registry.js`
- 新增命令：
  - `selection.break`
    - payload：`{ targetId?: number, pick: {x,y}, pick2?: {x,y}, keep?: "short" | "long" }`
    - 约束：必须有 selection（用于 canExecute），targetId 缺省取 `selection.primaryId`
  - `selection.join`
    - payload：`{ tolerance?: number }`
    - 约束：selection 至少 2 个实体；所有实体需同 layer 且 layer 未锁定

### Tool
- 文件：`tools/web_viewer/tools/break_tool.js`
- Tool id：`break`
- 状态机：
  - `pickTarget`：点击命中 entity，自动 setSelection
  - `pickPoint`：点击 break 点，调用 `selection.break`（Shift+click 进入两点模式）
  - `pickPoint2`：点击第二点，调用 `selection.break`（携带 pick2，删除中段；Esc 回到 pickPoint）
    - closed polyline keep 选择：
      - 状态栏 `Break Keep`：`Auto | Short | Long`
        - `Auto`：仍支持修饰键：`Ctrl/Cmd` -> `keep:"short"`；`Alt` -> `keep:"long"`
        - `Short/Long`：覆盖修饰键（显式 UI 选择优先）
  - commit 后回到 `pickTarget`（连续模式）

### UI
- `tools/web_viewer/tools/tool_registry.js`：注册 `break`
- `tools/web_viewer/index.html`：
  - 左侧工具栏增加 Break 按钮；command placeholder 增加 break/join
  - 状态栏增加 `Break Keep` 按钮（`#cad-toggle-break-keep`）
- `tools/web_viewer/ui/workspace.js`：
  - alias：`br -> break`，`j/jo -> join`
  - `join` 命令：调用 `selection.join`
  - `toolOptions.breakKeep`：在 UI 层记录当前 break keep 模式（`auto|short|long`），并注入 tool context

## 行为定义（v1）
### Break(line)
- 输入：line(start,end) + pick
- 处理：将 pick 投影到线段，若 t 在 (0,1) 内：
  - 删除原 line
  - 创建两条 line：`start -> breakPoint` 与 `breakPoint -> end`
- 两点模式（pick2）：
  - 将 pick 与 pick2 分别投影到线段得到 p0/p1（按 t 排序）
  - 删除原 line
  - 创建两条 line：`start -> p0` 与 `p1 -> end`（中段被删除）
- 失败：
  - `BREAK_AT_ENDPOINT`：投影点落在端点（避免生成 0 长度线段）
  - `LAYER_LOCKED`：目标图层被锁定
  - `UNSUPPORTED`：非 line/polyline

### Break(polyline)
- 输入：polyline(points) + pick
- 处理：
  - 找到距离 pick 最近的 segment，并投影得到 breakPoint
  - 若 breakPoint 恰好命中已有顶点，则直接在该顶点处理；否则插入一个新顶点后处理
  - open polyline：输出两条 open polyline
  - closed polyline：在 breakPoint 打开闭环，输出 1 条 open polyline（首尾都在 breakPoint）
- 两点模式（pick2，open + closed polyline）：
  - pick1/pick2 分别投影并在 points 中插入（如需）
  - open polyline：
    - 输出两条 open polyline：保留 head（0..left）与 tail（right..end），删除中段（left..right）
  - closed polyline：
    - 输出 1 条 open polyline：删除“从 pick1 到 pick2（按顶点顺序前进）”的中段，保留剩余路径
    - 结果的首尾端点为 pick1 与 pick2（实现中以 pick1 为起点）
    - 可选参数：`keep:"short"|"long"`（仅 closed + 两点模式生效）
      - `short`：保留 pick1->pick2 的更短路径
      - `long`：保留 pick1->pick2 的更长路径
      - 缺省：保持旧行为（保留剩余路径，即删除 pick1->pick2 的顶点顺序段）
- 失败：
  - `BREAK_AT_ENDPOINT`：open polyline 断点在首/尾端点
  - `INVALID_GEOMETRY`：点列不足或结果退化

### Join(v1：2+ 实体链式)
- 输入：selection = 2+ 个实体（line/open polyline），且同 layer
- 处理：
  - 以 `primary` 实体为初始链，迭代从剩余实体中选择“与链首/链尾最近”的可连接端点
  - 每步允许反转候选实体方向；若最佳距离 > tolerance（默认 1e-6）则失败
  - 全部合并后输出 1 条 polyline；若首尾点在 tolerance 内则标记 `closed=true` 并移除重复尾点
- 失败：
  - `NO_MATCH`：端点不够近
  - `LAYER_MISMATCH`：不在同一 layer
  - `LAYER_LOCKED`：layer locked
  - `UNSUPPORTED`：实体类型不支持

## 测试与验收
- Node tests：`tools/web_viewer/tests/editor_commands.test.js`
  - `selection.break`：line split + undo/redo
  - `selection.break`：open polyline split + undo/redo
  - `selection.break`：closed polyline open + undo/redo
  - `selection.break`：line 两点删除中段 + undo/redo
  - `selection.break`：open polyline 两点删除中段 + undo/redo
  - `break` tool：两点模式 + Esc 回退到单点（不丢失 target）
  - `selection.join`：2 条 line join -> polyline + undo
  - `selection.join`：3 entities 链式 join（primary 在中间）
- CI light gate：`bash tools/ci_editor_light.sh` 必须 PASS

## 后续扩展（下一个迭代）
1. Join 支持更复杂拓扑（分支/多段环）与更清晰失败原因
2. （DONE 2026-02-13）Break(closed polyline) 两点模式增加显式选项：`keep:"short"|"long"` + tool 修饰键
3. Join/Break 对线型/线宽/颜色/名称的继承策略细化

## 2026-02-13 增量设计更新
### Break(polyline) 两点模式的约束与实现注意点
在 polyline 的两点 break 模式下：
1) 第二个 break 点必须基于“插入第一个 break 点后的 points 数组”重新做最近段投影，
否则当第一个 break 点插入新顶点导致 points 索引偏移时，第二个 break 点可能落到错误 segment，造成结果不可预期。

2) 若 pick2 需要插入的新顶点位置在 pick1 之前（points 索引更小），必须同步修正 pick1 的 breakIndex，
避免数组 splice 导致 pick1 索引漂移（否则会把中段删除范围算错）。

当前实现策略：
- 先根据 pick1 找最近 segment 并插入（如需），得到 `nextPoints`
- 再在 `nextPoints` 上扫描最近 segment 得到 pick2 的插入位置/索引

closed polyline 的两点模式支持删除中段并输出 1 条 open polyline；删除方向以 pick1->pick2 的顶点顺序为准（通过 pick 顺序可控）。
同时支持 `keep:"short"|"long"` 显式选择保留短段/长段（缺省保持旧行为）。

### Break Keep 的 UI 显式选择（statusbar）
目的：把 closed polyline 两点 break 的 `keep:short|long` 从“只靠修饰键”提升为“UI 可见状态”，降低误操作。

- UI：状态栏按钮 `Break Keep: Auto|Short|Long`
- 优先级：`Short/Long`（UI） > 修饰键（Ctrl/Cmd/Alt） > 默认行为
- 实现落点：
  - `tools/web_viewer/index.html`（按钮 `#cad-toggle-break-keep`）
  - `tools/web_viewer/ui/statusbar.js`（label/点击回调）
  - `tools/web_viewer/ui/workspace.js`（维护 `toolOptions.breakKeep`）
  - `tools/web_viewer/tools/tool_context.js`（注入 `toolOptions`）
  - `tools/web_viewer/tools/break_tool.js`（两点模式组装 payload 时优先读 `toolOptions.breakKeep`）
