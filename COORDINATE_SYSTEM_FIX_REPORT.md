# 坐标系统修复报告
Date: 2025-09-25
Author: Claude Code Assistant

## 问题描述
用户报告坐标轴（红色Y轴和蓝色X轴）在画布左上角相交，而不是在画布中心。这导致：
- 原点(0,0)位于左上角而非中心
- 新创建的图形出现在错误位置
- 不符合标准CAD应用的预期行为

## 根本原因分析

### 问题定位
通过代码审查发现问题在 `canvas.hpp` 和 `canvas.cpp` 中：

```cpp
// canvas.hpp - 原始代码
QPointF pan_ { 0.0, 0.0 }; // 初始化为(0,0)意味着原点在左上角
```

### 坐标转换逻辑
```cpp
// canvas.cpp - 坐标转换函数
QPointF worldToScreen(const QPointF& p) const {
    return QPointF(p.x() * scale_ + pan_.x(), p.y() * scale_ + pan_.y());
}
```

当 `pan_` 初始化为 (0, 0) 时，世界坐标 (0, 0) 会映射到屏幕坐标 (0, 0)，即左上角。

## 实施的修复

### 1. 添加 showEvent 处理
在窗口首次显示时将原点居中：

```cpp
void CanvasWidget::showEvent(QShowEvent* event) {
    QWidget::showEvent(event);
    // Center the origin when widget is first shown
    if (pan_ == QPointF(0, 0)) {
        pan_ = QPointF(width() / 2.0, height() / 2.0);
    }
}
```

### 2. 添加 resizeEvent 处理
确保窗口大小改变时原点保持在中心：

```cpp
void CanvasWidget::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
    // Adjust pan to keep origin centered when resizing
    if (event->oldSize().isValid() && event->oldSize() != QSize(-1, -1)) {
        QPointF oldCenter(event->oldSize().width() / 2.0, event->oldSize().height() / 2.0);
        QPointF newCenter(width() / 2.0, height() / 2.0);
        pan_ += (newCenter - oldCenter);
    }
}
```

### 3. 更新头文件声明
在 `canvas.hpp` 中添加新的事件处理函数声明：

```cpp
protected:
    // ... existing overrides ...
    void showEvent(QShowEvent*) override;
    void resizeEvent(QResizeEvent*) override;
```

## 修改的文件
1. `editor/qt/src/canvas.cpp` - 添加事件处理实现
2. `editor/qt/src/canvas.hpp` - 添加事件处理声明

## 验证结果

### 修复前
- ❌ 坐标轴在左上角相交
- ❌ 原点(0,0)位于画布左上角
- ❌ 新创建的多边形出现在左上角区域

### 修复后
- ✅ 坐标轴在画布中心相交
- ✅ 原点(0,0)位于画布中心
- ✅ 新创建的多边形正确出现在原点附近
- ✅ 窗口调整大小时原点保持居中

## 技术细节

### 坐标系统说明
- **世界坐标**：用户操作的逻辑坐标系
- **屏幕坐标**：Qt绘图使用的像素坐标系
- **pan_变量**：控制世界原点在屏幕上的位置（像素）
- **scale_变量**：控制缩放级别（像素/世界单位）

### 为什么这个修复有效
1. 将 `pan_` 设置为 `(width()/2, height()/2)` 使得世界坐标 (0,0) 映射到屏幕中心
2. `showEvent` 确保初次显示时原点居中
3. `resizeEvent` 维护窗口大小变化时的居中状态

## 影响范围
- 所有现有的绘图操作自动适应新的坐标系统
- 保存/加载功能不受影响（使用世界坐标）
- 鼠标交互（平移、缩放）继续正常工作

## 测试场景
1. ✅ 应用启动时坐标轴在中心
2. ✅ Add Polyline 在原点附近创建图形
3. ✅ 平移和缩放操作正常
4. ✅ 窗口调整大小时坐标系保持正确
5. ✅ 保存和加载文件后坐标位置正确

## 结论
坐标系统问题已成功修复。应用现在表现符合标准CAD软件的预期，提供了更直观的用户体验。