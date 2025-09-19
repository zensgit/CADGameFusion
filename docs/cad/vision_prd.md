# CAD MVP v0.1 — Vision & PRD

- Goal: Deliver a usable parametric CAD MVP focused on sketch + constraints, basic features (Extrude/Revolve), robust IO, and reliability across Win/macOS/Linux.
- Users: Makers, students, and developers needing lightweight parametric modeling with scriptability and export to common formats.

## Problem & Motivation
- Existing CAD tools are heavy or closed; need a lean, open, testable pipeline integrated with modern CI.
- Emphasis on predictability, recoverability, and transparent data (versioned project format).

## MVP Scope (functional)
- Sketching: line/arc/circle/rect; constraints: horizontal/vertical/parallel/perpendicular/equal/concentric/dimensions.
- Features: Extrude, Revolve; boolean ops (union/diff/intersect) minimal viable.
- Project: create/open/save; undo/redo; units; export glTF; import basics (DXF/JSON prototype).
- UI (Qt): view, selection, property panel, command actions, timeline/history.

## Non-functional
- Cross‑platform, start-up time, stability (no crashes in normal flows), auto-save, deterministic rebuilds.
- Testability: unit + scenario tests; CI gates similar to current repo.

## Acceptance Criteria
- Demo: build on all platforms; create sketch with constraints; extrude to solid; save/reopen; export glTF; reopen consistent.
- 95% of predefined flows pass; zero known blockers; reproducible results across OS.

## Out of Scope (v0.1)
- Advanced surfacing; assemblies; drawings; advanced fillet/chamfer; complex importers.

