# 功能设计说明：导出配置对话框（Qt）

版本：0.1   作者：AI 助手   日期：2025-09-12

1. 背景与目标
- 背景：当前导出默认 JSON+glTF、单位比例固定、导出全部组。需要一个可配置的导出对话框，提升可用性与可控性。
- 目标：在导出前提供选项面板，允许选择导出类型、单位缩放、导出哪些组，以及未来的几何参数（JoinType/MiterLimit）。

2. 需求与用例
- 用例：
  - 仅导 glTF 用于渲染；仅导 JSON 用于调试；二者皆导用于双路径验证。
  - 导出时选择单位（mm/m/inch 等），或按 DocumentSettings.unit_scale 统一。
  - 仅导出选中的组，避免大批量文件。
- 验收：对话框可记忆上次设置；导出结果与设置一致；校验报告无错误。

3. 方案概述
- 在 File 菜单中新增 “Export with Options…”（或替换现有项），弹出 QDialog 收集选项并调用 exportScene(items, baseDir, kinds, unitScale)。
- 选项保存至 QSettings（跨会话记忆）。

4. 详细设计
- UI 字段：
  - 导出类型：checkbox（JSON / glTF）
  - 单位缩放：double spin（默认 1.0），或“使用文档单位”复选框（读取 DocumentSettings.unit_scale）
  - 导出范围：
    - 全部组 / 仅选中组（若未来画布支持显式选中组）
  - 高级（可折叠）：JoinType（Miter/Round/Bevel）、MiterLimit（默认 2.0）——当前先保留灰置或隐藏，后续启用
- 逻辑：
  - 校验导出目录可写；若 glTF 选中则强制调用 C API rings 三角化。
  - 导出完毕显示校验报告与文件列表。
- 接口：新增 MainWindow::exportWithOptions()，创建并读取对话框值后，收集 ExportItem 并调用 exportScene。

5. 兼容性与迁移
- 保持现有快速导出菜单（JSON only / glTF only / 两者）以便脚本化。
- 新对话框为补充路径。

6. 安全与鲁棒性
- 路径校验与写入失败提示；选项非法值回退（如 unitScale<=0 → 1.0）。

7. 测试计划
- 用例覆盖：三种导出类型、不同 unitScale、空/只读目录、仅选中组（预留）。
- 验证报告：确保 JSON 与 glTF 检查项通过；错误路径有清晰提示。

8. 风险与方案对比
- UI 复杂度带来维护负担 → 分层实现（对话框仅收集参数，导出逻辑复用现有 exporter）。
- 跨平台 DPI/字体差异 → 使用 Qt Layout 自适应。

9. 交付与落地
- 验收清单：
  - 对话框字段与默认值正确；设置可持久化；导出结果匹配设置；校验报告展示。
- 文档：更新 Editor-Usage 与本设计文档归档。

10. 后续工作
- 将 JoinType/MiterLimit 注入 offset 导出；按组命名规则与批量选择；预览导出顶点/三角统计。

