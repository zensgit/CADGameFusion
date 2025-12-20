# CADGameFusion Qt编辑器手动测试指南

**测试日期**: 2025-09-30
**测试版本**: feat/qt-ui-shell分支
**预计时间**: 15分钟

---

## 准备工作

### 自动化回归（Qt）
用于本地或 CI 的 Qt 自动化回归测试。

#### 构建并运行 Qt 回归
```bash
cmake -S . -B build -DBUILD_EDITOR_QT=ON -DCMAKE_PREFIX_PATH=/path/to/Qt/6.x/<platform>
cmake --build build --parallel 4
QT_QPA_PLATFORM=offscreen ctest --test-dir build -R '^qt_' -V
```

### 启动应用
```bash
cd /Users/huazhou/Insync/hua.chau@outlook.com/OneDrive/应用/GitHub/CADGameFusion
./editor/qt/editor_qt
```

### 测试环境检查
- [ ] 应用成功启动
- [ ] 窗口标题显示: `untitled.cgf - CADGameFusion Editor`
- [ ] 工具栏有按钮: Add Polyline, Triangulate, Boolean, Offset, Delete Selected等
- [ ] 右侧有Properties面板(Dock Widget)

---

## 测试1: 脏标记/标题星号 ⭐

### 1.1 初始状态(无星号)
- [ ] **验证**: 窗口标题是 `untitled.cgf - CADGameFusion Editor` (无星号)
- [ ] **截图**: 保存为 `test1_1_initial.png`

### 1.2 添加多边形后出现星号
- [ ] **操作**: 点击工具栏的 "Add Polyline" 按钮
- [ ] **验证**:
  - 画布上出现一个灰色方块
  - 窗口标题变为 `untitled.cgf* - CADGameFusion Editor` (有星号)
- [ ] **截图**: 保存为 `test1_2_dirty.png`

### 1.3 保存后星号消失
- [ ] **操作**: File → Save As → 保存为 `test.cgf`
- [ ] **验证**:
  - 保存成功
  - 窗口标题变为 `test.cgf - CADGameFusion Editor` (无星号)
- [ ] **截图**: 保存为 `test1_3_clean.png`

### 1.4 再次修改出现星号
- [ ] **操作**: 再次点击 "Add Polyline"
- [ ] **验证**: 窗口标题变为 `test.cgf* - ...` (有星号)

### 1.5 新建前提示保存
- [ ] **操作**: File → New
- [ ] **验证**: 弹出对话框 "Unsaved Changes - Save changes to project?"
- [ ] **截图**: 保存为 `test1_5_prompt.png`
- [ ] **操作**: 点击 "Discard" 关闭对话框

**测试1结果**: ✅ PASS / ❌ FAIL

---

## 测试2: Triangulate星号与撤销 🔺

### 2.1 清空画布
- [ ] **操作**: File → New (如果有提示,点击Discard)
- [ ] **验证**: 画布清空,标题无星号

### 2.2 执行Triangulate
- [ ] **操作**: 点击工具栏 "Triangulate" 按钮
- [ ] **验证**:
  - 画布出现三角网格(蓝色线框)
  - 窗口标题出现星号
  - 状态栏显示 "Triangulated X triangles (undoable)"
- [ ] **截图**: 保存为 `test2_2_triangulated.png`

### 2.3 Undo后星号消失
- [ ] **操作**: Edit → Undo (或按Cmd+Z)
- [ ] **验证**:
  - 三角网格消失
  - 窗口标题星号消失(回到clean状态)
- [ ] **截图**: 保存为 `test2_3_undo.png`

### 2.4 Redo后星号再现
- [ ] **操作**: Edit → Redo (或按Cmd+Shift+Z)
- [ ] **验证**:
  - 三角网格再次出现
  - 窗口标题星号再次出现

**测试2结果**: ✅ PASS / ❌ FAIL

---

## 测试3: 属性面板三态 ☑️

### 3.1 单选模式 - 二态切换

#### 准备工作
- [ ] **操作**: File → New → Discard
- [ ] **操作**: 点击 "Add Polyline" 添加一个多边形

#### 选中对象
- [ ] **操作**: 点击画布中的多边形使其被选中(会高亮显示)
- [ ] **验证**:
  - Properties面板显示 "Selection: 1"
  - 显示 "id: 0"
  - 显示 "visible" 行,右侧有checkbox(已勾选)
- [ ] **截图**: 保存为 `test3_1_single_selected.png`

#### 切换可见性
- [ ] **操作**: 取消勾选 "visible" checkbox
- [ ] **验证**:
  - 多边形从画布消失
  - 窗口标题出现星号(因为状态变化)
- [ ] **截图**: 保存为 `test3_1_invisible.png`

#### 撤销恢复
- [ ] **操作**: Edit → Undo
- [ ] **验证**:
  - 多边形重新出现
  - visible checkbox自动恢复为勾选状态

**单选测试结果**: ✅ PASS / ❌ FAIL

---

### 3.2 多选模式 - 三态显示

#### 准备多个对象
- [ ] **操作**: File → New → Discard
- [ ] **操作**: 连续点击 "Add Polyline" 3次,添加3个多边形

#### 多选对象
- [ ] **操作**: 按住Shift键,依次点击3个多边形
- [ ] **验证**:
  - 3个多边形都被选中(高亮)
  - Properties面板显示 "Selection: 3"
  - 显示3个id: 0, 1, 2
  - visible checkbox存在
- [ ] **截图**: 保存为 `test3_2_multi_selected.png`

#### 三态场景1: 全部可见
- [ ] **当前状态**: 3个多边形都可见
- [ ] **验证**: visible checkbox显示为完全勾选(Checked状态)
- [ ] **截图**: 保存为 `test3_2_all_visible.png`

#### 三态场景2: 全部不可见
- [ ] **操作**: 取消勾选visible checkbox
- [ ] **验证**:
  - 3个多边形全部消失
  - checkbox显示为完全未勾选(Unchecked状态)
- [ ] **截图**: 保存为 `test3_2_all_invisible.png`

#### 三态场景3: 部分可见
- [ ] **操作**: Edit → Undo (恢复3个对象可见)
- [ ] **操作**: 点击画布空白处取消选择
- [ ] **操作**: 单独选中第1个多边形,取消其visible
- [ ] **操作**: 点击空白处,再Shift+点击选中所有3个多边形
- [ ] **验证**:
  - 第1个不可见,第2、3个可见
  - visible checkbox显示为**半选状态**(PartiallyChecked,通常是灰色方块或短横线)
- [ ] **截图**: 保存为 `test3_2_partial.png`

#### 批量设置 - 全部可见
- [ ] **操作**: 点击checkbox使其变为Checked
- [ ] **验证**: 3个多边形全部变为可见

#### 批量设置 - 撤销恢复原值
- [ ] **操作**: Edit → Undo
- [ ] **验证**:
  - 第1个恢复为不可见
  - 第2、3个保持可见
  - checkbox恢复为PartiallyChecked状态

**多选测试结果**: ✅ PASS / ❌ FAIL

---

## 测试4: Boolean/Offset CLIPPER2状态 🔧

### 4.1 检查特性标志
- [ ] **操作**: Help → About Core...
- [ ] **验证**: 对话框显示:
  ```
  Core version: 0.1.0
  Features:
   - USE_EARCUT: OFF
   - USE_CLIPPER2: OFF
  ```
- [ ] **截图**: 保存为 `test4_1_about.png`
- [ ] **操作**: 点击OK关闭对话框

### 4.2 Boolean操作提示
- [ ] **操作**: 点击工具栏 "Boolean" 按钮
- [ ] **验证**: 状态栏显示 "Boolean empty (maybe no CLIPPER2)"
- [ ] **截图**: 保存为 `test4_2_boolean.png`

### 4.3 Offset操作提示
- [ ] **操作**: 点击工具栏 "Offset" 按钮
- [ ] **验证**: 状态栏显示 "Offset empty (maybe no CLIPPER2)"

**测试4结果**: ✅ PASS / ❌ FAIL

---

## 📊 测试总结

| 测试项 | 预期场景数 | 通过 | 失败 | 状态 |
|-------|----------|------|------|------|
| 脏标记/星号 | 5 |  |  | ⬜ |
| Triangulate撤销 | 4 |  |  | ⬜ |
| 属性面板-单选 | 3 |  |  | ⬜ |
| 属性面板-多选 | 6 |  |  | ⬜ |
| CLIPPER2状态 | 3 |  |  | ⬜ |
| **总计** | **21** |  |  | ⬜ |

---

## 🐛 问题记录

如果发现问题,请记录:

### Issue 1
- **测试项**:
- **重现步骤**:
- **预期结果**:
- **实际结果**:
- **截图**:

### Issue 2
(如有)

---

## ✅ 测试完成确认

- [ ] 所有测试项已执行
- [ ] 截图已保存
- [ ] 问题已记录
- [ ] 已填写测试总结

**测试人员签名**: _______________
**测试日期**: 2025-09-30
**总体评价**: ✅ 全部通过 / ⚠️ 部分问题 / ❌ 重大问题
