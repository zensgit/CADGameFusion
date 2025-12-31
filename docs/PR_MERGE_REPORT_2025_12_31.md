# PR Merge Report 2025-12-31

PR: https://github.com/zensgit/CADGameFusion/pull/265
Merge commit: 6ef9bc5c5b434da07c7f664173ddbdb85f8d98ee
Branch: feat/dxf-color-metadata

## Summary
- DXF importer now records per-entity color metadata (source + ACI) while keeping existing color resolution.
- C API exposes color metadata; document.json emits `color_source` and `color_aci` with schema updates.
- convert_cli build and DXF style smoke tests added; CTest full run verified.

## Verification
Local:
- `ctest --test-dir build_vcpkg -R "convert_cli_" -V`
- `ctest --test-dir build_vcpkg -V`

CI:
- All required checks green (17/17).
