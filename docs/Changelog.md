# Changelog

All notable changes to this project will be documented in this file.

Format: Keep entries concise. Group by Added/Changed/Fixed/Docs/CI.

## 0.1.0 — 2025-09-12
- Added: Core skeleton (C++), C API `core_c` with document and basic ops
- Added: 2D ops API (triangulation, boolean/offset via earcut/Clipper2)
- Added: Qt editor MVP (canvas, add/triangulate/boolean/offset, selection, group/similar delete, clear all)
- Added: Unity adapter (C# P/Invoke) and sample scripts/scene
- Added: vcpkg manifest (earcut-hpp, clipper2), scripts for bootstrap/build
- Added: CI (core/qt) with vcpkg toolchain and `core_c` artifact upload
- Docs: Purpose/Plan, Roadmap, Editor Usage, API, Unity Guide, Build From Source, Troubleshooting, Contributing

