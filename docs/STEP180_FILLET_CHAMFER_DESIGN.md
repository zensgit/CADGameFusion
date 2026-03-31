# STEP180 Fillet / Chamfer（Level B 编辑能力）设计

## 背景
Fillet/Chamfer 是 2D CAD 高频修形操作。Level A 期望“可编辑闭环”，Level B 则需要引入更接近 CAD 的修形命令，并且保持：
- 单步 Undo/Redo（命令原子性）
- 可解释失败（明确 error_code）
- 可验证（Node tests + editor light gate）

本 STEP 起步于 **line-line + polyline segment（受限）**，当前已扩到：
- `selection.filletByPick`：`line+arc`、`arc+arc`、`line+circle`、`circle+arc`、`circle+circle`、`polyline+arc`（open/closed）、`polyline+circle`（open/closed）
- `selection.chamferByPick`：`line/polyline + arc/circle`（cross-entity）、`arc/circle + arc/circle` 与 `line/polyline` 组合
作为更完整 2D 修形命令的基座。

## 范围
- `selection.fillet`：line-line + radius，输出 1 条 arc 并 trim 两条线
- `selection.filletByPick`：line/polyline(segment)/arc/circle + radius + pick1/pick2，trim 端点/segment 由 pick 决定（更像 CAD）
- `selection.chamfer`：line-line + d1/d2，输出 1 条 connector line 并 trim 两条线
- `selection.chamferByPick`：line/polyline(segment)/arc/circle + d1/d2 + pick1/pick2，trim 端点/segment 由 pick 决定（更像 CAD）
- Tool 交互：
  - `fillet`：pick first line/polyline/arc/circle -> pick second target（连续模式，内部调用 `selection.filletByPick`）
  - `chamfer`：pick first line/polyline/arc/circle -> pick second target（连续模式，内部调用 `selection.chamferByPick`）
  - `fillet/chamfer`：single-target preselection 与 pair preselection 都允许 `arc/circle`
- 增量支持（v1）：
  - pick-based：允许 pick `polyline` 的 segment（由 pick 点自动选择最近 segment）
  - 同一 open/closed polyline 的相邻拐角：支持 fillet/chamfer（输出 polyline + arc/connector 的组合）
- 不包含：preview/动态半径、线型继承策略细化

## 接口与落点
- 文件：`tools/web_viewer/commands/command_registry.js`
- 新增命令：
  - `selection.fillet`
    - payload: `{ radius:number }`
    - 约束：selection 恰好 2 个实体；且都为 `line`；同 layer；layer 未锁定
- `selection.filletByPick`
    - payload: `{ firstId:number, secondId:number, pick1:{x,y}, pick2:{x,y}, radius:number }`
    - 约束：line/polyline/arc/circle；同 layer；layer 未锁定
      - polyline：pick 点自动选择最近 segment
      - cross-entity：polyline 要求交点/切点落在被 pick 的 segment 内；若需要 extend 才能成立，则返回 `NO_INTERSECTION`
      - `polyline+arc`：
        - open polyline：trim 被 pick 的 segment，并保留用户 pick 侧
        - closed polyline：在被 pick 的 segment 上插入切点，保持 `closed: true`
      - `polyline+circle`：
        - open polyline：trim 被 pick 的 segment，并保留用户 pick 侧
        - closed polyline：在被 pick 的 segment 上插入切点，保持 `closed: true`
      - `line+circle`：trim line，并把 circle 转成被保留侧的 arc
      - `circle+arc`：trim circle 侧为 arc，并 trim 原 arc
      - `circle+circle`：两侧都转成 arc，并创建 fillet arc
      - same-id：允许在同一 polyline 的相邻拐角做 fillet（输出 polyline + arc）
  - `selection.chamfer`
    - payload: `{ d1:number, d2?:number }`（d2 缺省为 d1）
    - 约束同上
  - `selection.chamferByPick`
    - payload: `{ firstId:number, secondId:number, pick1:{x,y}, pick2:{x,y}, d1:number, d2:number }`
    - 约束：line/polyline/arc/circle；同 layer；layer 未锁定
      - polyline：pick 点自动选择最近 segment
      - cross-entity：polyline 要求交点/trim 点落在被 pick 的 segment 内；若需要 extend 才能相交，则返回 `NO_INTERSECTION`
      - closed polyline：在被 pick 的 segment 上插入 trim 点，保持 `closed: true`
      - `line/polyline + arc/circle`：line/polyline 侧按 pick 方向线性走 `d1`；arc/circle 侧按 pick 决定保留弧侧并沿弧长走 `d2`
      - `line+circle`：trim line，并把 circle 转成被保留侧的 arc，再创建 connector line
      - `line+arc`：trim line 与 arc，并创建 connector line
      - `arc+arc`：按 pick 决定两侧保留弧侧，并沿弧长分别走 `d1/d2`
      - `arc+circle`：arc 侧按 sweep/pick 保留；circle 侧按 `pickAngle` 转成 arc
      - `circle+circle`：两侧都按各自 `pickAngle` 转成 arc，并创建 connector line
      - same-id：允许在同一 polyline 的相邻拐角做 chamfer（输出 polyline + connector）
- UI/命令行：
  - `tools/web_viewer/ui/workspace.js`
    - `fillet [r]` -> `selection.fillet`
    - `chamfer [d1] [d2]` -> `selection.chamfer`
    - alias: `f` -> `fillet`，`ch/cha` -> `chamfer`
  - `tools/web_viewer/index.html`：
    - placeholder 提示包含 fillet/chamfer
    - 左侧工具栏增加 Fillet/Chamfer

### Tool
- 文件：
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
- 注册：
  - `tools/web_viewer/tools/tool_registry.js`
- Tool id：
  - `fillet`
  - `chamfer`
- 参数读取（v1）：
  - tool 在 `activate()` 与每次 click 时读取 `readCommandInput().args`
  - `fillet`：`args[0]` 解析为 radius（默认 1.0）
  - `chamfer`：`args[0]/args[1]` 解析为 d1/d2（默认 1.0，d2 缺省=d1）

## 行为定义（v1）
### Fillet(line-line)
输入：
- 两条 line（视为无限延长线求交）
- radius > 0

算法（几何约束版本）：
1) 计算两条无限线交点 `I`（平行则失败）
2) 对每条 line 选择“离交点更近”的端点作为需要被 trim 的端（near endpoint）
3) 计算夹角 `theta`，并得到 trim 距离：`trimDist = radius / tan(theta/2)`
4) 从交点沿各自方向走 `trimDist` 得到切点 `t1/t2`
5) 计算 fillet arc 的圆心（沿角平分线方向距离 `h = radius / sin(theta/2)`）
6) trim 两条 line 到 `t1/t2`，并创建 arc(center, radius, startAngle/endAngle, cw)

失败与 error_code：
- `NO_SELECTION`：未选中 2 条线
- `INVALID_RADIUS`：radius 非法
- `UNSUPPORTED`：非 line-line
- `LAYER_MISMATCH`：不在同 layer
- `LAYER_LOCKED`：layer locked
- `NO_INTERSECTION`：平行
- `INVALID_ANGLE`：夹角过小/接近 180 度
- `RADIUS_TOO_LARGE`：radius 导致 trimDist 超过线段可用长度
- `FILLET_FAILED`：更新/创建失败

### Fillet/Chamfer：pick-based trim side（line-line）
问题：仅按“交点附近端点(near endpoint)”去 trim，会出现用户在另一侧点击，但命令修错边的情况。

策略（v1：line + polyline segment）：
- 求无限线交点 `I`
- 对每条线：
  - 将用户 pick 点投影到线段方向，判断 pick 更靠近交点的哪一侧（决定“保留哪个 ray”）
  - trim 另一端（与用户 pick 侧相反的端点）

这使得 `selection.filletByPick/selection.chamferByPick` 的几何结果与用户点击意图更一致。

### Fillet/Chamfer：polyline segment 支持（v1）
核心差异：polyline 的 segment 没有独立实体 id；因此 `selection.*ByPick` 通过 pick 点自动解析出“被选中的 segment”。

- segment 解析：对 polyline 的每条线段投影，选择距离 pick 最近的 segment（等价于 CAD 的 pick edge）
- circle 解析：保留 `pickAngle`，后续用来决定 circle 被裁成哪一段 arc
- cross-entity（polyline vs other entity）限制：
  - v1 不做 extend；交点/切点必须落在被 pick 的 polyline segment 内
  - 若只有延长后才会相交，则返回 `NO_INTERSECTION`
  - `polyline+arc`：
    - open polyline：trim 被命中的 segment 并创建 fillet arc
    - closed polyline：在被命中的 segment 插入 tangent point，保持闭环并创建 fillet arc
  - `line+circle`：
    - 复用 line+arc 的 offset-line + offset-circle 求解
    - 按 `pickAngle` 决定 circle 保留哪一侧并转成 arc
  - `circle+arc`：
    - 复用 arc+arc 的 offset-circle 求解
    - circle 侧不做 sweep 命中检查，但按 `pickAngle` 裁成 arc
- same-id（同一 polyline 拐角）：
  - 当 `firstId == secondId` 且 pick 命中两个 **相邻** segment 时，视为对该拐角做 fillet/chamfer
  - open polyline：输出 2 条 open polyline（`_A/_B`）+ 1 条 arc（fillet）或 connector line（chamfer）
  - closed polyline：输出 1 条 open polyline（`_FILT/_CHF`）+ arc/connector（原闭环被打开并移除原实体）
  - pick side 必须指向同一个 corner vertex（否则返回 `PICK_SIDE_MISMATCH`）

### Chamfer(line-line)
输入：
- 两条 line（无限延长线求交）
- d1 > 0，d2 > 0（缺省 d2=d1）

算法：
1) 求交点 `I`
2) 对每条 line 选择 near endpoint，并沿远离 `I` 的方向走 `d1/d2` 得到 `t1/t2`
3) trim 两条 line 到 `t1/t2`
4) 创建 connector line(t1 -> t2)

失败与 error_code：
- `NO_SELECTION`
- `INVALID_DISTANCE`
- `UNSUPPORTED`
- `LAYER_MISMATCH`
- `LAYER_LOCKED`
- `NO_INTERSECTION`
- `DISTANCE_TOO_LARGE`
- `CHAMFER_FAILED`

## 测试与验收
- Node tests：`tools/web_viewer/tests/editor_commands.test.js`
  - `selection.fillet`：line-line -> arc + trim，undo/redo
  - `selection.filletByPick`：pick 决定 trim side（cross case）
  - `selection.filletByPick`：same polyline adjacent corner（open polyline）支持
  - `selection.filletByPick`：`line+arc`、`arc+arc`、`line+circle`、`circle+arc`、`circle+circle`、`polyline+arc`（open/closed）、`polyline+circle`（open/closed）组合回归
  - `selection.filletByPick` / `selection.chamferByPick`：closed polyline cross-entity 回归，并保持 `closed: true`
  - `selection.chamfer`：line-line -> connector + trim，undo/redo
  - `selection.chamferByPick`：pick 决定 trim side（cross case）
  - `selection.chamferByPick`：`line+arc`、`line+circle`、`arc+arc`、`arc+circle`、`circle+circle` 命令层组合回归
  - `selection.chamferByPick`：支持 closed polyline cross-entity，并保持 `closed: true`
  - `selection.chamferByPick`：same polyline adjacent corner（open polyline）支持
  - `fillet` tool：两次 pick 后触发 `selection.filletByPick`（radius 取自 command input args）
  - `fillet` tool：允许同一 polyline 两次 pick（corner）
  - `fillet` tool：single/pair preselection 含 `arc/circle` 时，pick 点会投影到对应曲线
  - `chamfer` tool：两次 pick 后触发 `selection.chamferByPick`（d1/d2 取自 command input args）
  - `chamfer` tool：支持 `line -> arc`、`line -> circle`、`circle -> line` 与 pair preselection 含 `arc/circle`
  - `chamfer` tool：允许同一 polyline 两次 pick（corner）
- Light gate：`bash tools/ci_editor_light.sh` 必须 PASS

## 后续扩展
1) `fillet/chamfer` 共享 two-target modify tool scaffold，统一 preselection / retry / status contract
2) closed polyline + arc / cross-entity 的更强 split/trim 语义
3) 样式继承策略：lineType/weight/color/name 的一致性与可配置
