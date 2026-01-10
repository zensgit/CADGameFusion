# Step 113: Web Demo Auto Plugin UI - Report

## Goal
When the router provides a plugin map, hide the manual plugin input by default and show an override control in the web demo.

## Scope
- `tools/plm_router_service.py`: include `plugin_map` in `/health` response.
- `tools/plm_web_demo/index.html`: add auto-plugin notice and override button.
- `tools/plm_web_demo/app.js`: fetch `/health` and toggle plugin input visibility.
- `tools/plm_web_demo/style.css`: add basic layout for the auto-plugin notice.

## Summary
- `/health` now returns `plugin_map` keys when configured.
- Web demo hides plugin input when auto selection is available; users can click “Override plugin” to show the field.
