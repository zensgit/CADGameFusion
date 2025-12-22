# Step 16: Snap Hysteresis for Move — Design

## Goals
- Reduce snap jitter while dragging by locking to a snap target.
- Release the lock only after leaving a configurable distance.
- Keep the behavior internal to the editor without changing the stable C API.

## Changes
1. **Move snap lock** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Added lock state and target tracking during move.
   - Introduced `moveTargetWorldWithSnap()` which applies a release threshold.
2. **Release threshold** (`editor/qt/src/canvas.cpp`)
   - Uses `snapRadiusPixels * 1.5` (world-space) to decide when to release.
   - Keeps lock active within the threshold to avoid oscillation.

## Rationale
Without hysteresis, snapping can flicker between nearby candidates during drag.
Locking to the current snap target until the cursor exits a release radius
creates smoother, more predictable motion.
