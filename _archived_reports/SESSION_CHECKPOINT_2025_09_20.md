# CADGameFusion 会话检查点（2025-09-20）

时间：2025-09-20
状态：已发布 v0.2.1；Windows 严格构建阻塞且加固；每日CI日报已上线

## 摘要
- 发布：v0.2.1 – 标准化与CI巩固（已发布）
- Solver：绑定式 API（solveWithBindings），MinimalSolver 支持 horizontal/vertical/distance；solve_from_project 支持点/线ID展开
- Schema：对齐样例（refs + value[null|number]），增加正/负样例与 Trial 校验
- Windows CI：改回阻塞并加固（重试×5、Ninja、longpaths、最小 vcpkg 配置、日志/工件上传）；观察中
- 日报：新增 “Daily CI Status Report” 定时工作流（10:00 UTC+8），并扩展覆盖与 Windows 连续成功统计

## 已合并/已发布
- PR #55 docs+core: 修复引用并对齐solver绑定式API（已合并）
- PR #56 docs(schema): 约束文档澄清 + 样例 + Trial（已合并）
- PR #57 tests+docs: 冲突场景测试 + PoC说明（已合并）
- PR #58 fix: 显式包含 <vector>（已合并）
- PR #59 docs(contributing): 显式包含原则（已合并）
- PR #60 docs: v0.2.1 发布说明 + README 快捷链接（已合并）
- Release v0.2.1（已发布）
- PR #62 ci(windows): 可观测性增强（打印 vcpkg 版本/配置，已合并）
- PR #61 fix(ci): Windows 紧急修复（最小 vcpkg + 阻塞策略生效，已合并）

## 进行中 / 待合并
- PR #66 ci(report): 扩展每日CI日报覆盖 + Windows streak（已设置自动合并，等待完成）
- PR #67 ci(exports): 导出验证工作流打印工具链版本（已标记 Draft，post-verify；待两项验证通过后合并）

## CI 与门禁
- 严格构建（Core Strict - Build and Tests）：Linux/macOS/Windows（Windows 已阻塞，已加固）
- 严格导出（Exports, Validation, Comparison）：Ubuntu 通过；已上传工件与报告
- Windows Nightly：近期多次 success；继续观察稳定性
- 日报：.github/workflows/daily-ci-status.yml 已上线；“Daily CI Status” Issue(#64) 自动追加评论

## 关键文件/工作流
- Solver API：core/include/core/solver.hpp，core/src/solver.cpp
- 映射工具：tools/solve_from_project.cpp
- 项目 Schema：schemas/project.schema.json；样例 samples/
- Windows 严格构建：.github/workflows/core-strict-build-tests.yml
- 严格导出验证：.github/workflows/core-strict-exports-validation.yml
- 日报：.github/workflows/daily-ci-status.yml；scripts/monitor_ci_runs.sh；scripts/ci_windows_streak.sh
- 发布说明：RELEASE_NOTES_v0.2.1_2025_09_20.md

## 下次打开可直接执行的待办
1) 观察 PR #66 是否已自动合并；若已合并：
   - 在 main 上手动触发一次 “Daily CI Status Report”，检查多工作流小节与 Windows streak 输出
2) 当（a）新版日报首跑正常，（b）main 上一次 “Core Strict - Exports” 绿色：
   - 将 PR #67 从 Draft 改为 Ready，并 Squash 合并
3) 继续观察 Windows Nightly 与前 2–3 个 PR 的 Windows 构建；如出现镜像/网络波动：
   - 使用小 PR 暂时恢复非阻塞（仅改 continue-on-error 与 WINDOWS_CONTINUE_ON_ERROR）
4) 如需：把日报各工作流段落改为折叠展示（<details>），首屏保留摘要/成功率/连续成功

## 备注
- 分支保护与必需检查已对齐；如新增工作流影响合并，请核对保护规则检查名是否精准匹配
- 日报定时：每日 10:00（UTC+8）；也可手动 workflow_dispatch 首跑验证

（此文件为会话检查点，供下次快速续接）
