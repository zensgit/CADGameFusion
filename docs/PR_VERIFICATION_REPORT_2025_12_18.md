# CADGameFusion — Claude 3 个 PR 本地验证汇总（2025-12-18）

> 范围：本报告覆盖 Claude 一口气产出的 3 个 PR（PR1/PR2/PR3）的代码审阅要点、可复现实验命令与结果、以及合并/落地建议。

## 0. 环境信息

- 平台：macOS (arm64)  
  `uname -a`: Darwin Kernel Version 25.1.0 (arm64)
- 工具链：
  - CMake：4.1.1
  - Ninja：1.13.1
  - Python：3.9.6
  - Bash：5.3.3

## 1. PR 列表（分支 / commit / 变更概览）

| PR | 分支 | Commit | 主要改动 | 变更统计（git show --stat） |
|---|---|---|---|---|
| PR1 | `pr1/repo-hygiene` | `8f9352d` | 修复 `.github` PR 模板大小写冲突；补充 `.gitignore` | 2 files, +3/-20 |
| PR2 | `pr2/local-ci-tooling` | `669c385` | 重构 `tools/local_ci.sh`，作为“单一事实源”，统一输出 log + summary JSON；修复 strict-exit 统计方式 | 1 file, +322/-235 |
| PR3 | `pr3/ci-align-local-ci` | `7e21962` | 新增 GitHub Actions：跑 `tools/local_ci.sh --strict-exit`；并在脚本内新增 `--toolchain` 等对齐能力 | 2 files, +511/-235 |

关键结构关系（非常重要）：

- PR2 与 PR3 都修改了 `tools/local_ci.sh`，且 PR3 **包含** PR2 的大部分重构（并额外加了 `--toolchain` 与 workflow）。
- 若打算同时合入 PR2 与 PR3，建议把 PR3 **rebase 到 PR2**（否则后合入会在同文件产生重复 diff/冲突）。

## 2. PR1 验证结论：Repo Hygiene

### 2.1 目的与效果

- 解决 macOS/Windows case-insensitive 文件系统下的致命冲突：同仓库同时追踪
  - `.github/PULL_REQUEST_TEMPLATE.md` 与
  - `.github/pull_request_template.md`
  会导致 checkout/status 异常、PR 审阅体验变差。
- PR1 通过删除大写版本文件并保留小写版本，避免该冲突。

### 2.2 本地检查

- 在 `pr1/repo-hygiene` 上：`git ls-files .github | rg pull_request_template` 仅剩 `.github/pull_request_template.md`
- `.gitignore` 新增忽略：`build_vcpkg/`、`build_novcpkg/`、`build_deps/`、`*.bundle`

### 2.3 建议

- **优先合入 PR1**（尤其团队里有人使用 macOS/Windows）。

## 3. PR2 验证结论：local_ci 单一事实源

### 3.1 核心行为验证（脚本）

已验证：

- `bash -n tools/local_ci.sh` 通过（语法 OK）
- 默认总是生成：
  - `<build_dir>/local_ci_output.log`
  - `<build_dir>/local_ci_summary.json`
- `--strict-exit` 逻辑不再依赖 grep 日志，改为运行时计数（更可靠）

### 3.2 本地可复现命令与结果（macOS）

1) Quick 子集（`tools/ci_scenes.conf: quick=...`），离线 strict：

```bash
bash tools/local_ci.sh --build-dir build_vcpkg --offline --quick --strict-exit
```

结果（关键指标）：

- `validationFailCount=0`
- `structCompareFailCount=0`
- `fieldCompareFailCount=2`（失败场景：`complex`、`scene_complex_spec`）
- strict 模式退出码：`2`（脚本当前固定用 `exit 2` 表示 strict gate 失败）

2) Required 全集（`tools/ci_scenes.conf: required=...`），离线 strict：

```bash
bash tools/local_ci.sh --build-dir build_vcpkg --offline --strict-exit
```

结果：

- `validationFailCount=0`
- `structCompareFailCount=0`
- `fieldCompareFailCount=3`（失败场景：`holes`、`complex`、`scene_complex_spec`）
- strict 模式退出码：`2`

### 3.3 发现的问题（小但建议修）

- 当前脚本在 **non-strict** 模式下，即便存在失败（如 `fieldCompareFailCount>0`），末尾仍会打印：
  - `Done - all checks passed`
  这会误导读 log 的人；建议改为根据计数打印 “Done (non-strict): failures detected”。
- “总是生成 summary JSON”在大多数失败路径成立，但若发生“更早的 hard-exit”（例如缺少关键二进制/脚本直接 `exit 1`），仍可能拿不到 summary；建议用 `trap` 做兜底（可选优化）。

## 4. PR3 验证结论：CI 对齐 local_ci（workflow + toolchain）

### 4.1 local_ci 新增能力验证：`--toolchain`

使用新 build 目录验证 `--toolchain` 生效（空目录首次 configure 才有意义）：

```bash
bash tools/local_ci.sh \
  --build-dir build_pr3_toolchain \
  --toolchain vcpkg/scripts/buildsystems/vcpkg.cmake \
  --offline --quick --strict-exit
```

结果：

- `build_pr3_toolchain/local_ci_summary.json` 中包含 `"toolchain": "vcpkg/scripts/buildsystems/vcpkg.cmake"`
- strict gate 同样可用（退出码 `2`）

注：对已配置过的 build dir 反复传 `-DCMAKE_TOOLCHAIN_FILE=...` 会触发 CMake “not used” 警告（因为 toolchain 变量不能在已配置目录中更改），CI 场景（首次配置）不受影响。

### 4.2 Workflow 审阅要点：`.github/workflows/local-ci-gate.yml`

优点：

- 直接跑 `tools/local_ci.sh --strict-exit`，真正做到“CI 与本地同源”
- `always()` 上传 log/summary/artifacts，便于排查

潜在改进点（不阻塞合入，但建议排期）：

- vcpkg cache 路径目前包含 `vcpkg/installed`，但 manifest mode 常见产物为 `vcpkg_installed/`；可以考虑补上以提高 cache 命中率
- workflow 使用 `jq` 解析 summary JSON，Ubuntu-latest 通常自带；如想更稳，可显式安装 `jq`
- 现在 workflow 默认跑 required 全集（不加 `--quick`），如果当前 field compare 还未对齐 golden，CI 会长期红；建议先：
  - PR gate 用 `--quick`
  - Nightly / 手动任务跑 required 全集

## 5. CTest 校验（补充）

### 5.1 build_vcpkg

```bash
ctest --test-dir build_vcpkg -V
```

结果：5/5 通过（包含 `plugin_host_demo_run`）。

### 5.2 build_pr3_toolchain

`local_ci.sh` 默认只 build 子目标（如 `export_cli` 等），若要跑完整 CTest，需要先全量 build：

```bash
cmake --build build_pr3_toolchain -j
ctest --test-dir build_pr3_toolchain -V
```

结果：5/5 通过。

## 6. 合并策略建议（两种可选方案）

### 方案 A（更省 PR，推荐）

1. 合入 PR1（hygiene，解决 case 冲突）
2. 直接合入 PR3（包含 PR2 的绝大多数收益 + 新 workflow）
3. 关闭/放弃 PR2（避免重复变更同一脚本）

### 方案 B（保留渐进式 PR，适合 code review 更细）

1. 合入 PR1
2. 合入 PR2
3. 将 PR3 rebase 到 PR2（使 PR3 diff 主要只剩 workflow + toolchain 增量），再合入 PR3

无论哪种方案，在把 `Local CI Gate` 设为 required check 之前，都需要先解决 field compare 与 golden 的一致性，否则 CI 会持续红。

## 7. 一周落地计划（Claude 开发 + 我逐步校验）

> 目标：把“稳定边界 + C ABI 插件 + 可复现 strict-exports”真正变成可持续的工程闭环。

### Day 1（合并与对齐）

- Claude：按“方案 A/B”整理 PR 依赖与 base（确保不重复修改同文件）
- 我：复查最终 diff（尤其 `.github` case 冲突是否彻底消失）

验收：macOS/Windows 上 `git status` 不再被 PR 模板大小写冲突污染。

### Day 2（让 strict gate 先“可用”）

- Claude：把 `tools/local_ci.sh` 的 “Done - all checks passed” 输出修正为基于计数的真实结论；可选加 `trap` 保证 summary 兜底落盘
- 我：本地跑 `--quick --strict-exit` 验证输出与退出码、summary JSON 一致

验收：non-strict 模式 log 不误导；strict 模式稳定 non-zero。

### Day 3（对齐 field compare / golden）

- Claude：决定策略（二选一）：
  1) 更新 `sample_exports/` golden（推荐先跑 quick 子集）；或
  2) 调整 field compare 逻辑/rtol（更谨慎，需解释原因）
- 我：复核差异是否“合理”（三角化差异是否应在 field compare 里忽略，或仅比较拓扑/面积等）

验收：`bash tools/local_ci.sh --build-dir build --toolchain ... --quick --strict-exit` 通过。

### Day 4（CI 策略落地）

- Claude：调整 `.github/workflows/local-ci-gate.yml`：
  - PR 默认 `--quick`；required 全集放 nightly/手动
  - vcpkg cache 路径补齐（可选）
- 我：审阅 workflow 是否可维护、失败时 artifacts 是否足够定位问题

验收：PR gate 稳定可用，不把团队拖进“永远红”的状态。

### Day 5~7（v0.7+ 技术债主线：Editor 模型统一）

- Claude：逐步让 `core::Document` 承载“真相”，Canvas 仅做渲染投影（Model-View 分离）
- 我：每个小步都做回归校验（撤销/重做、导出链路、插件导出）

验收（阶段性）：至少完成 1 条完整链路（新增/删除 polyline）只改 Document，Canvas 自动刷新；导出走 Document → C API → exporter。

