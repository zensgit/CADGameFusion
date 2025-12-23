# Step 36: TriMesh UI-Only Clarification — Design

## Goal
- Make it explicit that Canvas tri mesh data is a UI-only cache.

## Changes
1. Add a comment describing tri mesh as non-serialized, non-Document state.
2. Update the audit checklist to record completion.

## Files
- `editor/qt/src/canvas.hpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
