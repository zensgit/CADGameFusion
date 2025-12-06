# Public仓库保护策略 - 开源但防止随意修改

## 核心策略：开放查看，严格控制修改

### 1. 分支保护设置（关键！）

#### 通过GitHub网页设置
**Settings → Branches → Add rule**

```yaml
分支名模式: main
保护规则配置:

🔒 核心保护:
✅ Require a pull request before merging
  ✅ Require approvals: 1 (或更多)
  ✅ Dismiss stale PR approvals when new commits are pushed  
  ✅ Require review from code owners

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  ✅ Required checks: 
    - strict-exports (你的CI检查)
    - 其他必要的CI检查

✅ Require conversation resolution before merging
✅ Require signed commits (强烈推荐)
✅ Include administrators (重要：连管理员也要遵守规则)

🚫 限制推送:
✅ Restrict pushes that create files that exceed 100MB
✅ Restrict force pushes  
✅ Restrict deletions
```

#### 通过命令行快速设置
```bash
# 设置严格的分支保护
gh api repos/:owner/:repo/branches/main/protection \
  -X PUT \
  --field required_status_checks='{"strict":true,"contexts":["strict-exports"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"require_code_owner_reviews":true}' \
  --field restrictions=null
```

### 2. CODEOWNERS 配置（必需！）

创建 `.github/CODEOWNERS` 文件：
```bash
# 全局代码所有者 - 所有文件都需要你的审批
* @your-username

# 核心代码严格控制
/core/** @your-username
/.github/** @your-username  
/tools/** @your-username
/CMakeLists.txt @your-username

# 文档可以相对宽松（可选）
/docs/** @your-username
/README.md @your-username

# 如果有可信任的协作者，可以添加
# /some-specific-area/** @your-username @trusted-collaborator
```

### 3. 仓库权限管理

#### 不要添加直接协作者
```bash
# ❌ 避免给任何人 Write 权限
# 所有外部贡献都必须通过 PR

# ✅ 如果必须添加协作者，只给最低权限
gh api repos/:owner/:repo/collaborators/trusted-user \
  -X PUT \
  -f permission=read  # 只读权限
```

#### 团队管理（如果有组织）
```bash
# 创建只读团队
gh api orgs/:org/teams/:team/repos/:owner/:repo \
  -X PUT \
  -f permission=read
```

### 4. Issue和PR模板

#### Pull Request模板
创建 `.github/pull_request_template.md`：
```markdown
## PR检查清单

### 必需检查 ✅
- [ ] 我已阅读并同意 [贡献指南](CONTRIBUTING.md)
- [ ] 代码遵循项目编码规范
- [ ] 所有测试通过 (`bash tools/local_ci.sh`)
- [ ] 已添加必要的测试用例
- [ ] 文档已更新（如有需要）

### 变更说明
- 详细描述修改内容
- 说明修改原因
- 列出影响范围

### 测试验证
- [ ] 本地测试通过
- [ ] CI检查通过
- [ ] 功能验证完成

⚠️ **注意**: 不符合要求的PR将被直接关闭
```

#### Issue模板
创建 `.github/ISSUE_TEMPLATE/feature_request.md`：
```markdown
---
name: 功能请求
about: 建议新功能
title: '[FEATURE] '
---

**功能描述**
清楚描述你想要的功能

**使用场景**  
解释为什么需要这个功能

**建议实现**
如果有实现想法，请描述

⚠️ **提醒**: 请先搜索现有issue，避免重复提交
```

### 5. 自动化保护

#### GitHub Actions 工作流保护
```yaml
# .github/workflows/pr-check.yml
name: PR Protection
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check PR requirements
        run: |
          # 检查PR标题格式
          if [[ ! "${{ github.event.pull_request.title }}" =~ ^(feat|fix|docs|style|refactor|test|chore): ]]; then
            echo "::error::PR标题必须以类型前缀开头 (feat:, fix:, docs:, 等)"
            exit 1
          fi
          
          # 检查文件大小
          git diff --name-only origin/main | xargs ls -la
          
      - name: Run strict validation
        run: |
          bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```

#### 自动关闭无效PR
```yaml
# .github/workflows/close-invalid-pr.yml  
name: Close Invalid PRs
on:
  pull_request:
    types: [opened]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Check PR source
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # 自动关闭来自特定用户的PR（如果需要）
          if [[ "${{ github.event.pull_request.user.login }}" == "spam-user" ]]; then
            gh pr close ${{ github.event.pull_request.number }} -R ${{ github.repository }}
          fi
```

### 6. 贡献指南

创建 `CONTRIBUTING.md`：
```markdown
# 贡献指南

## 🚫 限制说明
本项目虽然开源，但**严格控制代码修改**。

### ✅ 欢迎的贡献
- 🐛 Bug报告（通过Issue）
- 💡 功能建议（通过Issue）  
- 📖 文档改进（需要审批）
- 🧪 测试用例添加（需要审批）

### ❌ 不接受的贡献
- 随意的代码修改
- 未经讨论的重大重构
- 不符合项目方向的功能

### 📋 PR要求
1. **必须先开Issue讨论** - 所有代码修改都要先获得同意
2. **通过所有测试** - `bash tools/local_ci.sh` 必须成功
3. **代码质量标准** - 遵循项目编码规范
4. **详细说明** - 清楚解释修改原因和实现方式

### 🔍 审批流程
1. 提交PR后自动运行CI检查
2. 代码所有者进行代码审查
3. 需要获得明确的 ✅ 批准
4. 合并后可能需要后续调整

**⚠️ 重要**: 不符合要求的PR将被直接关闭，无需解释。
```

### 7. 监控和通知

#### Webhook通知设置
```bash
# 设置Webhook监控所有活动
gh api repos/:owner/:repo/hooks \
  -X POST \
  -f name=web \
  -f config[url]=https://your-notification-service.com/webhook \
  -f config[content_type]=json \
  -f events[]=pull_request \
  -f events[]=issues \
  -f events[]=push
```

#### 邮件通知设置
**Settings → Notifications → Email**
```yaml
✅ Watching: 所有活动
✅ Pull requests: 所有PR活动  
✅ Issues: 所有Issue活动
✅ Releases: 新版本发布
```

### 8. 定期维护

#### 每周检查清单
```bash
# 1. 检查开放的PR
gh pr list --state open

# 2. 检查最近的Issues  
gh issue list --state open

# 3. 检查协作者权限
gh api repos/:owner/:repo/collaborators

# 4. 检查分支保护状态
gh api repos/:owner/:repo/branches/main/protection
```

#### 自动化清理
```yaml
# .github/workflows/cleanup.yml
name: Repository Cleanup
on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Close stale issues
        uses: actions/stale@v5
        with:
          stale-issue-message: '此Issue已30天无活动，将在7天后自动关闭'
          stale-pr-message: '此PR已30天无活动，将在7天后自动关闭'
          days-before-stale: 30
          days-before-close: 7
```

## 实施优先级

### 🔥 立即执行（核心保护）
1. **启用分支保护** - Include administrators
2. **创建CODEOWNERS** - 你作为所有代码的所有者
3. **设置PR模板** - 明确贡献要求
4. **创建贡献指南** - 明确项目政策

### 📋 尽快完成（加强保护）
1. **配置CI检查要求** - 必须通过才能合并
2. **设置通知监控** - 实时了解仓库活动  
3. **添加自动化检查** - PR格式和质量验证

### 🔧 按需优化（高级功能）
1. **自动化清理** - 定期清理无效内容
2. **高级Webhook** - 集成外部监控
3. **详细分析** - 访问和贡献统计

## 效果预期

实施这些保护措施后：
- ✅ **代码完全受控** - 所有修改都需要你的明确批准
- ✅ **保持开源状态** - 代码可见，获得免费Actions时间
- ✅ **社区友好** - 欢迎报告Issue和建议
- ✅ **质量保证** - 所有修改都经过CI验证
- ✅ **活动透明** - 完整的修改历史和审批记录

**结果**: 你获得了Public仓库的所有好处（免费CI、代码可见性），同时完全控制了代码修改权限。