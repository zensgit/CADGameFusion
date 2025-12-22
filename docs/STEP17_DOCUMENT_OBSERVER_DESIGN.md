# Step 17: Document Change Notifications + Canvas Auto-Sync — Design

## Goals
- Make Document the single source of truth with automatic view updates.
- Remove manual Canvas reload calls in editor workflows.
- Support bulk loads without excessive redraw churn.

## Changes
1. **Document change events** (`core/include/core/document.hpp`, `core/src/document.cpp`)
   - Added `DocumentObserver` and change event types.
   - Document emits notifications on entity/layer changes.
2. **Canvas auto-sync** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Canvas subscribes to Document events and updates its polyline cache incrementally.
   - Entity add/remove/geometry changes update cached points; metadata changes trigger repaint.
3. **Batch updates** (`core/include/core/document.hpp`, `core/src/document.cpp`, `editor/qt/src/project/project.cpp`)
   - Added `DocumentChangeGuard` to coalesce bulk changes and trigger a single reset.
   - Project load now batches Document mutations.

## Rationale
Manual `reloadFromDocument()` calls are easy to forget and can desync view state.
A small observer API lets the core remain authoritative while the editor stays in sync
through a lightweight projection cache.
