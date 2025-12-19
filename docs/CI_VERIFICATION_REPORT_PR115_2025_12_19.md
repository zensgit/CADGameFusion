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

### 3.1 CI 结果（GitHub Actions）

PR #115 最新提交（`3879bf3`）对应的 checks 已全绿：

- Core CI（Ubuntu/macOS/Windows）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846200
- Core Strict - Build and Tests（Ubuntu/macOS/Windows）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846223
- Local CI Gate（Ubuntu）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846204
- quick-check（Ubuntu）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846193
- solver-demo（Ubuntu）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846222
- solver-project（Ubuntu）✅
  - run: https://github.com/zensgit/CADGameFusion/actions/runs/20355846183

### 3.2 本轮修复要点（使 Windows 变绿）

- Windows 运行测试前追加 `PATH`（保证 `core.dll` / vcpkg DLL 可被发现）。
- Windows 严格构建避免 Ninja+MinGW（改用 Visual Studio/MSVC，匹配 vcpkg `x64-windows`）。
- Clipper2 链接改为优先使用 `find_package(Clipper2 CONFIG)` 的 `Clipper2::Clipper2` target（避免 Debug/Release CRT 混用）。

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
