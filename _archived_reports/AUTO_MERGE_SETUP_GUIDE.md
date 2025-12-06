# GitHub 自动合并设置指南

**更新时间**: 2025-09-20
**状态**: ✅ 已启用

## 🚀 快速开始

### 仓库自动合并状态
- **当前状态**: ✅ 已启用
- **启用时间**: 2025-09-20 23:20 UTC+8
- **允许的合并策略**: Squash、Merge、Rebase

## 📋 使用方法

### 1. 为新 PR 设置自动合并

```bash
# 推荐：Squash 合并（保持提交历史整洁）
gh pr merge <PR编号> --auto --squash --delete-branch

# 示例
gh pr merge 65 --auto --squash --delete-branch
```

### 2. 检查 PR 自动合并状态

```bash
# 查看 PR 详情，包括自动合并状态
gh pr view <PR编号>

# 列出所有开放的 PR 及其状态
gh pr list --json number,title,autoMergeRequest
```

### 3. 取消自动合并

```bash
# 如果需要取消已设置的自动合并
gh pr merge <PR编号> --disable-auto
```

## 🎯 最佳实践

### 推荐工作流程

1. **创建 PR**
   ```bash
   gh pr create --title "feat: 新功能" --body "功能描述"
   ```

2. **立即设置自动合并**
   ```bash
   gh pr merge --auto --squash --delete-branch
   ```

3. **等待 CI 通过**
   - CI 检查全部通过后自动合并
   - 无需人工干预

### 合并策略选择

| 策略 | 使用场景 | 命令参数 |
|------|----------|----------|
| **Squash** | 功能开发、Bug 修复（推荐） | `--squash` |
| **Merge** | 大型功能分支 | `--merge` |
| **Rebase** | 保持线性历史 | `--rebase` |

### 分支保护规则配合

确保以下检查项配置正确：
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators（可选）

## 🔧 高级配置

### 批量设置自动合并

```bash
# 为所有自己的 PR 设置自动合并
for pr in $(gh pr list --author @me --json number -q '.[].number'); do
  gh pr merge $pr --auto --squash --delete-branch
done
```

### CI 工作流集成

在 GitHub Actions 中自动设置：

```yaml
- name: Enable auto-merge
  if: github.event_name == 'pull_request'
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh pr merge ${{ github.event.pull_request.number }} \
      --auto --squash --delete-branch
```

## ⚠️ 注意事项

1. **权限要求**
   - 需要对仓库有写入权限
   - PR 作者可以设置自己 PR 的自动合并

2. **CI 依赖**
   - 确保 CI 配置稳定可靠
   - Windows CI 已通过 PR #61 修复稳定

3. **冲突处理**
   - 有冲突的 PR 无法自动合并
   - 需要手动解决冲突后重新推送

## 📊 监控和报告

### 查看自动合并历史

```bash
# 查看最近的合并记录
gh pr list --state merged --limit 10 \
  --json number,title,mergedAt,mergeCommit \
  --template '{{range .}}#{{.number}} {{.title}} ({{.mergedAt}}){{"\n"}}{{end}}'
```

### 每日 CI 状态监控

通过 PR #63 添加的工作流，每日 10:00 UTC+8 自动生成报告：
- Issue: "Daily CI Status"
- 工件: ci-daily-status-*

## 🎉 总结

自动合并功能已成功启用，可以：
- ✅ 减少人工干预
- ✅ 加速开发流程
- ✅ 保持 CI 质量门禁
- ✅ 自动清理分支

---
*文档生成: 2025-09-20*
*下次复查: 2025-10-20*