# 代码库保护指南

## GitHub 仓库权限设置

### 1. 仓库可见性控制

#### Private 仓库（推荐用于私有项目）
```bash
# 设置仓库为私有
gh repo edit --visibility private
```
- ✅ 只有被邀请的协作者才能访问
- ✅ 代码不会出现在搜索结果中
- ✅ 完全控制谁可以查看代码

#### Public 仓库保护
如果需要开源，可以通过以下方式保护：
- 设置分支保护规则
- 要求代码审查
- 限制直接推送权限

### 2. 协作者权限管理

#### 权限级别说明
```
Read (读取):     只能克隆和查看代码
Triage (分类):  可以管理 issues 和 PR，但不能修改代码  
Write (写入):   可以推送代码到非保护分支
Maintain (维护): 可以管理仓库设置，但不能删除仓库
Admin (管理员):  完全控制权限
```

#### 添加协作者
```bash
# 添加协作者（需要管理员权限）
gh api repos/:owner/:repo/collaborators/USERNAME \
  -X PUT \
  -f permission=read  # 或 write, maintain, admin
```

### 3. 分支保护规则 🛡️

#### 保护主分支
**Settings → Branches → Add rule**

```yaml
分支保护设置:
✅ Require a pull request before merging
  ✅ Require approvals (1-6个审批者)
  ✅ Dismiss stale PR approvals when new commits are pushed
  ✅ Require review from code owners
  
✅ Require status checks to pass before merging  
  ✅ Require branches to be up to date before merging
  ✅ Status checks: 选择你的CI检查
  
✅ Require conversation resolution before merging
✅ Require signed commits (可选)
✅ Require linear history (可选)
✅ Include administrators (建议启用)
```

#### 通过命令行设置分支保护
```bash
gh api repos/:owner/:repo/branches/main/protection \
  -X PUT \
  --field required_status_checks='{"strict":true,"contexts":["strict-exports"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

### 4. CODEOWNERS 文件

创建 `.github/CODEOWNERS` 文件：
```bash
# 全局代码审查者
* @your-username

# 核心代码需要特定审查者
/core/** @your-username @trusted-collaborator
/.github/** @your-username
/tools/** @your-username

# 文档可以由更多人审查
/docs/** @your-username @doc-team
```

### 5. 环境保护规则

#### 部署环境保护
**Settings → Environments → New environment**

```yaml
环境名称: production
保护规则:
✅ Required reviewers: 指定必须的审批者
✅ Wait timer: 延迟部署(如30分钟)
✅ Deployment branches: 只允许特定分支部署
```

### 6. Webhook 和通知设置

#### 设置通知监控
```bash
# 监控所有推送和PR
gh api repos/:owner/:repo/hooks \
  -X POST \
  -f name=web \
  -f config[url]=https://your-monitoring-service.com/webhook \
  -f events[]=push \
  -f events[]=pull_request
```

#### Discord/Slack 通知
- 设置 GitHub 应用集成
- 监控所有代码变更
- 实时获取推送和PR通知

### 7. 安全设置

#### 启用安全功能
**Settings → Security & analysis**

```yaml
✅ Dependency graph: 依赖关系分析
✅ Dependabot alerts: 依赖漏洞警报  
✅ Dependabot security updates: 自动安全更新
✅ Code scanning: 代码安全扫描
✅ Secret scanning: 敏感信息扫描
```

#### 设置 GitHub Actions 权限
**Settings → Actions → General**

```yaml
Actions permissions:
✅ Allow select actions and reusable workflows
✅ Allow actions created by GitHub
✅ Allow Marketplace actions by verified creators

Workflow permissions:
✅ Read repository contents permission
❌ Write permissions (除非必要)
```

## 访问控制最佳实践

### 1. 最小权限原则
```bash
# 新协作者从最低权限开始
协作者权限分配:
- 新成员: Read 权限
- 经验开发者: Write 权限  
- 核心团队: Maintain 权限
- 项目所有者: Admin 权限
```

### 2. 定期权限审查
```bash
# 每季度检查协作者列表
gh api repos/:owner/:repo/collaborators | jq '.[].login'

# 检查分支保护状态
gh api repos/:owner/:repo/branches/main/protection
```

### 3. 双因素认证要求
**Settings → Member privileges**
```yaml
✅ Require two-factor authentication
  - 强制所有协作者启用2FA
  - 定期检查2FA状态
```

## 代码保护工具

### 1. Pre-commit Hooks
```bash
# 在本地设置预提交检查
pip install pre-commit
echo "
repos:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.4.0
  hooks:
  - id: check-added-large-files
  - id: check-merge-conflict  
  - id: check-yaml
  - id: end-of-file-fixer
" > .pre-commit-config.yaml

pre-commit install
```

### 2. 代码签名
```bash
# 设置 GPG 签名
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_GPG_KEY

# 要求签名提交
gh api repos/:owner/:repo/branches/main/protection \
  --field required_signed_commits=true
```

### 3. License 保护
```bash
# 添加明确的许可证
echo "MIT License" > LICENSE
# 或选择其他许可证：GPL, Apache, BSD等
```

## 监控和告警

### 1. 访问日志监控
```bash
# 查看仓库访问统计
gh api repos/:owner/:repo/traffic/clones
gh api repos/:owner/:repo/traffic/views
```

### 2. 异常活动告警
- 设置邮件通知所有推送
- 监控异常大小的提交
- 跟踪新协作者添加

### 3. 备份策略
```bash
# 定期备份仓库
git clone --mirror https://github.com/owner/repo.git
tar -czf repo-backup-$(date +%Y%m%d).tar.gz repo.git/
```

## 实际操作建议

### 对于个人项目
1. **设置为 Private** (如果不需要开源)
2. **启用分支保护** (即使只有你一个人)
3. **设置 CI 检查** (防止破坏性提交)
4. **启用所有安全功能**

### 对于团队项目  
1. **严格的 CODEOWNERS 规则**
2. **要求 PR 审查** (至少1个审批)
3. **启用状态检查** (CI必须通过)
4. **定期权限审查**

### 对于开源项目
1. **详细的贡献指南**
2. **自动化 CI/CD**
3. **社区版主管理**  
4. **明确的许可证**

---

**总结**: 通过组合使用仓库权限、分支保护、CI检查和监控告警，可以有效保护代码库免受未授权修改。关键是根据项目性质选择合适的保护级别。