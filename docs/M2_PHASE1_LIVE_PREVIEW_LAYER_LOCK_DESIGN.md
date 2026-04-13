# M2 Phase 1: Live Preview + Layer Lock — Design Document

## Overview

Phase 1 closes the Qt-to-Unity feedback loop and adds layer-level edit protection. These are the two highest-value M2 deliverables with minimal complexity.

## 1. LiveExportManager

### Architecture

```
Document change → DocumentObserver::on_document_changed()
  → LiveExportManager::scheduleExport()
    → QTimer (300ms debounce, singleShot, restarts on new changes)
      → doExport()
        → export_helpers::collectExportItems(doc)
        → exportScene(items, dir, JSON|GLTF, unitScale)
          → writes scene_YYYYMMDD_HHMMSS/ directory
            → Unity WatchAndReload.cs detects new files → reloads meshes
```

### Key Design Decisions

- **File system as IPC**: No sockets or named pipes needed. Unity's WatchAndReload.cs already polls for new `scene_*` directories. Qt just needs to auto-export.
- **300ms debounce**: Batches rapid document changes (e.g., dragging an entity) into a single export. Timer restarts on each new change.
- **Reuse existing export pipeline**: `collectExportItems()` + `exportScene()` unchanged. LiveExportManager is purely an orchestrator.
- **QSettings persistence**: Export directory stored in `QSettings("CADGameFusion", "LivePreview")` so it survives app restarts.

### Files

| File | Lines | Description |
|------|-------|-------------|
| `include/live_export_manager.hpp` | 34 | Class declaration |
| `src/live_export_manager.cpp` | 67 | Implementation |
| `mainwindow.cpp` | +44 | Menu actions, signal connections, QSettings |
| `mainwindow.hpp` | +2 | Member pointer |
| `CMakeLists.txt` | +3 | Build config |

### Signals

```cpp
void exported(const QString& sceneDir);    // Successful export, shows in status bar
void exportFailed(const QString& error);   // Error, shows in status bar
```

### Menu Items

- **File → Live Preview** (checkable toggle)
- **File → Set Live Preview Directory...**

## 2. Layer Lock

### Architecture

```
LayerPanel Lock checkbox → layerLockChanged(layerId, locked)
  → MainWindow → doc.set_layer_locked(layerId, locked)
    → Document observer fires → LayerPanel refreshes

Canvas interaction:
  mousePressEvent → hitEntityAtWorld() → isEntityLocked()
    → true: block move initiation, return
    → false: proceed with normal move
  keyPressEvent (R, +/-) → check all selected entities
    → any locked: return (block operation)
    → none locked: proceed
```

### Key Design Decisions

- **Selection allowed on locked entities**: User can still select and inspect locked entities. Only transforms (move/rotate/scale) are blocked. This matches CAD convention.
- **Per-layer, not per-entity**: Lock is a layer property, not an entity property. All entities on a locked layer are protected.
- **Core already supports it**: `Layer::locked` field and `Document::set_layer_locked()` existed in core. Only UI wiring was needed.
- **Lock check in Canvas**: `isEntityLocked()` checks the entity's layer locked state. Called in mousePressEvent (move) and keyPressEvent (rotate/scale).

### Files

| File | Change | Description |
|------|--------|-------------|
| `layer_panel.hpp` | +1 signal | `layerLockChanged(int, bool)` |
| `layer_panel.cpp` | +18 lines | Lock column + checkbox per layer |
| `canvas.hpp` | +1 method | `isEntityLocked()` declaration |
| `canvas.cpp` | +23 lines | `isEntityLocked()` impl + lock checks in 3 places |
| `mainwindow.cpp` | +8 lines | Connect signal to `set_layer_locked()` |

### Lock Check Points

1. `mousePressEvent` line ~742: Before `move_active_ = true`
2. `keyPressEvent` R key handler: Before entering rotate mode
3. `keyPressEvent` +/- key handler: Before scaling
