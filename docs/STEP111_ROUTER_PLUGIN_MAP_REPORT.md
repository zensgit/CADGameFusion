# Step 111: Router Plugin Auto Selection - Report

## Goal
Allow the PLM router to select an importer plugin automatically based on file extension when the upload request omits `plugin`.

## Scope
- `tools/plm_router_service.py`: add `--plugin-map` / `CADGF_ROUTER_PLUGIN_MAP` and extension-based plugin selection.
- Keep allowlist enforcement for auto-selected plugin paths.

## Summary
- The router now resolves `.dxf`, `.json`, etc. to configured plugin paths when `plugin` is missing.
- Default plugin still applies when no map entry matches.
- Auto-selected plugins remain subject to allowlist checks.

## Configuration
Example map:
- `.dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib`
- `.json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`
