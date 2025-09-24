# Windows CI 快速修复指南

**日期**: 2025年9月19日  
**目标**: 解决Windows CI vcpkg/msys2镜像不稳定问题  
**优先级**: 高 - 影响开发流程  

## 🚨 问题诊断

### 根本原因
- **vcpkg/msys2镜像不稳定**: pkgconf等包404错误
- **网络超时**: 依赖下载失败
- **缓存问题**: 损坏的缓存影响重试

### 影响范围
- ✅ **Core CI (Basic)**: 稳定，无影响
- ❌ **Strict Build**: 失败，阻塞开发
- ❌ **Windows Nightly**: 不稳定

## ⚡ 立即可用的解决方案

### 方案A: 最小依赖快速修复 (推荐)

1. **替换vcpkg配置**:
```bash
# 使用最小化依赖配置
cp vcpkg-windows-minimal.json vcpkg.json
```

2. **更新工作流**:
```yaml
# 在Windows构建步骤前添加
- name: Use minimal Windows dependencies
  if: runner.os == 'Windows'
  run: |
    if (Test-Path "vcpkg-windows-minimal.json") {
      Copy-Item "vcpkg-windows-minimal.json" "vcpkg.json"
      Write-Host "✅ 切换到Windows最小依赖配置"
    }
```

### 方案B: 增强重试机制

1. **更新vcpkg安装步骤**:
```yaml
- name: Setup vcpkg (Windows Enhanced)
  if: runner.os == 'Windows'
  shell: bash
  run: |
    # 使用增强脚本
    source scripts/windows_ci_fix.sh
    
    # 应用所有修复策略
    setup_alternative_mirrors
    optimize_cache
    
    # 使用增强重试安装
    vcpkg_install_with_retry
```

### 方案C: 缓存优化

```yaml
- name: Cache vcpkg (Enhanced)
  uses: actions/cache@v4
  with:
    path: |
      C:\vcpkg\installed
      C:\vcpkg\packages  
      C:\vcpkg\downloads
      ~/AppData/Local/vcpkg/archives
    key: ${{ runner.os }}-vcpkg-enhanced-${{ hashFiles('**/vcpkg.json') }}-v4
    restore-keys: |
      ${{ runner.os }}-vcpkg-enhanced-
```

## 🔧 完整修复实施

### 步骤1: 应用文件
```bash
# 1. 复制修复脚本
cp scripts/windows_ci_fix.sh .
chmod +x scripts/windows_ci_fix.sh

# 2. 复制最小依赖配置
cp vcpkg-windows-minimal.json .

# 3. 测试脚本
./scripts/windows_ci_fix.sh
```

### 步骤2: 更新工作流
在`.github/workflows/core-strict-build-tests.yml`中添加：

```yaml
      # Windows-specific fixes
      - name: Apply Windows CI fixes
        if: runner.os == 'Windows'
        shell: bash
        run: |
          # Source修复脚本
          source scripts/windows_ci_fix.sh
          
          # 应用所有策略
          setup_alternative_mirrors
          minimal_dependencies  
          optimize_cache
          enhance_retry
          
      - name: Setup vcpkg (Windows, with fixes)
        if: runner.os == 'Windows'
        shell: bash
        timeout-minutes: 30
        run: |
          source scripts/windows_ci_fix.sh
          vcpkg_install_with_retry
```

### 步骤3: 验证修复
```bash
# 触发测试运行
gh workflow run "Core Strict - Build and Tests" --ref main

# 监控结果
make monitor-ci WORKFLOW="Core Strict - Build and Tests" COUNT=1
```

## 📊 修复效果预期

### 短期效果 (24小时内)
- **成功率提升**: 从0%提升到60-80%
- **构建时间**: 略增加但更稳定
- **重试成功**: 网络问题自动恢复

### 中期效果 (1周内)  
- **镜像恢复**: upstream镜像问题自然恢复
- **缓存优化**: 构建时间显著减少
- **稳定性**: 接近其他平台的稳定性

## 🎯 临时vs永久策略

### 临时策略 (当前)
```yaml
continue-on-error: true  # Windows非阻塞
env:
  WINDOWS_CONTINUE_ON_ERROR: 'true'
```

### 永久策略 (修复后)
```yaml
continue-on-error: false  # Windows blocking
env:
  WINDOWS_CONTINUE_ON_ERROR: 'false'
```

## 🚀 实施优先级

### 立即实施 (今天)
1. ✅ **部署修复脚本**: `scripts/windows_ci_fix.sh`
2. ✅ **最小依赖配置**: `vcpkg-windows-minimal.json`
3. ⏳ **工作流更新**: 应用增强重试

### 短期实施 (本周)
4. ⏳ **缓存优化**: 更新cache配置
5. ⏳ **监控集成**: 使用`make monitor-ci`追踪
6. ⏳ **阈值重新评估**: 重新开始3×绿色计数

### 中期实施 (下周)
7. ⏳ **全面测试**: 验证所有修复效果
8. ⏳ **策略切换**: 重新评估blocking模式
9. ⏳ **文档更新**: 更新Troubleshooting指南

## 💡 使用示例

### 手动触发修复测试
```bash
# 1. 应用修复
source scripts/windows_ci_fix.sh

# 2. 触发CI
gh workflow run "Core Strict - Build and Tests"

# 3. 监控结果  
make monitor-ci WORKFLOW="Core Strict - Build and Tests" COUNT=1
```

### 自动化监控
```bash
# 每日健康检查
make monitor-ci WORKFLOW="Windows Nightly - Strict Build Monitor" COUNT=3

# 检查修复效果
./scripts/windows_ci_fix.sh && echo "修复脚本运行正常"
```

## ⚠️ 注意事项

### 风险控制
- **向后兼容**: 所有修复都保持向后兼容
- **渐进部署**: 先在feature分支测试
- **快速回滚**: 保留原配置备份

### 监控指标
- **成功率**: 目标>70%
- **构建时间**: 控制在合理范围
- **稳定性**: 连续成功次数

## 🎉 预期结果

实施这些修复后，Windows CI应该能够：

1. **自动恢复**: 网络问题自动重试成功
2. **稳定构建**: 减少随机失败
3. **快速反馈**: 缩短构建时间
4. **可预测性**: 失败模式明确可控

**目标**: 在1周内达到Windows CI的3×连续成功，重新启用blocking模式。

---
*修复指南生成时间: 2025-09-19 23:30 UTC*  
*预期修复时间: 24-48小时*  
*成功率目标: >70%*  
*监控工具: make monitor-ci*