# Qt UI Shell 设计说明（v0.1）

状态: 提案（可立即开工）
负责人: @zensgit
关联: QT_UI_SHELL_PLAN.md, Issue #32
时间范围: 2025-09-25 → 2025-10-02

## 1. 目标与非目标
- 目标
  - 提供最小可用的 Qt UI Shell：视图、选择、属性面板、命令路由、撤销/重做。
  - 采用可扩展的命令架构，保证后续功能（捕捉、编辑、导出）的接入成本低。
  - 保持与现有 `core::Document` 的解耦，通过薄适配层对接。
- 非目标（本阶段不做）
  - 复杂几何编辑器与高保真属性模型（仅最小必要字段）。
  - 完整的项目资源系统（仅 .cgf JSON 存/读骨架）。
  － 跨线程计算/渲染协作（单线程 UI 驱动）。

## 2. 总体架构
组件划分（模块 → 主要职责）
- Command（命令系统）
  - 定义 `Command` 接口（执行/撤销/名称）。
  - `CommandManager` 负责命令注册、分发、快捷键、`QUndoStack` 管理。
- Property Panel（属性面板）
  - 右侧 Dock，展示当前选择元数据与可编辑属性。
  - 发出属性变更请求，由命令系统落地（可撤销）。
- Project（项目管理）
  - `.cgf` JSON 存/读（版本化 meta + 轻量文档视图）。
  - 最近文件列表（QSettings）。
- Integration（集成）
  - 与现有 `MainWindow`、`Canvas` 和 `core::Document` 集成。
  - 统一从 MainWindow 发出 `selectionChanged`，驱动面板刷新。

目录与文件（新增）
- `editor/qt/include/command/command.hpp`
- `editor/qt/include/command/command_manager.hpp`
- `editor/qt/include/panels/property_panel.hpp`
- `editor/qt/include/project/project.hpp`
- `editor/qt/src/command/command_manager.cpp`
- `editor/qt/src/panels/property_panel.cpp`
- `editor/qt/src/project/project.cpp`

CMake 增量（示意）
```
set(QT_UI_SHELL_SOURCES
    src/command/command_manager.cpp
    src/panels/property_panel.cpp
    src/project/project.cpp
)
# target_sources(editor_qt PRIVATE ${QT_UI_SHELL_SOURCES})
```

## 3. 命令系统设计
接口
```cpp
// editor/qt/include/command/command.hpp
class Command {
public:
    virtual ~Command() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
    virtual QString name() const = 0;
};
```
管理器
```cpp
// editor/qt/include/command/command_manager.hpp
class CommandManager : public QObject {
    Q_OBJECT
public:
    explicit CommandManager(QObject* parent = nullptr);
    void setUndoStack(QUndoStack* stack);
    void registerAction(const QString& id, QAction* action, const QKeySequence& shortcut);
    void push(std::unique_ptr<Command> cmd);
    QUndoStack* stack() const;
signals:
    void commandExecuted(const QString& name);
private:
    QUndoStack* m_stack{nullptr};
    QHash<QString, QAction*> m_actions;
};
```
示例命令（后续实现）
- `AddPolylineCommand`：添加一个折线实体。
- `DeleteEntityCommand`：删除当前选择实体。
- `SetPropertyCommand`：设置实体属性（如名称/可见/颜色）。

接线点
- MainWindow 创建 `QUndoStack`、`CommandManager`，安装 Undo/Redo 菜单与快捷键。
- Canvas/Selection 发出操作请求 → CommandManager 生成相应命令并 push。

撤销/重做策略
- 所有可变更状态（文档、选择、属性）必须通过命令变更。
- 只读 UI 不直接触碰 `core::Document`，统一走命令。

## 4. 属性面板设计
职责
- 展示当前选择对象的概要属性（只读 + 少量可编辑字段）。
- 触发属性修改请求（发信号，由命令系统处理）。

接口
```cpp
// editor/qt/include/panels/property_panel.hpp
class PropertyPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit PropertyPanel(QWidget* parent = nullptr);
    void updateFromSelection(const QList<int>& entityIds);
signals:
    void propertyEdited(int entityId, const QString& key, const QVariant& value);
private:
    QTreeWidget* m_tree{nullptr};
    QList<int> m_currentSelection;
};
```
显示模型（v0.1）
- 通用：`id`, `type`, `points`, `closed?`（若有）。
- 外观：预留 `visible`、`color`（暂不落地）。

变更流
- 用户在 PropertyPanel 修改字段 → `propertyEdited`
- MainWindow 捕获并构造 `SetPropertyCommand` → push 到栈。

## 5. 项目管理设计
职责
- 保存/打开最小文档视图（足以恢复场景）。
- 记录 `meta.version`、`createdAt`、`modifiedAt`、`appVersion`。

接口
```cpp
// editor/qt/include/project/project.hpp
struct ProjectMeta { QString version; QString appVersion; QString createdAt; QString modifiedAt; };
class Project {
public:
    bool save(const QString& path, const core::Document& doc);
    bool load(const QString& path, core::Document& doc);
    ProjectMeta meta() const;
private:
    ProjectMeta m_meta;
};
```
`.cgf` JSON（示例）
```json
{
  "meta": {"version":"0.1","appVersion":"0.1.0","createdAt":"2025-09-25T01:00:00Z"},
  "document": {
    "entities": [
      {"id": 1, "type": "polyline", "points": [{"x":0,"y":0},{"x":1,"y":0},{"x":1,"y":1}]}
    ]
  }
}
```
说明：与 `core::Document` 进行最小必要映射；未来可在 `resources` 中扩展。

## 6. 集成要点（MainWindow/Canvas）
- MainWindow
  - 成员：`QUndoStack*`, `CommandManager*`, `PropertyPanel*`
  - 菜单/动作：Undo, Redo（Ctrl+Z/Ctrl+Y），Project: New/Open/Save/Save As
  - 信号：`selectionChanged(QList<int> ids)` → PropertyPanel
  - 槽：PropertyPanel::propertyEdited → 构造命令
- Canvas
  - 保持现状渲染；选择变化通过 MainWindow 转发
  - 未来：在命令执行后刷新视图（监听 commandExecuted）

## 7. 渐进式落地计划
- Day 1
  - 引入 `Command`/`CommandManager`；MainWindow 接线 QUndoStack；加 Undo/Redo 菜单
  - 加入 DummyCommand 便于验证
- Day 2
  - 引入 PropertyPanel；选中项联动显示；触发 propertyEdited (已完成，visible 复选框 + 单选支持)
- Day 3
  - 引入 Project（save/load）；菜单接线；最近文件列表（QSettings）
- Day 4
  - 实现三类示例命令（Add/Delete/SetProperty）；快捷键统一注册
- Day 5
  - 打磨交互与状态同步；小范围测试；修文档（进行中：Triangulate 命令加入撤销支持，wireframe 网格可 Undo/Redo）

## 11. 当前实现进度补充
- 命令系统：Add/Delete/Clear/Visibility/Triangulate 均支持撤销/重做
- Triangulate：生成可撤销 wireframe（不再为每个三角形生成独立 polyline）
- 属性面板：单选显示 visible 复选框，多选显示 ID 列表；后续计划三态/批量属性
- 坐标系：初始/窗口缩放保持原点居中 (showEvent + resizeEvent)
- 持久化：.cgf 保存 (points/color/groupId/visible)

## 8. 测试与验证
- 手动测试
  - 打开应用 → DummyCommand 执行/撤销/重做 → 菜单状态正确
  - 选择实体 → 面板显示 → 修改属性 → 可撤销回滚
  - 保存/打开 `.cgf` → 场景一致
- 结构测试（如添加 gtest 过重，可先跳过）
  - `CommandManager` push/undo/redo 顺序性
  - `Project` save/load 最小一致性（点数/ID/类型）

## 9. 风险与缓解
- 风险：命令与 Document 耦合度高 → 通过适配函数集中处理（如 `doc_set_property(entityId, key, value)`）。
- 风险：属性模型扩展导致面板 UI churn → 采用通用键值+只读为先，逐步精化。
- 风险：撤销粒度不一致 → 以「用户可感知操作」为粒度合并/拆分命令。

## 10. 开放问题
- 选择模型是否需要多选排序与主选项？（默认多选 + 无主选）
- 属性集合是否引入 schema 驱动？（v0.1 不引入，保留接口）
- `.cgf` 是否需要与导出格式联动？（暂不强绑定）

---
本设计遵循「最小可行、可扩展、可撤销」原则，优先落地命令/面板/项目三块基建，保证后续路线按日程推进。
