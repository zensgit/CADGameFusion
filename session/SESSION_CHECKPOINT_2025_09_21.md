# CADGameFusion 会话检查点（2025-09-21）

时间：2025-09-21 13:03:17 UTC
状态：准备合入“离线模式”小改动；更新今日快照/检查点；随后运行自检

## 新增/变更
- 计划为本地校验脚本加入：
  - `tools/local_ci.sh`: `--offline`/`--no-pip` 参数，跳过 pip 与 schema 校验分支；默认行为不变。
  - `scripts/check_verification.sh`: 新增 `--no-struct` 参数，跳过 NaN/结构性检查（仍可用 `--verbose` 查看详情）。
- 生成 `session/SNAPSHOT_2025_09_21.md` 与 `session/SESSION_CHECKPOINT_2025_09_21.md`；接下来更新 `SNAPSHOT_LATEST.md` 与 `SESSION_CHECKPOINT_LATEST.md` 指向。

## 下一步（本地）
1) 更新 LATEST 指针。
2) 打补丁实现上述参数；确保默认路径兼容原有 CI。
3) 运行 `bash scripts/dev_env_verify.sh`；如通过，可选择离线快速跑一轮导出+比对。

## 注意
- 不改动 CI 工作流逻辑；仅增强本地脚本选项，避免外网依赖。
- 如需合并至远端，请在 PR 中说明参数默认不变，兼容性良好。

（此文件为会话检查点，便于下次快速续接）
