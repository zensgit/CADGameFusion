# CADGameFusion

High‑performance 2D CAD/geometry core with an optional Qt editor and export tooling.

## Quick Links
- Repository Guidelines: [AGENTS.md](AGENTS.md)
- Manual test guide: [MANUAL_TEST_GUIDE.md](MANUAL_TEST_GUIDE.md)
- Release notes: [docs/Release-Notes-2025-09-30.md](docs/Release-Notes-2025-09-30.md)

## Build (Quick Start)
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build -V
```

## Editor (Qt)
Enable with `-DBUILD_EDITOR_QT=ON` and build target `editor_qt`.
