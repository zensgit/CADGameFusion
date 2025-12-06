# Release Notes - 2025-09-30

## Highlights
- Qt Editor: 批量可见性命令去重与索引校验，改进脏标记与标题星号。
- Core: Clipper2 链接与 JoinType 修正（Square），提升布尔/偏移稳定性。
- CI/CD: 修复工作流（YAML 多行字符串、旧 GCC filesystem 链接），全流程恢复绿色。
- 文档: 新增 AGENTS.md（Repository Guidelines）。

## Developer Notes
- CMake
  - Clipper2 通过 pkg-config 链接；可选宏：`CADGF_SORT_RINGS`、`CADGF_USE_NLOHMANN_JSON`。
  - 本地构建：`cmake -S . -B build && cmake --build build -j`。
- 测试
  - 示例纳入 CTest；如改输出路径，同步 `cmake/RunDocExportExample.cmake`。

## Thanks
- CI 修复与验证：@maintainers
