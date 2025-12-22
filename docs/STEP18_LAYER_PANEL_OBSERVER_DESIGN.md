# Step 18: Layer Panel Auto-Refresh — Design

## Goals
- Keep the layer list synchronized with Document changes without manual refresh calls.
- Avoid re-entrant refreshes while handling UI signals.

## Changes
1. **LayerPanel observer** (`editor/qt/include/panels/layer_panel.hpp`, `editor/qt/src/panels/layer_panel.cpp`)
   - LayerPanel now implements `core::DocumentObserver`.
   - It subscribes to the Document and refreshes on layer changes or resets.
2. **Scheduled refresh** (`editor/qt/src/panels/layer_panel.cpp`)
   - Refresh is queued with a pending flag to avoid re-entrancy during UI events.
3. **Editor cleanup** (`editor/qt/src/mainwindow.cpp`)
   - Removed manual `m_layerPanel->refresh()` calls; observer handles updates.

## Rationale
Layer updates are now driven by Document notifications, matching the single-source-of-truth
model and eliminating manual refresh calls.
