# Triangulate Undo问题报告
Date: 2025-09-25

## 问题描述
用户报告：执行Triangulate后，Undo操作没有清除三角网格，绿色的三角形线框仍然显示在画布上。

## 代码分析

### TriangulateCommand实现 (mainwindow.cpp:353-370)
```cpp
struct TriangulateCommand : Command {
    CanvasWidget* canvas;
    QVector<QPointF> oldVerts; QVector<unsigned int> oldIdx;
    QVector<QPointF> newVerts; QVector<unsigned int> newIdx;
    bool captured{false};

    void execute() override {
        if (!captured) {
            oldVerts = canvas->triVerts();
            oldIdx = canvas->triIndices();
            captured = true;
        }
        canvas->setTriMesh(newVerts, newIdx);
    }

    void undo() override {
        if (oldVerts.isEmpty() && oldIdx.isEmpty())
            canvas->clearTriMesh();
        else
            canvas->setTriMesh(oldVerts, oldIdx);
    }
};
```

### clearTriMesh实现 (canvas.cpp:285-290)
```cpp
void CanvasWidget::clearTriMesh() {
    triVerts_.clear();
    triIndices_.clear();
    triSelected_ = false;
    update();  // 触发重绘
}
```

## 可能的问题

### 1. 命令没有被推入Undo栈
检查`m_cmdMgr->push()`是否成功执行

### 2. Undo操作没有正确调用
检查Undo快捷键是否绑定正确

### 3. 画布更新问题
虽然`clearTriMesh()`调用了`update()`，但可能存在更新延迟

## 测试步骤
1. 启动应用
2. 点击Triangulate按钮 - 应该看到绿色三角网格
3. 按Cmd+Z (Undo) - 期望网格消失
4. 实际结果：网格仍然显示

## 建议修复方案

### 方案1：添加调试日志
在TriangulateCommand的undo()中添加qDebug输出：
```cpp
void undo() override {
    qDebug() << "TriangulateCommand::undo() called";
    if (oldVerts.isEmpty() && oldIdx.isEmpty()) {
        qDebug() << "Clearing tri mesh";
        canvas->clearTriMesh();
    } else {
        qDebug() << "Restoring old mesh";
        canvas->setTriMesh(oldVerts, oldIdx);
    }
}
```

### 方案2：强制刷新
在clearTriMesh()后添加强制刷新：
```cpp
void CanvasWidget::clearTriMesh() {
    triVerts_.clear();
    triIndices_.clear();
    triSelected_ = false;
    update();
    repaint();  // 强制立即重绘
}
```

### 方案3：检查Undo栈连接
确认Undo动作是否正确连接到QUndoStack：
```cpp
connect(actUndo, &QAction::triggered, m_undoStack, &QUndoStack::undo);
```

## 当前状态
- Triangulate功能可以生成三角网格 ✅
- 状态栏显示"(undoable)" ✅
- Undo操作执行但网格不消失 ❌
- 需要进一步调试确定根本原因