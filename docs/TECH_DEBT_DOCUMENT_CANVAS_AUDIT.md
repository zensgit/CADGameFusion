# Document/Canvas Coupling Audit (v0.6.x)

Date: 2025-12-23
Scope:
- Document/Canvas relationship in `editor/qt`
- Stable boundary usage (C ABI vs C++ API) for plugins/tools

## Current Alignment (Observed)
- Canvas observes Document via `core::DocumentObserver` and rebuilds caches in `editor/qt/src/canvas.cpp`.
- Commands and property edits in `editor/qt/src/mainwindow.cpp` mutate `core::Document`, not Canvas state.
- Plugin system uses C ABI (`core/include/core/plugin_abi_c_v1.h`), and sample plugin uses only `cadgf_*` C API.
- CLI tools use the C API (`core/include/core/core_c_api.h`).

## Prioritized Tech-Debt Checklist

### P0 (Remove bypass paths)
1) Public Canvas cache mutation bypasses Document
   - Location: `editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`
   - `CanvasWidget::updatePolylinePoints(...)` mutates `polylines_` directly.
   - No call sites today, but it enables future bypass of Document single source of truth.
   - Action: make private or remove; route edits through `core::Document::set_polyline_points`.
   - Status: Completed (Step 33).

### P1 (Clarify ownership)
2) Canvas exposes polyline states derived from its cache
   - Location: `editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`
   - `CanvasWidget::polylineStates()` returns metadata from Document + cached points.
   - Risk: other UI code may read Canvas as a data source.
   - Action: treat as debug-only or remove from public API; prefer querying Document or SelectionModel.
   - Status: Completed (Step 34).

3) Selection is stored in both Canvas and SelectionModel
   - Location: `editor/qt/src/canvas.cpp`, `editor/qt/src/selection/selection_model.cpp`
   - Canvas holds `selected_entities_`, SelectionModel holds `selection_`.
   - This is UI state (not core data), but dual ownership can drift if new code writes only one side.
   - Action: document ownership (SelectionModel as source; Canvas as view), or centralize updates.
   - Status: Completed (Step 35).

### P2 (Clarify ephemeral data)
4) Tri mesh data is Canvas-only
   - Location: `editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`
   - `triVerts_`/`triIndices_` are not in Document.
   - If triangulation results need undo/export, consider a Document entity or a cache keyed by Document revision.
   - If UI-only, document it as ephemeral.
   - Status: Completed (Step 36).

5) Full reload clears selection
   - Location: `editor/qt/src/canvas.cpp` (`reloadFromDocument`)
   - Selection is reset on reload, even if entity IDs still exist.
   - Action (optional): re-apply selection from SelectionModel after reload if IDs are valid.
   - Status: Completed (Step 37).

## Stable Boundary Usage Review
- C ABI is the stable boundary (`core/include/core/core_c_api.h`, `core/include/core/plugin_abi_c_v1.h`).
- Plugin registry uses C ABI (`tools/plugin_registry.hpp`); sample plugin uses C API only.
- Editor uses `core::Document` internally, and bridges to C API when exporting via plugins.
- No cross-DLL C++ ABI usage found outside the editor.

## Suggested Immediate Cleanup (Low Risk)
1) Done: removed `CanvasWidget::updatePolylinePoints(...)`.
2) Done: clarified Canvas cache ownership in `editor/qt/src/canvas.hpp`.

## Verification (If Changes Applied)
- Build and run Qt tests (if any behavior changes in editor code).
