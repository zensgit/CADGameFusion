# Step 22: Document Notify Guards — Design

## Goals
- Avoid emitting change notifications when values are unchanged.
- Reduce redundant observer updates for no-op setters.

## Changes
1. **Document setter guards** (`core/src/document.cpp`)
   - Early-return when layer/entity attributes are unchanged.
   - Polyline updates now skip notification if points are identical.

## Rationale
Observers may trigger redraws on each notification. Guarding no-op updates reduces
unnecessary work while preserving correctness.
