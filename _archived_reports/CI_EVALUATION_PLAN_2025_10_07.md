# CI评估计划 - 2025-10-07

**项目**: CADGameFusion v0.3.1
**评估日期**: 2025-10-07
**观察期**: 2025-09-23 至 2025-10-07

## 📋 评估清单

### 前置条件确认
- [ ] PR #99已合并并运行2周
- [ ] 观察清单已每日更新
- [ ] 收集了足够的性能数据

## 🎯 三大决策点

### 决策1：移除legacy strict-exports.yml

#### 评估数据
```yaml
文件: .github/workflows/strict-exports.yml
状态: 已添加弃用提示
替代: core-strict-exports-validation.yml
```

#### 评估标准
| 标准 | 权重 | 得分(1-5) | 说明 |
|------|------|-----------|------|
| 新工作流稳定性 | 40% | | 2周内无重大故障 |
| 功能完整性 | 30% | | 所有功能已迁移 |
| 团队接受度 | 20% | | 无反对意见 |
| 维护成本 | 10% | | 减少重复代码 |

#### 决策矩阵
- 总分 ≥4.0：立即移除
- 总分 3.0-3.9：计划移除（1个月内）
- 总分 <3.0：暂时保留

**决策**：□立即移除 □计划移除 □暂时保留

### 决策2：独立examples-smoke工作流

#### 评估数据
```yaml
当前配置: core-strict-build-tests.yml中的Linux-only测试
测试内容: c_api_minimal_run, doc_export_example_run
目标耗时: <30秒
```

#### 触发条件
- [ ] 条件A：平均耗时 >30秒（触发）
- [ ] 条件B：失败影响主CI >3次/周（触发）
- [ ] 条件C：需要扩展测试覆盖（触发）

#### 如果创建独立工作流
```yaml
文件名: .github/workflows/examples-smoke.yml
触发:
  - push (paths: examples/**, tests/**)
  - pull_request
  - schedule (daily)
矩阵: ubuntu-latest only
超时: 5分钟
```

**决策**：□创建独立工作流 □保持现状 □优化现有配置

### 决策3：Linux+CLIPPER2试跑矩阵

#### 评估数据
```yaml
目标: 验证offset/boolean全路径
依赖: CLIPPER2=ON
验证: JSON校验转为阻塞
```

#### 实施方案（如果添加）
```yaml
matrix:
  include:
    - os: ubuntu-latest
      name: "Linux + Full Features"
      cmake_args: "-DENABLE_CLIPPER2=ON -DENABLE_EARCUT=ON"
      json_validation: blocking
      allow_failure: false
```

#### 成本收益分析
| 因素 | 成本 | 收益 |
|------|------|------|
| CI时间 | +2-3分钟/运行 | 完整功能验证 |
| 维护 | 额外矩阵配置 | 早期发现问题 |
| 依赖 | vcpkg完整安装 | 真实用户场景 |

**决策**：□添加矩阵 □暂不添加 □分阶段实施

## 📊 数据收集要求

### 性能数据（2周平均）
```
Core Strict Build:
- 成功率: ___%
- p50时长: ___分钟
- p95时长: ___分钟

Core Strict Exports:
- 成功率: ___%
- p50时长: ___分钟
- p95时长: ___分钟

示例测试:
- 成功率: ___%
- 平均时长: ___秒
- 最长时长: ___秒
```

### 稳定性指标
```
Daily CI:
- 成功生成率: ___%
- 数据准确性: □验证通过 □存在偏差

7天趋势:
- 数据完整性: ___%
- 异常次数: ___次
```

## 🔄 决策流程

### 2025-10-07 当天
1. **09:00**: 收集最终数据
2. **10:00**: 团队评审会议
3. **14:00**: 做出决策
4. **16:00**: 创建实施计划

### 后续行动
- **如果移除strict-exports.yml**:
  - [ ] 创建PR移除文件
  - [ ] 更新文档
  - [ ] 通知团队

- **如果创建examples-smoke**:
  - [ ] 创建新工作流文件
  - [ ] 迁移测试配置
  - [ ] 更新CI徽章

- **如果添加CLIPPER2矩阵**:
  - [ ] 更新工作流矩阵
  - [ ] 添加依赖配置
  - [ ] 验证JSON校验

## 📝 评估报告模板

```markdown
# CI评估报告 - 2025-10-07

## 执行摘要
- 观察期: 2周
- PR #99状态: [已合并/运行中]
- 主要发现: [总结]

## 决策结果
1. strict-exports.yml: [决策]
2. examples-smoke工作流: [决策]
3. Linux+CLIPPER2矩阵: [决策]

## 数据支撑
[插入关键数据]

## 风险评估
[列出风险和缓解措施]

## 实施计划
[具体步骤和时间线]

## 签字确认
- CI/CD负责人: ___
- 技术负责人: ___
- 日期: 2025-10-07
```

## 🚀 v0.3.1发布准备

### 如果所有评估通过
- [ ] 合并所有决策相关PR
- [ ] 更新CHANGELOG.md
- [ ] 创建Release Notes
- [ ] 标记v0.3.1
- [ ] 发布Release

### 发布内容预览
```
v0.3.1 - CI Enhancements
- ✨ 7-day trend in Daily CI
- 🔧 Enhanced artifact debugging
- 🧹 Removed legacy workflows (if decided)
- 🚀 Optimized test structure (if decided)
- ✅ Full feature validation (if CLIPPER2 added)
```

---

**创建日期**: 2025-09-23
**评估日期**: 2025-10-07
**负责团队**: CI/CD优化团队