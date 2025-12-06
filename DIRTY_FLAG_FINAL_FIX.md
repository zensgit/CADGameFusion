# Dirty标志追踪最终修复方案
Date: 2025-09-25

## 问题根因分析

### 发现的问题
1. **QUndoStack信号不触发** - `indexChanged`和`cleanChanged`在第一次状态改变时不触发
2. **初始化顺序问题** - 构造函数末尾调用`setClean()`设置了初始clean索引
3. **信号连接时机** - Qt的信号机制在某些情况下不会触发预期的信号

### 调试证据
```
Pushing AddPolylineCommand to undo stack
Stack count after push: 1 isClean: false
// 但是没有 indexChanged 或 cleanChanged 信号输出
```

## 最终解决方案

### 1. 多重保障机制
在`mainwindow.cpp`中添加三重保护：

```cpp
// 方案1: 监听undo栈的状态变化（作为基础）
connect(m_undoStack, &QUndoStack::indexChanged, this, [this](int){
    if (!m_undoStack->isClean()) markDirty();
    else markClean();
});

// 方案2: 监听clean状态变化（双重保障）
connect(m_undoStack, &QUndoStack::cleanChanged, this, [this](bool clean){
    if (clean) markClean();
    else markDirty();
});

// 方案3: 监听命令执行（最终保障）
connect(m_cmdMgr, &CommandManager::commandExecuted, this, [this](const QString&){
    if (!m_undoStack->isClean()) {
        markDirty();
    }
});
```

### 2. 直接更新窗口标题
修改`markDirty()`和`markClean()`直接设置标题：

```cpp
void MainWindow::markDirty() {
    m_isDirty = true;
    setWindowModified(true);
    QString shown = m_currentFile.isEmpty() ? "untitled.cgf" : QFileInfo(m_currentFile).fileName();
    setWindowTitle(QString("%1* - CADGameFusion Editor").arg(shown));
}

void MainWindow::markClean() {
    m_isDirty = false;
    setWindowModified(false);
    QString shown = m_currentFile.isEmpty() ? "untitled.cgf" : QFileInfo(m_currentFile).fileName();
    setWindowTitle(QString("%1 - CADGameFusion Editor").arg(shown));
}
```

### 3. 特定命令的显式标记
在Add Polyline等命令后显式检查：

```cpp
m_cmdMgr->push(std::make_unique<AddPolylineCommand>(c, pv));
// 强制检查dirty状态
if (!m_undoStack->isClean()) {
    markDirty();
}
```

## 关键文件修改

### 文件列表
1. `editor/qt/src/mainwindow.cpp`
2. `editor/qt/src/mainwindow.hpp`
3. `editor/qt/src/command/command_manager.cpp`

### 核心改动
- 添加`isDirtyState()`辅助函数
- 连接`CommandManager::commandExecuted`信号
- `markDirty()/markClean()`直接更新窗口标题
- Save操作后调用`m_undoStack->setClean()`

## 测试验证 ✅

### 测试场景1: Add Polyline
✅ 点击Add Polyline → 标题显示 `untitled.cgf* - CADGameFusion Editor`

### 测试场景2: Save清除dirty
✅ File → Save As → 保存 → 星号消失

### 测试场景3: New提示保存
✅ 有修改时File → New → 弹出保存对话框

### 测试场景4: Undo/Redo状态
✅ Undo到保存点 → 星号消失
✅ Redo → 星号重现

## 经验教训

1. **不要完全依赖Qt信号** - 某些情况下信号可能不会按预期触发
2. **多重保障机制** - 对关键功能实施多层保护
3. **显式状态管理** - 在关键操作后显式更新UI状态
4. **调试输出很重要** - 帮助快速定位信号流问题

## 完整性检查清单

- [x] 初始启动无星号
- [x] 第一次修改显示星号
- [x] 保存后星号消失
- [x] 保存后再修改星号重现
- [x] Undo/Redo正确更新星号
- [x] New/Open/Close时正确提示保存
- [x] 窗口标题实时更新

## 结论
通过多重保障机制和显式状态管理，成功解决了Qt UndoStack信号不可靠的问题，确保了dirty标志的准确追踪和UI的实时更新。