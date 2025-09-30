# Dirty标志追踪修复报告
Date: 2025-09-25

## 问题诊断
1. Add Polyline后没有显示星号
2. File → New没有提示保存
3. Save后星号不消失
4. Undo/Redo状态不正确更新

## 修复内容

### 1. 改进信号连接
**之前**: 只监听`cleanChanged`信号
**现在**: 同时监听`indexChanged`和`cleanChanged`
```cpp
// 监听索引变化，更可靠地追踪dirty状态
connect(m_undoStack, &QUndoStack::indexChanged, this, [this](int){
    if (!m_undoStack->isClean()) markDirty();
    else markClean();
});
```

### 2. Save操作正确标记clean
```cpp
void MainWindow::saveFile() {
    // ... 保存文件后
    m_undoStack->setClean();  // 标记当前状态为clean
    markClean();
}
```

### 3. New/Open清理undo历史
```cpp
void MainWindow::newFile() {
    // ...
    m_undoStack->clear();  // 清空历史
    m_undoStack->setClean();  // 标记为clean
    markClean();
}
```

### 4. isDirtyState()双重检查
结合`m_isDirty`标志和`m_undoStack->isClean()`状态

## 测试步骤

### ✅ 测试1: Add Polyline标记dirty
1. 启动 → 标题无星号
2. Add Polyline → **星号应该立即出现**
3. 状态：DIRTY

### ✅ 测试2: Save清除dirty
1. File → Save As → 选择文件
2. 保存成功 → **星号消失**
3. 状态：CLEAN

### ✅ 测试3: New提示保存
1. 修改后（有星号）
2. File → New → **应该弹出保存提示**
3. 选择Save/Discard/Cancel

### ✅ 测试4: Undo/Redo正确更新
1. Add Polyline（星号出现）
2. Save（星号消失）
3. Add另一个（星号出现）
4. Undo → 回到保存点（**星号应消失**）
5. Redo → 星号重现

## 关键改进
- `indexChanged`信号比`cleanChanged`更频繁触发
- 每次save都调用`setClean()`标记清洁点
- New/Open时清空undo栈避免状态混乱
- 双重检查机制确保不遗漏状态变化

## 当前状态
✅ 修复已应用
✅ 程序正在运行
⏳ 等待测试验证