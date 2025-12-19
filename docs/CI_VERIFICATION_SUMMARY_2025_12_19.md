# CI & 本地验证汇总（2025-12-19）

## 1. 关联提交

- 分支：`main`
- 最新提交：`091d4b6`（docs: update architecture + local verification report）

## 2. CI 结果（GitHub Actions）

> 触发事件：push to `main`（`091d4b6`）

- Auto Daily After Exports：✅ success
- Core CI：✅ success
- Core Strict - Build and Tests：✅ success
- Core Strict - Exports, Validation, Comparison：✅ success
- Core Strict - Validation Simple：✅ success
- Local CI Gate：✅ success
- Quick Check - Verification + Lint：✅ success
- Test Actions：✅ success
- Test Simple：✅ success

## 3. 本地验证（参考报告）

详见 `docs/LOCAL_VERIFICATION_REPORT_2025_12_19.md`：

- vcpkg toolchain 下构建成功；`ctest` 5/5 全通过
- `tools/local_ci.sh` quick/full 全绿
- Qt Editor 构建 + CTest 通过
- 仅 `stb_image_write.h` 的 `sprintf` deprecated 警告（不影响结果）

## 4. 备注

- 已清理旧验证草稿与 `build_*` 目录。
