# STEP190 Editor Property Provenance Design

## 背景
- web editor 的 property panel 已经能编辑几何、颜色、图层、line style，但 provenance 信息仍落后于 preview。
- `space/layout/source_type/edit_mode/proxy_kind/block_name` 已进入 editor live model，但 `color_source/color_aci` 仍停留在 CADGF import 临时解析阶段。
- 这会造成两个问题：
  - property panel 不能解释“这个颜色/对象从哪里来”。
  - editor 导出时对颜色 provenance 的语义不稳定，尤其是 imported `BYLAYER/BYBLOCK/INDEX` 对象在进入编辑后容易退化成默认值或不诚实状态。

## Benchmark 对齐
- `AutoCAD-like` 路线强调稳定 selection/property surface，而不是依赖 transient status text。
- `LibreCAD` 路线强调 layer/entity 语义要可解释，尤其是继承属性。
- `FreeCAD` 路线强调 document/object property 是 source of truth，UI 只观察和投影。
- `xeokit` 路线强调 metadata/property surface 是正式 contract，不是 ad-hoc debug 文案。

本轮只做低风险、已存在合同字段的 editor 收口，不引入猜测性的 `line type source / line weight source`。

## 目标
1. property panel 单选时显示正式 provenance hints：
   - `Origin`
   - `Color Source`
   - `Color ACI`
   - `Space`
   - `Layout`
2. `color_source/color_aci` 进入 editor live model，历史、snapshot、JSON roundtrip 不丢。
3. CADGF export 对颜色 provenance 变成显式合同，而不是依赖 base/default 偶然保留。
4. 导入对象一旦经过 editor 的颜色/图层编辑，provenance 必须变得诚实。

## 非目标
- 不在本轮推导 `lineType/lineWeight/lineTypeScale` 的 source tag。
- 不在本轮实现完整 BYLAYER/BYBLOCK 动态继承引擎。
- 不修改 preview artifact schema。

## 合同
### 1. Live entity metadata
- `DocumentState` 允许实体携带：
  - `colorSource`
  - `colorAci`
  - `space`
  - `layout`
  - `sourceType`
  - `editMode`
  - `proxyKind`
  - `blockName`
- 这些字段属于 document/entity model，不属于 property panel 本地缓存。

### 2. Property panel surface
- 单选时，property panel 在可编辑字段之前显示 provenance rows。
- 行为上区分两类信息：
  - `Effective value`
    - `Color (#RRGGBB)` 输入框
    - `Line Type / Line Weight / Line Type Scale`
  - `Source / provenance hints`
    - `Origin`
    - `Color Source`
    - `Color ACI`
    - `Space`
    - `Layout`
- hints 为只读，不允许直接编辑。

### 3. Color provenance honesty
- imported entity 若携带 `colorSource/colorAci`，editor 在未改色/未改 layer 时保留并展示。
- 若用户编辑 `Color`：
  - entity `colorSource` 提升为 `TRUECOLOR`
  - entity `colorAci` 清空
- 若用户编辑 `Layer ID` 且当前 entity 仍带 imported 非 `TRUECOLOR` color provenance：
  - provenance 同样提升为 `TRUECOLOR`
  - 保留当前 effective hex color
  - 不伪装成 editor 支持 live BYLAYER 继承
- `copy/offset` 产生的新实体必须剥离 imported color provenance，避免复制后继续谎称来自原始 BYLAYER/BYBLOCK/INDEX。

### 4. CADGF export
- export 必须显式写回：
  - `color`
  - `color_source`
  - `color_aci`
- 规则：
  - 若 entity 仍携带 imported `BYLAYER/BYBLOCK/INDEX/TRUECOLOR` provenance，则按该 provenance 导出。
  - 若 entity 没有 provenance，或已被 editor promotion，按 `TRUECOLOR` 显式导出。
- 这条规则适用于 supported entities；unsupported passthrough 在保持原始 `cadgf` 基础上补 style/color patch。

## 交互细节
- property panel 文案必须稳定，方便 UI smoke 直接断言 DOM。
- provenance hints 只在单选时显示，避免多选 surface 失焦。
- `Origin` 是聚合摘要，保留现有 `Source Type / Edit Mode / Proxy Kind` 明细行，便于后续逐步切到更紧凑 UI。

## 文件边界
- `tools/web_viewer/state/documentState.js`
  - color provenance 字段进入 normalize/snapshot/restore 路径
- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - import/export color provenance
  - supported entity export 显式写回颜色合同
- `tools/web_viewer/commands/command_registry.js`
  - `copy/offset` 剥离 imported color provenance
- `tools/web_viewer/ui/property_panel.js`
  - provenance rows
  - color/layer 编辑时 promotion to `TRUECOLOR`

## 验收标准
1. Node tests 覆盖：
   - color provenance import/export
   - editor-created entity export uses explicit `TRUECOLOR`
   - copy/offset strips imported color provenance
2. 浏览器里单选 imported entity 可见 `Color Source / Color ACI / Space / Layout`
3. 浏览器里改 `Layer ID` 后，`Color Source` 从 imported source 变为 `TRUECOLOR`
4. 不重跑 full gate 也能通过局部 Node + 浏览器验证；后续 UI smoke 再单独收口
