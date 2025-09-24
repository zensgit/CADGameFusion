# vcpkg 缓存优化小结（最终）

时间: 2025-09-22
状态: 完成（性能达标；缓存命中采用 N/A 策略）
相关报告: VCPKG_CACHE_FINAL_TEST_REPORT_2025_09_22.md

## 已实施改动（概览）
- 工作流（严格导出 + 构建测试）
  - 显式启用 files 后端二进制缓存：`VCPKG_DEFAULT_BINARY_CACHE` + `VCPKG_BINARY_SOURCES=clear;files,<archives>,readwrite;default`
  - 固定 triplet：Linux `x64-linux`，macOS `x64-osx`，Windows `x64-windows`
  - 固定 vcpkg 版本：`c9fa965c2a1b1334469b4539063f3ce95383653c`
  - 记录 CMake 配置/构建日志（tee 到 `build/_cmake_*.log`）
  - 生成缓存统计（`build/vcpkg_cache_stats.json` + Markdown），并复制根级 `vcpkg_cache_stats.json`
  - 上传 artifacts：
    - 严格导出：`strict-exports-reports-ubuntu-latest/macos-latest/windows-latest`
    - 构建测试：`build-tests-reports-${{ runner.os }}`
  - 新增 `cache_probe` 调度输入（默认 false）：安装 `zlib` 用于一次性验证缓存命中链路
- 每日 CI 报表
  - 解析统计新增 `cacheable` 字段：header‑only 场景显示 “N/A” 而非“0%”
  - 扩展 artifact 名称回退，优先查找严格导出，多平台不命中时回退到构建测试

## 结论与策略
- v0.3 性能目标已达成（常规构建 ~1–3 分钟）。
- 依赖多为 header‑only，二进制缓存无 archives → 命中显示为 N/A 屬正常。
- 采用“维持现状 + N/A 准确标注”的策略，不再继续投入高成本调优。

## 验证指南（建议）
1) 常规验证（建议）
- 各运行两次：
  - Core Strict – Exports, Validation, Comparison（debug=false）
  - Core Strict – Build and Tests（debug=false）
- 运行 Daily CI Status，vcpkg 部分应显示 N/A（无可缓存端口）。

2) 证明链路（可选）
- 用 workflow_dispatch 设置 `cache_probe=true` 跑一次，再跑第二次。
- 期望第二次出现 >0% 的命中（zlib 产生 archives）。验证后恢复默认。

## 后续建议（如需）
- 若未来引入非 header‑only 端口或复杂依赖，再评估二进制缓存收益。
- 若需强一致环境与更高命中，可考虑：
  - NuGet 后端（GitHub Packages/Azure Blob）
  - 预构建 Docker 基础镜像
  - 自托管 Runner（持久化缓存）

---
本小结对应的详细数据、运行对比与决策分析，见：VCPKG_CACHE_FINAL_TEST_REPORT_2025_09_22.md。
