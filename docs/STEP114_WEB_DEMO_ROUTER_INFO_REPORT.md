# Step 114: Web Demo Router Info Panel - Report

## Goal
Expose router health + plugin map information in the web demo so users can see auto-selection capability at a glance.

## Scope
- `tools/plm_router_service.py`: include `plugin_map` + `default_plugin` in `/health` response.
- `tools/plm_web_demo/index.html`: add router info panel for status + plugin map.
- `tools/plm_web_demo/app.js`: query `/health` and populate panel.
- `tools/plm_web_demo/style.css`: add styles for the info panel.

## Summary
- Web demo now surfaces router status, plugin map, and default plugin name.
- Plugin input remains auto-hidden when router advertises plugin map.
