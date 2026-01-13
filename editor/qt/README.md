# Legacy Qt Editor

This in-repo Qt editor is kept for backward compatibility.

The standalone Qt application now lives in:
https://github.com/zensgit/cadgf-app-qt

## Status
- Legacy/maintenance-only.
- New features and fixes should target the standalone repo.

## Build (legacy)
```bash
cmake -S . -B build -DBUILD_EDITOR_QT=ON
cmake --build build -j --target editor_qt
```
