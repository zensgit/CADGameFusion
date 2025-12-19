# PR #115（`pr3/ci-align-local-ci`）本地验证与 CI 续跑说明（2025-12-19）

> 目的：给出“本地是否 OK / 还剩哪些 CI fail / 应该怎么续跑”的可执行结论。

## 1. 范围

- 仓库：`zensgit/CADGameFusion`
- PR：#115（分支 `pr3/ci-align-local-ci`）
- 本次涉及的关键改动（工作区内，待提交）：
  - `core/CMakeLists.txt`（Windows Clipper2 链接兜底）
  - `.github/workflows/cadgamefusion-core.yml`（Core CI vcpkg 自建 + cache + retry）
  - `.github/workflows/core-strict-build-tests.yml`（Windows 不再覆盖成 minimal vcpkg.json）
  - `.github/workflows/solver-project-trial.yml`（setup-python pip cache 指定依赖文件）
  - `docs/ARCHITECTURE_EVOLUTION_v0.6.md`（修正文档：稳定边界/插件机制/Editor 双轨制）

## 2. 本地验证（macOS arm64）

> 使用 vcpkg toolchain：`vcpkg/scripts/buildsystems/vcpkg.cmake`（manifest：`vcpkg.json`）。

### 2.1 `local_ci`（quick，严格退出）

```bash
bash tools/local_ci.sh \
  --build-dir build_verify_pr115_quick \
  --build-type Release \
  --toolchain "$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  --quick \
  --clean-exports \
  --strict-exit
```

结果：✅ PASS（validation/structure/field 全部 0 fail）。

### 2.2 `local_ci`（full，严格退出）

```bash
bash tools/local_ci.sh \
  --build-dir build_verify_pr115_full \
  --build-type Release \
  --toolchain "$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  --clean-exports \
  --strict-exit
```

结果：✅ PASS（validation/structure/field 全部 0 fail）。

### 2.3 CTest（smoke）

```bash
cmake --build build_verify_pr115_full --config Release --parallel 4
ctest --test-dir build_verify_pr115_full -V
```

结果：✅ 5/5 tests passed（包含 `plugin_host_demo_run`、`doc_export_example_run`）。

## 3. CI 现状与预期修复点

### 3.1 远端 CI 查询限制（本环境）

当前执行环境存在两点限制：
- 无法写入 `.git/**`（`Operation not permitted`），因此无法在此直接 `git commit` / `git push`。
- 无法解析/连接 `github.com`（DNS/网络不可达），且 `gh auth status` 显示 token invalid，因此无法在此查询或 rerun GitHub Actions。

### 3.2 上一次可观测到的 CI fail（在 `40346bc` 之后）

> 这是“上一次能拿到日志时”的失败摘要，用于解释为何需要下面这些改动。

- `solver-project`：`actions/setup-python@v5` 配 `cache: pip` 但仓库无 `requirements.txt` / `pyproject.toml`，导致 cache step 直接失败。
- `core-strict-build-tests (windows)`：workflow 覆盖成 `vcpkg-windows-minimal.json`，缺 `Eigen3`，configure 失败。
- `Core CI (macos)`：`lukka/run-vcpkg` 偶发 clone vcpkg 网络失败。
- `Core CI (windows)`：链接报 `LNK2019`（Clipper2 符号未解析），根因是只找到了头文件但未链接库。

### 3.3 本次已做的“针对性修复”（待提交）

- `solver-project-trial.yml`：为 `setup-python` 增加 `cache-dependency-path: requirements-ci.txt`。
- `core-strict-build-tests.yml`：移除 Windows “minimal vcpkg.json 覆盖”步骤（让 Windows 走完整 `vcpkg.json` 安装 Eigen3/Clipper2/TinyGLTF/Earcut）。
- `cadgamefusion-core.yml`：去掉 `lukka/run-vcpkg`，改为自建 vcpkg（固定 commit）+ cache，并为 Unix clone 增加 retry。
- `core/CMakeLists.txt`：Clipper2 检测改为“找到可链接目标才启用 `USE_CLIPPER2`”，并在无 pkg-config 时 `find_library` 兜底（Windows 必需）。

预期效果：
- `solver-project` 由 “cache step 失败” → 正常安装依赖并继续执行。
- Windows jobs 由 “缺 Eigen3/Clipper2 链接失败” → 正常 configure/build。
- macOS Core CI 由 “run-vcpkg clone 偶发失败” → retry + cache 后显著降低 flaky。

## 4. 续跑步骤（在你的本机终端执行）

1) 提交并推送（PR #115 分支）：

```bash
git checkout pr3/ci-align-local-ci
git add \
  core/CMakeLists.txt \
  .github/workflows/cadgamefusion-core.yml \
  .github/workflows/core-strict-build-tests.yml \
  .github/workflows/solver-project-trial.yml \
  docs/ARCHITECTURE_EVOLUTION_v0.6.md \
  docs/CI_VERIFICATION_REPORT_PR115_2025_12_19.md
git commit -m "fix(ci): stabilize core CI and plugin deps"
git push origin pr3/ci-align-local-ci
```

2) 观察 CI：

```bash
gh pr checks 115 --watch
```

如果你不使用 `gh`，也可以在 GitHub PR 页面点 “Re-run jobs / Re-run failed jobs”。

