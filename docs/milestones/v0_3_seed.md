## v0.3 Milestone — Seed (Draft)

Theme: Performance, Caching, Stability

Goals
- Reduce strict exports (use_vcpkg=true) wall clock by ≥30%
- Maintain Windows CI 95% success streak over 14 days
- Keep average CI run time ≤ 2m for core tracks

Candidate Tasks
- [#69] Windows Build Acceleration & Stability Monitoring
  - sccache/ccache evaluation, Ninja parallelism, retry/backoff tuning
  - KPIs: p50/p95 build time, streak, failure taxonomy
- [#70] vcpkg Cache Optimization for Strict Exports
  - Cache keys: OS + hash(CMakeLists.txt) + vcpkg*.json; binary cache verification
  - KPIs: cache hit rate, build time reduction
- [#72] CI Observability Enhancement
  - Daily CI Status: add p95 timing, trend lines (textual)
  - Baseline anchors: reference ci-baseline-2025-09-21 in reports
- [#73] Baseline Comparison Report Generator
  - Automated comparison reports with v0.3 baseline
- [#74] Cache Strategy A/B Testing Framework
  - Data-driven cache optimization experiments

Out of Scope
- Feature work in core/editor/unity
- Schema changes beyond validation assist

Review Cadence
- Weekly checkpoint, rolling adjustments based on CI telemetry

Related
- [Project Board Priorities](../../PROJECT_BOARD_PRIORITIES_v03.md) - Sprint planning and task priorities
- [v0.3 Milestone on GitHub](https://github.com/zensgit/CADGameFusion/milestone/4)
- [v0.3 Project Board](https://github.com/users/zensgit/projects/4)
- Baseline: ci-baseline-2025-09-21-v2 (86% success, 1.2 min avg)
