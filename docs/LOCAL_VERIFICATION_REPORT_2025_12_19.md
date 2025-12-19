# CADGameFusion 本地验证报告（2025-12-19）

> 目的：对齐 CI 依赖并验证本地构建/CTest 是否全绿。

## 0. 范围与结论

- 结论：**vcpkg toolchain 下构建成功，`ctest` 5/5 全通过**；**`tools/local_ci.sh` quick/full 全绿**。
- 构建目录（CTest）：`build_local_vcpkg`
- 构建目录（local_ci quick）：`build_ci_gate`
- 构建目录（local_ci full）：`build_ci_full`
- 备注：仅出现 1 个第三方警告（`stb_image_write.h` 的 `sprintf` deprecated），不影响测试结果。

## 1. 环境信息

- OS：`Darwin hua-MacBook-Pro.local 25.1.0 ... arm64`
- CMake：`4.1.1`
- vcpkg：`2025-12-16-44bb3ce006467fc13ba37ca099f64077b8bbf84d`

## 2. 执行步骤

### 2.1 vcpkg 引导

```bash
scripts/bootstrap_vcpkg.sh
```

### 2.2 配置与构建（Release）

```bash
VCPKG_ROOT="$PWD/vcpkg" cmake -S . -B build_local_vcpkg \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_EDITOR_QT=OFF \
  -DCMAKE_TOOLCHAIN_FILE="$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  -DVCPKG_MANIFEST_MODE=ON

cmake --build build_local_vcpkg -j
```

### 2.3 运行 CTest

```bash
ctest --test-dir build_local_vcpkg -V
```

## 3. 结果

- CTest：**5/5 通过**
  - `c_api_minimal_run` ✅
  - `c_core_minimal_run` ✅
  - `cpp_core_minimal_run` ✅
  - `doc_export_example_run` ✅（Clipper2 已启用）
  - `plugin_host_demo_run` ✅

## 4. Local CI Gate（quick）

命令：

```bash
bash tools/local_ci.sh --build-dir build_ci_gate \
  --toolchain "$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  --build-type Release \
  --rtol 1e-6 \
  --gltf-holes full \
  --quick \
  --clean-exports \
  --strict-exit
```

结果：

- Validation：`OK=4, FAIL=0`（sample/units/complex/scene_complex_spec）
- Structure compare：`0` failures
- Field compare：`0` failures
- Summary JSON：`build_ci_gate/local_ci_summary.json`
- Full log：`build_ci_gate/local_ci_output.log`

## 5. Local CI Gate（full）

命令：

```bash
bash tools/local_ci.sh --build-dir build_ci_full \
  --toolchain "$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  --build-type Release \
  --rtol 1e-6 \
  --gltf-holes full \
  --clean-exports \
  --strict-exit
```

结果：

- Validation：`OK=8, FAIL=0`（sample/holes/multi/units/complex + 3 spec scenes）
- Structure compare：`0` failures
- Field compare：`0` failures
- Summary JSON：`build_ci_full/local_ci_summary.json`
- Full log：`build_ci_full/local_ci_output.log`

## 6. 观察到的警告

- 构建 `export_cli` 时来自 third-party `stb_image_write.h` 的 `sprintf` deprecated 警告。
  - 位置：`build_local_vcpkg/vcpkg_installed/arm64-osx/include/stb_image_write.h`
  - 影响：无（编译与测试通过）

## 7. Qt Editor 构建与 CTest

命令：

```bash
cmake -S . -B build_editor_verify -DBUILD_EDITOR_QT=ON \
  -DCMAKE_PREFIX_PATH="/Users/huazhou/Qt/6.9.2/macos" \
  -DCMAKE_TOOLCHAIN_FILE="$PWD/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  -DVCPKG_MANIFEST_MODE=ON

cmake --build build_editor_verify --config Release --parallel
ctest --test-dir build_editor_verify -V
```

结果：

- Qt Editor：构建成功（`editor_qt`）
- CTest：**5/5 通过**
  - `c_api_minimal_run` ✅
  - `c_core_minimal_run` ✅
  - `cpp_core_minimal_run` ✅
  - `doc_export_example_run` ✅
  - `plugin_host_demo_run` ✅
- 复测说明：在“选择上收 + 删除入 Undo”改动后复测，结果一致为 **5/5 通过**。
- 覆盖改动：导出/插件导出改为基于 Document，Canvas 仅投影；删除操作纳入 Command/Undo。
