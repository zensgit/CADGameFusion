# Undo到保存点星号消失问题修复报告
Date: 2025-09-25
Version: Latest Fix Applied

## 问题描述
用户报告：保存后Add Polyline（有星号）→ Edit → Undo → 回到保存点时，星号仍然显示，没有消失。

## 根本原因
1. QUndoStack的`cleanChanged`信号在某些情况下不触发
2. Undo/Redo操作后没有显式检查clean状态
3. 信号连接链可能在特定序列下中断

## 已实施的修复

### 1. Undo/Redo操作后显式检查 (mainwindow.cpp)
```cpp
connect(actUndo, &QAction::triggered, [this]() {
    m_undoStack->undo();
    // 显式检查clean状态
    if (m_undoStack->isClean()) {
        markClean();
    } else {
        markDirty();
    }
});

connect(actRedo, &QAction::triggered, [this]() {
    m_undoStack->redo();
    // 显式检查clean状态
    if (m_undoStack->isClean()) {
        markClean();
    } else {
        markDirty();
    }
});
```

### 2. 增强的信号连接（三重保障）
```cpp
// 基础：监听索引变化
connect(m_undoStack, &QUndoStack::indexChanged, this, [this](int){
    if (!m_undoStack->isClean()) markDirty();
    else markClean();
});

// 双重：监听clean状态变化
connect(m_undoStack, &QUndoStack::cleanChanged, this, [this](bool clean){
    if (clean) markClean();
    else markDirty();
});

// 三重：监听命令执行
connect(m_cmdMgr, &CommandManager::commandExecuted, this, [this](const QString&){
    if (!m_undoStack->isClean()) {
        markDirty();
    }
});
```

### 3. 保存操作设置Clean点
```cpp
void MainWindow::saveFile() {
    if (m_currentFile.isEmpty()) {
        saveAsFile();
    } else {
        if (m_project && m_project->save(m_currentFile, core::Document(), m_canvas)) {
            m_undoStack->setClean();  // 关键：标记当前状态为clean点
            markClean();
            statusBar()->showMessage("File saved", 2000);
        }
    }
}
```

## 验证步骤

### 步骤1: 初始状态
- 启动应用
- 期望：标题显示 `untitled.cgf - CADGameFusion Editor`（无星号）
- ✅ 验证通过

### 步骤2: 添加修改
- 点击 "Add Polyline"
- 期望：标题显示 `untitled.cgf* - CADGameFusion Editor`（有星号）
- ✅ 验证通过

### 步骤3: 保存文件
- File → Save As → 保存到test.cgf
- 期望：标题显示 `test.cgf - CADGameFusion Editor`（无星号）
- ⏳ 待验证

### 步骤4: 再次修改
- 再点击 "Add Polyline"
- 期望：标题显示 `test.cgf* - CADGameFusion Editor`（有星号）
- ⏳ 待验证

### 步骤5: Undo到保存点
- Edit → Undo
- 期望：标题显示 `test.cgf - CADGameFusion Editor`（无星号）
- ⏳ 待验证（这是主要修复目标）

### 步骤6: Redo恢复修改
- Edit → Redo
- 期望：标题显示 `test.cgf* - CADGameFusion Editor`（有星号）
- ⏳ 待验证

## 调试输出示例

### 正常Add Polyline输出
```
Pushing AddPolylineCommand to undo stack
Stack count before push: 0 isClean: true
Stack count after push: 1 isClean: false
markDirty() called, m_isDirty was false
Setting title to: "untitled.cgf* - CADGameFusion Editor"
```

### 期望的Undo到保存点输出
```
Undo operation triggered
Stack isClean: true
markClean() called
Setting title to: "test.cgf - CADGameFusion Editor"
```

## 关键代码位置
- `editor/qt/src/mainwindow.cpp`: 第580-594行（Undo/Redo连接）
- `editor/qt/src/mainwindow.cpp`: 第768-774行（saveFile函数）
- `editor/qt/src/mainwindow.cpp`: 第830-843行（markDirty/markClean函数）

## 技术要点
1. **显式状态检查**：不完全依赖Qt信号，在关键操作后主动检查
2. **Clean点管理**：保存时通过`setClean()`标记当前索引为clean点
3. **直接UI更新**：`markClean()/markDirty()`直接更新窗口标题，不依赖`setCurrentFile()`

## 下一步
- 完整运行所有6个验证步骤
- 如果问题仍存在，考虑添加更多调试输出到Undo/Redo操作
- 可能需要重写QUndoStack的undo/redo槽函数以获得更精确的控制