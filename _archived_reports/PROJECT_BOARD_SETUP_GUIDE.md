# CADGF 项目看板设置指南

## 方案1: 自动化脚本（推荐）

### 步骤 1: 获取项目权限
```bash
# 刷新GitHub CLI认证，添加项目权限
gh auth refresh -s project,read:project --hostname github.com

# 按照提示在浏览器中完成认证
```

### 步骤 2: 运行自动化脚本
```bash
# 执行完整的项目看板设置
./scripts/setup_project_with_permissions.sh
```

**脚本功能**：
- ✅ 创建项目看板："CADGF – CI & Design Sprint Board"
- ✅ 设置状态列：Backlog, In Progress, Review, Done
- ✅ 添加Issue #49到"In Progress"列
- ✅ 链接项目到仓库

---

## 方案2: 手动创建（备用）

如果自动化脚本无法运行，请手动执行以下步骤：

### 1. 创建新项目
1. 访问 https://github.com/users/zensgit/projects
2. 点击 **"New project"**
3. 选择 **"Board"** 模板
4. 填写项目信息：
   - **名称**: `CADGF – CI & Design Sprint Board`
   - **描述**: `Repository-level project board for tracking CI improvements and design sprints`

### 2. 设置状态列
项目创建后会有默认的列，需要自定义：

1. 点击右上角的 **⚙️ Settings**
2. 在左侧菜单中选择 **"Status"** 字段
3. 编辑状态选项：
   - **Backlog** (灰色)
   - **In Progress** (黄色)  
   - **Review** (蓝色)
   - **Done** (绿色)

### 3. 添加Issue #49
1. 在项目看板中，点击 **"+ Add item"**
2. 搜索框中输入：`zensgit/CADGameFusion#49`
3. 选择 Issue: **"ops(ci/windows): track Windows Nightly 3× green threshold and flip blocking"**
4. 将其拖拽到 **"In Progress"** 列

### 4. 链接到仓库（可选）
1. 在项目设置中，找到 **"Manage access"**
2. 添加 `zensgit/CADGameFusion` 仓库
3. 设置权限为 **"Write"**

---

## Issue #49 详情

**标题**: ops(ci/windows): track Windows Nightly 3× green threshold and flip blocking

**当前状态**: 等待第2和第3次连续成功（进度：1/3）

**任务内容**:
- [ ] 记录第2次连续成功 (Run ID: __)
- [ ] 记录第3次连续成功 (Run ID: __)  
- [ ] 创建PR设置`WINDOWS_CONTINUE_ON_ERROR='false'`
- [ ] 合并PR，确认strict CI强制Windows检查
- [ ] 如果不稳定，创建回滚PR重新启用non-blocking

**目标**: 监控Windows Nightly CI直到连续3次成功，然后切换为blocking模式，确保Windows CI的长期稳定性。

---

## 预期结果

**项目看板链接格式**:
```
https://github.com/users/zensgit/projects/{PROJECT_NUMBER}
```

**看板结构**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Backlog   │ In Progress │   Review    │    Done     │
│   (Gray)    │  (Yellow)   │   (Blue)    │   (Green)   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│             │  Issue #49  │             │             │
│             │Windows CI   │             │             │
│             │Monitoring   │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**完成后请**:
1. 复制项目看板的最终URL
2. 确认Issue #49在"In Progress"列中
3. 提供链接以便记录到项目文档

---

## 故障排除

### 权限问题
```bash
# 检查当前权限
gh auth status

# 如果缺少project权限，重新认证
gh auth refresh -s project,read:project --hostname github.com
```

### API错误
如果GraphQL API返回错误：
1. 确认token具有`project`和`read:project`权限
2. 检查用户ID是否正确获取
3. 尝试手动创建作为备用方案

### 脚本执行错误
```bash
# 检查脚本权限
chmod +x scripts/setup_project_with_permissions.sh

# 检查依赖
command -v gh >/dev/null || echo "请安装GitHub CLI"
command -v jq >/dev/null || echo "请安装jq"
```