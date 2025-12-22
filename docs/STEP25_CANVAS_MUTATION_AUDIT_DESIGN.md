# Step 25: Canvas Mutation Audit — Design

## Goals
- Ensure editor commands mutate the Document only and rely on observers to refresh the Canvas.
- Remove redundant Canvas dependencies from command implementations.

## Changes
1. **Command cleanup** (`editor/qt/src/mainwindow.cpp`)
   - Drop `CanvasWidget*` fields and `canvas->update()` calls from Document-backed commands.
   - Remove unused `canvas` captures for layer/property handlers.

## Rationale
The Document is the single source of truth. Commands should only update the
Document and let observer notifications drive Canvas refresh, reducing redundant
coupling and avoiding direct Canvas mutation paths.
