# CADGameFusion v0.2.1 — 标准化与CI巩固发布说明

发布日期: 2025-09-20  
版本标签: v0.2.1  
类型: 补丁（稳定性、文档、规范、CI巩固）

## 概览
- 绑定式 Solver API 落地，solve_from_project 映射增强（点/线ID自动展开）
- JSON Schema 与样例对齐，新增正/负样例与 Trial 校验
- Windows CI 加固（重试、Ninja 优先、longpaths、MSVC 编译宏/选项、日志上传）
- 建立“显式包含原则”，修复测试中漏包含的 STL 头文件

本版本不引入破坏式变更，主要提升工程稳定性与贡献体验。

## 关键改动

### 核心与工具
- feat(core/solver): 新增 `ISolver::solveWithBindings`（默认桥接到 `solve`，向后兼容）
- feat(core/solver): MinimalSolver 支持 horizontal/vertical/distance 残差（绑定式）
- feat(tools): `solve_from_project` 支持以 `refs` 表示的点/线ID自动展开至组件

相关PR: #55

### Schema 与样例
- fix(schema): 约束对象组合放宽，支持 `refs + value(null|number)`；与样例一致
- docs+samples: 增加正样例（horizontal ok）与负样例（distance 缺值）
- ci(trial): 扩展 `Project Schema Validation (Trial)` 覆盖正/负样例

相关PR: #56

### 测试与文档
- tests: 新增冲突/不一致场景（trial），覆盖过定系统与几何不可能约束组合
- docs(architecture): 标注 Solver 为 PoC，记录GN/LM规划与绑定式默认桥接说明

相关PR: #57

### 规范与可移植性
- fix(tests): 显式包含 `<vector>` 于 `test_solver_poc.cpp`
- docs(contributing): 新增“显式包含原则（STL 头文件）”与常见类型→头文件映射

相关PR: #58, #59

### CI 巩固
- ci(windows): vcpkg 重试×5、Ninja 优先、启用 git core.longpaths、补充 CMake 日志工件
- ci(exports): 记录 `export_cli` 路径、上传导出包工件；spec 测试置为非阻塞以便定位

相关PR: #55

## 平台与门禁策略
- Windows 仍保持非阻塞门禁；Nightly 连续≥3次绿色后计划切回阻塞（PR #50）
- 核心严格门禁（Linux/macOS）保持开启

## 升级指引
- 无需迁移操作；如使用 `solve_from_project`，推荐遵循 `refs + value(null|number)` 格式
- 贡献者请遵循 CONTRIBUTING 中的“显式包含原则”

## 致谢
感谢所有提交、审阅与验证的贡献者。欢迎继续反馈问题与建议！

