# CADGameFusion 贡献指南

## 🔎 快速检查清单（提交 / 更新 PR 前必读）
> 若任一项未满足，请先补齐后再提交或更新 Pull Request。

必需通过（硬门槛）
- [ ] 已在 Issue 中获得修改许可（含范围确认）
- [ ] 本地严格校验通过：`bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- [ ] （如导出逻辑/金样变化）执行并验证：`bash tools/refresh_golden_samples.sh` + 严格校验再次通过
- [ ] GitHub Actions 严格工作流绿色（Core Strict - Exports, Validation, Comparison）
- [ ] 没有未解释的 `field_*.json` 非 passed 状态
- [ ] `consistency_stats.txt` 与基线无差异
- [ ] 无意外新增 JSON 字段（仅允许预期 meta.* 扩展）

代码质量
- [ ] 仅最小必要改动（无无关重构）
- [ ] 新增/修改逻辑有基本单元或集成测试（如适用）
- [ ] 无编译警告（本地 Release 构建）
- [ ] 不引入未使用依赖

文档与流程
- [ ] 若对输出格式或行为有改变：更新 README / RELEASE_NOTES / 验证报告
- [ ] 若添加 CI 需求：更新 PR 模板或 CONTRIBUTING 指南

提交策略
- [ ] 拆分为 “feat/fix” 与 “docs/ci” 独立提交（如可能）
- [ ] 未提交临时目录 / 大型二进制（除金样正式刷新）
- [ ] 提交信息精确描述改动与动机

可选增值
- [ ] 添加回滚指导（若为高风险变更）
- [ ] 新增验证脚本或 README Quick Guide 补充

完成后即可创建 / 更新 PR，并等待 Code Owner 审核。

---

## 🧭 Quick Contribution Checklist (English)
> All boxes should be checked before opening or updating a Pull Request.

Mandatory (Hard Gates)
- [ ] Issue approved (scope agreed) before coding
- [ ] Local strict validation passed: `bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- [ ] (If exporter or goldens changed) `bash tools/refresh_golden_samples.sh` + strict validation re‑passed
- [ ] GitHub Actions strict workflow green (Core Strict - Exports, Validation, Comparison)
- [ ] No failing `field_*.json` (all show `"status": "passed"`)
- [ ] `consistency_stats.txt` matches baseline (no count drift)
- [ ] No unexpected JSON keys (only intentional `meta.*` additions)

Code Quality
- [ ] Minimal necessary changes (no unrelated refactors)
- [ ] Tests added/updated (if logic or format changed)
- [ ] No compile warnings (Release build)
- [ ] No unused dependencies introduced

Docs & Process
- [ ] README / RELEASE_NOTES / verification report updated if behavior or output format changed
- [ ] PR template / CONTRIBUTING adjusted if CI policy changed

Commit Strategy
- [ ] Separate functional vs docs/ci commits when feasible
- [ ] No temporary folders / large binaries committed (except intentional golden refresh)
- [ ] Commit messages concise and informative (what + why)

Optional Enhancements
- [ ] Added rollback guidance for risky changes
- [ ] Added or improved quick validation scripts / guides

Once all boxes are checked, open/update the PR and request Code Owner review.


## 🔒 项目政策

**重要声明**: 本项目虽然开源，但**严格控制代码修改**。我们欢迎社区参与，但所有代码变更都需要经过严格的审批流程。

## 📋 贡献类型

### ✅ 欢迎的贡献

1. **🐛 Bug报告**
   - 通过Issue详细描述问题
   - 提供复现步骤和环境信息
   - 包含错误日志和截图

2. **💡 功能建议**  
   - 通过Issue提出新功能想法
   - 解释使用场景和价值
   - 讨论实现可行性

3. **📖 文档改进**
   - 修正文档错误
   - 改善文档清晰度
   - 添加使用示例

4. **🧪 测试用例**
   - 增加边界条件测试
   - 提高代码覆盖率
   - 性能基准测试

### ❌ 不接受的贡献

- 🚫 未经讨论的代码修改
- 🚫 破坏性的重构
- 🚫 不符合项目方向的功能
- 🚫 低质量或草率的提交
- 🚫 重复已有功能的实现

## 🔄 贡献流程

### 第1步: 提出Issue讨论
**所有代码修改都必须先通过Issue讨论**

```markdown
1. 搜索现有Issues，避免重复
2. 创建新Issue，使用适当的模板
3. 详细描述问题或建议  
4. 等待项目维护者回应和批准
5. 只有获得明确同意后才能开始编码
```

### 第2步: Fork并创建分支
```bash
# Fork仓库到你的账户
# 然后克隆你的fork
git clone https://github.com/your-username/CADGameFusion.git
cd CADGameFusion

# 创建功能分支
git checkout -b feature/your-feature-name
```

### 第3步: 本地开发和测试
```bash
# 配置构建环境
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF \
  -DCADGF_USE_NLOHMANN_JSON=ON -DCADGF_SORT_RINGS=ON -G Ninja

# 构建项目
cmake --build build --target export_cli -j

# 运行完整严格校验（必需！）
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```

**⚠️ 重要**: 只有本地CI完全通过的代码才会被考虑。

### 必需检查与本地复现
- 本地严格校验：`tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- 远程严格校验（GitHub Actions）：Core Strict - Exports, Validation, Comparison（use_vcpkg=false/true 各跑一轮）
- 若涉及金样更新：先运行“Maintenance - Refresh Golden Samples”，提交变更，再跑严格校验，直至均为 SUCCESS。

### 第4步: 提交PR
```bash
# 提交你的更改
git add .
git commit -m "feat: 简明描述你的修改"
git push origin feature/your-feature-name

# 通过GitHub创建Pull Request
# 填写PR模板中的所有必需项
```

## 🧪 质量要求

### 代码质量标准
- ✅ 遵循现有代码风格
- ✅ 添加适当的注释
- ✅ 错误处理完善
- ✅ 性能考虑合理
- ✅ 内存安全

### 测试要求
```bash
# 必需通过的测试
✅ 编译无警告
✅ 所有现有测试通过
✅ 新功能有对应测试
✅ Schema验证通过
✅ 字段级对比通过
✅ 标准化检查通过
```

### 文档要求
- ✅ 代码注释清晰
- ✅ API变更有文档说明  
- ✅ 使用示例（如适用）
- ✅ README更新（如需要）

## ⚖️ 审批流程

### 代码审查标准
1. **功能正确性** - 实现符合需求
2. **代码质量** - 遵循最佳实践
3. **测试充分性** - 覆盖关键场景
4. **文档完整性** - 必要说明齐全
5. **兼容性保证** - 不破坏现有功能

### 审批权限
- **@zensgit**: 所有文件的代码所有者
- **核心代码**: 需要项目所有者明确批准
- **文档修改**: 相对宽松，但仍需审批

### 合并要求
```yaml
必需条件:
✅ Issue中事先讨论并获得同意
✅ PR检查清单全部完成
✅ 所有CI检查通过  
✅ 代码所有者明确批准
✅ 所有对话问题解决
```

## 🚨 重要警告

### 自动拒绝情况
以下PR将被**立即关闭，无需解释**：

- 🚫 未经Issue讨论的代码修改
- 🚫 CI检查失败的提交
- 🚫 不填写PR模板的提交
- 🚫 质量明显不达标的代码
- 🚫 恶意或垃圾提交

### 行为准则
- 尊重项目维护者的决定
- 保持专业和友好的态度
- 理解项目的严格质量要求
- 接受可能的修改建议

## 📞 联系方式

### 获得帮助
- **Issue讨论**: 推荐方式，公开透明
- **项目维护者**: @zensgit

### 响应时间预期
- **Bug报告**: 通常1-3天内回应
- **功能建议**: 可能需要更长时间评估
- **PR审查**: 取决于复杂度，通常一周内

## 🎯 成功贡献的秘诀

1. **先讨论，后编码** - 避免无效工作
2. **小步快跑** - 小的、专注的修改更容易被接受
3. **质量优先** - 宁缺毋滥，确保每次提交都是高质量的
4. **测试充分** - 完善的测试是代码质量的保证
5. **耐心沟通** - 理解严格的质量要求需要时间

## 📊 贡献统计

我们欢迎并认可所有形式的贡献：
- Issue报告和讨论  
- 代码改进和修复
- 文档完善
- 测试增强
- 社区支持

---
