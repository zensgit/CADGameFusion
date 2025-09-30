# 批次1 - 核心持久化功能实现报告
Date: 2025-09-25

## ✅ 已完成功能

### 1. 保存/加载序列化实现
**文件：** `editor/qt/src/project/project.cpp`

- 完整序列化polylines数据：
  - points (QVector<QPointF>)
  - color (QColor)
  - groupId (int)
  - visible (bool)
- 保存格式：JSON格式，带缩进便于阅读
- 文件扩展名：`.cgf` (CADGameFusion Project)

### 2. File菜单项实现
**文件：** `editor/qt/src/mainwindow.cpp`

新增菜单项：
- **New** (Cmd+N) - 创建新文件，清空画布
- **Open...** (Cmd+O) - 打开.cgf文件
- **Save** (Cmd+S) - 保存当前文件
- **Save As...** (Cmd+Shift+S) - 另存为新文件

### 3. Dirty标志和未保存提示
**实现内容：**

- `m_isDirty` 标志追踪文档修改状态
- `maybeSave()` 函数在需要时提示保存
- 窗口标题显示修改状态 `[*]`
- 关闭窗口时检查未保存更改
- 与撤销栈集成，自动追踪修改

### 4. 元数据管理
**保存的元数据：**
```json
{
  "meta": {
    "version": "0.2",
    "appVersion": "1.0.0",
    "createdAt": "2025-09-25T...",
    "modifiedAt": "2025-09-25T..."
  }
}
```

## 测试场景

### 场景1：基本保存/加载
```
1. 添加多个polylines
2. 修改可见性状态
3. File → Save As → 保存为test.cgf
4. File → New (清空)
5. File → Open → 加载test.cgf
✅ 验收：所有polylines和visible状态完全恢复
```

### 场景2：未保存提示
```
1. 添加polylines
2. 尝试关闭窗口 → 提示保存
3. 选择Save → 保存文件
4. 再次关闭 → 直接关闭（无提示）
```

### 场景3：Dirty标志追踪
```
1. 新建文件 → 标题显示"untitled.cgf"
2. 添加内容 → 标题显示"untitled.cgf*"
3. 保存 → 星号消失
4. 修改 → 星号重现
```

## 文件格式示例

```json
{
  "meta": {
    "version": "0.2",
    "appVersion": "1.0.0",
    "createdAt": "2025-09-25T05:30:00Z",
    "modifiedAt": "2025-09-25T05:31:00Z"
  },
  "document": {
    "polylines": [
      {
        "points": [
          {"x": 0, "y": 0},
          {"x": 100, "y": 0},
          {"x": 100, "y": 100},
          {"x": 0, "y": 100},
          {"x": 0, "y": 0}
        ],
        "color": "#dcdce6",
        "groupId": 1,
        "visible": true
      }
    ]
  }
}
```

## 代码变更摘要

### 新增/修改文件：
1. `editor/qt/include/project/project.hpp` - 添加Canvas支持
2. `editor/qt/src/project/project.cpp` - 实现真实序列化
3. `editor/qt/src/mainwindow.hpp` - 添加文件操作函数
4. `editor/qt/src/mainwindow.cpp` - 实现File菜单功能

### 关键函数：
- `Project::save()` - 序列化到JSON
- `Project::load()` - 从JSON反序列化
- `MainWindow::maybeSave()` - 未保存提示
- `MainWindow::setCurrentFile()` - 管理当前文件状态
- `MainWindow::closeEvent()` - 关闭前检查

## 运行状态
✅ 编译成功
✅ 应用运行正常
✅ File菜单可用
✅ 保存/加载功能正常

## 验收标准
✅ 保存→关闭→重新打开还原所有polyline与visible状态
✅ 打开前提示未保存（dirty标志）
✅ 保存写meta（appVersion + timestamp）

## 下一步建议
批次1核心持久化功能已完成。可以继续批次2（属性与命令通用化）或其他批次的实现。